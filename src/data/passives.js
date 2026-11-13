// Passive abilities: data consumed by the battle engine.
// kind is interpreted by battle.js so passives stay declarative.

export const PASSIVES = {
  overgrow:    { name: 'Overgrow', kind: 'lowHpBoost', element: 'nature', value: 1.3, desc: 'Nature skills are 30% stronger below 1/3 HP.' },
  blaze:       { name: 'Blaze', kind: 'lowHpBoost', element: 'flame', value: 1.3, desc: 'Flame skills are 30% stronger below 1/3 HP.' },
  torrent:     { name: 'Torrent', kind: 'lowHpBoost', element: 'frost', value: 1.3, desc: 'Frost skills are 30% stronger below 1/3 HP.' },
  swarm:       { name: 'Swarm', kind: 'lowHpBoost', element: 'shadow', value: 1.25, desc: 'Shadow skills are stronger below 1/3 HP.' },
  levitate:    { name: 'Levitate', kind: 'immuneElement', element: 'earth', desc: 'Immune to Earth damage.' },
  thick_hide:  { name: 'Thick Hide', kind: 'damageReduce', category: 'physical', value: 0.84, desc: 'Takes 16% less physical damage.' },
  armored:     { name: 'Armored', kind: 'statBoost', stat: 'def', value: 1.16, desc: 'Defense is 16% higher.' },
  swift:       { name: 'Swift', kind: 'statBoost', stat: 'spe', value: 1.14, desc: 'Speed is 14% higher.' },
  mystic:      { name: 'Mystic', kind: 'statBoost', stat: 'spa', value: 1.12, desc: 'Sp. Atk is 12% higher.' },
  regenerator: { name: 'Regenerator', kind: 'healPerTurn', value: 0.06, desc: 'Restores 6% HP each turn.' },
  sunbath:     { name: 'Sunbath', kind: 'dayHeal', value: 0.05, desc: 'Restores 5% HP each turn during the day.' },
  nocturnal:   { name: 'Nocturnal', kind: 'nightBoost', value: 1.18, desc: 'Skills are 18% stronger at night.' },
  intimidate:  { name: 'Intimidate', kind: 'onEntry', stat: 'atk', stages: -1, desc: 'Lowers the foe\'s Attack on entry.' },
  static_body: { name: 'Static Body', kind: 'contactStatus', status: 'paralysis', chance: 25, desc: '25% chance to paralyze attackers on contact.' },
  frost_aura:  { name: 'Frost Aura', kind: 'contactStatus', status: 'freeze', chance: 14, desc: '14% chance to freeze attackers on contact.' },
  spore_aura:  { name: 'Spore Aura', kind: 'contactStatus', status: 'poison', chance: 22, desc: '22% chance to poison attackers on contact.' },
  lucky:       { name: 'Lucky', kind: 'critBoost', value: 0.12, desc: 'Critical hits are 12% more likely.' },
  sturdy:      { name: 'Sturdy', kind: 'sturdy', desc: 'Survives a lethal hit at full HP with 1 HP.' },
  soul_guard:  { name: 'Soul Guard', kind: 'elementReduce', element: 'shadow', value: 0.72, desc: 'Takes 28% less Shadow damage.' },
  diurnal:     { name: 'Diurnal', kind: 'dayBoost', value: 1.18, desc: 'Skills are 18% stronger during the day.' },
  predator:    { name: 'Predator', kind: 'finisher', value: 1.18, desc: 'Deals 18% more damage to foes below half HP.' },
  scavenger:   { name: 'Scavenger', kind: 'moneyBoost', value: 1.25, desc: 'Earns 25% more money from battles.' },
  ancient_power:{ name: 'Ancient Power', kind: 'elementBoost', element: 'dragon', value: 1.16, desc: 'Dragon skills are 16% stronger.' },
  radiant:     { name: 'Radiant', kind: 'elementBoost', element: 'light', value: 1.16, desc: 'Light skills are 16% stronger.' },
  storm_charge:{ name: 'Storm Charge', kind: 'elementBoost', element: 'storm', value: 1.16, desc: 'Storm skills are 16% stronger.' },
  earthy:      { name: 'Earthen Core', kind: 'elementBoost', element: 'earth', value: 1.16, desc: 'Earth skills are 16% stronger.' },
  chill:       { name: 'Deep Chill', kind: 'elementBoost', element: 'frost', value: 1.16, desc: 'Frost skills are 16% stronger.' },
  shadow_veil: { name: 'Shadow Veil', kind: 'elementBoost', element: 'shadow', value: 1.16, desc: 'Shadow skills are 16% stronger.' },
  dragon_heart:{ name: 'Dragon Heart', kind: 'statBoost', stat: 'atk', value: 1.12, desc: 'Attack is 12% higher.' },
}

export function getPassive(id) {
  return PASSIVES[id] || PASSIVES.overgrow
}
