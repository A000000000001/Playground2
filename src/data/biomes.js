// Biome definitions: world placement, palettes, spawn ranges, towns, bosses and resources.

export const BIOME_ORDER = ['forest', 'swamp', 'desert', 'frozen', 'volcano', 'ruins', 'dragon', 'celestial']

export const BIOMES = {
  forest: {
    id: 'forest', name: 'Greenwood Forest', short: 'Greenwood', icon: '❧',
    center: [34, 96], level: [3, 9], hue: '#6fce74',
    desc: 'Sun-dappled woodland full of chattering brooks, mossy shrines and shy forest spirits.',
    palette: { ground: '#3f7a48', ground2: '#356a3f', ground3: '#4b8a52', path: '#b39a66', path2: '#a08655', water: '#3f86a8', accent: '#8fe07a', solidName: 'Oak' },
    deco: ['tree', 'bush', 'flowers', 'stump', 'fern'],
    weather: 'leaves', night: '#0b1b33', town: { name: 'Mossglow Village', offset: [-6, 6] },
    resources: ['herb', 'spring_water', 'dusk_flower'],
    boss: { species: 'sylvanox', level: 22, arena: 'The Elder Grove', offset: [-10, -11], reward: ['golden_orb', 'ember_heart'], achievement: 'boss_forest' },
    mythic: { species: 'verdantus', level: 50, offset: [18, 8] },
    starterHint: 'A gentle forest where every path smells of rain and wildflowers.',
  },
  swamp: {
    id: 'swamp', name: 'Shadow Swamp', short: 'Shadowfen', icon: '☾',
    center: [30, 34], level: [18, 27], hue: '#a17ad6',
    desc: 'A drowned forest of crooked trees and glowing spores. The water remembers everything.',
    palette: { ground: '#3b3b4c', ground2: '#31313f', ground3: '#46465a', path: '#6e6050', path2: '#5b5042', water: '#2c4a52', accent: '#b48ae0', solidName: 'Deadwood' },
    deco: ['deadTree', 'reed', 'mushroom', 'bone', 'wisp'],
    weather: 'spores', night: '#080619', town: { name: 'Fenmarket', offset: [-6, -4] },
    resources: ['spore_cap', 'dusk_flower', 'spring_water'],
    boss: { species: 'grimroot', level: 33, arena: 'The Drowned Court', offset: [14, 10], reward: ['golden_orb', 'astral_orb'], achievement: 'boss_swamp' },
    mythic: { species: 'umbraxis', level: 52, offset: [-12, 12] },
    starterHint: 'Stay on the boardwalks. The swamp is always listening.',
  },
  desert: {
    id: 'desert', name: 'Crystal Desert', short: 'Crystalis', icon: '⬢',
    center: [88, 26], level: [10, 18], hue: '#e8c27a',
    desc: 'White dunes, singing crystal spires and a sun that polishes everything to a mirror shine.',
    palette: { ground: '#c9a76c', ground2: '#b89658', ground3: '#d8b87c', path: '#a98a5b', path2: '#94774b', water: '#4f9fb0', accent: '#f5dfb0', solidName: 'Crystal' },
    deco: ['cactus', 'crystal', 'rock', 'skull', 'pillar'],
    weather: 'sand', night: '#1a1533', town: { name: 'Sunspire Bazaar', offset: [5, -6] },
    resources: ['crystal_shard', 'sun_bloom', 'iron_ore'],
    boss: { species: 'mirageking', level: 29, arena: 'The Mirror Dunes', offset: [16, 10], reward: ['golden_orb', 'solar_shard'], achievement: 'boss_desert' },
    mythic: { species: 'terravore', level: 52, offset: [-14, 12] },
    starterHint: 'Travel by night where possible. The crystals hum louder after dark.',
  },
  frozen: {
    id: 'frozen', name: 'Frozen Mountains', short: 'Frostpeak', icon: '❄',
    center: [142, 28], level: [15, 24], hue: '#9fdff0',
    desc: 'Wind-carved peaks, blue glaciers and hot springs that steam beneath a pale sun.',
    palette: { ground: '#c9d9e2', ground2: '#b3c6d2', ground3: '#e0ecf2', path: '#aebac4', path2: '#98a6b1', water: '#79b9d6', accent: '#d5f7ff', solidName: 'Frost Pine' },
    deco: ['pine', 'iceRock', 'snowdrift', 'cairn', 'spring'],
    weather: 'snow', night: '#081a2c', town: { name: 'Hearthhold', offset: [-6, 5] },
    resources: ['ice_shard', 'crystal_shard', 'spring_water'],
    boss: { species: 'glacierex', level: 35, arena: 'The Silent Cirque', offset: [10, 16], reward: ['golden_orb', 'glacier_core'], achievement: 'boss_frozen' },
    mythic: { species: 'glacia', level: 54, offset: [-16, 16] },
    starterHint: 'Follow the lanterns. The mountain moves its paths when no one watches.',
  },
  volcano: {
    id: 'volcano', name: 'Ember Volcano', short: 'Emberpeak', icon: '✦',
    center: [146, 82], level: [12, 20], hue: '#ff8a4c',
    desc: 'A restlessly breathing caldera of obsidian bridges, ember geysers and forge-towns.',
    palette: { ground: '#4b3b3a', ground2: '#3d3030', ground3: '#5a4542', path: '#6d5347', path2: '#5a443b', water: '#c74b2f', accent: '#ffb066', solidName: 'Obsidian' },
    deco: ['obsidian', 'lavaRock', 'vent', 'forge', 'ashpile'],
    weather: 'ash', night: '#1b0906', town: { name: 'Cinderforge', offset: [-7, 5] },
    resources: ['ember_shard', 'iron_ore', 'crystal_shard'],
    boss: { species: 'volcanix', level: 35, arena: 'The Caldera Throne', offset: [-14, 14], reward: ['golden_orb', 'ember_heart'], achievement: 'boss_volcano' },
    mythic: { species: 'pyraxis', level: 54, offset: [8, -14] },
    starterHint: 'Mind the geysers. The forge-folk say the mountain has a temper.',
  },
  ruins: {
    id: 'ruins', name: 'Ancient Ruins', short: 'Oldstone', icon: '▣',
    center: [74, 110], level: [22, 31], hue: '#d8cbb6',
    desc: 'A sunken city of broken columns and clockwork tombs, where the past refuses to stay buried.',
    palette: { ground: '#6e705c', ground2: '#5e604e', ground3: '#7e816b', path: '#a39678', path2: '#8d8064', water: '#4f7c7a', accent: '#e3d6b8', solidName: 'Ruin Pillar' },
    deco: ['pillar', 'rubble', 'urn', 'stairs', 'gear'],
    weather: 'dust', night: '#0f1220', town: { name: "Wayfarer's Rest", offset: [5, 5] },
    resources: ['relic_fragment', 'scrap_metal', 'iron_ore'],
    boss: { species: 'chronohound', level: 39, arena: 'The Clockwork Vault', offset: [16, 8], reward: ['astral_orb', 'chronogear'], achievement: 'boss_ruins' },
    mythic: { species: 'stormquill', level: 56, offset: [-16, 6] },
    starterHint: 'The ruins are older than the biomes around them. Do not touch the glowing gears.',
  },
  dragon: {
    id: 'dragon', name: 'Dragon Valley', short: 'Dragonvale', icon: '✧',
    center: [142, 114], level: [28, 38], hue: '#e8848c',
    desc: 'A vast red-rock valley of hot springs, ancient bones and winds that carry distant roars.',
    palette: { ground: '#7a5146', ground2: '#68443b', ground3: '#8a5c4f', path: '#b08a6b', path2: '#987556', water: '#4a8d8a', accent: '#ffc2c6', solidName: 'Dragon Spine' },
    deco: ['bone', 'spike', 'nest', 'spring', 'banner'],
    weather: 'embers', night: '#1a0c18', town: { name: 'Scalehold', offset: [-6, -7] },
    resources: ['relic_fragment', 'iron_ore', 'stardust'],
    boss: { species: 'dracolord', level: 46, arena: 'The Skybone Aerie', offset: [12, 6], reward: ['astral_orb', 'dragon_scale'], achievement: 'boss_dragon' },
    mythic: { species: 'ouroboros', level: 58, offset: [-14, 10] },
    starterHint: 'The valley drakes respect strength. Bring a full party.',
  },
  celestial: {
    id: 'celestial', name: 'Celestial Island', short: 'Celestia', icon: '☀',
    center: [94, 70], level: [34, 45], hue: '#ffe27a',
    desc: 'An island suspended between sea and sky. Starfall Sanctum crowns a hill of glass and moonlight.',
    palette: { ground: '#567a72', ground2: '#46685f', ground3: '#689089', path: '#d7d0b0', path2: '#c1ba99', water: '#3e6f91', accent: '#fff8cc', solidName: 'Starstone' },
    deco: ['starflower', 'cloudstone', 'crystal', 'obelisk', 'lantern'],
    weather: 'stars', night: '#100b2b', town: { name: 'Starfall Sanctum', offset: [0, -1] },
    resources: ['stardust', 'sun_bloom', 'crystal_shard'],
    boss: { species: 'aurorix', level: 52, arena: 'The Astral Crown', offset: [8, 10], reward: ['astral_orb', 'stardust'], achievement: 'boss_celestial' },
    mythic: { species: 'aurorix', level: 60, offset: [-7, 9] },
    starterHint: 'The final isle. Only the strongest trainers find their way across the bridges.',
  },
}

export const BIOME_LIST = BIOME_ORDER.map(id => BIOMES[id])

export function biomeAt(centerIndex) {
  return BIOMES[BIOME_ORDER[centerIndex]]
}

export const TRAINER_TITLES = ['Novice', 'Scout', 'Ranger', 'Adept', 'Warden', 'Elite', 'Champion']
