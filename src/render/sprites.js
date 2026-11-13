// Procedural pixel-art renderer. Draws original 40×40 monster sprites from species
// data (body archetype + palette + features), plus trainer/NPC sprites.
// Everything is cached and rendered onto offscreen canvases.

import { getMonster } from '../data/monsters.js'
import { ELEMENTS } from '../data/elements.js'
import { hashString } from '../core/utils.js'

const PALETTES = {
  none:   { dark: '#403a32', base: '#a89b86', light: '#ded2bd', accent: '#f2e6cf', eye: '#191510', white: '#fffdf4' },
  nature: { dark: '#1f4429', base: '#4f9350', light: '#93d76e', accent: '#ffd86e', eye: '#112315', white: '#f4fad9' },
  flame:  { dark: '#4d1714', base: '#c84b2c', light: '#ff9a4d', accent: '#ffe08a', eye: '#290b08', white: '#fff1d4' },
  frost:  { dark: '#1d4354', base: '#64b3cf', light: '#c9f0fb', accent: '#eafcff', eye: '#0c1f29', white: '#f7feff' },
  earth:  { dark: '#4a3320', base: '#ad8147', light: '#e6c47f', accent: '#ffe9a8', eye: '#24180b', white: '#fff5da' },
  shadow: { dark: '#24152f', base: '#694691', light: '#b58bdb', accent: '#ff7bd5', eye: '#100817', white: '#f0dcff' },
  light:  { dark: '#6d4c13', base: '#ddb73f', light: '#fff09d', accent: '#fff8cf', eye: '#352704', white: '#fffdf0' },
  storm:  { dark: '#202c55', base: '#526dc4', light: '#aec6ff', accent: '#e8f2ff', eye: '#10152e', white: '#f3f7ff' },
  dragon: { dark: '#4c1a23', base: '#bf505b', light: '#f29aa0', accent: '#ffd36e', eye: '#24090f', white: '#ffe4e6' },
}

// ── color helpers ───────────────────────────────────────────────────────────
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}

function tint(hex, hue = 0, sat = 0, light = 0) {
  const [h, s, l] = hexToHsl(hex)
  return `hsl(${(h + hue + 360) % 360} ${Math.max(0, Math.min(100, s + sat))}% ${Math.max(4, Math.min(96, l + light))}%)`
}

function paletteFor(species) {
  const p = { ...(PALETTES[species.element] || PALETTES.none) }
  const h = hashString(species.id)
  const shift = (h % 29) - 14
  p.base = tint(p.base, shift, 0, 0)
  p.light = tint(p.light, shift, 0, 1)
  p.dark = tint(p.dark, shift, 0, 0)
  if (species.look?.accent) p.accent = species.look.accent
  return p
}

// ── pixel primitives ────────────────────────────────────────────────────────
function rect(c, x, y, w, h, color) {
  c.fillStyle = color
  c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
}
function px(c, x, y, color) { rect(c, x, y, 1, 1, color) }

function ellipse(c, cx, cy, rx, ry, color) {
  c.fillStyle = color
  for (let y = -Math.round(ry); y <= Math.round(ry); y++) {
    const k = 1 - (y * y) / (ry * ry)
    if (k < 0) continue
    const span = Math.max(0, Math.floor(rx * Math.sqrt(k)))
    c.fillRect(Math.round(cx - span), Math.round(cy + y), span * 2 + 1, 1)
  }
}

function outlinedEllipse(c, cx, cy, rx, ry, fill, outline, outlineW = 1.2) {
  ellipse(c, cx, cy, rx + outlineW, ry + outlineW, outline)
  ellipse(c, cx, cy, rx, ry, fill)
}

function tri(c, x1, y1, x2, y2, x3, y3, color) {
  // Integer scanline triangle.
  const minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3)
  for (let y = minY; y <= maxY; y++) {
    const edges = []
    const pts = [[x1, y1], [x2, y2], [x3, y3]]
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 3]
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        edges.push(ax + (y - ay) * (bx - ax) / (by - ay))
      }
    }
    if (edges.length >= 2) {
      const xa = Math.min(...edges), xb = Math.max(...edges)
      rect(c, xa, y, Math.max(1, xb - xa + 1), 1, color)
    }
  }
}

function outlinedTri(c, pts, fill, outline) {
  tri(c, pts[0] + 1, pts[1] + 1, pts[2] + 1, pts[3] + 1, pts[4] + 1, pts[5] + 1, outline)
  tri(c, ...pts, fill)
}

function eye(c, x, y, p, closed = false, big = false) {
  if (closed) {
    rect(c, x - 1, y, big ? 4 : 3, 1, p.eye)
    return
  }
  rect(c, x - 1, y - 1, big ? 4 : 3, big ? 4 : 3, p.eye)
  px(c, x, y - 1, p.white)
  if (big) px(c, x - 1, y, p.white)
}

function limb(c, x, y, w, h, fill, outline) {
  rect(c, x - 1, y - 1, w + 2, h + 2, outline)
  rect(c, x, y, w, h, fill)
}

// Draws optional back features (wings, tail, shell) using the species look.
function drawWings(c, p, kind, x, y, size) {
  const s = size
  if (kind === 'dragon') {
    outlinedTri(c, [x - 6 * s, y, x + 8 * s, y - 12 * s, x + 1 * s, y + 1 * s], p.base, p.dark)
    outlinedTri(c, [x + 1 * s, y - 2 * s, x + 13 * s, y - 9 * s, x + 4 * s, y + 2 * s], p.base, p.dark)
    rect(c, x + 2 * s, y - 7 * s, 1, 6 * s, p.light)
  } else if (kind === 'bird') {
    outlinedEllipse(c, x, y, 7 * s, 4 * s, p.base, p.dark)
    rect(c, x - 6 * s, y - 1, 8, 1, p.light)
  } else {
    outlinedEllipse(c, x, y, 6 * s, 5 * s, p.light, p.dark)
    rect(c, x - 4 * s, y - 2, 4, 1, p.white)
  }
}

function drawTail(c, p, kind, x, y, s, feature = true) {
  if (!feature) return
  if (kind === 'spike') {
    rect(c, x - 1, y - 1, 8, 3, p.dark)
    rect(c, x, y, 7, 1, p.accent)
    tri(c, x + 6, y - 3, x + 10, y, x + 6, y + 2, p.accent)
  } else if (kind === 'bushy') {
    outlinedEllipse(c, x - 2, y - 1, 5 * s, 4 * s, p.base, p.dark)
    ellipse(c, x - 3, y - 2, 2 * s, 1.5 * s, p.light)
  } else {
    rect(c, x - 1, y - 1, 7 * s, 3, p.dark)
    rect(c, x, y, 6 * s, 1, p.base)
    tri(c, x + 5 * s, y - 2, x + 9 * s, y + 1, x + 5 * s, y + 2, p.accent)
  }
}

function drawEars(c, p, x, y, s, kind = 'normal') {
  if (kind === 'antlers') {
    limb(c, x - 2, y - 6, 1, 7, p.light, p.dark)
    limb(c, x + 1, y - 7, 1, 8, p.light, p.dark)
    rect(c, x - 5, y - 5, 3, 1, p.light)
    rect(c, x + 2, y - 6, 3, 1, p.light)
    rect(c, x - 6, y - 7, 2, 1, p.accent)
    rect(c, x + 4, y - 8, 2, 1, p.accent)
  } else if (kind === 'horns') {
    outlinedTri(c, [x - 2, y + 2, x - 4, y - 6, x + 1, y - 1], p.accent, p.dark)
    outlinedTri(c, [x + 2, y + 2, x + 4, y - 5, x + 5, y + 1], p.accent, p.dark)
  } else {
    outlinedTri(c, [x - 3, y + 2, x - 2, y - 5, x + 1, y + 1], p.base, p.dark)
    outlinedTri(c, [x + 1, y + 1, x + 4, y - 4, x + 5, y + 2], p.base, p.dark)
  }
}

function drawCrown(c, p, x, y) {
  rect(c, x - 5, y - 1, 11, 2, p.dark)
  rect(c, x - 4, y, 9, 1, p.accent)
  rect(c, x - 4, y - 4, 2, 4, p.accent)
  rect(c, x - 1, y - 5, 2, 5, p.accent)
  rect(c, x + 3, y - 4, 2, 4, p.accent)
  px(c, x - 3, y - 1, p.white)
  px(c, x, y - 2, p.white)
  px(c, x + 4, y - 1, p.white)
}

function drawOrbs(c, p, x, y, time = 0) {
  const offsets = [[0, 0], [-4, 3], [5, 2]]
  offsets.forEach(([dx, dy], i) => {
    const oy = y + dy + (i % 2 ? 1 : -1)
    rect(c, x + dx - 1, oy, 2, 2, p.dark)
    px(c, x + dx, oy, p.accent)
    px(c, x + dx, oy - 1, p.white)
  })
}

function drawLeaf(c, p, x, y) {
  outlinedEllipse(c, x, y, 3, 2, p.light, p.dark)
  rect(c, x - 2, y, 1, 4, p.dark)
}

function drawEyePair(c, p, x, y, gap = 5, closed = false) {
  eye(c, x - gap, y, p, closed)
  eye(c, x + gap - 2, y, p, closed)
}

// ── body archetypes ─────────────────────────────────────────────────────────
function drawQuad(c, p, sp, opts) {
  const s = opts.scale
  const wing = sp.look.features.includes('wings')
  const shell = sp.look.features.includes('shell')
  const tailKind = sp.look.features.includes('bushy') ? 'bushy' : sp.look.features.includes('spike') ? 'spike' : 'normal'

  if (wing) drawWings(c, p, sp.element === 'dragon' ? 'dragon' : 'normal', 20, 14, s)
  drawTail(c, p, tailKind, 11, 24, s, !shell)
  if (sp.look.features.includes('mane')) {
    for (let i = 0; i < 6; i++) px(c, 22 + i, 12 + (i % 2), p.light)
  }
  if (shell) {
    outlinedEllipse(c, 17, 21, 11 * s, 8 * s, p.dark, p.dark)
    outlinedEllipse(c, 17, 20, 9 * s, 6 * s, p.base, p.dark)
    ellipse(c, 15, 18, 5 * s, 2 * s, p.light)
  }
  // legs
  limb(c, 11 * s + 4, 27, 4, 6 * s, p.base, p.dark)
  limb(c, 20 * s + 3, 27, 4, 6 * s, p.base, p.dark)
  rect(c, 11 * s + 4, 32 + (s - 1) * 4, 5, 2, p.accent)
  rect(c, 20 * s + 3, 32 + (s - 1) * 4, 5, 2, p.accent)
  // body
  outlinedEllipse(c, 19, 23, 11 * s, 7.5 * s, p.base, p.dark)
  ellipse(c, 16, 20, 6 * s, 3 * s, p.light)
  if (sp.look.features.includes('spots')) {
    [[14, 22], [18, 26], [23, 21], [25, 25]].forEach(([x, y]) => rect(c, x, y, 2, 2, p.dark))
  }
  if (sp.look.features.includes('stripes')) {
    [12, 16, 20].forEach(x => rect(c, x, 19, 2, 9, p.dark))
  }
  if (sp.look.features.includes('spikes')) {
    for (let i = 0; i < 3; i++) outlinedTri(c, [15 + i * 4, 17, 16 + i * 4, 12, 18 + i * 4, 17], p.accent, p.dark)
  }
  // head
  outlinedEllipse(c, 28, 15, 6.6 * s, 5.6 * s, p.base, p.dark)
  ellipse(c, 27, 12.5, 4 * s, 2.4 * s, p.light)
  outlinedEllipse(c, 31, 18, 4 * s, 3 * s, p.light, p.dark)
  drawEars(c, p, 26, 11, s, sp.look.features.includes('antlers') ? 'antlers' : sp.look.features.includes('horns') ? 'horns' : 'normal')
  if (sp.look.features.includes('leaf')) drawLeaf(c, p, 24, 8)
  if (sp.look.features.includes('crest')) {
    outlinedTri(c, [24, 10, 26, 4, 29, 9], p.accent, p.dark)
  }
  eye(c, 30, 14, p, opts.blink, true)
  rect(c, 33, 19, 2, 1, p.eye)
  px(c, 34, 17, p.white)
  if (sp.look.features.includes('crown')) drawCrown(c, p, 28, 7)
  if (sp.look.features.includes('gem')) {
    tri(c, 20, 17, 23, 14, 26, 17, p.accent)
    tri(c, 20, 17, 23, 20, 26, 17, p.light)
  }
  if (sp.look.features.includes('claws')) {
    rect(c, 33, 20, 2, 4, p.white)
    rect(c, 30, 21, 2, 3, p.white)
  }
}

function drawBiped(c, p, sp, opts) {
  const s = opts.scale
  const wing = sp.look.features.includes('wings')
  if (wing) drawWings(c, p, 'normal', 17, 16, s)
  drawTail(c, p, sp.look.features.includes('bushy') ? 'bushy' : 'normal', 11, 22, s, sp.look.features.includes('tail'))
  // legs
  limb(c, 14, 30, 4, 5, p.base, p.dark)
  limb(c, 22, 30, 4, 5, p.base, p.dark)
  rect(c, 13, 34, 6, 2, p.accent)
  rect(c, 21, 34, 6, 2, p.accent)
  // arms
  limb(c, 9, 20, 3, 8, p.base, p.dark)
  limb(c, 28, 20, 3, 8, p.base, p.dark)
  if (sp.look.features.includes('claws')) {
    rect(c, 8, 27, 3, 2, p.white)
    rect(c, 29, 27, 3, 2, p.white)
  }
  // torso
  outlinedEllipse(c, 20, 25, 8.5 * s, 8 * s, p.base, p.dark)
  ellipse(c, 18, 22, 4.5 * s, 3.5 * s, p.light)
  if (sp.look.features.includes('spikes')) {
    for (let i = 0; i < 3; i++) outlinedTri(c, [14 + i * 5, 18, 15 + i * 5, 13, 18 + i * 5, 18], p.accent, p.dark)
  }
  if (sp.look.features.includes('stripes')) [14, 18, 22, 26].forEach(x => rect(c, x, 19, 2, 10, p.dark))
  // head
  outlinedEllipse(c, 20, 13, 7 * s, 6.4 * s, p.base, p.dark)
  ellipse(c, 18, 10, 4 * s, 2.6 * s, p.light)
  drawEars(c, p, 20, 8, s, sp.look.features.includes('horns') ? 'horns' : sp.look.features.includes('antlers') ? 'antlers' : 'normal')
  if (sp.look.features.includes('mane')) {
    for (let i = 0; i < 7; i++) px(c, 13 + i, 17 + (i % 2), p.light)
  }
  if (sp.look.features.includes('mask')) rect(c, 14, 12, 12, 4, p.dark)
  drawEyePair(c, p, 20, 13, 4, opts.blink)
  rect(c, 18, 17, 4, 1, p.eye)
  if (sp.look.features.includes('leaf')) drawLeaf(c, p, 17, 6)
  if (sp.look.features.includes('crest')) outlinedTri(c, [16, 8, 18, 1, 22, 7], p.accent, p.dark)
  if (sp.look.features.includes('crown')) drawCrown(c, p, 20, 4)
  if (sp.look.features.includes('gem')) {
    tri(c, 18, 21, 20, 18, 22, 21, p.accent)
    tri(c, 18, 21, 20, 24, 22, 21, p.light)
  }
  if (sp.look.features.includes('shell')) outlinedEllipse(c, 20, 24, 9, 8, p.dark, p.dark)
}

function drawBird(c, p, sp, opts) {
  const s = opts.scale
  if (sp.look.features.includes('wings')) drawWings(c, p, 'bird', 17, 20, s)
  // tail
  for (let i = 0; i < 3; i++) outlinedTri(c, [10, 24, 2 + i * 2, 16 + i * 4, 11, 27], i === 1 ? p.accent : p.base, p.dark)
  // legs
  limb(c, 17, 30, 2, 5, p.accent, p.dark)
  limb(c, 23, 30, 2, 5, p.accent, p.dark)
  rect(c, 15, 34, 5, 2, p.accent)
  rect(c, 22, 34, 5, 2, p.accent)
  // body
  outlinedEllipse(c, 19, 23, 9 * s, 8 * s, p.base, p.dark)
  ellipse(c, 16, 20, 5 * s, 3.5 * s, p.light)
  if (sp.look.features.includes('spots')) [[14, 24], [19, 27], [23, 22]].forEach(([x, y]) => rect(c, x, y, 2, 2, p.dark))
  // wing overlay
  outlinedEllipse(c, 17, 24, 5 * s, 4 * s, p.light, p.dark)
  // head
  outlinedEllipse(c, 26, 14, 5.5 * s, 5 * s, p.base, p.dark)
  ellipse(c, 25, 12, 3 * s, 2 * s, p.light)
  // beak
  outlinedTri(c, [31, 14, 36, 16, 31, 18], p.accent, p.dark)
  eye(c, 28, 13, p, opts.blink)
  if (sp.look.features.includes('crest')) outlinedTri(c, [23, 9, 25, 3, 28, 8], p.accent, p.dark)
  if (sp.look.features.includes('horns')) drawEars(c, p, 26, 10, 0.9, 'horns')
  if (sp.look.features.includes('crown')) drawCrown(c, p, 26, 6)
  if (sp.look.features.includes('mane')) for (let i = 0; i < 4; i++) px(c, 21 + i, 19, p.accent)
}

function drawSerpent(c, p, sp, opts) {
  const s = opts.scale
  if (sp.look.features.includes('wings')) drawWings(c, p, sp.element === 'dragon' ? 'dragon' : 'normal', 18, 18, s)
  // coiled body
  outlinedEllipse(c, 20, 30, 13 * s, 5 * s, p.base, p.dark)
  ellipse(c, 20, 28, 10 * s, 3 * s, p.light)
  outlinedEllipse(c, 17, 27, 9 * s, 4 * s, p.base, p.dark)
  ellipse(c, 15, 25, 5 * s, 2 * s, p.light)
  // neck
  limb(c, 24, 16, 5 * s, 13, p.base, p.dark)
  rect(c, 24, 17, 1, 10, p.light)
  // head
  outlinedEllipse(c, 27, 12, 7 * s, 5 * s, p.base, p.dark)
  ellipse(c, 26, 9, 4 * s, 2 * s, p.light)
  outlinedEllipse(c, 30, 14, 4 * s, 2.6 * s, p.light, p.dark)
  eye(c, 29, 11, p, opts.blink)
  rect(c, 33, 14, 2, 1, p.eye)
  if (sp.look.features.includes('horns')) drawEars(c, p, 27, 8, 0.9, 'horns')
  if (sp.look.features.includes('fins')) outlinedTri(c, [22, 14, 17, 11, 22, 18], p.accent, p.dark)
  if (sp.look.features.includes('spikes')) for (let i = 0; i < 3; i++) outlinedTri(c, [12 + i * 4, 25, 13 + i * 4, 21, 15 + i * 4, 25], p.accent, p.dark)
  if (sp.look.features.includes('crown')) drawCrown(c, p, 27, 5)
  if (sp.look.features.includes('gem')) rect(c, 25, 15, 3, 3, p.accent)
  if (sp.look.features.includes('bones')) {
    [16, 22, 28].forEach(x => { rect(c, x, 29, 4, 1, p.white); rect(c, x, 31, 4, 1, p.white) })
  }
  if (sp.look.features.includes('orbs')) drawOrbs(c, p, 12, 18)
}

function drawBug(c, p, sp, opts) {
  const s = opts.scale
  if (sp.look.features.includes('wings')) {
    outlinedEllipse(c, 13, 15, 7 * s, 8 * s, p.light, p.dark)
    outlinedEllipse(c, 24, 16, 6 * s, 9 * s, p.light, p.dark)
    ellipse(c, 12, 13, 3, 4, p.white)
    ellipse(c, 24, 14, 2.5, 4, p.white)
    rect(c, 20, 14, 1, 8, p.dark)
  }
  // legs
  ;[15, 21, 27].forEach((x, i) => {
    limb(c, x - 1, 29 + (i % 2), 1, 5, p.dark, p.dark)
  })
  // abdomen + thorax + head
  outlinedEllipse(c, 19, 28, 10 * s, 6 * s, p.base, p.dark)
  ellipse(c, 17, 26, 6 * s, 3 * s, p.light)
  outlinedEllipse(c, 22, 22, 7 * s, 5 * s, p.base, p.dark)
  outlinedEllipse(c, 27, 17, 5 * s, 4.5 * s, p.base, p.dark)
  ellipse(c, 26, 15, 3 * s, 2 * s, p.light)
  if (sp.look.features.includes('shell') || sp.look.features.includes('spots')) {
    [[15, 27], [20, 24], [24, 29]].forEach(([x, y]) => rect(c, x, y, 2, 2, p.dark))
  }
  if (sp.look.features.includes('antenna')) {
    rect(c, 26, 10, 1, 4, p.dark)
    rect(c, 29, 9, 1, 5, p.dark)
    rect(c, 25, 9, 2, 1, p.accent)
    rect(c, 29, 8, 2, 1, p.accent)
  }
  eye(c, 29, 16, p, opts.blink)
  if (sp.look.features.includes('gem')) {
    tri(c, 18, 25, 21, 22, 24, 25, p.accent)
  }
  if (sp.look.features.includes('spikes')) for (let i = 0; i < 3; i++) outlinedTri(c, [14 + i * 4, 22, 15 + i * 4, 18, 17 + i * 4, 22], p.accent, p.dark)
  if (sp.look.features.includes('crown')) drawCrown(c, p, 27, 10)
}

function drawBlob(c, p, sp, opts) {
  const s = opts.scale
  // body mound
  outlinedEllipse(c, 20, 27, 12 * s, 9 * s, p.base, p.dark)
  ellipse(c, 17, 23, 7 * s, 4 * s, p.light)
  outlinedEllipse(c, 20, 22, 8 * s, 6 * s, p.base, p.dark)
  // arms
  limb(c, 7, 24, 3, 6, p.base, p.dark)
  limb(c, 30, 24, 3, 6, p.base, p.dark)
  // face
  drawEyePair(c, p, 19, 21, 5, opts.blink)
  rect(c, 18, 25, 4, 1, p.eye)
  px(c, 19, 26, p.accent)
  if (sp.look.features.includes('spots')) {
    [[11, 28], [27, 27], [20, 32], [14, 24]].forEach(([x, y]) => rect(c, x, y, 2, 2, p.dark))
  }
  if (sp.look.features.includes('leaf')) {
    drawLeaf(c, p, 20, 12)
    rect(c, 20, 14, 1, 3, p.dark)
  }
  if (sp.look.features.includes('shell')) {
    outlinedEllipse(c, 20, 24, 13 * s, 9 * s, p.dark, p.dark)
    outlinedEllipse(c, 20, 22, 10 * s, 7 * s, p.base, p.dark)
    ellipse(c, 18, 19, 5 * s, 2 * s, p.light)
  }
  if (sp.look.features.includes('horns')) drawEars(c, p, 20, 16, s, 'horns')
  if (sp.look.features.includes('maw')) {
    ellipse(c, 25, 28, 6 * s, 4 * s, p.dark)
    rect(c, 20, 27, 11, 1, p.white)
    rect(c, 22, 30, 2, 2, p.white)
    rect(c, 27, 30, 2, 2, p.white)
  }
  if (sp.look.features.includes('crown')) drawCrown(c, p, 20, 13)
  if (sp.look.features.includes('fins')) outlinedTri(c, [9, 26, 4, 20, 10, 20], p.accent, p.dark)
  if (sp.look.features.includes('cloud')) {
    outlinedEllipse(c, 12, 18, 5, 4, p.light, p.dark)
    outlinedEllipse(c, 28, 18, 5, 4, p.light, p.dark)
  }
}

function drawGolem(c, p, sp, opts) {
  const s = opts.scale
  // legs
  limb(c, 13, 29, 5, 6, p.base, p.dark)
  limb(c, 23, 29, 5, 6, p.base, p.dark)
  // arms
  limb(c, 8, 18, 4, 10, p.base, p.dark)
  limb(c, 29, 18, 4, 10, p.base, p.dark)
  // torso block
  rect(c, 11, 16, 19, 16, p.dark)
  rect(c, 12, 17, 17, 14, p.base)
  rect(c, 13, 18, 9, 4, p.light)
  rect(c, 12, 30, 17, 2, p.dark)
  // cracks
  rect(c, 16, 23, 1, 5, p.dark); rect(c, 17, 27, 3, 1, p.dark)
  // head
  rect(c, 14, 7, 13, 10, p.dark)
  rect(c, 15, 8, 11, 8, p.base)
  rect(c, 16, 9, 6, 2, p.light)
  drawEyePair(c, p, 20, 12, 4, opts.blink)
  // gem
  tri(c, 17, 20, 21, 15, 25, 20, p.accent)
  tri(c, 17, 20, 21, 25, 25, 20, p.light)
  if (sp.look.features.includes('gem')) {
    rect(c, 20, 1, 1, 5, p.accent)
    rect(c, 19, 3, 3, 3, p.white)
  }
  if (sp.look.features.includes('spikes')) {
    outlinedTri(c, [12, 17, 9, 10, 15, 15], p.accent, p.dark)
    outlinedTri(c, [27, 17, 31, 10, 28, 16], p.accent, p.dark)
  }
  if (sp.look.features.includes('gear')) {
    rect(c, 22, 19, 5, 5, p.dark)
    rect(c, 23, 20, 3, 3, p.accent)
    rect(c, 24, 18, 1, 7, p.accent)
    rect(c, 21, 21, 7, 1, p.accent)
  }
  if (sp.look.features.includes('mask')) rect(c, 15, 10, 11, 3, p.dark)
  if (sp.look.features.includes('crown')) drawCrown(c, p, 20, 5)
  if (sp.look.features.includes('bones')) {
    rect(c, 12, 20, 3, 1, p.white)
    rect(c, 25, 24, 3, 1, p.white)
  }
}

function drawSpirit(c, p, sp, opts) {
  const s = opts.scale
  // wisp tail
  for (let i = 0; i < 7; i++) {
    const w = 4 - Math.floor(i / 2)
    rect(c, 19 - w / 2 + Math.sin(i) * 2, 28 + i * 2, w, 2, i < 4 ? p.base : p.dark)
  }
  if (sp.look.features.includes('wings')) drawWings(c, p, 'normal', 19, 15, s)
  // arms wisps
  outlinedEllipse(c, 8, 22, 3, 3, p.base, p.dark)
  outlinedEllipse(c, 32, 22, 3, 3, p.base, p.dark)
  // body
  outlinedEllipse(c, 20, 20, 9 * s, 9 * s, p.base, p.dark)
  ellipse(c, 18, 17, 5 * s, 4 * s, p.light)
  ellipse(c, 20, 25, 4 * s, 2 * s, p.accent)
  // face
  drawEyePair(c, p, 20, 19, 5, opts.blink)
  ellipse(c, 20, 24, 2, 2, p.eye)
  if (sp.look.features.includes('horns')) drawEars(c, p, 20, 12, s, 'horns')
  if (sp.look.features.includes('orbs')) drawOrbs(c, p, 20, 8)
  if (sp.look.features.includes('crown')) drawCrown(c, p, 20, 8)
  if (sp.look.features.includes('plume')) outlinedTri(c, [18, 11, 20, 3, 23, 11], p.accent, p.dark)
  if (sp.look.features.includes('mask')) rect(c, 15, 17, 10, 3, p.dark)
  if (sp.look.features.includes('maw')) ellipse(c, 20, 25, 4, 3, p.eye)
}

function drawDragon(c, p, sp, opts) {
  drawQuad(c, p, sp, opts)
}

const BODIES = {
  quad: drawQuad, biped: drawBiped, bird: drawBird, serpent: drawSerpent,
  bug: drawBug, blob: drawBlob, golem: drawGolem, spirit: drawSpirit,
  dragon: drawDragon, fish: drawBlob,
}

// ── public sprite API ───────────────────────────────────────────────────────
const monsterCache = new Map()

export function monsterSprite(speciesId, { blink = false, egg = false, hatchRatio = 0 } = {}) {
  const key = `${speciesId}|${egg ? 'egg' + Math.round(hatchRatio * 5) : blink ? 'blink' : 'open'}`
  if (monsterCache.has(key)) return monsterCache.get(key)
  const species = getMonster(speciesId)
  const canvas = document.createElement('canvas')
  canvas.width = 40; canvas.height = 40
  const c = canvas.getContext('2d')
  c.imageSmoothingEnabled = false
  const p = paletteFor(species)
  const scale = 0.82 + (species.look?.size || 1) * 0.11

  if (egg) {
    const ratio = hatchRatio
    outlinedEllipse(c, 20, 26, 11, 14, p.white, p.dark)
    ellipse(c, 16, 20, 5, 6, p.light)
    // spots
    ;[[13, 28], [24, 30], [19, 35], [27, 22], [12, 21], [21, 19]].forEach(([x, y], i) => {
      if (i % 2) ellipse(c, x, y, 2.4, 2, p.base)
      else ellipse(c, x, y, 2.2, 2, p.accent)
    })
    rect(c, 13, 14, 2, 3, p.dark)
    rect(c, 22, 32, 3, 2, p.dark)
    if (ratio > 0.15) { rect(c, 25, 20, 1, 4, p.dark); rect(c, 25, 24, 3, 1, p.dark) }
    if (ratio > 0.4) { rect(c, 14, 24, 1, 4, p.dark); rect(c, 14, 28, 3, 1, p.dark) }
    if (ratio > 0.7) { rect(c, 19, 17, 3, 1, p.dark); rect(c, 20, 18, 1, 3, p.dark) }
    if (ratio > 0.9) { rect(c, 27, 29, 2, 2, p.dark); rect(c, 11, 31, 2, 2, p.dark) }
  } else {
    const draw = BODIES[species.look?.body] || drawBlob
    draw(c, p, species, { scale, blink })
  }

  monsterCache.set(key, canvas)
  return canvas
}

export function monsterDataUrl(speciesId, opts = {}) {
  return monsterSprite(speciesId, opts).toDataURL()
}

// ── trainer / NPC sprites ───────────────────────────────────────────────────
const npcCache = new Map()

const CLOTHES = {
  player: { coat: '#3d8f86', coat2: '#2b665f', trim: '#f0d48a', hat: '#24504a', skin: '#f0c9a0', hair: '#5b3a2a', boots: '#4a3328' },
  healer: { coat: '#f0efe2', coat2: '#c9c5b0', trim: '#7ed957', hat: '#f0efe2', skin: '#e8bb8e', hair: '#d8d0b8', boots: '#6b5a44' },
  merchant: { coat: '#b9773a', coat2: '#8c5729', trim: '#ffd36e', hat: '#6d4420', skin: '#e0aa7c', hair: '#3e2a1a', boots: '#4a3328' },
  quest: { coat: '#6a5a9e', coat2: '#4b3f78', trim: '#ffd36e', hat: '#3d335e', skin: '#f0c9a0', hair: '#e8e0d0', boots: '#3a2e40' },
  trainer: { coat: '#a63f4e', coat2: '#7b2b38', trim: '#ffd36e', hat: '#61212c', skin: '#e8b184', hair: '#2f2420', boots: '#3d2c25' },
  elder: { coat: '#7d8a6a', coat2: '#5a6550', trim: '#e8d8a8', hat: '#566049', skin: '#d8b08a', hair: '#e8e2d6', boots: '#4a3e32' },
  witch: { coat: '#5b3a7e', coat2: '#3f2859', trim: '#b48ae0', hat: '#34204a', skin: '#d8b08a', hair: '#2a1a38', boots: '#2a1a38' },
  spirit: { coat: '#8a7aa8', coat2: '#62547d', trim: '#d8c8ff', hat: '#62547d', skin: '#c8b8d8', hair: '#e0d8f0', boots: '#4a3d5e' },
  nursery: { coat: '#d68aa0', coat2: '#a86078', trim: '#ffe0e8', hat: '#a86078', skin: '#f0c9a0', hair: '#8a5a3a', boots: '#6a4a40' },
}

export function npcSprite(role = 'lore', dir = 'down', frame = 0) {
  const key = `${role}|${dir}|${frame}`
  if (npcCache.has(key)) return npcCache.get(key)
  const palette = CLOTHES[role] || CLOTHES.lore || CLOTHES.elder
  const canvas = document.createElement('canvas')
  canvas.width = 18; canvas.height = 26
  const c = canvas.getContext('2d')
  c.imageSmoothingEnabled = false
  drawHumanoid(c, palette, dir, frame, role)
  npcCache.set(key, canvas)
  return canvas
}

export function playerSprite(dir = 'down', frame = 0) {
  return npcSprite('player', dir, frame)
}

function drawHumanoid(c, p, dir, frame, role) {
  const moving = frame === 1
  const bob = moving ? 0 : 0
  // shadow
  ellipse(c, 9, 24, 6, 2, 'rgba(0,0,0,0.25)')
  // legs
  if (dir === 'left' || dir === 'right') {
    rect(c, 7, 20 + bob, 3, 4, p.coat2)
    rect(c, 10, 20 + bob, 3, 4, p.coat2)
    rect(c, moving ? 6 : 7, 23 + bob, 4, 2, p.boots)
    rect(c, moving ? 10 : 11, 23 + bob, 4, 2, p.boots)
  } else {
    rect(c, 6, 20 + bob, 3, 4, p.coat2)
    rect(c, 10, 20 + bob, 3, 4, p.coat2)
    rect(c, 6, 23 + bob, 4, 2, p.boots)
    rect(c, 10, 23 + bob, 4, 2, p.boots)
  }
  // coat
  rect(c, 5, 13 + bob, 9, 9, p.coat2)
  rect(c, 6, 13 + bob, 7, 7, p.coat)
  rect(c, 8, 14 + bob, 2, 7, p.trim)
  // arms
  rect(c, 4, 15 + bob, 2, 5, p.coat)
  rect(c, 13, 15 + bob, 2, 5, p.coat)
  rect(c, 4, 19 + bob, 2, 2, p.skin)
  rect(c, 13, 19 + bob, 2, 2, p.skin)
  // head
  rect(c, 6, 7 + bob, 7, 7, p.skin)
  // hair / hat
  if (role === 'witch') {
    rect(c, 5, 4 + bob, 9, 2, p.hat)
    tri(c, 6, 5 + bob, 9, 0 + bob, 12, 5 + bob, p.hat)
  } else if (role === 'healer') {
    rect(c, 5, 5 + bob, 9, 3, p.hat)
    rect(c, 8, 4 + bob, 3, 2, p.trim)
  } else if (role === 'player' || role === 'trainer') {
    rect(c, 5, 5 + bob, 9, 3, p.hat)
    rect(c, 4, 7 + bob, 11, 2, p.hat)
  } else if (role === 'spirit') {
    rect(c, 5, 5 + bob, 9, 2, p.hat)
  } else {
    rect(c, 5, 5 + bob, 9, 2, p.hair)
    rect(c, 4, 7 + bob, 2, 3, p.hair)
    rect(c, 13, 7 + bob, 2, 3, p.hair)
  }
  // face
  if (dir !== 'up') {
    rect(c, 7, 9 + bob, 1, 2, '#2a1e18')
    rect(c, 11, 9 + bob, 1, 2, '#2a1e18')
  } else {
    rect(c, 6, 8 + bob, 7, 4, p.hair)
  }
  // scarf/satchel
  rect(c, 5, 12 + bob, 9, 2, p.trim)
  if (role === 'merchant') rect(c, 12, 16 + bob, 3, 3, p.boots)
  if (role === 'player') rect(c, 4, 16 + bob, 3, 3, p.boots)
}

export function flipCanvas(canvas) {
  const out = document.createElement('canvas')
  out.width = canvas.width; out.height = canvas.height
  const c = out.getContext('2d')
  c.imageSmoothingEnabled = false
  c.translate(canvas.width, 0); c.scale(-1, 1)
  c.drawImage(canvas, 0, 0)
  return out
}

export function elementPalette(element) {
  const p = PALETTES[element] || PALETTES.none
  return { ...p, meta: ELEMENTS[element] || ELEMENTS.none }
}
