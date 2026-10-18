const BANNED_TAG = /<(?:iframe|object|embed|link|meta|base|form)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|form)>|<(?:iframe|object|embed|link|meta|base|form)\b[^>]*\/?>/gi;
const EXTERNAL_SCRIPT = /<script\b[^>]*\bsrc\s*=[^>]*>[\s\S]*?<\/script>/gi;

function escapeText(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

export function sandboxDocument(raw: string): string | null {
  const source = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (source.length < 20 || source.length > 40_000) return null;
  const stripped = source.replace(EXTERNAL_SCRIPT, "").replace(BANNED_TAG, "").replace(/javascript\s*:/gi, "");
  const styles = [...stripped.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n");
  const scripts = [...stripped.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join("\n");
  const bodyMatch = stripped.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const fragment = bodyMatch ? bodyMatch[1] : stripped.replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "");
  const body = fragment.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").trim();
  if (!body && !scripts) return null;
  return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:;"><style>html,body{margin:0;background:#fff;color:#1d1915;font-family:sans-serif}${styles}</style></head><body>${body}<script>${scripts}</script></body></html>`;
}

export function widgetFallback(brief: string): string {
  const safe = sandboxDocument(`<main style="padding:24px"><h1>Interaction</h1><p>${escapeText(brief)}</p></main>`);
  return safe ?? "<!DOCTYPE html><html><body><p>Interaction unavailable.</p></body></html>";
}
