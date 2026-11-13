// Element definitions and the battle effectiveness matrix.
// Every attack element maps to multipliers against defending elements.
// 2 = super effective, 0.5 = resisted, 1 = neutral.

export const ELEMENTS = {
  none:   { name: 'Neutral', color: '#d8cbb6', dark: '#6d6252', light: '#f4ecdd', glyph: '◇' },
  nature: { name: 'Nature',  color: '#74ce6a', dark: '#2f6b3d', light: '#c3f5a5', glyph: '✿' },
  flame:  { name: 'Flame',   color: '#ff8a4c', dark: '#8e2f22', light: '#ffd08a', glyph: '✦' },
  frost:  { name: 'Frost',   color: '#7fd8ef', dark: '#28617f', light: '#d5f7ff', glyph: '❄' },
  earth:  { name: 'Earth',   color: '#d9ae6b', dark: '#73532d', light: '#f5dfb0', glyph: '⬢' },
  shadow: { name: 'Shadow',  color: '#b48ae0', dark: '#4a2a68', light: '#e3c9ff', glyph: '☾' },
  light:  { name: 'Light',   color: '#ffe27a', dark: '#96702a', light: '#fff8cc', glyph: '☀' },
  storm:  { name: 'Storm',   color: '#9db9ff', dark: '#39447f', light: '#dce6ff', glyph: '⚡' },
  dragon: { name: 'Dragon',  color: '#e8848c', dark: '#7b2d3a', light: '#ffc2c6', glyph: '✧' },
}

export const ATTACK_CHART = {
  nature: { earth: 2, storm: 2, flame: 0.5, frost: 0.5 },
  flame:  { nature: 2, frost: 2, earth: 0.5, dragon: 0.5 },
  frost:  { nature: 2, earth: 2, flame: 0.5, storm: 0.5 },
  earth:  { flame: 2, storm: 2, nature: 0.5, frost: 0.5 },
  storm:  { frost: 2, light: 2, earth: 0.5, nature: 0.5 },
  shadow: { light: 2, storm: 2, nature: 0.5, shadow: 0.5 },
  light:  { shadow: 2, dragon: 2, storm: 0.5, light: 0.5 },
  dragon: { light: 2, nature: 0.5, flame: 0.5, frost: 0.5, earth: 0.5, storm: 0.5, shadow: 0.5, dragon: 0.5 },
  none:   {},
}

export function effectiveness(attackElement, defendElement) {
  if (!attackElement || attackElement === 'none') return 1
  const row = ATTACK_CHART[attackElement]
  return row && row[defendElement] ? row[defendElement] : 1
}

export function effectivenessLabel(mult) {
  if (mult >= 2) return { text: 'Super effective!', cls: 'eff-super' }
  if (mult <= 0.5) return { text: 'Not very effective…', cls: 'eff-weak' }
  return null
}

export const RARITY = {
  common:    { name: 'Common',    color: '#b9c4cf', catch: 0.58, weight: 44, xp: 1 },
  uncommon:  { name: 'Uncommon',  color: '#78d9a4', catch: 0.44, weight: 24, xp: 1.25 },
  rare:      { name: 'Rare',      color: '#7fb8ff', catch: 0.3,  weight: 13, xp: 1.6 },
  epic:      { name: 'Epic',      color: '#c99bff', catch: 0.17, weight: 5,  xp: 2.1 },
  legendary: { name: 'Legendary', color: '#ffd36e', catch: 0.075, weight: 1, xp: 3 },
}

export const STATUS = {
  burn:      { name: 'Burn',      color: '#ff8a4c', glyph: '🔥', tick: 1 / 16, capture: 1.25 },
  poison:    { name: 'Poison',    color: '#c084fc', glyph: '☠', tick: 1 / 12, capture: 1.3 },
  sleep:     { name: 'Sleep',     color: '#9db9ff', glyph: 'zZ', tick: 0, capture: 1.75 },
  freeze:    { name: 'Freeze',    color: '#7fd8ef', glyph: '❄', tick: 0, capture: 1.8 },
  paralysis: { name: 'Paralysis', color: '#ffe27a', glyph: '⚡', tick: 0, capture: 1.45 },
}

export const STAT_LABELS = {
  hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed',
}

export const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
