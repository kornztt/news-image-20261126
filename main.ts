// THE WORLD TODAY — Thursday 26 November 2026.
// A 1024x1024 newspaper front page drawn from scratch with Node 22 stdlib only.
// Every part below (PNG encoder, canvas, 5x7 bitmap font, layout) is written
// fresh for this entry. It reads nothing, uses no network, and writes the
// same bytes on every run.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [246, 241, 229];
const INK: RGB = [17, 20, 24];
const RED: RGB = [179, 39, 30];
const NAVY: RGB = [29, 47, 77];
const SKY_TOP: RGB = [46, 61, 85];
const SKY_MID: RGB = [90, 107, 132];
const SKY_LOW: RGB = [159, 178, 200];
const CLOUD_D: RGB = [35, 47, 66];
const CLOUD_L: RGB = [90, 107, 132];
const RAIN: RGB = [199, 211, 224];
const CITY: RGB = [20, 26, 36];
const WIN: RGB = [232, 201, 106];
const BALLOON: RGB = [192, 57, 43];
const BALLOON_D: RGB = [140, 32, 24];
const WHITE: RGB = [250, 248, 242];
const GREY: RGB = [120, 116, 104];
const ORANGE: RGB = [224, 122, 31];
const GOLD: RGB = [212, 160, 44];

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function hline(x0: number, x1: number, y: number, c: RGB): void {
  if (y < 0 || y >= H) return;
  const a = Math.max(0, Math.min(x0, x1));
  const b = Math.min(W - 1, Math.max(x0, x1));
  for (let x = a; x <= b; x++) setPx(x, y, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  for (let k = 0; k < t; k++) line(x0, y0 + k, x1, y1 + k, c);
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
    const ny = (yy - cy) / ry;
    if (Math.abs(ny) > 1) continue;
    const hw = Math.floor(rx * Math.sqrt(1 - ny * ny));
    hline(cx - hw, cx + hw, yy, c);
  }
}

function ring(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const r = (a * Math.PI) / 180;
    setPx(Math.round(cx + rx * Math.cos(r)), Math.round(cy + ry * Math.sin(r)), c);
  }
}

function poly(points: [number, number][], c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      hline(Math.ceil(xs[k]), Math.floor(xs[k + 1]), y, c);
    }
  }
}

// deterministic scatter: fixed hash of an index, no randomness
function det(i: number, m: number): number {
  let v = (i * 2654435761) >>> 0;
  v ^= v >>> 13;
  v = (v * 1274126177) >>> 0;
  return v % m;
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph is 7 rows of 5 cells, "#" = ink. Hand-drawn letterforms.
const GLYPHS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "#####"],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", ".#..#", "#...#"],
  "&": [".##..", "#..#.", "#..#.", ".#...", "#.#.#", "#..#.", ".##.#"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
};

function normChar(ch: string): string {
  if (ch === "’" || ch === "‘") return "'";
  if (ch === "—" || ch === "–") return "-";
  if (ch === "•") return ".";
  return ch.toUpperCase();
}

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB): void {
  const s = [...text].map(normChar).join("");
  for (let i = 0; i < s.length; i++) {
    const g = GLYPHS[s[i]] ?? GLYPHS[" "];
    const ox = x + i * 6 * scale;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "#") fillRect(ox + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

function drawTextCentred(text: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(text, Math.round(cx - textWidth(text, scale) / 2), y, scale, c);
}

function drawTextRight(text: string, right: number, y: number, scale: number, c: RGB): void {
  drawText(text, right - textWidth(text, scale), y, scale, c);
}

function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- page
fillRect(0, 0, W, H, PAPER);
// thin double frame
fillRect(16, 16, W - 32, 2, INK);
fillRect(16, H - 18, W - 32, 2, INK);
fillRect(16, 16, 2, H - 32, INK);
fillRect(W - 18, 16, 2, H - 32, INK);

// dateline bar
drawText("THURSDAY 26 NOVEMBER 2026", 36, 30, 2, INK);
drawTextRight("WORLD EDITION", 988, 30, 2, INK);
fillRect(36, 56, 952, 3, INK);
fillRect(36, 62, 952, 1, INK);

// masthead
drawTextCentred("THE WORLD TODAY", W / 2, 74, 10, INK);
drawTextCentred("THE DAY'S NEWS FROM EVERY CONTINENT", W / 2, 152, 2, GREY);
fillRect(36, 172, 952, 4, INK);

// headline — concrete facts, no vague words
drawText("MACY'S 100TH PARADE", 36, 188, 6, INK);
drawText("MOVED TO SATURDAY", 36, 236, 6, INK);
drawText("FIRST WEATHER POSTPONEMENT IN 100 YEARS AS A NOREASTER", 36, 290, 2, INK);
drawText("BRINGS 60 MPH GUSTS AND FLOODING TO NEW YORK", 36, 310, 2, INK);

// ---------------------------------------------------------------- main picture
const IX = 36;
const IY = 334;
const IW = 952;
const IH = 262;
const IB = IY + IH; // bottom edge 596
// sky bands
const bands: RGB[] = [SKY_TOP, SKY_TOP, SKY_MID, SKY_MID, SKY_LOW, SKY_LOW];
for (let b = 0; b < 6; b++) {
  fillRect(IX, IY + Math.floor((b * IH) / 6), IW, Math.ceil(IH / 6) + 1, bands[b]);
}
// storm clouds, all inside the picture
ellipse(IX + 170, IY + 36, 150, 34, CLOUD_D);
ellipse(IX + 480, IY + 28, 180, 38, CLOUD_D);
ellipse(IX + 800, IY + 40, 150, 36, CLOUD_D);
ellipse(IX + 320, IY + 58, 130, 24, CLOUD_L);
ellipse(IX + 660, IY + 62, 140, 24, CLOUD_L);
ellipse(IX + 70, IY + 60, 60, 18, CLOUD_L);
ellipse(IX + IW - 70, IY + 64, 60, 18, CLOUD_L);
// rain, clipped by the picture frame
for (let i = 0; i < 46; i++) {
  const rx = IX + 20 + det(i, IW - 60);
  const ry = IY + 78 + det(i + 100, 90);
  line(rx, ry, rx - 8, ry + 20, RAIN);
}
// city skyline silhouette along the bottom of the picture
const skyline: [number, number, number][] = [
  // x offset, width, height
  [0, 70, 66], [74, 54, 96], [132, 80, 58], [216, 46, 110], [266, 90, 74],
  [360, 60, 120], [424, 74, 66], [502, 52, 100], [558, 88, 62], [650, 58, 112],
  [712, 80, 70], [796, 56, 104], [856, 96, 60],
];
for (const [ox, bw, bh] of skyline) {
  fillRect(IX + ox, IB - 42 - bh, bw, bh, CITY);
}
// lit windows, deterministic
let wi = 0;
for (const [ox, bw, bh] of skyline) {
  for (let wy = IB - 42 - bh + 8; wy < IB - 52; wy += 14) {
    for (let wx = IX + ox + 8; wx < IX + ox + bw - 8; wx += 14) {
      if (det(wi, 3) === 0) fillRect(wx, wy, 5, 6, WIN);
      wi++;
    }
  }
}
// ground strip
fillRect(IX, IB - 42, IW, 42, [28, 34, 44]);
// the grounded balloon: a big deflated parade balloon lying on the street,
// just above the banner strip. A sagging red ellipse with a darker rim,
// ropes drooping to the pavement.
ellipse(IX + 250, IB - 72, 118, 30, BALLOON_D);
ellipse(IX + 250, IB - 76, 112, 26, BALLOON);
ellipse(IX + 215, IB - 84, 34, 9, [214, 96, 80]);
ring(IX + 250, IB - 76, 112, 26, BALLOON_D);
// ropes drooping from the balloon to the pavement
line(IX + 170, IB - 62, IX + 150, IB - 44, [220, 214, 196]);
line(IX + 250, IB - 52, IX + 250, IB - 44, [220, 214, 196]);
line(IX + 330, IB - 62, IX + 352, IB - 44, [220, 214, 196]);
// a second, smaller spent balloon further down the street
ellipse(IX + 700, IB - 58, 52, 14, [90, 107, 132]);
ellipse(IX + 700, IB - 60, 48, 12, [130, 148, 172]);
line(IX + 700, IB - 48, IX + 716, IB - 44, [220, 214, 196]);
// banner strip across the bottom of the picture, naming the metaphor
fillRect(IX, IB - 42, IW, 42, NAVY);
drawTextCentred("BALLOONS GROUNDED - STORM WINS ON PARADE DAY", IX + IW / 2, IB - 32, 2, WHITE);
// picture frame
for (let t = 0; t < 3; t++) {
  hline(IX, IX + IW - 1, IY + t, INK);
  hline(IX, IX + IW - 1, IB - 1 - t, INK);
}
for (let t = 0; t < 3; t++) {
  fillRect(IX + t, IY, 1, IH, INK);
  fillRect(IX + IW - 1 - t, IY, 1, IH, INK);
}

// caption under the picture
drawText("A DEFLATED PARADE BALLOON ON THE GROUND AS THE NOREASTER SWEEPS IN.", 36, 608, 2, GREY);
fillRect(36, 632, 952, 2, INK);

// ---------------------------------------------------------------- three columns
const COL_Y = 648;
const COL_W = 304;
const COL_X = [36, 360, 684];

function column(x: number, kicker: string, body: string, icon: (bx: number, by: number) => void): void {
  // icon box
  fillRect(x, COL_Y, COL_W, 44, [232, 226, 210]);
  icon(x, COL_Y);
  // heading
  drawText(kicker, x, COL_Y + 56, 3, INK);
  fillRect(x, COL_Y + 84, 64, 4, RED);
  // body, wrapped
  const lines = wrapWords(body, 25);
  lines.forEach((ln, i) => drawText(ln, x, COL_Y + 100 + i * 18, 2, INK));
}

// tariffs: rising bars + arrow
column(COL_X[0], "TARIFF SALVO",
  "TRUMP PROPOSES NEW DUTIES ON 14 PARTNERS. CHINA CAPPED AT 20%, UP TO 40% IF THE TRUCE ENDS. HEARING JAN 25.",
  (bx, by) => {
    fillRect(bx + 18, by + 28, 16, 10, NAVY);
    fillRect(bx + 40, by + 20, 16, 18, NAVY);
    fillRect(bx + 62, by + 10, 16, 28, RED);
    line(bx + 14, by + 30, bx + 84, by + 6, RED);
    line(bx + 84, by + 6, bx + 72, by + 6, RED);
    line(bx + 84, by + 6, bx + 84, by + 16, RED);
    drawText("TARIFFS", bx + 104, by + 14, 2, INK);
  });

// Cairo fire: flame in a box
column(COL_X[1], "CAIRO FIRE",
  "AT LEAST 31 KILLED, 21 HURT AS A FUEL TANKER BURSTS INTO FLAMES ON CAIRO'S RING ROAD. 27 VEHICLES BURNED.",
  (bx, by) => {
    poly(
      [
        [bx + 34, by + 4], [bx + 46, by + 16], [bx + 52, by + 12], [bx + 56, by + 24],
        [bx + 50, by + 38], [bx + 22, by + 38], [bx + 16, by + 24], [bx + 24, by + 18],
      ],
      ORANGE,
    );
    poly(
      [
        [bx + 34, by + 20], [bx + 40, by + 26], [bx + 42, by + 32],
        [bx + 28, by + 32], [bx + 28, by + 26],
      ],
      GOLD,
    );
    drawText("CAIRO", bx + 70, by + 14, 2, INK);
  });

// Gulf: oil derrick + tanker on waves
column(COL_X[2], "GULF WAR SPREADS",
  "HOUTHIS SAY THEY HIT THE RAS TANURA REFINERY. IRAN SAYS TANKERS HIT MINES IN HORMUZ. COALITION STRIKES HODEIDAH.",
  (bx, by) => {
    thickLine(bx + 20, by + 38, bx + 34, by + 6, 2, INK);
    thickLine(bx + 48, by + 38, bx + 34, by + 6, 2, INK);
    thickLine(bx + 24, by + 28, bx + 44, by + 28, 2, INK);
    thickLine(bx + 28, by + 18, bx + 40, by + 18, 2, INK);
    fillRect(bx + 62, by + 26, 44, 10, NAVY);
    fillRect(bx + 70, by + 18, 10, 8, NAVY);
    thickLine(bx + 62, by + 40, bx + 74, by + 36, 2, NAVY);
    thickLine(bx + 78, by + 40, bx + 90, by + 36, 2, NAVY);
    thickLine(bx + 94, by + 40, bx + 106, by + 36, 2, NAVY);
    drawText("GULF", bx + 118, by + 14, 2, INK);
  });

// vertical rules between columns
fillRect(348, COL_Y, 2, 200, GREY);
fillRect(672, COL_Y, 2, 200, GREY);

// ---------------------------------------------------------------- ticker
fillRect(36, 884, 952, 76, NAVY);
drawText("IOWA: ARMY DETONATES 5 TONS OF LEAD AZIDE - EPA FINDS NO LEAD IN THE AIR", 52, 898, 2, WHITE);
drawText("SENATE QUESTIONS NVIDIA OVER HUANG RETURN - CHINA URGES DUTCH FAIR RULES", 52, 924, 2, WHITE);

// footer
drawTextCentred("THE WORLD TODAY - THURSDAY 26 NOVEMBER 2026", W / 2, 976, 2, INK);

// ---------------------------------------------------------------- write out
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/entry.png`, encodePng(W, H, px));
