/** The text of every string literal in a TypeScript source: comments are skipped and template literals give their static parts. */
export function stringLiterals(source: string): { text: string; line: number }[] {
  const found: { text: string; line: number }[] = [];
  let i = 0;
  let line = 1;
  const n = source.length;
  const readTemplate = (): void => {
    // after the opening backtick
    let text = "";
    const start = line;
    while (i < n && source[i] !== "`") {
      if (source[i] === "\\") {
        text += source[i + 1] ?? "";
        if (source[i + 1] === "\n") line++;
        i += 2;
      } else if (source[i] === "$" && source[i + 1] === "{") {
        found.push({ text, line: start });
        text = "";
        i += 2;
        let depth = 1;
        while (i < n && depth > 0) {
          const c = source[i];
          if (c === "{") depth++;
          else if (c === "}") depth--;
          else if (c === "`") {
            i++;
            readTemplate();
            continue;
          } else if (c === '"' || c === "'") readQuoted(c);
          if (c === "\n") line++;
          i++;
        }
      } else {
        if (source[i] === "\n") line++;
        text += source[i];
        i++;
      }
    }
    i++; // closing backtick
    found.push({ text, line: start });
  };
  const readQuoted = (quote: string): void => {
    let text = "";
    const start = line;
    i++;
    while (i < n && source[i] !== quote && source[i] !== "\n") {
      if (source[i] === "\\") {
        text += source[i + 1] ?? "";
        i += 2;
      } else {
        text += source[i];
        i++;
      }
    }
    found.push({ text, line: start });
    // the loop in the caller steps past the closing quote
  };
  while (i < n) {
    const c = source[i]!;
    if (c === "\n") {
      line++;
      i++;
    } else if (c === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i++;
    } else if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line++;
        i++;
      }
      i += 2;
    } else if (c === '"' || c === "'") {
      readQuoted(c);
      i++;
    } else if (c === "`") {
      i++;
      readTemplate();
    } else i++;
  }
  return found;
}
