// Small shared utilities: deterministic RNG, math, formatting, tiny DOM helpers.

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
export const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)]
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export function weightedPick(entries, rng = Math.random) {
  const total = entries.reduce((s, e) => s + e.weight, 0)
  let roll = rng() * total
  for (const e of entries) { roll -= e.weight; if (roll <= 0) return e }
  return entries[entries.length - 1]
}

export function shuffle(arr, rng = Math.random) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function formatTime(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = Math.floor(m % 60)
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function isNight(minutes) {
  const h = Math.floor((((minutes % 1440) + 1440) % 1440) / 60)
  return h >= 20 || h < 6
}

export function timeOfDay(minutes) {
  const h = Math.floor((((minutes % 1440) + 1440) % 1440) / 60)
  if (h < 5) return 'Night'
  if (h < 8) return 'Dawn'
  if (h < 17) return 'Day'
  if (h < 20) return 'Dusk'
  return 'Night'
}

export function roman(n) {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n] || String(n)
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k === 'html') node.innerHTML = v
    else if (k.startsWith('data-') || k === 'title') node.setAttribute(k, v)
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v)
    else node[k] = v
  }
  for (const child of [].concat(children)) {
    if (child == null) continue
    node.append(child.nodeType ? child : document.createTextNode(String(child)))
  }
  return node
}

export function titleCase(str) {
  return str.replace(/(^|\s|-)\w/g, c => c.toUpperCase())
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min
}
