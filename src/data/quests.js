// Quest database. Progress is tracked by game/progress.js from gameplay events.

export const QUESTS = {
  q_forest_welcome: {
    id: 'q_forest_welcome', name: "A Sprout's Welcome", giver: 'forest_quest', biome: 'forest',
    desc: 'Mossglow\'s keeper wants to see if you can befriend the forest. Catch two wild monsters from Greenwood.',
    objectives: [{ type: 'catch', count: 2, biome: 'forest', label: 'Catch Greenwood monsters' }],
    rewards: { money: 260, trainerXp: 50, items: [['capture_orb', 5], ['herb', 3]] },
  },
  q_fen_whispers: {
    id: 'q_fen_whispers', name: 'Whispers in the Reeds', giver: 'swamp_quest', biome: 'swamp',
    desc: 'The Fenmarket witches hear a new voice in the water. Catch two Shadow monsters and bring back three Spore Caps.',
    objectives: [
      { type: 'catch', count: 2, element: 'shadow', label: 'Catch Shadow monsters' },
      { type: 'gather', item: 'spore_cap', count: 3, label: 'Gather Spore Caps' },
    ],
    rewards: { money: 520, trainerXp: 110, items: [['silver_orb', 3], ['bond_charm', 1]] },
  },
  q_desert_glass: {
    id: 'q_desert_glass', name: 'Glass and Grit', giver: 'desert_quest', biome: 'desert',
    desc: 'Sunspire\'s glaziers need crystal shards to repair the great mirror. Gather three of them.',
    objectives: [{ type: 'gather', item: 'crystal_shard', count: 3, label: 'Gather Crystal Shards' }],
    rewards: { money: 460, trainerXp: 90, items: [['silver_orb', 3], ['mend_potion', 3]] },
  },
  q_frozen_promise: {
    id: 'q_frozen_promise', name: 'The Frozen Promise', giver: 'frozen_quest', biome: 'frozen',
    desc: 'A Hearthhold child left an offering for the mountain spirits. Catch a Frost monster to prove the peak still listens.',
    objectives: [{ type: 'catch', count: 1, element: 'frost', label: 'Catch a Frost monster' }],
    rewards: { money: 500, trainerXp: 100, items: [['great_mend', 2], ['ice_shard', 4]] },
  },
  q_volcano_forge: {
    id: 'q_volcano_forge', name: 'Embers of the Forge', giver: 'volcano_quest', biome: 'volcano',
    desc: 'The Cinderforge smith needs four Ember Shards and a Silver Orb to rekindle the old forge.',
    objectives: [
      { type: 'gather', item: 'ember_shard', count: 4, label: 'Gather Ember Shards' },
      { type: 'craft', count: 1, label: 'Craft any item' },
    ],
    rewards: { money: 700, trainerXp: 140, items: [['golden_orb', 2], ['ember_heart', 1]] },
  },
  q_ruins_gears: {
    id: 'q_ruins_gears', name: 'The Clockwork Vault', giver: 'ruins_quest', biome: 'ruins',
    desc: 'Archivist Sel believes the vault can be opened with a living key. Defeat her best student and gather two relic fragments.',
    objectives: [
      { type: 'defeat_trainer', count: 1, label: 'Defeat a trainer' },
      { type: 'gather', item: 'relic_fragment', count: 2, label: 'Gather Relic Fragments' },
    ],
    rewards: { money: 900, trainerXp: 180, items: [['chronogear', 1], ['great_mend', 3]] },
  },
  q_dragon_trial: {
    id: 'q_dragon_trial', name: 'The Valley Trial', giver: 'dragon_quest', biome: 'dragon',
    desc: 'Scalehold honors those who face the valley\'s guardian. Defeat the Skybone Aerie boss.',
    objectives: [{ type: 'defeat_boss', biome: 'dragon', count: 1, label: 'Defeat the Dragon Valley guardian' }],
    rewards: { money: 1600, trainerXp: 320, items: [['astral_orb', 3], ['dragon_scale', 1]] },
  },
  q_celestial_vigil: {
    id: 'q_celestial_vigil', name: 'Starlight Vigil', giver: 'celestial_quest', biome: 'celestial',
    desc: 'Reach Celestial Island and catch a Light monster. The Sanctum has been waiting for you.',
    objectives: [
      { type: 'visit', biome: 'celestial', count: 1, label: 'Reach Celestial Island' },
      { type: 'catch', count: 1, element: 'light', label: 'Catch a Light monster' },
    ],
    rewards: { money: 2000, trainerXp: 380, items: [['astral_orb', 2], ['bond_charm', 2]] },
  },
  q_evolution: {
    id: 'q_evolution', name: 'Evolution Adept', giver: 'forest_quest', biome: 'forest',
    desc: 'Every bond changes both partners. Evolve any monster.',
    objectives: [{ type: 'evolve', count: 1, label: 'Evolve a monster' }],
    rewards: { money: 650, trainerXp: 160, items: [['exp_candy', 2], ['great_mend', 2]] },
    requires: 'q_forest_welcome',
  },
  q_breeder: {
    id: 'q_breeder', name: "A Breeder's First Egg", giver: 'ruins_quest', biome: 'ruins',
    desc: 'Visit the nursery at Wayfarer\'s Rest and hatch a monster egg.',
    objectives: [{ type: 'hatch', count: 1, label: 'Hatch an egg' }],
    rewards: { money: 800, trainerXp: 180, items: [['stardust', 3], ['bond_charm', 1]] },
    requires: 'q_ruins_gears',
  },
  q_trainers: {
    id: 'q_trainers', name: "Trainer's Gambit", giver: 'desert_quest', biome: 'desert',
    desc: 'Defeat three NPC trainers anywhere in the world.',
    objectives: [{ type: 'defeat_trainer', count: 3, label: 'Defeat trainers' }],
    rewards: { money: 1200, trainerXp: 260, items: [['golden_orb', 2], ['energy_sip', 3]] },
    requires: 'q_desert_glass',
  },
  q_dex: {
    id: 'q_dex', name: 'Field Researcher', giver: 'ruins_quest', biome: 'ruins',
    desc: 'Record 25 different monsters in the Codex.',
    objectives: [{ type: 'dex', count: 25, label: 'Caught species recorded' }],
    rewards: { money: 1500, trainerXp: 300, items: [['exp_candy', 3], ['astral_orb', 1]] },
  },
  q_guardians: {
    id: 'q_guardians', name: 'The Eight Guardians', giver: 'celestial_quest', biome: 'celestial',
    desc: 'Defeat all eight regional guardians and restore balance to the continent.',
    objectives: [{ type: 'defeat_bosses', count: 8, label: 'Guardians defeated' }],
    rewards: { money: 5000, trainerXp: 800, items: [['astral_orb', 5], ['exp_candy', 5]] },
    requires: 'q_dragon_trial',
  },
}

export const QUEST_LIST = Object.values(QUESTS)

export const ACHIEVEMENTS = {
  first_catch:    { id: 'first_catch', name: 'A New Friend', icon: '◉', desc: 'Catch your first monster.' },
  catcher_10:     { id: 'catcher_10', name: 'Field Collector', icon: '◉', desc: 'Catch 10 monsters.' },
  catcher_30:     { id: 'catcher_30', name: 'Menagerie', icon: '◉', desc: 'Catch 30 monsters.' },
  dex_25:         { id: 'dex_25', name: 'Junior Researcher', icon: '▤', desc: 'Catch 25 different species.' },
  dex_50:         { id: 'dex_50', name: 'Codex Keeper', icon: '▤', desc: 'Catch 50 different species.' },
  dex_87:         { id: 'dex_87', name: 'Living Codex', icon: '▤', desc: 'Complete the entire monster Codex.' },
  first_evo:      { id: 'first_evo', name: 'Metamorphosis', icon: '✦', desc: 'Evolve a monster.' },
  first_egg:      { id: 'first_egg', name: 'New Beginnings', icon: '◈', desc: 'Hatch a monster egg.' },
  first_boss:     { id: 'first_boss', name: 'Giant Slayer', icon: '☠', desc: 'Defeat a regional guardian.' },
  boss_forest:    { id: 'boss_forest', name: 'Grove Warden', icon: '❧', desc: 'Defeat the Elder Grove guardian.' },
  boss_swamp:     { id: 'boss_swamp', name: 'Fenlight', icon: '☾', desc: 'Defeat the Drowned Court guardian.' },
  boss_desert:    { id: 'boss_desert', name: 'Mirrorbreaker', icon: '⬢', desc: 'Defeat the Mirror Dunes guardian.' },
  boss_frozen:    { id: 'boss_frozen', name: 'Peak Walker', icon: '❄', desc: 'Defeat the Silent Cirque guardian.' },
  boss_volcano:   { id: 'boss_volcano', name: 'Forgeheart', icon: '✦', desc: 'Defeat the Caldera Throne guardian.' },
  boss_ruins:     { id: 'boss_ruins', name: 'Timekeeper', icon: '▣', desc: 'Defeat the Clockwork Vault guardian.' },
  boss_dragon:    { id: 'boss_dragon', name: 'Wyrmfriend', icon: '✧', desc: 'Defeat the Skybone Aerie guardian.' },
  boss_celestial: { id: 'boss_celestial', name: 'Star Touched', icon: '☀', desc: 'Defeat the Astral Crown guardian.' },
  all_bosses:     { id: 'all_bosses', name: 'Guardian of All', icon: '♛', desc: 'Defeat all eight regional guardians.' },
  trainer_5:      { id: 'trainer_5', name: 'Rising Star', icon: '★', desc: 'Reach trainer level 5.' },
  trainer_10:     { id: 'trainer_10', name: 'Grand Trainer', icon: '★', desc: 'Reach trainer level 10.' },
  trainer_20:     { id: 'trainer_20', name: 'Living Legend', icon: '♛', desc: 'Reach trainer level 20.' },
  rich:           { id: 'rich', name: 'Deep Pockets', icon: '◈', desc: 'Hold 10,000 gold at once.' },
  crafter:        { id: 'crafter', name: 'Artisan', icon: '⚒', desc: 'Craft 10 items.' },
  quest_5:        { id: 'quest_5', name: 'Helpful Soul', icon: '✎', desc: 'Complete 5 quests.' },
  trainer_10_battles: { id: 'trainer_10_battles', name: 'Duelist', icon: '⚔', desc: 'Win 10 trainer battles.' },
  level_50:       { id: 'level_50', name: 'Peak Potential', icon: '▲', desc: 'Raise a monster to level 50.' },
  mythic:         { id: 'mythic', name: 'Mythmaker', icon: '✧', desc: 'Catch a legendary monster.' },
  all_biomes:     { id: 'all_biomes', name: 'Worldwalker', icon: '⊕', desc: 'Visit all eight biomes.' },
  night_owl:      { id: 'night_owl', name: 'Night Owl', icon: '☾', desc: 'Catch a monster at night.' },
}

export const ACHIEVEMENT_LIST = Object.values(ACHIEVEMENTS)
