import { XIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Combobox } from './components/ui/combobox';
import { Label } from './components/ui/label';
import { addName, MAX_ITEM_NAME_LENGTH } from './items';

/**
 * A list of free names on the item form (#215): tags or companions. Enter, a comma, or the Add button adds the typed
 * name; names used on other items are suggested. Each added name goes with the form as a hidden field named `name`,
 * and so does text still in the field when the form is saved, so nothing typed is lost.
 */
export function ItemNamesField({
  id,
  label,
  name,
  noun,
  initial,
  suggestions,
}: {
  id: string;
  /** The field label, e.g. `Tags (optional)`. */
  label: string;
  name: 'tags' | 'companions';
  /** One name in words, e.g. `tag`, for the button labels. */
  noun: string;
  initial: readonly string[];
  suggestions: readonly string[];
}) {
  const [names, setNames] = useState<string[]>([...initial]);
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const add = () => {
    setNames((current) => addName(current, draft));
    setDraft('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    // Enter on a highlighted suggestion picks it into the field (the Combobox does that); Enter again adds it.
    // Enter in an empty field still saves the form.
    const picking = event.currentTarget.hasAttribute('aria-activedescendant');
    const typed = draft.trim() !== '';
    if ((event.key === 'Enter' && typed && !picking) || event.key === ',') {
      event.preventDefault();
      add();
    }
  };
  // A suggestion already in the list (in any letter case) is not offered again.
  const offered = suggestions.filter((value) => addName(names, value).length > names.length);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {names.length > 0 ? (
        <ul aria-label={`Added ${name}`} className="flex flex-wrap gap-2">
          {names.map((value) => (
            <li key={value}>
              <Badge variant="secondary" className="gap-0.5 py-0 pr-0 text-body-sm">
                <span className="max-w-60 truncate">{value}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 pointer-coarse:size-9"
                  aria-label={`Remove ${noun} ${value}`}
                  onClick={() => {
                    setNames((current) => current.filter((other) => other !== value));
                    // The button goes away with its name, so the focus moves to the field, not the page.
                    field.current?.focus();
                  }}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </Badge>
              <input type="hidden" name={name} value={value} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            ref={field}
            id={id}
            name={name}
            value={draft}
            onValueChange={setDraft}
            onKeyDown={onKeyDown}
            options={offered}
            listLabel={`Earlier ${name}`}
            maxLength={MAX_ITEM_NAME_LENGTH}
          />
        </div>
        <Button type="button" variant="outline" aria-label={`Add ${noun}`} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
