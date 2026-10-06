import { expect, type Page } from "@playwright/test";

// The design spec's measurable rules, run inside the page (docs/pwa-design-spec.md sections 1, 3, 4, 12):
//  - no horizontal scroll
//  - at most one primary button per view (inside the open dialog when there is one)
//  - no glass on glass
//  - one typeface (Nunito) at weights 400, 600, 700 and 800; no text under 12.5px, no input text under 16px
//  - every focusable control has at least a 44 by 44px hit area, measured by what a pointer finds 21.5px either side (a 44px edge is at 22)
//    of its centre. Board cells and cube stickers are exempt (spec FR-013): the board sizes them.

export const WIDTHS = [320, 480, 720] as const;

/** Runs in the page. Plain JavaScript only: it is serialised and sent to the browser. */
function auditInPage(): string[] {
  const problems: string[] = [];
  const name = (el: Element): string => {
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "";
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls}`;
  };
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };

  // no horizontal scroll
  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth + 1) problems.push(`horizontal scroll: content ${root.scrollWidth}px in a ${root.clientWidth}px window`);

  // one primary button per view
  const dialog = document.querySelector("dialog[open]");
  const scope: ParentNode = dialog ?? document;
  const primaries = [...scope.querySelectorAll(".btn-primary")].filter(visible);
  if (primaries.length > 1) problems.push(`${primaries.length} primary buttons in one view: ${primaries.map(name).join(", ")}`);

  // no glass on glass
  document.querySelectorAll(".glass .glass").forEach((el) => problems.push(`glass on glass: ${name(el)}`));

  // type
  const family = getComputedStyle(document.body).fontFamily;
  if (!/Nunito/.test(family)) problems.push(`body font is not Nunito: ${family}`);
  const WEIGHTS = new Set(["400", "600", "700", "800"]);
  const seen = new Set<string>();
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("svg") || el.closest(".sr-only") || el.classList.contains("sr-only") || !visible(el)) continue;
    const style = getComputedStyle(el);
    const control = /^(input|select|textarea)$/i.test(el.tagName);
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
    if (!ownText && !control) continue;
    const report = (what: string) => {
      const key = `${what}|${name(el)}`;
      if (!seen.has(key)) {
        seen.add(key);
        problems.push(`${what}: ${name(el)}`);
      }
    };
    if (style.fontFamily !== family) report(`font-family ${style.fontFamily}`);
    if (!WEIGHTS.has(style.fontWeight)) report(`font-weight ${style.fontWeight}`);
    const size = parseFloat(style.fontSize);
    if (control && el.getAttribute("type") !== "range" && el.getAttribute("type") !== "checkbox" && el.getAttribute("type") !== "radio" && size < 16) report(`input text ${size}px`);
    if (ownText && size < 12.5) report(`text ${size}px`);
  }

  // hit areas
  // with a dialog open the page behind it is inert, so only the dialog's own controls can be reached
  const focusable = (dialog ?? document).querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])');
  for (const el of focusable) {
    if ((el as HTMLInputElement).type === "hidden" || el.closest("[inert]") || el.closest("[hidden]")) continue;
    if (el.matches(".cell, .sticker, .skip-link, .sr-only") || el.closest(".sr-only")) continue;
    // a visually hidden radio or checkbox is operated through its label
    const target: HTMLElement = (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox") && el.labels?.[0]) || el;
    if (!visible(target)) continue;
    target.scrollIntoView({ block: "center", inline: "center" });
    const r = target.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const points: [number, number][] = [[cx - 21.5, cy], [cx + 21.5, cy], [cx, cy - 21.5], [cx, cy + 21.5]];
    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === target || target.contains(hit) || hit.contains(target) || hit === el || el.contains(hit))) {
        problems.push(`hit area under 44px: ${name(target)} at (${Math.round(r.width)}x${Math.round(r.height)})`);
        break;
      }
    }
  }
  return problems;
}

/** Problems in the current view at one width. */
export async function auditPage(page: Page): Promise<string[]> {
  return page.evaluate(auditInPage);
}

/** Resize through every design width and collect the problems at each. */
export async function auditAtWidths(page: Page, label: string, widths: readonly number[] = WIDTHS): Promise<void> {
  const all: string[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(60); // layout settles after the resize
    for (const problem of await auditPage(page)) all.push(`[${width}px] ${problem}`);
  }
  expect(all, `${label}\n${all.join("\n")}`).toEqual([]);
}
