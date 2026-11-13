// Battle presentation layer. The engine in game/battle.js owns all rules; this
// module renders the arena, plays the event stream and feeds player choices back.

import { el, button, toast, elementBadge, rarityBadge, statusBadge } from './common.js'
import { getMonster } from '../data/monsters.js'
import { getSkill } from '../data/skills.js'
import { ELEMENTS, STATUS } from '../data/elements.js'
import { getItem } from '../data/items.js'
import { maxHpOf } from '../game/monsters.js'
import { Battle, trainerEnemies } from '../game/battle.js'
import { BIOMES } from '../data/biomes.js'
import { monsterSprite } from '../render/sprites.js'

const KIND_LABEL = {
  wild: 'Wild Encounter',
  trainer: 'Trainer Battle',
  boss: 'Guardian Battle',
  mythic: 'Mythic Encounter',
}

function spriteUrl(speciesId, opts = {}) {
  return monsterSprite(speciesId, opts).toDataURL()
}

export class BattleUI {
  constructor(app, config) {
    this.app = app
    this.config = config
    this.battle = new Battle(config)
    this.kind = config.source?.kind || 'wild'
    this.biome = BIOMES[config.biome] || BIOMES.forest
    this.busy = true
    this.destroyed = false
    this.actionMode = 'moves'
    this.needSwitch = false
    this.resultShown = false
    this.pendingItem = null
    this.orbEl = null
    this.fxLayer = null
    this.enemySpriteId = null
    this.playerSpriteId = null
    this.endPayload = null
    this.root = document.getElementById('battle-layer')
    this.root.innerHTML = ''
    this.build()
    this.sync()
    this.renderActions()
    // Let the entrance animation breathe before the first log line.
    setTimeout(() => {
      if (!this.destroyed) this.play(this.battle.start())
    }, 320)
  }

  build() {
    this.overlay = el('div', {
      class: 'battle-overlay',
      style: {
        '--battle-sky': this.biome.palette.ground,
        '--battle-ground': this.biome.palette.ground2,
        '--battle-accent': this.biome.hue,
      },
    })

    this.kindEl = el('div', { class: 'battle-kind' }, [
      el('span', { class: 'kind-glyph' }, this.kind === 'trainer' ? '⚔' : this.kind === 'boss' ? '♛' : this.kind === 'mythic' ? '✧' : '◉'),
      el('span', {}, KIND_LABEL[this.kind] || 'Battle'),
      el('span', { class: 'muted' }, `· ${this.biome.name}`),
    ])
    this.turnEl = el('div', { class: 'battle-turn' }, [el('strong', {}, 'Turn 1')])
    const top = el('div', { class: 'battle-top' }, [this.kindEl, this.turnEl])

    // Enemy card
    this.enemyName = el('strong', {}, '—')
    this.enemyLv = el('span', { class: 'battle-lv' }, 'Lv.1')
    this.enemyHpFill = el('div', { class: 'battle-hp-fill' })
    this.enemyHpText = el('span', {}, '')
    this.enemyHpMax = el('span', {}, '')
    this.enemyMeta = el('div', { class: 'battle-meta' })
    const enemyCard = el('div', { class: 'battle-card enemy-card' }, [
      el('div', { class: 'battle-name-row' }, [this.enemyName, this.enemyLv]),
      el('div', { class: 'battle-hp' }, [
        el('div', { class: 'battle-hp-track' }, [this.enemyHpFill]),
        el('div', { class: 'battle-hp-text' }, [this.enemyHpText, this.enemyHpMax]),
      ]),
      this.enemyMeta,
    ])

    // Player card
    this.playerName = el('strong', {}, '—')
    this.playerLv = el('span', { class: 'battle-lv' }, 'Lv.1')
    this.playerHpFill = el('div', { class: 'battle-hp-fill' })
    this.playerHpText = el('span', {}, '')
    this.playerHpMax = el('span', {}, '')
    this.playerMeta = el('div', { class: 'battle-meta' })
    this.playerEnergyFill = el('div', { class: 'battle-energy-fill' })
    this.playerEnergyText = el('span', {}, '100')
    const playerCard = el('div', { class: 'battle-card player-card' }, [
      el('div', { class: 'battle-name-row' }, [this.playerName, this.playerLv]),
      el('div', { class: 'battle-hp' }, [
        el('div', { class: 'battle-hp-track' }, [this.playerHpFill]),
        el('div', { class: 'battle-hp-text' }, [this.playerHpText, this.playerHpMax]),
      ]),
      this.playerMeta,
      el('div', { class: 'battle-energy' }, [
        el('span', {}, 'ENERGY'),
        el('div', { class: 'battle-energy-track' }, [this.playerEnergyFill]),
        this.playerEnergyText,
      ]),
    ])

    // Combatants
    this.enemyImg = el('img', { class: 'pixel-sprite', alt: '' })
    this.playerImg = el('img', { class: 'pixel-sprite', alt: '' })
    this.enemyPlate = el('div', { class: 'combatant-nameplate' }, 'WILD')
    this.playerPlate = el('div', { class: 'combatant-nameplate' }, 'PARTNER')
    this.enemyCombatant = el('div', { class: 'combatant enemy-combatant' }, [this.enemyImg, this.enemyPlate])
    this.playerCombatant = el('div', { class: 'combatant player-combatant' }, [this.playerImg, this.playerPlate])

    this.fxLayer = el('div', { class: 'battle-fx-layer' })
    const stage = el('div', { class: 'battle-stage' }, [
      el('div', { class: 'battle-ground' }),
      el('div', { class: 'battle-horizon' }),
      el('div', { class: 'battle-platform enemy' }),
      el('div', { class: 'battle-platform player' }),
      enemyCard,
      playerCard,
      this.enemyCombatant,
      this.playerCombatant,
      this.fxLayer,
    ])

    // Console + action panel
    this.messageEl = el('div', { class: 'battle-message' }, [el('span', { class: 'msg-tag' }, 'BATTLE'), el('span', {}, 'The air sharpens…')])
    this.logEl = el('div', { class: 'battle-log' })
    this.toolbar = el('div', { class: 'battle-toolbar' })
    this.panelEl = el('div', { class: 'battle-panel' })
    const lower = el('div', { class: 'battle-lower' }, [
      el('div', { class: 'battle-console' }, [this.messageEl, this.logEl]),
      el('div', { class: 'battle-actions' }, [this.toolbar, this.panelEl]),
    ])

    this.overlay.append(top, stage, lower)
    this.root.append(this.overlay)
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  sync() {
    const b = this.battle
    const enemy = b.enemy
    const active = b.active
    if (!enemy || !active) return

    if (this.enemySpriteId !== enemy.speciesId) {
      this.enemySpriteId = enemy.speciesId
      this.enemyImg.src = spriteUrl(enemy.speciesId)
      this.enemyImg.alt = getMonster(enemy.speciesId).name
      this.enemyCombatant.classList.add('entering')
      setTimeout(() => this.enemyCombatant.classList.remove('entering'), 400)
    }
    if (this.playerSpriteId !== active.speciesId) {
      this.playerSpriteId = active.speciesId
      this.playerImg.src = spriteUrl(active.speciesId)
      this.playerImg.alt = active.nickname
      this.playerCombatant.classList.add('entering')
      setTimeout(() => this.playerCombatant.classList.remove('entering'), 400)
    }

    const eSp = getMonster(enemy.speciesId)
    const pSp = getMonster(active.speciesId)
    const eMax = maxHpOf(enemy)
    const pMax = maxHpOf(active)

    this.enemyName.textContent = enemy.nickname || eSp.name
    this.enemyLv.textContent = `Lv.${enemy.level}`
    this.enemyHpText.textContent = `${Math.max(0, Math.ceil(enemy.hp))} / ${eMax}`
    this.enemyHpMax.textContent = 'HP'
    this.enemyHpFill.style.width = `${Math.max(0, enemy.hp / Math.max(1, eMax)) * 100}%`
    this.enemyHpFill.className = `battle-hp-fill ${enemy.hp / eMax < 0.22 ? 'bad' : enemy.hp / eMax < 0.5 ? 'warn' : ''}`
    this.enemyMeta.innerHTML = ''
    this.enemyMeta.append(elementBadge(eSp.element, true), rarityBadge(eSp.rarity))
    if (enemy.status) this.enemyMeta.append(statusBadge(enemy.status))

    this.playerName.textContent = active.nickname
    this.playerLv.textContent = `Lv.${active.level}`
    this.playerHpText.textContent = `${Math.max(0, Math.ceil(active.hp))} / ${pMax}`
    this.playerHpMax.textContent = 'HP'
    this.playerHpFill.style.width = `${Math.max(0, active.hp / Math.max(1, pMax)) * 100}%`
    this.playerHpFill.className = `battle-hp-fill ${active.hp / pMax < 0.22 ? 'bad' : active.hp / pMax < 0.5 ? 'warn' : ''}`
    this.playerMeta.innerHTML = ''
    this.playerMeta.append(elementBadge(pSp.element, true))
    if (active.status) this.playerMeta.append(statusBadge(active.status))

    const energy = b.activeEnergy
    this.playerEnergyFill.style.width = `${energy}%`
    this.playerEnergyText.textContent = String(Math.round(energy))
    this.playerEnergyFill.style.background = energy < 20 ? 'linear-gradient(90deg,#c25a5a,#ffb08a)' : ''

    this.enemyPlate.textContent = enemy.nickname || eSp.name
    this.playerPlate.textContent = `${active.nickname} · ${active.level}`

    this.enemyCombatant.classList.toggle('fainted', enemy.hp <= 0)
    this.playerCombatant.classList.toggle('fainted', active.hp <= 0)
    this.turnEl.innerHTML = `<strong>Turn ${Math.max(1, b.turn)}</strong>`
  }

  setMessage(text) {
    this.messageEl.innerHTML = ''
    this.messageEl.append(el('span', { class: 'msg-tag' }, 'BATTLE'), el('span', {}, text))
  }

  appendLog(text) {
    this.logEl.append(el('div', {}, text))
    while (this.logEl.childElementCount > 5) this.logEl.firstElementChild.remove()
  }

  // ── action panels ─────────────────────────────────────────────────────────
  renderActions() {
    if (this.destroyed) return
    if (this.resultShown) return
    this.toolbar.innerHTML = ''
    const activeMode = this.actionMode
    const makeTab = (label, mode, icon = '') => {
      const b = button(label, () => {
        if (this.busy) return
        this.actionMode = mode
        this.renderActions()
      }, { variant: activeMode === mode ? 'primary' : 'ghost', className: 'small', icon, disabled: this.busy || this.needSwitch })
      this.toolbar.append(b)
    }
    if (this.needSwitch) {
      this.toolbar.append(el('span', { class: 'small-note' }, 'Choose your next monster.'))
    } else {
      makeTab('Fight', 'moves', '⚔')
      makeTab('Bag', 'bag', '◈')
      makeTab('Party', 'party', '◉')
      if (this.battle.canCapture) makeTab('Catch', 'capture', '◌')
      if (this.battle.canEscape) makeTab('Run', 'run', '➜')
    }
    this.renderPanel()
  }

  renderPanel() {
    this.panelEl.innerHTML = ''
    if (this.resultShown) return
    if (this.busy) {
      this.panelEl.append(el('div', { class: 'small-note' }, 'Resolving turn…'))
      return
    }
    if (this.needSwitch) { this.renderPartyPanel(true); return }
    if (this.actionMode === 'bag') { this.renderBagPanel(); return }
    if (this.actionMode === 'party') { this.renderPartyPanel(false); return }
    if (this.actionMode === 'capture') { this.renderCapturePanel(); return }
    if (this.actionMode === 'bag-target') { this.renderPartyPanel(false, true); return }
    if (this.actionMode === 'run') {
      this.panelEl.append(el('div', { class: 'small-note' }, 'Running costs your turn — but a wild monster may let you slip away.'))
      this.panelEl.append(button('Try to run', () => this.doAction({ type: 'escape' }), { variant: 'ghost', icon: '➜' }))
      return
    }
    this.renderMovePanel()
  }

  renderMovePanel() {
    const b = this.battle
    const active = b.active
    const grid = el('div', { class: 'battle-move-grid' })
    active.moves.forEach((id, index) => {
      const skill = getSkill(id)
      const e = ELEMENTS[skill.element] || ELEMENTS.none
      const low = skill.cost > b.activeEnergy
      const btn = el('button', {
        class: `move-btn ${low ? 'low-energy' : ''}`,
        onclick: () => this.doAction({ type: 'move', index }),
        title: skill.description,
      }, [
        el('span', { class: 'move-icon', style: { background: e.dark, color: e.color } }, e.glyph),
        el('span', { class: 'move-btn-copy' }, [
          el('strong', {}, skill.name),
          el('span', {}, skill.power ? `${skill.category === 'physical' ? 'PHYS' : skill.category === 'special' ? 'SPEC' : 'STATUS'} · PWR ${skill.power}` : 'STATUS'),
        ]),
        el('span', { class: 'move-btn-cost' }, low ? `TACKLE` : `${skill.cost} EN`),
      ])
      grid.append(btn)
    })
    if (!active.moves.length) {
      grid.append(button('Tackle', () => this.doAction({ type: 'move', index: 0 }), { variant: 'ghost' }))
    }
    this.panelEl.append(grid)
  }

  renderPartyPanel(switchOnly = false, forItem = false) {
    const b = this.battle
    const list = el('div', { class: 'battle-list' })
    b.playerParty.forEach((m, index) => {
      const sp = getMonster(m.speciesId)
      const pct = m.hp / Math.max(1, maxHpOf(m))
      const isActive = index === b.activeIndex
      const disabled = !forItem ? (m.hp <= 0 || (isActive && !this.needSwitch)) : false
      const row = el('button', {
        class: 'battle-list-row',
        disabled,
        onclick: () => {
          if (forItem) {
            this.doAction({ type: 'item', itemId: this.pendingItem, targetIndex: index })
          } else {
            this.doSwitch(index)
          }
        },
      }, [
        (() => {
          const img = el('img', { class: 'pixel-sprite', alt: m.nickname, style: { width: '28px', height: '28px' } })
          img.src = spriteUrl(m.speciesId)
          return img
        })(),
        el('span', {}, [
          el('strong', {}, `${m.nickname}${isActive ? ' · active' : ''}`),
          el('span', {}, `Lv.${m.level} · ${m.hp}/${maxHpOf(m)} HP${m.status ? ' · ' + STATUS[m.status].name : ''}`),
        ]),
        el('span', { class: 'dock-hp', style: { width: '44px', height: '4px', background: 'rgba(0,0,0,.4)', borderRadius: '99px', overflow: 'hidden' } }, [
          el('span', { style: { display: 'block', height: '100%', width: pct * 100 + '%', background: pct > 0.5 ? '#78d9a4' : pct > 0.22 ? '#ffd36e' : '#ff7a7a' } }),
        ]),
      ])
      list.append(row)
    })
    if (!forItem) {
      this.panelEl.append(el('div', { class: 'small-note' }, this.needSwitch ? 'Your partner fainted. Send out someone else.' : 'Switching costs a turn. Stats reset.'))
    } else {
      this.panelEl.append(el('div', { class: 'small-note' }, `Use ${getItem(this.pendingItem).name} on which monster?`))
    }
    this.panelEl.append(list)
    if (forItem) {
      this.panelEl.append(button('← Back', () => { this.actionMode = 'bag'; this.renderActions() }, { variant: 'ghost', className: 'small battle-back' }))
    }
  }

  renderBagPanel() {
    const inv = this.battle.state.inventory
    const items = Object.entries(inv).filter(([id, count]) => {
      const item = getItem(id)
      return count > 0 && ['potion', 'cure', 'revive', 'battle'].includes(item.type)
    })
    if (!items.length) {
      this.panelEl.append(el('div', { class: 'small-note' }, 'No battle items in the bag. Capture orbs live under Catch.'))
      return
    }
    const list = el('div', { class: 'battle-list battle-subpanel' })
    for (const [id, count] of items) {
      const item = getItem(id)
      const row = el('button', {
        class: 'battle-list-row',
        onclick: () => {
          if (item.type === 'revive') {
            this.pendingItem = id
            this.actionMode = 'bag-target'
            this.renderActions()
          } else {
            this.doAction({ type: 'item', itemId: id, targetIndex: this.battle.activeIndex })
          }
        },
      }, [
        el('span', { class: 'item-icon', style: { '--item-color': item.color, width: '28px', height: '28px', flexBasis: '28px', fontSize: '13px' } }, item.icon),
        el('span', {}, [el('strong', {}, item.name), el('span', {}, item.desc)]),
        el('span', { class: 'count-pill' }, `×${count}`),
      ])
      list.append(row)
    }
    this.panelEl.append(list)
  }

  renderCapturePanel() {
    const options = this.battle.captureOptions()
    if (!options.length) {
      this.panelEl.append(el('div', { class: 'small-note' }, 'You have no capture orbs. Buy or craft some in town.'))
      return
    }
    const list = el('div', { class: 'battle-list battle-subpanel' })
    this.panelEl.append(el('div', { class: 'small-note' }, 'Tap an orb to throw it. Weakening the monster and inflicting a status improves your odds.'))
    for (const option of options) {
      const chance = Math.round(option.chance * 100)
      list.append(el('button', {
        class: 'battle-list-row',
        onclick: () => this.doAction({ type: 'capture', itemId: option.id }),
      }, [
        el('span', { class: 'item-icon', style: { '--item-color': option.item.color, width: '28px', height: '28px', flexBasis: '28px', fontSize: '13px' } }, '◉'),
        el('span', {}, [el('strong', {}, option.item.name), el('span', {}, `${chance}% chance · ${getMonster(this.battle.enemy.speciesId).name}`)]),
        el('span', { class: 'count-pill throw' }, `×${option.count} · Throw`),
      ]))
    }
    this.panelEl.append(list)
  }

  // ── turn flow ─────────────────────────────────────────────────────────────
  doAction(action) {
    if (this.busy || this.destroyed || this.battle.over) return
    const result = this.battle.takeTurn(action)
    const events = result.events || []
    if (!events.length && result.rejected) return
    this.play(events)
  }

  doSwitch(index) {
    if (this.busy || this.destroyed) return
    if (this.battle.awaitingSwitch) {
      this.needSwitch = false
      const res = this.battle.forceSwitch(index)
      this.play(res.events || [])
    } else {
      this.doAction({ type: 'switch', index })
    }
  }

  async play(events) {
    if (this.destroyed) return
    this.busy = true
    this.needSwitch = false
    this.renderActions()
    for (const event of events) {
      if (this.destroyed) return
      this.handleEvent(event)
      this.sync()
      await this.wait(this.eventDelay(event))
    }
    if (this.destroyed) return
    this.busy = false
    this.sync()
    if (this.battle.awaitingSwitch) {
      this.needSwitch = true
      this.actionMode = 'party'
      this.renderActions()
    } else if (this.battle.over) {
      this.showResult()
    } else {
      this.actionMode = this.actionMode === 'bag-target' ? 'bag' : this.actionMode
      this.renderActions()
    }
  }

  eventDelay(event) {
    const speed = this.app.state?.settings?.speed || 'normal'
    const base = speed === 'fast' ? 110 : speed === 'relaxed' ? 470 : 255
    switch (event.type) {
      case 'log': return base * 0.8
      case 'move': return base * 1.05
      case 'damage': return base * 1.1
      case 'capture-throw': return 560
      case 'capture-shake': return 720
      case 'captured': return 900
      case 'faint': return 550
      case 'enemy-switch':
      case 'player-switch': return base * 1.35
      case 'battle-end': return 220
      case 'xp': return 140
      default: return base * 0.55
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  handleEvent(event) {
    switch (event.type) {
      case 'log':
        this.setMessage(event.text)
        this.appendLog(event.text)
        break
      case 'move': {
        const e = ELEMENTS[event.element] || ELEMENTS.none
        this.showMoveBanner(event.moveName, e.color)
        this.lunge(event.side)
        break
      }
      case 'damage': {
        const point = this.fxPoint(event.side)
        this.showFx(`-${event.amount}`, event.crit ? 'crit' : 'damage', point)
        if (event.crit) this.showFx('CRITICAL', 'eff', { x: point.x, y: point.y - 36 })
        if (event.effLabel) this.showFx(event.effLabel.replace('!', ''), 'eff', { x: point.x, y: point.y + 34 })
        if (event.statusTick) this.showFx(event.statusTick.toUpperCase(), 'status', { x: point.x, y: point.y - 54 })
        this.hit(event.side)
        break
      }
      case 'heal':
      case 'heal-item': {
        if (event.amount) this.showFx(`+${event.amount}`, 'heal', this.fxPoint(event.side))
        break
      }
      case 'revive':
        this.showFx('REVIVED', 'heal', this.fxPoint('player'))
        break
      case 'status':
        this.showFx(event.label || event.status, 'status', this.fxPoint(event.side))
        break
      case 'status-clear':
        this.showFx('CURED', 'heal', this.fxPoint(event.side))
        break
      case 'stage':
        this.showFx(`${String(event.stat).toUpperCase()} ${event.stages > 0 ? '↑' : '↓'}`, 'eff', this.fxPoint(event.side))
        break
      case 'miss':
        this.showFx('MISS', 'miss', this.fxPoint(event.side))
        break
      case 'immune':
        this.showFx('IMMUNE', 'miss', this.fxPoint(event.side))
        break
      case 'skip':
        this.showFx(String(event.reason || 'STUNNED').toUpperCase(), 'status', this.fxPoint(event.side))
        break
      case 'seed':
        this.showFx('SEEDED', 'status', this.fxPoint(event.side))
        break
      case 'capture-throw': {
        const name = getItem(event.itemId)?.name || 'orb'
        this.setMessage(`You threw a ${name}!`)
        this.appendLog(`You threw a ${name}!`)
        this.showOrb()
        break
      }
      case 'capture-shake': {
        this.messageEl.innerHTML = ''
        this.messageEl.append(el('span', { class: 'msg-tag' }, 'CAPTURE'), el('span', {}, 'The orb rocks…'))
        if (this.orbEl) {
          this.orbEl.classList.add('shaking')
          this.orbEl.classList.remove('break')
        }
        break
      }
      case 'captured': {
        if (this.orbEl) {
          this.orbEl.classList.remove('shaking')
          this.orbEl.classList.add('break')
          setTimeout(() => this.orbEl?.remove(), 500)
        }
        const caught = event.monster
        this.setMessage(`${getMonster(caught.speciesId).name} was caught!`)
        this.showFx('CAUGHT!', 'crit', { x: this.overlay.clientWidth * 0.5, y: this.overlay.clientHeight * 0.34 })
        break
      }
      case 'capture-fail':
        if (this.orbEl) {
          this.orbEl.classList.remove('shaking')
          this.orbEl.classList.add('break')
          setTimeout(() => this.orbEl?.remove(), 500)
        }
        this.setMessage('The monster broke free!')
        this.showFx('BROKE FREE', 'miss', { x: this.overlay.clientWidth * 0.5, y: this.overlay.clientHeight * 0.34 })
        break
      case 'faint':
        this.showFx('FAINTED', 'eff', this.fxPoint(event.side))
        break
      case 'enemy-switch':
        this.setMessage(`${event.name} steps forward!`)
        this.enemyCombatant.classList.add('entering')
        setTimeout(() => this.enemyCombatant.classList.remove('entering'), 400)
        break
      case 'player-switch':
        this.setMessage(`Go, ${event.name}!`)
        this.playerCombatant.classList.add('entering')
        setTimeout(() => this.playerCombatant.classList.remove('entering'), 400)
        break
      case 'awaiting-switch':
        this.needSwitch = true
        this.setMessage('Your partner fainted. Choose another monster.')
        break
      case 'xp':
        if (event.amount) this.appendLog(`${event.name} gained ${event.amount} XP.`)
        break
      case 'victory':
        this.showFx('VICTORY', 'crit', { x: this.overlay.clientWidth * 0.5, y: this.overlay.clientHeight * 0.3 })
        break
      case 'defeat':
        this.setMessage('Your team is out of the fight…')
        break
      case 'escaped':
        this.setMessage('You got away safely!')
        break
      case 'battle-end':
        this.endPayload = event
        this.battleEndResult = event.result
        break
      default:
        break
    }
  }

  // ── visual effects ────────────────────────────────────────────────────────
  fxPoint(side) {
    const target = side === 'player' ? this.playerCombatant : this.enemyCombatant
    const rect = target.getBoundingClientRect()
    const frame = this.overlay.getBoundingClientRect()
    return {
      x: rect.left - frame.left + rect.width / 2,
      y: rect.top - frame.top + rect.height * 0.38,
    }
  }

  showFx(text, cls, point) {
    if (!this.fxLayer) return
    const node = el('div', { class: `battle-fx ${cls || ''}`, style: { left: point.x + 'px', top: point.y + 'px' } }, text)
    this.fxLayer.append(node)
    setTimeout(() => node.remove(), 950)
  }

  showMoveBanner(name, color) {
    const old = this.overlay.querySelector('.battle-move-banner')
    if (old) old.remove()
    const banner = el('div', { class: 'battle-move-banner', style: { '--move-color': color } }, name)
    this.overlay.append(banner)
    setTimeout(() => banner.remove(), 700)
  }

  showOrb() {
    this.orbEl?.remove()
    this.orbEl = el('div', { class: 'capture-orb' })
    this.overlay.append(this.orbEl)
  }

  lunge(side) {
    const target = side === 'player' ? this.playerCombatant : this.enemyCombatant
    target.classList.add(side === 'player' ? 'lunge-player' : 'lunge-enemy')
    setTimeout(() => target.classList.remove('lunge-player', 'lunge-enemy'), 360)
  }

  hit(side) {
    const target = side === 'player' ? this.playerCombatant : this.enemyCombatant
    target.classList.add('hit')
    if (this.app.state?.settings?.screenShake) {
      this.overlay.classList.add('screen-shake')
      setTimeout(() => this.overlay.classList.remove('screen-shake'), 340)
    }
    setTimeout(() => target.classList.remove('hit'), 400)
  }

  // ── results ───────────────────────────────────────────────────────────────
  showResult() {
    if (this.resultShown || this.destroyed) return
    this.resultShown = true
    this.toolbar.innerHTML = ''
    this.panelEl.innerHTML = ''
    const b = this.battle
    const result = b.result || 'win'
    const rewards = b.rewards || { money: 0, trainerXp: 0, items: [] }
    const wrap = el('div', { class: 'battle-result' })
    let glyph = '✦'
    let title = 'Victory'
    let sub = ''
    let actionLabel = 'Continue'
    let actionTone = 'gold'

    if (result === 'win') {
      this.setMessage('The battle is won.')
      glyph = '✦'
      title = b.trainer ? `You defeated ${b.trainer.name}!` : this.kind === 'boss' || this.kind === 'mythic' ? 'The guardian falls.' : 'Victory!'
      sub = b.trainer ? 'Your whole party shared the experience.' : 'Your team earned experience and friendship.'
    } else if (result === 'caught') {
      glyph = '◉'
      title = 'Gotcha!'
      sub = b.caughtMonster ? `${getMonster(b.caughtMonster.speciesId).name} joined your journey.` : 'A new friend joined you.'
      actionLabel = 'Welcome to the team'
    } else if (result === 'escaped') {
      glyph = '➜'
      title = 'You got away safely.'
      sub = 'Not every fight has to be finished.'
      actionLabel = 'Return to the world'
      actionTone = 'ghost'
    } else if (result === 'lose') {
      glyph = '☾'
      title = 'Defeated…'
      sub = 'You wake at the nearest healer. Your team is safe, but the wilds remember.'
      actionLabel = 'Get back up'
      actionTone = 'primary'
    }

    wrap.append(el('div', { class: 'result-glyph' }, glyph), el('h2', {}, title), el('p', { class: 'result-sub' }, sub))

    if (result === 'caught' && b.caughtMonster) {
      const img = el('img', { class: 'result-mon pixel-sprite', alt: '' })
      img.src = spriteUrl(b.caughtMonster.speciesId)
      wrap.append(img)
      const caughtSp = getMonster(b.caughtMonster.speciesId)
      wrap.append(el('div', { class: 'battle-meta', style: { justifyContent: 'center' } }, [
        elementBadge(caughtSp.element), rarityBadge(caughtSp.rarity),
      ]))
    }

    if (result === 'win') {
      const chips = el('div', { class: 'result-rewards' })
      if (rewards.money) chips.append(el('span', { class: 'result-reward' }, `◈ ${rewards.money} gold`))
      if (rewards.trainerXp) chips.append(el('span', { class: 'result-reward' }, `★ ${rewards.trainerXp} trainer XP`))
      for (const [id, count] of rewards.items || []) {
        chips.append(el('span', { class: 'result-reward' }, `${getItem(id).icon} ${getItem(id).name} ×${count}`))
      }
      if (chips.childElementCount) wrap.append(chips)
      if (b.levelUps?.length) {
        wrap.append(el('div', { class: 'result-levelups' }, b.levelUps.map(l => `▲ ${l.monster.nickname} → Lv.${l.to}`)))
      }
      if (b.evolutions?.length) {
        wrap.append(el('div', { class: 'result-evolutions' }, `✦ ${b.evolutions.length} monster${b.evolutions.length > 1 ? 's are' : ' is'} ready to evolve — you can review after the battle.`))
      }
    }

    wrap.append(button(actionLabel, () => this.finish(result), { variant: actionTone, icon: result === 'win' ? '✦' : result === 'caught' ? '◉' : '⌂' }))
    this.panelEl.append(wrap)
  }

  finish(result) {
    if (this.destroyed) return
    const evolutions = this.battle.evolutions || []
    this.app.completeBattle(this.battle, result)
    this.destroy()
    if (evolutions.length) {
      setTimeout(() => this.app.showEvolutionQueue(evolutions), 260)
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.root.innerHTML = ''
    if (this.app.battleUI === this) this.app.battleUI = null
    this.app.refreshHud()
  }
}
