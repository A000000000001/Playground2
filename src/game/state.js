// Persistent game state, save/load, and high-level state mutations.

import { createMonster, trainerXpNeed } from './monsters.js'
import { getMonster } from '../data/monsters.js'
import { getItem } from '../data/items.js'
import { clamp, uid } from '../core/utils.js'

export const SAVE_KEY = 'aetheria_monster_catcher_save_v1'
export const SAVE_VERSION = 3

export function defaultState() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    savedAt: null,
    player: {
      name: 'Wren',
      x: 0, y: 0, dir: 'down',
      biome: 'forest',
      money: 500,
      trainerLevel: 1,
      trainerXp: 0,
      steps: 0,
    },
    party: [],
    storage: [],
    inventory: {
      capture_orb: 8,
      minor_mend: 4,
      herb: 2,
      region_map: 1,
      field_notes: 1,
    },
    pokedex: { seen: {}, caught: {} },
    quests: {},
    trackedQuest: null,
    achievements: {},
    flags: {
      visited: { forest: true },
      bosses: {},
      trainers: {},
      mythic: {},
      hatched: false,
      starterChosen: false,
      introSeen: false,
    },
    time: { minutes: 8 * 60, day: 1 },
    settings: { sfx: true, music: false, speed: 'normal', screenShake: true, autosave: true },
    stats: {
      catches: 0, catchesByBiome: {}, catchesByElement: {}, legendaryCatches: 0,
      battles: 0, wins: 0, trainerWins: 0, bosses: 0, steps: 0,
      crafts: 0, evolutions: 0, hatched: 0, moneyEarned: 0,
      gathered: {}, nightCatches: 0, playTime: 0,
    },
  }
}

export function newGame(starterId, playerName = 'Wren') {
  const state = defaultState()
  state.player.name = playerName || 'Wren'
  const starter = createMonster(starterId, 5, { friendship: 55 })
  starter.nicknameCustom = false
  state.party.push(starter)
  state.pokedex.seen[starterId] = true
  state.pokedex.caught[starterId] = true
  state.flags.starterChosen = true
  return state
}

export function addMonster(state, monster) {
  if (state.party.length < 6) state.party.push(monster)
  else state.storage.push(monster)
  markCaught(state, monster.speciesId)
  return state.party.includes(monster)
}

export function markSeen(state, speciesId) {
  state.pokedex.seen[speciesId] = true
}

export function markCaught(state, speciesId) {
  state.pokedex.seen[speciesId] = true
  state.pokedex.caught[speciesId] = true
}

export function caughtCount(state) {
  return Object.keys(state.pokedex.caught).length
}

export function seenCount(state) {
  return Object.keys(state.pokedex.seen).length
}

export function addItem(state, itemId, count = 1) {
  if (!getItem(itemId)) return
  state.inventory[itemId] = (state.inventory[itemId] || 0) + count
}

export function removeItem(state, itemId, count = 1) {
  const have = state.inventory[itemId] || 0
  if (have < count) return false
  state.inventory[itemId] = have - count
  if (state.inventory[itemId] <= 0) delete state.inventory[itemId]
  return true
}

export function itemCount(state, itemId) {
  return state.inventory[itemId] || 0
}

export function addMoney(state, amount) {
  state.player.money = Math.max(0, state.player.money + amount)
  if (amount > 0) state.stats.moneyEarned = (state.stats.moneyEarned || 0) + amount
}

export function addTrainerXp(state, amount) {
  const result = { levels: [] }
  state.player.trainerXp += amount
  while (state.player.trainerXp >= trainerXpNeed(state.player.trainerLevel) && state.player.trainerLevel < 30) {
    state.player.trainerXp -= trainerXpNeed(state.player.trainerLevel)
    state.player.trainerLevel++
    result.levels.push(state.player.trainerLevel)
  }
  return result
}

export function trainerProgress(state) {
  const need = trainerXpNeed(state.player.trainerLevel)
  return { current: state.player.trainerXp, need, pct: clamp(state.player.trainerXp / need, 0, 1) }
}

export function trainerTitle(level) {
  if (level >= 22) return 'Myth Walker'
  if (level >= 18) return 'Grand Master'
  if (level >= 14) return 'Elite'
  if (level >= 10) return 'Veteran'
  if (level >= 7) return 'Adept'
  if (level >= 4) return 'Scout'
  if (level >= 2) return 'Journeyman'
  return 'Novice'
}

export function bossCount(state) {
  return Object.values(state.flags.bosses).filter(Boolean).length
}

export function advanceTime(state, minutes) {
  state.time.minutes += minutes
  while (state.time.minutes >= 1440) {
    state.time.minutes -= 1440
    state.time.day++
  }
}

export function recordCatch(state, monster, { night = false } = {}) {
  const sp = getMonster(monster.speciesId)
  state.stats.catches++
  state.stats.catchesByBiome[sp.biome] = (state.stats.catchesByBiome[sp.biome] || 0) + 1
  state.stats.catchesByElement[sp.element] = (state.stats.catchesByElement[sp.element] || 0) + 1
  if (night) state.stats.nightCatches++
  if (sp.legendary) state.stats.legendaryCatches++
  markCaught(state, sp.id)
}

export function recordGather(state, itemId, count = 1) {
  state.stats.gathered[itemId] = (state.stats.gathered[itemId] || 0) + count
}

export function visitBiome(state, biome) {
  state.flags.visited[biome] = true
}

export function saveGame(state) {
  try {
    state.savedAt = Date.now()
    state.version = SAVE_VERSION
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    return true
  } catch (err) {
    console.warn('Save failed', err)
    return false
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return migrate(data)
  } catch (err) {
    console.warn('Load failed', err)
    return null
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY) } catch { return false }
}

export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY) } catch {}
}

function migrate(data) {
  const base = defaultState()
  const merged = deepMerge(base, data)
  merged.version = SAVE_VERSION
  merged.settings = { ...base.settings, ...(data.settings || {}) }
  merged.stats = { ...base.stats, ...(data.stats || {}) }
  merged.flags = { ...base.flags, ...(data.flags || {}) }
  merged.flags.visited = { ...base.flags.visited, ...(data.flags?.visited || {}) }
  merged.quests = data.quests || {}
  merged.party = data.party || []
  merged.storage = data.storage || []
  return merged
}

function deepMerge(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base
  if (typeof base === 'object' && base !== null) {
    const out = { ...base }
    if (extra && typeof extra === 'object') {
      for (const k of Object.keys(extra)) out[k] = deepMerge(base[k], extra[k])
    }
    return out
  }
  return extra !== undefined ? extra : base
}

export function saveSummary() {
  const state = loadGame()
  if (!state) return null
  return {
    name: state.player?.name || 'Wren',
    level: state.player?.trainerLevel || 1,
    party: state.party?.length || 0,
    dex: Object.keys(state.pokedex?.caught || {}).length,
    savedAt: state.savedAt,
    playTime: state.stats?.playTime || 0,
  }
}
