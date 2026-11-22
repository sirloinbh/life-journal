import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect } from 'vitest';

type Scope = ReturnType<typeof within>;

/** Presses the button that opens a dialog and returns the dialog to query in. */
export const openDialog = async (buttonName: string) => {
  fireEvent.click(await screen.findByRole('button', { name: buttonName }));
  return within(await screen.findByRole('dialog'));
};

export const dialogClosed = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

export const type = (dialog: Scope, label: string, value: string) =>
  fireEvent.change(dialog.getByLabelText(label), { target: { value } });

export const pressEscape = () =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

/** Picks `option` in the Select labelled `label`. */
export async function choose(dialog: Scope, label: string, option: string) {
  fireEvent.click(dialog.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}
