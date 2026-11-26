// File downloads from the API for the backup screen (#208).

/** The file name in a Content-Disposition header, quoted or not, or null. */
export function attachmentName(header: string | null) {
  const match = header?.match(/filename="([^"]+)"|filename=([^;\s]+)/);
  return match ? (match[1] ?? match[2]) : null;
}

// fetch, not requestJson: the answer is a file. The sign-in cookie goes along as for any same-origin
// request, and a failed answer still carries { error } like the rest of the API.
export async function download(path: string, fallbackName: string) {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin' });
  } catch {
    throw new Error('Cannot reach the server');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(
      typeof body?.error === 'string' && body.error
        ? body.error
        : `The download failed (HTTP ${response.status})`,
    );
  }
  const blob = await response.blob();
  const name = attachmentName(response.headers.get('content-disposition')) ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers start reading the file after click() returns, so the address lives a little longer.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
