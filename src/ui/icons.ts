// Inline SVG icons for controls, including the Cube's turn buttons. The X and O marks on boards are in mark.ts.

const NS = "http://www.w3.org/2000/svg";

const PATHS = {
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  flag: "M4 22V4M4 4h13l-2 4 2 4H4",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14",
  close: "M18 6L6 18M6 6l12 12",
  play: "M6 4l14 8-14 8z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  back: "M15 18l-6-6 6-6",
  forward: "M9 18l6-6-6-6",
  home: "M3 11l9-8 9 8v10H3z",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  // The Cube's turn buttons: up and down (x axis), left and right (y axis), curved arrows (z axis), and a half turn
  "turn-up": "M12 19V5M5 12l7-7 7 7",
  "turn-down": "M12 5v14M19 12l-7 7-7-7",
  "turn-left": "M19 12H5M12 5l-7 7 7 7",
  "turn-right": "M5 12h14M12 5l7 7-7 7",
  "turn-clockwise": "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  "turn-anticlockwise": "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  "turn-half": "M20 8a8 8 0 0 0-14-3M4 4v5h5M4 16a8 8 0 0 0 14 3M20 20v-5h-5",
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", PATHS[name]);
  svg.append(path);
  return svg;
}
