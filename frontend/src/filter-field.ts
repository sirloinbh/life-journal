// What a filter field means, apart from the DOM (#154). A browser reports a half-typed or impossible
// date as an empty value with `validity.badInput`; jsdom cannot type one, so tests call these.

type FieldState = { value: string; validity: Pick<ValidityState, 'badInput'> };

/** The condition the field asks for, or null when it holds a half-typed date and asks for nothing yet. */
export function typedCondition(field: FieldState): string | null {
  return field.validity.badInput ? null : field.value.trim();
}

/** Whether the field must be set to `condition`: it shows another value, or a half-typed date. */
export function needsReset(field: FieldState, condition: string): boolean {
  return field.validity.badInput || field.value.trim() !== condition;
}
