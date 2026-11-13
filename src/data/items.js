// Item & recipe database. Items are data; inventory behavior lives in game/inventory.js.

export const ITEMS = {
  // Capture orbs
  capture_orb: { name: 'Capture Orb', type: 'orb', mult: 1, price: 90, color: '#e3b96b', icon: '◉', desc: 'A basic orb for catching weakened monsters.' },
  silver_orb: { name: 'Silver Orb', type: 'orb', mult: 1.7, price: 280, color: '#d7e2ec', icon: '◉', desc: 'A refined orb with a much higher catch rate.' },
  golden_orb: { name: 'Golden Orb', type: 'orb', mult: 2.6, price: 720, color: '#ffd36e', icon: '◉', desc: 'A luxury orb. Great on rare and epic monsters.' },
  astral_orb: { name: 'Astral Orb', type: 'orb', mult: 3.6, price: 1600, color: '#b48ae0', icon: '◉', desc: 'Woven from starlight. The best chance to catch legends.' },

  // Healing
  minor_mend: { name: 'Minor Mend', type: 'potion', heal: 35, price: 60, color: '#8ee08a', icon: '✚', desc: 'Restores 35 HP to one monster.' },
  mend_potion: { name: 'Mend Potion', type: 'potion', heal: 90, price: 180, color: '#63cf7a', icon: '✚', desc: 'Restores 90 HP to one monster.' },
  great_mend: { name: 'Great Mend', type: 'potion', heal: 220, price: 480, color: '#35b96d', icon: '✚', desc: 'Restores 220 HP to one monster.' },
  full_restore: { name: 'Full Restore', type: 'potion', heal: 'full', cure: true, price: 1100, color: '#ffe27a', icon: '✚', desc: 'Fully restores HP and clears all status.' },
  revive_shard: { name: 'Revive Shard', type: 'revive', revive: 0.5, price: 420, color: '#f0b8ff', icon: '◈', desc: 'Revives a fainted monster with half its HP.' },
  energy_sip: { name: 'Energy Sip', type: 'battle', energy: 45, price: 150, color: '#9db9ff', icon: '⚡', desc: 'Restores 45 energy during battle.' },
  antidote: { name: 'Antidote', type: 'cure', cure: ['poison', 'burn'], price: 80, color: '#c084fc', icon: '✧', desc: 'Cures poison and burn.' },
  awaken: { name: 'Awaken', type: 'cure', cure: ['sleep'], price: 80, color: '#9db9ff', icon: '✧', desc: 'Wakes a sleeping monster.' },
  thaw_crystal: { name: 'Thaw Crystal', type: 'cure', cure: ['freeze'], price: 80, color: '#7fd8ef', icon: '✧', desc: 'Thaws a frozen monster.' },
  escape_rope: { name: 'Escape Rope', type: 'battle', escape: true, price: 120, color: '#d9ae6b', icon: '⟲', desc: 'Guarantees escape from a wild battle.' },

  // Progression
  bond_charm: { name: 'Bond Charm', type: 'gift', friendship: 20, price: 320, color: '#ff9fb8', icon: '♥', desc: 'Raises a monster\'s friendship by 20.' },
  exp_candy: { name: 'Exp Candy', type: 'gift', xp: 260, price: 400, color: '#ffd36e', icon: '★', desc: 'Grants 260 experience to one monster.' },

  // Evolution items
  ember_heart: { name: 'Ember Heart', type: 'evo', element: 'flame', price: 1400, color: '#ff8a4c', icon: '❤', desc: 'A molten core. Evolves certain Flame monsters.' },
  glacier_core: { name: 'Glacier Core', type: 'evo', element: 'frost', price: 1400, color: '#7fd8ef', icon: '❄', desc: 'An ancient frozen heart. Evolves certain Frost monsters.' },
  solar_shard: { name: 'Solar Shard', type: 'evo', element: 'earth', price: 1400, color: '#ffd36e', icon: '◆', desc: 'A shard of desert glass. Evolves certain Earth monsters.' },
  chronogear: { name: 'Chrono Gear', type: 'evo', element: 'earth', price: 1600, color: '#d9ae6b', icon: '⚙', desc: 'A gear that ticks backwards. Evolves certain Ruins monsters.' },
  dragon_scale: { name: 'Dragon Scale', type: 'evo', element: 'dragon', price: 1800, color: '#e8848c', icon: '✧', desc: 'A scale humming with old power. Evolves certain Dragon monsters.' },

  // Resources
  herb: { name: 'Dew Herb', type: 'resource', price: 14, color: '#8ee08a', icon: '❧', desc: 'A fragrant herb used in crafting.' },
  ember_shard: { name: 'Ember Shard', type: 'resource', price: 22, color: '#ff8a4c', icon: '✦', desc: 'A warm shard chipped from volcanic rock.' },
  ice_shard: { name: 'Ice Shard', type: 'resource', price: 22, color: '#7fd8ef', icon: '❄', desc: 'A shard of never-melting mountain ice.' },
  crystal_shard: { name: 'Crystal Shard', type: 'resource', price: 26, color: '#c9b3ff', icon: '◆', desc: 'A humming crystal from the desert.' },
  relic_fragment: { name: 'Relic Fragment', type: 'resource', price: 30, color: '#d8cbb6', icon: '▣', desc: 'A scratched fragment of a forgotten civilization.' },
  spore_cap: { name: 'Spore Cap', type: 'resource', price: 18, color: '#b48ae0', icon: '♠', desc: 'A mushroom cap that glows in the dark.' },
  iron_ore: { name: 'Iron Ore', type: 'resource', price: 20, color: '#a8b3bd', icon: '⬢', desc: 'Common ore used in crafting.' },
  scrap_metal: { name: 'Scrap Metal', type: 'resource', price: 16, color: '#9aa5ae', icon: '⚙', desc: 'Twisted metal from ruins and machines.' },
  stardust: { name: 'Stardust', type: 'resource', price: 40, color: '#ffe27a', icon: '✧', desc: 'Faintly warm dust from a fallen star.' },
  spring_water: { name: 'Spring Water', type: 'resource', price: 12, color: '#9fd9ff', icon: '≈', desc: 'Clean water with a faint mineral sparkle.' },
  dusk_flower: { name: 'Dusk Flower', type: 'resource', price: 24, color: '#b48ae0', icon: '✿', desc: 'Blooms only under moonlight.' },
  sun_bloom: { name: 'Sun Bloom', type: 'resource', price: 24, color: '#ffe27a', icon: '✿', desc: 'A flower that turns to follow the sun.' },

  // Key items
  region_map: { name: 'Region Map', type: 'key', price: 0, color: '#e3b96b', icon: '▤', desc: 'A hand-drawn map of the whole continent.' },
  field_notes: { name: 'Field Notes', type: 'key', price: 0, color: '#d8cbb6', icon: '▤', desc: 'A blank journal for quests and achievements.' },
}

export const ORB_TIERS = ['capture_orb', 'silver_orb', 'golden_orb', 'astral_orb']

export const RECIPES = [
  { id: 'r_orb', name: 'Capture Orb ×2', out: { item: 'capture_orb', count: 2 }, cost: [{ item: 'herb', count: 2 }, { item: 'iron_ore', count: 1 }] },
  { id: 'r_minor', name: 'Minor Mend ×2', out: { item: 'minor_mend', count: 2 }, cost: [{ item: 'herb', count: 2 }, { item: 'spring_water', count: 1 }] },
  { id: 'r_silver', name: 'Silver Orb', out: { item: 'silver_orb', count: 1 }, cost: [{ item: 'capture_orb', count: 2 }, { item: 'crystal_shard', count: 1 }] },
  { id: 'r_antidote', name: 'Antidote', out: { item: 'antidote', count: 1 }, cost: [{ item: 'herb', count: 1 }, { item: 'spore_cap', count: 1 }] },
  { id: 'r_mend', name: 'Mend Potion', out: { item: 'mend_potion', count: 1 }, cost: [{ item: 'herb', count: 2 }, { item: 'spring_water', count: 2 }, { item: 'sun_bloom', count: 1 }] },
  { id: 'r_golden', name: 'Golden Orb', out: { item: 'golden_orb', count: 1 }, cost: [{ item: 'silver_orb', count: 2 }, { item: 'stardust', count: 2 }, { item: 'sun_bloom', count: 1 }] },
  { id: 'r_revive', name: 'Revive Shard', out: { item: 'revive_shard', count: 1 }, cost: [{ item: 'stardust', count: 2 }, { item: 'crystal_shard', count: 2 }] },
  { id: 'r_emberheart', name: 'Ember Heart', out: { item: 'ember_heart', count: 1 }, cost: [{ item: 'ember_shard', count: 4 }, { item: 'iron_ore', count: 2 }] },
  { id: 'r_glaciercore', name: 'Glacier Core', out: { item: 'glacier_core', count: 1 }, cost: [{ item: 'ice_shard', count: 4 }, { item: 'crystal_shard', count: 2 }] },
  { id: 'r_solarshard', name: 'Solar Shard', out: { item: 'solar_shard', count: 1 }, cost: [{ item: 'crystal_shard', count: 3 }, { item: 'sun_bloom', count: 2 }] },
  { id: 'r_chronogear', name: 'Chrono Gear', out: { item: 'chronogear', count: 1 }, cost: [{ item: 'scrap_metal', count: 3 }, { item: 'crystal_shard', count: 2 }, { item: 'relic_fragment', count: 1 }] },
  { id: 'r_dragonscale', name: 'Dragon Scale', out: { item: 'dragon_scale', count: 1 }, cost: [{ item: 'relic_fragment', count: 2 }, { item: 'iron_ore', count: 2 }, { item: 'stardust', count: 2 }] },
  { id: 'r_bond', name: 'Bond Charm', out: { item: 'bond_charm', count: 1 }, cost: [{ item: 'dusk_flower', count: 2 }, { item: 'sun_bloom', count: 2 }, { item: 'stardust', count: 1 }] },
]

export function getItem(id) {
  const item = ITEMS[id]
  if (item) return item.id ? item : { ...item, id }
  return { id, name: id, type: 'misc', desc: '', icon: '?' }
}

export const SHOP_STOCK = [
  'capture_orb', 'silver_orb', 'minor_mend', 'mend_potion', 'antidote', 'awaken', 'thaw_crystal', 'energy_sip', 'escape_rope',
]
