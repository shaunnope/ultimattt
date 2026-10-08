// Inline SVG icons for controls, including the Cube's turn buttons. The X and O marks on boards are in mark.ts.

const NS = "http://www.w3.org/2000/svg";

export const ICON_PATHS = {
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
  // Appearance: the sun and moon for the two modes, a screen for "follow the device", and a palette
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  system: "M3 4h18v12H3zM8 20h8M12 16v4",
  palette: "M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01",
  // The rest of the core set: a magnifier, a notice, a tick and a cross for outcomes, a clock and a heart
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  check: "M20 6L9 17l-5-5",
  cross: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6",
  timer: "M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v4l3 2M9 2h6",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  // This game's own concepts: each mode, and the two hints (a dot on the cell that wins, a dashed ring on the cell to block)
  "mode-classic": "M9 3v18M15 3v18M3 9h18M3 15h18",
  "mode-ultimate": "M3 3h18v18H3zM12 3v18M3 12h18M6.5 6.5h2v2h-2zM15.5 6.5h2v2h-2zM6.5 15.5h2v2h-2zM15.5 15.5h2v2h-2z",
  "mode-twist": "M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10",
  "hint-win": "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  "hint-block": "M12 4a8 8 0 0 1 4 1M19 8a8 8 0 0 1 1 4M20 15a8 8 0 0 1-3 4M12 20a8 8 0 0 1-4-1M5 16a8 8 0 0 1-1-4M5 8a8 8 0 0 1 3-3",
  // The opponent choices on the start screen: a chip for the computer, a phone for this device, signal arcs for the network
  "player-computer": "M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  "player-device": "M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2",
  "player-network": "M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16.2a5 5 0 0 1 7 0M12 20h.01",
  // A padlock: body and shackle
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  "turn-half": "M20 8a8 8 0 0 0-14-3M4 4v5h5M4 16a8 8 0 0 0 14 3M20 20v-5h-5",
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Every icon is drawn with round caps and joins, whatever the CSS around it says. */
export const ICON_STROKE = { "stroke-linecap": "round", "stroke-linejoin": "round" } as const;
