// Inventory actions: field item use, crafting, shop transactions.

import { ITEMS, RECIPES, getItem } from '../data/items.js'
import { getMonster } from '../data/monsters.js'
import { maxHpOf, gainXp, addFriendship, evolutionCandidates, performEvolution } from './monsters.js'
import { addItem, removeItem, itemCount, addMoney } from './state.js'

export function usableInField(itemId) {
  const item = getItem(itemId)
  return ['potion', 'cure', 'revive', 'gift', 'evo'].includes(item.type)
}

export function useFieldItem(state, itemId, targetUid) {
  const item = getItem(itemId)
  const count = itemCount(state, itemId)
  if (count <= 0) return { ok: false, message: 'You have none of those.' }
  const monster = [...state.party, ...state.storage].find(m => m.uid === targetUid)
  if (!monster) return { ok: false, message: 'Choose a monster first.' }

  if (item.type === 'evo') {
    const candidates = evolutionCandidates(monster, { itemId })
    if (!candidates.length) return { ok: false, message: `${monster.nickname} cannot use the ${item.name} right now.` }
    removeItem(state, itemId, 1)
    const evo = candidates[0]
    const result = performEvolution(monster, evo)
    state.stats.evolutions = (state.stats.evolutions || 0) + 1
    return { ok: true, evolution: result, message: `${result.from.name} evolved into ${result.to.name}!` }
  }

  if (monster.isEgg) return { ok: false, message: 'The egg is not ready for that.' }

  switch (item.type) {
    case 'potion': {
      if (monster.hp <= 0) return { ok: false, message: 'Use a Revive Shard on a fainted monster.' }
      if (monster.hp >= maxHpOf(monster) && !item.cure) return { ok: false, message: 'HP is already full.' }
      removeItem(state, itemId, 1)
      const max = maxHpOf(monster)
      monster.hp = item.heal === 'full' ? max : Math.min(max, monster.hp + item.heal)
      if (item.cure) monster.status = null
      return { ok: true, message: `${monster.nickname} recovered.` }
    }
    case 'cure': {
      if (!monster.status) return { ok: false, message: 'Nothing to cure.' }
      if (item.cure && !item.cure.includes(monster.status)) return { ok: false, message: 'That item does not cure this condition.' }
      removeItem(state, itemId, 1)
      monster.status = null
      return { ok: true, message: `${monster.nickname} is cured.` }
    }
    case 'revive': {
      if (monster.hp > 0) return { ok: false, message: 'That monster has not fainted.' }
      removeItem(state, itemId, 1)
      monster.hp = Math.max(1, Math.floor(maxHpOf(monster) * item.revive))
      return { ok: true, message: `${monster.nickname} was revived.` }
    }
    case 'gift': {
      removeItem(state, itemId, 1)
      if (item.friendship) {
        addFriendship(monster, item.friendship)
        return { ok: true, message: `${monster.nickname}'s friendship rose to ${monster.friendship}.` }
      }
      if (item.xp) {
        const res = gainXp(monster, item.xp)
        return { ok: true, message: `${monster.nickname} gained ${item.xp} EXP.`, ...res }
      }
      return { ok: true, message: 'Used.' }
    }
    default:
      return { ok: false, message: 'That item cannot be used here.' }
  }
}

export function craftItem(state, recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId)
  if (!recipe) return { ok: false, message: 'Unknown recipe.' }
  for (const c of recipe.cost) {
    if (itemCount(state, c.item) < c.count) return { ok: false, message: `Need ${c.count}× ${getItem(c.item).name}.` }
  }
  for (const c of recipe.cost) removeItem(state, c.item, c.count)
  addItem(state, recipe.out.item, recipe.out.count)
  state.stats.crafts = (state.stats.crafts || 0) + 1
  return { ok: true, message: `Crafted ${recipe.out.count}× ${getItem(recipe.out.item).name}.` }
}

export function canCraft(state, recipe) {
  return recipe.cost.every(c => itemCount(state, c.item) >= c.count)
}

export function buyItem(state, itemId, count = 1, priceOverride = null) {
  const item = getItem(itemId)
  const price = priceOverride ?? item.price ?? 100
  const total = price * count
  if (state.player.money < total) return { ok: false, message: 'Not enough gold.' }
  addMoney(state, -total)
  addItem(state, itemId, count)
  return { ok: true, message: `Bought ${count}× ${item.name}.` }
}

export function sellItem(state, itemId, count = 1) {
  const item = getItem(itemId)
  if (item.type === 'key') return { ok: false, message: 'That is a key item.' }
  if (!removeItem(state, itemId, count)) return { ok: false, message: 'You do not have that.' }
  const value = Math.max(1, Math.floor((item.price || 10) * 0.5)) * count
  addMoney(state, value)
  return { ok: true, message: `Sold ${count}× ${item.name} for ${value}g.` }
}

export function healAllAtNpc(state) {
  for (const m of state.party) {
    if (m.isEgg) continue
    m.hp = maxHpOf(m); m.status = null; m.statusTurns = 0
  }
  for (const m of state.storage) {
    if (m.isEgg) continue
    m.hp = maxHpOf(m); m.status = null
  }
  return { ok: true, message: 'Your whole team is fully healed.' }
}

export { ITEMS, RECIPES, getItem }
