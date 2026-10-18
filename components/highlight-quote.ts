function clearTutorMarks(root: ParentNode): void {
  root.querySelectorAll("mark[data-tutor]").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

function wrapQuote(root: ParentNode, quote: string): boolean {
  const needle = quote.replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 4) return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let full = "";
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!(node instanceof Text) || node.parentElement?.closest("mark[data-tutor]")) continue;
    nodes.push(node);
    full += node.textContent ?? "";
  }
  const collapsed = full.replace(/\s+/g, " ");
  const lower = collapsed.toLowerCase();
  let matched = needle;
  let start = lower.indexOf(matched);
  if (start < 0) {
    const words = needle.split(" ");
    matched = "";
    for (let count = words.length - 1; count >= 4; count -= 1) {
      const partial = words.slice(0, count).join(" ");
      const at = lower.indexOf(partial);
      if (at >= 0) {
        matched = partial;
        start = at;
        break;
      }
    }
  }
  if (start < 0 || matched.length < 12) return false;
  const map: number[] = [];
  let built = "";
  for (let index = 0; index < full.length; index += 1) {
    const char = full[index] ?? "";
    if (/\s/.test(char)) {
      if (!built.endsWith(" ")) {
        built += " ";
        map.push(index);
      }
      continue;
    }
    built += char;
    map.push(index);
  }
  const from = map[start];
  const to = map[start + matched.length - 1];
  if (from === undefined || to === undefined) return false;
  let cursor = 0;
  for (const node of nodes) {
    const text = node.textContent ?? "";
    const nodeStart = cursor;
    const nodeEnd = cursor + text.length;
    cursor = nodeEnd;
    const sliceFrom = Math.max(from, nodeStart) - nodeStart;
    const sliceTo = Math.min(to + 1, nodeEnd) - nodeStart;
    if (sliceFrom >= sliceTo) continue;
    const middle = node.splitText(sliceFrom);
    middle.splitText(sliceTo - sliceFrom);
    const mark = document.createElement("mark");
    mark.dataset.tutor = "true";
    mark.className = "rounded bg-accent-soft px-0.5";
    middle.parentNode?.replaceChild(mark, middle);
    mark.appendChild(middle);
  }
  return true;
}

export function applyTutorHighlights(quotes: { blockId: string; quote: string }[]): void {
  clearTutorMarks(document);
  let first: HTMLElement | null = null;
  for (const item of quotes) {
    const root = document.querySelector(`[data-block-id="${CSS.escape(item.blockId)}"]`);
    if (!(root instanceof HTMLElement)) continue;
    wrapQuote(root, item.quote);
    const mark = root.querySelector("mark[data-tutor]");
    if (!first) first = mark instanceof HTMLElement ? mark : root;
  }
  first?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function clearTutorHighlights(): void {
  clearTutorMarks(document);
}
