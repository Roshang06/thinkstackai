export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "math"; latex: string; display?: boolean };

export type MarkupBlock =
  | { type: "paragraph"; children: Inline[] }
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "math"; latex: string; display: true }
  | { type: "code"; language: string; text: string };

const CODE_LANGUAGES = new Set(["java", "python", "py", "javascript", "js", "typescript", "ts", "cpp", "c", "csharp", "cs", "html", "css", "json", "bash", "sh", "shell", "sql", "jsx", "tsx", "go", "rust", "ruby", "rb", "php", "swift", "kotlin", "r", "matlab", "text", "plaintext", "xml", "yaml", "yml"]);

export function repairLessonText(value: string): string {
  return value
    .replaceAll("\u000c", "\\f")
    .replaceAll("\u0008", "\\b")
    .replaceAll("\u000b", "\\v")
    .replaceAll("\t", "\\t")
    .replace(/\r(?!\n)/g, "\\r");
}

export function isDisplayMath(latex: string): boolean {
  const trimmed = latex.trim();
  if (!trimmed) return false;
  if (trimmed.includes("\n") || trimmed.length > 36) return true;
  return /\\(?:frac|sum|int|lim|begin|matrix|cases|prod|binom|sqrt)\b/.test(trimmed);
}

function fold(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function headingLine(line: string): { level: 1 | 2; text: string } | null {
  const match = line.trim().match(/^(?:<h([12])>([\s\S]*?)<\/h\1>|<h([12])>([\s\S]*?)<h\3>|#{1,2}\s+(.+))$/i);
  if (!match) return null;
  const level = match[1] || match[3] || (line.trim().startsWith("##") ? "2" : "1");
  const text = (match[2] || match[4] || match[5] || "").replace(/<[^>]+>/g, "").trim();
  if (!text) return null;
  return { level: level === "1" ? 1 : 2, text };
}

type Marker = { token: string; close: string; kind: "bold" | "italic" | "code" | "math"; display?: boolean };

const MARKERS: Marker[] = [
  { token: "**", close: "**", kind: "bold" },
  { token: "__", close: "__", kind: "bold" },
  { token: "'''", close: "'''", kind: "code" },
  { token: '"""', close: '"""', kind: "code" },
  { token: "`", close: "`", kind: "code" },
  { token: "\\[", close: "\\]", kind: "math", display: true },
  { token: "$$", close: "$$", kind: "math" },
  { token: "\\(", close: "\\)", kind: "math" },
  { token: "$", close: "$", kind: "math" },
  { token: "*", close: "*", kind: "italic" },
  { token: "_", close: "_", kind: "italic" },
];

function closingAt(text: string, marker: Marker, openAt: number): number {
  const start = openAt + marker.token.length;
  const end = text.indexOf(marker.close, start);
  if (end < 0) return -1;
  const inner = text.slice(start, end);
  if (!inner.trim()) return -1;
  if (marker.kind !== "math" && inner.includes("\n\n")) return -1;
  if ((marker.kind === "italic" || marker.token === "`" || marker.token === "$") && inner.includes("\n")) return -1;
  if (marker.kind === "italic" && (inner.startsWith(" ") || inner.endsWith(" "))) return -1;
  if (marker.token === "*" && inner.includes("*")) return -1;
  if (marker.token === "_" && (inner.includes("_") || text[openAt - 1]?.match(/[\w]/) || text[end + 1]?.match(/[\w]/))) return -1;
  if (marker.token === "$" && (inner.includes("$") || text.startsWith("$$", openAt))) return -1;
  return end;
}

function earliest(text: string, from: number): { at: number; marker: Marker; close: number } | null {
  let found: { at: number; marker: Marker; close: number } | null = null;
  for (let index = from; index < text.length; index += 1) {
    for (const marker of MARKERS) {
      if (!text.startsWith(marker.token, index)) continue;
      if (marker.token === "*" && text.startsWith("**", index)) continue;
      if (marker.token === "_" && text.startsWith("__", index)) continue;
      if (marker.token === "$" && text.startsWith("$$", index)) continue;
      const close = closingAt(text, marker, index);
      if (close < 0) continue;
      if (!found || index < found.at) found = { at: index, marker, close };
      break;
    }
    if (found?.at === index) break;
  }
  return found;
}

function readFence(source: string, at: number): { language: string; code: string; end: number } | null {
  if (!source.startsWith("```", at)) return null;
  const close = source.indexOf("```", at + 3);
  if (close < 0) return null;
  let inner = source.slice(at + 3, close);
  let language = "";
  if (!inner.startsWith("\n")) {
    const lineBreak = inner.indexOf("\n");
    const head = (lineBreak < 0 ? inner : inner.slice(0, lineBreak)).trim();
    const oneLine = inner.match(/^([A-Za-z][\w#+-]*)[ \t]+([\s\S]+)$/);
    if (lineBreak >= 0 && /^[A-Za-z][\w#+-]*$/.test(head)) {
      language = head;
      inner = inner.slice(lineBreak + 1);
    } else if (oneLine && CODE_LANGUAGES.has(oneLine[1].toLowerCase())) {
      language = oneLine[1];
      inner = oneLine[2];
    }
  }
  return { language, code: inner.replace(/^\n/, "").replace(/\s+$/, ""), end: close + 3 };
}

function splitFences(source: string): Array<{ type: "text"; text: string } | { type: "code"; language: string; code: string }> {
  const chunks: Array<{ type: "text"; text: string } | { type: "code"; language: string; code: string }> = [];
  let cursor = 0;
  while (cursor < source.length) {
    const at = source.indexOf("```", cursor);
    if (at < 0) {
      chunks.push({ type: "text", text: source.slice(cursor) });
      break;
    }
    const fence = readFence(source, at);
    if (!fence) {
      chunks.push({ type: "text", text: source.slice(cursor) });
      break;
    }
    if (at > cursor) chunks.push({ type: "text", text: source.slice(cursor, at) });
    if (fence.code) chunks.push({ type: "code", language: fence.language, code: fence.code });
    cursor = fence.end;
  }
  return chunks;
}

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let cursor = 0;
  const source = repairLessonText(text);
  while (cursor < source.length) {
    const match = earliest(source, cursor);
    if (!match) {
      nodes.push({ type: "text", text: source.slice(cursor) });
      break;
    }
    if (match.at > cursor) nodes.push({ type: "text", text: source.slice(cursor, match.at) });
    const inner = source.slice(match.at + match.marker.token.length, match.close);
    if (match.marker.kind === "code") nodes.push({ type: "code", text: inner });
    else if (match.marker.kind === "math") {
      const latex = inner.trim();
      const display = match.marker.display === true || ((match.marker.token === "$$" || match.marker.token === "$") && isDisplayMath(latex));
      nodes.push({ type: "math", latex, display });
    } else if (match.marker.kind === "bold") nodes.push({ type: "bold", children: parseInline(inner) });
    else nodes.push({ type: "italic", children: parseInline(inner) });
    cursor = match.close + match.marker.close.length;
  }
  return nodes;
}

function appendProse(source: string, blocks: MarkupBlock[]): void {
  let paragraph: string[] = [];

  function flush(): void {
    const body = paragraph.join("\n").trim();
    paragraph = [];
    if (!body) return;
    let paragraphChildren: Inline[] = [];
    function pushParagraph(): void {
      if (paragraphChildren.length === 0) return;
      blocks.push({ type: "paragraph", children: paragraphChildren });
      paragraphChildren = [];
    }
    for (const child of parseInline(body)) {
      if (child.type === "math" && child.display) {
        pushParagraph();
        blocks.push({ type: "math", latex: child.latex, display: true });
        continue;
      }
      paragraphChildren.push(child);
    }
    pushParagraph();
  }

  for (const line of source.split("\n")) {
    const heading = headingLine(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", ...heading });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    paragraph.push(line.replace(/^(\s*)[*+-]\s+/, "$1• "));
  }
  flush();
}

export function parseMarkup(source: string): MarkupBlock[] {
  const blocks: MarkupBlock[] = [];
  for (const chunk of splitFences(source.replace(/\r\n/g, "\n"))) {
    if (chunk.type === "code") {
      blocks.push({ type: "code", language: chunk.language, text: chunk.code });
      continue;
    }
    appendProse(chunk.text, blocks);
  }
  return blocks;
}

export function displayProse(
  heading: string,
  body: string,
  sectionTitle: string,
  previousHeading: string,
): { heading: string; body: string } {
  const [part] = tidySectionParts([{ heading, body }], sectionTitle);
  const current = fold(part?.heading ?? heading);
  const previous = fold(previousHeading);
  const title = fold(sectionTitle);
  const repeat = !current || current === previous || current === title;
  return { heading: repeat ? "" : (part?.heading ?? ""), body: part?.body ?? body };
}

export function tidySectionParts(
  parts: { heading: string; body: string }[],
  sectionTitle: string,
): { heading: string; body: string }[] {
  const title = fold(sectionTitle);
  let previous = title;
  return parts.map((part) => {
    let body = part.body.trim();
    const leading = body.match(/^(?:<h[12]>[\s\S]*?<\/h[12]>|<h[12]>[\s\S]*?<h[12]>|#{1,2}\s+.+)\s*/i);
    if (leading) {
      const label = fold(leading[0]);
      if (!label || label === title || label === fold(part.heading) || label === previous) body = body.slice(leading[0].length).trim();
    }
    const firstBreak = body.indexOf("\n");
    const firstLine = (firstBreak < 0 ? body : body.slice(0, firstBreak)).trim();
    if (firstLine && [title, fold(part.heading), previous].includes(fold(firstLine))) {
      body = (firstBreak < 0 ? "" : body.slice(firstBreak + 1)).trim();
    }
    const heading = fold(part.heading);
    const repeat = !heading || heading === previous || heading === title;
    if (!repeat) previous = heading;
    return { heading: repeat ? "" : part.heading.trim(), body };
  });
}
