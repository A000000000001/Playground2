// All non-battle UI screens: party, monster details, codex, bag, map, quests,
// menu/settings, shop, quest NPCs, dialogue, breeding, evolution.

import {
  el, openModal, closeModal, toast, isModalOpen, button, spriteImg, monsterSpriteImg,
  elementBadge, rarityBadge, statusBadge, hpBar, xpBar, tabs, progressRow, emptyState,
  monsterIcon, monsterName, itemIcon, confirm, chip,
} from './common.js'
import { MONSTER_LIST, getMonster } from '../data/monsters.js'
import { BIOMES, BIOME_LIST, BIOME_ORDER } from '../data/biomes.js'
import { getItem, ITEMS, RECIPES } from '../data/items.js'
import { getSkill } from '../data/skills.js'
import { ELEMENTS, RARITY, STATUS, STAT_LABELS } from '../data/elements.js'
import { QUESTS, ACHIEVEMENTS } from '../data/quests.js'
import { questsForNpc, questProgress, startQuest, claimQuest, questCounts, trackedQuestData } from '../game/progress.js'
import { statsOf, maxHpOf, xpNeed, xpProgress, evolutionCandidates as evoCandidates, PERSONALITIES } from '../game/monsters.js'
import { useFieldItem, craftItem, canCraft, buyItem, sellItem, healAllAtNpc } from '../game/inventory.js'
import { addMonster, itemCount, trainerProgress, trainerTitle, caughtCount, seenCount, bossCount, addItem } from '../game/state.js'
import { createEgg } from '../game/monsters.js'
import { clamp, formatTime, isNight, timeOfDay, roman } from '../core/utils.js'
import { playerSprite, npcSprite } from '../render/sprites.js'

const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']

export class Screens {
  constructor(app) {
    this.app = app
  }

  get state() { return this.app.state }
  get world() { return this.app.world }

  // ── party & storage ───────────────────────────────────────────────────────
  openParty(tab = 'party') {
    let activeTab = tab
    const content = el('div', { class: 'party-screen' })
    const root = openModal({
      title: 'Your Companions',
      subtitle: 'Six can travel with you. The rest rest at home.',
      icon: '◉', body: content, size: 'large',
      eyebrow: `${this.state.party.length} / 6 in party · ${this.state.storage.length} in storage`,
    })
    const render = () => {
      content.innerHTML = ''
      const counts = { party: this.state.party.length, storage: this.state.storage.length }
      content.append(tabs([
        { id: 'party', label: `Party (${counts.party})` },
        { id: 'storage', label: `Storage (${counts.storage})` },
      ], activeTab, id => { activeTab = id; render() }))
      if (activeTab === 'party') content.append(this.partyGrid(render))
      else content.append(this.storageGrid(render))
    }
    render()
    return root
  }

  partyGrid(rerender) {
    const wrap = el('div', { class: 'party-layout' })
    const grid = el('div', { class: 'party-grid' })
    for (let i = 0; i < 6; i++) {
      const m = this.state.party[i]
      if (!m) {
        grid.append(el('div', { class: 'party-slot empty' }, [
          el('div', { class: 'empty-slot-icon' }, '＋'),
          el('span', {}, 'Empty slot'),
        ]))
        continue
      }
      const isEgg = m.isEgg
      const card = el('div', { class: `party-card ${m.hp <= 0 && !isEgg ? 'fainted' : ''} ${i === 0 ? 'is-lead' : ''}` })
      const portrait = el('button', { class: 'party-portrait', onclick: () => this.openMonsterDetail(m, rerender) }, [
        monsterIcon(m, 104),
        i === 0 ? el('span', { class: 'lead-ribbon' }, 'LEAD') : null,
        m.status ? statusBadge(m.status) : null,
      ])
      const info = el('div', { class: 'party-info' }, [
        el('div', { class: 'party-name-row' }, [
          el('strong', {}, monsterName(m)),
          el('span', { class: 'party-lv' }, isEgg ? 'EGG' : `Lv.${m.level}`),
        ]),
        el('div', { class: 'party-tags' }, isEgg
          ? [chip('Hatching soon', 'warm'), chip(`${Math.max(0, m.hatchSteps)} steps`)]
          : [elementBadge(getMonster(m.speciesId).element, true), rarityBadge(getMonster(m.speciesId).rarity)]),
        isEgg ? this.eggProgress(m) : hpBar(m.hp, maxHpOf(m)),
        !isEgg ? el('div', { class: 'party-meta' }, [
          el('span', {}, `♥ ${m.friendship}`),
          el('span', {}, getMonster(m.speciesId).name),
        ]) : null,
      ])
      const actions = el('div', { class: 'party-actions' }, [
        button('Details', () => this.openMonsterDetail(m, rerender), { variant: 'ghost', className: 'small' }),
        i > 0 && !isEgg ? button('Lead', () => this.setLead(i, rerender), { variant: 'ghost', className: 'small' }) : null,
        this.state.party.length > 1 ? button('Store', () => this.deposit(m, rerender), { variant: 'ghost', className: 'small' }) : null,
      ])
      card.append(portrait, info, actions)
      grid.append(card)
    }
    const side = el('aside', { class: 'party-side' }, [
      el('div', { class: 'panel-soft' }, [
        el('div', { class: 'eyebrow' }, 'PARTY TIPS'),
        el('h3', {}, 'Lead with intent'),
        el('p', {}, 'The first healthy monster leads encounters. Reorder your party or use “Lead” to put a sturdier friend in front.'),
        el('div', { class: 'small-note' }, 'Fainted monsters can be revived with Revive Shards at any time.'),
      ]),
      el('button', { class: 'quick-link', onclick: () => { closeModal(); this.openBag('items') } }, '◈ Open Bag'),
      el('button', { class: 'quick-link', onclick: () => { closeModal(); this.openStorage() } }, '▣ Manage Storage'),
    ])
    wrap.append(grid, side)
    return wrap
  }

  eggProgress(m) {
    const pct = 1 - m.hatchSteps / m.hatchMax
    return el('div', { class: 'egg-progress' }, [
      el('div', { class: 'thin-track' }, [el('div', { class: 'thin-fill warm', style: { width: pct * 100 + '%' } })]),
      el('span', {}, `${Math.round(pct * 100)}% — keep walking`),
    ])
  }

  storageGrid(rerender) {
    const wrap = el('div', { class: 'storage-wrap' })
    if (!this.state.storage.length) {
      wrap.append(emptyState('▣', 'Storage is empty', 'Monsters you catch with a full party will rest here.'))
      return wrap
    }
    const grid = el('div', { class: 'storage-grid' })
    for (const m of this.state.storage) {
      const card = el('div', { class: 'storage-card' }, [
        el('button', { class: 'storage-portrait', onclick: () => this.openMonsterDetail(m, () => this.openStorage()) }, [monsterIcon(m, 68)]),
        el('div', { class: 'storage-copy' }, [
          el('div', { class: 'party-name-row' }, [el('strong', {}, monsterName(m)), el('span', { class: 'party-lv' }, `Lv.${m.level}`)]),
          el('div', { class: 'party-tags' }, [elementBadge(getMonster(m.speciesId).element, true), rarityBadge(getMonster(m.speciesId).rarity)]),
          el('div', { class: 'storage-meta' }, `${getMonster(m.speciesId).name} · ♥ ${m.friendship}`),
        ]),
        el('div', { class: 'storage-actions' }, [
          button('Withdraw', () => this.withdraw(m, rerender), { variant: 'primary', className: 'small', disabled: this.state.party.length >= 6 }),
        ]),
      ])
      grid.append(card)
    }
    wrap.append(grid)
    return wrap
  }

  openStorage() { this.openParty('storage') }

  setLead(index, rerender) {
    const m = this.state.party.splice(index, 1)[0]
    this.state.party.unshift(m)
    this.app.refreshHud()
    toast({ title: 'Party reordered', text: `${monsterName(m)} will lead encounters.`, icon: '◉' })
    rerender()
  }

  deposit(monster, rerender) {
    if (this.state.party.length <= 1) return toast({ title: 'Cannot store', text: 'You need at least one monster with you.', tone: 'warn' })
    this.state.storage.push(monster)
    this.state.party = this.state.party.filter(m => m.uid !== monster.uid)
    this.app.refreshHud()
    toast({ title: 'Stored', text: `${monsterName(monster)} is resting in storage.`, icon: '▣' })
    rerender()
  }

  withdraw(monster, rerender) {
    if (this.state.party.length >= 6) return toast({ title: 'Party full', text: 'Deposit a monster first.', tone: 'warn' })
    this.state.storage = this.state.storage.filter(m => m.uid !== monster.uid)
    this.state.party.push(monster)
    this.app.refreshHud()
    toast({ title: 'Withdrawn', text: `${monsterName(monster)} joined your party.`, icon: '◉' })
    rerender()
  }

  // ── monster detail ────────────────────────────────────────────────────────
  openMonsterDetail(monster, onBack = null) {
    const sp = getMonster(monster.speciesId)
    const content = el('div', { class: 'detail-screen' })
    const footer = el('div', { class: 'row gap between wrap' })
    const root = openModal({
      title: monsterName(monster), subtitle: `${sp.name} · ${sp.rarity} ${ELEMENTS[sp.element].name} monster`,
      icon: sp.look?.body === 'spirit' ? '☾' : '◉', body: content, footer, size: 'xlarge',
      eyebrow: `MONSTER #${String(MONSTER_LIST.findIndex(x => x.id === sp.id) + 1).padStart(3, '0')} · ${BIOMES[sp.biome]?.name || ''}`,
      onClose: onBack,
    })
    const render = () => {
      content.innerHTML = ''
      footer.innerHTML = ''
      const stats = statsOf(monster)
      const pers = PERSONALITIES[monster.personality] || PERSONALITIES.hardy
      const cands = evoCandidates(monster, { biome: this.world?.currentBiome })
      const itemEvos = (sp.evolutions || []).filter(e => e.type === 'item' && monster.level >= (e.level || 1))

      // Left column
      const art = el('div', { class: 'detail-art' }, [
        monster.isEgg
          ? el('div', { class: 'detail-sprite-wrap' }, [monsterSpriteImg(sp.id, { size: 200, egg: true, hatchRatio: 1 - monster.hatchSteps / monster.hatchMax })])
          : el('div', { class: 'detail-sprite-wrap' }, [monsterSpriteImg(sp.id, { size: 200 })]),
        el('div', { class: 'detail-tags' }, [elementBadge(sp.element), rarityBadge(sp.rarity)]),
        el('div', { class: 'detail-hp' }, monster.isEgg ? this.eggProgress(monster) : hpBar(monster.hp, maxHpOf(monster))),
        monster.isEgg ? null : el('div', { class: 'detail-xp' }, [el('div', { class: 'eyebrow' }, 'EXPERIENCE'), xpBar(monster)]),
        el('div', { class: 'detail-meta-grid' }, [
          metaPair('Level', monster.level), metaPair('Friendship', `♥ ${monster.friendship} / 100`),
          metaPair('Personality', pers.name), metaPair('Status', monster.status ? STATUS[monster.status].name : 'Healthy'),
          metaPair('Met at', `Lv.${monster.metLevel || monster.level}`), metaPair('Found in', BIOMES[monster.caughtBiome]?.short || sp.biome),
        ]),
        monster.isEgg ? null : el('button', { class: 'quick-link', onclick: () => this.renameMonster(monster, render) }, '✎ Change nickname'),
      ])

      // Right column
      const right = el('div', { class: 'detail-main' })
      if (!monster.isEgg) {
        const statBlock = el('div', { class: 'panel-soft detail-block' }, [
          el('div', { class: 'block-head' }, [el('h3', {}, 'Battle Stats'), el('span', { class: 'small-note' }, pers.desc)]),
          el('div', { class: 'stat-list' }, STAT_ORDER.map(key => {
            const value = stats[key]
            const baseMax = key === 'hp' ? 260 : 190
            const pct = clamp(value / baseMax, 0.06, 1) * 100
            const mod = (key === pers.plus ? ' plus' : key === pers.minus ? ' minus' : '')
            return el('div', { class: 'stat-row' }, [
              el('span', { class: 'stat-name' }, STAT_LABELS[key]),
              el('span', { class: `stat-value${mod}` }, String(value)),
              el('div', { class: 'stat-track' }, [el('div', { class: `stat-fill stat-${key}`, style: { width: pct + '%' } })]),
            ])
          })),
        ])

        const passive = el('div', { class: 'panel-soft detail-block' }, [
          el('div', { class: 'block-head' }, [el('h3', {}, 'Passive Ability'), chip('Always active', 'soft')]),
          el('div', { class: 'passive-row' }, [
            el('span', { class: 'passive-icon' }, '✦'),
            el('div', {}, [el('strong', {}, sp.passiveInfo?.name || this.passiveName(sp.passive)), el('p', {}, this.passiveDesc(sp.passive))]),
          ]),
        ])

        const moveRows = monster.moves.map((id, idx) => this.moveRow(id, idx, monster, render, true))
        const movesPanel = el('div', { class: 'panel-soft detail-block' }, [
          el('div', { class: 'block-head' }, [
            el('h3', {}, 'Equipped Skills'),
            el('span', { class: 'small-note' }, `${monster.moves.length} / 4 equipped`),
          ]),
          el('div', { class: 'move-list' }, moveRows),
          el('details', { class: 'learned-details' }, [
            el('summary', {}, `All learned skills (${monster.learned.length})`),
            el('div', { class: 'move-list learned' }, this.uniqueLearned(monster).map(id => this.moveRow(id, monster.moves.indexOf(id), monster, render, false))),
          ]),
        ])

        const evoBlock = el('div', { class: 'panel-soft detail-block' }, [
          el('div', { class: 'block-head' }, [el('h3', {}, 'Evolution'), el('span', { class: 'small-note' }, cands.length ? 'A new form is within reach.' : 'Keep growing to unlock new forms.')]),
        ])
        if (cands.length) {
          for (const evo of cands) {
            const target = getMonster(evo.to)
            evoBlock.append(el('div', { class: 'evo-option' }, [
              monsterSpriteImg(target.id, { size: 64 }),
              el('div', { class: 'evo-copy' }, [
                el('strong', {}, target.name),
                el('span', {}, this.evolutionRequirement(evo, sp)),
              ]),
              button('Evolve', () => this.app.showEvolutionChooser(monster, cands, () => { render(); onBack?.() }), { className: 'small', variant: 'primary' }),
            ]))
          }
        } else {
          const next = sp.evolutions?.[0]
          evoBlock.append(el('p', { class: 'muted' }, next
            ? this.evolutionHint(sp, next)
            : 'This is the final form of its line.'))
        }
        for (const evo of itemEvos) {
          const target = getMonster(evo.to)
          const has = itemCount(this.state, evo.item)
          evoBlock.append(el('div', { class: 'evo-option item-evo' }, [
            monsterSpriteImg(target.id, { size: 56 }),
            el('div', { class: 'evo-copy' }, [el('strong', {}, target.name), el('span', {}, `Use ${getItem(evo.item).name} to evolve.`)]),
            button(has ? `Use ${getItem(evo.item).name} ×${has}` : 'No item', () => this.useEvolutionItem(monster, evo, render), { className: 'small', variant: has ? 'gold' : 'ghost', disabled: !has }),
          ]))
        }
        right.append(statBlock, movesPanel, evoBlock, passive)
      } else {
        right.append(el('div', { class: 'panel-soft detail-block egg-block' }, [
          el('div', { class: 'egg-emoji' }, '◈'),
          el('h3', {}, 'A warm little secret'),
          el('p', {}, `This egg will hatch into a ${getMonster(monster.speciesId).name}. Walk around the world to help it hatch.`),
          this.eggProgress(monster),
          el('div', { class: 'small-note' }, `Parents: ${(monster.parentSpecies || []).map(id => getMonster(id).name).join(' × ') || 'unknown'}`),
        ]))
      }
      content.append(art, right)

      // Footer
      if (!monster.isEgg) footer.append(button('Use Item', () => this.openItemPicker(monster, render), { variant: 'ghost', icon: '◈' }))
      if (onBack) footer.append(button('← Back', () => { closeModal(); onBack() }, { variant: 'primary' }))
      else footer.append(button('Close', closeModal, { variant: 'primary' }))
    }
    render()
    return root
  }

  uniqueLearned(monster) {
    return [...new Set(monster.learned)]
  }

  passiveName(id) { return { overgrow: 'Overgrow', blaze: 'Blaze', torrent: 'Torrent', thick_hide: 'Thick Hide', sturdy: 'Sturdy', lucky: 'Lucky', swift: 'Swift', armored: 'Armored', mystic: 'Mystic', regenerator: 'Regenerator', nocturnal: 'Nocturnal', levitate: 'Levitate', predator: 'Predator', radiant: 'Radiant', ...{} }[id] || id.replace(/_/g, ' ') }
  passiveDesc(id) {
    const map = {
      overgrow: 'Nature skills grow stronger below one third HP.', blaze: 'Flame skills grow stronger below one third HP.',
      torrent: 'Frost skills grow stronger below one third HP.', thick_hide: 'Takes reduced physical damage.',
      sturdy: 'Can survive a lethal hit at full HP with 1 HP.', lucky: 'Critical hits land more often.', swift: 'Speed is 14% higher.',
      armored: 'Defense is 16% higher.', mystic: 'Sp. Atk is 12% higher.', regenerator: 'Restores 6% HP at the end of each turn.',
      nocturnal: 'Skills are stronger at night.', levitate: 'Immune to Earth attacks.', predator: 'Deals more damage to weakened foes.',
      radiant: 'Light skills are 16% stronger.', soul_guard: 'Takes less Shadow damage.', static_body: 'May paralyze attackers on contact.',
      frost_aura: 'May freeze attackers on contact.', spore_aura: 'May poison attackers on contact.', sunbath: 'Heals slowly during the day.',
      diurnal: 'Skills are stronger during the day.', scavenger: 'Earns more money from battles.', ancient_power: 'Dragon skills are stronger.',
      storm_charge: 'Storm skills are stronger.', earthy: 'Earth skills are stronger.', chill: 'Frost skills are stronger.',
      shadow_veil: 'Shadow skills are stronger.', dragon_heart: 'Attack is 12% higher.',
    }
    return map[id] || 'A rare and mysterious ability.'
  }

  moveRow(id, index, monster, rerender, equipped) {
    const skill = getSkill(id)
    const e = ELEMENTS[skill.element] || ELEMENTS.none
    const isEquipped = monster.moves.includes(id)
    const row = el('div', { class: `move-row ${isEquipped ? 'equipped' : ''}` }, [
      el('span', { class: 'move-icon', style: { background: e.dark, color: e.color } }, e.glyph),
      el('div', { class: 'move-copy' }, [
        el('div', { class: 'move-name-row' }, [
          el('strong', {}, skill.name),
          el('span', { class: 'move-power' }, skill.power ? `PWR ${skill.power}` : 'STATUS'),
          el('span', { class: 'move-cost' }, `${skill.cost} EN`),
        ]),
        el('p', {}, skill.description),
      ]),
      button(isEquipped ? 'Unequip' : 'Equip', () => {
        if (isEquipped) {
          if (monster.moves.length <= 1) return toast({ title: 'Keep one skill', text: 'A monster needs at least one skill equipped.', tone: 'warn' })
          monster.moves = monster.moves.filter(x => x !== id)
        } else {
          if (monster.moves.length >= 4) return toast({ title: 'Skill slots full', text: 'Unequip a skill first.', tone: 'warn' })
          monster.moves.push(id)
        }
        rerender()
      }, { className: 'tiny', variant: isEquipped ? 'ghost' : 'primary' }),
    ])
    return row
  }

  evolutionRequirement(evo, sp) {
    if (evo.type === 'level') return `Reach level ${evo.level}.`
    if (evo.type === 'friendship') return `Reach level ${evo.level} with friendship ${evo.friendship}+.`
    if (evo.type === 'location') return `Level ${evo.level}+ while in ${BIOMES[evo.biome]?.name}.`
    if (evo.type === 'item') return `Use ${getItem(evo.item).name}.`
    return 'A special condition.'
  }

  evolutionHint(sp, evo) {
    return `At level ${evo.level || '?'} · ${this.evolutionRequirement(evo, sp)}`
  }

  useEvolutionItem(monster, evo, rerender) {
    if (itemCount(this.state, evo.item) <= 0) return
    this.app.showEvolutionChooser(monster, [evo], () => rerender(), evo.item)
  }

  renameMonster(monster, rerender) {
    let input
    const body = el('div', { class: 'rename-form' }, [
      el('p', {}, 'Give your companion a name that feels like home.'),
      (() => { input = el('input', { class: 'text-input', maxLength: 16, value: monster.nickname, placeholder: 'Nickname' }); return input })(),
      el('div', { class: 'row gap end' }, [
        button('Cancel', closeModal, { variant: 'ghost' }),
        button('Save', () => {
          const name = input.value.trim()
          if (!name) return toast({ title: 'Name required', tone: 'warn' })
          monster.nickname = name
          monster.nicknameCustom = true
          closeModal()
          rerender()
          this.app.refreshHud()
          toast({ title: 'Renamed', text: `Now called ${name}.`, icon: '✎' })
        }, { variant: 'primary' }),
      ]),
    ])
    openModal({ title: 'Nickname', icon: '✎', body, size: 'small' })
  }

  openItemPicker(monster, rerender) {
    const content = el('div', { class: 'item-picker' })
    const render = () => {
      content.innerHTML = ''
      const usable = Object.entries(this.state.inventory).filter(([id, count]) => {
        const item = getItem(id)
        if (!['potion', 'cure', 'revive', 'gift', 'evo'].includes(item.type) || count <= 0) return false
        if (item.type === 'evo') return evoCandidates(monster, { itemId: id }).length > 0
        return true
      })
      if (!usable.length) content.append(emptyState('◈', 'No suitable items', 'You have nothing that would help this monster right now.'))
      for (const [id, count] of usable) {
        const item = getItem(id)
        content.append(el('div', { class: 'picker-row' }, [
          itemIcon(id, 36),
          el('div', { class: 'picker-copy' }, [el('strong', {}, item.name), el('span', {}, item.desc)]),
          el('span', { class: 'count-pill' }, `×${count}`),
          button('Use', () => {
            const result = useFieldItem(this.state, id, monster.uid)
            closeModal()
            if (!result.ok) { toast({ title: 'Cannot use', text: result.message, tone: 'warn' }); return }
            if (result.evolution) this.app.showEvolutionResult(result.evolution, () => { rerender(); this.app.refreshHud() })
            else { toast({ title: 'Item used', text: result.message, icon: item.icon }); rerender(); this.app.refreshHud() }
            this.app.afterChange()
          }, { variant: 'primary', className: 'small' }),
        ]))
      }
    }
    render()
    openModal({ title: 'Use an Item', subtitle: `Choose something for ${monsterName(monster)}.`, icon: '◈', body: content, size: 'medium' })
  }

  // ── codex ────────────────────────────────────────────────────────────────
  openDex(filterBiome = 'all') {
    let biome = filterBiome
    let element = 'all'
    let statusFilter = 'all'
    let search = ''
    const content = el('div', { class: 'dex-screen' })
    const root = openModal({
      title: 'Monster Codex', icon: '▤', body: content, size: 'xlarge',
      subtitle: `${caughtCount(this.state)} caught · ${seenCount(this.state)} seen · ${MONSTER_LIST.length} species`,
    })
    const render = () => {
      content.innerHTML = ''
      const filters = el('div', { class: 'dex-filters' })
      const searchInput = el('input', { class: 'text-input search', placeholder: 'Search name…', value: search })
      searchInput.oninput = () => { search = searchInput.value; renderGrid() }
      const selBiome = el('select', { class: 'select-input', onchange: e => { biome = e.target.value; render() } },
        [el('option', { value: 'all' }, 'All biomes'), ...BIOME_LIST.map(b => el('option', { value: b.id, selected: biome === b.id }, b.name))])
      const selEl = el('select', { class: 'select-input', onchange: e => { element = e.target.value; render() } },
        [el('option', { value: 'all' }, 'All elements'), ...Object.entries(ELEMENTS).filter(([id]) => id !== 'none').map(([id, e]) => el('option', { value: id, selected: element === id }, e.name))])
      const selStatus = el('select', { class: 'select-input', onchange: e => { statusFilter = e.target.value; render() } },
        [el('option', { value: 'all', selected: statusFilter === 'all' }, 'All entries'), el('option', { value: 'caught', selected: statusFilter === 'caught' }, 'Caught'), el('option', { value: 'seen', selected: statusFilter === 'seen' }, 'Seen only'), el('option', { value: 'unknown', selected: statusFilter === 'unknown' }, 'Undiscovered')])
      filters.append(searchInput, selBiome, selEl, selStatus)
      content.append(filters)
      const caught = caughtCount(this.state)
      content.append(el('div', { class: 'dex-progress' }, [
        el('div', { class: 'eyebrow' }, 'CODEX COMPLETION'),
        el('div', { class: 'thin-track' }, [el('div', { class: 'thin-fill', style: { width: (caught / MONSTER_LIST.length) * 100 + '%' } })]),
        el('span', { class: 'small-note' }, `${Math.round(caught / MONSTER_LIST.length * 100)}% complete`),
      ]))
      const grid = el('div', { class: 'dex-grid' })
      content.append(grid)
      const renderGrid = () => {
        grid.innerHTML = ''
        const filtered = MONSTER_LIST.filter(sp => {
          const seen = !!this.state.pokedex.seen[sp.id]
          const isCaught = !!this.state.pokedex.caught[sp.id]
          if (biome !== 'all' && sp.biome !== biome) return false
          if (element !== 'all' && sp.element !== element) return false
          if (statusFilter === 'caught' && !isCaught) return false
          if (statusFilter === 'seen' && (!seen || isCaught)) return false
          if (statusFilter === 'unknown' && seen) return false
          if (search && !sp.name.toLowerCase().includes(search.toLowerCase())) return false
          return true
        })
        for (const sp of filtered) {
          const idx = MONSTER_LIST.findIndex(x => x.id === sp.id) + 1
          const seen = !!this.state.pokedex.seen[sp.id]
          const isCaught = !!this.state.pokedex.caught[sp.id]
          const card = el('button', {
            class: `dex-card ${!seen ? 'unknown' : ''} ${isCaught ? 'caught' : ''}`,
            onclick: () => { if (seen) this.openDexEntry(sp, () => this.openDex(biome)) },
          }, [
            el('span', { class: 'dex-num' }, `#${String(idx).padStart(3, '0')}`),
            el('div', { class: 'dex-sprite-wrap' }, [
              monsterSpriteImg(sp.id, { size: 64, className: seen ? '' : 'silhouette' }),
              isCaught ? el('span', { class: 'dex-check' }, '✔') : null,
            ]),
            el('div', { class: 'dex-name' }, seen ? sp.name : '???'),
            el('div', { class: 'dex-tags' }, [seen ? elementBadge(sp.element, true) : el('span', { class: 'muted' }, 'Undiscovered')]),
          ])
          grid.append(card)
        }
        if (!filtered.length) grid.append(emptyState('▤', 'No entries', 'Adjust your filters.'))
      }
      renderGrid()
    }
    render()
    return root
  }

  openDexEntry(sp, back) {
    const isCaught = !!this.state.pokedex.caught[sp.id]
    const seen = !!this.state.pokedex.seen[sp.id]
    const content = el('div', { class: 'dex-entry' })
    content.append(el('div', { class: 'dex-entry-art' }, [
      monsterSpriteImg(sp.id, { size: 220, className: seen ? '' : 'silhouette' }),
      el('div', { class: 'detail-tags' }, [elementBadge(sp.element), rarityBadge(sp.rarity), isCaught ? chip('Caught', 'good') : chip('Not caught', 'soft')]),
      el('p', { class: 'dex-desc' }, sp.desc),
      el('div', { class: 'dex-meta' }, [
        metaPair('Biome', BIOMES[sp.biome]?.name || '—'),
        metaPair('Capture rate', `${Math.round((sp.catchRate ?? RARITY[sp.rarity].catch) * 100)}% base`),
        metaPair('Wild levels', sp.wild === false ? 'Not found in the wild' : `${BIOMES[sp.biome].level[0]}–${BIOMES[sp.biome].level[1]}`),
        metaPair('Passive', this.passiveName(sp.passive)),
      ]),
    ]))
    const right = el('div', { class: 'dex-entry-main' }, [
      el('div', { class: 'panel-soft detail-block' }, [
        el('div', { class: 'block-head' }, [el('h3', {}, 'Base Stats'), el('span', { class: 'small-note' }, 'At level 50, before personality')]),
        el('div', { class: 'stat-list' }, STAT_ORDER.map(key => {
          const value = key === 'hp' ? Math.floor(sp.base.hp * 60 / 45) + 62 : Math.floor(sp.base[key] * 58 / 50) + 5
          const pct = key === 'hp' ? clamp(value / 260, 0.05, 1) * 100 : clamp(value / 190, 0.05, 1) * 100
          return el('div', { class: 'stat-row' }, [
            el('span', { class: 'stat-name' }, STAT_LABELS[key]),
            el('span', { class: 'stat-value' }, String(value)),
            el('div', { class: 'stat-track' }, [el('div', { class: `stat-fill stat-${key}`, style: { width: pct + '%' } })]),
          ])
        })),
      ]),
      el('div', { class: 'panel-soft detail-block' }, [
        el('div', { class: 'block-head' }, [el('h3', {}, 'Evolution Line')]),
        ...this.evolutionLine(sp),
      ]),
      el('div', { class: 'panel-soft detail-block' }, [
        el('div', { class: 'block-head' }, [el('h3', {}, 'Known Skills')]),
        el('div', { class: 'dex-skills' }, sp.learnset.map(([lvl, id]) => {
          const s = getSkill(id)
          const e = ELEMENTS[s.element] || ELEMENTS.none
          return el('div', { class: 'dex-skill-row' }, [el('span', { class: 'move-icon', style: { background: e.dark, color: e.color } }, e.glyph), el('span', {}, s.name), el('span', { class: 'muted' }, `Lv.${lvl}`)])
        })),
      ]),
    ])
    content.append(right)
    openModal({
      title: sp.name, eyebrow: `CODEX ENTRY`, icon: '▤', body: content, size: 'xlarge',
      subtitle: `${sp.rarity} · ${ELEMENTS[sp.element].name}`,
      footer: button('← Back to Codex', () => { closeModal(); back() }, { variant: 'primary' }),
    })
  }

  evolutionLine(sp) {
    const chain = (targetId, depth = 0) => {
      const target = getMonster(targetId)
      if (!target || depth > 3) return []
      const nodes = [el('div', { class: 'evo-line-node' }, [
        monsterSpriteImg(target.id, { size: 56 }),
        el('strong', {}, target.name),
      ])]
      for (const evo of target.evolutions || []) {
        const child = getMonster(evo.to)
        nodes.push(el('div', { class: 'evo-line-node child' }, [
          el('span', { class: 'evo-arrow' }, '→'),
          monsterSpriteImg(child.id, { size: 48 }),
          el('strong', {}, child.name),
          el('span', { class: 'small-note' }, this.evolutionRequirement(evo, target)),
        ]))
      }
      return nodes
    }
    return chain(sp.id)
  }

  // ── bag & crafting ───────────────────────────────────────────────────────
  openBag(tab = 'items') {
    let activeTab = tab
    const content = el('div', { class: 'bag-screen' })
    const root = openModal({
      title: 'Traveler\'s Bag', icon: '◈', body: content, size: 'large',
      subtitle: `◈ ${this.state.player.money.toLocaleString()} gold`,
    })
    const render = () => {
      content.innerHTML = ''
      content.append(tabs([{ id: 'items', label: 'Items' }, { id: 'craft', label: 'Crafting' }], activeTab, id => { activeTab = id; render() }))
      if (activeTab === 'items') {
        const groups = { orb: 'Capture Orbs', potion: 'Healing', cure: 'Cures', revive: 'Revives', battle: 'Battle Items', gift: 'Gifts', evo: 'Evolution Items', resource: 'Resources', key: 'Key Items' }
        const owned = Object.entries(this.state.inventory).filter(([, c]) => c > 0)
        if (!owned.length) content.append(emptyState('◈', 'Bag is empty', 'Buy supplies from a merchant or gather resources.'))
        for (const [type, label] of Object.entries(groups)) {
          const items = owned.filter(([id]) => getItem(id).type === type)
          if (!items.length) continue
          content.append(el('div', { class: 'bag-group' }, [
            el('div', { class: 'eyebrow' }, label.toUpperCase()),
            el('div', { class: 'item-grid' }, items.map(([id, count]) => this.itemCard(id, count, render))),
          ]))
        }
      } else {
        content.append(el('p', { class: 'muted craft-intro' }, 'Gather resources across the biomes, then turn them into orbs, potions and evolution items. Crafting is instant and free.'))
        const grid = el('div', { class: 'recipe-grid' })
        for (const r of RECIPES) {
          const out = getItem(r.out.item)
          const craftable = canCraft(this.state, r)
          grid.append(el('div', { class: `recipe-card ${craftable ? 'craftable' : ''}` }, [
            el('div', { class: 'recipe-head' }, [itemIcon(r.out.item, 40), el('div', {}, [el('strong', {}, `${out.name}${r.out.count > 1 ? ' ×' + r.out.count : ''}`), el('span', { class: 'small-note' }, out.desc)])]),
            el('div', { class: 'recipe-cost' }, r.cost.map(c => {
              const have = itemCount(this.state, c.item)
              return el('span', { class: `cost-chip ${have >= c.count ? 'ok' : 'missing'}` }, `${getItem(c.item).name} ${have}/${c.count}`)
            })),
            el('div', { class: 'recipe-foot' }, [
              el('span', { class: 'small-note' }, craftable ? 'Ready to craft' : 'Missing ingredients'),
              button('Craft', () => {
                const res = craftItem(this.state, r.id)
                toast({ title: res.ok ? 'Crafted' : 'Cannot craft', text: res.message, tone: res.ok ? 'success' : 'warn', icon: out.icon })
                if (res.ok) this.app.afterChange()
                render()
              }, { variant: craftable ? 'primary' : 'ghost', disabled: !craftable, className: 'small' }),
            ]),
          ]))
        }
        content.append(grid)
      }
    }
    render()
    return root
  }

  itemCard(id, count, rerender) {
    const item = getItem(id)
    const usable = ['potion', 'cure', 'revive', 'gift', 'evo'].includes(item.type)
    return el('div', { class: 'item-card' }, [
      itemIcon(id, 36),
      el('div', { class: 'item-copy' }, [el('div', { class: 'item-name-row' }, [el('strong', {}, item.name), el('span', { class: 'count-pill' }, `×${count}`)]), el('p', {}, item.desc)]),
      usable ? button('Use', () => this.pickMonsterForItem(item, rerender), { variant: 'ghost', className: 'small' }) : null,
    ])
  }

  pickMonsterForItem(item, rerender) {
    const content = el('div', { class: 'monster-picker-grid' })
    const all = [...this.state.party, ...this.state.storage].filter(m => !m.isEgg)
    if (!all.length) content.append(emptyState('◉', 'No monsters', 'Catch one first.'))
    for (const m of all) {
      content.append(el('button', {
        class: 'monster-pick-card',
        onclick: () => {
          const res = useFieldItem(this.state, item.id, m.uid)
          closeModal()
          if (!res.ok) { toast({ title: 'Cannot use', text: res.message, tone: 'warn' }); return }
          if (res.evolution) this.app.showEvolutionResult(res.evolution, () => { rerender(); this.app.refreshHud() })
          else { toast({ title: 'Item used', text: res.message, icon: item.icon }); rerender(); this.app.refreshHud() }
          this.app.afterChange()
        },
      }, [
        monsterIcon(m, 56),
        el('div', {}, [el('strong', {}, m.nickname), el('span', { class: 'small-note' }, `Lv.${m.level} · ${m.hp}/${maxHpOf(m)} HP`)]),
      ]))
    }
    openModal({ title: `Use ${item.name}`, icon: item.icon, body: content, size: 'medium', subtitle: item.desc })
  }

  // ── map ──────────────────────────────────────────────────────────────────
  openMap() {
    const world = this.world
    const content = el('div', { class: 'map-screen' })
    const canvasWrap = el('div', { class: 'map-canvas-wrap' })
    const canvas = el('canvas', { class: 'map-canvas', width: 176 * 5, height: 132 * 5 })
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(world.minimap, 0, 0, 176, 132, 0, 0, 176 * 5, 132 * 5)
    // grid-ish decorative border
    ctx.strokeStyle = 'rgba(255,226,122,0.18)'
    ctx.lineWidth = 1
    for (let x = 0; x <= 176; x += 22) { ctx.beginPath(); ctx.moveTo(x * 5, 0); ctx.lineTo(x * 5, 132 * 5); ctx.stroke() }
    for (let y = 0; y <= 132; y += 22) { ctx.beginPath(); ctx.moveTo(0, y * 5); ctx.lineTo(176 * 5, y * 5); ctx.stroke() }
    // towns
    for (const b of BIOME_LIST) {
      const t = world.towns[b.id]
      const sx = t.x * 5, sy = t.y * 5
      ctx.fillStyle = 'rgba(12,18,24,0.85)'; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2; ctx.stroke()
      ctx.fillStyle = '#ffe27a'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('⌂', sx, sy + 3)
      ctx.fillStyle = '#fff4d8'; ctx.font = 'bold 11px ui-monospace, monospace'
      ctx.fillText(t.name, sx, sy - 18)
    }
    // boss markers
    for (const b of BIOME_LIST) {
      const p = world.bossPoints[b.id]
      const alive = !this.state.flags.bosses[b.id]
      ctx.fillStyle = alive ? '#ff9a6a' : 'rgba(255,255,255,0.25)'
      ctx.beginPath(); ctx.arc(p.x * 5, p.y * 5, 5, 0, Math.PI * 2); ctx.fill()
      if (alive) {
        ctx.strokeStyle = 'rgba(255,154,106,0.4)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(p.x * 5, p.y * 5, 9, 0, Math.PI * 2); ctx.stroke()
      }
    }
    // mythic markers
    for (const b of BIOME_LIST) {
      if (this.state.flags.bosses[b.id] && !this.state.flags.mythic[b.id]) {
        const p = world.mythicPoints[b.id]
        ctx.fillStyle = '#ffe27a'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'
        ctx.fillText('✧', p.x * 5, p.y * 5 + 4)
      }
    }
    // biome labels
    for (const b of BIOME_LIST) {
      ctx.fillStyle = 'rgba(8,12,16,0.55)'; ctx.font = 'bold 12px ui-monospace, monospace'; ctx.textAlign = 'center'
      const label = b.short
      const w = ctx.measureText(label).width + 10
      ctx.fillRect(b.center[0] * 5 - w / 2, b.center[1] * 5 + 24, w, 16)
      ctx.fillStyle = b.hue
      ctx.fillText(label, b.center[0] * 5, b.center[1] * 5 + 36)
    }
    // player
    const px = world.player.x / 16 * 5, py = world.player.y / 16 * 5
    const pulse = 1 + Math.sin(performance.now() / 400) * 0.25
    ctx.fillStyle = 'rgba(126,217,87,0.25)'; ctx.beginPath(); ctx.arc(px, py, 12 * pulse, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#7ed957'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
    canvasWrap.append(canvas)
    const legend = el('div', { class: 'map-legend' }, [
      el('span', {}, [el('i', { class: 'legend-dot player' }), ' You']),
      el('span', {}, [el('i', { class: 'legend-dot town' }), ' Town']),
      el('span', {}, [el('i', { class: 'legend-dot boss' }), ' Guardian']),
      el('span', {}, [el('i', { class: 'legend-dot mythic' }), ' Mythic']),
    ])
    const info = el('aside', { class: 'map-side' }, [
      el('div', { class: 'panel-soft' }, [
        el('div', { class: 'eyebrow' }, 'CURRENT LOCATION'),
        el('h3', {}, BIOMES[world.currentBiome].name),
        el('p', {}, BIOMES[world.currentBiome].desc),
        el('div', { class: 'map-coords' }, `X ${Math.floor(world.player.x / 16)} · Y ${Math.floor(world.player.y / 16)}`),
      ]),
      el('div', { class: 'panel-soft' }, [
        el('div', { class: 'eyebrow' }, 'GUARDIANS'),
        el('div', { class: 'boss-checklist' }, BIOME_LIST.map(b => el('div', { class: 'boss-check' }, [
          el('span', { class: this.state.flags.bosses[b.id] ? 'done' : '' }, this.state.flags.bosses[b.id] ? '✔' : '◇'),
          el('span', {}, b.name),
          el('span', { class: 'muted' }, this.state.flags.bosses[b.id] ? 'Rested' : `Lv.${b.boss.level}`),
        ]))),
      ]),
      el('div', { class: 'panel-soft map-help' }, 'Explore roads and bridges to reach every region. Towns hold healers, merchants, trainers and quest givers.'),
    ])
    content.append(canvasWrap, info, legend)
    openModal({ title: 'World Map', subtitle: 'The continent of Aetheria', icon: '⌖', body: content, size: 'xlarge' })
  }

  // ── quests ───────────────────────────────────────────────────────────────
  openQuests(tab = null) {
    let activeTab = tab || 'active'
    const content = el('div', { class: 'quest-screen' })
    const root = openModal({ title: 'Journal', subtitle: 'Promises made across Aetheria', icon: '✎', body: content, size: 'large' })
    const render = () => {
      content.innerHTML = ''
      const counts = questCounts(this.state)
      content.append(tabs([
        { id: 'active', label: `Active ${counts.active + counts.ready ? `(${counts.active + counts.ready})` : ''}` },
        { id: 'available', label: 'Available' },
        { id: 'done', label: `Completed (${counts.done})` },
        { id: 'achievements', label: 'Achievements' },
      ], activeTab, id => { activeTab = id; render() }))
      if (activeTab === 'active') content.append(this.activeQuests(render))
      else if (activeTab === 'available') content.append(this.availableQuests(render))
      else if (activeTab === 'done') content.append(this.doneQuests())
      else content.append(this.achievementsGrid())
    }
    render()
    return root
  }

  activeQuests(rerender) {
    const wrap = el('div', { class: 'quest-list' })
    const entries = Object.entries(this.state.quests)
    if (!entries.length) return emptyState('✎', 'No active quests', 'Visit a town and look for the golden “!” markers.')
    for (const [id, entry] of entries) {
      if (entry.status === 'done') continue
      const q = QUESTS[id]
      if (!q) continue
      const progress = questProgress(this.state, q)
      const isTracked = this.state.trackedQuest === id
      wrap.append(el('div', { class: `quest-card ${entry.status === 'ready' ? 'ready' : ''} ${isTracked ? 'tracked' : ''}` }, [
        el('div', { class: 'quest-card-head' }, [
          el('div', {}, [
            el('div', { class: 'eyebrow' }, `${BIOMES[q.biome]?.name || 'Aetheria'} · ${entry.status === 'ready' ? 'READY TO CLAIM' : 'IN PROGRESS'}`),
            el('h3', {}, q.name),
          ]),
          isTracked ? chip('Tracked', 'gold') : button('Track', () => { this.state.trackedQuest = id; this.app.refreshHud(); rerender() }, { variant: 'ghost', className: 'tiny' }),
        ]),
        el('p', { class: 'quest-desc' }, q.desc),
        el('div', { class: 'objective-list' }, progress.map(p => progressRow(p.label, p.current, p.target, { done: p.done }))),
        this.rewardRow(q.rewards),
        entry.status === 'ready' ? el('div', { class: 'row end' }, [button('Claim Rewards', () => this.claim(id, rerender), { variant: 'gold', icon: '✦' })]) : null,
      ]))
    }
    return wrap
  }

  availableQuests(rerender) {
    const wrap = el('div', { class: 'quest-list' })
    let any = false
    for (const q of Object.values(QUESTS)) {
      if (this.state.quests[q.id]) continue
      const requiresMet = !q.requires || this.state.quests[q.requires]?.status === 'done'
      any = true
      wrap.append(el('div', { class: 'quest-card available' }, [
        el('div', { class: 'quest-card-head' }, [
          el('div', {}, [
            el('div', { class: 'eyebrow' }, `${BIOMES[q.biome]?.name || 'Aetheria'} · AVAILABLE`),
            el('h3', {}, q.name),
          ]),
          requiresMet ? button('Accept', () => { startQuest(this.state, q.id); this.app.afterChange(); rerender(); toast({ title: 'Quest accepted', text: q.name, icon: '✎' }) }, { variant: 'primary', className: 'small' }) : chip('Locked', 'soft'),
        ]),
        el('p', { class: 'quest-desc' }, q.desc),
        q.requires && !requiresMet ? el('p', { class: 'small-note' }, `Requires: ${QUESTS[q.requires]?.name}`) : null,
        this.rewardRow(q.rewards),
      ]))
    }
    return any ? wrap : emptyState('✔', 'All quests accepted', 'Every quest is already in your journal or complete.')
  }

  doneQuests() {
    const wrap = el('div', { class: 'quest-list' })
    const done = Object.entries(this.state.quests).filter(([, e]) => e.status === 'done')
    if (!done.length) return emptyState('✔', 'Nothing finished yet', 'Completed quests will be archived here.')
    for (const [id] of done) {
      const q = QUESTS[id]
      if (!q) continue
      wrap.append(el('div', { class: 'quest-card done' }, [
        el('div', { class: 'eyebrow' }, `${BIOMES[q.biome]?.name || 'Aetheria'} · COMPLETE`),
        el('h3', {}, ['✔ ', q.name]),
        el('p', { class: 'quest-desc muted' }, q.desc),
      ]))
    }
    return wrap
  }

  achievementsGrid() {
    const unlocked = Object.keys(this.state.achievements).length
    const wrap = el('div', {})
    wrap.append(el('div', { class: 'achievement-head' }, [
      el('div', { class: 'eyebrow' }, 'ACHIEVEMENTS'),
      el('span', { class: 'small-note' }, `${unlocked} / ${Object.keys(ACHIEVEMENTS).length} unlocked`),
    ]))
    const grid = el('div', { class: 'achievement-grid' })
    for (const a of Object.values(ACHIEVEMENTS)) {
      const on = !!this.state.achievements[a.id]
      grid.append(el('div', { class: `achievement-card ${on ? 'unlocked' : ''}` }, [
        el('div', { class: 'achievement-icon' }, on ? a.icon : '?'),
        el('div', {}, [el('strong', {}, a.name), el('p', {}, a.desc)]),
        on ? el('span', { class: 'ach-check' }, '✔') : null,
      ]))
    }
    wrap.append(grid)
    return wrap
  }

  rewardRow(rewards) {
    const items = (rewards.items || []).map(([id, count]) => el('span', { class: 'reward-chip' }, [getItem(id).icon, ` ${getItem(id).name} ×${count}`]))
    return el('div', { class: 'reward-row' }, [
      el('span', { class: 'reward-money' }, `◈ ${rewards.money || 0}`),
      el('span', { class: 'reward-xp' }, `★ ${rewards.trainerXp || 0} trainer XP`),
      ...items,
    ])
  }

  claim(id, rerender) {
    const res = claimQuest(this.state, id)
    if (!res) return
    toast({ title: 'Quest complete!', text: `${res.quest.name} rewards claimed.`, icon: '✦', tone: 'success' })
    for (const a of res.newAchievements || []) this.app.achievementToast(a)
    this.app.afterChange()
    rerender()
  }

  // ── menu ─────────────────────────────────────────────────────────────────
  openMenu() {
    const content = el('div', { class: 'menu-screen' })
    const root = openModal({ title: 'Pause Menu', subtitle: 'Aetheria can wait a moment.', icon: '☰', body: content, size: 'medium' })
    const p = this.state.player
    const tp = trainerProgress(this.state)
    content.append(el('div', { class: 'menu-trainer' }, [
      spriteImg(playerSprite('down', 0), { size: 64, className: 'menu-avatar' }),
      el('div', {}, [
        el('h3', {}, `${p.name} the ${trainerTitle(p.trainerLevel)}`),
        el('div', { class: 'small-note' }, `Trainer Lv.${p.trainerLevel} · ${tp.current}/${tp.need} XP`),
        el('div', { class: 'thin-track' }, [el('div', { class: 'thin-fill', style: { width: tp.pct * 100 + '%' } })]),
        el('div', { class: 'menu-stats' }, [
          el('span', {}, `◈ ${p.money.toLocaleString()} gold`),
          el('span', {}, `▤ ${caughtCount(this.state)} caught`),
          el('span', {}, `⚔ ${this.state.stats.wins} wins`),
          el('span', {}, `♛ ${bossCount(this.state)}/8 guardians`),
        ]),
      ]),
    ]))
    content.append(el('div', { class: 'menu-actions' }, [
      button('Save Game', () => { this.app.save(); toast({ title: 'Saved', text: 'Your journey is safe.', icon: '✦', tone: 'success' }) }, { icon: '▣', variant: 'primary' }),
      button('Settings', () => this.openSettings(), { icon: '⚙', variant: 'ghost' }),
      button('How to Play', () => this.openHelp(), { icon: '?', variant: 'ghost' }),
      button('Return to Title', () => confirm({
        title: 'Return to title?', text: 'Your progress will be saved. You can continue from the main menu.', onYes: () => { this.app.save(); closeModal(); this.app.showTitle() },
      }), { icon: '⌂', variant: 'ghost' }),
      button('Delete Save', () => confirm({
        title: 'Delete this save?', text: 'This permanently erases your party, codex and all progress. There is no undo.', danger: true, yes: 'Delete forever',
        onYes: () => { this.app.deleteSave(); closeModal(); this.app.showTitle() },
      }), { icon: '✕', variant: 'danger' }),
    ]))
    content.append(el('div', { class: 'save-meta small-note' }, this.state.savedAt ? `Last saved ${new Date(this.state.savedAt).toLocaleString()}` : 'Not saved yet'))
    return root
  }

  openSettings() {
    const content = el('div', { class: 'settings-screen' })
    const root = openModal({ title: 'Settings', icon: '⚙', body: content, size: 'medium' })
    const toggle = (key, label, desc) => el('label', { class: 'toggle-row' }, [
      el('div', {}, [el('strong', {}, label), el('span', {}, desc)]),
      (() => {
        const input = el('input', { type: 'checkbox', checked: !!this.state.settings[key], onchange: e => { this.state.settings[key] = e.target.checked; this.app.applySettings() } })
        return el('span', { class: 'toggle' }, [input, el('span', { class: 'toggle-track' })])
      })(),
    ])
    content.append(
      toggle('sfx', 'Sound effects', 'Battle hits, menu clicks and captures.'),
      toggle('music', 'Ambient music', 'A soft generated soundscape (experimental).'),
      toggle('screenShake', 'Screen shake', 'Impact feedback during battles.'),
      toggle('autosave', 'Autosave', 'Save automatically after key events.'),
    )
    content.append(el('div', { class: 'setting-row' }, [
      el('div', {}, [el('strong', {}, 'Battle speed'), el('span', {}, 'How quickly battle events play.')]),
      (() => {
        const sel = el('select', { class: 'select-input', onchange: e => { this.state.settings.speed = e.target.value } },
          ['relaxed', 'normal', 'fast'].map(v => el('option', { value: v, selected: this.state.settings.speed === v }, v[0].toUpperCase() + v.slice(1))))
        return sel
      })(),
    ]))
    content.append(el('div', { class: 'panel-soft settings-note' }, [
      el('p', {}, 'Controls: WASD / Arrow keys to move · Shift to run · E / Space to interact · P party · B bag · C codex · M map · J journal · Esc menu.'),
      el('p', {}, 'Mobile: use the virtual joystick and the action button in the lower-right.'),
    ]))
    return root
  }

  openHelp() {
    const content = el('div', { class: 'help-screen' }, [
      el('div', { class: 'help-grid' }, [
        helpCard('➜', 'Explore', 'Walk into wild monsters to start an encounter, or press E near NPCs, resources, guardians and signposts.'),
        helpCard('◉', 'Catch', 'Weaken a monster, inflict status, then throw the best orb you own. Capture chance is shown on every orb.'),
        helpCard('⚔', 'Battle', 'Skills cost energy; basic attacks are free. Elements are strong and weak against each other. Switch monsters freely.'),
        helpCard('✦', 'Evolve', 'Monsters evolve by level, friendship, location or special items. Some species have branching paths.'),
        helpCard('✎', 'Progress', 'Quests unlock rewards. Guardians mark the end of each biome. The Codex tracks every species.'),
        helpCard('☾', 'Day & Night', 'Time passes as you explore. Nocturnal monsters appear at night; healers can rest you until morning.'),
      ]),
    ])
    openModal({ title: 'How to Play', icon: '?', body: content, size: 'large' })
  }

  // ── NPC interaction ──────────────────────────────────────────────────────
  talkTo(npc) {
    const state = this.state
    switch (npc.role) {
      case 'healer': {
        const line = npc.lines[Math.floor(Math.random() * npc.lines.length)]
        const body = el('div', { class: 'dialogue-body' }, [
          this.portrait(npc),
          el('div', { class: 'dialogue-copy' }, [el('p', {}, `“${line}”`), el('p', { class: 'muted' }, 'Your monsters can be fully restored here, free of charge.')]),
        ])
        openModal({
          title: npc.name, subtitle: npc.role[0].toUpperCase() + npc.role.slice(1), icon: '✚', body, size: 'small',
          footer: el('div', { class: 'row gap end' }, [
            button('Leave', closeModal, { variant: 'ghost' }),
            button('Heal Party', () => {
              const res = healAllAtNpc(state)
              if (isNight(state.time.minutes)) { state.time.minutes = 6 * 60; state.time.day += 1 }
              this.app.afterChange()
              this.app.refreshHud()
              toast({ title: 'Fully healed', text: isNight(state.time.minutes) ? 'You rested until dawn.' : 'Your party is ready.', icon: '✚', tone: 'success' })
              closeModal()
            }, { variant: 'primary', icon: '✚' }),
          ]),
        })
        break
      }
      case 'shop': this.openShop(npc); break
      case 'quest': this.openQuestNpc(npc); break
      case 'trainer': this.openTrainerNpc(npc); break
      case 'nursery': this.openBreeding(); break
      default: {
        const line = npc.lines[Math.floor(Math.random() * npc.lines.length)]
        const body = el('div', { class: 'dialogue-body' }, [
          this.portrait(npc),
          el('div', { class: 'dialogue-copy' }, [el('p', {}, `“${line}”`)]) ,
        ])
        openModal({ title: npc.name, subtitle: 'Traveler', icon: '…', body, size: 'small', footer: button('Close', closeModal, { variant: 'primary' }) })
      }
    }
  }

  portrait(npc) {
    const img = el('img', { class: 'pixel-sprite dialogue-portrait', alt: npc.name })
    img.src = npcSprite(npc.look || npc.role, 'down', 0).toDataURL()
    return img
  }

  openTrainerNpc(npc) {
    const defeatedDay = this.state.flags.trainers[npc.id]
    const ready = !defeatedDay || this.state.time.day > defeatedDay
    const line = npc.lines[Math.floor(Math.random() * npc.lines.length)]
    const body = el('div', { class: 'dialogue-body' }, [
      this.portrait(npc),
      el('div', { class: 'dialogue-copy' }, [
        el('p', {}, `“${line}”`),
        el('div', { class: 'trainer-team-preview' }, npc.team.map(([id, lv]) => el('span', { class: 'team-chip' }, [(() => { const img = el('img', { class: 'pixel-sprite' }); img.src = monsterSpriteImg(id, { size: 26 }).src; return img })(), `${getMonster(id).name} Lv.${lv}`]))),
        ready ? el('p', { class: 'muted' }, 'A battle will test your whole party. There is no capture in trainer battles.') : el('p', { class: 'muted' }, 'They are resting after your last battle. Return tomorrow for a rematch.'),
      ]),
    ])
    openModal({
      title: npc.name, subtitle: npc.title || 'Trainer', icon: '⚔', body, size: 'medium',
      footer: el('div', { class: 'row gap end' }, [
        button('Leave', closeModal, { variant: 'ghost' }),
        ready ? button('Battle', () => { closeModal(); this.app.startTrainerBattle(npc) }, { variant: 'primary', icon: '⚔' }) : button('Not today', closeModal, { variant: 'ghost', disabled: true }),
      ]),
    })
  }

  openQuestNpc(npc) {
    const quests = questsForNpc(this.state, npc.id)
    const content = el('div', { class: 'quest-npc' })
    const line = npc.lines[Math.floor(Math.random() * npc.lines.length)]
    content.append(el('p', { class: 'npc-quote' }, `“${line}”`))
    const render = () => {
      content.innerHTML = ''
      content.append(el('p', { class: 'npc-quote' }, `“${line}”`))
      if (!quests.length) content.append(el('p', {}, 'They have nothing more for you right now.'))
      for (const { quest, status, progress } of quests) {
        content.append(el('div', { class: 'quest-card compact' }, [
          el('div', { class: 'quest-card-head' }, [
            el('div', {}, [el('div', { class: 'eyebrow' }, status === 'done' ? 'COMPLETE' : status === 'ready' ? 'READY' : status === 'active' ? 'ACTIVE' : status === 'locked' ? 'LOCKED' : 'AVAILABLE'), el('h3', {}, quest.name)]),
            status === 'available' ? button('Accept', () => { startQuest(this.state, quest.id); this.app.afterChange(); this.app.refreshHud(); toast({ title: 'Quest accepted', text: quest.name, icon: '✎' }); render() }, { variant: 'primary', className: 'small' })
              : status === 'ready' ? button('Claim', () => { const res = claimQuest(this.state, quest.id); this.app.afterChange(); toast({ title: 'Quest complete!', text: quest.name, icon: '✦' }); for (const a of res?.newAchievements || []) this.app.achievementToast(a); render() }, { variant: 'gold', className: 'small' })
                : status === 'active' ? chip('In progress', 'soft') : status === 'done' ? chip('✔ Complete', 'good') : chip('Locked', 'soft'),
          ]),
          el('p', { class: 'quest-desc' }, quest.desc),
          status !== 'available' && status !== 'locked' ? el('div', { class: 'objective-list' }, progress.map(p => progressRow(p.label, p.current, p.target, { done: p.done }))) : this.rewardRow(quest.rewards),
        ]))
      }
    }
    render()
    openModal({ title: npc.name, subtitle: 'Quest Giver', icon: '✎', body: content, size: 'large', footer: button('Close', closeModal, { variant: 'primary' }) })
  }

  openShop(npc) {
    let tab = 'buy'
    const content = el('div', { class: 'shop-screen' })
    const root = openModal({
      title: npc.name, subtitle: 'Merchant', icon: '◈', body: content, size: 'large',
      eyebrow: `${BIOMES[npc.biome]?.name || 'Aetheria'} · ◈ ${this.state.player.money.toLocaleString()} gold`,
    })
    const render = () => {
      content.innerHTML = ''
      content.append(el('div', { class: 'shop-head' }, [
        tabs([{ id: 'buy', label: 'Buy' }, { id: 'sell', label: 'Sell' }], tab, id => { tab = id; render() }),
        el('span', { class: 'money-pill' }, `◈ ${this.state.player.money.toLocaleString()}`),
      ]))
      const list = el('div', { class: 'shop-list' })
      if (tab === 'buy') {
        const stock = [...new Set([...(npc.stock || []), 'capture_orb', 'minor_mend'])].filter(id => getItem(id).type !== 'key')
        for (const id of stock) {
          const item = getItem(id)
          const price = item.price || 50
          list.append(el('div', { class: 'shop-row' }, [
            itemIcon(id, 36),
            el('div', { class: 'shop-copy' }, [el('strong', {}, item.name), el('p', {}, item.desc)]),
            el('span', { class: 'shop-price' }, `◈ ${price}`),
            button('Buy', () => {
              const res = buyItem(this.state, id, 1)
              toast({ title: res.ok ? 'Purchased' : 'Cannot buy', text: res.message, tone: res.ok ? 'success' : 'warn', icon: item.icon })
              this.app.refreshHud(); render()
            }, { variant: this.state.player.money >= price ? 'primary' : 'ghost', disabled: this.state.player.money < price, className: 'small' }),
          ]))
        }
      } else {
        const owned = Object.entries(this.state.inventory).filter(([id, c]) => c > 0 && getItem(id).type !== 'key')
        if (!owned.length) list.append(emptyState('◈', 'Nothing to sell', 'Gather resources or buy less.'))
        for (const [id, count] of owned) {
          const item = getItem(id)
          const price = Math.max(1, Math.floor((item.price || 10) * 0.5))
          list.append(el('div', { class: 'shop-row' }, [
            itemIcon(id, 36),
            el('div', { class: 'shop-copy' }, [el('strong', {}, `${item.name} ×${count}`), el('p', {}, item.desc)]),
            el('span', { class: 'shop-price' }, `◈ ${price}`),
            button('Sell 1', () => {
              const res = sellItem(this.state, id, 1)
              toast({ title: res.ok ? 'Sold' : 'Cannot sell', text: res.message, icon: item.icon })
              this.app.refreshHud(); render()
            }, { variant: 'ghost', className: 'small' }),
          ]))
        }
      }
      content.append(list)
    }
    render()
    return root
  }

  // ── breeding ─────────────────────────────────────────────────────────────
  openBreeding() {
    let a = null, b = null
    const content = el('div', { class: 'breeding-screen' })
    const root = openModal({ title: 'The Nursery', subtitle: 'Two promises, one small shell.', icon: '◈', body: content, size: 'large' })
    const render = () => {
      content.innerHTML = ''
      const eligible = this.state.party.filter(m => !m.isEgg && m.level >= 8)
      const selector = (which, chosen) => el('div', { class: 'breed-slot' }, [
        el('div', { class: 'eyebrow' }, which === 'a' ? 'FIRST PARENT' : 'SECOND PARENT'),
        chosen ? el('button', { class: 'breed-chosen', onclick: () => which === 'a' ? (a = null, render()) : (b = null, render()) }, [
          monsterIcon(chosen, 80),
          el('strong', {}, chosen.nickname),
          el('span', { class: 'small-note' }, `${getMonster(chosen.speciesId).name} · Lv.${chosen.level}`),
          el('span', { class: 'change-hint' }, 'Change'),
        ]) : el('div', { class: 'breed-empty' }, 'Choose a monster below'),
        el('div', { class: 'breed-list' }, eligible.filter(m => m.uid !== (which === 'a' ? b?.uid : a?.uid)).map(m => el('button', {
          class: 'breed-pick', onclick: () => { if (which === 'a') a = m; else b = m; render() },
        }, [monsterIcon(m, 40), el('span', {}, m.nickname), el('span', { class: 'small-note' }, `Lv.${m.level}`)]))),
      ])
      const fee = 250
      const canBreed = a && b && a.uid !== b.uid && this.state.player.money >= fee && (this.state.party.length < 6 || this.state.storage.length < 40)
      const preview = a ? getMonster((a.speciesId)) : null
      content.append(el('div', { class: 'nursery-note' }, [
        el('p', {}, 'Leave two monsters with the Nursery-Keeper. The egg will inherit the first parent\'s earliest form, a personality and some skills. Walk to hatch it.'),
        el('p', { class: 'small-note' }, `Fee: ◈ ${fee}. Eggs go to your party if there is room, otherwise storage.`),
      ]))
      content.append(el('div', { class: 'breed-grid' }, [selector('a', a), selector('b', b)]))
      content.append(el('div', { class: 'breed-preview' }, [
        el('div', { class: 'panel-soft' }, [
          el('div', { class: 'eyebrow' }, 'EGG PREVIEW'),
          a && b ? el('div', { class: 'egg-preview-row' }, [
            monsterSpriteImg(a.speciesId, { size: 64, egg: true, hatchRatio: 0.2 }),
            el('div', {}, [
              el('strong', {}, 'A new egg'),
              el('p', {}, `Likely ${getMonster(a.speciesId).name} · inherited skills: ${[...new Set([...a.moves.slice(0, 2), ...b.moves.slice(0, 1)])].map(id => getSkill(id).name).join(', ')}`),
              el('p', { class: 'small-note' }, `Personality from ${a.nickname} or ${b.nickname}. Hatch time depends on parent levels.`),
            ]),
          ]) : el('p', { class: 'muted' }, 'Choose two monsters to see the egg preview.'),
        ]),
      ]))
      content.append(el('div', { class: 'row end' }, [
        button(`Breed · ◈${fee}`, () => {
          if (!canBreed) return
          this.state.player.money -= fee
          const egg = createEgg(a, b)
          const toParty = this.state.party.length < 6
          if (toParty) this.state.party.push(egg)
          else this.state.storage.push(egg)
          this.state.stats.eggs = (this.state.stats.eggs || 0) + 1
          this.app.afterChange()
          this.app.refreshHud()
          toast({ title: 'An egg was laid!', text: `${toParty ? 'It is in your party.' : 'It is in storage.'} Walk to help it hatch.`, icon: '◈', tone: 'success' })
          a = null; b = null
          render()
        }, { variant: canBreed ? 'primary' : 'ghost', disabled: !canBreed, icon: '◈' }),
      ]))
    }
    render()
    return root
  }
}

function metaPair(label, value) {
  return el('div', { class: 'meta-pair' }, [el('span', {}, label), el('strong', {}, String(value))])
}

function helpCard(icon, title, text) {
  return el('div', { class: 'help-card' }, [el('div', { class: 'help-icon' }, icon), el('h3', {}, title), el('p', {}, text)])
}
