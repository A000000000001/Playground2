// Shared UI primitives: modals, toasts, bars, badges, sprite images.

import { el, clamp } from '../core/utils.js'
import { monsterSprite } from '../render/sprites.js'
import { getMonster } from '../data/monsters.js'
import { ELEMENTS, RARITY, STATUS } from '../data/elements.js'
import { getItem } from '../data/items.js'
import { getSkill } from '../data/skills.js'
import { maxHpOf, xpProgress } from '../game/monsters.js'

export { el }

let modalRoot = null
let toastRoot = null
let modalState = { open: false, onClose: null }

export function initUI() {
  modalRoot = document.getElementById('modal-layer')
  toastRoot = document.getElementById('toast-layer')
}

export function isModalOpen() { return modalState.open }

export function openModal({ title = '', subtitle = '', eyebrow = '', icon = '', body, footer = null, size = 'medium', onClose = null, className = '' }) {
  closeModal(true)
  const backdrop = el('div', { class: 'modal-backdrop' })
  const panel = el('div', { class: `screen-panel size-${size} ${className}` })
  const closeBtn = el('button', { class: 'icon-btn close-btn', title: 'Close (Esc)', onclick: () => closeModal() }, '✕')
  const head = el('header', { class: 'screen-head' }, [
    el('div', { class: 'screen-head-text' }, [
      eyebrow ? el('div', { class: 'eyebrow' }, eyebrow) : null,
      el('h2', {}, [icon ? el('span', { class: 'head-icon' }, icon) : null, title]),
      subtitle ? el('p', { class: 'screen-sub' }, subtitle) : null,
    ]),
    closeBtn,
  ])
  const bodyEl = el('div', { class: 'screen-body' }, body ? [body] : [])
  const footEl = footer ? el('footer', { class: 'screen-foot' }, [].concat(footer)) : null
  panel.append(head, bodyEl)
  if (footEl) panel.append(footEl)
  backdrop.append(panel)
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal()
  })
  modalRoot.append(backdrop)
  requestAnimationFrame(() => backdrop.classList.add('visible'))
  modalState = { open: true, onClose, backdrop }
  return { backdrop, panel, body: bodyEl, footer: footEl, close: closeModal }
}

export function closeModal(silent = false) {
  if (!modalRoot) return
  const state = modalState
  if (!state.open) return
  state.open = false
  const backdrop = modalRoot.querySelector('.modal-backdrop')
  if (backdrop) {
    backdrop.classList.remove('visible')
    setTimeout(() => backdrop.remove(), 160)
  }
  const cb = state.onClose
  modalState = { open: false, onClose: null }
  if (!silent && cb) cb()
}

export function toast({ title, text = '', icon = '✦', tone = 'default', duration = 3200 }) {
  if (!toastRoot) return
  const item = el('div', { class: `toast tone-${tone}` }, [
    el('div', { class: 'toast-icon' }, icon),
    el('div', { class: 'toast-copy' }, [
      el('strong', {}, title),
      text ? el('span', {}, text) : null,
    ]),
  ])
  toastRoot.append(item)
  requestAnimationFrame(() => item.classList.add('visible'))
  setTimeout(() => {
    item.classList.remove('visible')
    setTimeout(() => item.remove(), 300)
  }, duration)
}

export function spriteImg(source, { className = '', size = 96, flip = false, alt = '' } = {}) {
  const img = el('img', { class: `pixel-sprite ${className}`, alt, draggable: 'false' })
  img.src = typeof source === 'string' ? source : source.toDataURL()
  img.style.width = size + 'px'
  img.style.height = size + 'px'
  if (flip) img.style.transform = 'scaleX(-1)'
  img.loading = 'eager'
  return img
}

export function monsterSpriteImg(speciesId, opts = {}) {
  const img = el('img', { class: `pixel-sprite ${opts.className || ''}`, alt: getMonster(speciesId).name, draggable: 'false' })
  img.src = monsterSprite(speciesId, { egg: opts.egg, hatchRatio: opts.hatchRatio }).toDataURL()
  img.style.width = (opts.size || 96) + 'px'
  img.style.height = (opts.size || 96) + 'px'
  if (opts.flip) img.style.transform = 'scaleX(-1)'
  return img
}

export function elementBadge(element, small = false) {
  const e = ELEMENTS[element] || ELEMENTS.none
  return el('span', { class: `element-badge ${small ? 'small' : ''}`, style: { '--el': e.color, '--el-dark': e.dark } }, [
    el('span', { class: 'el-glyph' }, e.glyph), el('span', {}, e.name),
  ])
}

export function rarityBadge(rarity) {
  const r = RARITY[rarity] || RARITY.common
  return el('span', { class: 'rarity-badge', style: { color: r.color } }, r.name)
}

export function statusBadge(status) {
  if (!status) return null
  const s = STATUS[status]
  return el('span', { class: 'status-badge', style: { '--status': s.color } }, `${s.glyph} ${s.name}`)
}

export function hpBar(current, max, { className = '', showText = true, width } = {}) {
  const pct = clamp(current / Math.max(1, max), 0, 1) * 100
  const tone = pct > 50 ? 'good' : pct > 22 ? 'warn' : 'bad'
  return el('div', { class: `hp-bar ${className} ${tone}`, style: width ? { width: width + 'px' } : {} }, [
    el('div', { class: 'hp-track' }, [el('div', { class: 'hp-fill', style: { width: pct + '%' } })]),
    showText ? el('span', { class: 'hp-text' }, `${Math.max(0, Math.ceil(current))} / ${max}`) : null,
  ])
}

export function xpBar(monster, { showText = true } = {}) {
  const p = xpProgress(monster)
  return el('div', { class: 'xp-bar' }, [
    el('div', { class: 'xp-track' }, [el('div', { class: 'xp-fill', style: { width: p.pct * 100 + '%' } })]),
    showText ? el('span', { class: 'xp-text' }, `${p.current} / ${p.need} XP`) : null,
  ])
}

export function monsterIcon(monster, size = 72) {
  if (monster.isEgg) return monsterSpriteImg(monster.speciesId, { size, egg: true, hatchRatio: 1 - monster.hatchSteps / monster.hatchMax })
  return monsterSpriteImg(monster.speciesId, { size })
}

export function monsterName(monster) {
  return monster.nickname || getMonster(monster.speciesId).name
}

export function hpPercent(monster) {
  return clamp(monster.hp / Math.max(1, maxHpOf(monster)), 0, 1)
}

export function chip(text, tone = '') {
  return el('span', { class: `chip ${tone}` }, text)
}

export function itemIcon(itemId, size = 32) {
  const item = getItem(itemId)
  return el('span', { class: 'item-icon', style: { '--item-color': item.color, fontSize: size * 0.6 + 'px' } }, item.icon)
}

export function skillIcon(skillId) {
  const skill = getSkill(skillId)
  const e = ELEMENTS[skill.element] || ELEMENTS.none
  return el('span', { class: 'skill-dot', style: { background: e.color, color: e.dark } }, e.glyph)
}

export function button(label, onclick, { variant = 'primary', icon = '', disabled = false, className = '', title = '' } = {}) {
  return el('button', {
    class: `btn ${variant} ${className}`, onclick, disabled, title,
  }, [icon ? el('span', { class: 'btn-icon' }, icon) : null, el('span', {}, label)])
}

export function tabs(defs, active, onSelect) {
  const bar = el('div', { class: 'tab-bar' })
  for (const def of defs) {
    const b = el('button', { class: `tab-btn ${def.id === active ? 'active' : ''}`, onclick: () => onSelect(def.id) }, def.label)
    bar.append(b)
  }
  return bar
}

export function confirm({ title, text, yes = 'Confirm', no = 'Cancel', onYes, onNo = null, danger = false }) {
  let root
  const body = el('div', { class: 'confirm-body' }, [
    el('p', { class: 'confirm-text' }, text),
    el('div', { class: 'row gap end' }, [
      button(no, () => { closeModal(); onNo?.() }, { variant: 'ghost' }),
      button(yes, () => { closeModal(); onYes?.() }, { variant: danger ? 'danger' : 'primary' }),
    ]),
  ])
  root = openModal({ title, body, size: 'small', icon: danger ? '⚠' : '✦' })
  return root
}

export function progressRow(label, current, target, { done = false } = {}) {
  const pct = clamp(current / Math.max(1, target), 0, 1) * 100
  return el('div', { class: `objective ${done ? 'done' : ''}` }, [
    el('div', { class: 'objective-label' }, [
      el('span', {}, (done ? '✔ ' : '') + label),
      el('span', { class: 'objective-count' }, `${Math.min(current, target)} / ${target}`),
    ]),
    el('div', { class: 'thin-track' }, [el('div', { class: 'thin-fill', style: { width: pct + '%' } })]),
  ])
}

export function emptyState(icon, title, text) {
  return el('div', { class: 'empty-state' }, [
    el('div', { class: 'empty-icon' }, icon),
    el('strong', {}, title),
    el('p', {}, text),
  ])
}
