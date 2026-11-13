// Turn-based battle engine. Pure logic + a structured event stream for the UI.

import { getSkill } from '../data/skills.js'
import { getMonster } from '../data/monsters.js'
import { RARITY, STATUS, effectiveness, effectivenessLabel } from '../data/elements.js'
import { getItem, ORB_TIERS } from '../data/items.js'
import { getPassive } from '../data/passives.js'
import { addMonster, addItem, recordCatch } from './state.js'
import { statsOf, maxHpOf, gainXp, evolutionCandidates, addFriendship, performEvolution, createMonster } from './monsters.js'
import { clamp, isNight, pick } from '../core/utils.js'

const STAGE_MULT = [-0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5]
// stages -6..6 → multiplier
function stageMultiplier(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
}

function stageName(stage) {
  if (stage <= -3) return 'harshly fell'
  if (stage < 0) return 'fell'
  if (stage >= 3) return 'sharply rose'
  if (stage > 0) return 'rose'
  return 'did not change'
}

function statusName(id) { return STATUS[id]?.name || id }

export class Battle {
  constructor({ state, enemies, trainer = null, source = { kind: 'wild' }, biome = 'forest' }) {
    this.state = state
    this.enemies = enemies.filter(Boolean)
    this.trainer = trainer
    this.source = source
    this.biome = biome
    this.kind = source.kind
    this.isWild = this.kind === 'wild'
    this.canCapture = this.kind !== 'trainer'
    this.canEscape = this.kind === 'wild'
    this.playerParty = state.party.filter(m => !m.isEgg)
    this.activeIndex = this.playerParty.findIndex(m => m.hp > 0)
    this.enemyIndex = this.enemies.findIndex(m => m.hp > 0)
    this.stages = { player: this.blankStages(), enemy: this.blankStages() }
    this.energy = { player: new Map(), enemy: new Map() }
    for (const m of this.playerParty) this.energy.player.set(m.uid, 100)
    for (const m of this.enemies) this.energy.enemy.set(m.uid, 100)
    this.seeded = { player: false, enemy: false }
    this.turn = 0
    this.over = false
    this.result = null
    this.awaitingSwitch = false
    this.participants = new Set()
    this.events = []
    this.rewards = { money: 0, trainerXp: 0, items: [] }
    this.caughtMonster = null
    this.playerName = state.player.name
    if (this.activeIndex < 0) this.activeIndex = 0
    if (this.enemyIndex < 0) this.enemyIndex = 0
    this.addParticipant()
  }

  blankStages() { return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0 } }

  get active() { return this.playerParty[this.activeIndex] }
  get enemy() { return this.enemies[this.enemyIndex] }
  get activeStats() { return statsOf(this.active) }
  get enemyStats() { return statsOf(this.enemy) }
  get activeEnergy() { return this.energy.player.get(this.active?.uid) ?? 100 }
  set activeEnergy(v) { this.energy.player.set(this.active.uid, clamp(v, 0, 100)) }
  get enemyEnergy() { return this.energy.enemy.get(this.enemy?.uid) ?? 100 }
  set enemyEnergy(v) { this.energy.enemy.set(this.enemy.uid, clamp(v, 0, 100)) }

  log(text) { this.events.push({ type: 'log', text }) }

  hpEvent(side, extra = {}) {
    const m = side === 'player' ? this.active : this.enemy
    this.events.push({ type: 'hp', side, hp: m.hp, maxHp: maxHpOf(m), ...extra })
  }

  start() {
    this.events = []
    const e = this.enemy
    const p = this.active
    if (this.trainer) {
      this.log(`${this.trainer.name} challenges you!`)
      this.log(`${this.trainer.name} sent out ${e.nickname}!`)
    } else if (this.kind === 'boss' || this.kind === 'mythic') {
      this.log(`${this.source.entity?.name || getMonster(e.speciesId).name} blocks your path!`)
    } else {
      this.log(`A wild ${getMonster(e.speciesId).name} appeared!`)
    }
    this.log(`Go, ${p.nickname}!`)
    // on-entry passives
    this.onEntry('enemy', 'player')
    this.onEntry('player', 'enemy')
    return this.events
  }

  onEntry(side, foeSide) {
    const m = side === 'player' ? this.active : this.enemy
    const sp = getMonster(m.speciesId)
    const passive = getPassive(sp.passive)
    if (passive.kind === 'onEntry') {
      this.applyStage(foeSide, passive.stat, passive.stages, `${getMonster(this[foeSide === 'player' ? 'active' : 'enemy'].speciesId).name}`)
      this.log(`${getMonster(m.speciesId).name}'s ${passive.name} ${stageName(passive.stages)} the foe's ${passive.stat.toUpperCase()}!`)
    }
  }

  addParticipant() {
    if (this.active) this.participants.add(this.active.uid)
  }

  stageOf(side, stat) { return this.stages[side][stat] || 0 }

  applyStage(side, stat, stages, label) {
    if (!stat || !(stat in this.stages[side])) return
    this.stages[side][stat] = clamp(this.stages[side][stat] + stages, -6, 6)
  }

  statValue(side, stat) {
    const m = side === 'player' ? this.active : this.enemy
    const stats = statsOf(m)
    let value = stats[stat] || 1
    if (stat !== 'hp') value *= stageMultiplier(this.stageOf(side, stat))
    if (stat === 'atk' && m.status === 'burn') value *= 0.5
    if (stat === 'spe' && m.status === 'paralysis') value *= 0.5
    return Math.max(1, value)
  }

  // ── player actions ────────────────────────────────────────────────────────
  takeTurn(action) {
    if (this.over) return { events: [], over: true, result: this.result }
    if (this.awaitingSwitch) return { events: [], awaitingSwitch: true }
    this.events = []
    this.turn++

    if (action.type === 'switch') return this.doSwitchTurn(action.index)
    if (action.type === 'item') return this.doItemTurn(action)
    if (action.type === 'capture') return this.doCaptureTurn(action)
    if (action.type === 'escape') return this.doEscapeTurn()
    if (action.type === 'move') return this.doMoveTurn(action.index)
    return { events: [], over: false }
  }

  doMoveTurn(index) {
    const playerMove = getSkill(this.active.moves[index] || 'tackle')
    const enemyMove = this.chooseEnemyMove()
    const playerPriority = playerMove.priority || 0
    const enemyPriority = enemyMove.priority || 0
    const playerSpeed = this.statValue('player', 'spe')
    const enemySpeed = this.statValue('enemy', 'spe')
    const playerFirst = playerPriority > enemyPriority || (playerPriority === enemyPriority && (playerSpeed > enemySpeed || (playerSpeed === enemySpeed && Math.random() < 0.5)))

    const order = playerFirst ? ['player', 'enemy'] : ['enemy', 'player']
    for (const side of order) {
      if (this.over) break
      if (side === 'player' && this.active.hp <= 0) continue
      if (side === 'enemy' && this.enemy.hp <= 0) continue
      if (side === 'player') this.useMove('player', index)
      else this.useMove('enemy', enemyMove.index)
      const faints = this.checkFaints()
      if (faints.enemyFainted || faints.playerFainted) break
    }
    if (!this.over) this.endOfTurn()
    return this.finishTurnEvents()
  }

  doSwitchTurn(index) {
    const m = this.playerParty[index]
    if (!m || m.hp <= 0 || index === this.activeIndex) {
      this.log('That monster cannot battle right now.')
      return { events: this.events, over: false, rejected: true }
    }
    this.switchPlayer(index, true)
    const enemyMove = this.chooseEnemyMove()
    if (!this.over) this.useMove('enemy', enemyMove.index)
    this.checkFaints()
    if (!this.over) this.endOfTurn()
    return this.finishTurnEvents()
  }

  doItemTurn(action) {
    const result = this.useBattleItem(action.itemId, action.targetIndex)
    if (result?.fled) return this.finishTurnEvents()
    if (!this.over) {
      const enemyMove = this.chooseEnemyMove()
      this.useMove('enemy', enemyMove.index)
      this.checkFaints()
    }
    if (!this.over) this.endOfTurn()
    return this.finishTurnEvents()
  }

  doCaptureTurn(action) {
    const item = getItem(action.itemId)
    if (!this.canCapture) { this.log('You cannot capture another trainer\'s monster!'); return { events: this.events, over: false, rejected: true } }
    if (item.type !== 'orb') return { events: this.events, over: false, rejected: true }
    if ((this.state.inventory[action.itemId] || 0) <= 0) { this.log(`You are out of ${item.name}.`); return { events: this.events, over: false, rejected: true } }
    // consume
    this.state.inventory[action.itemId]--
    if (this.state.inventory[action.itemId] <= 0) delete this.state.inventory[action.itemId]
    const chance = this.captureChance(action.itemId)
    this.events.push({ type: 'capture-throw', itemId: action.itemId, chance, speciesId: this.enemy.speciesId })
    this.log(`You threw a ${item.name}!`)
    const roll = Math.random()
    const shakes = roll < chance ? 3 : roll < chance * 1.8 ? 2 : roll < chance * 2.8 ? 1 : 0
    this.events.push({ type: 'capture-shake', shakes, chance })
    if (roll < chance) {
      this.log(`${getMonster(this.enemy.speciesId).name} was caught!`)
      const caught = this.enemy
      caught.caughtAt = Date.now()
      caught.caughtBiome = this.biome
      caught.caughtNight = isNight(this.state.time.minutes)
      recordCatch(this.state, caught, { night: caught.caughtNight })
      const toParty = addMonster(this.state, caught)
      this.caughtMonster = caught
      this.rewards.money = 0
      this.events.push({ type: 'captured', monster: caught, toParty, speciesId: caught.speciesId })
      this.result = 'caught'
      this.over = true
      this.state.stats.battles++
      return this.finishTurnEvents()
    }
    this.log('Oh no! The monster broke free!')
    this.events.push({ type: 'capture-fail' })
    const enemyMove = this.chooseEnemyMove()
    if (!this.over) this.useMove('enemy', enemyMove.index)
    this.checkFaints()
    if (!this.over) this.endOfTurn()
    return this.finishTurnEvents()
  }

  doEscapeTurn() {
    if (!this.canEscape) {
      this.log('There is no running from this battle!')
      return { events: this.events, over: false, rejected: true }
    }
    const ps = statsOf(this.active).spe
    const es = statsOf(this.enemy).spe
    const chance = clamp(0.5 + (ps - es) / 160, 0.25, 0.95)
    if (Math.random() < chance) {
      this.log('You got away safely!')
      this.result = 'escaped'
      this.over = true
      this.state.stats.battles++
      this.events.push({ type: 'escaped' })
      return this.finishTurnEvents()
    }
    this.log('You failed to escape!')
    this.events.push({ type: 'escape-fail' })
    const enemyMove = this.chooseEnemyMove()
    this.useMove('enemy', enemyMove.index)
    this.checkFaints()
    if (!this.over) this.endOfTurn()
    return this.finishTurnEvents()
  }

  useBattleItem(itemId, targetIndex) {
    const item = getItem(itemId)
    if ((this.state.inventory[itemId] || 0) <= 0) { this.log(`You have no ${item.name} left.`); return null }
    const target = this.playerParty[targetIndex ?? this.activeIndex]
    if (!target) return null
    if (item.type === 'orb') { this.log('Use the Capture action to throw an orb.'); return null }
    if (item.escape) {
      this.state.inventory[itemId]--
      if (this.state.inventory[itemId] <= 0) delete this.state.inventory[itemId]
      if (!this.canEscape) { this.log('The rope fizzles. This battle cannot be escaped!'); return null }
      this.log('You used an Escape Rope!')
      this.result = 'escaped'; this.over = true; this.state.stats.battles++
      this.events.push({ type: 'escaped' })
      return { fled: true }
    }
    if (item.type === 'potion') {
      if (target.hp <= 0) { this.log(`${target.nickname} has fainted. Use a Revive Shard.`); return null }
      if (target.hp >= maxHpOf(target) && !item.cure) { this.log(`${target.nickname} is already at full HP.`); return null }
      this.state.inventory[itemId]--
      if (this.state.inventory[itemId] <= 0) delete this.state.inventory[itemId]
      const max = maxHpOf(target)
      const before = target.hp
      target.hp = item.heal === 'full' ? max : Math.min(max, target.hp + item.heal)
      if (item.cure) target.status = null
      this.log(`You used ${item.name} on ${target.nickname}.`)
      this.events.push({ type: 'heal-item', side: target === this.active ? 'player' : 'bench', targetUid: target.uid, amount: target.hp - before, hp: target.hp, maxHp: max })
      return { ok: true }
    }
    if (item.type === 'cure') {
      if (!target.status) { this.log('It has no effect.'); return null }
      this.state.inventory[itemId]--
      target.status = null
      this.log(`${target.nickname} was cured of ${item.cure.join(', ')}.`)
      this.events.push({ type: 'status-clear', side: 'player', targetUid: target.uid })
      return { ok: true }
    }
    if (item.type === 'battle' && item.energy) {
      this.state.inventory[itemId]--
      this.energy.player.set(target.uid, clamp((this.energy.player.get(target.uid) ?? 100) + item.energy, 0, 100))
      this.log(`${target.nickname} recovered energy!`)
      this.events.push({ type: 'energy', side: 'player', value: this.energy.player.get(target.uid) })
      return { ok: true }
    }
    if (item.type === 'revive') {
      if (target.hp > 0) { this.log('That monster has not fainted.'); return null }
      this.state.inventory[itemId]--
      target.hp = Math.max(1, Math.floor(maxHpOf(target) * item.revive))
      this.log(`${target.nickname} was revived!`)
      this.events.push({ type: 'revive', targetUid: target.uid, hp: target.hp, maxHp: maxHpOf(target) })
      return { ok: true }
    }
    this.log('That item cannot be used in battle.')
    return null
  }

  // ── move use ──────────────────────────────────────────────────────────────
  useMove(side, moveIndex) {
    const attacker = side === 'player' ? this.active : this.enemy
    const defender = side === 'player' ? this.enemy : this.active
    const skill = getSkill(attacker.moves[moveIndex] || attacker.moves[0] || 'tackle')
    const attackerLabel = side === 'player' ? attacker.nickname : `${getMonster(attacker.speciesId).name}`
    if (attacker.hp <= 0) return

    // status check
    if (this.statusPreventsAction(side)) return

    // energy
    const energy = side === 'player' ? this.activeEnergy : this.enemyEnergy
    let usedSkill = skill
    if (skill.cost > energy) {
      usedSkill = getSkill('tackle')
      this.log(`${attackerLabel} is low on energy and uses Tackle!`)
    } else {
      if (side === 'player') this.activeEnergy = energy - skill.cost
      else this.enemyEnergy = energy - skill.cost
      this.log(`${attackerLabel} used ${skill.name}!`)
    }
    this.events.push({
      type: 'move', side, moveId: usedSkill.id, moveName: usedSkill.name,
      element: usedSkill.element, energy: side === 'player' ? this.activeEnergy : this.enemyEnergy,
    })

    // status moves
    if (usedSkill.category === 'status') {
      const accStage = this.stageOf(side, 'acc')
      const accuracy = clamp((usedSkill.accuracy || 100) * stageMultiplier(accStage) / 100, 0.05, 1)
      if (Math.random() > accuracy) {
        this.log(`${defender.nickname} avoided the attack!`)
        this.events.push({ type: 'miss', side: side === 'player' ? 'enemy' : 'player' })
        return
      }
      this.applySkillEffect(side, usedSkill, true)
      return
    }

    // accuracy
    const accStage = this.stageOf(side, 'acc')
    const accuracy = clamp((usedSkill.accuracy || 100) * stageMultiplier(accStage) / 100, 0.05, 1)
    if (Math.random() > accuracy) {
      this.log(`${defender.nickname} avoided the attack!`)
      this.events.push({ type: 'miss', side: side === 'player' ? 'enemy' : 'player' })
      return
    }

    const hits = usedSkill.multi || 1
    for (let i = 0; i < hits; i++) {
      const res = this.calculateDamage(side, usedSkill)
      if (res.immune) {
        this.log(`${getMonster(defender.speciesId).name} is immune to ${usedSkill.element} attacks!`)
        this.events.push({ type: 'immune', side: side === 'player' ? 'enemy' : 'player' })
        return
      }
      defender.hp = Math.max(0, defender.hp - res.damage)
      const effLabel = effectivenessLabel(res.effectiveness)
      this.events.push({
        type: 'damage', side: side === 'player' ? 'enemy' : 'player',
        amount: res.damage, crit: res.crit, effectiveness: res.effectiveness,
        hp: defender.hp, maxHp: maxHpOf(defender), element: usedSkill.element,
        effLabel: effLabel?.text || null,
      })
      if (res.crit) this.log('A critical hit!')
      if (effLabel) this.log(effLabel.text)
      if (usedSkill.drain && res.damage > 0) {
        const heal = Math.max(1, Math.floor(res.damage * usedSkill.drain))
        attacker.hp = Math.min(maxHpOf(attacker), attacker.hp + heal)
        this.log(`${attackerLabel} drained ${heal} HP!`)
      }
      if (defender.hp <= 0) break
    }

    // secondary effects
    this.applySkillEffect(side, usedSkill, false)

    // recoil
    if (usedSkill.recoil && attacker.hp > 0) {
      const recoil = Math.max(1, Math.floor(attacker.hp * usedSkill.recoil))
      attacker.hp = Math.max(0, attacker.hp - recoil)
      this.log(`${attackerLabel} is hurt by recoil!`)
    }

    // contact passive
    if (usedSkill.category === 'physical' && defender.hp > 0 && attacker.hp > 0) {
      const defSp = getMonster(defender.speciesId)
      const passive = getPassive(defSp.passive)
      if (passive.kind === 'contactStatus' && !attacker.status && Math.random() * 100 < passive.chance) {
        this.applyStatus(side, passive.status)
      }
    }
  }

  applySkillEffect(side, skill, isStatusMove) {
    const attacker = side === 'player' ? this.active : this.enemy
    const defender = side === 'player' ? this.enemy : this.active
    const foeSide = side === 'player' ? 'enemy' : 'player'
    // stat changes
    if (skill.stat) {
      const effects = Array.isArray(skill.stat) ? skill.stat : [skill.stat]
      for (const eff of effects) {
        const targetSide = eff.target === 'self' ? side : foeSide
        this.applyStage(targetSide, eff.stat, eff.stages)
        const who = targetSide === 'player' ? this.active.nickname : getMonster(this.enemy.speciesId).name
        this.log(`${who}'s ${eff.stat.toUpperCase()} ${stageName(eff.stages)}!`)
        this.events.push({ type: 'stage', side: targetSide, stat: eff.stat, stages: this.stageOf(targetSide, eff.stat) })
      }
    }
    if (skill.heal) {
      const max = maxHpOf(attacker)
      const heal = Math.floor(max * skill.heal)
      attacker.hp = Math.min(max, attacker.hp + heal)
      if (skill.cure) attacker.status = null
      this.log(`${attacker.nickname} restored ${heal} HP!`)
      this.events.push({ type: 'heal', side, amount: heal, hp: attacker.hp, maxHp: max })
      if (skill.partyHeal) {
        for (const m of this.playerParty) {
          if (m.uid === attacker.uid || m.hp <= 0) continue
          m.hp = Math.min(maxHpOf(m), m.hp + Math.floor(maxHpOf(m) * skill.heal))
        }
      }
    }
    if (skill.selfStatus) {
      this.applyStatus(side, skill.selfStatus)
    }
    if (skill.seed) {
      this.seeded[foeSide] = true
      this.log(`${getMonster(defender.speciesId).name} was seeded!`)
      this.events.push({ type: 'seed', side: foeSide })
    }
    if (skill.status && skill.status.chance > 0) {
      if (isStatusMove || Math.random() * 100 < skill.status.chance) {
        if (defender.hp > 0 && !defender.status) this.applyStatus(foeSide, skill.status.id)
      }
    }
  }

  applyStatus(side, statusId) {
    const target = side === 'player' ? this.active : this.enemy
    if (target.status) return false
    if (side === 'player' && statusId === 'burn' && target.speciesId && getMonster(target.speciesId).element === 'flame') return false
    target.status = statusId
    target.statusTurns = statusId === 'sleep' ? 2 + Math.floor(Math.random() * 2) : statusId === 'freeze' ? 2 : 99
    this.log(`${target.nickname} is ${statusId === 'paralysis' ? 'paralyzed' : statusId === 'burn' ? 'burned' : statusId === 'freeze' ? 'frozen' : statusId === 'sleep' ? 'asleep' : 'poisoned'}!`)
    this.events.push({ type: 'status', side, status: statusId, label: statusName(statusId) })
    return true
  }

  statusPreventsAction(side) {
    const m = side === 'player' ? this.active : this.enemy
    if (!m.status) return false
    if (m.status === 'sleep') {
      m.statusTurns--
      if (m.statusTurns <= 0) {
        m.status = null
        this.log(`${m.nickname} woke up!`)
        this.events.push({ type: 'status-clear', side })
        return false
      }
      this.log(`${m.nickname} is fast asleep.`)
      this.events.push({ type: 'skip', side, reason: 'sleep' })
      return true
    }
    if (m.status === 'freeze') {
      if (Math.random() < 0.35 || m.statusTurns-- <= 0) {
        m.status = null
        this.log(`${m.nickname} thawed out!`)
        this.events.push({ type: 'status-clear', side })
        return false
      }
      this.log(`${m.nickname} is frozen solid!`)
      this.events.push({ type: 'skip', side, reason: 'freeze' })
      return true
    }
    if (m.status === 'paralysis' && Math.random() < 0.25) {
      this.log(`${m.nickname} is paralyzed and cannot move!`)
      this.events.push({ type: 'skip', side, reason: 'paralysis' })
      return true
    }
    return false
  }

  calculateDamage(side, skill) {
    const attacker = side === 'player' ? this.active : this.enemy
    const defender = side === 'player' ? this.enemy : this.active
    const defenderSp = getMonster(defender.speciesId)
    const defenderPassive = getPassive(defenderSp.passive)
    if (defenderPassive.kind === 'immuneElement' && defenderPassive.element === skill.element) {
      return { damage: 0, effectiveness: 1, crit: false, immune: true }
    }
    const atkStat = skill.category === 'physical' ? 'atk' : 'spa'
    const defStat = skill.category === 'physical' ? 'def' : 'spd'
    const A = this.statValue(side, atkStat)
    const D = this.statValue(side === 'player' ? 'enemy' : 'player', defStat)
    const eff = effectiveness(skill.element, defenderSp.element)
    const critChance = 0.0625 + (skill.crit || 0) + (getPassive(getMonster(attacker.speciesId).passive).kind === 'critBoost' ? 0.12 : 0)
    const crit = Math.random() < critChance
    let mult = eff * (crit ? 1.5 : 1) * (0.88 + Math.random() * 0.12)
    // attacker passives
    const atkSp = getMonster(attacker.speciesId)
    const atkPassive = getPassive(atkSp.passive)
    const hpRatio = attacker.hp / maxHpOf(attacker)
    const night = isNight(this.state.time.minutes)
    if (atkPassive.kind === 'lowHpBoost' && atkPassive.element === skill.element && hpRatio < 1 / 3) mult *= atkPassive.value
    if (atkPassive.kind === 'elementBoost' && atkPassive.element === skill.element) mult *= atkPassive.value
    if (atkPassive.kind === 'nightBoost' && night) mult *= atkPassive.value
    if (atkPassive.kind === 'dayBoost' && !night) mult *= atkPassive.value
    if (atkPassive.kind === 'finisher' && defender.hp / maxHpOf(defender) < 0.5) mult *= atkPassive.value
    // defender passives
    if (defenderPassive.kind === 'damageReduce' && defenderPassive.category === skill.category) mult *= defenderPassive.value
    if (defenderPassive.kind === 'elementReduce' && defenderPassive.element === skill.element) mult *= defenderPassive.value
    const base = (((2 * attacker.level / 5 + 2) * skill.power * A / Math.max(1, D)) / 50 + 2)
    let damage = Math.max(1, Math.round(base * mult))
    if (damage >= defender.hp && defenderPassive.kind === 'sturdy' && defender.hp === maxHpOf(defender)) damage = defender.hp - 1
    return { damage: Math.max(0, damage), effectiveness: eff, crit, immune: false }
  }

  chooseEnemyMove() {
    const moves = this.enemy.moves.map((id, index) => ({ skill: getSkill(id), index }))
    const usable = moves.filter(m => m.skill.cost <= this.enemyEnergy)
    const pool = usable.length ? usable : [{ skill: getSkill('tackle'), index: -1 }]
    const enemyStats = statsOf(this.enemy)
    let best = pool[0], bestScore = -Infinity
    for (const m of pool) {
      const skill = m.skill
      let score = Math.random() * 12
      if (skill.category === 'status') {
        if (skill.heal && this.enemy.hp / maxHpOf(this.enemy) < 0.45) score += 45
        else if (skill.stat) {
          const side = this.enemy
          score += 10
        } else if (skill.status && !this.active.status) score += 22
        else score -= 20
      } else {
        const eff = effectiveness(skill.element, getMonster(this.active.speciesId).element)
        score += skill.power * eff * 0.6
        if (eff >= 2) score += 28
        if (this.active.hp / maxHpOf(this.active) < 0.3) score += 12
        if (skill.status && !this.active.status) score += 10
      }
      if (this.trainer) score *= 1.08
      if (score > bestScore) { bestScore = score; best = m }
    }
    return { index: best.index < 0 ? 0 : best.index, skill: best.skill }
  }

  endOfTurn() {
    for (const side of ['player', 'enemy']) {
      const m = side === 'player' ? this.active : this.enemy
      if (!m || m.hp <= 0) continue
      const max = maxHpOf(m)
      // energy regen
      const eMap = side === 'player' ? this.energy.player : this.energy.enemy
      const current = eMap.get(m.uid) ?? 100
      eMap.set(m.uid, clamp(current + 8, 0, 100))
      if (side === 'player') this.events.push({ type: 'energy', side, value: eMap.get(m.uid) })
      // status tick
      if (m.status === 'burn' || m.status === 'poison') {
        const tick = Math.max(1, Math.floor(max * (STATUS[m.status].tick)))
        m.hp = Math.max(0, m.hp - tick)
        this.log(`${m.nickname} is hurt by ${statusName(m.status)}!`)
        this.events.push({ type: 'damage', side, amount: tick, hp: m.hp, maxHp: max, statusTick: m.status })
      }
      // seeded
      if (this.seeded[side]) {
        const drain = Math.max(1, Math.floor(max / 8))
        m.hp = Math.max(0, m.hp - drain)
        const other = side === 'player' ? this.enemy : this.active
        if (other.hp > 0) other.hp = Math.min(maxHpOf(other), other.hp + drain)
        this.log(`${m.nickname}'s life is drained by the seed!`)
        this.events.push({ type: 'damage', side, amount: drain, hp: m.hp, maxHp: max, seeded: true })
      }
      // passive healing
      const passive = getPassive(getMonster(m.speciesId).passive)
      const night = isNight(this.state.time.minutes)
      let heal = 0
      if (passive.kind === 'healPerTurn') heal = Math.floor(max * passive.value)
      if (passive.kind === 'dayHeal' && !night) heal = Math.max(heal, Math.floor(max * passive.value))
      if (heal > 0 && m.hp > 0) {
        m.hp = Math.min(max, m.hp + heal)
        this.events.push({ type: 'heal', side, amount: heal, hp: m.hp, maxHp: max, passiveHeal: true })
      }
      if (m.hp > 0 && m.status === 'sleep' && m.statusTurns > 0) m.statusTurns++
    }
    this.checkFaints(true)
  }

  checkFaints(silent = false) {
    let enemyFainted = false, playerFainted = false
    if (this.enemy.hp <= 0) {
      enemyFainted = true
      this.events.push({ type: 'faint', side: 'enemy' })
      this.log(`${getMonster(this.enemy.speciesId).name} fainted!`)
      const next = this.enemies.findIndex((m, i) => m.hp > 0 && i !== this.enemyIndex)
      if (next >= 0) {
        this.enemyIndex = next
        this.stages.enemy = this.blankStages()
        this.seeded.enemy = false
        this.events.push({ type: 'enemy-switch', name: this.enemy.nickname, speciesId: this.enemy.speciesId, level: this.enemy.level, hp: this.enemy.hp, maxHp: maxHpOf(this.enemy) })
        this.log(`${this.trainer?.name || 'Foe'} sent out ${this.enemy.nickname}!`)
        this.onEntry('enemy', 'player')
      } else if (!this.over) {
        this.finishVictory()
      }
    }
    if (this.active.hp <= 0 && !this.over) {
      playerFainted = true
      this.events.push({ type: 'faint', side: 'player' })
      this.log(`${this.active.nickname} fainted!`)
      const anyAlive = this.playerParty.some(m => m.hp > 0)
      if (anyAlive) {
        this.awaitingSwitch = true
        this.events.push({ type: 'awaiting-switch' })
      } else {
        this.finishDefeat()
      }
    }
    return { enemyFainted, playerFainted }
  }

  finishVictory() {
    this.over = true
    this.result = 'win'
    const enemies = this.enemies
    const maxLevel = Math.max(...enemies.map(m => m.level))
    const totalBase = enemies.reduce((sum, e) => {
      const sp = getMonster(e.speciesId)
      return sum + Math.floor(10 * e.level * (RARITY[sp.rarity]?.xp || 1))
    }, 0)
    const factor = this.trainer ? 1.35 : this.kind === 'boss' || this.kind === 'mythic' ? 2.4 : 1
    const baseXp = Math.floor(totalBase * factor)
    this.log(`You won the battle!`)
    this.events.push({ type: 'victory' })
    const levelUps = []
    for (const m of this.playerParty) {
      if (m.isEgg) continue
      const share = this.participants.has(m.uid) ? 1 : 0.45
      const gain = Math.max(1, Math.floor(baseXp * share))
      const before = m.level
      const res = gainXp(m, gain)
      addFriendship(m, 2)
      this.events.push({ type: 'xp', uid: m.uid, name: m.nickname, amount: gain, monster: m, levels: res.levels })
      for (const lv of res.levels) this.log(`${m.nickname} grew to Lv.${lv}!`)
      for (const s of res.newSkills) this.log(`${m.nickname} learned ${getSkill(s.id).name}!`)
      if (res.levels.length) levelUps.push({ monster: m, from: before, to: m.level, skills: res.newSkills })
    }
    const xp = baseXp
    if (this.trainer) {
      this.rewards.money = this.trainer.reward || 300
      this.rewards.trainerXp = 60 + maxLevel * 9
      this.rewards.trainerId = this.trainer.npcId
      this.log(`You earned ${this.rewards.money} gold!`)
    } else {
      this.rewards.money = Math.floor(20 + maxLevel * 5 + (this.kind === 'boss' ? 600 : this.kind === 'mythic' ? 900 : 0))
      this.rewards.trainerXp = 15 + maxLevel * 3
      if (this.kind === 'boss') this.rewards.items.push(['golden_orb', 2])
      if (this.kind === 'mythic') this.rewards.items.push(['astral_orb', 2], ['stardust', 3])
      this.log(`You found ${this.rewards.money} gold.`)
    }
    // evolution opportunities (location-aware for the current biome)
    const evolutions = []
    for (const m of [...this.playerParty, ...this.state.storage]) {
      if (m.isEgg || m.hp <= 0) continue
      const candidates = evolutionCandidates(m, { biome: this.biome })
      for (const evo of candidates) evolutions.push({ monster: m, evo })
    }
    this.levelUps = levelUps
    this.evolutions = evolutions
    this.state.stats.battles++
    this.state.stats.wins++
    if (this.trainer) this.state.stats.trainerWins++
    if (this.kind === 'boss' || this.kind === 'mythic') this.state.stats.bosses++
    if (getPassive(getMonster(this.active.speciesId).passive).kind === 'moneyBoost') {
      this.rewards.money = Math.floor(this.rewards.money * 1.25)
    }
    this.events.push({ type: 'battle-end', result: 'win', rewards: this.rewards, xp, levelUps, evolutions })
  }

  finishDefeat() {
    this.over = true
    this.result = 'lose'
    this.log('All your monsters have fainted…')
    this.events.push({ type: 'defeat' })
    this.state.stats.battles++
    this.events.push({ type: 'battle-end', result: 'lose', rewards: { money: 0, trainerXp: 0, items: [] } })
  }

  finishTurnEvents() {
    if (this.result === 'caught' || this.result === 'escaped') {
      this.events.push({ type: 'battle-end', result: this.result, rewards: this.rewards, caught: this.caughtMonster })
    }
    return {
      events: this.events,
      over: this.over,
      result: this.result,
      awaitingSwitch: this.awaitingSwitch,
      rewards: this.rewards,
      levelUps: this.levelUps || [],
      evolutions: this.evolutions || [],
      caught: this.caughtMonster,
    }
  }

  // ── switching / post-battle ───────────────────────────────────────────────
  switchPlayer(index, voluntary = false) {
    const m = this.playerParty[index]
    if (!m || m.hp <= 0) return false
    if (voluntary) this.log(`Come back, ${this.active.nickname}!`)
    this.activeIndex = index
    this.stages.player = this.blankStages()
    this.seeded.player = false
    this.addParticipant()
    if (!this.energy.player.has(m.uid)) this.energy.player.set(m.uid, 100)
    this.events.push({ type: 'player-switch', name: m.nickname, speciesId: m.speciesId, level: m.level, hp: m.hp, maxHp: maxHpOf(m) })
    this.log(`Go, ${m.nickname}!`)
    this.onEntry('player', 'enemy')
    return true
  }

  forceSwitch(index) {
    if (!this.awaitingSwitch) return { events: [] }
    this.events = []
    const ok = this.switchPlayer(index)
    if (!ok) return { events: [{ type: 'log', text: 'That monster cannot battle.' }], awaitingSwitch: true }
    this.awaitingSwitch = false
    return this.finishTurnEvents()
  }

  captureChance(itemId) {
    const item = getItem(itemId)
    if (!item || item.type !== 'orb') return 0
    const sp = getMonster(this.enemy.speciesId)
    const base = sp.catchRate ?? RARITY[sp.rarity]?.catch ?? 0.4
    const max = maxHpOf(this.enemy)
    const hpRatio = this.enemy.hp / max
    const hpFactor = 0.3 + 0.7 * (1 - hpRatio)
    const statusBonus = this.enemy.status ? (STATUS[this.enemy.status]?.capture || 1) : 1
    const levelAvg = this.playerParty.reduce((s, m) => s + m.level, 0) / Math.max(1, this.playerParty.length)
    const levelFactor = clamp(1.08 - (this.enemy.level - levelAvg) * 0.012, 0.68, 1.28)
    return clamp(base * hpFactor * statusBonus * item.mult * levelFactor, 0.02, 0.96)
  }

  captureOptions() {
    return ORB_TIERS.filter(id => (this.state.inventory[id] || 0) > 0).map(id => ({
      id, count: this.state.inventory[id], chance: this.captureChance(id), item: getItem(id),
    }))
  }

  enemyLabel() { return this.enemy ? getMonster(this.enemy.speciesId).name : '—' }

  applyEvolution(monster, evo) {
    return performEvolution(monster, evo)
  }
}

export function trainerEnemies(trainer) {
  return trainer.team.map(([species, level]) => createMonster(species, level))
}
