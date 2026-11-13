// Quests & achievements: derived from persistent state, evaluated after every meaningful action.

import { QUESTS, QUEST_LIST, ACHIEVEMENTS } from '../data/quests.js'
import { addItem, addMoney, addTrainerXp, bossCount, caughtCount } from './state.js'

export function questProgress(state, quest) {
  return quest.objectives.map(obj => {
    let current = 0
    switch (obj.type) {
      case 'catch':
        if (obj.biome) current = state.stats.catchesByBiome?.[obj.biome] || 0
        else if (obj.element) current = state.stats.catchesByElement?.[obj.element] || 0
        else current = state.stats.catches || 0
        break
      case 'gather': current = state.stats.gathered?.[obj.item] || 0; break
      case 'craft': current = state.stats.crafts || 0; break
      case 'defeat_trainer': current = state.stats.trainerWins || 0; break
      case 'defeat_boss': current = state.flags.bosses?.[obj.biome] ? 1 : 0; break
      case 'evolve': current = state.stats.evolutions || 0; break
      case 'hatch': current = state.stats.hatched || 0; break
      case 'visit': current = state.flags.visited?.[obj.biome] ? 1 : 0; break
      case 'dex': current = caughtCount(state); break
      case 'defeat_bosses': current = bossCount(state); break
      default: current = 0
    }
    return { ...obj, current: Math.min(current, obj.count || 1), target: obj.count || 1, done: current >= (obj.count || 1) }
  })
}

export function questStatus(state, questId) {
  return state.quests[questId] || null
}

export function questsForNpc(state, npcId) {
  const list = QUEST_LIST.filter(q => q.giver === npcId)
  return list.map(q => {
    const entry = state.quests[q.id]
    const requiresMet = !q.requires || state.quests[q.requires]?.status === 'done'
    const status = entry?.status || (requiresMet ? 'available' : 'locked')
    return { quest: q, status, requiresMet, progress: questProgress(state, q) }
  })
}

export function startQuest(state, questId) {
  const q = QUESTS[questId]
  if (!q || state.quests[questId]) return false
  if (q.requires && state.quests[q.requires]?.status !== 'done') return false
  state.quests[questId] = { status: 'active', startedAt: Date.now() }
  if (!state.trackedQuest) state.trackedQuest = questId
  return true
}

export function evaluateState(state) {
  const readyQuests = []
  for (const [id, entry] of Object.entries(state.quests)) {
    if (entry.status !== 'active') continue
    const q = QUESTS[id]
    if (!q) continue
    const progress = questProgress(state, q)
    if (progress.every(p => p.done)) {
      entry.status = 'ready'
      readyQuests.push(q)
    }
  }
  const newAchievements = []
  for (const ach of Object.values(ACHIEVEMENTS)) {
    if (state.achievements[ach.id]) continue
    if (achievementMet(state, ach.id)) {
      state.achievements[ach.id] = { unlockedAt: Date.now() }
      newAchievements.push(ach)
    }
  }
  return { readyQuests, newAchievements }
}

function achievementMet(state, id) {
  const caught = caughtCount(state)
  const doneQuests = Object.values(state.quests).filter(q => q.status === 'done').length
  const visited = Object.values(state.flags.visited || {}).filter(Boolean).length
  const highestLevel = [...state.party, ...state.storage].reduce((max, m) => Math.max(max, m.level || 0), 0)
  switch (id) {
    case 'first_catch': return state.stats.catches >= 1
    case 'catcher_10': return state.stats.catches >= 10
    case 'catcher_30': return state.stats.catches >= 30
    case 'dex_25': return caught >= 25
    case 'dex_50': return caught >= 50
    case 'dex_87': return caught >= 87
    case 'first_evo': return state.stats.evolutions >= 1
    case 'first_egg': return state.stats.hatched >= 1
    case 'first_boss': return bossCount(state) >= 1
    case 'all_bosses': return bossCount(state) >= 8
    case 'trainer_5': return state.player.trainerLevel >= 5
    case 'trainer_10': return state.player.trainerLevel >= 10
    case 'trainer_20': return state.player.trainerLevel >= 20
    case 'rich': return state.player.money >= 10000
    case 'crafter': return state.stats.crafts >= 10
    case 'quest_5': return doneQuests >= 5
    case 'trainer_10_battles': return state.stats.trainerWins >= 10
    case 'level_50': return highestLevel >= 50
    case 'mythic': return state.stats.legendaryCatches >= 1
    case 'all_biomes': return visited >= 8
    case 'night_owl': return state.stats.nightCatches >= 1
    default:
      if (id.startsWith('boss_')) return !!state.flags.bosses[id.replace('boss_', '')]
      return false
  }
}

export function claimQuest(state, questId) {
  const entry = state.quests[questId]
  const q = QUESTS[questId]
  if (!entry || entry.status !== 'ready' || !q) return null
  entry.status = 'done'
  entry.completedAt = Date.now()
  const rewards = q.rewards || {}
  if (rewards.money) addMoney(state, rewards.money)
  if (rewards.trainerXp) addTrainerXp(state, rewards.trainerXp)
  for (const [item, count] of rewards.items || []) addItem(state, item, count)
  if (state.trackedQuest === questId) {
    state.trackedQuest = Object.entries(state.quests).find(([, e]) => e.status === 'active' || e.status === 'ready')?.[0] || null
  }
  const evalResult = evaluateState(state)
  return { quest: q, rewards, ...evalResult }
}

export function trackedQuestData(state) {
  if (!state.trackedQuest) return null
  const q = QUESTS[state.trackedQuest]
  const entry = state.quests[state.trackedQuest]
  if (!q || !entry) return null
  return { quest: q, status: entry.status, progress: questProgress(state, q) }
}

export function questCounts(state) {
  const values = Object.values(state.quests)
  return {
    active: values.filter(q => q.status === 'active').length,
    ready: values.filter(q => q.status === 'ready').length,
    done: values.filter(q => q.status === 'done').length,
  }
}
