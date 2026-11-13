// Skill database. Skills are pure data; the battle engine interprets effects.
// category: physical (atk vs def), special (spa vs spd), status (no damage)

const S = (id, name, element, category, power, accuracy, cost, description, effect = {}) => ({
  id, name, element, category, power, accuracy, cost, description, ...effect,
})

export const SKILLS = {}
function add(...skills) { for (const s of skills) SKILLS[s.id] = s }

add(
  // ── Neutral ──────────────────────────────────────────────────────────────
  S('tackle', 'Tackle', 'none', 'physical', 40, 100, 0, 'A plain full-body charge. Costs nothing.'),
  S('bite', 'Bite', 'none', 'physical', 55, 100, 9, 'A sharp bite that may make the foe flinch.', { crit: 0.08 }),
  S('quick_jab', 'Quick Jab', 'none', 'physical', 35, 100, 6, 'Always strikes first.', { priority: 1 }),
  S('focus_strike', 'Focus Strike', 'none', 'physical', 65, 100, 12, 'A calculated blow with a high critical rate.', { crit: 0.18 }),
  S('body_slam', 'Body Slam', 'none', 'physical', 78, 95, 16, 'A heavy slam that may paralyze.', { status: { id: 'paralysis', chance: 20 } }),
  S('mega_punch', 'Mega Punch', 'none', 'physical', 88, 85, 20, 'A risky, powerful punch.'),
  S('last_resort', 'Last Resort', 'none', 'physical', 125, 90, 30, 'A desperate strike that hurts the user a little.', { recoil: 0.18 }),
  S('recover', 'Recover', 'none', 'status', 0, 100, 15, 'Restores 50% of max HP.', { heal: 0.5, target: 'self' }),
  S('growl', 'Growl', 'none', 'status', 0, 100, 6, 'Lowers the foe\'s Attack.', { stat: { target: 'enemy', stat: 'atk', stages: -1 } }),
  S('leer', 'Leer', 'none', 'status', 0, 100, 6, 'Lowers the foe\'s Defense.', { stat: { target: 'enemy', stat: 'def', stages: -1 } }),
  S('agility', 'Agility', 'none', 'status', 0, 100, 12, 'Sharply raises the user\'s Speed.', { stat: { target: 'self', stat: 'spe', stages: 2 } }),
  S('bulk_up', 'Bulk Up', 'none', 'status', 0, 100, 14, 'Raises Attack and Defense.', { stat: [{ target: 'self', stat: 'atk', stages: 1 }, { target: 'self', stat: 'def', stages: 1 }] }),
  S('iron_guard', 'Iron Guard', 'none', 'status', 0, 100, 12, 'Sharply raises Defense.', { stat: { target: 'self', stat: 'def', stages: 2 } }),
  S('rest', 'Rest', 'none', 'status', 0, 100, 22, 'Fully restores HP but puts the user to sleep.', { heal: 1, selfStatus: 'sleep' }),
  S('life_dew', 'Life Dew', 'none', 'status', 0, 100, 18, 'Sprinkles healing dew on the whole party.', { heal: 0.2, partyHeal: true }),

  // ── Nature ───────────────────────────────────────────────────────────────
  S('vine_whip', 'Vine Whip', 'nature', 'special', 45, 100, 8, 'Lashes the foe with a flexible vine.'),
  S('leaf_blade', 'Leaf Blade', 'nature', 'physical', 72, 100, 14, 'A razor-sharp leaf slash with a high crit rate.', { crit: 0.16 }),
  S('root_snare', 'Root Snare', 'nature', 'status', 0, 95, 10, 'Roots slow the foe and lower Speed.', { stat: { target: 'enemy', stat: 'spe', stages: -1 } }),
  S('leech_seed', 'Leech Seed', 'nature', 'status', 0, 90, 12, 'Plants a seed that drains HP each turn.', { seed: true }),
  S('synthesis', 'Synthesis', 'nature', 'status', 0, 100, 14, 'Bathes in sunlight to restore 50% HP.', { heal: 0.5, target: 'self' }),
  S('spore_cloud', 'Spore Cloud', 'nature', 'status', 0, 80, 15, 'A burst of spores that puts the foe to sleep.', { status: { id: 'sleep', chance: 100 } }),
  S('thorn_burst', 'Thorn Burst', 'nature', 'special', 85, 95, 20, 'Explodes a ring of thorns around the foe.'),
  S('bloom_heal', 'Bloom Heal', 'nature', 'status', 0, 100, 16, 'Restores 35% HP and clears status.', { heal: 0.35, cure: true }),
  S('petal_storm', 'Petal Storm', 'nature', 'special', 100, 88, 26, 'A beautiful, brutal whirl of petals.'),

  // ── Flame ────────────────────────────────────────────────────────────────
  S('ember', 'Ember', 'flame', 'special', 46, 100, 8, 'A small flick of flame that may burn.', { status: { id: 'burn', chance: 15 } }),
  S('flame_fang', 'Flame Fang', 'flame', 'physical', 68, 95, 14, 'Fiery fangs that often burn.', { status: { id: 'burn', chance: 30 } }),
  S('magma_burst', 'Magma Burst', 'flame', 'special', 86, 95, 20, 'Erupts a blast of searing magma.'),
  S('scorch_wave', 'Scorch Wave', 'flame', 'special', 72, 100, 16, 'A wave of heat that may leave a burn.', { status: { id: 'burn', chance: 35 } }),
  S('smolder', 'Smolder', 'flame', 'status', 0, 90, 10, 'A smoldering glare that burns the foe.', { status: { id: 'burn', chance: 100 } }),
  S('inferno', 'Inferno', 'flame', 'special', 108, 85, 28, 'Engulfs the foe in an inferno. Often burns.', { status: { id: 'burn', chance: 50 } }),
  S('fire_spin', 'Fire Spin', 'flame', 'special', 55, 95, 11, 'Traps the foe in a spiral of fire.', { stat: { target: 'enemy', stat: 'spe', stages: -1 } }),

  // ── Frost ────────────────────────────────────────────────────────────────
  S('frost_shard', 'Frost Shard', 'frost', 'special', 46, 100, 8, 'A splinter of ice. May freeze.', { status: { id: 'freeze', chance: 8 } }),
  S('ice_fang', 'Ice Fang', 'frost', 'physical', 68, 95, 14, 'Frozen fangs that may freeze the foe.', { status: { id: 'freeze', chance: 18 } }),
  S('blizzard', 'Blizzard', 'frost', 'special', 96, 85, 25, 'A howling blizzard that may freeze.', { status: { id: 'freeze', chance: 22 } }),
  S('glacier_slam', 'Glacier Slam', 'frost', 'physical', 82, 90, 18, 'Drops a crushing block of ice.'),
  S('chilling_song', 'Chilling Song', 'frost', 'status', 0, 95, 12, 'An eerie song that chills and slows.', { status: { id: 'freeze', chance: 20 }, stat: { target: 'enemy', stat: 'spe', stages: -1 } }),
  S('icicle_spear', 'Icicle Spear', 'frost', 'physical', 70, 100, 16, 'Strikes twice with jagged ice.', { multi: 2 }),
  S('frozen_heart', 'Frozen Heart', 'frost', 'status', 0, 100, 15, 'Calms the spirit, restoring 45% HP.', { heal: 0.45, cure: true }),

  // ── Earth ────────────────────────────────────────────────────────────────
  S('pebble_toss', 'Pebble Toss', 'earth', 'special', 46, 100, 8, 'Hurls a cluster of sharp pebbles.'),
  S('sand_tomb', 'Sand Tomb', 'earth', 'special', 62, 95, 14, 'Traps the foe in sand and lowers Speed.', { stat: { target: 'enemy', stat: 'spe', stages: -1 } }),
  S('crystal_lance', 'Crystal Lance', 'earth', 'special', 82, 95, 19, 'A piercing lance of crystal.'),
  S('earthquake', 'Earthquake', 'earth', 'physical', 92, 95, 23, 'A ground-shaking stomp.'),
  S('stone_skin', 'Stone Skin', 'earth', 'status', 0, 100, 12, 'Hardens the body, sharply raising Defense.', { stat: { target: 'self', stat: 'def', stages: 2 } }),
  S('geo_break', 'Geo Break', 'earth', 'physical', 102, 88, 27, 'Shatters the ground beneath the foe.'),
  S('sandstorm', 'Sandstorm', 'earth', 'status', 0, 100, 13, 'A blinding storm lowers the foe\'s accuracy.', { stat: { target: 'enemy', stat: 'acc', stages: -1 } }),

  // ── Shadow ───────────────────────────────────────────────────────────────
  S('shadow_bolt', 'Shadow Bolt', 'shadow', 'special', 48, 100, 9, 'A dart of living darkness.'),
  S('dark_pulse', 'Dark Pulse', 'shadow', 'special', 82, 95, 19, 'A pulse of nightmare energy.'),
  S('night_shade', 'Night Shade', 'shadow', 'special', 65, 100, 14, 'Strikes with a vision of true darkness.'),
  S('curse', 'Curse', 'shadow', 'status', 0, 100, 10, 'A hex weakens the foe\'s Attack and Sp. Atk.', { stat: [{ target: 'enemy', stat: 'atk', stages: -1 }, { target: 'enemy', stat: 'spa', stages: -1 }] }),
  S('shadow_fang', 'Shadow Fang', 'shadow', 'physical', 70, 100, 15, 'Sinks fangs of shadow into the foe. High crit rate.', { crit: 0.18 }),
  S('drain_essence', 'Drain Essence', 'shadow', 'special', 55, 100, 12, 'Steals life force and heals the user.', { drain: 0.5 }),
  S('nightmare', 'Nightmare', 'shadow', 'special', 92, 90, 22, 'Deals double damage to sleeping foes.', { sleepBonus: 2 }),
  S('toxic_spit', 'Toxic Spit', 'shadow', 'status', 0, 90, 9, 'Spits venom that badly poisons the foe.', { status: { id: 'poison', chance: 100 } }),

  // ── Light ────────────────────────────────────────────────────────────────
  S('spark', 'Spark', 'light', 'special', 46, 100, 8, 'A mote of radiant light.'),
  S('radiant_beam', 'Radiant Beam', 'light', 'special', 82, 95, 19, 'A concentrated beam of sunlight.'),
  S('holy_light', 'Holy Light', 'light', 'status', 0, 100, 14, 'Restores 40% HP and purges status.', { heal: 0.4, cure: true }),
  S('prism_flash', 'Prism Flash', 'light', 'special', 62, 100, 13, 'A dazzling flash that lowers accuracy.', { stat: { target: 'enemy', stat: 'acc', stages: -1 } }),
  S('dawn_blade', 'Dawn Blade', 'light', 'physical', 76, 100, 17, 'A blade formed from the first light of dawn.', { crit: 0.12 }),
  S('lullaby', 'Lullaby', 'light', 'status', 0, 70, 12, 'A gentle song that lulls the foe to sleep.', { status: { id: 'sleep', chance: 100 } }),
  S('solar_flare', 'Solar Flare', 'light', 'special', 102, 88, 26, 'A miniature sun bursts over the foe.'),

  // ── Storm ────────────────────────────────────────────────────────────────
  S('static_jolt', 'Static Jolt', 'storm', 'special', 46, 100, 8, 'A crackling jolt that may paralyze.', { status: { id: 'paralysis', chance: 15 } }),
  S('thunder_fang', 'Thunder Fang', 'storm', 'physical', 70, 95, 15, 'Electric fangs that often paralyze.', { status: { id: 'paralysis', chance: 30 } }),
  S('thunderstorm', 'Thunderstorm', 'storm', 'special', 98, 85, 25, 'Calls down a storm of lightning.'),
  S('wind_slash', 'Wind Slash', 'storm', 'physical', 60, 100, 12, 'A blade of compressed wind.'),
  S('volt_ring', 'Volt Ring', 'storm', 'status', 0, 90, 11, 'A ring of voltage paralyzes the foe.', { status: { id: 'paralysis', chance: 100 } }),
  S('tailwind', 'Tailwind', 'storm', 'status', 0, 100, 12, 'Rides the wind to sharply raise Speed.', { stat: { target: 'self', stat: 'spe', stages: 2 } }),
  S('gale_force', 'Gale Force', 'storm', 'special', 84, 100, 20, 'A focused hurricane. High crit rate.', { crit: 0.15 }),

  // ── Dragon ───────────────────────────────────────────────────────────────
  S('dragon_breath', 'Dragon Breath', 'dragon', 'special', 55, 100, 10, 'A breath of ancient power. May paralyze.', { status: { id: 'paralysis', chance: 15 } }),
  S('claw_slash', 'Claw Slash', 'dragon', 'physical', 66, 100, 13, 'A raking slash from curved claws.'),
  S('dragon_dance', 'Dragon Dance', 'dragon', 'status', 0, 100, 16, 'Raises Attack and Speed.', { stat: [{ target: 'self', stat: 'atk', stages: 1 }, { target: 'self', stat: 'spe', stages: 1 }] }),
  S('wyrm_wave', 'Wyrm Wave', 'dragon', 'special', 90, 95, 22, 'A tidal wave of draconic energy.'),
  S('tail_swipe', 'Tail Swipe', 'dragon', 'physical', 58, 100, 10, 'A sweeping tail that lowers Defense.', { stat: { target: 'enemy', stat: 'def', stages: -1 } }),
  S('ancient_roar', 'Ancient Roar', 'dragon', 'status', 0, 100, 13, 'A terrifying roar weakens the foe.', { stat: [{ target: 'enemy', stat: 'atk', stages: -1 }, { target: 'enemy', stat: 'spa', stages: -1 }] }),
  S('draco_meteor', 'Draco Meteor', 'dragon', 'special', 125, 80, 34, 'Calls down a rain of draconic meteors.'),
)

export const SKILL_LIST = Object.values(SKILLS)

export function getSkill(id) {
  return SKILLS[id] || SKILLS.tackle
}
