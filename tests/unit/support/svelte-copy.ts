import { stringLiterals } from "./string-literals.ts";

// The words a Svelte component (or the page, src/app.html) can show, for the copy rules in copy-rules.test.ts. No dependency: a small
// reader for what the templates here are made of. It returns the text nodes, the aria-label, title, placeholder and alt attributes,
// and every string literal in a template expression and in the script. Comments and style blocks are not copy.

export interface Piece {
  text: string;
  /** 1-based line in the file. */
  line: number;
}

const COPY_ATTRIBUTES = new Set(["aria-label", "title", "placeholder", "alt"]);

const blank = (text: string): string => text.replace(/[^\n]/g, " ");

export function svelteCopy(source: string): Piece[] {
  const out: Piece[] = [];
  // everything below keeps the file's length and line breaks, so an index is a place in the file
  let src = source.replace(/<!--[\s\S]*?-->/g, blank).replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, blank);
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  const lineAt = (index: number): number => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const literals = (code: string, at: number): void => {
    const base = lineAt(at);
    for (const { text, line } of stringLiterals(code)) out.push({ text, line: base + line - 1 });
  };

  // the script: its string literals
  src = src.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (_whole, open: string, body: string, close: string, offset: number) => {
    literals(body, offset + open.length);
    return blank(open) + blank(body) + blank(close);
  });

  /** The index just past the `}` that closes the `{` at `start`, with strings and nested braces skipped. */
  const endOfExpression = (start: number): number => {
    let depth = 0;
    let quote = "";
    for (let i = start; i < src.length; i++) {
      const c = src[i]!;
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = "";
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return i + 1;
    }
    return src.length;
  };

  const pushText = (raw: string, at: number): void => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return;
    out.push({ text, line: lineAt(at + raw.search(/\S/)) });
  };

  /** Static text with {expressions} inside (a quoted attribute value, or a run of text): the static parts as text, the expressions as code. */
  const mixed = (start: number, end: number, asText: boolean): void => {
    let i = start;
    let from = start;
    while (i < end) {
      if (src[i] === "{") {
        if (asText) pushText(src.slice(from, i), from);
        const close = endOfExpression(i);
        literals(src.slice(i + 1, close - 1), i + 1);
        i = close;
        from = i;
      } else i++;
    }
    if (asText) pushText(src.slice(from, end), from);
  };

  let i = 0;
  let textStart = 0;
  const flushText = (end: number): void => mixed(textStart, end, true);
  while (i < src.length) {
    const c = src[i]!;
    if (c === "{") {
      // an expression or a block tag in the text: the text before it, then its strings
      flushText(i);
      const close = endOfExpression(i);
      literals(src.slice(i + 1, close - 1), i + 1);
      i = close;
      textStart = i;
    } else if (c === "<" && /[A-Za-z/!]/.test(src[i + 1] ?? "")) {
      flushText(i);
      // the tag, up to its closing >
      let j = i + 1;
      let quote = "";
      let depth = 0;
      for (; j < src.length; j++) {
        const d = src[j]!;
        if (quote) {
          if (d === quote) quote = "";
        } else if (depth > 0) {
          if (d === "{") depth++;
          else if (d === "}") depth--;
        } else if (d === '"' || d === "'") quote = d;
        else if (d === "{") depth = 1;
        else if (d === ">") break;
      }
      readAttributes(i, j);
      i = j + 1;
      textStart = i;
    } else i++;
  }
  flushText(src.length);

  /** The attributes of the tag between `from` and `to`. */
  function readAttributes(from: number, to: number): void {
    let k = from + 1;
    while (k < to && !/[\s/>]/.test(src[k]!)) k++; // the tag name
    while (k < to) {
      while (k < to && /[\s/]/.test(src[k]!)) k++;
      if (k >= to) break;
      if (src[k] === "{") {
        // a spread or a shorthand: {...rest}, {id}
        const close = endOfExpression(k);
        literals(src.slice(k + 1, close - 1), k + 1);
        k = close;
        continue;
      }
      const nameStart = k;
      while (k < to && !/[\s=/>{]/.test(src[k]!)) k++;
      const name = src.slice(nameStart, k);
      while (k < to && /\s/.test(src[k]!)) k++;
      if (src[k] !== "=") continue;
      k++;
      while (k < to && /\s/.test(src[k]!)) k++;
      if (src[k] === '"' || src[k] === "'") {
        const quote = src[k]!;
        const close = src.indexOf(quote, k + 1);
        mixed(k + 1, close < 0 ? to : close, COPY_ATTRIBUTES.has(name));
        k = close < 0 ? to : close + 1;
      } else if (src[k] === "{") {
        const close = endOfExpression(k);
        literals(src.slice(k + 1, close - 1), k + 1);
        k = close;
      } else {
        while (k < to && !/[\s/>]/.test(src[k]!)) k++;
      }
    }
  }

  return out.sort((a, b) => a.line - b.line);
}
