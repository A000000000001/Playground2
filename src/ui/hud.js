// In-game HUD: trainer card, navigation, party dock, tracked quest, interaction hint.

import { el } from './common.js'
import { BIOMES } from '../data/biomes.js'
import { getMonster } from '../data/monsters.js'
import { monsterSprite } from '../render/sprites.js'
import { trackedQuestData } from '../game/progress.js'
import { trainerTitle } from '../game/state.js'
import { formatTime, isNight, timeOfDay } from '../core/utils.js'
import { maxHpOf } from '../game/monsters.js'
import { STATUS } from '../data/elements.js'

export class HUD {
  constructor(root, app) {
    this.root = root
    this.app = app
    this.last = {}
    this.build()
  }

  build() {
    this.root.innerHTML = ''
    this.trainer = el('button', { class: 'hud-trainer', onclick: () => this.app.openParty(), title: 'Open party' })
    this.region = el('div', { class: 'hud-region' })
    this.timeEl = el('div', { class: 'hud-time' })
    this.nav = el('nav', { class: 'hud-nav' })
    const makeNav = (label, icon, fn, key, cls = '') => {
      const b = el('button', { class: `nav-btn ${cls}`, onclick: fn, title: `${label} (${key})` }, [
        el('span', { class: 'nav-icon' }, icon),
        el('span', { class: 'nav-label' }, label),
        el('span', { class: 'nav-key' }, key),
      ])
      this.nav.append(b)
      return b
    }
    makeNav('Party', '◉', () => this.app.openParty(), 'P')
    makeNav('Codex', '▤', () => this.app.openDex(), 'C')
    makeNav('Bag', '◈', () => this.app.openBag(), 'B')
    makeNav('Map', '⌖', () => this.app.openMap(), 'M')
    makeNav('Quests', '✎', () => this.app.openQuests(), 'J')
    makeNav('Menu', '☰', () => this.app.openMenu(), 'Esc', 'menu-btn')

    const top = el('div', { class: 'hud-top' }, [
      this.trainer,
      el('div', { class: 'hud-center' }, [this.region, this.timeEl]),
      this.nav,
    ])

    this.dock = el('div', { class: 'party-dock' })
    this.quest = el('button', { class: 'hud-quest', onclick: () => this.app.openQuests() })
    this.hint = el('div', { class: 'hud-hint' })
    this.lead = el('div', { class: 'hud-lead' })

    const bottom = el('div', { class: 'hud-bottom' }, [
      this.quest,
      this.hint,
      this.lead,
    ])
    this.root.append(top, el('div', { class: 'hud-spacer' }), this.dock, bottom)
  }

  update() {
    const app = this.app
    const state = app.state
    if (!state) return
    const world = app.world
    const p = state.player
    const biome = BIOMES[world?.currentBiome] || BIOMES.forest
    const lead = state.party.find(m => !m.isEgg && m.hp > 0) || state.party.find(m => !m.isEgg)
    const night = isNight(state.time.minutes)

    // Trainer card (rebuild only when values change)
    const trainerKey = `${p.trainerLevel}|${p.money}|${p.trainerXp}`
    if (this.last.trainerKey !== trainerKey) {
      this.last.trainerKey = trainerKey
      this.trainer.innerHTML = ''
      const avatar = el('img', { class: 'trainer-avatar pixel-sprite', alt: 'trainer' })
      avatar.src = app.playerAvatarUrl()
      this.trainerRegion = el('div', { class: 'trainer-region' })
      const info = el('div', { class: 'trainer-copy' }, [
        el('div', { class: 'trainer-line' }, [
          el('strong', {}, p.name),
          el('span', { class: 'trainer-lv' }, `Lv.${p.trainerLevel}`),
        ]),
        el('div', { class: 'trainer-title-line' }, trainerTitle(p.trainerLevel)),
        this.trainerRegion,
        el('div', { class: 'trainer-sub' }, [
          el('span', { class: 'money' }, `◈ ${p.money.toLocaleString()}`),
          el('span', { class: 'badges' }, `${Object.values(state.flags.bosses).filter(Boolean).length} / 8 guardians`),
        ]),
      ])
      this.trainer.append(avatar, info)
    }

    // Compact region + clock line, shown inside the trainer card on phones.
    const regionLineKey = `${biome.id}|${Math.floor(state.time.minutes / 5)}|${p.money}`
    if (this.trainerRegion && this.last.regionLineKey !== regionLineKey) {
      this.last.regionLineKey = regionLineKey
      this.trainerRegion.textContent = `${formatTime(state.time.minutes)} ${night ? '☾' : '·'} ${biome.name.split(' ')[0]}`
    }

    const regionKey = `${biome.id}|${night}`
    if (this.last.regionKey !== regionKey) {
      this.last.regionKey = regionKey
      this.region.innerHTML = ''
      this.region.append(
        el('span', { class: 'region-icon', style: { color: biome.hue } }, biome.icon),
        el('div', { class: 'region-copy' }, [
          el('strong', {}, biome.name),
          el('span', {}, `${timeOfDay(state.time.minutes)}${night ? ' · monsters stir' : ''}`),
        ]),
      )
    }

    const timeKey = `${Math.floor(state.time.minutes)}|${state.time.day}`
    if (this.last.timeKey !== timeKey) {
      this.last.timeKey = timeKey
      this.timeEl.innerHTML = ''
      this.timeEl.append(
        el('span', { class: 'clock-icon' }, night ? '☾' : '☀'),
        el('span', {}, formatTime(state.time.minutes)),
        el('span', { class: 'day-label' }, `Day ${state.time.day}`),
      )
    }

    // Party dock
    const dockKey = state.party.map(m => `${m.uid}:${m.hp}:${m.status}:${m.level}:${m.isEgg}`).join('|')
    if (this.last.dockKey !== dockKey) {
      this.last.dockKey = dockKey
      this.dock.innerHTML = ''
      for (let i = 0; i < 6; i++) {
        const m = state.party[i]
        if (!m) {
          this.dock.append(el('div', { class: 'dock-slot empty' }, [el('span', {}, '+')]))
          continue
        }
        const pct = m.isEgg ? 1 : Math.max(0, m.hp / maxHpOf(m))
        const status = m.status ? STATUS[m.status] : null
        const slot = el('button', {
          class: `dock-slot ${m.hp <= 0 && !m.isEgg ? 'fainted' : ''} ${i === 0 ? 'lead' : ''}`,
          onclick: () => this.app.openParty(),
          title: `${m.nickname} · Lv.${m.level}`,
        }, [
          (() => {
            const img = el('img', { class: 'dock-sprite pixel-sprite', alt: m.nickname })
            img.src = monsterSprite(m.speciesId, { egg: m.isEgg, hatchRatio: m.isEgg ? 1 - m.hatchSteps / m.hatchMax : 0 }).toDataURL()
            return img
          })(),
          el('div', { class: 'dock-hp' }, [el('div', { class: 'dock-hp-fill', style: { width: pct * 100 + '%', background: pct > 0.5 ? '#78d9a4' : pct > 0.22 ? '#ffd36e' : '#ff7a7a' } })]),
          status ? el('span', { class: 'dock-status', style: { color: status.color } }, status.glyph) : null,
          el('span', { class: 'dock-lv' }, m.isEgg ? 'EGG' : 'Lv.' + m.level),
        ])
        this.dock.append(slot)
      }
    }

    // Tracked quest
    const tq = trackedQuestData(state)
    const questKey = tq ? `${tq.quest.id}|${tq.status}|${tq.progress.map(o => o.current).join(',')}` : 'none'
    if (this.last.questKey !== questKey) {
      this.last.questKey = questKey
      this.quest.innerHTML = ''
      if (tq) {
        const next = tq.progress.find(o => !o.done) || tq.progress[0]
        this.quest.append(
          el('div', { class: 'quest-eyebrow' }, [el('span', {}, 'TRACKED QUEST'), tq.status === 'ready' ? el('span', { class: 'quest-ready' }, 'READY') : null]),
          el('strong', {}, tq.quest.name),
          el('div', { class: 'quest-obj' }, next ? `${next.label}: ${Math.min(next.current, next.target)}/${next.target}` : ''),
        )
      } else {
        this.quest.append(el('div', { class: 'quest-eyebrow' }, 'QUEST LOG'), el('strong', {}, 'Speak with quest givers'), el('div', { class: 'quest-obj' }, 'Find the golden “!” in every town.'))
      }
    }

    // Hint
    const near = app.near
    let hintText = 'WASD / Arrows to move · E to interact'
    let hintIcon = '➜'
    if (app.uiBlocked) hintText = ''
    else if (near) {
      const e = near.entity
      if (near.kind === 'npc') { hintText = `Talk to ${e.name}`; hintIcon = e.role === 'trainer' ? '⚔' : e.role === 'healer' ? '✚' : e.role === 'shop' ? '◈' : '…' }
      else if (near.kind === 'resource') { hintText = `Gather ${e.item.replace(/_/g, ' ')}`; hintIcon = '✧' }
      else if (near.kind === 'boss') { hintText = `Challenge ${e.name}`; hintIcon = '⚔' }
      else if (near.kind === 'mythic') { hintText = `A mythic presence…`; hintIcon = '✧' }
      else if (near.kind === 'wild') { hintText = `Wild ${getMonster(e.speciesId).name} Lv.${e.monster.level}`; hintIcon = '◉' }
    } else if (night) { hintText = 'Night falls. Nocturnal monsters are waking.'; hintIcon = '☾' }
    const hintKey = hintText + hintIcon
    if (this.last.hintKey !== hintKey) {
      this.last.hintKey = hintKey
      this.hint.innerHTML = ''
      this.hint.append(el('span', { class: 'hint-icon' }, hintIcon), el('span', {}, hintText))
      this.hint.classList.toggle('hidden', !hintText)
      app.setInteractLabel(near)
    }

    // Lead monster mini card
    const leadKey = lead ? `${lead.uid}:${lead.hp}:${lead.status}` : 'none'
    if (this.last.leadKey !== leadKey) {
      this.last.leadKey = leadKey
      this.lead.innerHTML = ''
      if (lead) {
        const img = el('img', { class: 'lead-sprite pixel-sprite' })
        img.src = monsterSprite(lead.speciesId).toDataURL()
        const pct = lead.hp / maxHpOf(lead)
        const leadChildren = [
          img,
          el('div', { class: 'lead-copy' }, [
            el('strong', {}, lead.nickname),
            el('span', {}, `Lv.${lead.level} · ${getMonster(lead.speciesId).name}`),
            el('div', { class: 'lead-hp' }, [el('div', { style: { width: pct * 100 + '%', background: pct > 0.5 ? '#78d9a4' : pct > 0.22 ? '#ffd36e' : '#ff7a7a' } })]),
          ]),
        ]
        if (lead.status) leadChildren.push(el('span', { class: 'lead-status', style: { color: STATUS[lead.status].color } }, STATUS[lead.status].glyph))
        this.lead.append(...leadChildren)
      }
    }
  }
}
