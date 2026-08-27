// Generates src/data/court-diagrams.ts — the static court diagrams rendered on
// /coach/fall-playbook.
//
// Run: node scripts/build-court-diagrams.mjs
//
// WHY A GENERATOR AND NOT HAND-WRITTEN SVG. Sixteen diagrams share one court
// geometry (a real 20×44ft court at 8px per foot, 7ft kitchens, correct service
// boxes). Hand-authoring each meant sixteen chances to put the kitchen line in
// a slightly different place. Here the geometry is written once and every
// diagram composes it, so a correction lands everywhere at once.
//
// WHAT IS *NOT* HERE: the ball-rules panel. It derives its serve count, kitchen
// state and lane from BALL_RULES, so it is rendered in the page component from
// the live data instead of frozen at generation time — a hardcoded serve count
// in a picture is drift with a delay on it, which is exactly what bit us when
// Sam changed the Red rule on 2026-08-27.
//
// Colours are CSS classes, never literals, so the print stylesheet can flip the
// courts to paper without touching the semantic hues (lime ball, cyan movement,
// teal team).

import { writeFileSync } from "node:fs";

const S = 8;
const CX0 = 40, CY0 = 44;
const CW = 20 * S, CH = 44 * S;          // 160 × 352
const CX1 = CX0 + CW, CY1 = CY0 + CH;    // 200, 396
const NET = CY0 + CH / 2;                // 220
const NVZ_F = NET - 7 * S, NVZ_N = NET + 7 * S;
const MID = CX0 + CW / 2;
const VB = "0 0 240 440";

const BALL = "#AADC00", MOVE = "#00D4FF", TEAL = "#00B4D8", LIME = "#AADC00";

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function court({ zones = [], halves = false } = {}) {
  const o = [`<rect x="${CX0}" y="${CY0}" width="${CW}" height="${CH}" class="c-surf" stroke-width="2"/>`];
  o.push(`<rect x="${CX0}" y="${NVZ_F}" width="${CW}" height="${7 * S}" class="c-kitch"/>`);
  o.push(`<rect x="${CX0}" y="${NET}" width="${CW}" height="${7 * S}" class="c-kitch"/>`);
  for (const [x, y, w, h, f, op] of zones) o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" opacity="${op}"/>`);
  o.push(`<line x1="${CX0}" y1="${NVZ_F}" x2="${CX1}" y2="${NVZ_F}" class="c-line" stroke-width="1.5"/>`);
  o.push(`<line x1="${CX0}" y1="${NVZ_N}" x2="${CX1}" y2="${NVZ_N}" class="c-line" stroke-width="1.5"/>`);
  o.push(`<line x1="${MID}" y1="${CY0}" x2="${MID}" y2="${NVZ_F}" class="c-line" stroke-width="1.5"/>`);
  o.push(`<line x1="${MID}" y1="${NVZ_N}" x2="${MID}" y2="${CY1}" class="c-line" stroke-width="1.5"/>`);
  if (halves) o.push(`<line x1="${MID}" y1="${CY0}" x2="${MID}" y2="${CY1}" class="c-line" stroke-width="1.5" stroke-dasharray="6 5" opacity=".85"/>`);
  o.push(`<line x1="${CX0 - 9}" y1="${NET}" x2="${CX1 + 9}" y2="${NET}" class="c-net" stroke-width="3"/>`);
  for (const px of [CX0 - 9, CX1 + 9]) o.push(`<circle cx="${px}" cy="${NET}" r="3" class="c-netfill"/>`);
  o.push(`<rect x="${CX0}" y="${NET - 4}" width="${CW}" height="8" class="c-netband"/>`);
  return o.join("");
}

function player(x, y, n, team = "a", r = 9.5) {
  if (team === "a") return `<circle cx="${x}" cy="${y}" r="${r}" fill="${TEAL}" stroke="#04121F" stroke-width="1.5"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#04121F">${esc(n)}</text>`;
  if (team === "b") return `<circle cx="${x}" cy="${y}" r="${r}" class="c-bg c-inkstroke" stroke-width="2"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="10.5" font-weight="700" class="c-inkfill">${esc(n)}</text>`;
  if (team === "ghost") return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${MOVE}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".85"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="10" font-weight="600" fill="${MOVE}" opacity=".9">${esc(n)}</text>`;
  return `<circle cx="${x}" cy="${y}" r="${r - 1}" fill="none" class="c-mutedstroke" stroke-width="1.8"/><text x="${x}" y="${y + 3.4}" text-anchor="middle" font-size="9.5" font-weight="600" class="c-mutedfill">${esc(n)}</text>`;
}

const captain = (x, y, label = "C") =>
  `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" rx="5" fill="${LIME}" stroke="#04121F" stroke-width="1.5"/><text x="${x}" y="${y + 3.8}" text-anchor="middle" font-size="10.5" font-weight="800" fill="#04121F">${esc(label)}</text>`;

function chip(x, y, t, kind) {
  const w = t.length * 5.3 + 10;
  return `<rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="15" rx="7" class="c-chip"/><text x="${x}" y="${y + 2.8}" text-anchor="middle" font-size="9.5" font-weight="700" class="c-${kind}fill">${esc(t)}</text>`;
}

function path(x1, y1, x2, y2, uid, { curve = 0, label, lx = 0, ly = 0, dash } = {}, kind = "ball") {
  const d = curve ? `M${x1},${y1} Q${(x1 + x2) / 2 + curve},${(y1 + y2) / 2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
  const cls = kind === "ball" ? "c-ball" : "c-move";
  const extra = kind === "ball" ? (dash ? ` stroke-dasharray="${dash}"` : "") : ` stroke-dasharray="6 4"`;
  const sw = kind === "ball" ? "2.2" : "2";
  const mk = kind === "ball" ? "b" : "m";
  const o = [`<path d="${d}" fill="none" class="${cls}" stroke-width="${sw}"${extra} marker-end="url(#${mk}${uid})"/>`];
  if (label) o.push(chip((x1 + x2) / 2 + lx, (y1 + y2) / 2 + ly, label, kind));
  return o.join("");
}
const ball = (x1, y1, x2, y2, uid, opts) => path(x1, y1, x2, y2, uid, opts, "ball");
const move = (x1, y1, x2, y2, uid, opts) => path(x1, y1, x2, y2, uid, opts, "move");

function note(x, y, t, { anchor = "middle", kind = "muted", size = 10 } = {}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="600" class="c-${kind}fill">${esc(t)}</text>`;
}
const zl = (x, y, t) => note(x, y, t, { size: 9.5 });

const FKL = [80, 156], FKR = [160, 156], NKL = [80, 284], NKR = [160, 284];
const FBL = [80, 60], FBR = [160, 60];

const FIGS = [];
const add = (id, title, claim, svg, aria, viewBox = VB) => FIGS.push({ id, title, claim, svg, aria, viewBox });

// ── legend ────────────────────────────────────────────────────────────────
{
  const l = [];
  l.push(`<path d="M16,24 L62,24" fill="none" class="c-ball" stroke-width="2.4" marker-end="url(#blg)"/>`);
  l.push(note(72, 28, "where the ball goes", { anchor: "start", kind: "ink", size: 11.5 }));
  l.push(`<path d="M16,58 L62,58" fill="none" class="c-move" stroke-width="2.2" stroke-dasharray="6 4" marker-end="url(#mlg)"/>`);
  l.push(note(72, 62, "where a body moves", { anchor: "start", kind: "ink", size: 11.5 }));
  l.push(player(28, 92, "1", "a") + note(72, 96, "one team", { anchor: "start", kind: "ink", size: 11.5 }));
  l.push(player(28, 126, "3", "b") + note(72, 130, "the other team", { anchor: "start", kind: "ink", size: 11.5 }));
  l.push(player(300, 92, "5", "out") + note(322, 96, "waiting to rotate in", { anchor: "start", kind: "ink", size: 11.5 }));
  l.push(captain(300, 126) + note(322, 130, "court captain — feeds, calls the clock", { anchor: "start", kind: "ink", size: 11.5 }));
  l.push(`<rect x="290" y="12" width="20" height="24" class="c-kitch c-linestroke" stroke-width="1.2"/>`);
  l.push(note(322, 28, "the kitchen (non-volley zone)", { anchor: "start", kind: "ink", size: 11.5 }));
  l.push(`<line x1="290" y1="56" x2="310" y2="56" class="c-net" stroke-width="3"/>`);
  l.push(note(322, 62, "the net", { anchor: "start", kind: "ink", size: 11.5 }));
  add("legend", "The key", "One encoding, used the same way in every diagram below.", l.join(""),
    "Diagram key: solid lime arrows are the ball, dashed cyan arrows are player movement, filled circles and outlined circles are the two teams, hollow circles are players waiting, and a lime square is the court captain.",
    "0 0 620 150");
}

// ── block 1 · K2K ─────────────────────────────────────────────────────────
add("k2k", "Block 1 · Kitchen to Kitchen",
  "All four at the kitchen line. The captain feeds, the pairs dink straight across, and partners swap at the halfway whistle.",
  [court(), captain(222, 220), ball(214, 214, 168, 162, "b1", { curve: -22, label: "feed", lx: 6, ly: -14 }),
   ball(...FKL, ...NKL, "b1", { label: "dink", lx: -2 }), ball(...FKR, ...NKR, "b1"),
   player(...FKL, "1", "a"), player(...FKR, "2", "a"), player(...NKL, "3", "b"), player(...NKR, "4", "b"),
   move(178, 300, 178, 336, "b1", { label: "swap at the halfway", lx: -52, ly: 26 }),
   zl(120, 36, "everyone toed up to the kitchen line — no serves")].join(""),
  "Pickleball court. Four players stand at the two kitchen lines, two per side. The court captain stands beside the net and feeds a ball in. Each pair rallies straight across the net. A dashed arrow shows partners swapping at the halfway point.");

// ── block 2 · Slinky ──────────────────────────────────────────────────────
{
  const L = 104;
  add("slinky", "Block 2 · Transition — the Slinky",
    "A pair starts dinking at the kitchen and steps back together on the captain's call, keeping the same soft contact all the way to the baseline.",
    [court(), player(L, 156, "1", "a"), player(L, 112, "1", "ghost"), player(L, 64, "1", "ghost"),
     player(L, 284, "3", "b"), player(L, 328, "3", "ghost"), player(L, 376, "3", "ghost"),
     move(72, 152, 72, 70, "b2", { label: "step back on the call" }), move(168, 288, 168, 370, "b2"),
     ball(L, 70, L, 370, "b2", { curve: 92, label: "same soft contact, longer runway", lx: 40 }),
     zl(120, 30, "start at the kitchen · step back · walk it back in")].join(""),
    "A pickleball court. One player on each side starts at the kitchen line, with faded outlines showing them stepping backwards toward the baseline in stages. A long curved lime arrow shows the ball staying soft over the whole distance.");
}

// ── block 3 · Drops and drives ────────────────────────────────────────────
add("drops", "Block 3 · Drops and drives",
  "Two work from the baseline against two holding the kitchen — and must choose a soft drop or a hard drive before they swing.",
  [court(), captain(222, 100), ball(214, 96, 170, 66, "b3", { curve: -14, label: "feed", lx: 8, ly: -12 }),
   player(...FBL, "1", "a"), player(...FBR, "2", "a"), player(...NKL, "3", "b"), player(...NKR, "4", "b"),
   ball(84, 70, 104, 300, "b3", { curve: -56, label: "drop — into the kitchen", lx: -14, ly: -40 }),
   ball(164, 70, 156, 272, "b3", { label: "drive — at their feet", lx: 52, ly: 10 }),
   zl(120, 414, "swap ends every two minutes")].join(""),
  "A pickleball court. Two players stand at the far baseline, two at the near kitchen line. Two lime arrows leave the baseline players: one arcs high into the near kitchen labelled drop, the other runs low and straight at the net players' feet labelled drive.");

// ── block 4 · Volleys ─────────────────────────────────────────────────────
add("volleys", "Block 4 · Volleys",
  "Pairs face off at the kitchen and volley without a bounce; everyone slides one spot right on the captain's call.",
  [court(), ball(...FKL, ...NKL, "b4", { label: "no bounce", lx: -4 }), ball(...FKR, ...NKR, "b4"),
   player(...FKL, "1", "a"), player(...FKR, "2", "a"), player(...NKL, "3", "b"), player(...NKR, "4", "b"),
   move(96, 306, 144, 306, "b4", { label: "slide right every 90s", ly: 24 }), move(144, 134, 96, 134, "b4"),
   zl(120, 36, "straight out of the air — paddle up, block, reset")].join(""),
  "A pickleball court with four players at the two kitchen lines volleying straight across without a bounce. Dashed arrows show each line sliding one position to the right on the captain's call.");

// ── block 5 · Kitchen play ────────────────────────────────────────────────
add("kitchen-play", "Block 5 · Kitchen play — the dink battle",
  "Cross-court dinks until someone pops one up above net height; that ball, and only that ball, gets attacked.",
  [court(), ball(88, 164, 152, 276, "b5", { label: "cross-court dink", lx: -30, ly: -16 }),
   ball(152, 276, 128, 200, "b5", { curve: 18, label: "pop-up", lx: 34, ly: 6 }),
   ball(128, 200, 96, 268, "b5", { dash: "5 4", label: "attack it", lx: -30, ly: 6 }),
   player(...FKL, "1", "a"), player(...FKR, "2", "a"), player(...NKL, "3", "b"), player(...NKR, "4", "b"),
   zl(120, 414, "winners slide right, losers slide left — nobody sits"),
   zl(120, 30, "above the net it's yours · below the net, reset it")].join(""),
  "A pickleball court with four players at the kitchen lines. A lime arrow shows a cross-court dink, a second shows the reply popping up too high, and a dashed lime arrow shows it being attacked downward.");

// ── block 6 · Serve and return ────────────────────────────────────────────
add("serve", "Block 6 · Serve and return",
  "Serve deep cross-court, return deep, then run to the kitchen line — the return is what buys you the front of the court.",
  [court(), player(158, 412, "1", "a"), player(82, 62, "3", "b"),
   // The two arcs bow apart into an open lens; sharing a lane read as one line.
   ball(152, 404, 96, 122, "b6", { curve: -62, label: "serve deep, cross-court", lx: -46, ly: 37 }),
   ball(90, 76, 156, 366, "b6", { curve: 62, label: "return deep", lx: 45, ly: -71 }),
   move(66, 80, 66, 150, "b6", { label: "then run to the line", lx: 2, ly: -2 }),
   player(80, 156, "3", "ghost"), zl(120, 432, "behind the baseline — drop it, don't toss it")].join(""),
  "A pickleball court. A server stands behind the near baseline on the right and serves diagonally into the far left service box. The returner sends it back deep along the opposite diagonal, then a dashed arrow shows them advancing from the baseline up to the kitchen line.");

// ── games ─────────────────────────────────────────────────────────────────
add("kitchen-game", "Game · Kitchen Game",
  "Real pickleball, started from the kitchen line: any player feeds, every rally is a point, first to eleven.",
  [court(), ball(...FKL, ...NKR, "g1", { curve: -24 }), ball(...FKR, ...NKL, "g1", { curve: 24 }),
   player(...FKL, "1", "a"), player(...FKR, "2", "a"), player(...NKL, "3", "b"), player(...NKR, "4", "b"),
   zl(120, 30, "2 v 2, everyone starts at the kitchen"),
   zl(120, 414, "rally scoring to 11, win by 2 — 7 for a short game")].join(""),
  "A pickleball court set up two versus two with all four players at the kitchen lines, rallying cross-court. Scoring is rally scoring to eleven, win by two.");

add("seven-eleven", "Game · 7-11",
  "One at the baseline against one at the kitchen — and the scoreboard is lopsided on purpose: the net player needs 7, the deep player only 11.",
  [court({ zones: [[40, 44, 160, 120, BALL, .05]] }), captain(222, 220),
   ball(214, 216, 132, 88, "g2", { curve: -34, label: "feed", lx: 18, ly: -6 }),
   player(120, 68, "1", "a"), player(120, 284, "3", "b"),
   ball(112, 82, 108, 300, "g2", { curve: -52, label: "drop, then move up", lx: -42, ly: -30 }),
   move(150, 96, 150, 262, "g2"), player(120, 156, "1", "ghost"),
   note(120, 36, "deep player — needs 11", { kind: "ink", size: 11 }),
   note(120, 420, "net player — needs 7", { kind: "ink", size: 11 }),
   zl(120, 434, "the harder job scores faster")].join(""),
  "A pickleball court set up one against one. The deep player at the far baseline must land a drop into the kitchen and advance to the line; the net player defends the kitchen line. The net player needs seven points to win, the deep player eleven.");

add("skinny", "Game · Skinny Singles",
  "Half the court is out. The narrow lane is what forces control over power — you cannot win this one by hitting harder.",
  [court({ zones: [[40, 44, 80, 352, BALL, .07]], halves: true }),
   player(80, 68, "1", "a"), player(80, 372, "3", "b"),
   ball(80, 82, 80, 358, "g3", { curve: 26, label: "in the lane only", lx: 30 }),
   note(80, 36, "live", { kind: "ball", size: 10.5 }), note(160, 36, "out", { size: 10.5 }),
   zl(120, 420, "switch lanes each game — cross-court is the forgiving one")].join(""),
  "A pickleball court with only the left half lengthwise shaded as live. Two players, one per side, rally within that narrow lane; the right half is marked out.");

add("king", "Game · King of the Court",
  "Winners hold the king's side; losers go to the back of the challenger line and the next pair steps straight on.",
  [court({ zones: [[40, 44, 160, 176, BALL, .06]] }),
   note(120, 34, "KING'S SIDE — hold it", { kind: "ball", size: 11 }),
   player(...FKL, "1", "a"), player(...FKR, "2", "a"), player(...NKL, "3", "b"), player(...NKR, "4", "b"),
   ball(...FKR, ...NKL, "g4", { curve: 22 }),
   player(224, 316, "5", "out"), player(224, 344, "6", "out"), player(224, 372, "7", "out"),
   note(224, 296, "next up", { size: 9.5 }), move(190, 300, 214, 316, "g4"),
   move(214, 388, 150, 400, "g4", { label: "losers to the back", lx: 6, ly: 20 }),
   zl(120, 434, "short games to 3–5 — rotation is the point, not the score")].join(""),
  "A pickleball court with the far side shaded as the king's side. Two players hold it, two challenge from the near side, and three more wait in a line beside the court. Dashed arrows show losers rotating to the back of the line.");

add("squirrel", "Game · Squirrel",
  "Continuous play, no score: whoever ends the rally rotates out, the next in line steps straight on, and the captain feeds again immediately.",
  [court(), captain(222, 220), ball(214, 214, 168, 172, "g5", { curve: -20, label: "feed, fast", lx: 10, ly: -14 }),
   player(...FKL, "1", "a"), player(...FKR, "2", "a"), player(...NKL, "3", "b"), player(...NKR, "4", "b"),
   ball(...FKL, ...NKL, "g5"),
   player(20, 300, "5", "out"), player(20, 328, "6", "out"), player(20, 356, "7", "out"),
   note(20, 280, "in line", { size: 9.5 }),
   move(66, 296, 34, 296, "g5", { label: "squirrel out", lx: -4, ly: -14 }),
   move(20, 376, 66, 396, "g5", { label: "next in", lx: 26, ly: 16 }),
   zl(120, 30, "whoever ended the rally is the Squirrel")].join(""),
  "A pickleball court with four players in play and three more waiting in a line beside the court. The court captain feeds every rally. Dashed arrows show the player who ended the rally rotating out and the next in line rotating on.");

add("jailbreak", "Game · Jailbreak",
  "Miss your ball and you go to jail; catch a live one out of the air and you are out — and the hitter takes your place.",
  [court({ zones: [[40, 44, 160, 120, "#FF6B2B", .10]] }),
   note(120, 34, "JAIL", { kind: "ball", size: 12 }),
   player(70, 76, "5", "out"), player(100, 76, "6", "out"), captain(222, 300),
   player(120, 396, "1", "a"), player(120, 424, "2", "b"), player(150, 424, "3", "b"),
   note(120, 440, "one at a time, off the captain's feed", { size: 9.5 }),
   ball(214, 296, 134, 384, "g6", { curve: 26, label: "feed", lx: 26, ly: 14 }),
   ball(126, 384, 150, 120, "g6", { curve: -36, label: "miss it and you're in jail", lx: 52, ly: 30 }),
   move(88, 92, 120, 200, "g6", { label: "catch one in the air to escape", lx: 54, ly: -16 })].join(""),
  "A pickleball court with the far end shaded as jail, holding two players. The rest queue at the near baseline and hit one fed ball each. A missed ball sends the hitter to jail; a jailed player who catches a live ball in the air escapes.");

// ── two courts, one coach ─────────────────────────────────────────────────
function mini(ox, oy, m = 4, kitchenOn = true) {
  const w = 20 * m, h = 44 * m, net = oy + h / 2, kf = net - 7 * m;
  const o = [`<rect x="${ox}" y="${oy}" width="${w}" height="${h}" class="c-surf" stroke-width="1.6"/>`];
  if (kitchenOn) o.push(`<rect x="${ox}" y="${kf}" width="${w}" height="${14 * m}" class="c-kitch"/>`);
  o.push(`<line x1="${ox - 5}" y1="${net}" x2="${ox + w + 5}" y2="${net}" class="c-net" stroke-width="2.4"/>`);
  return { svg: o.join(""), net, w };
}
{
  const i = [`<rect x="14" y="26" width="480" height="250" rx="10" fill="none" class="c-line" stroke-width="1.6" stroke-dasharray="8 6"/>`,
             note(254, 18, "ONE RESERVED TENNIS COURT", { size: 10 })];
  [66, 350].forEach((ox, n) => {
    const { svg, net, w } = mini(ox, 56, 4.6, true);
    i.push(svg, note(ox + w / 2, 46, `COURT ${n + 1}`, { kind: "ink", size: 11 }));
    for (const [px, py] of [[ox + 22, net - 40], [ox + w - 22, net - 40], [ox + 22, net + 40], [ox + w - 22, net + 40]])
      i.push(player(px, py, "", py < net ? "a" : "b", 8));
    const capx = n === 0 ? ox - 32 : ox + w + 32;   // captains outside; the middle gap is the coach's
    i.push(captain(capx, net), `<text x="${capx}" y="${net + 30}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${LIME}">captain</text>`);
  });
  i.push(`<circle cx="254" cy="166" r="15" fill="none" class="c-ball" stroke-width="2.4"/>`,
         `<text x="254" y="170.5" text-anchor="middle" font-size="11" font-weight="800" class="c-ballfill">S</text>`,
         `<text x="254" y="197" text-anchor="middle" font-size="10.5" font-weight="600" fill="${BALL}">Coach — floats</text>`,
         move(232, 158, 176, 150, "cc"), move(276, 158, 336, 150, "cc"),
         note(254, 300, "8 kids · 2 courts · 1 captain each — the captains hold the clock so the coach never has to", { size: 11 }));
  add("two-courts", "Two courts, one coach",
    "The whole reason for the captain role: with a captain holding each court's clock and rotation, the coach is free to move between them giving feedback by name.",
    i.join(""),
    "Two pickleball courts side by side inside one reserved tennis court. Each has four players and a court captain standing beside it. The coach sits between the two courts with dashed arrows showing them moving to each in turn.",
    "0 0 620 320");
}

// ── the 90-minute arc ─────────────────────────────────────────────────────
{
  const PHASES = [["Arrival rally", 7, "#00B4D8"], ["Huddle", 3, "#0E7490"], ["Skill Stack ×6", 36, BALL],
                  ["Pickup + water", 4, "#3E4E7A"], ["Modified games", 14, "#7FA800"], ["Round robin", 18, "#00B4D8"],
                  ["Ritual", 5, "#FF6B2B"], ["Cleanup", 3, "#5C6C9E"]];
  const i = []; const X0 = 26, W = 566; let t = 0;
  for (const [name, mins, hue] of PHASES) {
    const x = X0 + (t / 90) * W, w = (mins / 90) * W;
    i.push(`<rect x="${x.toFixed(1)}" y="60" width="${(w - 1.5).toFixed(1)}" height="42" rx="4" fill="${hue}" opacity=".9"/>`);
    if (mins >= 7) i.push(`<text x="${(x + w / 2).toFixed(1)}" y="86" text-anchor="middle" font-size="10.5" font-weight="700" fill="#04121F">${mins}m</text>`);
    const lx = (x + w / 2).toFixed(1);
    i.push(`<text x="${lx}" y="120" text-anchor="middle" font-size="9.5" font-weight="600" class="c-inkfill" transform="rotate(-32 ${lx} 120)">${esc(name)}</text>`);
    t += mins;
  }
  i.push(`<line x1="${X0}" y1="50" x2="${X0 + W}" y2="50" class="c-line" stroke-width="1"/>`);
  for (const [lab, mins] of [["1:00", 0], ["1:30", 30], ["2:00", 60], ["2:30", 90]]) {
    const x = (X0 + (mins / 90) * W).toFixed(1);
    i.push(`<line x1="${x}" y1="44" x2="${x}" y2="52" class="c-line" stroke-width="1"/>`,
           `<text x="${x}" y="38" text-anchor="middle" font-size="10" font-family="monospace" class="c-mutedfill">${lab}</text>`);
  }
  i.push(note(X0, 174, "Green Ball 1:00–2:30 PM · Yellow Ball 2:30–4:00 PM — same shape, both blocks", { anchor: "start", size: 11 }),
         `<text x="${X0}" y="192" text-anchor="start" font-size="11" font-weight="600" fill="${BALL}">Ritual starts with 5 minutes left. Cut the ritual, never the cleanup.</text>`);
  add("arc", "Ninety minutes, every Sunday",
    "The same order every week, so a kid who has been twice stops needing to be told what happens next.",
    i.join(""),
    "A horizontal timeline of a ninety minute session: seven minutes arrival rally, three minute huddle, thirty-six minutes of Skill Stack, four minutes pickup and water, fourteen minutes of modified games, eighteen minutes round robin, a five minute closing ritual and three minutes cleanup.",
    "0 0 620 210");
}

// ── emit ──────────────────────────────────────────────────────────────────
// Each figure carries only the arrowhead markers it actually references: a
// marker defined in a sibling fragment resolves in a browser but breaks the
// moment a figure is lifted out on its own.
function defsFor(svg) {
  const ids = [...new Set([...svg.matchAll(/url\(#([A-Za-z0-9_-]+)\)/g)].map((m) => m[1]))].sort();
  if (!ids.length) return "";
  return "<defs>" + ids.map((id) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" class="${id.startsWith("b") ? "c-ballfill" : "c-movefill"}"/></marker>`).join("") + "</defs>";
}

const header = `// GENERATED FILE — do not edit by hand.
// Run \`node scripts/build-court-diagrams.mjs\` to regenerate.
//
// Static court diagrams for /coach/fall-playbook. Courts are drawn to a real
// 20x44ft pickleball court at 8px per foot with 7ft kitchens, so a kid
// recognises the shape and a captain can pace it out.
//
// Every colour is a CSS class (c-surf, c-ball, c-move, ...) rather than a
// literal, so the page's print stylesheet can flip the courts to paper.
// The ball-rules panel is deliberately NOT here: it derives from BALL_RULES at
// render time so a rule change can never leave a stale number in a picture.

export interface CourtDiagram {
  id: string;
  title: string;
  /** One sentence stating what the picture shows — rendered as the caption. */
  claim: string;
  /** Same claim, for readers who cannot see the drawing. */
  aria: string;
  viewBox: string;
  /** Inner SVG markup. Build-time constant, generated, never user input. */
  svg: string;
}

export const COURT_DIAGRAMS: readonly CourtDiagram[] = ${JSON.stringify(
  FIGS.map((f) => ({ ...f, svg: defsFor(f.svg) + f.svg })), null, 2)} as const;

export function findDiagram(id: string): CourtDiagram | undefined {
  return COURT_DIAGRAMS.find((d) => d.id === id);
}
`;

writeFileSync(new URL("../src/data/court-diagrams.ts", import.meta.url), header);
console.log(`wrote src/data/court-diagrams.ts — ${FIGS.length} diagrams`);
