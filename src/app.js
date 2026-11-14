// Aetheria: Wildbound — application shell.
// Owns the title flow, the exploration loop, input, saves and screen routing.

import {
  newGame, loadGame, saveGame, deleteSave as eraseSave, hasSave, saveSummary,
  addItem, addMoney, addTrainerXp, advanceTime, itemCount, removeItem,
} from './game/state.js'
import { GameWorld } from './game/world.js'
import { WorldRenderer } from './render/worldRenderer.js'
import { monsterSprite, playerSprite } from './render/sprites.js'
import { HUD } from './ui/hud.js'
import { Screens } from './ui/screens.js'
import { BattleUI } from './ui/battleUI.js'
import {
  initUI, openModal, closeModal, toast, isModalOpen, confirm,
  el, button, monsterSpriteImg, elementBadge, rarityBadge, chip,
} from './ui/common.js'
import { STARTERS, getMonster } from './data/monsters.js'
import { BIOMES, BIOME_LIST } from './data/biomes.js'
import { ELEMENTS } from './data/elements.js'
import { getItem } from './data/items.js'
import { getSkill } from './data/skills.js'
import { evaluateState } from './game/progress.js'
import { healParty, evolveMonster, maxHpOf, hatchEgg as hatchMonsterEgg } from './game/monsters.js'
import { trainerEnemies } from './game/battle.js'
import { on } from './core/events.js'

const MOVE_KEYS = {
  arrowup: 'up', w: 'up',
  arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left',
  arrowright: 'right', d: 'right',
}

export class GameApp {
  constructor() {
    this.root = document.getElementById('app')
    this.battleLayer = document.getElementById('battle-layer')
    this.mode = 'title'
    this.state = null
    this.world = null
    this.renderer = null
    this.hud = null
    this.screens = null
    this.battleUI = null
    this.near = null
    this.keys = new Set()
    this.mobileKeys = new Set()
    this.mobileRun = false
    this.playerMoving = false
    this.walkTime = 0
    this.lastTime = performance.now()
    this.playAccumulator = 0
    this.autosaveTimer = null
    this.saveInterval = null
    this.loop = this.loop.bind(this)
    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)

    initUI()
    this.bindGlobalEvents()
    this.bindBusEvents()
    this.showTitle()
    requestAnimationFrame(this.loop)
  }

  // ── boot & global events ───────────────────────────────────────────────────
  bindGlobalEvents() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('resize', () => this.renderer?.resize())
    window.addEventListener('blur', () => { this.keys.clear(); this.mobileKeys.clear() })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'game') this.save()
    })
    window.addEventListener('beforeunload', () => {
      if (this.mode === 'game' && this.state) this.save()
    })
    window.addEventListener('contextmenu', e => {
      if (e.target.closest('.game-shell, .dpad, .action-pad')) e.preventDefault()
    })
  }

  bindBusEvents() {
    on('toast', detail => toast(detail))
    on('egg-ready', ({ egg }) => this.hatchEgg(egg))
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
      if (isModalOpen()) { closeModal(); e.preventDefault(); return }
      if (this.mode === 'game' && !this.battleUI) { this.openMenu(); e.preventDefault() }
      return
    }
    if (this.mode !== 'game' || this.battleUI || isModalOpen()) return
    const key = e.key.toLowerCase()

    if (key === 'shift') { this.keys.add('shift'); return }
    const dir = MOVE_KEYS[key]
    if (dir) {
      this.keys.add(dir)
      e.preventDefault()
      return
    }
    if (e.repeat) return
    if (key === 'e' || key === ' ' || key === 'enter') {
      e.preventDefault()
      this.interact()
      return
    }
    if (key === 'p') { e.preventDefault(); this.openParty(); return }
    if (key === 'b') { e.preventDefault(); this.openBag(); return }
    if (key === 'c') { e.preventDefault(); this.openDex(); return }
    if (key === 'm') { e.preventDefault(); this.openMap(); return }
    if (key === 'j') { e.preventDefault(); this.openQuests(); return }
  }

  onKeyUp(e) {
    const key = e.key.toLowerCase()
    if (key === 'shift') this.keys.delete('shift')
    const dir = MOVE_KEYS[key]
    if (dir) this.keys.delete(dir)
  }

  // ── title flow ─────────────────────────────────────────────────────────────
  showTitle() {
    this.stopAutosave()
    if (this.battleUI) { this.battleUI.destroy(); this.battleUI = null }
    if (isModalOpen()) closeModal(true)
    this.mode = 'title'
    this.state = null
    this.world = null
    this.renderer = null
    this.hud = null
    this.screens = null
    this.near = null
    this.battleLayer.innerHTML = ''
    document.body.classList.remove('in-game')
    document.body.classList.add('title-mode')
    this.root.innerHTML = ''

    const summary = saveSummary()
    const screen = el('section', { class: 'title-screen' })
    screen.append(el('div', { class: 'title-vignette' }))

    const left = el('div', { class: 'title-left' })
    left.append(
      el('div', { class: 'title-kicker' }, '❧ Eight biomes · 87 species · one garden'),
      el('div', { class: 'title-logo' }, [
        el('h1', {}, 'AETHERIA'),
        el('div', { class: 'title-sub' }, 'WILDBOUND'),
      ]),
      el('p', { class: 'title-tagline' }, 'The garden has grown teeth. Befriend the wild, challenge the eight Guardians, and remember what the continent was before the quarrel.'),
    )

    const actions = el('div', { class: 'title-actions' })
    if (summary) {
      actions.append(button('Continue Journey', () => this.continueGame(), { variant: 'primary', icon: '▶' }))
      actions.append(button('New Journey', () => this.openNewGame(), { variant: 'ghost', icon: '✦' }))
    } else {
      actions.append(button('Begin a New Journey', () => this.openNewGame(), { variant: 'primary', icon: '✦' }))
    }
    actions.append(button('How to Play', () => this.showTitleHelp(), { variant: 'ghost', icon: '?' }))
    left.append(actions)

    if (summary) {
      const saveBox = el('div', { class: 'title-save' }, [
        el('span', {}, [el('i', { class: 'save-dot' }), el('strong', {}, summary.name)]),
        el('span', {}, `Trainer Lv.${summary.level}`),
        el('span', {}, `${summary.party} in party · ${summary.dex} in codex`),
        summary.savedAt ? el('span', {}, `Saved ${new Date(summary.savedAt).toLocaleDateString()}`) : null,
        el('button', {
          class: 'chip bad',
          style: { marginLeft: 'auto', cursor: 'pointer', background: 'rgba(255,122,122,0.08)' },
          onclick: () => this.confirmDeleteSave(),
        }, 'Delete save'),
      ])
      left.append(saveBox)
    } else {
      left.append(el('div', { class: 'title-save' }, [el('span', {}, 'No save yet — the road is yours to write.')]))
    }

    const right = el('div', { class: 'title-right' }, [
      el('div', { class: 'title-orbit' }),
      el('div', { class: 'title-mons' }, STARTERS.map(id => {
        const sp = getMonster(id)
        const img = el('img', { class: 'pixel-sprite', alt: sp.name })
        img.src = monsterSprite(id).toDataURL()
        return el('div', { class: 'title-mon' }, [img, el('span', {}, sp.name)])
      })),
      el('div', { class: 'title-plate' }, 'The continent of Aetheria · Original illustrated species'),
    ])

    const footer = el('div', { class: 'title-footer' }, [
      el('span', {}, 'Aetheria: Wildbound — original pixel-art monster RPG'),
      el('span', {}, 'WASD / Arrows · E interact · P party · B bag · C codex · M map · J journal'),
    ])

    const content = el('div', { class: 'title-content' }, [left, right])
    screen.append(content, footer)
    this.root.append(screen)
  }

  continueGame() {
    const state = loadGame()
    if (!state || !state.party?.length) {
      toast({ title: 'Save could not be read', text: 'Start a new journey instead.', tone: 'warn' })
      return
    }
    this.startGame(state, { fresh: false })
  }

  openNewGame() {
    let selected = STARTERS[0]
    const content = el('div', { class: 'newgame-form' })
    content.append(el('p', {}, 'Choose the companion who will walk into the wild with you. Every starter can grow into a different kind of legend.'))

    const nameField = el('div', {}, [
      el('label', { class: 'field-label', for: 'trainer-name' }, 'Trainer name'),
      el('input', { id: 'trainer-name', class: 'text-input', maxLength: 16, value: 'Wren', placeholder: 'Your name' }),
    ])
    content.append(nameField)

    const grid = el('div', { class: 'starter-grid' })
    const cards = []
    const startBtn = button('Begin Journey', () => {
      const name = content.querySelector('#trainer-name').value.trim() || 'Wren'
      closeModal()
      const state = newGame(selected, name)
      this.startGame(state, { fresh: true })
    }, { variant: 'primary', icon: '✦' })

    for (const id of STARTERS) {
      const sp = getMonster(id)
      const card = el('button', {
        class: `starter-card ${id === selected ? 'selected' : ''}`,
        onclick: () => {
          selected = id
          for (const c of cards) c.classList.toggle('selected', c.dataset.species === id)
          startBtn.querySelector('.btn-icon')?.replaceChildren(document.createTextNode('✦'))
        },
        'data-species': id,
      }, [
        el('span', { class: 'select-mark' }, '✓'),
        el('div', { class: 'starter-art' }, [(() => {
          const img = el('img', { class: 'pixel-sprite', alt: sp.name })
          img.src = monsterSprite(id).toDataURL()
          return img
        })()]),
        el('strong', {}, sp.name),
        elementBadge(sp.element, true),
        el('span', { class: 'starter-copy' }, sp.desc),
        el('div', { class: 'starter-stats' }, [
          el('span', {}, `HP ${sp.base.hp}`),
          el('span', {}, `ATK ${sp.base.atk}`),
          el('span', {}, `SPA ${sp.base.spa}`),
          el('span', {}, `SPE ${sp.base.spe}`),
        ]),
      ])
      cards.push(card)
      grid.append(card)
    }
    content.append(grid)

    startBtn.style.width = '100%'
    openModal({
      title: 'A New Journey',
      subtitle: 'The garden remembers every name. What will it call you?',
      icon: '❧', body: content, size: 'large',
      footer: el('div', { class: 'row end', style: { width: '100%' } }, [startBtn]),
    })
  }

  confirmDeleteSave() {
    confirm({
      title: 'Delete this save?',
      text: 'This permanently erases the party, codex and every promise in the journal. There is no undo.',
      yes: 'Delete forever', danger: true,
      onYes: () => {
        eraseSave()
        toast({ title: 'Save deleted', text: 'The road is blank again.', tone: 'warn' })
        this.showTitle()
      },
    })
  }

  showTitleHelp() {
    const body = el('div', { class: 'help-grid' }, [
      helpCard('➜', 'Explore', 'Use WASD or the arrow keys. Shift runs. Walk into wild monsters to start an encounter, or press E near people and sparkles to interact.'),
      helpCard('◉', 'Catch', 'Weaken a monster, inflict a status, then throw an orb. The catch screen shows the real percentage before you commit.'),
      helpCard('⚔', 'Battle', 'Skills cost energy; Tackle is always free. Elements beat elements. Switch monsters whenever you need to.'),
      helpCard('✦', 'Grow', 'Monsters evolve by level, friendship, location or rare items. Check a monster\'s detail page for its evolution path.'),
      helpCard('✎', 'Quests', 'Golden “!” marks a quest giver. Guardians wait at the heart of every biome. The Codex records every species you meet.'),
      helpCard('☾', 'Day & night', 'The clock moves as you explore. Some monsters only appear at night; healers can rest you until dawn.'),
      helpCard('◈', 'Town services', 'Healers restore your party for free. Merchants sell orbs and potions. The nursery in the ruins can hatch eggs.'),
      helpCard('▣', 'Saving', 'Autosave is on by default. You can also save or return to the title from the pause menu.'),
    ])
    openModal({ title: 'How to Play', subtitle: 'A short field guide to Aetheria', icon: '?', body, size: 'large' })
  }

  // ── game start ────────────────────────────────────────────────────────────
  startGame(state, { fresh = false } = {}) {
    this.state = state
    this.mode = 'game'
    document.body.classList.remove('title-mode')
    document.body.classList.add('in-game')
    this.battleLayer.innerHTML = ''
    this.root.innerHTML = ''

    this.world = new GameWorld(state)
    this.world.placePlayerFromState()

    const canvas = el('canvas', { id: 'game-canvas' })
    const shell = el('div', { class: 'game-shell' })
    shell.append(canvas)
    this.root.append(shell)

    const hudRoot = el('div', { class: 'hud-layer' })
    const mobile = this.buildMobileControls()
    shell.append(hudRoot, mobile)

    this.renderer = new WorldRenderer(canvas, this.world)
    this.hud = new HUD(hudRoot, this)
    this.screens = new Screens(this)
    this.near = this.world.nearestInteraction()
    this.world.encounterCooldown = 2.2
    this.playerMoving = false
    this.mobileRun = false
    this.walkTime = 0
    this.updatePlayerState()
    this.renderer.centerCamera(this.world.player.x, this.world.player.y)
    this.hud.update()
    this.applySettings()
    this.startAutosave()

    if (fresh || !state.flags.introSeen) this.showIntro()
    else toast({ title: `Welcome back, ${state.player.name}`, text: `${BIOMES[state.player.biome]?.name || 'Aetheria'} · Trainer Lv.${state.player.trainerLevel}`, icon: '✦' })
  }

  showIntro() {
    this.state.flags.introSeen = true
    const starter = this.state.party[0]
    const sp = starter ? getMonster(starter.speciesId) : null
    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
      el('p', { style: { fontSize: '14px', color: 'var(--ink-soft)' } }, 'The eight biomes were once a single garden. Then the Guardians quarreled, and the roads grew thorns. You arrive in Greenwood with one companion and a blank journal.'),
      el('div', { class: 'panel-soft' }, [
        el('div', { class: 'eyebrow' }, 'YOUR FIRST PARTNER'),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
          sp ? (() => {
            const img = el('img', { class: 'pixel-sprite', alt: sp.name, style: { width: '72px', height: '72px' } })
            img.src = monsterSprite(sp.id).toDataURL()
            return img
          })() : null,
          el('div', {}, [
            el('strong', { style: { fontSize: '16px' } }, starter?.nickname || 'Your companion'),
            el('p', { style: { fontSize: '12px', color: 'var(--muted)' } }, sp ? `${sp.name} · ${ELEMENTS[sp.element].name} · Lv.${starter.level}` : ''),
            sp ? elementBadge(sp.element, true) : null,
          ]),
        ]),
      ]),
      el('div', { class: 'help-grid' }, [
        helpCard('➜', 'Move', 'WASD / arrows. Shift runs. On mobile use the pad at the lower-left and tap RUN to sprint.'),
        helpCard('E', 'Interact', 'Talk, gather, challenge Guardians or start a wild battle.'),
        helpCard('P · B · C', 'Party · Bag · Codex', 'Your three most-used screens are always one key away.'),
        helpCard('✎', 'First steps', 'Walk into a wild monster to battle it. Visit the golden “!” in Mossglow Village for your first quest.'),
      ]),
      el('p', { class: 'small-note' }, 'Tip: weaken a wild monster before throwing a Capture Orb. Status conditions make a real difference.'),
    ])
    openModal({
      title: 'The Garden Remembers',
      subtitle: 'A note from the road',
      icon: '❧', body, size: 'large',
      footer: button('Step outside', () => {
        closeModal()
        this.afterChange()
        const touch = window.matchMedia?.('(pointer: coarse)').matches
        toast({ title: 'Greenwood Forest', text: touch ? 'Pad to move · ACTION to interact · RUN to sprint' : 'WASD / arrows to move · E to interact', icon: '❧', tone: 'region' })
      }, { variant: 'primary', icon: '➜' }),
    })
  }

  // ── exploration loop ──────────────────────────────────────────────────────
  loop(now) {
    const dt = Math.min(0.06, Math.max(0, (now - this.lastTime) / 1000))
    this.lastTime = now
    if (this.mode === 'game' && this.state && this.world && this.renderer) {
      const blocked = isModalOpen() || !!this.battleUI
      if (!blocked) {
        this.handleMovement(dt)
        const result = this.world.update(dt)
        this.near = result.near
        if (result.encounter) this.startWildBattle(result.encounter)
      } else {
        this.playerMoving = false
      }
      this.playAccumulator += dt
      if (this.playAccumulator >= 1) {
        this.state.stats.playTime = (this.state.stats.playTime || 0) + Math.floor(this.playAccumulator)
        this.playAccumulator -= Math.floor(this.playAccumulator)
      }
      this.renderer.updateCamera(this.world.player.x, this.world.player.y, dt)
      this.renderer.render(dt, {
        player: this.world.player,
        near: this.near,
        playerMoving: this.playerMoving,
        walkTime: this.walkTime,
      })
      this.hud?.update()
    }
    requestAnimationFrame(this.loop)
  }

  handleMovement(dt) {
    let dx = 0
    let dy = 0
    if (this.keys.has('up') || this.mobileKeys.has('up')) dy -= 1
    if (this.keys.has('down') || this.mobileKeys.has('down')) dy += 1
    if (this.keys.has('left') || this.mobileKeys.has('left')) dx -= 1
    if (this.keys.has('right') || this.mobileKeys.has('right')) dx += 1
    this.playerMoving = dx !== 0 || dy !== 0
    if (!this.playerMoving) return
    const length = Math.hypot(dx, dy) || 1
    const running = this.keys.has('shift') || this.mobileRun
    const speed = running ? 205 : 118
    this.world.movePlayer((dx / length) * speed * dt, (dy / length) * speed * dt)
    this.walkTime += dt * (running ? 1.55 : 1)
  }

  interact() {
    if (this.mode !== 'game' || this.battleUI || isModalOpen()) return
    const near = this.near || this.world.nearestInteraction()
    if (!near) {
      toast({ title: 'Nothing within reach', text: 'Walk closer to a person, sparkle or monster.', icon: '➜' })
      return
    }
    const entity = near.entity
    switch (near.kind) {
      case 'npc':
        this.screens.talkTo(entity)
        break
      case 'resource': {
        const count = this.world.gatherResource(entity)
        if (!count) { toast({ title: 'Not ready', text: 'This resource is regrowing.', tone: 'warn' }); break }
        addItem(this.state, entity.item, count)
        this.afterChange()
        toast({ title: 'Gathered', text: `${getItem(entity.item).name} ×${count}`, icon: '✧', tone: 'success' })
        break
      }
      case 'wild':
        this.startWildBattle(entity)
        break
      case 'boss':
        this.confirmGuardian(entity)
        break
      case 'mythic':
        this.confirmGuardian(entity)
        break
      default:
        toast({ title: 'Nothing happens', icon: '…' })
    }
  }

  confirmGuardian(entity) {
    const monster = entity.monster
    const sp = getMonster(monster.speciesId)
    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, [
      el('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } }, [
        monsterSpriteImg(monster.speciesId, { size: 96 }),
        el('div', {}, [
          el('strong', { style: { fontSize: '17px' } }, sp.name),
          el('p', { class: 'small-note' }, `Lv.${monster.level} · ${ELEMENTS[sp.element].name}${entity.kind === 'mythic' ? ' · Mythic' : ' · Guardian'}`),
          el('div', { class: 'battle-meta' }, [elementBadge(sp.element), rarityBadge(sp.rarity)]),
        ]),
      ]),
      el('p', { style: { fontSize: '13px', color: 'var(--ink-soft)' } }, entity.kind === 'mythic'
        ? 'This presence is older than the biome itself. It can be fought, and perhaps caught — but it will not hold back.'
        : `${entity.name} bars the way to the heart of ${BIOMES[entity.biome].name}. Defeat it to calm the region — or attempt the far harder capture.`),
      el('p', { class: 'small-note' }, entity.kind === 'mythic' ? 'Mythic monsters can be captured. Bring your best orbs.' : 'Capture is possible, but Guardians are far easier to defeat than to catch.'),
    ])
    openModal({
      title: entity.kind === 'mythic' ? 'A Mythic Presence' : `Challenge ${entity.name}?`,
      subtitle: BIOMES[entity.biome].name,
      icon: entity.kind === 'mythic' ? '✧' : '♛',
      body, size: 'medium',
      footer: el('div', { class: 'row gap end' }, [
        button('Not yet', closeModal, { variant: 'ghost' }),
        button(entity.kind === 'mythic' ? 'Face it' : 'Challenge', () => {
          closeModal()
          this.startGuardianBattle(entity)
        }, { variant: 'primary', icon: '⚔' }),
      ]),
    })
  }

  // ── battles ───────────────────────────────────────────────────────────────
  startWildBattle(wild) {
    if (this.battleUI || this.mode !== 'game') return
    this.keys.clear()
    this.mobileKeys.clear()
    this.playerMoving = false
    const biome = this.world.currentBiome
    this.world.removeWild(wild)
    this.battleUI = new BattleUI(this, {
      state: this.state,
      enemies: [wild.monster],
      source: { kind: 'wild', entity: wild },
      biome,
    })
  }

  startGuardianBattle(entity) {
    if (this.battleUI || this.mode !== 'game') return
    this.keys.clear()
    this.mobileKeys.clear()
    this.battleUI = new BattleUI(this, {
      state: this.state,
      enemies: [entity.monster],
      source: { kind: entity.kind, entity },
      biome: entity.biome,
    })
  }

  startTrainerBattle(npc) {
    if (this.battleUI || this.mode !== 'game') return
    this.keys.clear()
    this.mobileKeys.clear()
    this.battleUI = new BattleUI(this, {
      state: this.state,
      enemies: trainerEnemies(npc),
      trainer: { ...npc, npcId: npc.id },
      source: { kind: 'trainer', entity: npc },
      biome: npc.biome || this.world.currentBiome,
    })
  }

  completeBattle(battle, result) {
    if (!this.state || this.mode !== 'game') return
    const source = battle.source || {}
    const entity = source.entity

    if (result === 'win') {
      const rewards = battle.rewards || {}
      if (rewards.money) addMoney(this.state, rewards.money)
      if (rewards.trainerXp) addTrainerXp(this.state, rewards.trainerXp)
      for (const [id, count] of rewards.items || []) addItem(this.state, id, count)
      if (battle.trainer) {
        const id = battle.trainer.npcId || battle.trainer.id
        if (id) this.state.flags.trainers[id] = this.state.time.day
      }
      if (source.kind === 'boss' && entity) this.world.removeBoss(entity, false)
      else if (source.kind === 'mythic' && entity) this.world.removeMythic(entity, false)
      toast({
        title: battle.trainer ? 'Trainer defeated!' : source.kind === 'boss' ? 'Guardian calmed' : source.kind === 'mythic' ? 'Mythic overcome' : 'Battle won',
        text: `${rewards.money || 0} gold${rewards.trainerXp ? ` · ${rewards.trainerXp} trainer XP` : ''}`,
        icon: '✦', tone: 'success',
      })
    } else if (result === 'caught') {
      if (source.kind === 'boss' && entity) this.world.removeBoss(entity, true)
      else if (source.kind === 'mythic' && entity) this.world.removeMythic(entity, true)
      const caught = battle.caughtMonster
      if (caught) {
        toast({ title: 'Caught!', text: `${getMonster(caught.speciesId).name} joined you.`, icon: '◉', tone: 'success' })
      }
    } else if (result === 'lose') {
      healParty(this.state)
      const lost = Math.floor(this.state.player.money * 0.1)
      this.state.player.money = Math.max(0, this.state.player.money - lost)
      const town = this.world.towns[battle.biome] || this.world.towns.forest
      this.world.player.x = town.x * 16 + 8
      this.world.player.y = (town.y + 3) * 16 + 10
      this.world.currentBiome = battle.biome || 'forest'
      advanceTime(this.state, 6 * 60)
      toast({ title: 'You were carried home', text: `Lost ${lost} gold. Your team is healed.`, icon: '✚', tone: 'warn' })
    }

    this.updatePlayerState()
    this.afterChange()
  }

  // ── screen routing ────────────────────────────────────────────────────────
  canOpenScreen() {
    return this.mode === 'game' && !this.battleUI && this.screens
  }

  get uiBlocked() {
    return isModalOpen() || !!this.battleUI
  }
  openParty(tab = 'party') { if (this.canOpenScreen()) this.screens.openParty(tab) }
  openDex(biome = 'all') { if (this.canOpenScreen()) this.screens.openDex(biome) }
  openBag(tab = 'items') { if (this.canOpenScreen()) this.screens.openBag(tab) }
  openMap() { if (this.canOpenScreen()) this.screens.openMap() }
  openQuests(tab = null) { if (this.canOpenScreen()) this.screens.openQuests(tab) }
  openMenu() { if (this.canOpenScreen()) this.screens.openMenu() }
  openSettings() { if (this.canOpenScreen()) this.screens.openSettings() }
  openHelp() { if (this.canOpenScreen()) this.screens.openHelp() }

  // ── progression / notifications ───────────────────────────────────────────
  afterChange() {
    if (!this.state) return
    const result = evaluateState(this.state)
    for (const quest of result.readyQuests || []) {
      toast({ title: 'Quest ready to claim', text: quest.name, icon: '✎', tone: 'success' })
    }
    for (const achievement of result.newAchievements || []) this.achievementToast(achievement)
    this.refreshHud()
    if (this.state.settings?.autosave) this.debounceSave()
  }

  achievementToast(achievement) {
    toast({ title: 'Achievement unlocked', text: `${achievement.icon} ${achievement.name} — ${achievement.desc}`, icon: '★', tone: 'success', duration: 4200 })
  }

  refreshHud() {
    this.hud?.update()
  }

  hatchEgg(egg) {
    if (!this.state) return
    const partyIndex = this.state.party.findIndex(m => m.uid === egg.uid)
    const storageIndex = this.state.storage.findIndex(m => m.uid === egg.uid)
    if (partyIndex < 0 && storageIndex < 0) return
    const adult = hatchMonsterEgg(egg)
    egg.hatching = false
    if (partyIndex >= 0) this.state.party[partyIndex] = adult
    else this.state.storage[storageIndex] = adult
    this.state.stats.hatched = (this.state.stats.hatched || 0) + 1
    toast({ title: 'The egg hatched!', text: `${getMonster(adult.speciesId).name} joined your party.`, icon: '◈', tone: 'success' })
    this.afterChange()
  }

  // evolution requests originate from the party/detail screens and from battles
  showEvolutionChooser(monster, candidates, after = null, itemId = null) {
    if (!candidates?.length) return
    const content = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } })
    content.append(el('p', { class: 'small-note' }, `${monster.nickname} is ready to change. Choose a form.`))
    for (const evo of candidates) {
      const target = getMonster(evo.to)
      content.append(el('div', { class: 'evo-option' }, [
        monsterSpriteImg(evo.to, { size: 72 }),
        el('div', { class: 'evo-copy' }, [
          el('strong', {}, target.name),
          el('span', {}, `${ELEMENTS[target.element].name} · ${target.rarity}`),
          el('span', { class: 'small-note' }, target.desc),
        ]),
        button(itemId ? `Use ${getItem(itemId).name}` : 'Evolve', () => {
          if (itemId) {
            if (itemCount(this.state, itemId) <= 0) {
              toast({ title: 'Missing item', text: `You need a ${getItem(itemId).name}.`, tone: 'warn' })
              return
            }
            removeItem(this.state, itemId, 1)
          }
          const result = evolveMonster(monster, evo, this.state)
          closeModal()
          this.showEvolutionResult(result, after)
          this.afterChange()
        }, { variant: 'primary', icon: '✦' }),
      ]))
    }
    openModal({
      title: `Evolve ${monster.nickname}?`,
      subtitle: 'Evolution is permanent — but rarely a mistake.',
      icon: '✦', body: content, size: 'medium',
      footer: button('Not now', closeModal, { variant: 'ghost' }),
    })
  }

  showEvolutionResult(result, after = null) {
    const content = el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' } })
    content.append(
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
        monsterSpriteImg(result.from.id, { size: 92, className: 'silhouette' }),
        el('span', { style: { fontSize: '28px', color: 'var(--gold)' } }, '→'),
        monsterSpriteImg(result.to.id, { size: 128 }),
      ]),
      el('h3', { style: { fontSize: '20px' } }, `${result.from.name} evolved into ${result.to.name}!`),
      el('p', { class: 'small-note' }, result.newSkills?.length
        ? `New skills learned: ${result.newSkills.map(id => getSkill(id).name).join(', ')}`
        : 'Its old skills carried over. Check the detail screen to tune its moves.'),
    )
    openModal({
      title: 'Evolution',
      subtitle: 'A bond made visible',
      icon: '✦', body: content, size: 'small',
      footer: button('Continue', () => {
        closeModal()
        this.refreshHud()
        after?.()
      }, { variant: 'primary', icon: '✦' }),
    })
  }

  showEvolutionQueue(queue) {
    const seen = new Set()
    const filtered = []
    for (const entry of queue) {
      if (!entry?.monster?.uid || seen.has(entry.monster.uid)) continue
      seen.add(entry.monster.uid)
      filtered.push(entry)
    }
    const next = () => {
      const entry = filtered.shift()
      if (!entry) { this.afterChange(); return }
      const monster = entry.monster
      const evo = entry.evo
      const species = getMonster(monster.speciesId)
      if (!(species.evolutions || []).some(e => e.to === evo.to)) { next(); return }
      const target = getMonster(evo.to)
      const body = el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' } }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
          monsterSpriteImg(monster.speciesId, { size: 88 }),
          el('span', { style: { fontSize: '26px', color: 'var(--gold)' } }, '→'),
          monsterSpriteImg(evo.to, { size: 124 }),
        ]),
        el('p', { style: { fontSize: '13px', color: 'var(--ink-soft)' } }, `${monster.nickname} can evolve into ${target.name}.`),
        el('div', { class: 'battle-meta' }, [elementBadge(target.element), rarityBadge(target.rarity)]),
      ])
      openModal({
        title: 'Evolution ready',
        subtitle: 'The battle shook something loose.',
        icon: '✦', body, size: 'small',
        footer: el('div', { class: 'row gap end' }, [
          button('Later', () => { closeModal(); next() }, { variant: 'ghost' }),
          button('Evolve', () => {
            const result = evolveMonster(monster, evo, this.state)
            closeModal()
            this.showEvolutionResult(result, next)
            this.afterChange()
          }, { variant: 'primary', icon: '✦' }),
        ]),
      })
    }
    next()
  }

  // ── mobile controls ───────────────────────────────────────────────────────
  buildMobileControls() {
    const wrap = el('div', { class: 'mobile-controls' })
    const dpad = el('div', { class: 'dpad' })
    const make = (dir, cls, glyph) => {
      const btn = el('button', { class: cls, 'aria-label': dir }, glyph)
      const press = e => {
        e.preventDefault()
        btn.classList.add('pressed')
        this.mobileKeys.add(dir)
        try { btn.setPointerCapture?.(e.pointerId) } catch {}
      }
      const release = e => {
        e?.preventDefault?.()
        btn.classList.remove('pressed')
        this.mobileKeys.delete(dir)
      }
      btn.addEventListener('pointerdown', press)
      btn.addEventListener('pointerup', release)
      btn.addEventListener('pointercancel', release)
      btn.addEventListener('pointerleave', release)
      return btn
    }
    dpad.append(
      make('up', 'dpad-up', '▲'),
      make('left', 'dpad-left', '◀'),
      make('right', 'dpad-right', '▶'),
      make('down', 'dpad-down', '▼'),
    )

    const actionPad = el('div', { class: 'action-pad' })
    this.actionBtn = el('button', { class: 'action-btn', 'aria-label': 'Interact' }, [
      el('span', { class: 'action-glyph' }, '✦'),
      el('span', { class: 'action-label' }, 'ACTION'),
    ])
    this.actionBtn.addEventListener('pointerdown', e => {
      e.preventDefault()
      this.actionBtn.classList.add('pressed')
      this.interact()
    })
    const clear = () => this.actionBtn.classList.remove('pressed')
    this.actionBtn.addEventListener('pointerup', clear)
    this.actionBtn.addEventListener('pointercancel', clear)
    this.actionBtn.addEventListener('pointerleave', clear)
    const menu = el('button', { class: 'mobile-menu-btn', 'aria-label': 'Menu' }, '☰')
    menu.addEventListener('click', () => this.openMenu())
    this.runBtn = el('button', {
      class: 'mobile-run-btn', 'aria-label': 'Toggle sprint', 'aria-pressed': 'false', title: 'Sprint',
    }, 'RUN')
    this.runBtn.addEventListener('click', () => {
      this.mobileRun = !this.mobileRun
      this.runBtn.classList.toggle('active', this.mobileRun)
      this.runBtn.setAttribute('aria-pressed', String(this.mobileRun))
      try { navigator.vibrate?.(8) } catch {}
    })
    const subPad = el('div', { class: 'mobile-subpad' }, [this.runBtn, menu])
    actionPad.append(this.actionBtn, subPad)

    wrap.append(dpad, actionPad)
    return wrap
  }

  setInteractLabel(near) {
    if (!this.actionBtn) return
    const label = !near ? 'LOOK'
      : near.kind === 'npc' ? 'TALK'
        : near.kind === 'resource' ? 'GATHER'
          : near.kind === 'boss' || near.kind === 'mythic' ? 'CHALLENGE'
            : near.kind === 'wild' ? 'ENCOUNTER' : 'ACTION'
    const glyph = !near ? '✦'
      : near.kind === 'npc' ? '…'
        : near.kind === 'resource' ? '✧'
          : near.kind === 'boss' || near.kind === 'mythic' ? '⚔'
            : near.kind === 'wild' ? '◉' : '✦'
    const labelEl = this.actionBtn.querySelector('.action-label')
    const glyphEl = this.actionBtn.querySelector('.action-glyph')
    if (labelEl) labelEl.textContent = label
    if (glyphEl) glyphEl.textContent = glyph
    this.actionBtn.classList.toggle('disabled', !near)
  }

  // ── persistence & helpers ─────────────────────────────────────────────────
  updatePlayerState() {
    if (!this.world || !this.state) return
    this.state.player.x = this.world.player.x
    this.state.player.y = this.world.player.y
    this.state.player.dir = this.world.player.dir
    this.state.player.biome = this.world.currentBiome
  }

  save() {
    if (!this.state || this.mode !== 'game') return false
    this.updatePlayerState()
    return saveGame(this.state)
  }

  // Called by the pause menu's "Delete Save" action. The screens layer clears
  // the modal and returns to the title afterwards.
  deleteSave() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer)
      this.autosaveTimer = null
    }
    eraseSave()
    return true
  }

  debounceSave() {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer)
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null
      this.save()
    }, 900)
  }

  // Phone browsers can suspend a tab without firing beforeunload. A light
  // interval keeps exploration progress safe during long sessions.
  startAutosave() {
    this.stopAutosave()
    this.saveInterval = setInterval(() => {
      if (this.mode === 'game' && this.state?.settings?.autosave && !this.battleUI && !isModalOpen()) {
        this.save()
      }
    }, 20000)
  }

  stopAutosave() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval)
      this.saveInterval = null
    }
  }

  applySettings() {
    if (!this.state) return
    document.body.classList.toggle('no-shake', !this.state.settings?.screenShake)
  }

  playerAvatarUrl() {
    return playerSprite('down', 0).toDataURL()
  }

  achievementToastPublic(achievement) {
    this.achievementToast(achievement)
  }
}

function helpCard(icon, title, text) {
  return el('div', { class: 'help-card' }, [
    el('div', { class: 'help-icon' }, icon),
    el('h3', {}, title),
    el('p', {}, text),
  ])
}

// boot
const app = new GameApp()
window.__AETHERIA__ = app
