// Monster instance logic: creation, stats, experience, evolution, eggs, healing.

import { getMonster, MONSTER_LIST, baseSpeciesId } from '../data/monsters.js'
import { getSkill } from '../data/skills.js'
import { getPassive } from '../data/passives.js'
import { PERSONALITIES, PERSONALITY_IDS } from '../data/personalities.js'
import { clamp, uid, pick, randomInt } from '../core/utils.js'

export const MAX_LEVEL = 60
export const MAX_PARTY = 6

export function xpNeed(level) {
  return Math.floor(28 * Math.pow(level, 1.38) + 18)
}

export function trainerXpNeed(level) {
  return Math.floor(120 * Math.pow(level, 1.5))
}

export function statsOf(monster) {
  const sp = getMonster(monster.speciesId)
  const level = monster.level
  const pers = PERSONALITIES[monster.personality] || PERSONALITIES.hardy
  const passive = getPassive(sp.passive)
  const stats = {}
  for (const key of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
    const base = sp.base[key]
    let val = key === 'hp'
      ? Math.floor(base * (level + 10) / 45) + level + 12
      : Math.floor(base * (level + 8) / 50) + 5
    if (key !== 'hp') {
      if (pers.plus === key) val *= 1.1
      if (pers.minus === key) val *= 0.9
      if (passive.kind === 'statBoost' && passive.stat === key) val *= passive.value
    }
    stats[key] = Math.max(1, Math.floor(val))
  }
  return stats
}

export function maxHpOf(monster) {
  return statsOf(monster).hp
}

export function xpProgress(monster) {
  const need = xpNeed(monster.level)
  return { current: monster.xp, need, pct: clamp(monster.xp / need, 0, 1) }
}

function learnsetAt(speciesId, level) {
  const sp = getMonster(speciesId)
  return sp.learnset.filter(([lvl]) => lvl <= level).map(([, id]) => id)
}

function unique(arr) { return [...new Set(arr)] }

export function createMonster(speciesId, level = 5, opts = {}) {
  const sp = getMonster(speciesId)
  const lv = clamp(Math.round(level), 1, MAX_LEVEL)
  const learned = unique([...learnsetAt(speciesId, lv), ...(opts.extraMoves || []), ...(opts.moves || [])])
  let moves = learned.length ? learned : ['tackle']
  const personality = opts.personality || pick(PERSONALITY_IDS)
  const monster = {
    uid: opts.uid || uid('mon'),
    speciesId,
    nickname: opts.nickname || sp.name,
    nicknameCustom: !!opts.nickname,
    level: lv,
    xp: 0,
    personality,
    friendship: opts.friendship ?? 35,
    learned,
    moves,
    status: null,
    statusTurns: 0,
    isEgg: false,
    caughtAt: opts.caughtAt || null,
    caughtBiome: opts.caughtBiome || sp.biome,
    caughtNight: !!opts.caughtNight,
    metLevel: lv,
  }
  monster.hp = maxHpOf(monster)
  return monster
}

export function createEgg(parentA, parentB) {
  const speciesId = baseSpeciesId(parentA.speciesId)
  const sp = getMonster(speciesId)
  const inherited = unique([
    ...parentA.moves.slice(0, 2).filter(id => getSkill(id).power > 0),
    ...parentB.moves.slice(0, 1).filter(id => getSkill(id).power > 0),
  ]).slice(0, 3)
  const egg = {
    uid: uid('egg'),
    speciesId,
    nickname: 'Mystery Egg',
    nicknameCustom: true,
    level: 1,
    xp: 0,
    personality: Math.random() < 0.5 ? parentA.personality : parentB.personality,
    friendship: 60,
    learned: ['tackle', ...inherited],
    moves: ['tackle', ...inherited],
    status: null,
    statusTurns: 0,
    isEgg: true,
    hatchSteps: 120 + Math.max(parentA.level, parentB.level) * 2,
    hatchMax: 120 + Math.max(parentA.level, parentB.level) * 2,
    parentSpecies: [parentA.speciesId, parentB.speciesId],
    caughtAt: null,
    caughtBiome: sp.biome,
  }
  egg.hp = 1
  return egg
}

export function hatchEgg(egg) {
  const sp = getMonster(egg.speciesId)
  const lv = 5
  const learned = unique([...egg.learned, ...learnsetAt(egg.speciesId, lv)])
  const monster = {
    ...egg,
    isEgg: false,
    level: lv,
    nickname: sp.name,
    nicknameCustom: false,
    learned,
    moves: learned,
    hatchSteps: 0,
  }
  monster.hp = maxHpOf(monster)
  return monster
}

export function healMonster(monster) {
  monster.hp = maxHpOf(monster)
  monster.status = null
  monster.statusTurns = 0
}

export function healParty(state) {
  for (const m of state.party) if (!m.isEgg) healMonster(m)
  for (const m of state.storage) if (!m.isEgg) { m.hp = maxHpOf(m); m.status = null }
}

export function syncLearned(monster) {
  monster.moves ||= []
  monster.learned ||= [...monster.moves]
  const known = new Set(monster.learned)
  const newSkills = []
  for (const id of learnsetAt(monster.speciesId, monster.level)) {
    if (!known.has(id)) { known.add(id); monster.learned.push(id); newSkills.push(id) }
  }
  monster.moves = unique([...monster.moves, ...monster.learned])
  return newSkills
}

export function gainXp(monster, amount, opts = {}) {
  if (monster.isEgg) return { levels: [], newSkills: [] }
  monster.moves ||= []
  monster.learned ||= [...monster.moves]
  const result = { levels: [], newSkills: [], xp: amount }
  if (monster.level >= MAX_LEVEL) return result
  monster.xp += amount
  let guard = 0
  while (monster.xp >= xpNeed(monster.level) && monster.level < MAX_LEVEL && guard++ < 30) {
    monster.xp -= xpNeed(monster.level)
    monster.level++
    result.levels.push(monster.level)
    for (const id of syncLearned(monster)) result.newSkills.push({ id })
    monster.hp = Math.min(maxHpOf(monster), monster.hp + Math.floor(maxHpOf(monster) * 0.06))
  }
  if (monster.level >= MAX_LEVEL) monster.xp = 0
  return result
}

export function addFriendship(monster, amount) {
  monster.friendship = clamp(monster.friendship + amount, 0, 100)
}

export function evolutionCandidates(monster, context = {}) {
  if (monster.isEgg) return []
  const sp = getMonster(monster.speciesId)
  return (sp.evolutions || []).filter(evo => {
    if (evo.type === 'item') {
      return context.itemId ? evo.item === context.itemId && monster.level >= (evo.level || 1) : false
    }
    if (monster.level < (evo.level || 1)) return false
    if (evo.type === 'level') return true
    if (evo.type === 'friendship') return monster.friendship >= (evo.friendship ?? 70)
    if (evo.type === 'location') return !!context.biome && context.biome === evo.biome
    return false
  })
}

export function performEvolution(monster, evo) {
  const oldSpecies = getMonster(monster.speciesId)
  const newSpecies = getMonster(evo.to)
  const ratio = monster.hp / Math.max(1, maxHpOf(monster))
  monster.speciesId = evo.to
  if (!monster.nicknameCustom) monster.nickname = newSpecies.name
  monster.friendship = clamp(monster.friendship + 5, 0, 100)
  const newSkills = syncLearned(monster)
  monster.hp = Math.max(1, Math.round(maxHpOf(monster) * Math.min(1, ratio + 0.15)))
  return { from: oldSpecies, to: newSpecies, newSkills }
}

export function evolveMonster(monster, evo, state) {
  const result = performEvolution(monster, evo)
  if (state) {
    state.stats.evolutions = (state.stats.evolutions || 0) + 1
  }
  return result
}

export function knownMovePool(monster) {
  const ids = unique([...(monster.learned || []), ...(monster.moves || [])])
  return (ids.length ? ids : ['tackle']).map(id => getSkill(id))
}

export function partyLead(state) {
  return state.party.find(m => !m.isEgg && m.hp > 0) || state.party.find(m => !m.isEgg) || null
}

export function partyIsWiped(state) {
  return !state.party.some(m => !m.isEgg && m.hp > 0) && state.party.some(m => !m.isEgg)
}

export function speciesFamily(speciesId) {
  const sp = getMonster(speciesId)
  const members = MONSTER_LIST.filter(m => m.id === speciesId || (m.evolutions || []).some(e => e.to === speciesId))
  return { sp, members }
}

export function randomWildStats(speciesId, level) {
  const m = createMonster(speciesId, level)
  m.hp = maxHpOf(m)
  return m
}

export { PERSONALITIES }
