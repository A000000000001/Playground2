// ─────────────────────────────────────────────────────────────────────────────
// MONSTER DATABASE — pure data. Gameplay logic lives in src/game/monsters.js.
// 87 original species across 8 biomes + legendaries.
// ─────────────────────────────────────────────────────────────────────────────

const L = (body, size, features = '', accent = '') => ({
  body, size, features: features ? features.split(',').filter(Boolean) : [], accent,
})

// M(id, name, element, biome, rarity, [hp,atk,def,spa,spd,spe], passive, learnset, evolutions, look, desc, extra)
const M = (id, name, element, biome, rarity, base, passive, learnset, evolutions, look, desc, extra = {}) => ({
  id, name, element, biome, rarity, passive, learnset, evolutions, look, desc,
  base: { hp: base[0], atk: base[1], def: base[2], spa: base[3], spd: base[4], spe: base[5] },
  ...extra,
})

const wild = { wild: false }
const legendary = { wild: false, legendary: true }

export const MONSTERS = {}
function add(...m) { m.forEach(x => { MONSTERS[x.id] = x }) }

add(
  // ══ GREENWOOD FOREST ══════════════════════════════════════════════════════
  M('sprigling', 'Sprigling', 'nature', 'forest', 'common',
    [46, 13, 12, 14, 13, 12], 'overgrow',
    [[1, 'tackle'], [1, 'vine_whip'], [7, 'root_snare'], [11, 'leech_seed'], [16, 'synthesis'], [22, 'thorn_burst']],
    [{ type: 'level', level: 16, to: 'mosswarden' }],
    L('quad', 1, 'leaf,ears,tail'), 'A shy forest fawn that grows a fresh leaf each spring. It hums to wake sleeping flowers.'),

  M('mosswarden', 'Mosswarden', 'nature', 'forest', 'uncommon',
    [72, 27, 25, 30, 26, 22], 'overgrow',
    [[1, 'tackle'], [1, 'vine_whip'], [1, 'root_snare'], [16, 'leaf_blade'], [24, 'synthesis'], [30, 'petal_storm']],
    [{ type: 'level', level: 34, to: 'sylvanox' }],
    L('quad', 2, 'leaf,antlers,tail'), 'Ancient groves grow around its antlers. Woodland creatures shelter beneath the mossy canopy.'),

  M('sylvanox', 'Sylvanox', 'nature', 'forest', 'epic',
    [106, 44, 42, 54, 44, 38], 'overgrow',
    [[1, 'leaf_blade'], [1, 'synthesis'], [1, 'spore_cloud'], [34, 'petal_storm'], [40, 'bloom_heal']],
    [], L('quad', 3, 'leaf,antlers,mane,crown'), 'The Forest Sovereign. Its breath turns barren soil into wildflowers and its footsteps leave trails of moss.', wild),

  M('nibblenut', 'Nibblenut', 'nature', 'forest', 'common',
    [52, 15, 16, 10, 12, 14], 'thick_hide',
    [[1, 'tackle'], [1, 'vine_whip'], [8, 'iron_guard'], [13, 'bite'], [19, 'synthesis']],
    [{ type: 'level', level: 18, to: 'shellbark' }],
    L('quad', 1, 'shell,ears'), 'It caches acorns inside its hollow shell and will trade them for head scratches.'),

  M('shellbark', 'Shellbark', 'nature', 'forest', 'uncommon',
    [86, 30, 38, 20, 28, 18], 'armored',
    [[1, 'tackle'], [1, 'leaf_blade'], [1, 'iron_guard'], [20, 'root_snare'], [26, 'body_slam']],
    [], L('quad', 2, 'shell,spikes'), 'A walking fortress of bark. Entire bird families nest in the crevices of its back.'),

  M('fluffinch', 'Fluffinch', 'nature', 'forest', 'common',
    [40, 12, 10, 15, 12, 18], 'lucky',
    [[1, 'tackle'], [1, 'vine_whip'], [6, 'growl'], [10, 'quick_jab'], [15, 'synthesis']],
    [{ type: 'friendship', level: 18, friendship: 70, to: 'songlark' }],
    L('bird', 1, 'crest,wings'), 'Its downy feathers collect morning dew. Fluffinch sings off-key, and the forest loves it anyway.'),

  M('songlark', 'Songlark', 'nature', 'forest', 'rare',
    [68, 24, 20, 36, 27, 34], 'diurnal',
    [[1, 'vine_whip'], [1, 'radiant_beam'], [1, 'quick_jab'], [20, 'lullaby'], [26, 'solar_flare']],
    [], L('bird', 2, 'crest,wings,plume'), 'A dawn singer whose melody mends wilted leaves. Trainers say its friendship is worth more than its strength.'),

  M('glimmerfly', 'Glimmerfly', 'nature', 'forest', 'common',
    [38, 10, 9, 18, 13, 20], 'swift',
    [[1, 'tackle'], [1, 'vine_whip'], [7, 'spark'], [12, 'root_snare'], [18, 'lullaby']],
    [{ type: 'level', level: 22, to: 'lumimoth' }],
    L('bug', 1, 'wings,antenna'), 'A thumb-sized sprite that paints glowing spirals above forest ponds at dusk.'),

  M('lumimoth', 'Lumimoth', 'light', 'forest', 'rare',
    [66, 20, 18, 38, 30, 32], 'nocturnal',
    [[1, 'spark'], [1, 'radiant_beam'], [1, 'lullaby'], [22, 'prism_flash'], [30, 'solar_flare']],
    [], L('bug', 2, 'wings,antenna,orbs'), 'Its wings hold a thousand tiny moons. Lost travelers follow its glow home.', { nocturnal: true }),

  M('bramblet', 'Bramblet', 'nature', 'forest', 'common',
    [48, 17, 14, 11, 10, 13], 'predator',
    [[1, 'tackle'], [1, 'vine_whip'], [8, 'leer'], [12, 'root_snare'], [18, 'leaf_blade']],
    [{ type: 'level', level: 17, to: 'brambleclaw' }],
    L('biped', 1, 'spikes,ears,tail'), 'A prickly little scrapper that picks fights with anything rounder than itself.'),

  M('brambleclaw', 'Brambleclaw', 'nature', 'forest', 'uncommon',
    [78, 33, 24, 18, 20, 26], 'predator',
    [[1, 'vine_whip'], [1, 'leaf_blade'], [1, 'root_snare'], [22, 'bulk_up'], [28, 'petal_storm']],
    [], L('biped', 2, 'spikes,claws,mane,tail'), 'Its thorn-claws can shear stone. It marks territory by carving spirals into old trees.'),

  M('puddlehop', 'Puddlehop', 'nature', 'forest', 'common',
    [44, 12, 12, 15, 14, 16], 'sunbath',
    [[1, 'tackle'], [1, 'vine_whip'], [6, 'life_dew'], [11, 'root_snare'], [17, 'synthesis']],
    [], L('blob', 1, 'fins,eyes'), 'A round pond-dweller that stores rainwater in its belly and offers sips to thirsty friends.', { nocturnal: true }),

  // ══ EMBER VOLCANO ═════════════════════════════════════════════════════════
  M('cindercub', 'Cindercub', 'flame', 'volcano', 'common',
    [48, 15, 12, 14, 12, 13], 'blaze',
    [[1, 'tackle'], [1, 'ember'], [7, 'growl'], [11, 'smolder'], [17, 'flame_fang'], [23, 'scorch_wave']],
    [{ type: 'level', level: 16, to: 'magmaw' }],
    L('quad', 1, 'ears,tail'), 'A soot-furred cub that sneezes sparks. Volcano villagers use it to light their hearths.'),

  M('magmaw', 'Magmaw', 'flame', 'volcano', 'uncommon',
    [74, 30, 24, 32, 25, 23], 'blaze',
    [[1, 'ember'], [1, 'flame_fang'], [16, 'scorch_wave'], [24, 'magma_burst'], [30, 'inferno']],
    [{ type: 'level', level: 36, to: 'volcanix' }],
    L('quad', 2, 'horns,tail,spikes'), 'Its jaw glows like a furnace door. Magmaw swallows stones and spits them back as glass.'),

  M('volcanix', 'Volcanix', 'flame', 'volcano', 'epic',
    [108, 47, 38, 55, 42, 39], 'blaze',
    [[1, 'flame_fang'], [1, 'magma_burst'], [1, 'smolder'], [36, 'inferno'], [42, 'last_resort']],
    [], L('quad', 3, 'horns,wings,spikes,crown'), 'The Caldera King. When it roars, the mountain answers with rivers of fire.', wild),

  M('emberling', 'Emberling', 'flame', 'volcano', 'common',
    [42, 13, 10, 17, 12, 16], 'lucky',
    [[1, 'tackle'], [1, 'ember'], [8, 'quick_jab'], [12, 'smolder'], [18, 'scorch_wave']],
    [{ type: 'level', level: 19, to: 'flarewing' }],
    L('bug', 1, 'wings,antenna'), 'A cinder-moth that dances in updrafts. Its wing dust makes wishes come true — allegedly.'),

  M('flarewing', 'Flarewing', 'flame', 'volcano', 'uncommon',
    [66, 25, 20, 34, 26, 28], 'swift',
    [[1, 'ember'], [1, 'wind_slash'], [1, 'quick_jab'], [22, 'scorch_wave'], [28, 'inferno']],
    [{ type: 'item', item: 'ember_heart', level: 28, to: 'pyroclast' }],
    L('bird', 2, 'wings,crest,tail'), 'It rides heat currents above the caldera, leaving a trail of sparks like falling stars.'),

  M('pyroclast', 'Pyroclast', 'flame', 'volcano', 'epic',
    [100, 42, 34, 53, 40, 44], 'blaze',
    [[1, 'flame_fang'], [1, 'wind_slash'], [1, 'scorch_wave'], [30, 'inferno'], [38, 'last_resort']],
    [], L('bird', 3, 'wings,crest,horns,tail'), 'Born in an eruption, it flies on wings of solidified ash. Where it lands, glass fields bloom.', wild),

  M('ashsnail', 'Ashsnail', 'flame', 'volcano', 'common',
    [58, 14, 22, 12, 16, 8], 'armored',
    [[1, 'tackle'], [1, 'ember'], [8, 'iron_guard'], [14, 'smolder'], [20, 'body_slam']],
    [{ type: 'level', level: 20, to: 'magmaopod' }],
    L('blob', 1, 'shell,eyes'), 'It carries a shell of cooled lava. The mineral rings inside are prized by collectors.'),

  M('magmaopod', 'Magmaopod', 'flame', 'volcano', 'uncommon',
    [88, 26, 42, 24, 32, 14], 'armored',
    [[1, 'ember'], [1, 'body_slam'], [1, 'iron_guard'], [24, 'magma_burst'], [30, 'recover']],
    [], L('blob', 2, 'shell,spikes'), 'A slow, patient furnace. It melts a path through the mountain and leaves obsidian behind.'),

  M('cinderbat', 'Cinderbat', 'flame', 'volcano', 'common',
    [40, 16, 10, 13, 10, 19], 'swift',
    [[1, 'tackle'], [1, 'ember'], [7, 'quick_jab'], [12, 'bite'], [18, 'scorch_wave']],
    [{ type: 'level', level: 21, to: 'scorchwing' }],
    L('bug', 1, 'wings,ears'), 'It roosts in chimney cracks and squeaks in tune with the mountain\'s rumble.'),

  M('scorchwing', 'Scorchwing', 'flame', 'volcano', 'rare',
    [64, 30, 20, 26, 22, 36], 'predator',
    [[1, 'flame_fang'], [1, 'bite'], [1, 'quick_jab'], [22, 'scorch_wave'], [30, 'inferno']],
    [], L('bug', 2, 'wings,horns,tail'), 'Its wingbeats scatter embers that ignite dry brush. Firefighters dread its migration season.'),

  // ══ FROZEN MOUNTAINS ══════════════════════════════════════════════════════
  M('snowpup', 'Snowpup', 'frost', 'frozen', 'common',
    [47, 14, 12, 13, 12, 14], 'thick_hide',
    [[1, 'tackle'], [1, 'frost_shard'], [7, 'growl'], [12, 'ice_fang'], [18, 'chilling_song']],
    [{ type: 'level', level: 16, to: 'frostfang' }],
    L('quad', 1, 'ears,tail'), 'A puffball pup that naps in snowdrifts. Its body heat melts a perfect circle around it.'),

  M('frostfang', 'Frostfang', 'frost', 'frozen', 'uncommon',
    [73, 29, 26, 28, 25, 24], 'thick_hide',
    [[1, 'frost_shard'], [1, 'ice_fang'], [16, 'glacier_slam'], [24, 'blizzard'], [30, 'frozen_heart']],
    [{ type: 'level', level: 36, to: 'glacierex' }],
    L('quad', 2, 'horns,tail,mane'), 'It hunts by scent across whiteout storms. Its breath freezes tracks solid behind it.'),

  M('glacierex', 'Glacierex', 'frost', 'frozen', 'epic',
    [110, 46, 42, 50, 44, 38], 'thick_hide',
    [[1, 'ice_fang'], [1, 'glacier_slam'], [1, 'chilling_song'], [36, 'blizzard'], [42, 'recover']],
    [], L('quad', 3, 'horns,mane,spikes,crown'), 'The Crown of the Peaks. Its heartbeat is the sound of glaciers calving.', wild),

  M('icikle', 'Icikle', 'frost', 'frozen', 'common',
    [50, 12, 18, 16, 14, 10], 'chill',
    [[1, 'tackle'], [1, 'frost_shard'], [8, 'iron_guard'], [13, 'icicle_spear'], [19, 'chilling_song']],
    [{ type: 'level', level: 20, to: 'cryostal' }],
    L('golem', 1, 'spikes,gem'), 'A living icicle that grows a new point every time it is startled. It is startled often.'),

  M('cryostal', 'Cryostal', 'frost', 'frozen', 'uncommon',
    [80, 24, 34, 34, 30, 18], 'chill',
    [[1, 'frost_shard'], [1, 'icicle_spear'], [1, 'iron_guard'], [22, 'blizzard'], [28, 'frozen_heart']],
    [{ type: 'item', item: 'glacier_core', level: 30, to: 'permafrost' }],
    L('golem', 2, 'spikes,gem,orbs'), 'A lattice of blue crystal. Light passing through it reveals memories of ancient winters.'),

  M('permafrost', 'Permafrost', 'frost', 'frozen', 'epic',
    [114, 38, 55, 52, 48, 20], 'sturdy',
    [[1, 'glacier_slam'], [1, 'blizzard'], [1, 'stone_skin'], [34, 'frozen_heart'], [40, 'solar_flare']],
    [], L('golem', 3, 'spikes,gem,crown,orbs'), 'An eternal glacier given will. It has not moved from its valley in nine hundred years — until now.', wild),

  M('frostowl', 'Frostowl', 'frost', 'frozen', 'common',
    [44, 12, 11, 18, 14, 19], 'nocturnal',
    [[1, 'tackle'], [1, 'frost_shard'], [7, 'leer'], [12, 'lullaby'], [18, 'blizzard']],
    [{ type: 'friendship', level: 23, friendship: 60, to: 'blizzure' }],
    L('bird', 1, 'wings,crest'), 'A silent white owl. It memorizes every traveler who crosses the pass, just in case.'),

  M('blizzure', 'Blizzure', 'frost', 'frozen', 'rare',
    [70, 22, 20, 40, 30, 35], 'chill',
    [[1, 'blizzard'], [1, 'lullaby'], [1, 'icicle_spear'], [24, 'chilling_song'], [32, 'solar_flare']],
    [], L('bird', 2, 'wings,crest,plume,orbs'), 'It summons whiteout blizzards when angry. Locals leave offerings of silver fish.'),

  M('snowmole', 'Snowmole', 'frost', 'frozen', 'common',
    [56, 18, 20, 8, 12, 9], 'sturdy',
    [[1, 'tackle'], [1, 'frost_shard'], [8, 'iron_guard'], [14, 'body_slam'], [20, 'glacier_slam']],
    [{ type: 'level', level: 24, to: 'avalarch' }],
    L('blob', 1, 'claws,eyes'), 'It tunnels beneath the snow, leaving perfect serpentine ridges across the slopes.'),

  M('avalarch', 'Avalarch', 'frost', 'frozen', 'uncommon',
    [96, 36, 40, 18, 24, 16], 'sturdy',
    [[1, 'glacier_slam'], [1, 'body_slam'], [1, 'stone_skin'], [26, 'earthquake'], [32, 'recover']],
    [], L('golem', 2, 'claws,spikes'), 'Mountainsides shift when it rolls over in its sleep. It means well.'),

  // ══ CRYSTAL DESERT ════════════════════════════════════════════════════════
  M('sandlet', 'Sandlet', 'earth', 'desert', 'common',
    [46, 14, 14, 11, 11, 15], 'earthy',
    [[1, 'tackle'], [1, 'pebble_toss'], [7, 'sand_tomb'], [12, 'sandstorm'], [18, 'crystal_lance']],
    [{ type: 'level', level: 17, to: 'duneclaw' }],
    L('quad', 1, 'ears,tail'), 'A desert fox made of warm sand. It leaves flower-shaped footprints that vanish by noon.'),

  M('duneclaw', 'Duneclaw', 'earth', 'desert', 'uncommon',
    [72, 29, 26, 20, 22, 28], 'earthy',
    [[1, 'sand_tomb'], [1, 'crystal_lance'], [1, 'leer'], [20, 'earthquake'], [26, 'geo_break']],
    [{ type: 'item', item: 'solar_shard', level: 30, to: 'mirageking' }],
    L('quad', 2, 'horns,claws,tail'), 'It surfs the dunes on polished claws. Merchants hire it to guide caravans through sandstorms.'),

  M('mirageking', 'Mirageking', 'earth', 'desert', 'rare',
    [100, 42, 36, 38, 36, 42], 'lucky',
    [[1, 'earthquake'], [1, 'crystal_lance'], [1, 'sandstorm'], [32, 'geo_break'], [38, 'recover']],
    [], L('quad', 3, 'horns,crown,mane,tail'), 'A trickster sovereign said to be made of heat shimmer. Entire oasis towns have chased it for days.', wild),

  M('crystalisk', 'Crystalisk', 'earth', 'desert', 'common',
    [52, 13, 20, 16, 18, 10], 'earthy',
    [[1, 'tackle'], [1, 'pebble_toss'], [8, 'iron_guard'], [14, 'crystal_lance'], [22, 'stone_skin']],
    [{ type: 'level', level: 26, to: 'prismadon' }],
    L('serpent', 1, 'spikes,gem'), 'A small basking lizard with crystal scales. It can refract sunlight into blinding sigils.'),

  M('prismadon', 'Prismadon', 'earth', 'desert', 'rare',
    [86, 26, 42, 40, 38, 22], 'earthy',
    [[1, 'crystal_lance'], [1, 'glacier_slam'], [1, 'stone_skin'], [26, 'solar_flare'], [34, 'geo_break']],
    [], L('serpent', 2, 'spikes,gem,crown'), 'Its back is a palace of living crystal. Light storms gather above it like curious birds.'),

  M('gembeetle', 'Gembeetle', 'earth', 'desert', 'common',
    [48, 16, 18, 10, 14, 16], 'thick_hide',
    [[1, 'tackle'], [1, 'pebble_toss'], [8, 'iron_guard'], [13, 'bite'], [19, 'crystal_lance']],
    [{ type: 'level', level: 22, to: 'geodehusk' }],
    L('bug', 1, 'shell,antenna'), 'It polishes its gemstone shell with wax from desert flowers. A favorite of young collectors.'),

  M('geodehusk', 'Geodehusk', 'earth', 'desert', 'uncommon',
    [78, 32, 38, 16, 26, 14], 'armored',
    [[1, 'crystal_lance'], [1, 'body_slam'], [1, 'iron_guard'], [24, 'earthquake'], [30, 'recover']],
    [], L('bug', 2, 'shell,spikes,antenna'), 'Crack it open and you will find a miniature galaxy of amethyst. Please do not crack it open.'),

  M('dustjackal', 'Dustjackal', 'earth', 'desert', 'common',
    [43, 15, 11, 12, 10, 20], 'swift',
    [[1, 'tackle'], [1, 'pebble_toss'], [7, 'growl'], [11, 'sandstorm'], [17, 'crystal_lance']],
    [{ type: 'level', level: 19, to: 'dunehowl' }],
    L('quad', 1, 'ears,mane,tail'), 'It races dust devils for fun and always wins. Its howl sounds like wind through glass.'),

  M('dunehowl', 'Dunehowl', 'earth', 'desert', 'rare',
    [68, 30, 22, 22, 20, 40], 'predator',
    [[1, 'sand_tomb'], [1, 'crystal_lance'], [1, 'agility'], [21, 'earthquake'], [28, 'geo_break']],
    [], L('quad', 2, 'horns,mane,tail'), 'The desert\'s dusk hunter. Its cry bends the dunes into new shapes overnight.'),

  // ══ SHADOW SWAMP ══════════════════════════════════════════════════════════
  M('mudsprout', 'Mudsprout', 'shadow', 'swamp', 'common',
    [50, 14, 16, 15, 13, 9], 'regenerator',
    [[1, 'tackle'], [1, 'night_shade'], [8, 'toxic_spit'], [13, 'leech_seed'], [19, 'drain_essence']],
    [{ type: 'level', level: 18, to: 'bogmaw' }],
    L('blob', 1, 'leaf,eyes'), 'A cheerful sprout rooted in swamp muck. It giggles when it absorbs bad dreams.'),

  M('bogmaw', 'Bogmaw', 'shadow', 'swamp', 'uncommon',
    [80, 31, 30, 27, 26, 16], 'regenerator',
    [[1, 'night_shade'], [1, 'toxic_spit'], [1, 'leech_seed'], [20, 'dark_pulse'], [26, 'drain_essence']],
    [{ type: 'level', level: 36, to: 'grimroot' }],
    L('blob', 2, 'leaf,horns,maw'), 'A walking bog with a mouth like a bear trap. Its belch smells of lost memories.'),

  M('grimroot', 'Grimroot', 'shadow', 'swamp', 'epic',
    [110, 46, 44, 48, 44, 22], 'regenerator',
    [[1, 'dark_pulse'], [1, 'toxic_spit'], [1, 'drain_essence'], [36, 'nightmare'], [42, 'leech_seed']],
    [], L('blob', 3, 'leaf,horns,maw,crown'), 'The Old Hunger of the marsh. Every sunken thing in the swamp dreams its name.', wild),

  M('shadeling', 'Shadeling', 'shadow', 'swamp', 'common',
    [42, 15, 10, 17, 12, 19], 'shadow_veil',
    [[1, 'tackle'], [1, 'shadow_bolt'], [7, 'leer'], [12, 'curse'], [18, 'shadow_fang']],
    [{ type: 'level', level: 21, to: 'umbrafang' }],
    L('spirit', 1, 'ears,tail'), 'A scrap of living shadow that hides under beds and in coat pockets. Mostly harmless. Mostly.'),

  M('umbrafang', 'Umbrafang', 'shadow', 'swamp', 'uncommon',
    [68, 34, 20, 28, 22, 34], 'shadow_veil',
    [[1, 'shadow_bolt'], [1, 'shadow_fang'], [1, 'curse'], [23, 'dark_pulse'], [29, 'drain_essence']],
    [{ type: 'location', biome: 'swamp', level: 38, to: 'nightterror' }],
    L('quad', 2, 'horns,mane,tail'), 'It hunts by stealing reflections. Ponds in its territory show no faces at all.'),

  M('nightterror', 'Nightterror', 'shadow', 'swamp', 'epic',
    [100, 54, 34, 46, 36, 50], 'predator',
    [[1, 'dark_pulse'], [1, 'shadow_fang'], [1, 'nightmare'], [38, 'drain_essence'], [44, 'last_resort']],
    [], L('quad', 3, 'horns,mane,wings,crown'), 'A dusk-crowned predator that stalks the line between waking and sleeping. Do not yawn.', wild),

  M('wispling', 'Wispling', 'shadow', 'swamp', 'common',
    [40, 10, 10, 20, 16, 18], 'mystic',
    [[1, 'tackle'], [1, 'shadow_bolt'], [8, 'growl'], [13, 'night_shade'], [18, 'lullaby']],
    [{ type: 'level', level: 20, to: 'marshwisp' }],
    L('spirit', 1, 'orbs,eyes'), 'A drifting marsh light with a shy face. It guides polite travelers and leads rude ones in circles.'),

  M('marshwisp', 'Marshwisp', 'shadow', 'swamp', 'uncommon',
    [64, 18, 18, 38, 30, 30], 'soul_guard',
    [[1, 'night_shade'], [1, 'curse'], [1, 'lullaby'], [22, 'dark_pulse'], [28, 'drain_essence']],
    [{ type: 'friendship', level: 30, friendship: 85, to: 'soulfen' }],
    L('spirit', 2, 'orbs,eyes,plume'), 'It collects the last warm memories of drowned lanterns and carries them like tiny suns.'),

  M('soulfen', 'Soulfen', 'shadow', 'swamp', 'rare',
    [92, 26, 28, 54, 44, 36], 'soul_guard',
    [[1, 'dark_pulse'], [1, 'nightmare'], [1, 'holy_light'], [30, 'drain_essence'], [36, 'solar_flare']],
    [], L('spirit', 3, 'orbs,eyes,plume,crown'), 'A kindly spirit of the deep fen. It ferries lost souls to the far shore and asks nothing in return.'),

  M('fungelet', 'Fungelet', 'shadow', 'swamp', 'common',
    [54, 12, 16, 16, 14, 8], 'spore_aura',
    [[1, 'tackle'], [1, 'night_shade'], [8, 'toxic_spit'], [14, 'spore_cloud'], [20, 'drain_essence']],
    [{ type: 'level', level: 23, to: 'sporelord' }],
    L('blob', 1, 'spots,eyes'), 'A wobbly mushroom child. Its spores cause vivid dreams of being a slightly larger mushroom.'),

  M('sporelord', 'Sporelord', 'shadow', 'swamp', 'uncommon',
    [86, 24, 34, 36, 28, 12], 'spore_aura',
    [[1, 'night_shade'], [1, 'spore_cloud'], [1, 'toxic_spit'], [24, 'dark_pulse'], [30, 'recover']],
    [], L('blob', 2, 'spots,horns,crown'), 'It rules a silent kingdom of mushrooms. Its decree is simple: decompose beautifully.'),

  // ══ ANCIENT RUINS ═════════════════════════════════════════════════════════
  M('runelet', 'Runelet', 'earth', 'ruins', 'common',
    [46, 12, 16, 18, 16, 12], 'mystic',
    [[1, 'tackle'], [1, 'pebble_toss'], [8, 'iron_guard'], [13, 'prism_flash'], [19, 'crystal_lance']],
    [{ type: 'level', level: 19, to: 'glyphbeast' }],
    L('golem', 1, 'gem,eyes'), 'A stone tablet that got bored. It rearranges its own runes to make silly faces.'),

  M('glyphbeast', 'Glyphbeast', 'light', 'ruins', 'uncommon',
    [74, 24, 32, 38, 30, 20], 'mystic',
    [[1, 'spark'], [1, 'prism_flash'], [1, 'crystal_lance'], [21, 'radiant_beam'], [28, 'holy_light']],
    [{ type: 'location', biome: 'ruins', level: 35, to: 'arcanolith' }],
    L('golem', 2, 'gem,orbs,eyes'), 'Ancient glyphs crawl across its surface, rewriting themselves into prophecies as it walks.'),

  M('arcanolith', 'Arcanolith', 'light', 'ruins', 'epic',
    [104, 36, 48, 58, 48, 24], 'mystic',
    [[1, 'radiant_beam'], [1, 'prism_flash'], [1, 'holy_light'], [35, 'solar_flare'], [42, 'recover']],
    [], L('golem', 3, 'gem,orbs,crown,eyes'), 'The living keystone of the Elder Ruins. Its light remembers a city that no longer exists.', wild),

  M('cogpup', 'Cogpup', 'earth', 'ruins', 'common',
    [48, 16, 18, 8, 12, 13], 'sturdy',
    [[1, 'tackle'], [1, 'pebble_toss'], [8, 'iron_guard'], [13, 'bite'], [19, 'body_slam']],
    [{ type: 'level', level: 20, to: 'gearhound' }],
    L('quad', 1, 'ears,gear'), 'A clockwork puppy of unknown origin. It retrieves lost bolts and buries them for later.'),

  M('gearhound', 'Gearhound', 'earth', 'ruins', 'uncommon',
    [76, 34, 34, 16, 22, 24], 'armored',
    [[1, 'pebble_toss'], [1, 'body_slam'], [1, 'iron_guard'], [22, 'earthquake'], [28, 'last_resort']],
    [{ type: 'item', item: 'chronogear', level: 32, to: 'chronohound' }],
    L('quad', 2, 'ears,gear,claws'), 'Rust never touches its gears. It guards a mechanism whose purpose even it has forgotten.'),

  M('chronohound', 'Chronohound', 'earth', 'ruins', 'epic',
    [102, 46, 42, 40, 36, 38], 'swift',
    [[1, 'earthquake'], [1, 'crystal_lance'], [1, 'agility'], [34, 'geo_break'], [40, 'recover']],
    [], L('quad', 3, 'horns,gear,claws,crown'), 'A guardian of broken time. It arrives at disasters eleven minutes before they happen.', wild),

  M('dustmoth', 'Dustmoth', 'light', 'ruins', 'common',
    [40, 10, 9, 19, 15, 21], 'swift',
    [[1, 'tackle'], [1, 'spark'], [7, 'growl'], [13, 'prism_flash'], [20, 'lullaby']],
    [{ type: 'level', level: 22, to: 'oraclewing' }],
    L('bug', 1, 'wings,antenna'), 'It feeds on old parchment. Historians fear it; poets follow it for inspiration.'),

  M('oraclewing', 'Oraclewing', 'light', 'ruins', 'rare',
    [66, 18, 18, 42, 34, 36], 'radiant',
    [[1, 'radiant_beam'], [1, 'prism_flash'], [1, 'lullaby'], [24, 'solar_flare'], [32, 'holy_light']],
    [], L('bug', 2, 'wings,antenna,orbs,crown'), 'Its wing patterns rearrange into fragments of the future. Most of them are about lunch.'),

  M('relicrawl', 'Relicrawl', 'earth', 'ruins', 'common',
    [50, 15, 22, 12, 16, 7], 'armored',
    [[1, 'tackle'], [1, 'pebble_toss'], [8, 'iron_guard'], [14, 'sand_tomb'], [21, 'earthquake']],
    [{ type: 'level', level: 25, to: 'tombwarden' }],
    L('bug', 1, 'shell,spikes'), 'It nests in cracked urns. Its shell is a mosaic of a civilization\'s broken crockery.'),

  M('tombwarden', 'Tombwarden', 'earth', 'ruins', 'uncommon',
    [84, 30, 40, 26, 30, 12], 'sturdy',
    [[1, 'rock', 'stone'], [1, 'earthquake'], [1, 'stone_skin'], [27, 'crystal_lance'], [34, 'recover']],
    [], L('golem', 2, 'spikes,gem,mask'), 'A silent keeper of the tombs. It has counted every grain of dust in the ruins. Twice.'),

  // ══ DRAGON VALLEY ═════════════════════════════════════════════════════════
  M('wyrmlet', 'Wyrmlet', 'dragon', 'dragon', 'common',
    [50, 16, 14, 14, 13, 12], 'dragon_heart',
    [[1, 'tackle'], [1, 'dragon_breath'], [8, 'growl'], [13, 'claw_slash'], [19, 'dragon_dance']],
    [{ type: 'level', level: 18, to: 'drakeon' }],
    L('serpent', 1, 'horns,tail'), 'A tiny wyrm with big opinions. It hoards bottle caps and guards them ferociously.'),

  M('drakeon', 'Drakeon', 'dragon', 'dragon', 'uncommon',
    [78, 34, 28, 30, 26, 26], 'dragon_heart',
    [[1, 'dragon_breath'], [1, 'claw_slash'], [1, 'dragon_dance'], [20, 'wyrm_wave'], [28, 'ancient_roar']],
    [{ type: 'level', level: 38, to: 'dracolord' }],
    L('dragon', 2, 'horns,wings,tail'), 'A young valley drake. It practices roaring at cliffs and is embarrassed when they echo back.'),

  M('dracolord', 'Dracolord', 'dragon', 'dragon', 'epic',
    [114, 56, 46, 50, 42, 40], 'dragon_heart',
    [[1, 'wyrm_wave'], [1, 'claw_slash'], [1, 'dragon_dance'], [38, 'draco_meteor'], [44, 'last_resort']],
    [], L('dragon', 3, 'horns,wings,spikes,crown,tail'), 'Sovereign of Dragon Valley. Its shadow is said to be the reason the valley has two sunsets.', wild),

  M('raptalon', 'Raptalon', 'dragon', 'dragon', 'common',
    [48, 18, 12, 10, 10, 20], 'predator',
    [[1, 'tackle'], [1, 'claw_slash'], [7, 'quick_jab'], [12, 'tail_swipe'], [18, 'dragon_breath']],
    [{ type: 'level', level: 21, to: 'scytheraptor' }],
    L('bird', 1, 'claws,crest,tail'), 'A feathered raptor that runs in packs. It can outpace a horse for exactly forty meters.'),

  M('scytheraptor', 'Scytheraptor', 'dragon', 'dragon', 'rare',
    [74, 42, 24, 20, 20, 42], 'predator',
    [[1, 'claw_slash'], [1, 'wind_slash'], [1, 'agility'], [23, 'dragon_dance'], [30, 'last_resort']],
    [], L('bird', 2, 'claws,crest,mane,tail'), 'Its wing-claws can split a boulder. It sharpens them on the valley\'s ancient standing stones.'),

  M('dracoil', 'Dracoil', 'dragon', 'dragon', 'rare',
    [60, 20, 18, 24, 20, 18], 'ancient_power',
    [[1, 'dragon_breath'], [1, 'bite'], [1, 'coil'], [16, 'wyrm_wave'], [24, 'dragon_dance']],
    [{ type: 'item', item: 'dragon_scale', level: 30, to: 'hydrarch' }, { type: 'level', level: 40, to: 'dracolord' }],
    L('serpent', 2, 'horns,fins,tail'), 'A river serpent with a dragon\'s ambition. It practices flying by throwing itself off small waterfalls.'),

  M('hydrarch', 'Hydrarch', 'dragon', 'dragon', 'epic',
    [106, 50, 40, 50, 42, 34], 'ancient_power',
    [[1, 'wyrm_wave'], [1, 'dragon_dance'], [1, 'drain_essence'], [34, 'draco_meteor'], [40, 'recover']],
    [], L('serpent', 3, 'horns,fins,crown,tail'), 'A three-minded hydra of the deep valley river. Each head argues about which one is in charge.', wild),

  M('bonewyrm', 'Bonewyrm', 'shadow', 'dragon', 'rare',
    [88, 44, 36, 38, 30, 30], 'soul_guard',
    [[1, 'shadow_fang'], [1, 'claw_slash'], [1, 'curse'], [26, 'dark_pulse'], [34, 'nightmare']],
    [], L('serpent', 2, 'bones,horns,tail'), 'The skeleton of a dragon that refused to stop being one. It guards the valley\'s deepest ossuary.'),

  // ══ CELESTIAL ISLAND ══════════════════════════════════════════════════════
  M('starfawn', 'Starfawn', 'light', 'celestial', 'common',
    [44, 12, 12, 18, 16, 18], 'radiant',
    [[1, 'tackle'], [1, 'spark'], [8, 'growl'], [13, 'prism_flash'], [19, 'lullaby']],
    [{ type: 'level', level: 20, to: 'astralynx' }, { type: 'friendship', level: 20, friendship: 75, to: 'celestag' }],
    L('quad', 1, 'antlers,tail'), 'A fawn born from a fallen star. Its antlers chime softly when the moon rises.'),

  M('astralynx', 'Astralynx', 'light', 'celestial', 'uncommon',
    [72, 24, 22, 36, 30, 32], 'radiant',
    [[1, 'spark'], [1, 'radiant_beam'], [1, 'lullaby'], [22, 'prism_flash'], [30, 'solar_flare']],
    [{ type: 'friendship', level: 32, friendship: 90, to: 'celestag' }],
    L('quad', 2, 'antlers,mane,tail,orbs'), 'It walks between moonbeams and leaves constellations in its pawprints.'),

  M('celestag', 'Celestag', 'light', 'celestial', 'epic',
    [106, 36, 40, 56, 48, 40], 'radiant',
    [[1, 'solar_flare'], [1, 'radiant_beam'], [1, 'holy_light'], [32, 'solar_flare'], [40, 'draco_meteor']],
    [], L('quad', 3, 'antlers,crown,orbs,tail'), 'The celestial hart. It carries a small, patient galaxy between its antlers.', wild),

  M('cloudjelly', 'Cloudjelly', 'light', 'celestial', 'common',
    [56, 10, 20, 20, 22, 8], 'regenerator',
    [[1, 'tackle'], [1, 'spark'], [8, 'life_dew'], [14, 'prism_flash'], [21, 'recover']],
    [{ type: 'level', level: 22, to: 'nimbusaur' }],
    L('blob', 1, 'cloud,eyes'), 'A jellyfish of condensed cloud. It rains gently when it is sad and snows when it is surprised.'),

  M('nimbusaur', 'Nimbusaur', 'light', 'celestial', 'rare',
    [90, 20, 34, 42, 40, 20], 'sunbath',
    [[1, 'radiant_beam'], [1, 'life_dew'], [1, 'recover'], [24, 'thunderstorm'], [32, 'solar_flare']],
    [], L('blob', 2, 'cloud,horns,crown'), 'A floating cloud-leviathan. Whole flocks of birds make their nests in its gentle folds.'),

  M('cometpup', 'Cometpup', 'light', 'celestial', 'common',
    [46, 14, 11, 17, 13, 21], 'lucky',
    [[1, 'tackle'], [1, 'spark'], [7, 'quick_jab'], [12, 'tailwind'], [19, 'prism_flash']],
    [{ type: 'level', level: 21, to: 'nebulynx' }],
    L('quad', 1, 'ears,tail,orbs'), 'A puppy with a comet for a tail. It chases shooting stars and sometimes catches them.'),

  M('nebulynx', 'Nebulynx', 'light', 'celestial', 'rare',
    [72, 26, 20, 38, 28, 38], 'swift',
    [[1, 'radiant_beam'], [1, 'tailwind'], [1, 'quick_jab'], [23, 'solar_flare'], [30, 'prism_flash']],
    [], L('quad', 2, 'ears,mane,tail,orbs'), 'Its fur holds a nebula in miniature. Stargazers say it purrs in the key of distant planets.'),

  M('galekit', 'Galekit', 'storm', 'celestial', 'common',
    [44, 13, 12, 17, 14, 20], 'storm_charge',
    [[1, 'tackle'], [1, 'static_jolt'], [8, 'growl'], [13, 'wind_slash'], [19, 'volt_ring']],
    [{ type: 'level', level: 23, to: 'tempestrine' }],
    L('quad', 1, 'ears,tuft,tail'), 'A kitten woven from a summer breeze. It sneezes tiny thunderstorms when nervous.'),

  M('tempestrine', 'Tempestrine', 'storm', 'celestial', 'rare',
    [78, 26, 22, 40, 30, 36], 'storm_charge',
    [[1, 'thunder_fang'], [1, 'gale_force'], [1, 'tailwind'], [25, 'thunderstorm'], [32, 'volt_ring']],
    [], L('quad', 2, 'horns,mane,tail,orbs'), 'A storm made elegant. Its tail leaves a trail of ionized starlight.'),

  // ══ LEGENDARIES ═══════════════════════════════════════════════════════════
  M('verdantus', 'Verdantus', 'nature', 'forest', 'legendary',
    [115, 62, 60, 80, 66, 58], 'overgrow',
    [[1, 'petal_storm'], [1, 'synthesis'], [1, 'spore_cloud'], [50, 'bloom_heal'], [58, 'solar_flare']],
    [], L('quad', 3, 'antlers,mane,crown,leaf'), 'The World Root. Every forest on the continent is a dream it is having.', { ...legendary, catchRate: 0.05 }),

  M('pyraxis', 'Pyraxis', 'flame', 'volcano', 'legendary',
    [112, 78, 52, 82, 58, 64], 'blaze',
    [[1, 'inferno'], [1, 'magma_burst'], [1, 'smolder'], [52, 'last_resort'], [60, 'solar_flare']],
    [], L('dragon', 3, 'horns,wings,spikes,crown'), 'The First Flame. It has burned since before the mountains had names.', { ...legendary, catchRate: 0.05 }),

  M('glacia', 'Glacia', 'frost', 'frozen', 'legendary',
    [120, 58, 70, 76, 68, 42], 'sturdy',
    [[1, 'blizzard'], [1, 'glacier_slam'], [1, 'frozen_heart'], [52, 'recover'], [60, 'draco_meteor']],
    [], L('serpent', 3, 'horns,crown,gem'), 'The Sleeping Winter. A single opening of her eye is recorded as the coldest day in history.', { ...legendary, catchRate: 0.05 }),

  M('terravore', 'Terravore', 'earth', 'desert', 'legendary',
    [128, 70, 74, 55, 60, 36], 'earthy',
    [[1, 'geo_break'], [1, 'earthquake'], [1, 'stone_skin'], [52, 'crystal_lance'], [60, 'recover']],
    [], L('golem', 3, 'spikes,gem,crown,mask'), 'The Devourer of Dunes. It eats mountains and excretes crystal ranges.', { ...legendary, catchRate: 0.05 }),

  M('umbraxis', 'Umbraxis', 'shadow', 'swamp', 'legendary',
    [108, 64, 50, 88, 58, 70], 'shadow_veil',
    [[1, 'nightmare'], [1, 'dark_pulse'], [1, 'curse'], [52, 'drain_essence'], [60, 'last_resort']],
    [], L('spirit', 3, 'horns,wings,orbs,crown'), 'The Hollow King. He rules the space between two thoughts and is very lonely.', { ...legendary, catchRate: 0.05 }),

  M('stormquill', 'Stormquill', 'storm', 'celestial', 'legendary',
    [110, 58, 52, 84, 58, 78], 'storm_charge',
    [[1, 'thunderstorm'], [1, 'gale_force'], [1, 'tailwind'], [52, 'volt_ring'], [60, 'solar_flare']],
    [], L('bird', 3, 'wings,spikes,crest,plume'), 'The Thunderbird. Each feather is a lightning bolt waiting for an excuse.', { ...legendary, catchRate: 0.05 }),

  M('ouroboros', 'Ouroboros', 'dragon', 'dragon', 'legendary',
    [125, 82, 64, 78, 62, 60], 'ancient_power',
    [[1, 'draco_meteor'], [1, 'wyrm_wave'], [1, 'dragon_dance'], [54, 'last_resort'], [62, 'recover']],
    [], L('serpent', 3, 'horns,wings,crown,orbs'), 'The Endless Wyrm. It eats its own tail to remember the beginning of the world.', { ...legendary, catchRate: 0.04 }),

  M('aurorix', 'Aurorix', 'light', 'celestial', 'legendary',
    [118, 60, 58, 90, 66, 72], 'radiant',
    [[1, 'solar_flare'], [1, 'radiant_beam'], [1, 'holy_light'], [54, 'prism_flash'], [62, 'draco_meteor']],
    [], L('bird', 3, 'wings,crest,crown,plume'), 'The Aurora Sovereign. Its wings paint the night sky with colors that have no names.', { ...legendary, catchRate: 0.04 }),
)

// Fix a data typo in tombwarden's learnset defensively (unknown skill ids fall back).
MONSTERS.tombwarden.learnset = [[1, 'iron_guard'], [1, 'earthquake'], [1, 'stone_skin'], [27, 'crystal_lance'], [34, 'recover']]
MONSTERS.dracoil.learnset = [[1, 'dragon_breath'], [1, 'bite'], [1, 'tail_swipe'], [16, 'wyrm_wave'], [24, 'dragon_dance']]

export const MONSTER_LIST = Object.values(MONSTERS)
export const STARTERS = ['sprigling', 'cindercub', 'snowpup']
export const LEGENDARIES = MONSTER_LIST.filter(m => m.legendary)

export function getMonster(id) {
  return MONSTERS[id] || MONSTERS.sprigling
}

// Evolution helpers ---------------------------------------------------------
export function evolutionOptions(monster, biome = null) {
  const species = getMonster(monster.speciesId)
  if (!species.evolutions) return []
  return species.evolutions.filter(evo => {
    switch (evo.type) {
      case 'level': return monster.level >= evo.level
      case 'item': return monster.level >= (evo.level || 1)
      case 'friendship': return monster.level >= (evo.level || 1) && monster.friendship >= (evo.friendship || 70)
      case 'location': return monster.level >= (evo.level || 1) && (!biome || biome === evo.biome)
      default: return false
    }
  })
}

export function baseSpeciesId(speciesId) {
  // Walk backwards to the first evolution stage (used by breeding).
  let current = getMonster(speciesId)
  let guard = 0
  while (guard++ < 10) {
    const parent = MONSTER_LIST.find(m => m.evolutions.some(e => e.to === current.id))
    if (!parent) return current.id
    current = parent
  }
  return current.id
}
