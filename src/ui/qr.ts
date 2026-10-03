// A small QR encoder, so the join code can be scanned with no network and no third-party script.
// Byte mode, error correction level M, the smallest version (1 to 9) that fits the text.
//
// A standard QR implementation: Reed-Solomon over GF(256), the fixed function patterns, then the
// eight masks scored by the penalty rules in the spec. Ported from the reference game, which took it
// from uwuPromptr. tests/unit/qr.test.ts checks it against an independent decoder.

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
}

const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!);

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] = next[j]! ^ poly[j]!;
      next[j + 1] = next[j + 1]! ^ gfMul(poly[j]!, GF_EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecCount: number): number[] {
  const generator = rsGeneratorPoly(ecCount);
  const result = new Array<number>(ecCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0]!;
    result.shift();
    result.push(0);
    for (let i = 0; i < ecCount; i++) result[i] = result[i]! ^ gfMul(generator[i + 1]!, factor);
  }
  return result;
}

interface VersionInfo {
  ec: number;
  groups: [number, number][];
}

// Per version, level M: error-correction codewords per block, and [block count, data codewords] groups.
// Versions 1 to 9: byte mode's character count is 8 bits up to version 9 and 16 from version 10.
const VERSIONS: Record<number, VersionInfo> = {
  1: { ec: 10, groups: [[1, 16]] },
  2: { ec: 16, groups: [[1, 28]] },
  3: { ec: 26, groups: [[1, 44]] },
  4: { ec: 18, groups: [[2, 32]] },
  5: { ec: 24, groups: [[2, 43]] },
  6: { ec: 16, groups: [[4, 27]] },
  7: { ec: 18, groups: [[4, 31]] },
  8: { ec: 22, groups: [[2, 38], [2, 39]] },
  9: { ec: 22, groups: [[3, 36], [2, 37]] },
};
const MAX_VERSION = 9;

const ALIGNMENT_CENTRES: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46],
};

// Format information for level M and each mask, already BCH-encoded and XOR-masked.
const FORMAT_BITS = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

// Version information, BCH(18,6): only versions 7 and up carry it. Those cells are reserved, so leaving it
// out does not just omit a decoration: data bits would land there and the symbol would stop decoding.
const VERSION_BITS: Record<number, number> = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99 };

const dataCodewordsOf = (info: VersionInfo): number => info.groups.reduce((sum, [count, size]) => sum + count * size, 0);

function chooseVersion(byteLength: number): number | null {
  for (let v = 1; v <= MAX_VERSION; v++) {
    // Mode indicator plus 8-bit character count: a byte and a half, so two whole codewords of overhead.
    if (dataCodewordsOf(VERSIONS[v]!) >= byteLength + 2) return v;
  }
  return null;
}

function buildBitStream(bytes: Uint8Array, version: number): number[] {
  const dataCodewords = dataCodewordsOf(VERSIONS[version]!);
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);

  const capacity = dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0); // terminator
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    codewords.push(byte);
  }
  const PADS = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < dataCodewords) codewords.push(PADS[padIndex++ % 2]!);
  return codewords;
}

function interleave(codewords: number[], version: number): number[] {
  const info = VERSIONS[version]!;
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  for (const [count, size] of info.groups) {
    for (let i = 0; i < count; i++) {
      const data = codewords.slice(offset, offset + size);
      offset += size;
      blocks.push({ data, ec: rsEncode(data, info.ec) });
    }
  }
  const result: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) for (const block of blocks) if (i < block.data.length) result.push(block.data[i]!);
  for (let i = 0; i < info.ec; i++) for (const block of blocks) result.push(block.ec[i]!);
  return result;
}

interface Matrix {
  modules: (number | null)[][];
  reserved: boolean[][];
  size: number;
}

function createMatrix(version: number): Matrix {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<number | null>(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setFixed = (row: number, col: number, value: number) => {
    modules[row]![col] = value;
    reserved[row]![col] = true;
  };

  const placeFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const onRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setFixed(row, col, onRing || inCore ? 1 : 0);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setFixed(6, i, i % 2 === 0 ? 1 : 0);
    setFixed(i, 6, i % 2 === 0 ? 1 : 0);
  }

  const centres = ALIGNMENT_CENTRES[version]!;
  for (const row of centres) {
    for (const col of centres) {
      const onFinder = (row <= 8 && col <= 8) || (row <= 8 && col >= size - 9) || (row >= size - 9 && col <= 8);
      if (onFinder) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) setFixed(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) === 1 ? 0 : 1);
    }
  }

  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      setFixed(size - 11 + col, row, 0);
      setFixed(row, size - 11 + col, 0);
    }
  }

  setFixed(size - 8, 8, 1); // the dark module
  const hold = (r: number, c: number) => {
    if (modules[r]![c] === null) {
      modules[r]![c] = 0;
      reserved[r]![c] = true;
    }
  };
  for (let i = 0; i < 9; i++) {
    hold(8, i);
    hold(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    hold(8, size - 1 - i);
    hold(size - 1 - i, 8);
  }
  return { modules, reserved, size };
}

function placeData(matrix: Matrix, codewords: number[]): void {
  const { modules, reserved, size } = matrix;
  const bits: number[] = [];
  for (const byte of codewords) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  let index = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5; // column 6 is the vertical timing pattern, not part of the zigzag
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (reserved[row]![col]) continue;
        modules[row]![col] = index < bits.length ? bits[index++]! : 0;
      }
    }
    upward = !upward;
  }
}

function maskBit(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function applyMask(matrix: Matrix, mask: number): number[][] {
  const { modules, reserved, size } = matrix;
  const out = modules.map((row) => row.map((v) => v ?? 0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r]![c]) continue;
      if (maskBit(mask, r, c)) out[r]![c] = out[r]![c]! ^ 1;
    }
  }
  return out;
}

function writeVersion(grid: number[][], size: number, version: number): void {
  if (version < 7) return;
  const bits = VERSION_BITS[version]!;
  for (let i = 0; i < 18; i++) {
    const bit = (bits >> i) & 1;
    const row = Math.floor(i / 3);
    const col = i % 3;
    grid[size - 11 + col]![row] = bit;
    grid[row]![size - 11 + col] = bit;
  }
}

function writeFormat(grid: number[][], size: number, mask: number): void {
  const bits = FORMAT_BITS[mask]!;
  // The format word goes in most significant bit first: index 0 is bit 14 of the word.
  const bit = (i: number) => (bits >> (14 - i)) & 1;
  for (let i = 0; i <= 5; i++) grid[8]![i] = bit(i);
  grid[8]![7] = bit(6);
  grid[8]![8] = bit(7);
  grid[7]![8] = bit(8);
  for (let i = 9; i <= 14; i++) grid[14 - i]![8] = bit(i);
  // Second copy: the top seven bits up the left of the lower-left finder (the dark module sits just above
  // them), and the low eight along the right of row 8. (The reference game put one bit too many in the
  // first run, which the dark module then overwrote; scanners read the first copy, so it still scanned.)
  for (let i = 0; i <= 6; i++) grid[size - 1 - i]![8] = bit(i);
  for (let i = 7; i <= 14; i++) grid[8]![size - 15 + i] = bit(i);
  grid[size - 8]![8] = 1;
}

function penalty(grid: number[][], size: number): number {
  let score = 0;
  const runScore = (line: number[]) => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) total += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) total += 3 + (run - 5);
    return total;
  };
  for (let r = 0; r < size; r++) score += runScore(grid[r]!);
  for (let c = 0; c < size; c++) score += runScore(grid.map((row) => row[c]!));

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r]![c];
      if (v === grid[r]![c + 1] && v === grid[r + 1]![c] && v === grid[r + 1]![c + 1]) score += 3;
    }
  }

  const PATTERN = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const REVERSED = [...PATTERN].reverse();
  const hasAt = (line: number[], start: number, pattern: number[]) => pattern.every((v, i) => line[start + i] === v);
  const patternScore = (line: number[]) => {
    let total = 0;
    for (let i = 0; i + PATTERN.length <= line.length; i++) if (hasAt(line, i, PATTERN) || hasAt(line, i, REVERSED)) total += 40;
    return total;
  };
  for (let r = 0; r < size; r++) score += patternScore(grid[r]!);
  for (let c = 0; c < size; c++) score += patternScore(grid.map((row) => row[c]!));

  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += grid[r]![c]!;
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

export interface QrCode {
  size: number;
  /** size × size, 1 for a dark module */
  modules: number[][];
}

/** The symbol for `text`, or null when it is too long for version 9 at level M (180 bytes). */
export function encodeQr(text: string): QrCode | null {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length);
  if (!version) return null;
  const codewords = interleave(buildBitStream(bytes, version), version);
  const matrix = createMatrix(version);
  placeData(matrix, codewords);
  let best: { score: number; grid: number[][] } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const grid = applyMask(matrix, mask);
    writeFormat(grid, matrix.size, mask);
    writeVersion(grid, matrix.size, version);
    const score = penalty(grid, matrix.size);
    if (!best || score < best.score) best = { score, grid };
  }
  return { size: matrix.size, modules: best!.grid };
}

/** One path for every dark module, so the SVG stays small. Empty when the text is too long. */
export function qrToSvg(text: string, { quiet = 4 }: { quiet?: number } = {}): string {
  const code = encodeQr(text);
  if (!code) return "";
  const span = code.size + quiet * 2;
  let path = "";
  for (let r = 0; r < code.size; r++) for (let c = 0; c < code.size; c++) if (code.modules[r]![c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return `<svg viewBox="0 0 ${span} ${span}" shape-rendering="crispEdges" role="img" aria-label="QR code to join this game"><rect class="qr-bg" width="${span}" height="${span}" rx="1"/><path class="qr-fg" d="${path}"/></svg>`;
}
