/**
 * Minimal local QR encoder: byte mode, error correction M, versions 1–10.
 * No dependencies and no network, so TOTP secrets never leave the app.
 */

// version -> [ecPerBlock, [[blockCount, dataCodewords], ...]]
const M_TABLE: Record<number, [number, [number, number][]]> = {
  1: [10, [[1, 16]]],
  2: [16, [[1, 28]]],
  3: [26, [[1, 44]]],
  4: [18, [[2, 32]]],
  5: [24, [[2, 43]]],
  6: [16, [[4, 27]]],
  7: [18, [[4, 31]]],
  8: [22, [[2, 38], [2, 39]]],
  9: [22, [[3, 36], [2, 37]]],
  10: [26, [[4, 43], [1, 44]]],
};
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

function dataCapacity(v: number): number {
  return M_TABLE[v][1].reduce((s, [n, d]) => s + n * d, 0);
}

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 255;
}

function rsRemainder(data: number[], degree: number): number[] {
  const divisor = new Array<number>(degree).fill(0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = gfMul(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = gfMul(root, 2);
  }
  const result = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < degree; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

function buildCodewords(bytes: number[], version: number): number[] {
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  const cap = dataCapacity(version);
  push(0b0100, 4);
  push(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  }
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);

  const [ecLen, groups] = M_TABLE[version];
  const dataBlocks: number[][] = [];
  let pos = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      dataBlocks.push(data.slice(pos, pos + size));
      pos += size;
    }
  }
  const ecBlocks = dataBlocks.map((b) => rsRemainder(b, ecLen));
  const out: number[] = [];
  const maxLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < ecLen; i++) for (const b of ecBlocks) out.push(b[i]);
  return out;
}

function bch(value: number, poly: number, polyBits: number, shift: number) {
  let rem = value;
  for (let i = 0; i < shift; i++) rem = (rem << 1) ^ ((rem >>> (polyBits - 1)) * poly);
  return rem;
}

function maskFn(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
    default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
  }
}

function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  for (let pass = 0; pass < 2; pass++) {
    const get = (a: number, b: number) => (pass ? m[b][a] : m[a][b]);
    for (let a = 0; a < n; a++) {
      let run = 1;
      let hist = "";
      for (let b = 0; b < n; b++) {
        hist += get(a, b) ? "1" : "0";
        if (b > 0 && get(a, b) === get(a, b - 1)) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score++;
        } else run = 1;
      }
      const padded = `0000${hist}0000`;
      for (const p of ["10111010000", "00001011101"]) {
        let at = padded.indexOf(p);
        while (at >= 0) {
          score += 40;
          at = padded.indexOf(p, at + 1);
        }
      }
    }
  }
  let dark = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (x < n - 1 && y < n - 1) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
      }
    }
  }
  score += 10 * Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5);
  return score;
}

/** Returns the QR module matrix (true = dark). Throws if text is too long. */
export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const headBits = 4 + (v >= 10 ? 16 : 8);
    if (headBits + bytes.length * 8 <= dataCapacity(v) * 8) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error("Text too long for QR code.");

  const size = 17 + 4 * version;
  const m: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    m[y][x] = dark;
    fn[y][x] = true;
  };

  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const al = ALIGN[version];
  for (let i = 0; i < al.length; i++) {
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  const drawFormat = (mask: number) => {
    const data = mask; // ECC M = 00
    const bits = ((data << 10) | bch(data, 0x537, 10, 10)) ^ 0x5412;
    const b = (i: number) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, b(i));
    set(8, 7, b(6));
    set(8, 8, b(7));
    set(7, 8, b(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    const bits = (version << 12) | bch(version, 0x1f25, 12, 12);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  const codewords = buildCodewords(bytes, version);
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && bitIdx < codewords.length * 8) {
          m[y][x] = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
          bitIdx++;
        }
      }
    }
  }

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  let bestMask = 0;
  for (let mask = 0; mask < 8; mask++) {
    const cand = m.map((row, y) => row.map((v, x) => (!fn[y][x] && maskFn(mask, x, y) ? !v : v)));
    const s = penalty(cand);
    if (s < bestScore) {
      bestScore = s;
      best = cand;
      bestMask = mask;
    }
  }
  const result = best as boolean[][];
  // Re-draw format bits onto the chosen matrix.
  const final = result;
  const save = { m, fn };
  void save;
  const bits = ((bestMask << 10) | bch(bestMask, 0x537, 10, 10)) ^ 0x5412;
  const put = (x: number, y: number, i: number) => {
    final[y][x] = ((bits >>> i) & 1) !== 0;
  };
  for (let i = 0; i <= 5; i++) put(8, i, i);
  put(8, 7, 6);
  put(8, 8, 7);
  put(7, 8, 8);
  for (let i = 9; i < 15; i++) put(14 - i, 8, i);
  for (let i = 0; i < 8; i++) put(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i++) put(8, size - 15 + i, i);
  final[size - 8][8] = true;
  return final;
}

/** SVG path data (one square per dark module) with a 4-module quiet zone. */
export function qrPath(text: string): { size: number; d: string } {
  const matrix = encodeQr(text);
  const quiet = 4;
  let d = "";
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }),
  );
  return { size: matrix.length + quiet * 2, d };
}
