// Monster personalities: +10% to one stat, −10% to another (never HP).

export const PERSONALITIES = {
  hardy:   { name: 'Hardy',   plus: null,  minus: null,  desc: 'Steady and balanced. No stat changes.' },
  brave:   { name: 'Brave',   plus: 'atk', minus: 'spe', desc: 'Attack +10%, Speed −10%.' },
  adamant: { name: 'Adamant', plus: 'atk', minus: 'spa', desc: 'Attack +10%, Sp. Atk −10%.' },
  bold:    { name: 'Bold',    plus: 'def', minus: 'atk', desc: 'Defense +10%, Attack −10%.' },
  impish:  { name: 'Impish',  plus: 'def', minus: 'spa', desc: 'Defense +10%, Sp. Atk −10%.' },
  modest:  { name: 'Modest',  plus: 'spa', minus: 'atk', desc: 'Sp. Atk +10%, Attack −10%.' },
  mild:    { name: 'Mild',    plus: 'spa', minus: 'def', desc: 'Sp. Atk +10%, Defense −10%.' },
  calm:    { name: 'Calm',    plus: 'spd', minus: 'atk', desc: 'Sp. Def +10%, Attack −10%.' },
  careful: { name: 'Careful', plus: 'spd', minus: 'spa', desc: 'Sp. Def +10%, Sp. Atk −10%.' },
  timid:   { name: 'Timid',   plus: 'spe', minus: 'atk', desc: 'Speed +10%, Attack −10%.' },
  jolly:   { name: 'Jolly',   plus: 'spe', minus: 'spa', desc: 'Speed +10%, Sp. Atk −10%.' },
  naive:   { name: 'Naive',   plus: 'spe', minus: 'spd', desc: 'Speed +10%, Sp. Def −10%.' },
  sassy:   { name: 'Sassy',   plus: 'spd', minus: 'spe', desc: 'Sp. Def +10%, Speed −10%.' },
  lonely:  { name: 'Lonely',  plus: 'atk', minus: 'def', desc: 'Attack +10%, Defense −10%.' },
}

export const PERSONALITY_IDS = Object.keys(PERSONALITIES)
