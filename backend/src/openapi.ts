// OpenAPI 3.1 document built from the registered Express routes and the server's own Zod schemas.
// `npm run openapi -w backend` writes docs/openapi.json; a test fails when it is out of date.
import type express from 'express';
import type { z } from 'zod/v4';

import { idSchema } from './contract.js';
import { itemFields, itemPatch, listQuery } from './items.js';

type Json = Record<string, unknown>;

type CheckDef = {
  check: string;
  format?: string;
  pattern?: RegExp;
  minimum?: number;
  maximum?: number;
  length?: number;
  value?: number;
  inclusive?: boolean;
};
const checksOf = (def: Json) =>
  ((def.checks ?? []) as { _zod: { def: CheckDef } }[]).map((check) => check._zod.def);

const STRING_FORMATS: Record<string, string> = {
  uuid: 'uuid',
  guid: 'uuid',
  email: 'email',
  url: 'uri',
  datetime: 'date-time',
  date: 'date',
  time: 'time',
};
function stringFormat(format: string) {
  const name = STRING_FORMATS[format];
  if (!name) throw new Error(`Unsupported string format: ${format}`);
  return name;
}
// z.number().int() is a check and z.int() is the type itself; float32 and float64 are the same kinds but not integers.
const isIntegerFormat = (format: unknown) => typeof format === 'string' && format.includes('int');

// Converts the Zod 4 types the API uses. Refinements (cross-field rules) cannot be expressed
// here; any other unsupported type fails loudly instead of being silently dropped.
export function jsonSchema(schema: z.ZodType): Json {
  const def = schema._zod.def as unknown as Json & { type: string };
  switch (def.type) {
    case 'object': {
      const shape = def.shape as Record<string, z.ZodType>;
      const required = Object.keys(shape).filter((key) => !shape[key].isOptional());
      const catchall = def.catchall as z.ZodType | undefined;
      return {
        type: 'object',
        properties: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, jsonSchema(v)])),
        ...(required.length ? { required } : {}),
        ...(catchall?._zod.def.type === 'never' ? { additionalProperties: false } : {}),
      };
    }
    case 'string': {
      const out: Json = { type: 'string' };
      // z.uuid() and z.email() carry their format on the type, z.string().uuid() as a check.
      if (def.format) out.format = stringFormat(def.format as string);
      for (const check of checksOf(def)) {
        if (check.check === 'min_length') out.minLength = check.minimum;
        else if (check.check === 'max_length') out.maxLength = check.maximum;
        else if (check.check === 'length_equals') out.minLength = out.maxLength = check.length;
        else if (check.check === 'string_format' && check.format === 'regex')
          out.pattern = check.pattern!.source;
        else if (check.check === 'string_format') out.format = stringFormat(check.format!);
        // `overwrite` is trim(); `custom` is a refinement.
        else if (check.check !== 'overwrite' && check.check !== 'custom')
          throw new Error(`Unsupported string check: ${check.format ?? check.check}`);
      }
      return out;
    }
    case 'number': {
      const out: Json = { type: isIntegerFormat(def.format) ? 'integer' : 'number' };
      for (const check of checksOf(def)) {
        if (check.check === 'number_format') {
          if (isIntegerFormat(check.format)) out.type = 'integer';
        } else if (check.check === 'greater_than')
          out[check.inclusive ? 'minimum' : 'exclusiveMinimum'] = check.value;
        else if (check.check === 'less_than')
          out[check.inclusive ? 'maximum' : 'exclusiveMaximum'] = check.value;
        else if (check.check === 'multiple_of') out.multipleOf = check.value;
        else if (check.check !== 'custom')
          throw new Error(`Unsupported number check: ${check.check}`);
      }
      return out;
    }
    case 'boolean':
      return { type: 'boolean' };
    case 'array': {
      let min: number | undefined;
      let max: number | undefined;
      for (const check of checksOf(def)) {
        if (check.check === 'min_length') min = check.minimum;
        else if (check.check === 'max_length') max = check.maximum;
        else if (check.check === 'length_equals') min = max = check.length;
        else if (check.check !== 'custom')
          throw new Error(`Unsupported array check: ${check.check}`);
      }
      return {
        type: 'array',
        items: jsonSchema(def.element as z.ZodType),
        ...(min !== undefined ? { minItems: min } : {}),
        ...(max !== undefined ? { maxItems: max } : {}),
      };
    }
    case 'enum':
      return { type: 'string', enum: Object.values(def.entries as Record<string, string>) };
    case 'nullable': {
      const inner = jsonSchema(def.innerType as z.ZodType);
      return typeof inner.type === 'string'
        ? { ...inner, type: [inner.type, 'null'] }
        : { anyOf: [inner, { type: 'null' }] };
    }
    case 'optional':
      return jsonSchema(def.innerType as z.ZodType);
    case 'default':
      return { ...jsonSchema(def.innerType as z.ZodType), default: def.defaultValue };
    // .transform() is a pipe; the request is described by what comes in. z.preprocess() is a pipe
    // starting from a transform, which says nothing about the value, so its target describes it.
    case 'pipe': {
      const input = def.in as z.ZodType;
      return jsonSchema(input._zod.def.type === 'transform' ? (def.out as z.ZodType) : input);
    }
    case 'record':
      return { type: 'object', additionalProperties: jsonSchema(def.valueType as z.ZodType) };
    case 'unknown':
      return {};
    default:
      throw new Error(`Unsupported Zod type for OpenAPI: ${def.type}`);
  }
}

type Operation = {
  summary: string;
  body?: [name: string, schema: z.ZodType];
  query?: z.ZodType;
  // Success status first; the rest are documented error statuses.
  status: number[];
};
// Every registered route must appear here exactly once (checked when building).
const operations: Record<string, Operation> = {
  'GET /api/me': { summary: 'Get the signed-in user', status: [200, 401, 503] },
  'GET /api/health': { summary: 'Check that the server and database respond', status: [200, 500] },
  'GET /api/items': {
    summary: 'List items, filtered and sorted (the start date must not be after the end date)',
    query: listQuery,
    status: [200, 400, 401, 500, 503],
  },
  'POST /api/items': {
    summary:
      'Create an item (category rules, subtype, dates, rating and review depend on category and status)',
    body: ['ItemInput', itemFields],
    status: [201, 400, 401, 413, 500, 503],
  },
  'GET /api/items/:id': { summary: 'Get one item', status: [200, 400, 401, 404, 500, 503] },
  'PATCH /api/items/:id': {
    summary: 'Update some fields of an item; the merged item must still follow the category rules',
    body: ['ItemPatch', itemPatch],
    status: [200, 400, 401, 404, 413, 500, 503],
  },
  'DELETE /api/items/:id': { summary: 'Delete an item', status: [204, 400, 401, 404, 500, 503] },
  'GET /api/terms': {
    summary: 'List the study terms with whether each one is learned',
    status: [200, 401, 500, 503],
  },
  'PUT /api/terms/:id/learned': {
    summary: 'Mark a term as learned',
    status: [204, 401, 404, 500, 503],
  },
  'DELETE /api/terms/:id/learned': {
    summary: 'Mark a term as not learned',
    status: [204, 401, 404, 500, 503],
  },
};

type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: Layer[] };
  matchers?: ((path: string) => unknown)[];
};
// Express 5 keeps no mount path on a router layer, so each router is matched against these known mounts.
const mounts = ['/api/items', '/api/terms'];
function routesOf(stack: Layer[], prefix: string): string[] {
  return stack.flatMap((layer) => {
    if (layer.route) {
      const path = layer.route.path === '/' ? prefix : prefix + layer.route.path;
      return Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${path}`);
    }
    if (layer.name !== 'router' || !layer.handle?.stack) return [];
    const mount = mounts.find((m) => layer.matchers?.some((match) => match(m)));
    if (!mount) throw new Error('A router is mounted at a path that is not listed in `mounts`');
    return routesOf(layer.handle.stack, prefix + mount);
  });
}
export function registeredRoutes(app: express.Express) {
  return routesOf((app as unknown as { router: { stack: Layer[] } }).router.stack, '');
}

const statusText: Record<number, string> = {
  200: 'Success',
  201: 'Created',
  204: 'Success, no content',
  400: 'Invalid input',
  401: 'Sign-in required',
  404: 'Not found',
  413: 'Request body too large',
  500: 'Server error',
  503: 'The shared sign-in service could not be reached',
};

export function buildOpenApi(app: express.Express) {
  const routes = registeredRoutes(app);
  const missing = routes.filter((route) => !operations[route]);
  const extra = Object.keys(operations).filter((route) => !routes.includes(route));
  if (missing.length || extra.length)
    throw new Error(`OpenAPI operations differ from routes: +${missing} -${extra}`);
  const schemas: Json = {
    Error: {
      type: 'object',
      properties: { error: { type: 'string', description: 'English error message' } },
      required: ['error'],
    },
  };
  const paths: Record<string, Json> = {};
  for (const route of [...routes].sort()) {
    const [method, path] = route.split(' ');
    const op = operations[route];
    const parameters: Json[] = [...path.matchAll(/:(\w+)/g)].map(([, name]) => ({
      name,
      in: 'path',
      required: true,
      // Item ids are numbers; term ids are strings.
      schema:
        name === 'id' && path.startsWith('/api/items') ? jsonSchema(idSchema) : { type: 'string' },
    }));
    if (op.query) {
      const query = jsonSchema(op.query) as { properties: Json; required?: string[] };
      for (const [name, schema] of Object.entries(query.properties))
        parameters.push({ name, in: 'query', required: !!query.required?.includes(name), schema });
    }
    if (op.body) schemas[op.body[0]] = jsonSchema(op.body[1]);
    const [success, ...failures] = op.status;
    const responses: Json = { [success]: { description: statusText[success] } };
    for (const status of failures)
      responses[status] = {
        description: statusText[status],
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      };
    const key = path.replace(/:(\w+)/g, '{$1}');
    paths[key] ??= {};
    paths[key][method.toLowerCase()] = {
      summary: op.summary,
      ...(parameters.length ? { parameters } : {}),
      ...(op.body
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: { $ref: `#/components/schemas/${op.body[0]}` } },
              },
            },
          }
        : {}),
      responses,
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Life Journal API',
      version: '1.0.0',
      description:
        'Dates are YYYY-MM-DD (Asia/Seoul). Every route except /api/health needs the shared sign-in. Every error response is { error: English message }. Any /api path can also answer 429 (rate limit) with the same body.',
    },
    servers: [{ url: '/' }],
    paths,
    components: { schemas },
  };
}
