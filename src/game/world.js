// World generation and runtime simulation.
// A single 176×132 tile continent, generated deterministically, with organic biome
// regions, roads and bridges, towns, tall decorations, resources, NPCs and spawning.

import { BIOMES, BIOME_LIST, BIOME_ORDER } from '../data/biomes.js'
import { MONSTER_LIST, getMonster } from '../data/monsters.js'
import { RARITY } from '../data/elements.js'
import { npcsForBiome } from '../data/npcs.js'
import { createMonster, maxHpOf } from '../game/monsters.js'
import { markSeen, visitBiome, recordGather, advanceTime } from '../game/state.js'
import { emit } from '../core/events.js'
import { hash2, mulberry32, clamp, dist, pick, randomInt, isNight } from '../core/utils.js'

export const TILE = 16
export const MAP_W = 176
export const MAP_H = 132
export const WORLD_W = MAP_W * TILE
export const WORLD_H = MAP_H * TILE

const WILD_TARGET_PER_BIOME = 5
const T = { GROUND: 0, PATH: 1, WATER: 2, LAVA: 3, BRIDGE: 4, PLAZA: 5, OCEAN: 6, ICE: 7, ASH: 8 }

const LINKS = [
  ['forest', 'swamp'], ['swamp', 'desert'], ['desert', 'frozen'],
  ['frozen', 'volcano'], ['volcano', 'dragon'], ['dragon', 'ruins'],
  ['ruins', 'forest'],
  ['celestial', 'swamp'], ['celestial', 'desert'], ['celestial', 'ruins'], ['celestial', 'volcano'],
]

const TALL = {
  tree: { solid: true, h: 34 }, deadTree: { solid: true, h: 30 }, pine: { solid: true, h: 32 },
  cactus: { solid: true, h: 22 }, crystal: { solid: true, h: 22 }, rock: { solid: true, h: 10 },
  iceRock: { solid: true, h: 12 }, obsidian: { solid: true, h: 16 }, lavaRock: { solid: true, h: 10 },
  pillar: { solid: true, h: 30 }, obelisk: { solid: true, h: 36 }, spike: { solid: true, h: 26 },
  bone: { solid: true, h: 12 }, urn: { solid: true, h: 12 }, house: { solid: true, h: 42 },
  cairn: { solid: true, h: 12 }, gear: { solid: false, h: 10 }, forge: { solid: true, h: 24 },
  bush: { solid: false, h: 8 }, flowers: { solid: false, h: 3 }, fern: { solid: false, h: 8 },
  stump: { solid: true, h: 8 }, reed: { solid: false, h: 12 }, mushroom: { solid: false, h: 7 },
  wisp: { solid: false, h: 5 }, skull: { solid: false, h: 5 }, snowdrift: { solid: false, h: 5 },
  spring: { solid: false, h: 3 }, ashpile: { solid: false, h: 5 }, rubble: { solid: false, h: 4 },
  stairs: { solid: false, h: 5 }, nest: { solid: false, h: 5 }, banner: { solid: true, h: 28 },
  starflower: { solid: false, h: 7 }, cloudstone: { solid: true, h: 18 }, lantern: { solid: true, h: 20 },
  vent: { solid: true, h: 8 },
}

export class GameWorld {
  constructor(state) {
    this.state = state
    this.rng = mulberry32(20260413)
    this.biomeGrid = new Uint8Array(MAP_W * MAP_H)
    this.terrainGrid = new Uint8Array(MAP_W * MAP_H).fill(T.GROUND)
    this.solidGrid = new Uint8Array(MAP_W * MAP_H)
    this.variantGrid = new Uint8Array(MAP_W * MAP_H)
    this.decos = []
    this.decoChunks = new Map()
    this.npcs = []
    this.wilds = []
    this.resources = []
    this.bosses = []
    this.mythics = []
    this.towns = {}
    this.bossPoints = {}
    this.mythicPoints = {}
    this.player = { x: 0, y: 0, dir: 'down' }
    this.encounterCooldown = 2
    this.time = 0
    this.spawnTimers = {}
    this.stepAccumulator = 0
    this.currentBiome = 'forest'
    this.generate()
    this.spawnAll()
  }

  // ── generation ────────────────────────────────────────────────────────────
  generate() {
    this.assignBiomes()
    this.carveTownsAndArenas()
    this.carveRoads()
    this.addWaterFeatures()
    this.placeBuildings()
    this.addDecorations()
    this.bakeGround()
    this.buildMinimap()
  }

  assignBiomes() {
    const centers = BIOME_LIST.map(b => ({ id: b.id, x: b.center[0], y: b.center[1], index: BIOME_ORDER.indexOf(b.id) }))
    const celestial = BIOMES.celestial.center
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x
        const coast = hash2(x, y, 31) * 2.5
        const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y)
        if (edge < 4 + coast) { this.terrainGrid[i] = T.OCEAN; this.biomeGrid[i] = 8; this.solidGrid[i] = 1; continue }

        const dc = Math.hypot(x - celestial[0], y - celestial[1])
        let biome
        if (dc < 20.5) biome = 'celestial'
        else {
          let best = Infinity
          for (const c of centers) {
            const warp = (hash2(Math.floor(x / 7), Math.floor(y / 7), 101 + c.index) - 0.5) * 12
            const d = Math.hypot(x - c.x, y - c.y) + warp
            if (d < best) { best = d; biome = c.id }
          }
        }
        const bIdx = BIOME_ORDER.indexOf(biome)
        this.biomeGrid[i] = bIdx
        this.variantGrid[i] = Math.floor(hash2(x, y, 13) * 4)

        if (biome === 'celestial' && dc >= 12.5) {
          this.terrainGrid[i] = T.WATER; this.solidGrid[i] = 1
        } else if (biome === 'swamp' && hash2(x, y, 71) < 0.035 && dc > 21) {
          this.terrainGrid[i] = T.WATER; this.solidGrid[i] = 1
        }
      }
    }
  }

  carveTownsAndArenas() {
    for (const b of BIOME_LIST) {
      const tx = b.center[0] + b.town.offset[0]
      const ty = b.center[1] + b.town.offset[1]
      this.towns[b.id] = { x: tx, y: ty, name: b.town.name }
      this.carveCircle(tx, ty, 9, T.PLAZA)
      const bx = clamp(b.center[0] + b.boss.offset[0], 6, MAP_W - 7)
      const by = clamp(b.center[1] + b.boss.offset[1], 6, MAP_H - 7)
      this.bossPoints[b.id] = { x: bx, y: by }
      this.carveCircle(bx, by, 7, T.PLAZA)
      const mx = clamp(b.center[0] + b.mythic.offset[0], 6, MAP_W - 7)
      const my = clamp(b.center[1] + b.mythic.offset[1], 6, MAP_H - 7)
      this.mythicPoints[b.id] = { x: mx, y: my }
      this.carveCircle(mx, my, 4, T.GROUND)
    }
    // clear a generous landing area around the island sanctum
    const c = BIOMES.celestial.center
    this.carveCircle(c[0], c[1], 8, T.PLAZA)
  }

  carveCircle(cx, cy, r, terrain) {
    for (let y = Math.max(1, cy - r); y <= Math.min(MAP_H - 2, cy + r); y++) {
      for (let x = Math.max(1, cx - r); x <= Math.min(MAP_W - 2, cx + r); x++) {
        if (Math.hypot(x - cx, y - cy) > r) continue
        this.setTerrain(x, y, terrain, false)
      }
    }
  }

  carveRoads() {
    for (const [a, b] of LINKS) {
      const ca = BIOMES[a].center, cb = BIOMES[b].center
      this.carveRoad(ca[0], ca[1], cb[0], cb[1])
    }
    // Short connectors from ring roads to each town square.
    for (const b of BIOME_LIST) {
      const t = this.towns[b.id]
      this.carveLine(t.x, t.y, b.center[0], b.center[1], 3)
      const boss = this.bossPoints[b.id]
      this.carveLine(t.x, t.y, boss.x, boss.y, 2)
    }
  }

  carveRoad(x1, y1, x2, y2, width = 3) {
    const len = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.ceil(len * 2)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const wob = Math.sin(t * Math.PI * 6 + x1) * 2.2
      const nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1)
      const x = Math.round(x1 + (x2 - x1) * t + nx * wob)
      const y = Math.round(y1 + (y2 - y1) * t + ny * wob)
      for (let dy = -Math.floor(width / 2); dy <= Math.floor(width / 2); dy++) {
        for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) {
          const tx = x + dx, ty = y + dy
          if (tx < 3 || ty < 3 || tx >= MAP_W - 3 || ty >= MAP_H - 3) continue
          const i2 = ty * MAP_W + tx
          const existing = this.terrainGrid[i2]
          if (existing === T.WATER || existing === T.OCEAN) this.terrainGrid[i2] = T.BRIDGE
          else if (existing === T.LAVA) this.terrainGrid[i2] = T.BRIDGE
          else if (existing !== T.PLAZA) this.terrainGrid[i2] = T.PATH
          this.solidGrid[i2] = 0
        }
      }
    }
  }

  carveLine(x1, y1, x2, y2, width) {
    this.carveRoad(x1, y1, x2, y2, width)
  }

  addWaterFeatures() {
    const rng = this.rng
    const features = [
      { biome: 'forest', terrain: T.WATER, count: 9, radius: [1, 3] },
      { biome: 'frozen', terrain: T.ICE, count: 8, radius: [1, 3] },
      { biome: 'volcano', terrain: T.LAVA, count: 10, radius: [1, 2] },
      { biome: 'desert', terrain: T.WATER, count: 3, radius: [1, 2] },
      { biome: 'swamp', terrain: T.WATER, count: 8, radius: [1, 3] },
    ]
    for (const f of features) {
      const b = BIOMES[f.biome]
      let placed = 0, attempts = 0
      while (placed < f.count && attempts++ < 100) {
        const x = b.center[0] + Math.round((rng() - 0.5) * 45)
        const y = b.center[1] + Math.round((rng() - 0.5) * 40)
        if (x < 10 || y < 10 || x >= MAP_W - 10 || y >= MAP_H - 10) continue
        if (BIOME_ORDER[this.biomeGrid[y * MAP_W + x]] !== f.biome) continue
        if (this.nearTown(x, y, 13) || this.nearBoss(x, y, 10)) continue
        if (this.nearPath(x, y, 2)) continue
        this.carveCircle(x, y, randomInt(f.radius[0], f.radius[1], rng), f.terrain)
        if (f.terrain === T.LAVA) this.carveCircle(x, y, 1, T.ASH)
        placed++
      }
    }
  }

  setTerrain(x, y, terrain, solid = null) {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return
    const i = y * MAP_W + x
    this.terrainGrid[i] = terrain
    if (solid === true) this.solidGrid[i] = 1
    else if (solid === false) this.solidGrid[i] = 0
    else this.solidGrid[i] = (terrain === T.WATER || terrain === T.LAVA || terrain === T.OCEAN) ? 1 : 0
  }

  nearTown(x, y, r) {
    return Object.values(this.towns).some(t => Math.hypot(t.x - x, t.y - y) < r)
  }
  nearBoss(x, y, r) {
    return Object.values(this.bossPoints).some(t => Math.hypot(t.x - x, t.y - y) < r)
  }
  nearPath(x, y, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const tx = x + dx, ty = y + dy
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue
      if (this.terrainGrid[ty * MAP_W + tx] === T.PATH) return true
    }
    return false
  }

  placeBuildings() {
    for (const b of BIOME_LIST) {
      const town = this.towns[b.id]
      const spots = [[-6, -5, 0], [5, -5, 1], [-7, 4, 2], [6, 5, 3]]
      for (const [dx, dy, variant] of spots) {
        const x = town.x + dx, y = town.y + dy
        if (x < 4 || y < 4 || x >= MAP_W - 5 || y >= MAP_H - 6) continue
        this.addDeco('house', x, y, b.id, variant, true, 3)
        for (let yy = y; yy < y + 2; yy++) for (let xx = x - 1; xx <= x + 1; xx++) this.solidGrid[yy * MAP_W + xx] = 1
        this.setTerrain(x, y, T.PLAZA, false)
      }
      // Town lanterns / signposts
      this.addDeco(b.id === 'celestial' ? 'lantern' : 'banner', town.x, town.y - 3, b.id, 0, true, 1)
      for (const [dx, dy] of [[-2, -6], [2, -6], [-9, 0], [8, 0]]) {
        const x = town.x + dx, y = town.y + dy
        if (!this.isSolidTile(x, y)) this.addDeco('lantern', x, y, b.id, 1, true, 1)
      }
    }
  }

  addDeco(type, x, y, biome, variant = 0, force = false, solidWidth = 1) {
    const info = TALL[type]
    if (!info) return
    this.decos.push({ type, x, y, biome, variant, h: info.h, solidWidth })
    if (info.solid || force) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = -Math.floor(solidWidth / 2); dx <= Math.floor(solidWidth / 2); dx++) {
          const tx = x + dx, ty = y + dy
          if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue
          this.solidGrid[ty * MAP_W + tx] = 1
        }
      }
    }
    const chunkKey = `${Math.floor(x / 12)},${Math.floor(y / 12)}`
    if (!this.decoChunks.has(chunkKey)) this.decoChunks.set(chunkKey, [])
    this.decoChunks.get(chunkKey).push(this.decos[this.decos.length - 1])
  }

  addDecorations() {
    const rng = mulberry32(77123)
    const occupiedTall = new Set()
    for (let y = 7; y < MAP_H - 7; y++) {
      for (let x = 7; x < MAP_W - 7; x++) {
        const i = y * MAP_W + x
        if (this.solidGrid[i]) continue
        const terrain = this.terrainGrid[i]
        if (terrain !== T.GROUND && terrain !== T.ASH && terrain !== T.ICE) continue
        if (this.nearTown(x, y, 10) || this.nearBoss(x, y, 8)) continue
        if (this.nearPath(x, y, 1)) continue
        const biome = BIOME_ORDER[this.biomeGrid[i]]
        const density = biome === 'forest' ? 0.16 : biome === 'swamp' ? 0.13 : biome === 'frozen' ? 0.12 : biome === 'dragon' ? 0.1 : biome === 'ruins' ? 0.08 : 0.07
        if (rng() > density) continue
        let near = false
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (occupiedTall.has(`${x + dx},${y + dy}`)) { near = true; break }
        }
        if (near) continue
        const list = BIOMES[biome].deco
        let type = pick(list, rng)
        if (type === 'wisp' || type === 'starflower' || type === 'lantern') type = pick(list.filter(t => t !== type), rng) || type
        this.addDeco(type, x, y, biome, Math.floor(rng() * 4))
        if (TALL[type]?.solid) {
          this.solidGrid[i] = 1
          occupiedTall.add(`${x},${y}`)
        }
      }
    }
    // Boss arenas get ceremonial pillars / monoliths.
    for (const b of BIOME_LIST) {
      const p = this.bossPoints[b.id]
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2
        const x = Math.round(p.x + Math.cos(ang) * 7)
        const y = Math.round(p.y + Math.sin(ang) * 6)
        if (x < 3 || y < 3 || x >= MAP_W - 3 || y >= MAP_H - 3) continue
        const type = b.id === 'forest' ? 'tree' : b.id === 'volcano' ? 'obsidian' : b.id === 'frozen' ? 'iceRock' : b.id === 'celestial' ? 'obelisk' : b.id === 'dragon' ? 'spike' : b.id === 'ruins' ? 'pillar' : b.id === 'desert' ? 'crystal' : 'deadTree'
        this.addDeco(type, x, y, b.id, a)
        this.solidGrid[y * MAP_W + x] = 1
      }
    }
  }

  isSolidTile(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true
    return !!this.solidGrid[y * MAP_W + x]
  }

  // ── baked ground ──────────────────────────────────────────────────────────
  bakeGround() {
    const canvas = document.createElement('canvas')
    canvas.width = WORLD_W; canvas.height = WORLD_H
    const c = canvas.getContext('2d')
    c.imageSmoothingEnabled = false
    const pal = Object.fromEntries(BIOME_LIST.map(b => [b.id, b.palette]))
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x
        const biome = BIOME_ORDER[this.biomeGrid[i]]
        const terrain = this.terrainGrid[i]
        const p = pal[biome] || pal.forest
        const px = x * TILE, py = y * TILE
        const v = this.variantGrid[i] + Math.floor(hash2(x, y, 3) * 4)
        let color
        if (terrain === T.OCEAN || terrain === T.WATER) {
          color = terrain === T.OCEAN ? '#204868' : p.water
          if (biome === 'frozen' && terrain === T.WATER) color = '#a9ddec'
        } else if (terrain === T.LAVA) {
          color = (v % 2) ? '#d6512c' : '#ef6a2e'
        } else if (terrain === T.ICE) {
          color = v % 2 ? '#a9d9e8' : '#c2e9f2'
        } else if (terrain === T.BRIDGE) {
          color = biome === 'celestial' ? '#cbbf98' : '#8a6a48'
        } else if (terrain === T.PATH) {
          color = v % 3 === 0 ? p.path2 : p.path
        } else if (terrain === T.PLAZA) {
          color = biome === 'celestial' ? '#ddd5b6' : (v % 2 ? '#b8a47e' : '#c4b18a')
        } else if (terrain === T.ASH) {
          color = v % 2 ? '#3b3130' : '#453938'
        } else {
          color = [p.ground, p.ground2, p.ground3, p.ground][v % 4]
        }
        c.fillStyle = color
        c.fillRect(px, py, TILE, TILE)

        // organic tile texture
        const seed = hash2(x, y, 57)
        if (terrain === T.GROUND) {
          if (seed < 0.35) {
            c.fillStyle = p.ground2
            c.fillRect(px + 3 + Math.floor(seed * 30) % 8, py + 4 + Math.floor(seed * 17) % 7, 3, 2)
          }
          if (seed > 0.9) {
            c.fillStyle = p.ground3
            c.fillRect(px + 7, py + 9, 4, 2)
          }
          if (biome === 'forest' && seed > 0.75) {
            c.fillStyle = '#7fcf6f'
            c.fillRect(px + 4, py + 11, 1, 2); c.fillStyle = '#a8e88c'; c.fillRect(px + 4, py + 10, 1, 1)
          }
          if (biome === 'desert' && seed > 0.6) {
            c.fillStyle = 'rgba(255,240,190,0.35)'; c.fillRect(px + 2, py + 6, 6, 1)
          }
          if (biome === 'celestial' && seed > 0.62) {
            c.fillStyle = 'rgba(255,248,190,0.5)'; c.fillRect(px + 5, py + 7, 2, 2)
          }
        }
        if ((terrain === T.OCEAN || terrain === T.WATER) && seed > 0.55) {
          c.fillStyle = terrain === T.OCEAN ? '#3b6c8c' : 'rgba(220,250,255,0.5)'
          const wx = px + 2 + Math.floor(seed * 9)
          c.fillRect(wx, py + 4 + Math.floor(seed * 10 % 6), 5, 1)
          c.fillRect(wx + 2, py + 9 + Math.floor(seed * 13 % 4), 4, 1)
        }
        if (terrain === T.LAVA) {
          c.fillStyle = '#ffcf6a'
          c.fillRect(px + 4, py + 6 + Math.floor(seed * 6), 5, 2)
          if (seed > 0.6) c.fillRect(px + 9, py + 2, 2, 3)
        }
        if (terrain === T.BRIDGE) {
          c.fillStyle = 'rgba(45,25,15,0.55)'
          for (let k = 0; k < 4; k++) c.fillRect(px, py + k * 4, TILE, 1)
          c.fillStyle = '#3f2a1c'
          c.fillRect(px, py, 1, TILE); c.fillRect(px + TILE - 1, py, 1, TILE)
        }
        if (terrain === T.PATH || terrain === T.PLAZA) {
          if (seed > 0.6) { c.fillStyle = 'rgba(80,60,40,0.35)'; c.fillRect(px + 3, py + 5, 2, 2); c.fillRect(px + 10, py + 11, 2, 1) }
          if (seed < 0.12) { c.fillStyle = 'rgba(255,245,210,0.35)'; c.fillRect(px + 8, py + 7, 1, 1) }
        }
        // shoreline edges
        if (terrain !== T.WATER && terrain !== T.OCEAN && terrain !== T.LAVA) {
          const above = this.terrainGrid[(y - 1) * MAP_W + x]
          if (above === T.WATER || above === T.OCEAN) { c.fillStyle = 'rgba(240,250,255,0.6)'; c.fillRect(px, py, TILE, 2) }
        }
      }
    }
    // Fine details on plaza: mosaic around town centre
    for (const t of Object.values(this.towns)) {
      const cx = t.x * TILE + 8, cy = t.y * TILE + 8
      c.strokeStyle = 'rgba(255,240,200,0.28)'
      c.lineWidth = 1
      c.beginPath(); c.arc(cx, cy, 5 * TILE, 0, Math.PI * 2); c.stroke()
      c.beginPath(); c.arc(cx, cy, 2.4 * TILE, 0, Math.PI * 2); c.stroke()
    }
    this.mapCanvas = canvas
  }

  buildMinimap() {
    const canvas = document.createElement('canvas')
    canvas.width = MAP_W; canvas.height = MAP_H
    const c = canvas.getContext('2d')
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x
        const terrain = this.terrainGrid[i]
        const b = BIOMES[BIOME_ORDER[this.biomeGrid[i]]] || BIOMES.forest
        let col = b.palette.ground
        if (terrain === T.OCEAN) col = '#1b3f5c'
        else if (terrain === T.WATER) col = '#356b8a'
        else if (terrain === T.LAVA) col = '#e2572c'
        else if (terrain === T.PATH) col = '#c9b48b'
        else if (terrain === T.PLAZA) col = '#e2d3ad'
        else if (terrain === T.BRIDGE) col = '#b09369'
        c.fillStyle = col
        c.fillRect(x, y, 1, 1)
      }
    }
    this.minimap = canvas
  }

  // ── entities ──────────────────────────────────────────────────────────────
  spawnAll() {
    this.spawnNpcs()
    this.spawnResources()
    this.spawnBosses()
    this.spawnMythics()
    for (const b of BIOME_LIST) {
      for (let i = 0; i < WILD_TARGET_PER_BIOME; i++) this.spawnWild(b.id)
    }
  }

  spawnNpcs() {
    for (const b of BIOME_LIST) {
      const town = this.towns[b.id]
      for (const def of npcsForBiome(b.id)) {
        const x = (town.x + def.offset[0]) * TILE + 8
        const y = (town.y + def.offset[1]) * TILE + 14
        this.npcs.push({ ...def, biome: b.id, x, y, home: { x, y }, dir: 'down', kind: 'npc' })
      }
    }
  }

  spawnResources() {
    const rng = mulberry32(9981)
    for (const b of BIOME_LIST) {
      let placed = 0, attempts = 0
      while (placed < 9 && attempts++ < 200) {
        const x = b.center[0] + Math.round((rng() - 0.5) * 38)
        const y = b.center[1] + Math.round((rng() - 0.5) * 32)
        if (x < 6 || y < 6 || x >= MAP_W - 6 || y >= MAP_H - 6) continue
        if (BIOME_ORDER[this.biomeGrid[y * MAP_W + x]] !== b.id) continue
        if (this.isSolidTile(x, y) || this.isSolidTile(x + 1, y)) continue
        if (this.nearTown(x, y, 11) || this.nearBoss(x, y, 9)) continue
        if (this.resources.some(r => Math.hypot(r.tx - x, r.ty - y) < 4)) continue
        const item = pick(b.resources, rng)
        this.resources.push({
          id: `res_${b.id}_${placed}`,
          item,
          biome: b.id,
          tx: x, ty: y,
          x: x * TILE + 8, y: y * TILE + 12,
          available: true,
          respawnAt: 0,
          kind: 'resource',
        })
        placed++
      }
    }
  }

  spawnBosses() {
    for (const b of BIOME_LIST) {
      if (this.state.flags.bosses[b.id]) continue
      const p = this.bossPoints[b.id]
      const monster = createMonster(b.boss.species, b.boss.level, { friendship: 50 })
      monster.hp = maxHpOf(monster)
      this.bosses.push({
        id: `boss_${b.id}`, kind: 'boss', biome: b.id,
        x: p.x * TILE + 8, y: p.y * TILE + 14,
        home: { x: p.x * TILE + 8, y: p.y * TILE + 14 },
        monster, speciesId: b.boss.species, bob: Math.random() * 6,
        name: `${b.boss.arena} Guardian`, arena: b.boss.arena,
      })
    }
  }

  spawnMythics() {
    for (const b of BIOME_LIST) {
      if (!this.state.flags.bosses[b.id] || this.state.flags.mythic[b.id]) continue
      if (this.mythics.some(m => m.biome === b.id)) continue
      const p = this.mythicPoints[b.id]
      const monster = createMonster(b.mythic.species, b.mythic.level, { friendship: 50 })
      monster.hp = maxHpOf(monster)
      this.mythics.push({
        id: `mythic_${b.id}`, kind: 'mythic', biome: b.id,
        x: p.x * TILE + 8, y: p.y * TILE + 14,
        home: { x: p.x * TILE + 8, y: p.y * TILE + 14 },
        monster, speciesId: b.mythic.species, bob: Math.random() * 6,
        name: `${getMonster(b.mythic.species).name} — Mythic`,
      })
    }
  }

  spawnTable(biome) {
    const night = isNight(this.state.time.minutes)
    const b = BIOMES[biome]
    const entries = []
    for (const m of MONSTER_LIST) {
      if (m.biome !== biome || m.wild === false) continue
      if (m.legendary) continue
      let weight = RARITY[m.rarity]?.weight || 10
      if (m.nocturnal) {
        if (!night) continue
        weight *= 2.4
      } else if (night) weight *= 0.72
      if (m.evolutions?.length) weight *= 0.8
      entries.push({ monster: m, weight })
    }
    if (!entries.length) entries.push({ monster: MONSTER_LIST.find(m => m.biome === biome), weight: 1 })
    return entries
  }

  spawnWild(biome, opts = {}) {
    const biomeDef = BIOMES[biome]
    const entries = this.spawnTable(biome)
    let total = entries.reduce((s, e) => s + e.weight, 0)
    let roll = Math.random() * total
    let chosen = entries[entries.length - 1]
    for (const e of entries) { roll -= e.weight; if (roll <= 0) { chosen = e; break } }
    const species = chosen.monster
    const level = opts.level ?? randomInt(biomeDef.level[0], biomeDef.level[1])
    const pos = this.findSpawnPosition(biome, opts.near)
    if (!pos) return null
    const monster = createMonster(species.id, level)
    monster.hp = maxHpOf(monster)
    markSeen(this.state, species.id)
    const wild = {
      id: `wild_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      kind: 'wild', biome,
      x: pos.x * TILE + 8, y: pos.y * TILE + 12,
      home: { x: pos.x * TILE + 8, y: pos.y * TILE + 12 },
      speciesId: species.id, monster, level,
      vx: 0, vy: 0, moveTimer: Math.random() * 2, dir: Math.random() < 0.5 ? 'left' : 'right',
      bob: Math.random() * 6,
      spawnedAt: performance.now(),
    }
    this.wilds.push(wild)
    return wild
  }

  findSpawnPosition(biome, near = null) {
    const b = BIOMES[biome]
    for (let i = 0; i < 100; i++) {
      let tx, ty
      if (near) {
        tx = Math.floor(near.x / TILE) + randomInt(-8, 8)
        ty = Math.floor(near.y / TILE) + randomInt(-6, 6)
      } else {
        tx = b.center[0] + randomInt(-24, 24)
        ty = b.center[1] + randomInt(-20, 20)
      }
      if (tx < 5 || ty < 5 || tx >= MAP_W - 5 || ty >= MAP_H - 5) continue
      const i2 = ty * MAP_W + tx
      if (BIOME_ORDER[this.biomeGrid[i2]] !== biome) continue
      if (this.solidGrid[i2]) continue
      if (this.nearTown(tx, ty, 9)) continue
      const px = tx * TILE + 8, py = ty * TILE + 12
      if (this.player && Math.hypot(px - this.player.x, py - this.player.y) < 100) continue
      if (this.wilds.some(w => Math.hypot(w.x - px, w.y - py) < 40)) continue
      if (this.bosses.some(w => Math.hypot(w.x - px, w.y - py) < 30)) continue
      return { x: tx, y: ty }
    }
    return null
  }

  // ── runtime ───────────────────────────────────────────────────────────────
  placePlayerFromState() {
    const p = this.state.player
    if (p.x && p.y && this.canWalk(p.x, p.y)) {
      this.player.x = p.x; this.player.y = p.y
    } else {
      const t = this.towns[p.biome] || this.towns.forest
      this.player.x = t.x * TILE + 8
      this.player.y = (t.y + 3) * TILE + 10
    }
    this.player.dir = p.dir || 'down'
    this.currentBiome = this.biomeAtPixel(this.player.x, this.player.y)
    // Never drop the player directly next to a wild monster on load.
    this.wilds = this.wilds.filter(w => Math.hypot(w.x - this.player.x, w.y - this.player.y) > 110)
    this.encounterCooldown = 1.5
  }

  biomeAtPixel(x, y) {
    const tx = clamp(Math.floor(x / TILE), 0, MAP_W - 1)
    const ty = clamp(Math.floor(y / TILE), 0, MAP_H - 1)
    return BIOME_ORDER[this.biomeGrid[ty * MAP_W + tx]]
  }

  biomeAtTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 'celestial'
    return BIOME_ORDER[this.biomeGrid[ty * MAP_W + tx]]
  }

  canWalk(x, y) {
    const hw = 5, hh = 4
    for (const [ox, oy] of [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]) {
      if (this.isSolidTile(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false
    }
    return true
  }

  movePlayer(dx, dy) {
    const p = this.player
    if (dx) {
      if (this.canWalk(p.x + dx, p.y)) p.x += dx
      else {
        // slide along blocked edges
        const step = Math.sign(dx) * 0.5
        for (let i = 0; i < Math.abs(dx) * 2; i++) { if (this.canWalk(p.x + step, p.y)) p.x += step; else break }
      }
    }
    if (dy) {
      if (this.canWalk(p.x, p.y + dy)) p.y += dy
      else {
        const step = Math.sign(dy) * 0.5
        for (let i = 0; i < Math.abs(dy) * 2; i++) { if (this.canWalk(p.x, p.y + step)) p.y += step; else break }
      }
    }
    if (dx || dy) {
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
      const moved = Math.hypot(dx, dy)
      this.onPlayerMoved(moved)
    }
  }

  onPlayerMoved(distance) {
    const st = this.state
    st.stats.steps += distance / TILE
    st.player.steps += distance / TILE
    this.stepAccumulator += distance / TILE
    if (this.stepAccumulator >= 1) {
      const steps = Math.floor(this.stepAccumulator)
      this.stepAccumulator -= steps
      this.advanceEggs(steps * 2)
    }
    const biome = this.biomeAtPixel(this.player.x, this.player.y)
    if (biome !== this.currentBiome) {
      this.currentBiome = biome
      st.player.biome = biome
      const first = !st.flags.visited[biome]
      visitBiome(st, biome)
      emit('toast', {
        title: first ? 'New Region Discovered' : BIOMES[biome].name,
        text: first ? BIOMES[biome].short + ' added to your map.' : '',
        icon: BIOMES[biome].icon,
        tone: 'region',
      })
      emit('biome-change', { biome })
    }
  }

  advanceEggs(steps) {
    for (const m of [...this.state.party, ...this.state.storage]) {
      if (!m.isEgg) continue
      m.hatchSteps = Math.max(0, m.hatchSteps - steps)
      if (m.hatchSteps <= 0 && !m.hatching) {
        m.hatching = true
        emit('egg-ready', { egg: m })
      }
    }
  }

  update(dt) {
    this.time += dt
    // advance game clock: one in-game minute per 1.5 real seconds
    this.clockAccumulator = (this.clockAccumulator || 0) + dt
    if (this.clockAccumulator > 1.5) {
      const mins = Math.floor(this.clockAccumulator / 1.5)
      this.clockAccumulator -= mins * 1.5
      advanceTime(this.state, mins * 0.9)
    }
    this.encounterCooldown = Math.max(0, this.encounterCooldown - dt)

    this.updateWilds(dt)
    this.updateSpawns(dt)
    this.updateResources()

    const near = this.nearestInteraction()
    const auto = this.closestWild(18)
    if (auto && this.encounterCooldown <= 0) {
      this.encounterCooldown = 1.5
      return { encounter: auto, near }
    }
    return { near }
  }

  updateWilds(dt) {
    const now = performance.now()
    for (const w of this.wilds) {
      w.bob += dt
      w.moveTimer -= dt
      if (w.moveTimer <= 0) {
        w.moveTimer = 1 + Math.random() * 2.6
        const ang = Math.random() * Math.PI * 2
        w.vx = Math.cos(ang) * (Math.random() < 0.35 ? 18 : 9)
        w.vy = Math.sin(ang) * (Math.random() < 0.35 ? 14 : 7)
        if (Math.abs(w.vx) > Math.abs(w.vy)) w.dir = w.vx > 0 ? 'right' : 'left'
      }
      // drift home if too far
      const dhome = Math.hypot(w.x - w.home.x, w.y - w.home.y)
      if (dhome > 90) {
        w.vx += (w.home.x - w.x) * 0.3 * dt
        w.vy += (w.home.y - w.y) * 0.3 * dt
      }
      const speed = 14
      const nx = w.x + w.vx * dt * 0.5 * speed / 10
      const ny = w.y + w.vy * dt * 0.5 * speed / 10
      if (this.canWalkWild(nx, w.y)) w.x = nx
      if (this.canWalkWild(w.x, ny)) w.y = ny
      if (now - w.spawnedAt > 1000 * 60 * 8) w.expired = true
    }
    this.wilds = this.wilds.filter(w => {
      if (!w.expired) return true
      return false
    })
  }

  canWalkWild(x, y) {
    const hw = 4, hh = 3
    for (const [ox, oy] of [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]) {
      if (this.isSolidTile(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false
    }
    if (Math.hypot(x - this.player.x, y - this.player.y) < 26) return false
    return true
  }

  updateSpawns(dt) {
    for (const b of BIOME_LIST) {
      const count = this.wilds.filter(w => w.biome === b.id).length
      if (count < WILD_TARGET_PER_BIOME) {
        this.spawnTimers[b.id] = (this.spawnTimers[b.id] || 0) + dt
        if (this.spawnTimers[b.id] > 4) {
          this.spawnTimers[b.id] = 0
          this.spawnWild(b.id)
        }
      }
    }
  }

  updateResources() {
    const now = performance.now()
    for (const r of this.resources) {
      if (!r.available && now >= r.respawnAt) r.available = true
    }
  }

  closestWild(radius) {
    let best = null, bestD = radius
    for (const w of this.wilds) {
      const d = dist(w.x, w.y, this.player.x, this.player.y)
      if (d < bestD) { bestD = d; best = w }
    }
    return best
  }

  nearestInteraction(radius = 34) {
    const p = this.player
    const options = []
    for (const n of this.npcs) {
      const d = dist(n.x, n.y, p.x, p.y)
      if (d < radius) options.push({ kind: 'npc', entity: n, d })
    }
    for (const r of this.resources) {
      if (!r.available) continue
      const d = dist(r.x, r.y, p.x, p.y)
      if (d < radius) options.push({ kind: 'resource', entity: r, d })
    }
    for (const b of this.bosses) {
      const d = dist(b.x, b.y, p.x, p.y)
      if (d < radius + 12) options.push({ kind: 'boss', entity: b, d })
    }
    for (const m of this.mythics) {
      const d = dist(m.x, m.y, p.x, p.y)
      if (d < radius + 10) options.push({ kind: 'mythic', entity: m, d })
    }
    const wild = this.closestWild(radius)
    if (wild) options.push({ kind: 'wild', entity: wild, d: dist(wild.x, wild.y, p.x, p.y) })
    options.sort((a, b) => a.d - b.d)
    return options[0] || null
  }

  removeWild(wild, { defeated = true } = {}) {
    this.wilds = this.wilds.filter(w => w.id !== wild.id)
    this.encounterCooldown = 2
    const b = BIOMES[wild.biome]
    setTimeout(() => {
      if (this.wilds.filter(w => w.biome === wild.biome).length < WILD_TARGET_PER_BIOME) this.spawnWild(wild.biome)
    }, 3500)
  }

  removeBoss(boss, captured = false) {
    this.bosses = this.bosses.filter(b => b.id !== boss.id)
    this.state.flags.bosses[boss.biome] = captured ? 'captured' : 'defeated'
    if (!this.state.flags.mythic[boss.biome]) this.spawnMythics()
  }

  removeMythic(mythic, captured = false) {
    this.mythics = this.mythics.filter(m => m.id !== mythic.id)
    this.state.flags.mythic[mythic.biome] = captured ? 'captured' : 'defeated'
  }

  getBossForBiome(biome) {
    return this.bosses.find(b => b.biome === biome) || null
  }

  gatherResource(resource) {
    if (!resource.available) return null
    const count = 1 + (Math.random() < 0.25 ? 1 : 0)
    resource.available = false
    resource.respawnAt = performance.now() + 120000
    recordGather(this.state, resource.item, count)
    return count
  }

  playablePositionsAround(tx, ty, radius = 8) {
    const out = []
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (!this.isSolidTile(tx + dx, ty + dy)) out.push([tx + dx, ty + dy])
    }
    return out
  }

  getDecosAround(camX, camY, camW, camH) {
    const minX = Math.floor(camX / (TILE * 12)) - 1
    const maxX = Math.floor((camX + camW) / (TILE * 12)) + 1
    const minY = Math.floor(camY / (TILE * 12)) - 1
    const maxY = Math.floor((camY + camH) / (TILE * 12)) + 1
    const out = []
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const chunk = this.decoChunks.get(`${cx},${cy}`)
        if (chunk) out.push(...chunk)
      }
    }
    return out
  }
}

export { T }
