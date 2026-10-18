export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "math"; latex: string };

export type MarkupBlock =
  | { type: "paragraph"; children: Inline[] }
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "math"; latex: string; display: true };

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

function inline(text: string): Inline[] {
  return text
    .split(/(\$[^$\n]+?\$|\*\*[^*\n]+\*\*)/g)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) return { type: "bold", text: part.slice(2, -2) };
      if (part.startsWith("$") && part.endsWith("$")) return { type: "math", latex: part.slice(1, -1).trim() };
      return { type: "text", text: part };
    });
}

export function parseMarkup(source: string): MarkupBlock[] {
  const blocks: MarkupBlock[] = [];
  let paragraph: string[] = [];

  function flush(): void {
    const body = paragraph.join("\n").trim();
    paragraph = [];
    if (!body) return;
    for (const piece of body.split(/(\$\$[\s\S]+?\$\$)/g)) {
      if (!piece) continue;
      if (piece.startsWith("$$") && piece.endsWith("$$")) {
        const latex = piece.slice(2, -2).trim();
        if (!latex) continue;
        if (isDisplayMath(latex)) blocks.push({ type: "math", latex, display: true });
        else blocks.push({ type: "paragraph", children: [{ type: "math", latex }] });
        continue;
      }
      if (piece.trim()) blocks.push({ type: "paragraph", children: inline(piece) });
    }
  }

  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
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
    paragraph.push(line);
  }
  flush();
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
    const heading = fold(part.heading);
    const repeat = !heading || heading === previous || heading === title;
    if (!repeat) previous = heading;
    return { heading: repeat ? "" : part.heading.trim(), body };
  });
}
