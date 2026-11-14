// Overworld renderer: camera, baked terrain, y-sorted props/entities, weather,
// day/night lighting and interaction indicators.

import { TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, T } from '../game/world.js'
import { BIOMES, BIOME_ORDER, BIOME_LIST } from '../data/biomes.js'
import { monsterSprite, npcSprite, playerSprite, flipCanvas } from './sprites.js'
import { getMonster } from '../data/monsters.js'
import { clamp, isNight, timeOfDay } from '../core/utils.js'

export class WorldRenderer {
  constructor(canvas, world) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.world = world
    this.camera = { x: 0, y: 0 }
    this.zoom = 3
    this.time = 0
    this.weather = []
    this.weatherBiome = null
    this.gardenSpriteCache = new WeakMap()
    this.tintCanvas = document.createElement('canvas')
    this.tintCtx = this.tintCanvas.getContext('2d')
    this.resize()
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.floor(this.width * dpr)
    this.canvas.height = Math.floor(this.height * dpr)
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.dpr = dpr
    this.zoom = this.width < 640 ? 2 : 3
    this.tintCanvas.width = this.canvas.width
    this.tintCanvas.height = this.canvas.height
    this.viewW = this.width / this.zoom
    this.viewH = this.height / this.zoom
    this.weather = []
    this.weatherBiome = null
  }

  centerCamera(px, py) {
    this.camera.x = clamp(px - this.viewW / 2, 0, WORLD_W - this.viewW)
    this.camera.y = clamp(py - this.viewH / 2, 0, WORLD_H - this.viewH)
  }

  updateCamera(px, py, dt) {
    const targetX = clamp(px - this.viewW / 2, 0, WORLD_W - this.viewW)
    const targetY = clamp(py - this.viewH / 2, 0, WORLD_H - this.viewH)
    const lerp = 1 - Math.pow(0.001, dt)
    this.camera.x += (targetX - this.camera.x) * lerp
    this.camera.y += (targetY - this.camera.y) * lerp
  }

  isVisible(x, y, margin = 60) {
    return x > this.camera.x - margin && x < this.camera.x + this.viewW + margin &&
      y > this.camera.y - margin && y < this.camera.y + this.viewH + margin
  }

  render(dt, { player, near, playerMoving, walkTime }) {
    this.time += dt
    const ctx = this.ctx
    const dpr = this.dpr
    const zoom = this.zoom
    const cam = this.camera
    const world = this.world
    const state = world.state

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#101a19'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -cam.x * dpr * zoom, -cam.y * dpr * zoom)
    ctx.imageSmoothingEnabled = false

    // Visible slice of baked ground
    const sx = Math.max(0, Math.floor(cam.x))
    const sy = Math.max(0, Math.floor(cam.y))
    const sw = Math.min(WORLD_W - sx, Math.ceil(this.viewW) + 2)
    const sh = Math.min(WORLD_H - sy, Math.ceil(this.viewH) + 2)
    if (sw > 0 && sh > 0) ctx.drawImage(world.mapCanvas, sx, sy, sw, sh, sx, sy, sw, sh)

    const decos = world.getDecosAround(cam.x, cam.y, this.viewW, this.viewH)
    const renderables = []
    for (const d of decos) {
      const x = d.x * TILE + 8, y = d.y * TILE + 16
      if (!this.isVisible(x, y, 80)) continue
      renderables.push({ y: y, type: 'deco', data: d, baseY: y })
    }
    for (const r of world.resources) {
      if (!r.available || !this.isVisible(r.x, r.y, 40)) continue
      renderables.push({ y: r.y, type: 'resource', data: r, baseY: r.y })
    }
    for (const n of world.npcs) {
      if (!this.isVisible(n.x, n.y, 60)) continue
      renderables.push({ y: n.y, type: 'npc', data: n, baseY: n.y })
    }
    for (const w of world.wilds) {
      if (!this.isVisible(w.x, w.y, 60)) continue
      renderables.push({ y: w.y, type: 'wild', data: w, baseY: w.y })
    }
    for (const b of world.bosses) {
      if (!this.isVisible(b.x, b.y, 90)) continue
      renderables.push({ y: b.y, type: 'boss', data: b, baseY: b.y })
    }
    for (const m of world.mythics) {
      if (!this.isVisible(m.x, m.y, 90)) continue
      renderables.push({ y: m.y, type: 'mythic', data: m, baseY: m.y })
    }
    const moving = playerMoving
    const frame = Math.floor(walkTime * 6) % 2
    renderables.push({ y: player.y, type: 'player', data: { ...player, frame: moving ? frame : 0 }, baseY: player.y })

    renderables.sort((a, b) => a.baseY - b.baseY)

    // Auras behind bosses
    for (const b of [...world.bosses, ...world.mythics]) {
      if (!this.isVisible(b.x, b.y, 90)) continue
      this.drawAura(ctx, b.x, b.y - 16, b.kind === 'mythic' ? '#ffe27a' : '#ff8a4c', b.kind === 'mythic' ? 46 : 34)
    }

    for (const item of renderables) {
      switch (item.type) {
        case 'deco': this.drawDeco(ctx, item.data); break
        case 'resource': this.drawResource(ctx, item.data); break
        case 'npc': this.drawNpc(ctx, item.data, near); break
        case 'wild': this.drawWild(ctx, item.data); break
        case 'boss': this.drawWild(ctx, item.data, true); break
        case 'mythic': this.drawWild(ctx, item.data, true); break
        case 'player': this.drawPlayer(ctx, item.data, near); break
      }
    }

    // ground-level labels for towns
    this.drawTownLabels(ctx)

    // screen-space layers
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.drawWeather(ctx, state, dt)
    this.drawLighting(ctx, state, player)
    this.drawPrompts(ctx, near, player)
    this.drawClockHalo(ctx, state)
  }

  // ── entity drawing ────────────────────────────────────────────────────────
  drawShadow(ctx, x, y, w = 12, h = 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.beginPath()
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  drawPlayer(ctx, p, near) {
    this.drawShadow(ctx, p.x, p.y + 1, 14, 5)
    const sprite = playerSprite(p.dir, p.frame)
    ctx.drawImage(sprite, Math.round(p.x - 9), Math.round(p.y - 24 + (p.frame ? -1 : 0)), 18, 26)
    if (near && near.kind === 'npc' && Math.hypot(near.entity.x - p.x, near.entity.y - p.y) < 34) {
      // little exclamation over the player's head
      this.drawBubble(ctx, p.x, p.y - 40, '!')
    }
  }

  drawNpc(ctx, n, near) {
    this.drawShadow(ctx, n.x, n.y + 10, 14, 5)
    const sprite = npcSprite(n.look || n.role, n.dir || 'down', 0)
    ctx.drawImage(sprite, Math.round(n.x - 9), Math.round(n.y - 14), 18, 26)
    // role badge
    ctx.font = 'bold 7px monospace'
    ctx.textAlign = 'center'
    const glyph = n.role === 'healer' ? '✚' : n.role === 'shop' ? '◈' : n.role === 'quest' ? '!' : n.role === 'trainer' ? '⚔' : n.role === 'nursery' ? '◈' : ''
    if (glyph) {
      ctx.fillStyle = 'rgba(10,14,18,0.75)'
      ctx.beginPath(); ctx.roundRect(n.x - 5, n.y - 34, 10, 10, 3); ctx.fill()
      ctx.fillStyle = n.role === 'healer' ? '#8ee08a' : n.role === 'trainer' ? '#ff9a9a' : n.role === 'quest' ? '#ffd36e' : '#e3b96b'
      ctx.fillText(glyph, n.x, n.y - 26)
    }
  }

  gardenPixelSprite(sprite) {
    if (this.gardenSpriteCache.has(sprite)) return this.gardenSpriteCache.get(sprite)
    const lowRes = document.createElement('canvas')
    lowRes.width = 20
    lowRes.height = 20
    const lowCtx = lowRes.getContext('2d')
    lowCtx.imageSmoothingEnabled = false
    lowCtx.drawImage(sprite, 0, 0, 20, 20)

    const pixelSprite = document.createElement('canvas')
    pixelSprite.width = 40
    pixelSprite.height = 40
    const pixelCtx = pixelSprite.getContext('2d')
    pixelCtx.imageSmoothingEnabled = false
    pixelCtx.drawImage(lowRes, 0, 0, 40, 40)
    this.gardenSpriteCache.set(sprite, pixelSprite)
    return pixelSprite
  }

  drawWild(ctx, w, big = false) {
    const t = this.time * 2 + (w.bob || 0)
    const bob = Math.sin(t) * (big ? 2 : 1.4)
    const scale = big ? 2.05 : 1.15
    const sprite = monsterSprite(w.speciesId)
    // Greenwood Forest is the starter garden: regular wild sprites use 2×2
    // pixel blocks there, while boss/mythic sprites keep their original detail.
    const renderedSprite = !big && w.biome === 'forest' ? this.gardenPixelSprite(sprite) : sprite
    const flip = w.dir === 'left'
    const drawSprite = flip ? this.flipped(renderedSprite) : renderedSprite
    const wSize = 40 * scale, hSize = 40 * scale
    const baseX = w.x - wSize / 2
    const baseY = w.y + 8 - hSize + bob
    this.drawShadow(ctx, w.x, w.y + 7, big ? 34 : 20, big ? 9 : 6)
    if (big) {
      ctx.save()
      const pulse = 0.5 + Math.sin(this.time * 3 + (w.bob || 0)) * 0.2
      ctx.globalAlpha = 0.35
      ctx.fillStyle = w.kind === 'mythic' ? '#ffe27a' : '#ff8a4c'
      ctx.beginPath(); ctx.ellipse(w.x, w.y + 4, 26 + pulse * 6, 10 + pulse * 2, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    ctx.drawImage(drawSprite, Math.round(baseX), Math.round(baseY), wSize, hSize)
    if (big) {
      const sp = getMonster(w.speciesId)
      ctx.textAlign = 'center'
      ctx.font = 'bold 6px monospace'
      ctx.fillStyle = 'rgba(8,10,16,0.75)'
      const width = Math.max(46, sp.name.length * 5 + 14)
      ctx.beginPath(); ctx.roundRect(w.x - width / 2, w.y - 62, width, 10, 3); ctx.fill()
      ctx.fillStyle = w.kind === 'mythic' ? '#ffe27a' : '#ffc2a1'
      ctx.fillText(`${sp.name} Lv.${w.monster.level}`, w.x, w.y - 54)
    }
    if (w.kind === 'wild' && this.nearWild === w.id) this.drawBubble(ctx, w.x, w.y - 34, '!')
  }

  flipped(canvas) {
    if (!canvas._flipped) canvas._flipped = flipCanvas(canvas)
    return canvas._flipped
  }

  drawBubble(ctx, x, y, glyph) {
    const bob = Math.sin(this.time * 4) * 2
    ctx.fillStyle = 'rgba(14,18,26,0.85)'
    ctx.beginPath(); ctx.roundRect(x - 7, y - 8 + bob, 14, 13, 4); ctx.fill()
    ctx.strokeStyle = 'rgba(255,226,122,0.8)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = '#ffe27a'
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(glyph, x, y + 2 + bob)
  }

  drawResource(ctx, r) {
    const bob = Math.sin(this.time * 2.4 + r.tx) * 1.2
    const glow = r.item === 'stardust' || r.item === 'crystal_shard'
    ctx.save()
    ctx.translate(r.x, r.y - 4 + bob)
    if (glow) {
      ctx.globalAlpha = 0.25
      ctx.fillStyle = '#ffe9a8'
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }
    // small plant / crystal node
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.ellipse(0, 6, 7, 3, 0, 0, Math.PI * 2); ctx.fill()
    const colors = {
      herb: ['#3f7a48', '#8fe07a'], spring_water: ['#3f86a8', '#b8ecff'], dusk_flower: ['#4a2a68', '#d8b8ff'],
      ember_shard: ['#6b2e22', '#ffb066'], ice_shard: ['#28617f', '#c9f8ff'], crystal_shard: ['#5a4a8a', '#e0c8ff'],
      sun_bloom: ['#7a5c1a', '#ffe27a'], spore_cap: ['#4a2a68', '#b48ae0'], relic_fragment: ['#5e604e', '#e3d6b8'],
      iron_ore: ['#4e5964', '#b8c4d0'], scrap_metal: ['#4e5964', '#c8d0d8'], stardust: ['#7a6418', '#fff3a8'],
      crystal: ['#5a4a8a', '#e0c8ff'],
    }
    const [dark, light] = colors[r.item] || ['#3f7a48', '#8fe07a']
    ctx.strokeStyle = dark; ctx.fillStyle = light; ctx.lineWidth = 2
    if (r.item.includes('crystal') || r.item === 'ice_shard' || r.item === 'ember_shard' || r.item === 'stardust') {
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(5, -2); ctx.lineTo(2, 5); ctx.lineTo(-3, 5); ctx.lineTo(-5, -2); ctx.closePath()
      ctx.fill(); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-1, -7, 1, 4)
    } else if (r.item === 'herb' || r.item === 'dusk_flower' || r.item === 'sun_bloom' || r.item === 'spore_cap') {
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = dark; ctx.fillRect(-1, 2, 2, 6)
      if (r.item === 'spore_cap') { ctx.fillStyle = light; ctx.fillRect(-4, -1, 8, 2) }
    } else {
      ctx.fillRect(-5, -4, 10, 9)
      ctx.strokeStyle = dark; ctx.strokeRect(-5, -4, 10, 9)
      ctx.fillStyle = '#e8d8b0'; ctx.fillRect(-2, -1, 2, 2)
    }
    ctx.restore()
    if (this.time * 2 % 2 > 1.2) {
      ctx.fillStyle = 'rgba(255,240,180,0.8)'
      ctx.fillRect(r.x + 4, r.y - 16, 2, 2)
    }
  }

  drawAura(ctx, x, y, color, radius) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, color + '66')
    grad.addColorStop(0.6, color + '22')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // ── decorations ───────────────────────────────────────────────────────────
  drawDeco(ctx, d) {
    const x = d.x * TILE + 8
    const y = d.y * TILE + 16
    const pal = BIOMES[d.biome]?.palette || BIOMES.forest.palette
    const v = d.variant || 0
    const r = (dx, dy, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x + dx, y + dy, w, h) }
    const circle = (cx, cy, rad, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + cx, y + cy, rad, 0, Math.PI * 2); ctx.fill()
    }
    const tri = (pts, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + pts[0], y + pts[1])
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(x + pts[i], y + pts[i + 1])
      ctx.closePath(); ctx.fill()
    }
    const shadow = (w = 18) => { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 1, w / 2, 4, 0, 0, Math.PI * 2); ctx.fill() }

    switch (d.type) {
      case 'tree': {
        shadow(22)
        r(-3, -10, 6, 12, '#4a3324')
        r(-2, -10, 2, 12, '#6b4a30')
        circle(0, -24, 13, '#204a2c')
        circle(-5, -28, 9, '#2f6b3d')
        circle(5, -27, 8, '#2f6b3d')
        circle(-2, -32, 8, pal.ground3)
        circle(4, -21, 7, '#3f7a48')
        if (v === 1) { circle(-8, -20, 4, '#8fe07a') }
        if (v === 3) { circle(7, -33, 3, '#ffe27a') }
        break
      }
      case 'deadTree': {
        shadow(16)
        r(-2, -24, 4, 26, '#3a2d2a')
        r(-2, -18, 10, 3, '#3a2d2a')
        r(-9, -22, 7, 2, '#3a2d2a')
        r(-8, -26, 2, 5, '#3a2d2a')
        r(6, -25, 2, 8, '#3a2d2a')
        r(-11, -29, 2, 8, '#3a2d2a')
        circle(-10, -30, 2, pal.accent)
        break
      }
      case 'pine': {
        shadow(18)
        r(-2, -8, 4, 9, '#4a3324')
        tri([0, -38, -11, -16, 11, -16], '#1e4a3a')
        tri([0, -31, -9, -10, 9, -10], '#2b5e48')
        tri([0, -36, -5, -20, 5, -20], '#d8eef5')
        break
      }
      case 'bush': {
        circle(-4, -5, 6, '#2f6b3d'); circle(4, -5, 6, '#3f7a48'); circle(0, -8, 7, '#4b8a52')
        if (v % 2) circle(2, -10, 2, '#ffd36e')
        break
      }
      case 'flowers': {
        for (let i = 0; i < 4; i++) {
          const ox = (i * 5 + v * 3) % 12 - 6
          r(ox, -3, 1, 4, '#3f7a48')
          circle(ox, -4, 1.8, i % 2 ? '#ffd36e' : '#ff9fb8')
        }
        break
      }
      case 'fern': {
        for (let i = 0; i < 3; i++) {
          const a = -2 + i
          ctx.strokeStyle = '#6fce74'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + a * 4, y - 8, x + a * 5, y - 12); ctx.stroke()
        }
        break
      }
      case 'stump': {
        shadow(12); r(-5, -6, 10, 7, '#5a3f2a'); circle(0, -6, 5, '#8a6844'); circle(0, -6, 2, '#6b4a30')
        break
      }
      case 'cactus': {
        shadow(12); r(-3, -18, 6, 19, '#3f7a48'); r(-8, -12, 4, 4, '#3f7a48'); r(-8, -6, 4, 8, '#3f7a48')
        r(4, -9, 4, 5, '#3f7a48'); r(4, -4, 4, 7, '#3f7a48')
        r(-2, -16, 1, 14, '#6fce74'); r(-9, -14, 1, 5, '#6fce74')
        if (v % 2) circle(0, -20, 2, '#ffd36e')
        break
      }
      case 'crystal': {
        shadow(16)
        tri([-5, 0, -2, -24, 2, 0], '#8a6ad8'); tri([-2, 0, 3, -30, 7, 0], '#b48ae0'); tri([5, 0, 8, -16, 11, 0], '#d8c0ff')
        tri([0, -2, 2, -20, 5, -2], '#e8d8ff')
        ctx.globalAlpha = 0.3; circle(3, -14, 12, '#c9b3ff'); ctx.globalAlpha = 1
        break
      }
      case 'rock': {
        shadow(16); circle(-4, -5, 7, '#5e604e'); circle(4, -6, 6, '#6e705c'); circle(0, -9, 4, '#8a8c76')
        break
      }
      case 'iceRock': {
        shadow(16); tri([-9, 0, -4, -16, 1, 0], '#6fb8cc'); tri([-3, 0, 3, -22, 8, 0], '#a9ddec'); tri([2, 0, 7, -12, 11, 0], '#d5f4ff')
        r(-3, -12, 2, 3, '#f4ffff')
        break
      }
      case 'obsidian': {
        shadow(14); tri([-8, 0, -4, -18, 0, 0], '#1d1418'); tri([-2, 0, 2, -24, 7, 0], '#2b1d28'); tri([4, 0, 8, -14, 11, 0], '#1d1418')
        r(-1, -16, 1, 6, '#ff8a4c')
        break
      }
      case 'lavaRock': {
        shadow(14); circle(0, -6, 8, '#3b2a26'); circle(-5, -8, 5, '#4b3630'); r(-6, -5, 4, 1, '#ff8a4c'); r(1, -8, 5, 1, '#ffb066')
        break
      }
      case 'vent': {
        shadow(12); circle(0, -1, 6, '#3b2a26'); circle(0, -2, 4, '#ff8a4c')
        ctx.globalAlpha = 0.35; circle(2, -14 + Math.sin(this.time + v) * 2, 5, '#ffd8b0'); ctx.globalAlpha = 1
        break
      }
      case 'forge': {
        shadow(24); r(-10, -16, 20, 16, '#4b3b3a'); r(-8, -18, 16, 3, '#6d5347')
        r(-3, -12, 6, 8, '#ff8a4c'); r(-2, -10, 4, 5, '#ffd36e')
        r(-11, -20, 3, 14, '#3b3030')
        break
      }
      case 'pillar': {
        shadow(18); r(-6, -26, 12, 27, '#8a8570'); r(-7, -28, 14, 4, '#b0aa92'); r(-7, -2, 14, 4, '#6e705c')
        r(-4, -24, 2, 22, '#b8b29a'); if (v % 2) r(-1, -18, 2, 6, '#5e604e')
        break
      }
      case 'rubble': {
        circle(-5, -3, 4, '#8a8570'); circle(3, -2, 3, '#6e705c'); r(-1, -6, 5, 3, '#9a957e')
        break
      }
      case 'urn': {
        shadow(10); ctx.fillStyle = '#a87f5a'; ctx.beginPath(); ctx.ellipse(x, y - 6, 5, 7, 0, 0, Math.PI * 2); ctx.fill()
        r(-3, -14, 6, 2, '#8a5f3a')
        break
      }
      case 'stairs': {
        for (let i = 0; i < 3; i++) r(-8 + i * 2, -3 - i * 5, 16 - i * 4, 4, i % 2 ? '#8a8570' : '#a8a38a')
        break
      }
      case 'gear': {
        shadow(10); circle(0, -5, 7, '#6b7078'); circle(0, -5, 3, '#3d4248')
        for (let a = 0; a < 6; a++) { r(-1 + Math.cos(a) * 8, -6 + Math.sin(a) * 8, 2, 2, '#8a9098') }
        break
      }
      case 'bone': {
        shadow(14); r(-8, -4, 12, 2, '#d8d0b8'); r(-8, -1, 12, 2, '#c8c0a8'); circle(-9, -3, 2, '#e8e0c8'); circle(5, -3, 2, '#e8e0c8')
        break
      }
      case 'spike': {
        shadow(18); tri([-8, 0, 0, -34, 8, 0], '#d8d0b8'); tri([-3, 0, 0, -30, 3, 0], '#f0e8d0'); r(-1, -22, 2, 12, '#b8b098')
        break
      }
      case 'nest': {
        shadow(20); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.ellipse(x, y - 3, 10, 5, 0, 0, Math.PI * 2); ctx.stroke()
        circle(0, -5, 4, '#e8e0c8'); circle(3, -6, 3, '#d8d0b8')
        break
      }
      case 'spring': {
        ctx.fillStyle = 'rgba(120,220,230,0.55)'; ctx.beginPath(); ctx.ellipse(x, y - 2, 10, 5, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(220,255,255,0.6)'; ctx.fillRect(x - 5, y - 3, 4, 1)
        break
      }
      case 'banner': {
        shadow(8); r(-1, -30, 2, 31, '#4a3324'); r(1, -29, 12, 12, '#8a2f3a')
        r(3, -26, 6, 4, '#ffd36e'); r(1, -18, 12, 2, '#6b222a')
        break
      }
      case 'mushroom': {
        shadow(8); r(-1, -7, 3, 7, '#d8d0b8'); circle(1, -8, 6, '#5b3a7e'); circle(0, -9, 4, '#b48ae0')
        if (v % 2) circle(-2, -10, 1, '#ffe27a')
        break
      }
      case 'wisp': {
        ctx.globalAlpha = 0.3; circle(0, -12 + Math.sin(this.time * 2 + v) * 2, 8, '#b48ae0'); ctx.globalAlpha = 1
        circle(0, -12 + Math.sin(this.time * 2 + v) * 2, 3, '#e8d8ff')
        break
      }
      case 'skull': {
        circle(0, -4, 5, '#d8d0b8'); r(-3, -4, 2, 3, '#3b3030'); r(1, -4, 2, 3, '#3b3030'); r(-4, -1, 8, 2, '#b8b098')
        break
      }
      case 'snowdrift': {
        ellipse(x, y - 2, 10, 4, '#e8f4fa')
        break
      }
      case 'ashpile': {
        circle(0, -2, 7, '#3b3130'); circle(-3, -4, 4, '#4b3b3a'); if (v % 2) r(1, -5, 3, 1, '#ff8a4c')
        break
      }
      case 'reed': {
        for (let i = 0; i < 4; i++) {
          const ox = -4 + i * 3
          r(ox, -14, 1, 15, '#5a7a4a')
          r(ox - 1, -16, 3, 2, '#8a9a62')
        }
        break
      }
      case 'starflower': {
        for (let i = 0; i < 3; i++) {
          const ox = [-4, 2, 6][i], oy = [-8, -12, -6][i]
          r(ox, oy, 1, 8 - oy / 2, '#4a7a68')
          ctx.fillStyle = '#ffe27a'; circle(ox, oy, 2.5, '#ffe27a'); circle(ox, oy, 1, '#fff8cc')
        }
        break
      }
      case 'cloudstone': {
        circle(-4, -7, 7, '#dce8f0'); circle(5, -8, 6, '#eef6fa'); circle(0, -12, 5, '#ffffff')
        break
      }
      case 'obelisk': {
        shadow(16); r(-5, -35, 10, 36, '#3d3858'); r(-3, -33, 2, 30, '#5a5278')
        r(-2, -27, 4, 2, '#ffe27a'); r(-2, -21, 4, 2, '#ffe27a'); r(-2, -15, 4, 2, '#ffe27a')
        break
      }
      case 'lantern': {
        shadow(8); r(-1, -20, 2, 21, '#4a3324'); r(-4, -27, 8, 8, '#3d3030'); r(-3, -25, 6, 5, '#ffe27a')
        ctx.globalAlpha = 0.25; circle(0, -22, 11, '#ffe27a'); ctx.globalAlpha = 1
        break
      }
      case 'house': {
        this.drawHouse(ctx, x, y, pal, d)
        break
      }
      default: {
        circle(0, -4, 5, '#5e604e')
      }
    }
  }

  drawHouse(ctx, x, y, pal, d) {
    const v = d.variant || 0
    const roofColors = ['#7a3f3a', '#4a5a7a', '#5a4a3a', '#3a5a4a']
    const roof = roofColors[v % roofColors.length]
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.ellipse(x, y + 1, 26, 5, 0, 0, Math.PI * 2); ctx.fill()
    // walls
    ctx.fillStyle = '#c8b48a'; ctx.fillRect(x - 18, y - 26, 36, 27)
    ctx.fillStyle = '#a89470'; ctx.fillRect(x - 18, y - 8, 36, 9)
    // frame
    ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 2; ctx.strokeRect(x - 18, y - 26, 36, 27)
    // roof
    ctx.fillStyle = roof
    ctx.beginPath(); ctx.moveTo(x - 24, y - 25); ctx.lineTo(x, y - 44); ctx.lineTo(x + 24, y - 25); ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.13)'
    ctx.beginPath(); ctx.moveTo(x - 24, y - 25); ctx.lineTo(x, y - 44); ctx.lineTo(x - 2, y - 25); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x - 24, y - 25); ctx.lineTo(x, y - 44); ctx.lineTo(x + 24, y - 25); ctx.stroke()
    // door and windows
    ctx.fillStyle = '#5a3a26'; ctx.fillRect(x - 5, y - 16, 10, 17)
    ctx.fillStyle = '#ffd36e'; ctx.fillRect(x - 3, y - 12, 2, 2)
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(x - 14, y - 20, 5, 5); ctx.fillRect(x + 9, y - 20, 5, 5)
    ctx.strokeStyle = '#5a4630'; ctx.strokeRect(x - 14, y - 20, 5, 5); ctx.strokeRect(x + 9, y - 20, 5, 5)
    // chimney + sign
    ctx.fillStyle = '#6b5a4a'; ctx.fillRect(x + 10, y - 42, 6, 10)
    ctx.fillStyle = pal.accent; ctx.fillRect(x - 3, y - 31, 6, 3)
  }

  // ── screen space ──────────────────────────────────────────────────────────
  worldToScreen(x, y) {
    return { x: (x - this.camera.x) * this.zoom * this.dpr, y: (y - this.camera.y) * this.zoom * this.dpr }
  }

  drawTownLabels(ctx) {
    const z = this.zoom * this.dpr
    for (const b of BIOME_LIST) {
      const t = this.world.towns[b.id]
      const x = (t.x * TILE + 8) * z - this.camera.x * z
      const y = (t.y * TILE - 6) * z - this.camera.y * z
      if (x < 0 || x > this.canvas.width || y < 0 || y > this.canvas.height) continue
      if (Math.hypot(this.world.player.x - (t.x * TILE), this.world.player.y - (t.y * TILE)) > 220 && b.id !== this.world.currentBiome) continue
      ctx.font = `${Math.max(9, 3.2 * z)}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      const label = t.name
      const w = ctx.measureText(label).width + 16 * (z / 3)
      const h = 7 * z
      ctx.fillStyle = 'rgba(12,18,22,0.7)'
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 3 * (z / 3)); ctx.fill()
      ctx.fillStyle = '#f5e7c8'
      ctx.fillText(label, x, y - h * 0.28)
    }
  }

  weatherForBiome(biome) {
    const count = biome === 'frozen' ? 80 : 55
    const map = {
      forest: { color: '#8fe07a', size: 2, speed: 22, drift: 16, kind: 'leaf' },
      swamp: { color: '#c8a5ff', size: 1.6, speed: 10, drift: 8, kind: 'spore' },
      desert: { color: '#f5dfb0', size: 1.3, speed: 34, drift: 28, kind: 'sand' },
      frozen: { color: '#eefaff', size: 2, speed: 26, drift: 10, kind: 'snow' },
      volcano: { color: '#ff9a5c', size: 1.6, speed: 20, drift: 12, kind: 'ember' },
      ruins: { color: '#d8cbb6', size: 1.2, speed: 12, drift: 6, kind: 'dust' },
      dragon: { color: '#ffb0a8', size: 1.5, speed: 16, drift: 12, kind: 'ember' },
      celestial: { color: '#fff3a8', size: 1.8, speed: 8, drift: 6, kind: 'star' },
    }
    const conf = map[biome] || map.forest
    return Array.from({ length: count }, () => ({
      x: Math.random() * this.width, y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * conf.drift, vy: conf.speed * (0.6 + Math.random() * 0.8),
      size: conf.size * (0.6 + Math.random() * 0.9), phase: Math.random() * 10,
      color: conf.color, kind: conf.kind,
    }))
  }

  drawWeather(ctx, state, dt) {
    const biome = this.world.currentBiome
    if (this.weatherBiome !== biome) { this.weatherBiome = biome; this.weather = this.weatherForBiome(biome) }
    const z = this.dpr
    const night = isNight(state.time.minutes)
    for (const p of this.weather) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.phase += dt
      if (p.y > this.height + 10) { p.y = -10; p.x = Math.random() * this.width }
      if (p.x < -10) p.x = this.width + 10
      if (p.x > this.width + 10) p.x = -10
      ctx.globalAlpha = night ? 0.55 : 0.75
      ctx.fillStyle = p.color
      if (p.kind === 'star') {
        ctx.globalAlpha = 0.4 + Math.abs(Math.sin(p.phase * 2)) * 0.5
        ctx.fillRect(p.x * z, p.y * z, p.size * z, p.size * z)
      } else if (p.kind === 'leaf') {
        ctx.save(); ctx.translate(p.x * z, p.y * z); ctx.rotate(Math.sin(p.phase) * 0.8)
        ctx.fillRect(0, 0, p.size * 1.6 * z, p.size * z); ctx.restore()
      } else if (p.kind === 'sand') {
        ctx.fillRect(p.x * z, p.y * z, p.size * 2.6 * z, p.size * 0.7 * z)
      } else if (p.kind === 'ember') {
        ctx.globalAlpha = 0.3 + Math.abs(Math.sin(p.phase * 3)) * 0.6
        ctx.fillRect(p.x * z, p.y * z, p.size * z, p.size * z)
      } else {
        ctx.fillRect(p.x * z, p.y * z, p.size * z, p.size * z)
      }
    }
    ctx.globalAlpha = 1
  }

  drawLighting(ctx, state, player) {
    const mins = state.time.minutes
    const hour = (mins / 60) % 24
    let alpha = 0
    let color = 'rgba(8,12,32,'
    if (hour >= 20 || hour < 5) { alpha = 0.52; color = 'rgba(8,12,32,' }
    else if (hour >= 18) { alpha = 0.26 * ((hour - 18) / 2); color = 'rgba(50,25,40,' }
    else if (hour < 7) { alpha = 0.2 * (1 - (hour - 5) / 2); color = 'rgba(20,20,50,' }
    if (alpha <= 0.01) return
    const c = this.tintCtx
    const dpr = this.dpr
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, this.tintCanvas.width, this.tintCanvas.height)
    c.fillStyle = color + alpha + ')'
    c.fillRect(0, 0, this.tintCanvas.width, this.tintCanvas.height)
    c.globalCompositeOperation = 'destination-out'
    const punch = (wx, wy, radius) => {
      const s = this.worldToScreen(wx, wy)
      const grd = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * dpr)
      grd.addColorStop(0, 'rgba(0,0,0,0.95)')
      grd.addColorStop(0.55, 'rgba(0,0,0,0.55)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = grd
      c.beginPath(); c.arc(s.x, s.y, radius * dpr, 0, Math.PI * 2); c.fill()
    }
    punch(player.x, player.y - 8, 105)
    for (const b of this.world.bosses) punch(b.x, b.y - 10, 70)
    for (const m of this.world.mythics) punch(m.x, m.y - 10, 80)
    for (const t of Object.values(this.world.towns)) {
      if (Math.hypot(t.x * TILE - player.x, t.y * TILE - player.y) < 500) punch(t.x * TILE, t.y * TILE, 110)
    }
    c.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.tintCanvas, 0, 0)
  }

  drawPrompts(ctx, near, player) {
    if (!near) return
    const z = this.zoom * this.dpr
    const e = near.entity
    const sx = e.x * z - this.camera.x * z
    const sy = e.y * z - this.camera.y * z
    if (near.kind === 'wild') return
    const glyph = near.kind === 'npc' ? (e.role === 'trainer' ? '⚔' : '…') : near.kind === 'resource' ? '✧' : (near.kind === 'boss' || near.kind === 'mythic') ? '⚔' : '?'
    const bob = Math.sin(this.time * 4) * 3
    const py = sy - (near.kind === 'boss' || near.kind === 'mythic' ? 120 * (z / 3) : 54 * (z / 3)) + bob
    ctx.fillStyle = 'rgba(12,18,24,0.9)'
    ctx.beginPath(); ctx.roundRect(sx - 11, py - 11, 22, 22, 6); ctx.fill()
    ctx.strokeStyle = 'rgba(255,226,122,0.85)'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = '#ffe27a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `${12 * (z / 3)}px monospace`
    ctx.fillText(glyph, sx, py + 1)
    ctx.textBaseline = 'alphabetic'
  }

  drawClockHalo(ctx, state) {
    // minimal day/night indicator in the top-centre of the canvas (HUD also shows it)
    const hour = (state.time.minutes / 60) % 24
    if (hour >= 19 || hour < 6) {
      const grad = ctx.createLinearGradient(0, 0, 0, 90 * this.dpr)
      grad.addColorStop(0, 'rgba(5,8,24,0.35)')
      grad.addColorStop(1, 'rgba(5,8,24,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, this.canvas.width, 90 * this.dpr)
    }
  }
}

export { TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, T, BIOMES, BIOME_ORDER }
