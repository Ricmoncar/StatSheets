const TRAITS = {
  // ============ COMMON (gray) ============
  favored: {
    name: 'Favored', rarity: 'common',
    desc: '+15% Crit Chance',
    passive: [{ stat: 'crit_rate', op: 'add', value: 15 }],
  },

  spicy: {
    name: 'Spicy', rarity: 'common',
    desc: '+10% Resilience',
    passive: [{ stat: 'resilience', op: 'add', value: 10 }],
  },

  sonic: {
    name: 'Sonic', rarity: 'common',
    desc: '+10% SPD, +5% Dexterity',
    passive: [{ stat: 'spd', op: 'pct', value: 10 }, { stat: 'dexterity', op: 'add', value: 5 }],
  },

  flaming: {
    name: 'Flaming', rarity: 'common',
    desc: '50% chance to apply BURNING on hit.',
    passive: [],
    notes: 'Status effect. No direct stat impact.',
  },

  enchanted: {
    name: 'Enchanted', rarity: 'common',
    desc: '+10% MAG, +5% Heal Power',
    passive: [{ stat: 'mag', op: 'pct', value: 10 }, { stat: 'heal_pow', op: 'add', value: 5 }],
  },

  steadfast: {
    name: 'Steadfast', rarity: 'common',
    desc: '+15% True Damage. Deal extra damage if enemy is blocking.',
    passive: [{ stat: 'true_dmg', op: 'add', value: 15 }],
    situational: [{ id: 'block', label: 'Enemy is BLOCKING', desc: 'Bonus damage vs blocking targets.', passive: [] }],
  },

  bombastic: {
    name: 'Bombastic', rarity: 'common',
    desc: 'Explosions caused by user are x2 bigger.',
    passive: [],
    notes: 'Cosmetic / scaling. No direct stat impact.',
  },

  counterfeit: {
    name: 'Counterfeit', rarity: 'common',
    desc: 'Shops are 10% cheaper.',
    passive: [],
    notes: 'Economy effect. No combat stat impact.',
  },

  sticky: {
    name: 'Sticky', rarity: 'common',
    desc: 'your fingers are sticky :)',
    passive: [],
    notes: 'Flavor trait.',
  },

  tough: {
    name: 'Tough', rarity: 'common',
    desc: '+10% DEF',
    passive: [{ stat: 'def', op: 'pct', value: 10 }],
  },

  hearty: {
    name: 'Hearty', rarity: 'common',
    desc: '+16% HP',
    passive: [{ stat: 'hp', op: 'pct', value: 16 }],
  },

  keen: {
    name: 'Keen', rarity: 'common',
    desc: '+10% ATK, +3% Crit Chance',
    passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'crit_rate', op: 'add', value: 3 }],
  },

  scholarly: {
    name: 'Scholarly', rarity: 'common',
    desc: '+5% MAG, +15% Cooldown Reduction',
    passive: [{ stat: 'mag', op: 'pct', value: 5 }, { stat: 'cooldown_red', op: 'add', value: 15 }],
  },

  lightfooted: {
    name: 'Light-Footed', rarity: 'common',
    desc: '+16% SPD',
    passive: [{ stat: 'spd', op: 'pct', value: 16 }],
  },

  regenerative: {
    name: 'Regenerative', rarity: 'common',
    desc: '+20% Heal Power, +3% HP',
    passive: [{ stat: 'heal_pow', op: 'add', value: 20 }, { stat: 'hp', op: 'pct', value: 3 }],
  },

  reckless: {
    name: 'Reckless', rarity: 'common',
    desc: '+20% ATK, -10% DEF',
    passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'def', op: 'pct', value: -10 }],
  },

  ironclad: {
    name: 'Ironclad', rarity: 'common',
    desc: '+20% DEF, -15% SPD',
    passive: [{ stat: 'def', op: 'pct', value: 20 }, { stat: 'spd', op: 'pct', value: -15 }],
  },

  precise: {
    name: 'Precise', rarity: 'common',
    desc: '+8% Crit Chance, -5% Crit Damage',
    passive: [{ stat: 'crit_rate', op: 'add', value: 8 }, { stat: 'crit_dmg', op: 'add', value: -5 }],
  },

  glassjaw: {
    name: 'Glass Jaw', rarity: 'common',
    desc: '+8% ATK, -5% Resilience',
    passive: [{ stat: 'atk', op: 'pct', value: 8 }, { stat: 'resilience', op: 'add', value: -5 }],
  },

  shocking: {
    name: 'Shocking', rarity: 'common',
    desc: 'Chance to SHOCK/STUN enemies on hit.',
    passive: [],
    notes: 'Status effect. No direct stat impact.',
  },

  wellfed: {
    name: 'Well-Fed', rarity: 'common',
    desc: '+5% HP, +3% Lifesteal',
    passive: [{ stat: 'hp', op: 'pct', value: 5 }, { stat: 'lifesteal', op: 'add', value: 3 }],
  },

  caffeinated: {
    name: 'Caffeinated', rarity: 'common',
    desc: '+5% SPD, +5% Cooldown Reduction',
    passive: [{ stat: 'spd', op: 'pct', value: 5 }, { stat: 'cooldown_red', op: 'add', value: 5 }],
  },

  stubborn: {
    name: 'Stubborn', rarity: 'common',
    desc: 'Extremely resistant to crowd control and intimidation.',
    passive: [],
    notes: 'Flavor trait.',
  },

  nightowl: {
    name: 'Night Owl', rarity: 'common',
    desc: '+5% ATK, +5% SPD in the dark or at night.',
    passive: [],
    situational: [{ id: 'nightowl-dark', label: 'It is dark / nighttime', passive: [{ stat: 'atk', op: 'pct', value: 5 }, { stat: 'spd', op: 'pct', value: 5 }] }],
  },

  headstrong: {
    name: 'Headstrong', rarity: 'common',
    desc: '+8% Status Resistance',
    passive: [{ stat: 'status_res', op: 'add', value: 8 }],
  },

  resolute: {
    name: 'Resolute', rarity: 'common',
    desc: '+5% Resilience. At ≤30% HP, gain +5% ATK.',
    passive: [{ stat: 'resilience', op: 'add', value: 5 }],
    situational: [{ id: 'res-low', label: 'Currently at ≤30% HP', passive: [{ stat: 'atk', op: 'pct', value: 5 }] }],
  },

  grounded: {
    name: 'Grounded', rarity: 'common',
    desc: '+5% DEF. Immune to knockback effects.',
    passive: [{ stat: 'def', op: 'pct', value: 5 }],
    notes: 'Knockback immunity is flavor. +5% DEF is the stat impact.',
  },

  // ============ RARE (blue) ============
  assassin: {
    name: 'Assassin', rarity: 'rare',
    desc: 'The higher enemy HP, the greater your damage (0%–30%).',
    passive: [],
    situational: [{ id: 'asn-max', label: 'Enemy at MAX HP', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'asn-half', label: 'Enemy at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }],
  },

  executioner: {
    name: 'Executioner', rarity: 'rare',
    desc: 'The lower the enemy HP, the greater your damage (0%–30%).',
    passive: [],
    situational: [{ id: 'exe-low', label: 'Enemy at 0% HP threshold', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'exe-half', label: 'Enemy at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }],
  },

  lethal: {
    name: 'Lethal', rarity: 'rare',
    desc: '+30% True Damage.',
    passive: [{ stat: 'true_dmg', op: 'add', value: 30 }],
  },

  toxic: {
    name: 'Toxic', rarity: 'rare',
    desc: 'Attacks POISON enemies.',
    passive: [],
    notes: 'Status effect. No direct stat impact.',
  },

  frostbite: {
    name: 'Frostbite', rarity: 'rare',
    desc: 'Attacks FREEZE enemies.',
    passive: [],
    notes: 'Status effect. No direct stat impact.',
  },

  buff: {
    name: 'Buff', rarity: 'rare',
    desc: '+30% ATK',
    passive: [{ stat: 'atk', op: 'pct', value: 30 }],
  },

  armored: {
    name: 'Armored', rarity: 'rare',
    desc: '+30% DEF',
    passive: [{ stat: 'def', op: 'pct', value: 30 }],
  },

  workhorse: {
    name: 'Workhorse', rarity: 'rare',
    desc: '+30% Cooldown Reduction',
    passive: [{ stat: 'cooldown_red', op: 'add', value: 30 }],
  },

  shielding: {
    name: 'Shielding', rarity: 'rare',
    desc: 'Start of fight: shield for 5% of HP. If a round passes at MAX HP, gain another. Stacks infinitely.',
    passive: [],
    situational: [{ id: 'shield-stack', label: 'Per shield stack (vs HP)', desc: 'Each stack = 5% HP as shield. Stat impact varies.', passive: [] }],
  },

  saving: {
    name: 'Saving Habits', rarity: 'rare',
    desc: 'Shops are 20% cheaper.',
    passive: [],
    notes: 'Economy effect. No combat stat impact.',
  },

  voided: {
    name: 'Voided', rarity: 'rare',
    desc: 'Attacks have a 5% chance to spawn black holes that pull and damage.',
    passive: [],
    notes: 'Proc effect. No direct stat impact.',
  },

  legday: {
    name: 'Leg Day', rarity: 'rare',
    desc: 'Big thighs. +30% SPD, +30% Dexterity',
    passive: [{ stat: 'spd', op: 'pct', value: 30 }, { stat: 'dexterity', op: 'add', value: 30 }],
  },

  shrinkray: {
    name: 'Shrink Ray', rarity: 'rare',
    desc: 'Damage shrinks enemies by 50% and reduces their DEF by 5%.',
    passive: [],
    notes: 'Affects enemy stats. No self stat impact.',
  },

  vital: {
    name: 'Vital', rarity: 'rare',
    desc: '+30% HP',
    passive: [{ stat: 'hp', op: 'pct', value: 30 }],
  },

  swiftstrike: {
    name: 'Swiftstrike', rarity: 'rare',
    desc: '+30% SPD, +20% Crit Chance',
    passive: [{ stat: 'spd', op: 'pct', value: 30 }, { stat: 'crit_rate', op: 'add', value: 20 }],
  },

  spellweaver: {
    name: 'Spellweaver', rarity: 'rare',
    desc: '+30% MAG, +20% Cooldown Reduction',
    passive: [{ stat: 'mag', op: 'pct', value: 30 }, { stat: 'cooldown_red', op: 'add', value: 20 }],
  },

  lifeline: {
    name: 'Lifeline', rarity: 'rare',
    desc: '+25% Lifesteal, +25% Heal Power',
    passive: [{ stat: 'lifesteal', op: 'add', value: 25 }, { stat: 'heal_pow', op: 'add', value: 25 }],
  },

  weakpoint: {
    name: 'Weakpoint', rarity: 'rare',
    desc: '+25% True Damage, +25% Crit Chance',
    passive: [{ stat: 'true_dmg', op: 'add', value: 25 }, { stat: 'crit_rate', op: 'add', value: 25 }],
  },

  berserker: {
    name: 'Berserker', rarity: 'rare',
    desc: '70% ATK, -30% DEF',
    passive: [{ stat: 'atk', op: 'pct', value: 70 }, { stat: 'def', op: 'pct', value: -30 }],
  },

  bulwark: {
    name: 'Bulwark', rarity: 'rare',
    desc: '+70% DEF, -45% ATK',
    passive: [{ stat: 'def', op: 'pct', value: 70 }, { stat: 'atk', op: 'pct', value: -45 }],
  },

  overdrive: {
    name: 'Overdrive', rarity: 'rare',
    desc: '+40% ATK, -10% HP',
    passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'hp', op: 'pct', value: -10 }],
  },

  solo: {
    name: 'Solo', rarity: 'rare',
    desc: '+25% all stats when fighting without allies.',
    passive: [],
    situational: [{ id: 'solo-alone', label: 'Fighting alone (no allies)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }],
  },

  packhunter: {
    name: 'Pack Hunter', rarity: 'rare',
    desc: '+25% ATK per ally in the fight (up to +75%).',
    passive: [],
    situational: [{ id: 'pack-1', label: '1 ally in fight (+25% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 25 }] }, { id: 'pack-2', label: '2 allies in fight (+50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }, { id: 'pack-3', label: '3+ allies in fight (+75% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 75 }] }],
  },

  laststand: {
    name: 'Last Stand', rarity: 'rare',
    desc: 'At ≤25% HP: +30% ATK, +30% DEF.',
    passive: [],
    situational: [{ id: 'ls-low', label: 'Currently at ≤25% HP', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'def', op: 'pct', value: 30 }] }],
  },

  opportunist: {
    name: 'Opportunist', rarity: 'rare',
    desc: '+80% ATK vs enemies that are stunned, slowed, or poisoned.',
    passive: [],
    situational: [{ id: 'opp-cc', label: 'Enemy is stunned, slowed, or poisoned', passive: [{ stat: 'atk', op: 'pct', value: 80 }] }],
  },

  momentum: {
    name: 'Momentum', rarity: 'rare',
    desc: 'Each consecutive hit without taking damage: +15% ATK. Stacks up to 3x.',
    passive: [],
    situational: [{ id: 'mom-1', label: '1 hit streak (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }, { id: 'mom-2', label: '2 hit streak (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'mom-3', label: '3+ hit streak (+45% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 45 }] }],
  },

  adrenaline: {
    name: 'Adrenaline', rarity: 'rare',
    desc: 'Taking damage grants +30% ATK for 2 turns.',
    passive: [],
    situational: [{ id: 'adren-hit', label: 'Just took damage (+30% ATK for 2 turns)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }],
  },

  secondwind: {
    name: 'Second Wind', rarity: 'rare',
    desc: 'Once per fight, survive a killing blow at 1 HP.',
    passive: [],
    notes: 'Once-per-fight effect. No direct stat impact.',
  },

  mending: {
    name: 'Mending', rarity: 'rare',
    desc: '+45% Heal Power. Your heals restore 5% HP to yourself.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 45 }],
    notes: 'Self-heal on cast is flavor/mechanic. Heal Power is the stat impact.',
  },

  fortify: {
    name: 'Fortify', rarity: 'rare',
    desc: 'After taking 3 hits in a row, gain x2 DEF.',
    passive: [],
    situational: [{ id: 'fort-3hit', label: 'Took 3 hits in a row (+100% DEF)', passive: [{ stat: 'def', op: 'pct', value: 100 }] }],
  },

  evasion: {
    name: 'Evasion', rarity: 'rare',
    desc: '+30% Dexterity',
    passive: [{ stat: 'dexterity', op: 'add', value: 30 }],
  },

  warcry: {
    name: 'Warcry', rarity: 'rare',
    desc: 'Once per fight, give all allies +50% ATK for 2 turns.',
    passive: [],
    notes: 'Support effect. No self stat impact.',
  },

  bubbly: {
    name: 'Bubbly', rarity: 'rare',
    desc: '50% chance on hit to encase enemy in a bubble, stunning them for 1 turn but making them untouchable.',
    passive: [],
    notes: 'Proc effect. Stuns but grants enemy temporary damage immunity.',
  },

  // ============ EPIC (light purple, pulse) ============
  economic: {
    name: 'Economic', rarity: 'epic',
    desc: 'Shops are 50% cheaper.',
    passive: [],
    notes: 'Economy effect. No combat stat impact.',
  },

  pyromaniac: {
    name: 'Pyromaniac', rarity: 'epic',
    desc: 'Explosions x4 bigger. Explosions BURN nearby enemies. Heal 5% HP per turn per BURNING enemy.',
    passive: [],
    situational: [{ id: 'pyro-3', label: '3 burning enemies (heal preview)', desc: 'Heal scales with HP.', passive: [] }],
  },

  prime: {
    name: 'Prime', rarity: 'epic',
    desc: '+40% ATK, +40% DEF',
    passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }],
  },

  overflowing: {
    name: 'Overflowing', rarity: 'epic',
    desc: '+85% Cooldown Reduction',
    passive: [{ stat: 'cooldown_red', op: 'add', value: 85 }],
  },

  vampiric: {
    name: 'Vampiric', rarity: 'epic',
    desc: '+75% Lifesteal',
    passive: [{ stat: 'lifesteal', op: 'add', value: 75 }],
  },

  solar: {
    name: 'Solar', rarity: 'epic',
    desc: '+65% SPD, +30% Dexterity',
    passive: [{ stat: 'spd', op: 'pct', value: 65 }, { stat: 'dexterity', op: 'add', value: 30 }],
  },

  gambler: {
    name: 'Gambler', rarity: 'epic',
    desc: '+50% Crit Chance, +40% Crit Damage',
    passive: [{ stat: 'crit_rate', op: 'add', value: 50 }, { stat: 'crit_dmg', op: 'add', value: 40 }],
  },

  deferred: {
    name: 'Deferred', rarity: 'epic',
    desc: '+70% ATK. Damage delivered over 3 turns.',
    passive: [{ stat: 'atk', op: 'pct', value: 70 }],
  },

  trueT: {
    name: 'True', rarity: 'epic',
    desc: '+70% True Damage',
    passive: [{ stat: 'true_dmg', op: 'add', value: 70 }],
  },

  heavyhitter: {
    name: 'Heavy Hitter', rarity: 'epic',
    desc: '+8 ATK per 50 HP. Capped at +300 ATK.',
    passive: [{ op: 'derived', stat: 'atk', from: 'hp', per: 50, perValue: 8, cap: 300 }],
  },

  clothesline: {
    name: 'Clothesline', rarity: 'epic',
    desc: 'Tether to an ally each fight. Laser scales with ATK, slows enemies by 10%.',
    passive: [],
    notes: 'Ally-tether effect. No self stat impact.',
  },

  dawn: {
    name: "Dawnbringer's Resolve", rarity: 'epic',
    desc: 'At ≤50% HP, recover 10% HP every turn until full.',
    passive: [],
    situational: [{ id: 'dawn-low', label: 'Currently at ≤50% HP', desc: 'Sustained healing.', passive: [] }],
  },

  warmup: {
    name: 'Warmup Routine', rarity: 'epic',
    desc: 'Spend first round exercising (cancels if hit). After: +50% all main stats. Can keep exercising indefinitely.',
    passive: [],
    situational: [{ id: 'warmup-done', label: 'Warmup completed', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }],
  },

  colossus: {
    name: 'Colossus', rarity: 'epic',
    desc: '+80% HP, +30% DEF',
    passive: [{ stat: 'hp', op: 'pct', value: 80 }, { stat: 'def', op: 'pct', value: 30 }],
  },

  archmage: {
    name: 'Archmage', rarity: 'epic',
    desc: '+60% MAG, +20% CDR, +20% Heal Power',
    passive: [{ stat: 'mag', op: 'pct', value: 60 }, { stat: 'cooldown_red', op: 'add', value: 20 }, { stat: 'heal_pow', op: 'add', value: 20 }],
  },

  phantom: {
    name: 'Phantom', rarity: 'epic',
    desc: '+60% SPD, +20% Dexterity, +20% Crit Chance',
    passive: [{ stat: 'spd', op: 'pct', value: 60 }, { stat: 'dexterity', op: 'add', value: 20 }, { stat: 'crit_rate', op: 'add', value: 20 }],
  },

  juggernaut: {
    name: 'Juggernaut', rarity: 'epic',
    desc: '+40% ATK, +40% HP, -25% SPD',
    passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: -25 }],
  },

  irongiant: {
    name: 'Iron Giant', rarity: 'epic',
    desc: '+25 DEF per 100 HP. The more HP you have, the tougher you get.',
    passive: [{ op: 'derived', stat: 'def', from: 'hp', per: 100, perValue: 25 }],
  },

  spellblade: {
    name: 'Spellblade', rarity: 'epic',
    desc: '+1.5 ATK per 3 MAG. Magic fuels your physical hits.',
    passive: [{ op: 'derived', stat: 'atk', from: 'mag', per: 3, perValue: 1.5 }],
  },

  reaper: {
    name: 'Reaper', rarity: 'epic',
    desc: 'Killing an enemy restores 75% HP.',
    passive: [],
    notes: 'Kill-trigger heal. No passive stat impact.',
  },

  onslaught: {
    name: 'Onslaught', rarity: 'epic',
    desc: 'Each consecutive attack turn without being hit: +40% ATK. Stacks up to 3x. Resets if you take damage.',
    passive: [],
    situational: [{ id: 'ons-1', label: '1 turn streak (+40% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 40 }] }, { id: 'ons-2', label: '2 turn streak (+80% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 80 }] }, { id: 'ons-3', label: '3+ turn streak (+120% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 120 }] }],
  },

  absorbent: {
    name: 'Absorbent', rarity: 'epic',
    desc: 'Each hit you take: +10% DEF for the rest of the fight. Resets between fights.',
    passive: [],
    situational: [{ id: 'abs-5', label: 'After 5 hits taken (+50% DEF)', passive: [{ stat: 'def', op: 'pct', value: 50 }] }, { id: 'abs-10', label: 'After 10 hits taken (+100% DEF)', passive: [{ stat: 'def', op: 'pct', value: 100 }] }],
  },

  mirror: {
    name: 'Mirror', rarity: 'epic',
    desc: 'Reflect 35% of all damage taken back at the attacker.',
    passive: [],
    notes: 'Damage reflection. No direct self stat impact.',
  },

  echo: {
    name: 'Echo', rarity: 'epic',
    desc: 'Every 2nd attack fires twice, hitting the same target again for full damage.',
    passive: [],
    notes: 'Attack multiplier. No direct stat impact.',
  },

  timebomb: {
    name: 'Time Bomb', rarity: 'epic',
    desc: 'Once per fight, mark an enemy. They take double damage on their next hit received.',
    passive: [],
    notes: 'One-shot debuff. No self stat impact.',
  },

  overdose: {
    name: 'Overdose', rarity: 'epic',
    desc: 'Being healed above max HP converts the excess into bonus ATK temporarily.',
    passive: [],
    situational: [{ id: 'od-active', label: 'Overhealed (bonus ATK active)', passive: [{ stat: 'atk', op: 'pct', value: 60 }] }],
  },

  shieldbreak: {
    name: 'Shield Breaker', rarity: 'epic',
    desc: '+150% ATK vs any enemy that has a shield or barrier active.',
    passive: [],
    situational: [{ id: 'sb-shielded', label: 'Enemy has a shield or barrier', passive: [{ stat: 'atk', op: 'pct', value: 150 }] }],
  },

  warden: {
    name: 'Warden', rarity: 'epic',
    desc: 'When any ally drops below 30% HP, instantly shield them for 15% of your HP.',
    passive: [],
    notes: 'Ally-shield proc. No self stat impact.',
  },

  empower: {
    name: 'Empower', rarity: 'epic',
    desc: 'Buffs and heals you give allies are 50% stronger.',
    passive: [],
    notes: 'Support multiplier. No self stat impact.',
  },

  commander: {
    name: 'Commander', rarity: 'epic',
    desc: 'All allies gain +35% ATK while you are above 50% HP.',
    passive: [],
    situational: [{ id: 'cmd-up', label: 'You are above 50% HP (allies +35% ATK)', desc: 'Ally buff. No self stat impact.', passive: [] }],
  },

  second_skin: {
    name: 'Second Skin', rarity: 'epic',
    desc: '+50% DEF. The first hit you take each fight deals 0 damage.',
    passive: [{ stat: 'def', op: 'pct', value: 50 }],
    notes: 'First hit each fight is negated entirely.',
  },

  blitz: {
    name: 'Blitz', rarity: 'epic',
    desc: '+55% ATK, +55% Crit Chance, -25% DEF. Cannot use defensive abilities or skills.',
    passive: [{ stat: 'atk', op: 'pct', value: 55 }, { stat: 'crit_rate', op: 'add', value: 55 }, { stat: 'def', op: 'pct', value: -25 }],
    notes: 'Defensive abilities and skills are locked out.',
  },

  siphon: {
    name: 'Siphon', rarity: 'epic',
    desc: 'At the end of each round, drain 10% of the target\'s current HP as healing.',
    passive: [],
    situational: [{ id: 'sp-1', label: '1 round of drain (5% target HP healed)', desc: 'Calculate from target\'s current HP each round.', passive: [] }, { id: 'sp-3', label: '3 rounds of drain', desc: 'Applies every round.', passive: [] }],
  },

  double_tap: {
    name: 'Double Tap', rarity: 'epic',
    desc: 'After landing a kill, immediately make a bonus attack on the nearest enemy at x3 ATK.',
    passive: [],
    notes: 'Kill-triggered bonus hit. Does not chain on a second kill.',
  },

  sentinel: {
    name: 'Sentinel', rarity: 'epic',
    desc: '25% of all damage dealt to nearby allies is redirected to you instead. +65% DEF.',
    passive: [{ stat: 'def', op: 'pct', value: 65 }],
    notes: '25% of all incoming ally damage is redirected to you.',
  },

  pressure_pt: {
    name: 'Pressure Point', rarity: 'epic',
    desc: 'Every 3rd consecutive hit on the same target deals triple damage and stuns them for 1 round.',
    passive: [],
    notes: 'Count hits per target. Every 3rd = x3 damage + 1 round stun. Counter resets on target switch.',
  },

  deadweight: {
    name: 'Deadweight', rarity: 'epic',
    desc: '+6% ATK per item currently equipped. More gear, more force.',
    passive: [],
    situational: [{ id: 'dw-2', label: '2 items equipped (+12% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 12 }] }, { id: 'dw-4', label: '4 items equipped (+24% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 24 }] }, { id: 'dw-6', label: '6 items equipped (+36% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 36 }] }, { id: 'dw-8', label: '8 items equipped (+48% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 48 }] }],
  },

  chain: {
    name: 'Chain', rarity: 'epic',
    desc: 'Every crit arcs to a second nearby enemy for 45% of the damage.',
    passive: [],
    notes: 'Crits bounce to the nearest other enemy for 45% of the original damage.',
  },

  war_drum: {
    name: 'War Drum', rarity: 'epic',
    desc: 'All allies passively gain +40% ATK. You gain an additional +5% ATK per ally that currently has any buff active.',
    passive: [],
    situational: [{ id: 'wd-1', label: '1 buffed ally (+5% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 5 }] }, { id: 'wd-2', label: '2 buffed allies (+10% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'wd-3', label: '3 buffed allies (+15% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }],
  },

  overclock: {
    name: 'Overclock', rarity: 'epic',
    desc: '+90% Cooldown Reduction. You take +20% more damage from all sources.',
    passive: [{ stat: 'cooldown_red', op: 'add', value: 90 }],
    notes: 'Trade-off: major CDR boost at the cost of increased damage taken.',
  },

  shadowstrike: {
    name: 'Shadowstrike', rarity: 'epic',
    desc: 'The first attack you make each fight ignores DEF entirely and deals True Damage equal to 30% of the target\'s current HP.',
    passive: [],
    notes: 'First attack each fight only. Bypasses all DEF and shields.',
  },

  grounded: {
    name: 'Grounded', rarity: 'epic',
    desc: 'Immune to knockback, displacement, and aerial effects. +40% DEF vs magic. +30% Status Resistance.',
    passive: [{ stat: 'status_res', op: 'add', value: 30 }],
    notes: 'Immune to all movement/displacement effects. +40% DEF specifically against magic damage.',
  },

  piles_of_bones: {
    name: 'Piles of Bones', rarity: 'epic',
    desc: '+2% Crit Chance and +2% Crit Damage per kill. Permanent.',
    passive: [],
    cultivation: { label: 'Kills', perStack: [{ stat: 'crit_rate', op: 'add', value: 2 }, { stat: 'crit_dmg', op: 'add', value: 2 }], defaultStacks: 0, maxStacks: 500 },
  },

  spite: {
    name: 'Spite', rarity: 'epic',
    desc: '+30% ATK per debuff or status effect currently active on you. The more they pile on, the worse an idea that was.',
    passive: [],
    situational: [{ id: 'sp-1', label: '1 debuff active (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'sp-2', label: '2 debuffs active (+60% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 60 }] }, { id: 'sp-3', label: '3 debuffs active (+90% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 90 }] }, { id: 'sp-4', label: '4+ debuffs active (+120% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 120 }] }],
  },

  exposed: {
    name: 'Exposed', rarity: 'epic',
    desc: 'Your DEF is permanently 0. But on every attack turn you take, the target\'s DEF is also reduced to 0 for that hit. Mutually assured vulnerability.',
    passive: [{ stat: 'def', op: 'pct', value: -100 }],
    notes: 'DEF is set to 0. Strip all DEF items and buffs. On your attack turns, also zero the target\'s DEF for that hit.',
  },

  vitalsiphon: {
    name: 'Vital Siphon', rarity: 'epic',
    desc: '+1% Lifesteal per 15 DEF.',
    passive: [{ op: 'derived', stat: 'lifesteal', from: 'def', per: 15, perValue: 1 }],
  },

  corepiercer: {
    name: 'Core Piercer', rarity: 'epic',
    desc: '+2% True Damage per 20 ATK.',
    passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 20, perValue: 2 }],
  },

  desperate: {
    name: 'Desperate Measures', rarity: 'epic',
    desc: 'At ≤40% HP: +80% MAG and +60% Cooldown Reduction.',
    passive: [],
    situational: [{ id: 'desperate-crisis', label: 'Currently at ≤40% HP', passive: [{ stat: 'mag', op: 'pct', value: 80 }, { stat: 'cooldown_red', op: 'add', value: 60 }] }],
  },

  rampage: {
    name: 'Rampage', rarity: 'epic',
    desc: 'Each enemy defeated in combat grants +35% ATK and +35% SPD for the rest of the fight (max 4x).',
    passive: [],
    situational: [{ id: 'rampage-1', label: '1 enemy defeated (+35% ATK, +35% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'spd', op: 'pct', value: 35 }] }, { id: 'rampage-4', label: '4+ enemies defeated (+140% ATK, +140% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 140 }, { stat: 'spd', op: 'pct', value: 140 }] }],
  },

  bounty: {
    name: 'Bounty Hunter', rarity: 'epic',
    desc: 'Each enemy defeated permanently grants +2 Dexterity (max 100 stacks).',
    passive: [],
    cultivation: { label: 'Enemies Defeated', perStack: [{ stat: 'dexterity', op: 'add', value: 2 }], defaultStacks: 0, maxStacks: 100 },
  },

  kinetic: {
    name: 'Kinetic Shielding', rarity: 'epic',
    desc: 'Taking damage grants +50% SPD and +10 Dexterity for 2 turns (max 3 stacks).',
    passive: [],
    situational: [{ id: 'kin-1', label: '1 stack active (+50% SPD, +10 Dexterity)', passive: [{ stat: 'spd', op: 'pct', value: 50 }, { stat: 'dexterity', op: 'add', value: 10 }] }, { id: 'kin-3', label: '3 stacks active (+150% SPD, +30 Dexterity)', passive: [{ stat: 'spd', op: 'pct', value: 150 }, { stat: 'dexterity', op: 'add', value: 30 }] }],
  },

  // ============ LEGENDARY (yellow, glow) ============
  godly: {
    name: 'Godly', rarity: 'legendary',
    desc: '+125% ATK, +125% DEF',
    passive: [{ stat: 'atk', op: 'pct', value: 125 }, { stat: 'def', op: 'pct', value: 125 }],
  },

  rct: {
    name: 'RCT', rarity: 'legendary',
    desc: '-15% HP. Each turn, heal 2% HP per 5 MAG (cap 20%).',
    passive: [{ stat: 'hp', op: 'pct', value: -15 }],
    situational: [{ id: 'rct-tick', label: 'Per-turn regen tick', desc: 'Healing scales with MAG.', passive: [] }],
  },

  gluttonous: {
    name: 'Gluttonous', rarity: 'legendary',
    desc: '+60% CDR. +15% ATK & +15% DEF per 10% CDR.',
    passive: [{ stat: 'cooldown_red', op: 'add', value: 60 }, { op: 'derived', stat: 'atk', from: 'cooldown_red', per: 10, perPct: 15 }, { op: 'derived', stat: 'def', from: 'cooldown_red', per: 10, perPct: 15 }],
  },

  cultivation: {
    name: 'Cultivation', rarity: 'legendary',
    desc: 'Every fight, +2% in every main stat. Permanent scaling.',
    passive: [],
    cultivation: { label: 'Fights Cultivated', perStack: { stat: 'all_main', op: 'pct', value: 2 }, defaultStacks: 10, maxStacks: 500 },
  },

  cursed: {
    name: 'Cursed', rarity: 'legendary',
    desc: 'Lower HP → higher damage (0%→+80%). Gain 30% Lifesteal at 20% HP.',
    passive: [],
    situational: [{ id: 'cursed-low', label: 'Currently at 20% HP', passive: [{ stat: 'atk', op: 'pct', value: 64 }, { stat: 'lifesteal', op: 'add', value: 30 }] }, { id: 'cursed-half', label: 'Currently at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 40 }] }],
  },

  angelic: {
    name: 'Angelic', rarity: 'legendary',
    desc: '+100% Heal Power. Healing an ally heals you for 30% of the amount.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 100 }],
  },

  ryoiki: {
    name: 'Ryoiki', rarity: 'legendary',
    desc: 'Start of fight: shield for 20% HP. If a round passes at MAX HP, +20% HP shield. Stacks infinitely.',
    passive: [],
    situational: [{ id: 'ryoiki-1', label: 'Per shield stack (vs HP)', desc: 'Each stack = 20% HP as shield.', passive: [] }],
  },

  celestial: {
    name: 'Celestial Body', rarity: 'legendary',
    desc: '+150% HP, +150% DEF. Converts vitality to offense: +1 ATK per 50 HP (cap +200 ATK).',
    passive: [{ stat: 'hp', op: 'pct', value: 150 }, { stat: 'def', op: 'pct', value: 150 }, { op: 'derived', stat: 'atk', from: 'hp', per: 50, perValue: 1, cap: 200 }],
  },

  temporal: {
    name: 'Temporal', rarity: 'legendary',
    desc: 'You get 2 turns per round.',
    passive: [],
    notes: 'Action economy. No direct stat impact.',
  },

  spiritual: {
    name: 'Spiritual', rarity: 'legendary',
    desc: '+85% Cooldown Reduction',
    passive: [{ stat: 'cooldown_red', op: 'add', value: 85 }],
  },

  circle: {
    name: 'Circle of Death', rarity: 'legendary',
    desc: 'Damage enemies when you heal. +20% Heal Power per 65 ATK.',
    passive: [{ op: 'derived', stat: 'heal_pow', from: 'atk', per: 65, perValue: 20 }],
  },

  bigbrain: {
    name: 'Big Brain', rarity: 'legendary',
    desc: 'Start of fight: shield worth 300% of IQ.',
    passive: [],
    notes: 'One-time shield. No passive stat impact.',
  },

  giant: {
    name: 'Giant Slayer', rarity: 'legendary',
    desc: 'Become tiny. Deal more damage the bigger your target is.',
    passive: [],
    situational: [{ id: 'gs-big', label: 'Target is HUGE', passive: [{ stat: 'atk', op: 'pct', value: 400 }] }],
  },

  goliath: {
    name: 'Goliath', rarity: 'legendary',
    desc: 'Become big. Deal more damage the smaller your target is.',
    passive: [],
    situational: [{ id: 'go-small', label: 'Target is TINY', passive: [{ stat: 'atk', op: 'pct', value: 400 }] }],
  },

  allin: {
    name: 'All In', rarity: 'legendary',
    desc: 'ATK x2, MAG x2. DEF is permanently set to 1.',
    passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'mag', op: 'pct', value: 100 }],
    notes: 'DEF set to 1 -- remove all DEF items and buffs.',
  },

  thornwall: {
    name: 'Thornwall', rarity: 'legendary',
    desc: 'Reflect 50% of all damage taken back at the attacker as True Damage.',
    passive: [],
    notes: '50% of every hit you receive returns to the attacker as True Damage. Does not reduce damage received.',
  },

  apex_pred: {
    name: 'Apex Predator', rarity: 'legendary', desc: '+35% ATK and +10% True DMG per enemy in the fight. -10% DEF per ally.', passive: [], situational: [
      { id: 'ap-1e0a', label: '1 enemy, no allies', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'true_dmg', op: 'add', value: 10 }] },
      { id: 'ap-2e0a', label: '2 enemies, no allies', passive: [{ stat: 'atk', op: 'pct', value: 70 }, { stat: 'true_dmg', op: 'add', value: 20 }] },
      { id: 'ap-3e0a', label: '3 enemies, no allies', passive: [{ stat: 'atk', op: 'pct', value: 105 }, { stat: 'true_dmg', op: 'add', value: 30 }] },
      { id: 'ap-4e0a', label: '4 enemies, no allies', passive: [{ stat: 'atk', op: 'pct', value: 140 }, { stat: 'true_dmg', op: 'add', value: 40 }] },
      { id: 'ap-1e1a', label: '1 enemy, 1 ally', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'true_dmg', op: 'add', value: 10 }, { stat: 'def', op: 'pct', value: -10 }] },
      { id: 'ap-2e1a', label: '2 enemies, 1 ally', passive: [{ stat: 'atk', op: 'pct', value: 70 }, { stat: 'true_dmg', op: 'add', value: 20 }, { stat: 'def', op: 'pct', value: -10 }] },
      { id: 'ap-3e1a', label: '3 enemies, 1 ally', passive: [{ stat: 'atk', op: 'pct', value: 105 }, { stat: 'true_dmg', op: 'add', value: 30 }, { stat: 'def', op: 'pct', value: -10 }] },
      { id:'ap-2e2a', label:'2 enemies, 2 allies', passive:[{ stat:'atk', op:'pct', value:30 }, { stat:'true_dmg', op:'add', value:20 }, { stat:'def', op:'pct', value:-20 }] },
    ]
  },

  ironvow: {
    name: 'Iron Vow', rarity: 'legendary', desc: 'Sacrifice one main stat permanently (set to 1). All other main stats gain +40%.', passive: [], situational: [
      { id: 'iv-hp', label: 'Vow: Sacrifice HP', passive: [{ stat: 'hp', op: 'pct', value: -99 }, { stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] },
      { id: 'iv-atk', label: 'Vow: Sacrifice ATK', passive: [{ stat: 'atk', op: 'pct', value: -99 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] },
      { id: 'iv-def', label: 'Vow: Sacrifice DEF', passive: [{ stat: 'def', op: 'pct', value: -99 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'atk', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] },
      { id: 'iv-mag', label: 'Vow: Sacrifice MAG', passive: [{ stat: 'mag', op: 'pct', value: -99 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] },
      { id: 'iv-spd', label: 'Vow: Sacrifice SPD', passive: [{ stat: 'spd', op: 'pct', value: -99 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }] },
    ]
  },

  soulforge: {
    name: 'Soul Forge', rarity: 'legendary',
    desc: 'Sacrifice 200 HP (floor: 1 HP) to permanently gain +250% MAG. Stackable.',
    passive: [],
    cultivation: { label: 'HP Sacrifices Made', perStack: { stat: 'mag', op: 'pct', value: 250 }, defaultStacks: 0, maxStacks: 20 },
    notes: 'Each stack costs 200 HP from your stat sheet.',
  },

  final_stand: {
    name: 'Final Stand', rarity: 'legendary',
    desc: 'When HP drops below 15%, all stats triple. Once per fight.',
    passive: [],
    situational: [{ id: 'fs-active', label: 'Below 15% HP -- Final Stand active', passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'def', op: 'pct', value: 200 }, { stat: 'mag', op: 'pct', value: 200 }, { stat: 'spd', op: 'pct', value: 200 }] }],
  },

  thousandcuts: {
    name: 'Thousand Cuts', rarity: 'legendary',
    desc: 'Every attack hits 5 times for 1/4 damage each. Crit, lifesteal, and on-hit effects apply at 100% efficiency per hit.',
    passive: [],
    notes: 'Each attack becomes 5 micro-hits. All per-hit effects trigger on each one.',
  },

  eternal_flame: {
    name: 'Eternal Flame', rarity: 'legendary',
    desc: 'On death, revive once at 1 HP with all stats doubled for one round.',
    passive: [],
    notes: 'One-time revival per combat. Doubled stats last exactly one round.',
  },

  entropy: {
    name: 'Entropy', rarity: 'legendary',
    desc: 'Each hit deals bonus True Damage equal to 7% of the target\'s current HP.',
    passive: [],
    notes: 'True Damage per hit = 7% of target\'s current HP. Bypasses DEF. Scales with their health.',
  },

  phantom_step: {
    name: 'Phantom Step', rarity: 'legendary',
    desc: '+120% SPD, +30% Dexterity. Once per round, automatically negate one incoming attack.',
    passive: [{ stat: 'spd', op: 'pct', value: 120 }, { stat: 'dexterity', op: 'add', value: 30 }],
    notes: 'One free dodge per round. Declared after the attack is announced.',
  },

  apex_hunger: {
    name: 'Apex Hunger', rarity: 'legendary',
    desc: 'Every kill permanently grants +5% ATK. Stacks forever.',
    passive: [],
    cultivation: { label: 'Enemies Slain', perStack: { stat: 'atk', op: 'pct', value: 5 }, defaultStacks: 0, maxStacks: 999 },
    notes: 'Also grants +1% True DMG per kill. Track separately.',
  },

  reapers_mark: {
    name: "Reaper's Mark", rarity: 'legendary',
    desc: 'Every 2nd attack automatically crits. That crit\'s damage is doubled on top of your normal crit multiplier. Enemies are applied with HOLLOW on-hit',
    passive: [],
    notes: 'Count hits. Every 2nd is a guaranteed double-power crit.',
  },

  parasite: {
    name: 'Parasite', rarity: 'legendary', desc: 'Each round, drain 20% of the target\'s ATK and MAG, adding it to yours until combat ends.', passive: [], situational: [
      { id: 'par-1', label: '1 round drained (+20% of target ATK and MAG)', desc: 'Calculate from the target\'s current stats.', passive: [] },
      { id: 'par-3', label: '3 rounds drained (+60% of target ATK and MAG)', desc: 'Calculate from the target\'s current stats.', passive: [] },
      { id: 'par-5', label: '5 rounds drained (+100% of target ATK and MAG)', desc: 'Calculate from the target\'s current stats.', passive: [] },
    ]
  },

  forsaken: {
    name: 'Forsaken', rarity: 'legendary',
    desc: 'Cannot receive healing from allies. All self-healing is tripled. +30% Lifesteal.',
    passive: [{ stat: 'lifesteal', op: 'add', value: 30 }],
    notes: 'Ally heals have no effect. Self-heals and lifesteal-based recovery are tripled.',
  },

  twin_fangs: {
    name: 'Twin Fangs', rarity: 'legendary',
    desc: 'Every attack strikes twice.',
    passive: [],
    notes: 'Both hits can crit and apply on-hit effects.',
  },

  condemned: {
    name: 'Condemned', rarity: 'legendary',
    desc: 'At the start of every fight, you have 5 rounds before youre knocked out. Until then, +65% to all stats.',
    passive: [],
    situational: [{ id: 'cond-active', label: 'Condemned -- rounds 1 through 5', passive: [{ stat: 'atk', op: 'pct', value: 65 }, { stat: 'def', op: 'pct', value: 65 }, { stat: 'mag', op: 'pct', value: 65 }, { stat: 'spd', op: 'pct', value: 65 }, { stat: 'hp', op: 'pct', value: 65 }] }],
  },

  warpath: {
    name: 'Warpath', rarity: 'legendary', desc: 'Each round that passes, gain +10% ATK and +10% SPD permanently for the rest of that fight.', passive: [], situational: [
      { id: 'wp-1', label: 'After round 1 (+10% ATK, +10% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'spd', op: 'pct', value: 10 }] },
      { id: 'wp-3', label: 'After round 3 (+30% ATK, +30% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'spd', op: 'pct', value: 30 }] },
      { id: 'wp-5', label: 'After round 5 (+50% ATK, +50% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] },
      { id: 'wp-8', label: 'After round 8 (+80% ATK, +80% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'spd', op: 'pct', value: 80 }] },
    ]
  },

  blood_frenzy: {
    name: 'Blood Frenzy', rarity: 'legendary', desc: 'Each kill restores 30% HP and permanently stacks +25% ATK for the rest of the fight.', passive: [], situational: [
      { id: 'bf-1', label: '1 kill (+25% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 25 }] },
      { id: 'bf-3', label: '3 kills (+75% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 75 }] },
      { id: 'bf-5', label: '5 kills (+125% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 125 }] },
      { id: 'bf-8', label: '8 kills (+200% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 200 }] },
    ]
  },

  voidborn: {
    name: 'Voidborn', rarity: 'legendary',
    desc: 'Immune to all status effects. Attacks ignore 50% of enemy DEF. Apply VOID on-hit, infinitely stacking.',
    passive: [{ stat: 'status_res', op: 'add', value: 100 }, { stat: 'true_dmg', op: 'add', value: 25 }],
  },

  martyr: {
    name: 'Martyr', rarity: 'legendary',
    desc: 'Once per fight, intercept a lethal hit aimed at an ally. Survive at 1 HP. Gain +90% ATK and +90% DEF until combat ends.',
    passive: [],
    situational: [{ id: 'mart-active', label: 'Martyrdom triggered (post-intercept)', passive: [{ stat: 'atk', op: 'pct', value: 90 }, { stat: 'def', op: 'pct', value: 90 }] }],
  },

  hex_eater: {
    name: 'Hex Eater', rarity: 'legendary',
    desc: 'Every debuff applied to you is converted into an equivalent buff instead.',
    passive: [],
    notes: 'Attribute debuffs flip to self-buffs of equal magnitude.',
  },

  phantom_pain: {
    name: 'Phantom Pain', rarity: 'legendary',
    desc: 'Whenever you take damage, instantly deal 40% of that damage split across all enemies.',
    passive: [],
    notes: 'Does not reduce damage received. Triggers on every hit you take.',
  },

  ironclad: {
    name: 'Ironclad', rarity: 'legendary',
    desc: 'Immune to displacement and movement effects. Every point of DEF also adds 4% ATK.',
    passive: [{ op: 'derived', stat: 'atk', from: 'def', per: 1, perPct: 4 }],
    notes: 'Unstoppable. DEF directly synergizes with ATK.',
  },

  guillotine: {
    name: 'Guillotine', rarity: 'legendary',
    desc: 'If an enemy is at or below 20% HP when you attack, the hit is automatically lethal regardless of remaining HP.',
    passive: [],
    notes: 'Instant kill threshold: 20% HP. Works on any attack.',
  },

  doppelganger: {
    name: 'Doppelganger', rarity: 'legendary',
    desc: 'At the start of every fight, a copy of you appears with 50% of your stats. It fights for 3 rounds, then collapses.',
    passive: [],
    notes: 'Copy has 50% of all your stats. Lasts 3 rounds per fight.',
  },

  sundering: {
    name: 'Sundering', rarity: 'legendary',
    desc: 'Each hit permanently reduces the target\'s DEF by 6% for the rest of that fight. No cap.',
    passive: [],
    situational: [{ id: 'sun-3', label: '3 hits landed (-18% target DEF)', desc: 'Track hits on the same target.', passive: [] }, { id: 'sun-6', label: '6 hits landed (-34% target DEF)', desc: '', passive: [] }, { id: 'sun-10', label: '10 hits landed (-60% target DEF)', desc: '', passive: [] }],
  },

  necromancer: {
    name: 'Necromancer', rarity: 'legendary',
    desc: 'The first enemy you defeat each fight rises as a thrall with 50% of their original stats, fighting for you.',
    passive: [],
    notes: 'One thrall per fight. Persists until end of combat or death.',
  },

  debt_collector: {
    name: 'Debt Collector', rarity: 'legendary',
    desc: 'All damage you take is stored silently. Once per fight, release it all as a single True Damage hit on any target.',
    passive: [],
    notes: 'Track all damage received. Release as one True Damage burst.',
  },

  black_hole: {
    name: 'Black Hole', rarity: 'legendary',
    desc: 'Each round, all enemies lose 5% to all stats. You gain 5% to all stats. Both stack per round.',
    passive: [],
    situational: [{ id: 'bh-1', label: 'After round 1 (you +5% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 5 }] }, { id: 'bh-3', label: 'After round 3 (you +15% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'bh-5', label: 'After round 5 (you +25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }],
  },

  thundergod: {
    name: 'Thundergod', rarity: 'legendary',
    desc: 'At the start of every round, automatically deal True Damage equal to 30% of your ATK to all enemies simultaneously.',
    passive: [],
    notes: 'Round-start True Damage burst to all enemies. Scales with ATK.',
  },

  conqueror: {
    name: 'Conqueror', rarity: 'legendary',
    desc: 'Every combat encounter you survive permanently increases all main stats by 1% and all substats by +1. Stacks up to 100 victories.',
    passive: [],
    cultivation: { label: 'Victories', perStack: [{ stat: 'all_main', op: 'pct', value: 1 }, { stat: 'all_sub', op: 'add', value: 1 }], defaultStacks: 0, maxStacks: 100 },
  },

  soul_link: {
    name: 'Soul Link', rarity: 'legendary',
    desc: 'Bond to one ally. You share 50% of all buffs either of you receives, and split 30% of all damage either of you takes.',
    passive: [],
    notes: 'Choose one ally to bond with. Buff sharing and damage splitting apply both ways.',
  },

  bloodrage: {
    name: 'Bloodrage', rarity: 'legendary',
    desc: 'For every 10% of max HP lost, gain +20% ATK. At 10% HP remaining: x3 ATK.',
    passive: [],
    situational: [{ id: 'br-10', label: 'Lost 10% HP (+20% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 20 }] }, { id: 'br-30', label: 'Lost 30% HP (+60% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 60 }] }, { id: 'br-50', label: 'Lost 50% HP (+100% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 100 }] }, { id: 'br-70', label: 'Lost 70% HP (+140% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 140 }] }, { id: 'br-90', label: 'Lost 90% HP (+180% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 180 }] }],
  },

  chrono_break: {
    name: 'Chrono Break', rarity: 'legendary',
    desc: 'Once per fight, completely undo the last round. HP, positions, and actions revert as if it never happened.',
    passive: [],
    notes: 'One use per fight. Declared immediately after a round ends.',
  },

  cannibal: {
    name: 'Cannibal', rarity: 'legendary',
    desc: 'Upon killing an enemy, permanently gain 50% of their highest stat for the rest of that fight. Stacks per kill.',
    passive: [],
    situational: [{ id: 'can-1', label: '1 kill (+50% of that target\'s top stat)', desc: 'Calculate from the defeated enemy\'s highest stat.', passive: [] }, { id: 'can-3', label: '3 kills (50% per kill, stacking)', desc: 'Each kill uses that enemy\'s own highest stat.', passive: [] }],
  },

  bulwark_aura: {
    name: 'Bulwark Aura', rarity: 'legendary',
    desc: 'All allies passively gain +80% DEF and +25% Status Res. You receive no personal bonus.',
    passive: [],
    notes: '+80% DEF and +25% Status Res apply to your allies only, not yourself.',
  },

  war_priest: {
    name: 'War Priest', rarity: 'legendary',
    desc: 'Whenever you heal an ally, they also gain +20% ATK for the rest of that fight. Stacks per heal.',
    passive: [],
    notes: '+20% ATK applied to the healed ally per heal instance. Stacks with each additional heal.',
  },

  vanguard: {
    name: 'Vanguard', rarity: 'legendary',
    desc: '+125% DEF. 15% of all damage dealt to any ally is redirected to you instead.',
    passive: [{ stat: 'def', op: 'pct', value: 125 }],
    notes: '15% of all incoming ally damage is redirected to you.',
  },

  last_rites: {
    name: 'Last Rites', rarity: 'legendary',
    desc: 'When any ally is knocked out, they immediately revive at 40% HP. Once per ally per fight.',
    passive: [],
    notes: 'Revive triggers automatically on knockout. One use per ally per fight.',
  },

  resonance: {
    name: 'Resonance', rarity: 'legendary',
    desc: 'Your highest stat is copied to every ally at 30% of its value as a flat bonus.',
    passive: [],
    notes: 'Identify your highest stat and add 30% of its value as a flat bonus to every ally.',
  },

  mentor: {
    name: 'Mentor', rarity: 'legendary',
    desc: 'Each fight your party wins, choose one ally to permanently gain +5% in their highest stat.',
    passive: [],
    notes: 'Track wins separately. +5% to the chosen ally\'s highest stat per win -- applied to their sheet, not yours.',
  },

  self_sacrifice: {
    name: 'Sacrifice', rarity: 'legendary',
    desc: 'Voluntarily sacrifice yourself to fully restore one ally\'s HP and grant them +50% all stats for the rest of the fight.',
    passive: [],
    notes: 'You are knocked out upon activation. One use, voluntary, declared on your turn.',
  },

  bodyguard: {
    name: 'Bodyguard', rarity: 'legendary',
    desc: 'While you are alive, allies cannot be knocked out -- any lethal hit on an ally leaves them at 1 HP instead. Also choose one ally to grant +200% DEF to.',
    passive: [],
    notes: 'One-shot prevention is always active. +200% DEF applies to your designated ally.',
  },

  rallying_cry: {
    name: 'Rallying Cry', rarity: 'legendary',
    desc: 'When you take damage exceeding 30% of your max HP in a single hit, all allies gain +200% ATK for that round.',
    passive: [],
    notes: 'Triggers automatically on a qualifying hit. ATK buff lasts only the round it activates.',
  },

  hexbinder: {
    name: 'Hexbinder', rarity: 'legendary',
    desc: 'On hit, apply a random debuff to the enemy: -50% ATK, DEF, MAG, or SPD. Only one debuff active at a time.',
    passive: [],
    notes: 'Debuff is random each hit. Applying a new one replaces the previous.',
  },

  disruptor: {
    name: 'Disruptor', rarity: 'legendary',
    desc: 'Enemies targeting your allies have their ATK reduced by 50%.',
    passive: [],
    notes: '-50% ATK applied to any enemy whose declared target is one of your allies.',
  },

  nemesis: {
    name: 'Nemesis', rarity: 'legendary',
    desc: 'Designate one named character as your Nemesis. You deal x2 damage to them. Defeating your Nemesis permanently grants x1-x2 to all stats based on their power. The bond persists outside of fights.',
    passive: [],
    notes: 'Name your Nemesis on your sheet. x2 damage applies to them only. Stat multiplier on defeat is decided by the GM based on enemy strength (x1 minimum, x2 maximum).',
  },

  lonewolf: {
    name: 'Lone Wolf', rarity: 'legendary',
    desc: 'While fighting alone (no allies): x1.75 to ATK, DEF, MAG, and SPD. While in a party: all stats drop to x0.5.',
    passive: [],
    situational: [{ id: 'lw-solo', label: 'Fighting alone (x1.75 ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 1.75 }, { stat: 'def', op: 'mul', value: 1.75 }, { stat: 'mag', op: 'mul', value: 1.75 }, { stat: 'spd', op: 'mul', value: 1.75 }] }, { id: 'lw-party', label: 'In a party (x0.5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 0.5 }] }],
  },

  catastrophe: {
    name: 'Catastrophe', rarity: 'legendary',
    desc: 'Every round, all combatants (allies, enemies, and yourself) take damage equal to your full ATK stat. Cannot be mitigated or reduced.',
    passive: [],
    notes: 'AoE True Damage pulse every round equal to your full ATK. Affects everyone in the fight, including allies and yourself.',
  },

  life_support: {
    name: 'Life Support', rarity: 'legendary',
    desc: 'Revive a knocked-out ally at the cost of 45% of your current HP (cannot drop you below 1 HP). Each ally revived permanently grants you +55% DEF and +55% SPD.',
    passive: [],
    cultivation: { label: 'Allies Revived', perStack: [{ stat: 'def', op: 'pct', value: 55 }, { stat: 'spd', op: 'pct', value: 55 }], defaultStacks: 0, maxStacks: 10 },
    notes: 'HP cost is 45% of your current HP at time of use. Cannot kill you.',
  },

  schism: {
    name: 'Schism', rarity: 'legendary',
    desc: '+5 ATK per 1% Heal Power you have.',
    passive: [{ op: 'derived', stat: 'atk', from: 'heal_pow', per: 1, perValue: 5 }],
  },

  find_your_spark: {
    name: 'Find Your Spark', rarity: 'legendary',
    desc: '+3 DEF per 1 SPD. +10 HP per 1 Dexterity.',
    passive: [{ op: 'derived', stat: 'def', from: 'spd', per: 1, perValue: 3 }, { op: 'derived', stat: 'hp', from: 'dexterity', per: 1, perValue: 10 }],
  },

  // ============ MYTHIC (gradient orange/yellow, sun) ============
  adaptation: {
    name: 'Adaptation', rarity: 'mythic',
    desc: 'Every hit from an enemy grants +50% DEF towards that enemy. Stacks infinitely per hit.',
    passive: [],
    cultivation: { label: 'Enemy Hits', perStack: { stat: 'def', op: 'pct', value: 50 }, defaultStacks: 0, maxStacks: 999 },
    notes: 'Each stack represents one enemy hit. Use the SCALING window to adjust hit stacks.',
  },

  acclrsorc: {
    name: 'Accelerating Sorcery', rarity: 'mythic',
    desc: 'Each turn, +15% Cooldown Reduction.',
    passive: [],
    situational: [{ id: 'as-1', label: 'After 1 turn', passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }] }, { id: 'as-3', label: 'After 7 turns', passive: [{ stat: 'cooldown_red', op: 'add', value: 100 }] }],
  },

  brave: {
    name: 'Bravest of the Brave', rarity: 'mythic',
    desc: 'On pick, guaranteed 2 additional rare/epic traits. You can hold 2 traits at once. +30% all stats.',
    passive: [{ stat: 'all_main', op: 'pct', value: 30 }],
    notes: 'Meta. Grants 2 bonus rare/epic traits on pick. Also grants +30% to all stats.',
  },

  bloodlust: {
    name: 'Bloodlust', rarity: 'mythic',
    desc: '-5% HP per round, +140% Lifesteal. Each hit costs 2% HP but gains +5% Lifesteal.',
    passive: [{ stat: 'lifesteal', op: 'add', value: 140 }],
  },

  allforyou: {
    name: 'All for You!', rarity: 'mythic',
    desc: 'Heals & buffs given to allies are x2.5. Cannot heal/buff yourself.',
    passive: [],
    notes: 'Support multiplier. No self stat impact.',
  },

  glasscannon: {
    name: 'Glass Cannon', rarity: 'mythic',
    desc: '+200% ATK, -90% DEF, -80% HP',
    passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'def', op: 'pct', value: -90 }, { stat: 'hp', op: 'pct', value: -80 }],
  },

  magical: {
    name: 'Magical Girl', rarity: 'mythic',
    desc: 'Transform on fight start: +15% all stats, +90% MAG.',
    passive: [{ stat: 'all_main', op: 'pct', value: 15 }, { stat: 'mag', op: 'pct', value: 90 }],
  },

  nesting: {
    name: 'Nesting Doll', rarity: 'mythic',
    desc: '3 revives. Lose -25% HP and -25% ATK per revive.',
    passive: [],
    situational: [{ id: 'nd-1', label: 'After 1 revive', passive: [{ stat: 'hp', op: 'pct', value: -25 }, { stat: 'atk', op: 'pct', value: -25 }] }, { id: 'nd-3', label: 'After 3 revives', passive: [{ stat: 'hp', op: 'pct', value: -75 }, { stat: 'atk', op: 'pct', value: -75 }] }],
  },

  lucifer: {
    name: "Hellborn", rarity: 'mythic',
    desc: "+40% all stats, +50% SPD, +50% Dex. Every attack applies HELLFIRE BURN.",
    passive: [{ stat: 'all_main', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 50 }, { stat: 'dexterity', op: 'add', value: 50 }],
  },

  zoe: {
    name: "Absolute Vitality", rarity: 'mythic',
    desc: "+20% all stats, +200% HP, +80% Heal Power. Heals mirror to self.",
    passive: [{ stat: 'all_main', op: 'pct', value: 20 }, { stat: 'hp', op: 'pct', value: 200 }, { stat: 'heal_pow', op: 'add', value: 80 }],
  },

  vengeance: {
    name: 'Vengeance', rarity: 'mythic',
    desc: 'Per ally dead: x2 stats. All allies dead: -80% DEF but x4 stats & +25% Lifesteal.',
    passive: [],
    situational: [{ id: 'vg-1', label: '1 ally down (x2 stats)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }, { id: 'vg-all', label: 'All allies down', passive: [{ stat: 'all_main', op: 'mul', value: 4 }, { stat: 'def', op: 'pct', value: -80 }, { stat: 'lifesteal', op: 'add', value: 25 }] }],
  },

  raidboss: {
    name: 'Raid Boss', rarity: 'mythic',
    desc: 'Skip first turn (chained, +90% DEF). After: x2 all stats.',
    passive: [],
    situational: [{ id: 'rb-t1', label: 'Turn 1 (chained)', passive: [{ stat: 'def', op: 'pct', value: 90 }] }, { id: 'rb-loose', label: 'After turn 1 (released)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }],
  },

  honored_one: {
    name: 'The Honored One', rarity: 'mythic',
    desc: 'If you are the last surviving ally: ATK x5 and MAG x5.',
    passive: [],
    situational: [{ id: 'ho-last', label: 'Last ally standing (ATK x5, MAG x5)', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }] }],
    notes: 'Triggers only when all other allies are eliminated.',
  },

  transcendence: {
    name: 'Transcendence', rarity: 'mythic',
    desc: 'While above 50% HP, All damage dealt x2 and all damage received is halved.',
    passive: [],
    notes: 'No permanent stat change.',
  },

  world_ender: {
    name: 'World Ender', rarity: 'mythic',
    desc: '+175% ATK, +40% True DMG. Your single strongest attack each fight bypasses all defenses.',
    passive: [{ stat: 'atk', op: 'pct', value: 175 }, { stat: 'true_dmg', op: 'add', value: 40 }],
    notes: 'The highest-damage attack per fight ignores all DEF and resistances.',
  },

  paradox: {
    name: 'Paradox', rarity: 'mythic',
    desc: 'At the start of each fight, all your stats are inverted: your highest stat becomes your lowest, and vice versa. x2 stats',
    passive: [{ stat: 'all_main', op: 'mul', value: 2 }],
    situational: [{ id: 'par-invert', label: 'Stats Inverted (highest ↔ lowest)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }],
    notes: 'At fight start: identify your highest and lowest stats and swap them (and all in-between). All stats are then multiplied by x2. Toggle situational button to show the inverted state is active.',
  },

  usurper: {
    name: 'Usurper', rarity: 'mythic',
    desc: 'Steal every status effect given to anyone in a fight. Immune to negative effects. ',
    passive: [],
    situational: [{ id: 'usr-stolen', label: 'Stolen Buff Active (toggle to match enemy\'s highest buff)', passive: [] }],
    notes: 'At fight start: identify the enemy\'s single highest passive stat buff, remove it from them, and gain an identical buff yourself for the fight. Toggle the situational button and manually set the stat value to match what was stolen.',
  },

  sovereign: {
    name: 'Sovereign', rarity: 'mythic',
    desc: 'Immune to all debuffs and status effects. +45% all main stats.',
    passive: [{ stat: 'all_main', op: 'pct', value: 45 }, { stat: 'status_res', op: 'add', value: 100 }],
    notes: 'Full debuff immunity. Status Res shown as 100% (capped).',
  },

  void_emperor: {
    name: 'Void Emperor', rarity: 'mythic',
    desc: 'Once per fight, permanently set one enemy stat to 0 for the rest of the fight. Cannot target HP.',
    passive: [],
    notes: 'Valid targets: ATK, DEF, MAG, SPD. Effect is irreversible for that fight.',
  },

  plague_bearer: {
    name: 'Plague Bearer', rarity: 'mythic',
    desc: 'Every hit applies an unstackable plague to the enemy: -8% to all their stats until end of fight.',
    passive: [],
    notes: 'Plague is unstackable but refreshes on each hit. Applies to the target only.',
  },

  abyss_walker: {
    name: 'Abyss Walker', rarity: 'mythic',
    desc: '40% chance to phase through any incoming attack (take 0 damage). +30% all main stats.',
    passive: [{ stat: 'all_main', op: 'pct', value: 30 }],
    notes: '40% phase/dodge chance applies per incoming attack.',
  },

  mythbreaker: {
    name: 'Mythbreaker', rarity: 'mythic',
    desc: 'Nullify all legendary and mythic trait effects on enemies for the duration of the fight.',
    passive: [],
    notes: 'Suppresses enemy legendary and mythic traits. Does not affect hexxed traits.',
  },

  legacy: {
    name: 'Legacy', rarity: 'mythic',
    desc: 'Upon being knocked out in a fight, transfer 100% of your 3 highest stats to one chosen ally for the rest of that fight.',
    passive: [],
    notes: 'Activates on knockout only. Chosen ally receives your top 3 stat values as flat bonuses for that fight.',
  },

  ultrakill: {
    name: 'Ultrakill', rarity: 'mythic',
    desc: 'x3 ATK and x3 SPD. Both stats drop by 5% each turn. Killing an enemy immediately resets ATK and SPD to full and grants you an extra turn.',
    passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }],
    situational: [{ id: 'uk-t1', label: 'After turn 1 (-5% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -5 }, { stat: 'spd', op: 'pct', value: -5 }] }, { id: 'uk-t2', label: 'After turn 2 (-10% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -10 }, { stat: 'spd', op: 'pct', value: -10 }] }, { id: 'uk-t3', label: 'After turn 3 (-15% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -15 }, { stat: 'spd', op: 'pct', value: -15 }] }, { id: 'uk-t4', label: 'After turn 4 (-20% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -20 }, { stat: 'spd', op: 'pct', value: -20 }] }, { id: 'uk-t5', label: 'Turn 5+ (-25% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -25 }, { stat: 'spd', op: 'pct', value: -25 }] }],
    notes: 'Kill = ATK and SPD decay fully reset + gain an extra action immediately.',
  },

  disturbing_peace: {
    name: 'Disturbing The Peace', rarity: 'mythic',
    desc: 'x1.2 to ATK, MAG, and SPD per round (compounding). Each spare adds +x0.5 to the multiplier. With 3+ spares in a fight and 1 enemy left: buff locks at x3, +100% Heal Power, +100% True DMG.',
    passive: [],
    situational: [{ id: 'dp-r1', label: 'Round 1 (x1.2 ATK/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 1.2 }, { stat: 'mag', op: 'mul', value: 1.2 }, { stat: 'spd', op: 'mul', value: 1.2 }] }, { id: 'dp-r2', label: 'Round 2 (x1.44)', passive: [{ stat: 'atk', op: 'mul', value: 1.44 }, { stat: 'mag', op: 'mul', value: 1.44 }, { stat: 'spd', op: 'mul', value: 1.44 }] }, { id: 'dp-r3', label: 'Round 3 (x1.73)', passive: [{ stat: 'atk', op: 'mul', value: 1.73 }, { stat: 'mag', op: 'mul', value: 1.73 }, { stat: 'spd', op: 'mul', value: 1.73 }] }, { id: 'dp-r6', label: 'Round 6 (x2.99)', passive: [{ stat: 'atk', op: 'mul', value: 2.99 }, { stat: 'mag', op: 'mul', value: 2.99 }, { stat: 'spd', op: 'mul', value: 2.99 }] }, { id: 'dp-spare1', label: '+1 spare stacked (+x0.5)', passive: [{ stat: 'atk', op: 'mul', value: 1.5 }, { stat: 'mag', op: 'mul', value: 1.5 }, { stat: 'spd', op: 'mul', value: 1.5 }] }, { id: 'dp-spare2', label: '+2 spares stacked (+x1.0)', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'mag', op: 'mul', value: 2 }, { stat: 'spd', op: 'mul', value: 2 }] }, { id: 'dp-mercy', label: 'MERCY JUDGMENT (3+ spares, 1 enemy left)', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }, { stat: 'heal_pow', op: 'add', value: 100 }, { stat: 'true_dmg', op: 'add', value: 100 }] }],
    notes: 'Round multiplier and spare multiplier combine. Mercy Judgment requires both conditions at once.',
  },

  soul_eater: {
    name: 'Soul Eater', rarity: 'mythic',
    desc: 'Each enemy you kill permanently increases your max HP by 40%.',
    passive: [{ stat: 'hp', op: 'pct', value: 40 }],
    notes: 'On each kill, increase your max HP by 40% of your current max HP. This is a permanent increase for the fight.',
  },

  unrelentless_hunger: {
    name: 'Unrelentless Hunger', rarity: 'mythic',
    desc: 'x2 ATK per bleeding enemy. All your attacks inflict bleed for 3 turns. With 2+ bleeding enemies: x2 SPD.',
    passive: [],
    situational: [{ id: 'uh-1b', label: '1 enemy bleeding (x2 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 2 }] }, { id: 'uh-2b', label: '2 enemies bleeding (x4 ATK + x2 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'spd', op: 'mul', value: 2 }] }, { id: 'uh-3b', label: '3 enemies bleeding (x6 ATK + x2 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 6 }, { stat: 'spd', op: 'mul', value: 2 }] }, { id: 'uh-4b', label: '4+ enemies bleeding (x8 ATK + x2 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 8 }, { stat: 'spd', op: 'mul', value: 2 }] }],
    notes: 'Every attack you make inflicts bleed on the target for 3 turns. Track active bleed counts.',
  },

  // ============ HEXXED (gradient dark purple/black, void) ============
  hx_shadow: {
    name: 'Shadow Assassin', rarity: 'hexxed',
    desc: 'Enemy at high HP → up to +400% damage. x1.75 when enemy doesn\'t see you.',
    passive: [],
    situational: [{ id: 'hxsa-max', label: 'Enemy at MAX HP', passive: [{ stat: 'atk', op: 'pct', value: 400 }] }, { id: 'hxsa-unseen', label: 'Enemy doesn\'t see you (x1.75)', passive: [{ stat: 'atk', op: 'mul', value: 1.75 }] }],
  },

  hx_royal: {
    name: 'Royal Executioner', rarity: 'hexxed',
    desc: 'Enemy at low HP → up to +400% damage. Execute enemies below 40% HP.',
    passive: [],
    situational: [{ id: 'hxre-low', label: 'Enemy at 0% threshold', passive: [{ stat: 'atk', op: 'pct', value: 400 }] }, { id: 'hxre-exec', label: 'Execute threshold (40% HP)', desc: 'Instant kill. No stat change.', passive: [] }],
  },

  hx_shrink: {
    name: 'Sci-Fi Shrink Ray', rarity: 'hexxed',
    desc: 'Damage shrinks enemies by 200% and reduces their stats by 50%.',
    passive: [],
    notes: 'Affects enemy stats. No self stat impact.',
  },

  hx_void: {
    name: 'Abyssal Voided', rarity: 'hexxed',
    desc: '50% chance attacks spawn black hole on-hit. Black holes last 3 rounds, Trapped enemies lose their turn.',
    passive: [],
    notes: 'Proc effect. No direct stat impact.',
  },

  hx_econ: {
    name: 'Greedy Economic', rarity: 'hexxed',
    desc: 'Shops are 85% cheaper.',
    passive: [],
    notes: 'Economy effect. No combat stat impact.',
  },

  hx_pyro: {
    name: 'Manic Pyromaniac', rarity: 'hexxed',
    desc: 'Explosions x10 bigger. Apply BURN/POISON/BLEEDING/SLOW. Heal 20% HP/turn per BURNING enemy.',
    passive: [],
  },

  hx_vamp: {
    name: 'Ancient Vampiric', rarity: 'hexxed',
    desc: '+300% Lifesteal. Getting hit -10%. Hitting +10%.',
    passive: [{ stat: 'lifesteal', op: 'add', value: 300 }],
  },

  hx_solar: {
    name: 'Icarus Solar', rarity: 'hexxed',
    desc: '+300% SPD, +80% Dexterity. Nearby enemies slowed 30%.',
    passive: [{ stat: 'spd', op: 'pct', value: 300 }, { stat: 'dexterity', op: 'add', value: 80 }],
  },

  hx_gamble: {
    name: 'Idle Death Gambler', rarity: 'hexxed',
    desc: '+80% Crit Chance, +70% Crit Damage. Crits permanently increase ATK by +2.5%.',
    passive: [{ stat: 'crit_rate', op: 'add', value: 80 }, { stat: 'crit_dmg', op: 'add', value: 70 }],
    cultivation: { label: 'Permanent Crit Stacks', perStack: { stat: 'atk', op: 'pct', value: 2.5 }, defaultStacks: 0, maxStacks: 500 },
  },

  hx_defer: {
    name: 'Fractured Deferred', rarity: 'hexxed',
    desc: '+200% ATK. Damage in 2 turns. Targets lose 70% DEF.',
    passive: [{ stat: 'atk', op: 'pct', value: 200 }],
  },

  hx_true: {
    name: 'Vitriolic True', rarity: 'hexxed',
    desc: 'Completely ignore defense (100% True Damage).',
    passive: [{ stat: 'true_dmg', op: 'add', value: 100 }],
  },

  hx_heavy: {
    name: 'Heaviest of Heavy Hitter', rarity: 'hexxed',
    desc: '+2 ATK per 1 HP. No cap.',
    passive: [{ op: 'derived', stat: 'atk', from: 'hp', per: 1, perValue: 2 }],
  },

  hx_dusk: {
    name: "Duskbringer's Resolve", rarity: 'hexxed',
    desc: 'At ≤20% HP: instantly heal to full + x4 HP as shield.',
    passive: [],
    situational: [{ id: 'hxd-trig', label: 'Triggered (full heal + x4 HP shield)', passive: [] }],
  },

  hx_gymbro: {
    name: "Gymbro's Warmup Routine", rarity: 'hexxed',
    desc: 'Heavy exercise first round (cancels only if all enemies hit). After: +90% all stats. Restack each round.',
    passive: [],
    situational: [{ id: 'hxg-done', label: 'Warmup completed (+90% all)', passive: [{ stat: 'all_main', op: 'pct', value: 90 }] }, { id: 'hxg-2', label: 'Stacked twice (+180% all)', passive: [{ stat: 'all_main', op: 'pct', value: 180 }] }],
  },

  hx_godly: {
    name: 'Egotistic Godly', rarity: 'hexxed',
    desc: 'x4 ATK, x4 DEF. x8 all stats vs SPIRITS.',
    passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'def', op: 'mul', value: 4 }],
    situational: [{ id: 'hxgd-spirit', label: 'Fighting a SPIRIT (x4 all)', passive: [{ stat: 'all_main', op: 'mul', value: 10 }] }],
  },

  hx_cult: {
    name: 'Soul Reaping Cultivation', rarity: 'hexxed',
    desc: 'Every fight, +5% in every main stat. Permanent scaling.',
    passive: [],
    cultivation: { label: 'Souls Reaped', perStack: { stat: 'all_main', op: 'pct', value: 5 }, defaultStacks: 10, maxStacks: 500 },
  },

  hx_cursed: {
    name: 'Undying Cursed', rarity: 'hexxed',
    desc: 'Lower HP → up to +400% damage. At 20% HP: 50% Lifesteal & 100% Resilience.',
    passive: [],
    situational: [{ id: 'hxc-20', label: 'At 20% HP', passive: [{ stat: 'atk', op: 'pct', value: 360 }, { stat: 'lifesteal', op: 'add', value: 50 }, { stat: 'resilience', op: 'add', value: 100 }] }, { id: 'hxc-50', label: 'At 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 100 }] }],
  },

  hx_angel: {
    name: 'Fallen Angelic', rarity: 'hexxed',
    desc: '+400% Heal Power. Healing mirrors fully. -20% Heal Power per hit taken, but reviving a knocked out ally resets it.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 400 }],
  },

  hx_ryoiki: {
    name: 'Overcharged Ryoiki', rarity: 'hexxed',
    desc: 'Start: shield = 100% HP. MAX HP round → +50% HP shield. +5% HP shield per attack.',
    passive: [],
    situational: [{ id: 'hxr-base', label: 'Base shield (100% HP)', desc: 'Shield only. No stat change.', passive: [] }],
  },

  hx_temp: {
    name: 'FTL Temporal', rarity: 'hexxed',
    desc: 'You get 3 turns per round.',
    passive: [],
    notes: 'Action economy. No direct stat impact.',
  },

  hx_spirit: {
    name: 'Mastered Spiritual', rarity: 'hexxed',
    desc: '+95% Cooldown Reduction. Repeated moves get x1.5 effectiveness.',
    passive: [{ stat: 'cooldown_red', op: 'add', value: 95 }],
  },

  hx_giant: {
    name: 'Colossus Slayer', rarity: 'hexxed',
    desc: 'Become microscopic. More damage the bigger your target.',
    passive: [],
    situational: [{ id: 'hxcs-huge', label: 'Target is COLOSSAL', passive: [{ stat: 'atk', op: 'pct', value: 1000 }] }],
  },

  hx_goliath: {
    name: "Cappy's Goliath", rarity: 'hexxed',
    desc: 'Size x20. Makes you EXTREMELY fat. More damage the smaller your target, specially kids.',
    passive: [],
    situational: [{ id: 'hxcg-tiny', label: 'Target is a kid/small', passive: [{ stat: 'atk', op: 'pct', value: 1000 }] }],
  },

  hx_adapt: {
    name: 'Unbound Adaptation', rarity: 'hexxed',
    desc: 'Hit by enemy → +65% DEF for the rest of the fight. 5 hits → permanent immunity to that enemy. Status effects are nerfed depending on your DEF.',
    passive: [],
    situational: [{ id: 'hxua-stk', label: 'Per stack vs an enemy', passive: [{ stat: 'def', op: 'pct', value: 65 }] }],
  },

  hx_blood: {
    name: 'Monstrous Bloodlust', rarity: 'hexxed',
    desc: '-10% HP/round. x4 Lifesteal. Lose 10% lifesteal when being hit, lifesteal doubles at 20% HP. +20% Resilience.',
    passive: [{ stat: 'lifesteal', op: 'mul', value: 4 }, { stat: 'resilience', op: 'add', value: 20 }],
  },

  hx_glass: {
    name: 'Crystalized Glass Cannon', rarity: 'hexxed',
    desc: '+400% ATK, -100% DEF, -99% HP.',
    passive: [{ stat: 'atk', op: 'pct', value: 400 }, { stat: 'def', op: 'pct', value: -100 }, { stat: 'hp', op: 'pct', value: -99 }],
  },

  hx_magic: {
    name: 'Magical Girlypops', rarity: 'hexxed',
    desc: 'Whole party transforms into magical girls!: +25% all stats, x2 MAG.',
    passive: [{ stat: 'all_main', op: 'pct', value: 25 }, { stat: 'mag', op: 'mul', value: 2 }],
  },

  hx_nest: {
    name: 'Death-Defying Nesting Doll', rarity: 'hexxed',
    desc: '5 revives. -20% HP and -20% ATK per revive.',
    passive: [],
    situational: [{ id: 'hxnd-1', label: 'After 1 revive', passive: [{ stat: 'hp', op: 'pct', value: -20 }, { stat: 'atk', op: 'pct', value: -20 }] }, { id: 'hxnd-5', label: 'After 5 revives', passive: [{ stat: 'hp', op: 'pct', value: -100 }, { stat: 'atk', op: 'pct', value: -100 }] }],
  },

  hx_veng: {
    name: "Warlord's Vengeance", rarity: 'hexxed',
    desc: 'Per ally defeated: x2.5 stats. All dead: lose all DEF, x10 all stats, +80% Lifesteal.',
    passive: [],
    situational: [{ id: 'hxv-1', label: '1 ally down (x2.5 stats)', passive: [{ stat: 'all_main', op: 'mul', value: 2.5 }] }, { id: 'hxv-all', label: 'All allies down', passive: [{ stat: 'all_main', op: 'mul', value: 10 }, { stat: 'def', op: 'mul', value: 0 }, { stat: 'lifesteal', op: 'add', value: 80 }] }],
  },

  hx_raid: {
    name: 'Final Raid Boss', rarity: 'hexxed',
    desc: 'Skip turn 1, immune to damage. After: x4 stats. Healing/buffs/shields on you x1.5. +50% Status Res.',
    passive: [],
    situational: [{ id: 'hxrb-loose', label: 'After turn 1 (released)', passive: [{ stat: 'all_main', op: 'mul', value: 4 }, { stat: 'status_res', op: 'add', value: 50 }] }],
  },

  hx_sticky: {
    name: 'Fingering Sticky', rarity: 'hexxed',
    desc: 'your fingers are very sticky :) also u get the sticky fingers stand.',
    passive: [],
    notes: 'sticky af',
  },

  hx_spicy: {
    name: 'Determined Spicy', rarity: 'hexxed',
    desc: '+90% Resilience (capped). Surviving on 1HP → x2 all stats infinitely.',
    passive: [{ stat: 'resilience', op: 'add', value: 90 }],
    situational: [{ id: 'hxds-1', label: 'Survived once on 1HP (x2 all)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }, { id: 'hxds-2', label: 'Survived twice on 1HP (x4 all)', passive: [{ stat: 'all_main', op: 'mul', value: 4 }] }],
  },

  hx_armor: {
    name: 'Full-Plate Armored', rarity: 'hexxed',
    desc: 'x10 DEF',
    passive: [{ stat: 'def', op: 'mul', value: 10 }],
  },

  // ============ DUALITY (heavenly/hellforged toggle) ============
  du_tank: {
    name: 'Divine Bulwark', rarity: 'duality',
    desc: 'Absorb all incoming party damage. Each hit heals you for 30% of the pre-def-processed damage. +400% DEF || Every hit you take permanently stacks +150% DEF for that fight. No cap. +250% HP.',
    passive: [{ stat: 'def', op: 'pct', value: 400 }],
    heavenly: { name: 'Divine Bulwark', desc: 'Absorb all incoming party damage. Each hit heals you for 30% of the damage. +400% DEF.', passive: [{ stat: 'def', op: 'pct', value: 400 }] },
    hellforged: { name: 'Infernal Bastion', desc: 'Every hit you take permanently stacks +150% DEF for that fight. No cap. +300% HP.', passive: [{ stat: 'hp', op: 'pct', value: 300 }] },
  },

  du_atk: {
    name: 'Radiant Strike', rarity: 'duality',
    desc: 'Every attack radiates to all adjacent enemies. Crits blind. +100% Crit Chance, +250% Crit Damage. || Every kill permanently grants +10% ATK. Crits steal 20% of the targets remaining HP as True Damage. +400% ATK.',
    passive: [{ stat: 'crit_rate', op: 'add', value: 100 }, { stat: 'crit_dmg', op: 'add', value: 250 }],
    heavenly: { name: 'Radiant Strike', desc: 'Every attack radiates to all adjacent enemies. Crits blind. +100% Crit Chance, +250% Crit Damage.', passive: [{ stat: 'crit_rate', op: 'add', value: 100 }, { stat: 'crit_dmg', op: 'add', value: 250 }] },
    hellforged: { name: 'Soulreap', desc: "Every kill permanently grants +10% ATK. Crits steal 20% of the targets remaining HP as True Damage. +400% ATK.", passive: [{ stat: 'atk', op: 'pct', value: 400 }] },
  },

  du_mag: {
    name: 'Celestial Surge', rarity: 'duality',
    desc: '+500% MAG. Your spells leave lingering auras that heal allies for 40% your max HP per round. || +500% MAG. Each spell permanently shreds 30% of the targets MAG for that fight.',
    passive: [{ stat: 'mag', op: 'pct', value: 500 }],
    heavenly: { name: 'Celestial Surge', desc: '+500% MAG. Your spells leave lingering auras that heal allies for 40% HP per round.', passive: [{ stat: 'mag', op: 'pct', value: 500 }] },
    hellforged: { name: 'Infernal Grimoire', desc: "+500% MAG. Each spell permanently shreds 30% of the targets MAG for that fight.", passive: [{ stat: 'mag', op: 'pct', value: 500 }] },
  },

  du_heal: {
    name: 'Absolution', rarity: 'duality',
    desc: 'Overheals convert to shields. Overhealed allies become immune to status effects. Overhealed allies gain 100% of your DEF. +400% Heal Power. || Sacrifice 10% of your HP to deal it as True Damage, then heal an ally for x10 the sacrificed amount. +800% HP.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 400 }],
    heavenly: { name: 'Absolution', desc: 'Overheals convert to shields. Overhealed allies become immune to status effects. Overhealed allies gain 100% of your DEF. +400% Heal Power.', passive: [{ stat: 'heal_pow', op: 'add', value: 300 }] },
    hellforged: { name: 'Blood Tithe', desc: 'Sacrifice 10% of your HP to deal it as True Damage, then heal an ally for x10 the sacrificed amount. +800% HP.', passive: [{ stat: 'hp', op: 'pct', value: 800 }] },
  },

  du_spd: {
    name: 'Ultra Instinct', rarity: 'duality',
    desc: '+450% SPD. You act twice every round. Auto-dodge the first attack each round. Attacks can never be blocked, parried, or evaded. || ',
    passive: [{ stat: 'spd', op: 'pct', value: 450 }],
    heavenly: { name: 'Ultra Instinct', desc: '+450% SPD. You act twice every round. Auto-dodge the first attack each round. Attacks can never be blocked, parried, or evaded.', passive: [{ stat: 'spd', op: 'pct', value: 500 }] },
    hellforged: { name: 'Death Sprint', desc: "+500% SPD. If your SPD exceeds the target's, the difference is dealt as bonus True Damage on every hit. Each enemy defeated permanently multiplies your SPD and DEX by 5 for the rest of that fight.", passive: [{ stat: 'spd', op: 'pct', value: 500 }] },
  },

  du_hybrid: {
    name: 'Covenant', rarity: 'duality',
    desc: 'Bond with one ally: share all stats between both of you. If either is defeated, the survivor gains x10 to all non-hp stats. || Copy the trait of every enemy you kill and add it to yourself PERMANENTLY. Stacks infinitely.',
    passive: [],
    heavenly: { name: 'Covenant', desc: 'Bond with one ally: share all stats between both of you. If either is defeated, the survivor gains x10 to all non-hp stats.', passive: [] },
    hellforged: { name: 'Devour', desc: 'Copy the trait of every enemy you kill and add it to yourself PERMANENTLY. Stacks infinitely.', passive: [] },
  },

  du_ruler: {
    name: 'Saviour', rarity: 'duality',
    desc: 'Grants ×2 HP and ×2 DEF to all party members. Each fallen ally increases everyone\'s DEF by +50% of your DEF. Party-wide +30 Resilience. If knocked out first: all allies gain +100% Heal Power. If last standing: HP fully regens and gain +20 Resilience.',
    passive: [{ stat: 'hp', op: 'pct', value: 100 }, { stat: 'def', op: 'pct', value: 100 }, { stat: 'resilience', op: 'add', value: 30 }],
    heavenly: {
      name: 'Saviour',
      desc: 'Grants ×2 HP and ×2 DEF to all party members. Each fallen ally increases everyone\'s DEF by +50% of your DEF. Party-wide +30 Resilience. If knocked out first: all allies gain +100% Heal Power. If last standing: HP fully regens and gain +20 Resilience.',
      passive: [{ stat: 'hp', op: 'pct', value: 100 }, { stat: 'def', op: 'pct', value: 100 }, { stat: 'resilience', op: 'add', value: 30 }],
    },
    hellforged: {
      name: 'Dictator',
      desc: '×2 all stats per surviving ally. Allies gain 50% of your ATK as bonus attack and ×2 Crit Chance. Each ally knocked out: −50% all non-HP stats. All allies down: stats reset, ATK & DEF ×4. If you fall first: all remaining allies gain ×2 ATK.',
      passive: [{ stat: 'all_main', op: 'mul', value: 2 }, { stat: 'crit_rate', op: 'add', value: 100 }],
    },
    situational: [
      // ── SAVIOUR (HEAVENLY) ──────────────────────────────────────────────────
      { id: 'sav-fallen1', label: 'HEAVENLY: 1 ally fallen (+50% DEF)',   passive: [{ stat: 'def', op: 'pct', value: 50  }] },
      { id: 'sav-fallen2', label: 'HEAVENLY: 2 allies fallen (+100% DEF)', passive: [{ stat: 'def', op: 'pct', value: 100 }] },
      { id: 'sav-fallen3', label: 'HEAVENLY: 3 allies fallen (+150% DEF)', passive: [{ stat: 'def', op: 'pct', value: 150 }] },
      { id: 'sav-last',    label: 'HEAVENLY: Last standing (+20 Resilience)', passive: [{ stat: 'resilience', op: 'add', value: 20 }] },
      // ── DICTATOR (HELLFORGED) ───────────────────────────────────────────────
      // Each surviving ally multiplies all stats by ×2 (stacks with base ×2).
      { id: 'dic-2ally',    label: 'HELLFORGED: 2 allies alive (×4 all stats)',  passive: [{ stat: 'all_main', op: 'pct', value: 100  }] },
      { id: 'dic-3ally',    label: 'HELLFORGED: 3 allies alive (×8 all stats)',  passive: [{ stat: 'all_main', op: 'pct', value: 300  }] },
      { id: 'dic-ko1',      label: 'HELLFORGED: 1 ally KO\'d (−50% ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'pct', value: -50 }, { stat: 'def', op: 'pct', value: -50 }, { stat: 'mag', op: 'pct', value: -50 }, { stat: 'spd', op: 'pct', value: -50 }] },
      { id: 'dic-ko2',      label: 'HELLFORGED: 2 allies KO\'d (−100% ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'pct', value: -100 }, { stat: 'def', op: 'pct', value: -100 }, { stat: 'mag', op: 'pct', value: -100 }, { stat: 'spd', op: 'pct', value: -100 }] },
      { id: 'dic-all-down', label: 'HELLFORGED: All allies down — ATK & DEF ×4', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'def', op: 'mul', value: 4 }] },
    ],
  },

  // ============ DETERMINED (evolving heartbeat) ============
  determination: {
    name: 'Determination', rarity: 'determined',
    desc: 'Revive infinitely in a fight, losing 1% main stats per defeat. Defeating enemies grants x1.5 current main stats permanently (max x10); at max: evolves to HATRED. Sparing enemies grants +5% Heal Power & +5% DEF per spare (max x10); at max: evolves to MERCYFUL.',
    passive: [],
    notes: 'Track defeats, kill stacks, and spare stacks on the chip. At 10 kills: HATRED. At 10 spares: MERCYFUL.',
  },

  // ============ LOL-INSPIRED: COMMON ============
  killingedge: {
    name: 'Killing Edge', rarity: 'common',
    desc: 'Deal +36% bonus damage to enemies below 30% HP.',
    passive: [],
    notes: 'Execute threshold bonus. +36% damage when target is below 30% HP.',
  },

  ironskin: {
    name: 'Iron Skin', rarity: 'common',
    desc: '+50 DEF. Passively reduce all physical damage taken by 5.',
    passive: [{ stat: 'def', op: 'add', value: 50 }],
  },

  carnivore: {
    name: 'Carnivore', rarity: 'common',
    desc: 'Restore 50 HP on every kill.',
    passive: [],
    notes: 'Restore 50 HP on each kill.',
  },

  happyhour: {
    name: 'Happy Hour', rarity: 'common',
    desc: '+15% Heal Power. Using a skill restores 5% of max HP.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 15 }],
  },

  energized: {
    name: 'Energized', rarity: 'common',
    desc: 'Every 3rd attack deals +65% ATK damage.',
    passive: [],
    notes: 'Attack counter passive. Every 3rd hit is empowered.',
  },

  manasurge: {
    name: 'Mana Surge', rarity: 'common',
    desc: 'Every 3rd attack restores a burst of stamina.',
    passive: [],
    notes: 'Restore stamina.',
  },

  armorshred: {
    name: 'Armor Shred', rarity: 'common',
    desc: 'Attacks reduce target DEF by 5% for 2 rounds.',
    passive: [],
    notes: 'DEF debuff on target.',
  },

  gatheringspeed: {
    name: 'Gathering Speed', rarity: 'common',
    desc: 'Each attack adds a stack of speed (+10 SPD per stack). Stacks decay when not attacking.',
    passive: [{ stat: 'spd', op: 'add', value: 10 }],
    notes: 'SPD shown as average stack value.',
  },

  poisontrail: {
    name: 'Poison Trail', rarity: 'common',
    desc: 'Leave a toxic trail dealing 10 constant damage to enemies who pass through it and applying POISON for 3 rounds.',
    passive: [],
    notes: 'Environmental hazard. No direct stat bonus.',
  },

  toughitout: {
    name: 'Tough It Out', rarity: 'common',
    desc: 'After taking 3 hits, generate a shield equal to 25% max HP.',
    passive: [],
    notes: 'Shield triggered every 3 incoming hits.',
  },

  boneplating: {
    name: 'Bone Plating', rarity: 'common',
    desc: 'The first 3 hits received each combat deal 30 less damage.',
    passive: [],
    notes: 'Damage reduction on first 3 hits per combat.',
  },

  quickdraw: {
    name: 'Quick Draw', rarity: 'common',
    desc: 'Gain +50% ATK speed after skipping an action.',
    passive: [],
    notes: 'ATK speed bonus triggered by a turn with no attack.',
  },

  battlescar: {
    name: 'Battle Scar', rarity: 'common',
    desc: 'Gain +1 DEF permanently each time you are hit (max +10 per combat).',
    passive: [{ stat: 'def', op: 'add', value: 5 }],
    notes: 'DEF shown as average stack value (5).',
  },

  nimble: {
    name: 'Nimble', rarity: 'common',
    desc: 'Ignore unit collision. Take 4 less damage from all basic attacks.',
    passive: [{ stat: 'def', op: 'add', value: 4 }],
  },

  arcaneedge: {
    name: 'Arcane Edge', rarity: 'common',
    desc: 'After using any skill, the next attack deals bonus magic damage equal to 25% of MAG. +5% MAG',
    passive: [{ stat: 'mag', op: 'pct', value: 5 }],
    notes: 'Bonus magic hit after every skill use.',
  },

  triumph: {
    name: 'Triumph', rarity: 'common',
    desc: 'On kill, restore 24% of missing HP.',
    passive: [],
    notes: 'HP restore on kill. Scales with missing HP.',
  },

  perseverance: {
    name: 'Perseverance', rarity: 'common',
    desc: '+12% Heal Power. Begin regenerating HP rapidly after 2 turns out of combat.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 12 }],
  },

  // ============ LOL-INSPIRED: RARE ============
  voracity: {
    name: 'Voracity', rarity: 'rare',
    desc: 'On kill or assist, reduce all cooldowns by 2 turns.',
    passive: [{ stat: 'cooldown_red', op: 'add', value: 16 }],
    notes: 'CDR burst on kill/assist.',
  },

  hemorrhage: {
    name: 'Hemorrhage', rarity: 'rare',
    desc: 'Attacks apply BLEED, stacking with every hit up to 5 stacks. Each stack adds +20 ATK as bleeding damage. At 5 stacks, the target is slowed for as long as theyre bleeding.',
    passive: [],
    notes: 'Bleed stacks to 5. Slow at full stacks.',
  },

  nighthunter: {
    name: 'Night Hunter', rarity: 'rare',
    desc: 'Gain +35 SPD when moving directly toward a visible enemy.',
    passive: [{ stat: 'spd', op: 'add', value: 35 }],
    notes: '+35 SPD bonus when actively pursuing an enemy.',
  },

  doublestrike: {
    name: 'Double Strike', rarity: 'rare',
    desc: 'Every 3rd attack on the same target strikes twice instantly.',
    passive: [],
    notes: 'Every 3rd consecutive hit on same target = double hit.',
  },

  flurry: {
    name: 'Flurry', rarity: 'rare',
    desc: 'After casting a skill, the next 2 attacks deal +20% damage and cost no cooldown.',
    passive: [],
    notes: '+20% bonus on the 2 attacks immediately after a skill.',
  },

  martialcadence: {
    name: 'Martial Cadence', rarity: 'rare',
    desc: 'First attack on any new target deals bonus damage equal to 8% of their current HP.',
    passive: [],
    notes: '% current HP bonus on first hit per new target.',
  },

  spikedshell: {
    name: 'Spiked Shell', rarity: 'rare',
    desc: '15% of total DEF is added to ATK.',
    passive: [{ stat: 'atk', op: 'pct', value: 10 }],
    notes: 'DEF-to-ATK conversion. Passive shown as approximate bonus.',
  },



  eternalhunger: {
    name: 'Eternal Hunger', rarity: 'rare',
    desc: 'Lifesteal scales with missing HP. At 50% HP: +10% lifesteal. At 10% HP: +30% lifesteal.',
    passive: [{ stat: 'lifesteal', op: 'add', value: 10 }],
    situational: [{ id: 'eh-half', label: 'At 50% HP missing', passive: [{ stat: 'lifesteal', op: 'add', value: 10 }] }, { id: 'eh-low', label: 'At 10% HP missing', passive: [{ stat: 'lifesteal', op: 'add', value: 30 }] }],
  },

  fleetoffoot: {
    name: 'Fleet of Foot', rarity: 'rare',
    desc: 'Gain +12 SPD for 1 turn after a skill hits a target.',
    passive: [{ stat: 'spd', op: 'add', value: 8 }],
  },

  livingvengeance: {
    name: 'Living Vengeance', rarity: 'rare',
    desc: 'On kill: +20 ATK for 2 turns. On elite kill: +35 ATK for 2 turns.',
    passive: [],
    situational: [{ id: 'lv-kill', label: 'On kill (+20 ATK, 2 turns)', passive: [{ stat: 'atk', op: 'add', value: 20 }] }, { id: 'lv-elite', label: 'On elite kill (+35 ATK, 2 turns)', passive: [{ stat: 'atk', op: 'add', value: 35 }] }],
  },

  darktriad: {
    name: 'Dark Triad', rarity: 'mythic',
    desc: 'On-hit, you permanently have a 33% chance to apply BLEEDING, 33% POISONED, or 33% BURNING). Your first strike hits thrice, and applies all 3. Infinitely stackable. If you reach exactly 3 stacks of each at the same time, increase your ATK by x3.33 for 3 rounds and convert the stacks to HELLFIRE BURN, SHATTERED and DECAY for 3 rounds.',
    passive: [],
    situational: [{ id: 'dt-triad', label: 'Dark Triad stacks', passive: [{ stat: 'atk', op: 'mul', value: 3.33 }] }],
    notes: 'First 3 hits per combat strike 3 times and apply a random debuff.',
  },

  lovetap: {
    name: 'Love Tap', rarity: 'rare',
    desc: 'Attacks against a target not hit last turn deal +20% bonus damage.',
    passive: [],
    notes: '+20% damage on first contact with a target each turn cycle.',
  },

  clockworkwindup: {
    name: 'Clockwork Windup', rarity: 'rare',
    desc: 'Consecutive attacks on the same target deal increasing damage (+5% per hit, max +25%).',
    passive: [],
    situational: [{ id: 'cw-max', label: 'At 5 consecutive hits (+25% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 25 }] }],
  },

  voidstone: {
    name: 'Void Stone', rarity: 'rare',
    desc: 'Reduce all magic damage taken by 20%. Absorbed magic damage partially charges your next magical hit.',
    passive: [{ stat: 'status_res', op: 'add', value: 15 }],
    notes: '-20% magic damage taken. Charge mechanic on magic hits.',
  },

  guerrillawarfare: {
    name: 'Guerrilla Warfare', rarity: 'rare',
    desc: 'Standing still for 1 turn renders you invisible. First attack from stealth deals +40% damage.',
    passive: [],
    notes: 'Stealth on idle turn. +40% on break-stealth attack.',
  },

  mortalwill: {
    name: 'Mortal Will', rarity: 'rare',
    desc: 'Build charges from attacks and skills (max 5). At 5 charges, the next ability gains +30% damage and a bonus effect.',
    passive: [],
    notes: '5-charge stack system. Empowered next ability at full stacks.',
  },

  triumphantroar: {
    name: 'Triumphant Roar', rarity: 'rare',
    desc: 'When any nearby unit dies, restore 6% of max HP.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 8 }],
    notes: 'HP regen triggered by any nearby death.',
  },

  deadlyvenom: {
    name: 'Deadly Venom', rarity: 'rare',
    desc: 'Attacks apply stacking poison (max 5 stacks). Each stack deals 2 true damage per turn.',
    passive: [{ stat: 'true_dmg', op: 'add', value: 5 }],
    notes: 'Stacking poison: 2 true damage per turn per stack.',
  },

  salvation: {
    name: 'Salvation', rarity: 'rare',
    desc: 'Gain +20 SPD when moving toward an ally below 30% HP.',
    passive: [{ stat: 'spd', op: 'add', value: 8 }],
    notes: '+20 SPD when rushing toward a low-HP ally.',
  },

  blaze: {
    name: 'Blaze', rarity: 'rare',
    desc: 'Skills ignite targets: deal 4% of their max HP as magic damage over 2 turns. Three ignite stacks on one target cause an explosion dealing 12% of their max HP.',
    passive: [],
    notes: 'DoT on skill hit. Triple-stack explosion.',
  },

  hailofblades: {
    name: 'Hail of Blades', rarity: 'rare',
    desc: 'Gain +60% ATK speed on the first 3 attacks of any combat encounter.',
    passive: [],
    notes: 'Burst ATK speed boost limited to first 3 attacks per combat.',
  },

  // ============ LOL-INSPIRED: EPIC ============
  noxianmight: {
    name: 'Noxian Might', rarity: 'epic',
    desc: 'Apply BLEEDING on-hit. When your stacks reach 5 on a target, gain x2.5 ATK for as long as the enemy is bleeding.',
    passive: [],
    situational: [{ id: 'nm-active', label: 'Hemorrhage at 5 stacks', passive: [{ stat: 'atk', op: 'pct', value: 250 }] }],
  },

  divineascent: {
    name: 'Divine Ascent', rarity: 'epic',
    desc: 'Attacks build Zeal stacks (max 3). At 3 stacks, become Exalted for 1 turn: all attacks deal +85% damage and have 100% crit chance. Then stacks reset.',
    passive: [],
    situational: [{ id: 'da-exalted', label: 'While Exalted (1 turn, +85% ATK, 100% crit)', passive: [{ stat: 'atk', op: 'pct', value: 85 }, { stat: 'crit_rate', op: 'add', value: 100 }] }],
  },

  pitgrit: {
    name: 'Pit Grit', rarity: 'epic',
    desc: 'Track all damage taken over 2 turns. Store 40% of that total as a shield that deploys when the damage stops.',
    passive: [],
    notes: 'Damage absorption shield. Scales with incoming damage.',
  },

  reignofanger: {
    name: 'Reign of Anger', rarity: 'epic',
    desc: 'Build 10 Fury when hit. At 50, gain +60% ATK and +15% lifesteal. Fury decays out of combat.',
    passive: [],
    situational: [{ id: 'roa-fury', label: 'Above 50 Fury (+60% ATK, +15% lifesteal)', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'lifesteal', op: 'add', value: 15 }] }],
  },

  deathbringstance: {
    name: 'Deathbringer Stance', rarity: 'epic',
    desc: 'Every 3rd attack deals 10% of the target\'s max HP as bonus damage and heals you for the same amount.',
    passive: [],
    notes: 'Every 3rd hit: % max HP bonus damage + self heal.',
  },

  arcaneburstcharge: {
    name: 'Arcane Burst', rarity: 'epic',
    desc: 'Between skill casts, attacks charge a burst counter. At 3 charges, the next skill deals +90% extra damage.',
    passive: [],
    notes: '3-attack charge counter between skill casts.',
  },

  brittleapply: {
    name: 'Brittle', rarity: 'epic',
    desc: 'Skills apply Brittle to targets. Attacks against Brittle targets deal +12% damage and briefly reduce their DEF.',
    passive: [],
    notes: 'Brittle mark applied by skills. Consumed by attacks for bonus damage.',
  },

  fervorofbattle: {
    name: 'Fervor of Battle', rarity: 'epic',
    desc: 'Hitting an enemy with a skill grants a Fervor stack (+10% ATK, max 8 stacks). Stacks decay out of combat.',
    passive: [],
    situational: [{ id: 'fob-max', label: 'At max Fervor (8 stacks, +80% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 80 }] }],
  },

  shepherdofsouls: {
    name: 'Shepherd of Souls', rarity: 'epic',
    desc: 'Every time a nearby enemy dies, a Spectral Ghoul spawns and fights alongside you for 2 rounds.',
    passive: [],
    notes: 'Summons a ghoul ally on each nearby death. Lasts 2 rounds.',
  },

  petricite: {
    name: 'Petricite Burst', rarity: 'epic',
    desc: 'Casting skills charges your weapon (max 2 charges). Charged attacks deal +40% magic damage in a small arc. +15% MAG',
    passive: [{ stat: 'mag', op: 'pct', value: 15 }],
    notes: 'Skill charges weapon. Charged AAs deal AoE magic damage.',
  },

  berserkerrage: {
    name: 'Berserker Rage', rarity: 'epic',
    desc: 'ATK speed scales inversely with HP. At full HP: normal. At 50% HP: +45% ATK speed. At 10% HP: +50% ATK speed.',
    passive: [],
    situational: [{ id: 'br-half', label: 'At 50% HP (+45% ATK speed)', passive: [{ stat: 'spd', op: 'pct', value: 45 }] }, { id: 'br-low', label: 'At 10% HP (+50% ATK speed)', passive: [{ stat: 'spd', op: 'pct', value: 50 }] }],
  },

  markofthestorm: {
    name: 'Mark of the Storm', rarity: 'epic',
    desc: 'Skills apply Storm Marks. At 3 marks on one target: they are stunned for 1 round and marks are consumed.',
    passive: [],
    notes: '3 marks = stun for 1 round. Marks applied by skills.',
  },

  runicblade: {
    name: 'Runic Blade', rarity: 'epic',
    desc: 'Each skill cast loads an empowered charge onto your weapon (max 3). Attacks spend charges for +25% ATK & MAG each.',
    passive: [],
    notes: 'Skill charges weapon with up to 3 empowered attacks.',
  },

  organicdeconstruct: {
    name: 'Organic Deconstruction', rarity: 'epic',
    desc: 'Hitting the same target with 3 different attack types (physical, magical, true) triggers a true damage explosion equal to 50% of their max HP.',
    passive: [{ stat: 'true_dmg', op: 'add', value: 8 }],
    notes: '3-type combo triggers a % max HP true damage explosion.',
  },

  sunlightmark: {
    name: 'Sunlight', rarity: 'epic',
    desc: 'Skills apply a Sunlight mark. The next ally attack on a marked target deals bonus light damage equal to 40% of your MAG. +8% MAG',
    passive: [{ stat: 'mag', op: 'pct', value: 8 }],
    notes: 'Support: ally attacks on your Sunlight-marked targets deal bonus damage.',
  },

  presstheattack: {
    name: 'Press the Attack', rarity: 'epic',
    desc: 'Hit an enemy 3 times in a row to expose them: they take +25% increased damage from all sources for 2 rounds.',
    passive: [],
    notes: '3 consecutive hits = expose debuff on target for 2 rounds.',
  },

  whiplash: {
    name: 'Whiplash', rarity: 'epic',
    desc: 'After dashing or being forcibly displaced, the next attack deals +35% damage.',
    passive: [],
    notes: '+35% damage on first attack after any displacement.',
  },

  phaserush: {
    name: 'Phase Rush', rarity: 'epic',
    desc: 'Hitting an enemy 3 times within the same turn grants +90 SPD and 75% slow resistance for 1 turn.',
    passive: [{ stat: 'spd', op: 'add', value: 90 }],
    situational: [{ id: 'pr-active', label: 'Phase Rush active (+90 SPD, 1 turn)', passive: [{ stat: 'spd', op: 'add', value: 90 }] }],
  },

  graspundying: {
    name: 'Grasp of the Undying', rarity: 'epic',
    desc: 'Every other round, the next attack heals 45% of the target\'s max HP and permanently increases your max HP by 15.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 12 }],
    notes: 'HP heal + permanent max HP growth.',
  },

  electrocute: {
    name: 'Electrocute', rarity: 'epic',
    desc: 'Hit an enemy with 3 separate attacks within the same turn to trigger a lightning strike dealing 150 + 30% ATK as magic damage.',
    passive: [],
    notes: '3-hit lightning trigger within one turn.',
  },

  darkharvestlol: {
    name: 'Dark Harvest', rarity: 'epic',
    desc: 'Killing low-HP enemies absorbs their essence. Permanently gain +2 true damage per stack. Stacks persist across fights.',
    passive: [{ stat: 'true_dmg', op: 'add', value: 5 }],
    notes: 'Stacking true damage on low-HP kills. Permanent stacks.',
  },

  // ============ LOL-INSPIRED: LEGENDARY ============
  duelistsdance: {
    name: "Duelist's Dance", rarity: 'legendary',
    desc: 'Four Vital Points appear on enemies. Striking one heals 8% max HP, grants +20 SPD for 2 rounds, stacking; and deals +50% damage. All 4 Vitals refresh after they\'ve all been hit.',
    passive: [],
    notes: 'Vital cycle system. 8% heal + SPD + bonus damage per Vital hit.',
  },

  damnation: {
    name: 'Damnation', rarity: 'legendary',
    desc: 'Every enemy killed drops a Soul. Collect souls for permanent +4 ATK and +4 DEF each. No cap.',
    passive: [],
    cultivation: { label: 'Souls Collected', perStack: [{ stat: 'atk', op: 'add', value: 4 }, { stat: 'def', op: 'add', value: 4 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Permanent soul-stack +4 ATK and +4 DEF per kill.',
  },

  kindredmark: {
    name: 'Mark of the Kindred', rarity: 'legendary',
    desc: 'Designate a Hunt target. Each hunted enemy defeated permanently grants +100 to all stats. Marks renew each combat.',
    passive: [],
    cultivation: { label: 'Hunted Kills', perStack: [{ stat: 'all_main', op: 'add', value: 100 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Hunt target system. +100 all stats per marked kill. Permanent.',
  },

  crimsonpact: {
    name: 'Crimson Pact', rarity: 'legendary',
    desc: 'Every 20 HP = +1 MAG. Every 8 MAG = +15 HP. Both stats scale off each other dynamically.',
    passive: [{ op: 'derived', stat: 'mag', from: 'hp', per: 20, perValue: 1 }, { op: 'derived', stat: 'hp', from: 'mag', per: 8, perValue: 15 }],
    notes: 'HP/MAG dynamic conversion. Stats update whenever either is gained.',
  },

  mirageform: {
    name: 'Mirage Form', rarity: 'legendary',
    desc: 'When dropping below 35% HP, spawn a combat-capable decoy with 50% of your stats for 3 rounds. It draws enemy attention and attacks.',
    passive: [],
    notes: 'Low-HP decoy summon. Decoy fights and taunts for 3 rounds.',
  },

  wayofwanderer: {
    name: 'Way of the Wanderer', rarity: 'legendary',
    desc: 'Cannot critically strike normally. Instead, build Flow as you move. At full Flow, gain a shield equal to 30% max HP and your next hit will crit. All your crits deal +200% damage regardless of source.',
    passive: [{ stat: 'crit_dmg', op: 'add', value: 100 }],
    notes: 'No normal crits. Flow builds on movement. 200% crit damage.',
  },

  ionianfervor: {
    name: 'Ionian Fervor', rarity: 'legendary',
    desc: 'Hitting multiple enemies at once: +8% damage reduction per enemy hit. Against a single target: attacks stack +8% ATK per hit.',
    passive: [],
    situational: [{ id: 'if-multi', label: 'Hitting 3+ enemies (-24% damage taken)', passive: [{ stat: 'def', op: 'pct', value: 24 }] }, { id: 'if-single', label: 'At 6 single-target stacks (+48% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 48 }] }],
  },

  unseenpredator: {
    name: 'Unseen Predator', rarity: 'legendary',
    desc: 'Striking from stealth or behind grants a stack (+10 ATK, +3 SPD). Stacks are permanent.',
    passive: [],
    situational: [{ id: 'up-max', label: 'At 10 stacks', passive: [{ stat: 'atk', op: 'add', value: 100 }, { stat: 'spd', op: 'add', value: 30 }] }],
  },

  contemptweak: {
    name: 'Contempt for the Weak', rarity: 'legendary',
    desc: 'Attacks against enemies below 50% HP deal bonus true damage equal to 6% of their max HP.',
    passive: [{ stat: 'true_dmg', op: 'add', value: 6 }],
    notes: '% max HP true damage bonus on sub-50% enemies.',
  },

  deathbydegrees: {
    name: 'Death by Degrees', rarity: 'legendary',
    desc: 'Attacks deal bonus damage equal to 4 of the target\'s max HP. Heals you for half that amount.',
    passive: [{ stat: 'lifesteal', op: 'add', value: 5 }, { stat: 'true_dmg', op: 'add', value: 5 }],
    notes: '% max HP damage per hit + 50% lifesteal from it.',
  },

  wayofhunter: {
    name: 'Way of the Hunter', rarity: 'legendary',
    desc: 'Every other attack deals bonus magic damage equal to 40% of ATK+MAG. Physical and magical damage alternate with each hit. +30% MAG, +30% ATK',
    passive: [{ stat: 'mag', op: 'pct', value: 30 },  {stat: 'atk', op: 'pct', value: 30 }],
    notes: 'Alternating physical/magic on every other attack.',
  },

  darkinrebirth: {
    name: 'Darkin Rebirth', rarity: 'legendary',
    desc: 'On death, channel briefly then revive at 70% HP with +50% ATK for 3 rounds. Once per encounter.',
    passive: [],
    situational: [{ id: 'dr-revive', label: 'Post-revive (+50% ATK for 3 rounds)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }],
  },

  shatteredtime: {
    name: 'Shattered Time', rarity: 'legendary',
    desc: 'Hitting a magical ability restores the CD of any ability in the party.',
    passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }, { stat: 'spd', op: 'add', value: 8 }],
  },

  livingforge: {
    name: 'Living Forge', rarity: 'legendary',
    desc: 'Can upgrade one item mid-combat. All attacks also apply Brittle to enemies. Brittle targets take +30% crit damage.',
    passive: [],
    notes: 'Item upgrade mid-fight + persistent Brittle on all attacks.',
  },

  undyinggrasp: {
    name: 'Undying Grasp', rarity: 'legendary',
    desc: 'When you would be killed, instantly enter Stasis: untargetable and immune for 1 turn. After Stasis, revive at 100% HP. Once per combat.',
    passive: [],
    notes: 'Once-per-combat death prevention. 1-turn Stasis + revive at 20% HP.',
  },

  // ============ LOL-INSPIRED: MYTHIC ============
  lastingspoils: {
    name: 'Lasting Spoils', rarity: 'mythic',
    desc: 'Every enemy defeated drops an essence. Permanently gain +20 ATK and +20 DEF per soul collected. No cap.',
    passive: [],
    cultivation: { label: 'Souls Collected', perStack: [{ stat: 'atk', op: 'add', value: 20 }, { stat: 'def', op: 'add', value: 20 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Permanent soul-stacking: +20 ATK and +20 DEF per kill.',
  },

  icathiansurprise: {
    name: 'Icathian Surprise', rarity: 'mythic',
    desc: 'On death, go dormant for an instant, then explode: deal true damage equal to 50% of your max HP to all nearby enemies.',
    passive: [],
    notes: 'Death explosion. AoE true damage equal to 50% max HP.',
  },

  gloryindeath: {
    name: 'Glory in Death', rarity: 'mythic',
    desc: 'On death, enter an undead rage for 3 turns: unlimited energy, deal 200% of normal damage, heal from all damage dealt. Cannot die until the 3 turns expire.',
    passive: [],
    situational: [{ id: 'gid-undead', label: 'While in undead rage (3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'lifesteal', op: 'add', value: 100 }] }],
  },

  feast: {
    name: 'Feast', rarity: 'mythic',
    desc: 'On kill: permanently grow. Gain +20 HP, +5 ATK, +3 DEF, +3 MAG. No cap. You are what you eat.',
    passive: [],
    cultivation: { label: 'Kills', perStack: [{ stat: 'hp', op: 'add', value: 20 }, { stat: 'atk', op: 'add', value: 5 }, { stat: 'def', op: 'add', value: 3 }, { stat: 'mag', op: 'add', value: 3 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Permanent stat growth per kill. No max stacks.',
  },

  ravonoushunger: {
    name: 'Ravenous Hunger', rarity: 'mythic',
    desc: 'For every 10% HP missing: gain +40% ATK, +10% lifesteal, and +3% true damage. Scales continuously.',
    passive: [],
    situational: [{ id: 'rh-50', label: 'At 50% HP missing', passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'lifesteal', op: 'add', value: 50 }, { stat: 'true_dmg', op: 'add', value: 15 }] }, { id: 'rh-90', label: 'At 90% HP missing', passive: [{ stat: 'atk', op: 'pct', value: 360 }, { stat: 'lifesteal', op: 'add', value: 90 }, { stat: 'true_dmg', op: 'add', value: 27 }] }],
  },

  bloodfeud: {
    name: 'Blood Feud', rarity: 'mythic',
    desc: 'Deal x2.5 damage and take 50% less damage from the highest ATK/MAG enemy. Apply a random NEGATIVE status effect to them.',
    passive: [],
    notes: 'Auto-tracks highest-damage enemy. Bonus applies only vs that target.',
  },

  eclipsecycle: {
    name: 'Eclipse Cycle', rarity: 'mythic',
    desc: 'After being struck once, become untargetable for 1 round.',
    passive: [],
    notes: 'gwaeyh.',
  },

  voidrift: {
    name: 'Void Rift', rarity: 'mythic',
    desc: 'Every 3rd magical ability you use tears a Void Rift: AoE magic damage equal to 30% of nearby enemies\' max HP, and silences them for 1 round.',
    passive: [],
    notes: 'these descriptions are getting annoying',
  },

  chronorift: {
    name: 'Chronorift', rarity: 'mythic',
    desc: 'When you would take lethal damage, rewind to your position and HP from 1 turn ago, gaining 2 extra turns. Once per combat.',
    passive: [],
    notes: 'Once-per-combat lethal rewind to previous turn\'s HP state.',
  },

  celestialopp: {
    name: 'Celestial Opposition', rarity: 'mythic',
    desc: 'Passively alternate between SOLAR (+120% ATK, +120% SPD) and LUNAR (+120% DEF, +120% MAG) stances after each action. Switching is instant.',
    passive: [],
    situational: [{ id: 'co-solar', label: 'SOLAR stance (+120% ATK, +120% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 120 }, { stat: 'spd', op: 'pct', value: 120 }] }, { id: 'co-lunar', label: 'LUNAR stance (+120% DEF, +120% MAG)', passive: [{ stat: 'def', op: 'pct', value: 120 }, { stat: 'mag', op: 'pct', value: 120 }] }],
  },

  deathmarklol: {
    name: 'Deathmark', rarity: 'mythic',
    desc: 'Passively mark the highest-HP enemy. After 1 round, they take true damage equal to 45% of all damage dealt to them during that round. Refreshes on new targets.',
    passive: [],
    notes: 'Marks highest-HP enemy. Burst-back as true damage after 1 round.',
  },

  infiniteduress: {
    name: 'Infinite Duress', rarity: 'mythic',
    desc: 'After 2 rounds, Lock onto the target you\'ve hit most this combat. They take +300% increased damage from you and you gain 20% true damage.',
    passive: [],
    notes: 'Auto-tracks most-hit target.',
  },

  // ============ LOL-INSPIRED: HEXXED ============
  blightedquill: {
    name: 'Blighted Quill', rarity: 'hexxed',
    desc: 'Attacks apply BLIGHT (max 5 stacks). At 5 stacks: trigger true damage equal to 15% of the target\'s max HP.',
    passive: [{ stat: 'true_dmg', op: 'add', value: 5 }],
    notes: 'Blight stacking vs target + self-blight side effect every 8 hits.',
  },

  feastofflesh: {
    name: 'Feast of Flesh', rarity: 'hexxed',
    desc: 'On kill, permanently devour the fallen: gain HP equal to 12% of their max HP (min +25), +12 ATK, +8 DEF, and +6 MAG. Every 5th kill, all future growth bonuses double permanently. No cap. You become unstoppable.',
    passive: [],
    cultivation: { label: 'Kills', perStack: [{ stat: 'hp', op: 'add', value: 25 }, { stat: 'atk', op: 'add', value: 12 }, { stat: 'def', op: 'add', value: 8 }, { stat: 'mag', op: 'add', value: 6 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Permanent scaling per kill. Every 5th kill: all growth doubles. No cap. HP gain uses minimum value (+25); actual gain is 12% of enemy max HP.',
  },

  fracturelol: {
    name: 'Fracture', rarity: 'hexxed',
    desc: 'Your attacks ignore all DEF. So do attacks made against you. DEF is nullified for both sides. In exchange, gain +250% ATK and +250% SPD.',
    passive: [{ stat: 'atk', op: 'pct', value: 250 }, { stat: 'spd', op: 'pct', value: 250 }],
    notes: 'DEF nullified on both sides. ATK/SPD granted as compensation.',
  },

  palecascade: {
    name: 'Pale Cascade', rarity: 'hexxed',
    desc: 'Passively orbit up to 5 protective orbs (start with 3, gain 2 per round). While at least 1 orb is active: +30% MAG and +30% ATK, plus an additional +5% per extra orb (max +50% MAG and +50% ATK at 5 orbs). Each orb absorbs 1 hit and heals 20% HP when broken. New orbs regenerate every 3 turns.',
    passive: [],
    situational: [{ id: 'pc-1orb', label: '1 orb active (+30% ATK, +30% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'mag', op: 'pct', value: 30 }] }, { id: 'pc-5orb', label: '5 orbs active (+50% ATK, +50% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }],
  },

  corruptedfervor: {
    name: 'Corrupted Fervor', rarity: 'hexxed',
    desc: 'Attacks stack Fervor (+5% ATK, +3% SPD per stack, max 10). At 10 stacks, CORRUPTION takes hold: +450% ATK, +20% lifesteal, all attacks deal true damage, but you attack the nearest unit regardless of alignment.',
    passive: [],
    situational: [{ id: 'cf-building', label: 'At max Fervor (10 stacks, pre-corruption)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 30 }] }, { id: 'cf-corrupt', label: 'CORRUPTION active', passive: [{ stat: 'atk', op: 'pct', value: 450 }, { stat: 'lifesteal', op: 'add', value: 20 }, { stat: 'true_dmg', op: 'add', value: 100 }] }, { id: 'cf-collapse', label: 'Post-corruption collapse (1 turn)', passive: [{ stat: 'atk', op: 'pct', value: -30 }, { stat: 'def', op: 'pct', value: -30 }, { stat: 'spd', op: 'pct', value: -30 }] }],
  },

  crimsontide: {
    name: 'Crimson Tide', rarity: 'hexxed',
    desc: 'Apply BLEEDING on-hit. While you have 5 stacks active on at least one enemy: gain +350% ATK. Hemorrhage also executes targets below 25% HP, but each execution costs 10% of your own max HP.',
    passive: [],
    situational: [{ id: 'ct-active', label: 'While 5 Hemorrhage stacks active (+350% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 350 }] }, { id: 'ct-execute', label: 'On execute (costs 10% own max HP)', passive: [] }],
  },

  darkres: {
    name: 'Dark Resonance', rarity: 'hexxed',
    desc: 'BURN enemies on-hit. You and the ignited target both burn. Your burning state grants +325% ATK but constantly drains HP each turn.',
    passive: [{ stat: 'atk', op: 'pct', value: 325 }],
    notes: 'Mutual burning. ATK bonus while burning. Self HP drain per turn.',
  },

  deathscaress: {
    name: "Death's Caress", rarity: 'hexxed',
    desc: 'Build a massive shield over time while not attacking. When the shield is released or broken, it deals damage equal to its value to all nearby enemies. Cannot attack while building the shield.',
    passive: [],
    notes: 'Idle shield builder. Release or break = AoE burst equal to shield value.',
  },

  // ============ LOL-INSPIRED: DUALITY ============
  hunterhunted: {
    name: 'Hunter / Hunted', rarity: 'duality',
    desc: 'Every 3 turns survived in combat, permanently gain +7.5% to all stats for the rest of the encounter. Also, gain +5 HP and +5 DEF per turn. The longer the fight, the more overwhelming you become.',
    passive: [],
    heavenly: {
      name: 'Hunted',
      desc: 'Every 3 turns survived in combat, permanently gain +7.5% to all stats for the rest of the encounter. Also, gain +5 HP and +5 DEF per turn. The longer the fight, the more overwhelming you become.',
      passive: []
    },
    hellforged: {
      name: 'Hunter',
      desc: 'While actively in combat, gain +75 ATK. Each attack increases this gain by +5. If you spend a full round without attacking, lose 5% current HP.',
      passive: []
    },
    situational: [
      { id: 'hh-hunted3', label: 'HEAVENLY: After 3 turns (+7.5% all stats, +15 HP/DEF)', passive: [{ stat: 'all_main', op: 'pct', value: 7.5 }, { stat: 'hp', op: 'add', value: 15 }, { stat: 'def', op: 'add', value: 15 }] },
      { id: 'hh-hunted6', label: 'HEAVENLY: After 6 turns (+15% all stats, +30 HP/DEF)', passive: [{ stat: 'all_main', op: 'pct', value: 15 }, { stat: 'hp', op: 'add', value: 30 }, { stat: 'def', op: 'add', value: 30 }] },
      { id: 'hh-hunted10', label: 'HEAVENLY: After 10 turns (+25% all stats, +50 HP/DEF)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }, { stat: 'hp', op: 'add', value: 50 }, { stat: 'def', op: 'add', value: 50 }] },
      { id: 'hh-hunter', label: 'HELLFORGED: While attacking (+75 ATK)', passive: [{ stat: 'atk', op: 'add', value: 75 }] },
      { id: 'hh-hunter3', label: 'HELLFORGED: While attacking, 3 attacks (+90 ATK)', passive: [{ stat: 'atk', op: 'add', value: 90 }] },
      { id: 'hh-hunter5', label: 'HELLFORGED: While attacking, 5 attacks (+100 ATK)', passive: [{ stat: 'atk', op: 'add', value: 100 }] },
      { id: 'hh-hunter10', label: 'HELLFORGED: While attacking, 10 attacks (+125 ATK)', passive: [{ stat: 'atk', op: 'add', value: 125 }] }
    ],
  },

  daybreaknight: {
    name: 'Daybreak / Nightfall', rarity: 'duality',
    desc: 'Skills deal x5 damage in the first half of combat. ATK gradually fades as time passes.',
    passive: [],
    heavenly: {
      name: 'Daybreak',
      desc: 'Skills x5 damage in the first half of combat. ATK gradually fades as time passes.',
      passive: []
    },
    hellforged: {
      name: 'Nightfall',
      desc: 'Start weakened. Every 3 turns of combat, permanently gain x2.5 to all damage. Gets increasingly stronger.',
      passive: []
    },
    situational: [{ id: 'dn-day', label: 'HEAVENLY: Early combat', passive: [{ stat: 'atk', op: 'pct', value: 500 }] }, { id: 'dn-night3', label: 'HELLFORGED: After 6 turns', passive: [{ stat: 'atk', op: 'pct', value: 500 }] }, { id: 'dn-night9', label: 'HELLFORGED: After 9 turns (+30% all damage)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }],
  },

  // ============ LOL-INSPIRED: SUPPORT / UTILITY ============
  moonstonemending: {
    name: 'Moonstone Mending', rarity: 'rare',
    desc: 'Passively heals the most-injured ally for 5% max HP whenever any ally takes damage. Can trigger once per turn.',
    passive: [],
  },

  eyeofthestorm: {
    name: 'Eye of the Storm', rarity: 'rare',
    desc: 'Shield one ally for 50% of your max HP. While the shield holds, they gain +50% ATK.',
    passive: [],
  },

  warmhugs: {
    name: 'Warm Hugs', rarity: 'rare',
    desc: 'At the start of each turn, the ally with the lowest HP% receives a small shield worth 8% of their max HP.',
    passive: [],
  },

  ardentcenser: {
    name: 'Ardent Censer', rarity: 'rare',
    desc: 'Whenever you heal or shield an ally, they gain +20% ATK and +15% SPD for 2 turns.',
    passive: [],
    situational: [{ id: 'ac-active', label: 'Ally buffed by Ardent Censer (+20% ATK, +15% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'spd', op: 'pct', value: 15 }] }],
  },

  pixswatch: {
    name: "Pix's Watch", rarity: 'rare',
    desc: 'Shield one ally. Your companion Pix follows them, dealing minor magic damage (3% MAG) to every enemy that hits them.',
    passive: [],
  },

  rewind: {
    name: 'Rewind', rarity: 'rare',
    desc: 'Every 6 turns, revert back 1 turn and gain an extra turn.',
    passive: [],
  },

  timewarp: {
    name: 'Time Warp', rarity: 'rare',
    desc: 'Grant one ally +50% SPD for 2 turns, OR slow one enemy by 50% SPD for 2 turns. Choose each use.',
    passive: [],
  },

  tidecallersblessing: {
    name: "Tidecaller's Blessing", rarity: 'rare',
    desc: 'Empower one ally: their next 3 attacks each slow the target by 25% SPD and deal bonus magic damage (+15% MAG).',
    passive: [],
  },

  focusedresolve: {
    name: 'Focused Resolve', rarity: 'rare',
    desc: 'Tether to one enemy for 2 turns. They cannot flee. If the tether holds the full duration: root them for 1 turn and heal yourself for 20% HP.',
    passive: [],
  },

  mikaelscleanse: {
    name: "Mikael's Cleanse", rarity: 'rare',
    desc: 'Once per battle: remove all crowd control and status effects from one ally and heal them for 20% HP.',
    passive: [],
  },

  zekesconvergence: {
    name: "Zeke's Convergence", rarity: 'rare',
    desc: 'Bind to one ally. Enemies who attack them are slowed 30% SPD and take +15% increased damage from all sources.',
    passive: [],
  },

  whimsy: {
    name: 'Whimsy', rarity: 'epic',
    desc: 'Choose a mode before battle.\n\nPOLYMORPH: Transform one enemy into a harmless critter for 1 turn; they cannot act.\nEMPOWER: Grant one ally +50% SPD and +25% ATK for 2 turns.',
    passive: [],
  },

  powerchord: {
    name: 'Power Chord', rarity: 'epic',
    desc: 'Every 3rd ability activates a rotating Power Chord:\n♪ Hymn: +25% ATK to all allies for 2 turns.\n♪ Aria: Heal the most-hurt ally for 20% HP.\n♪ Celerity: +30% SPD to all allies for 1 turn.\nCycles endlessly.',
    passive: [],
  },

  starcall: {
    name: 'Starcall', rarity: 'epic',
    desc: 'Passively heal all allies for 5% max HP each turn. If any enemy is silenced, this healing doubles to 10% HP.',
    passive: [],
  },

  cozycampfire: {
    name: 'Cozy Campfire', rarity: 'epic',
    desc: 'Deploy a healing zone for 3 turns. Allies inside heal 8% HP per turn and gain +10% to all healing received.',
    passive: [],
  },

  mantra: {
    name: 'Mantra', rarity: 'epic',
    desc: 'Every 3rd ability you cast is empowered, doubling its effect: shields are larger, heals restore more, and debuffs last an extra turn.',
    passive: [],
  },

  equinox: {
    name: 'Equinox', rarity: 'epic',
    desc: 'Create a zone of silence for 1 round. Enemies inside cannot use abilities.',
    passive: [],
  },

  wildgrowth: {
    name: 'Wild Growth', rarity: 'legendary',
    desc: 'Once per battle: instantly enlarge one ally. They gain +350 HP, knock back all nearby enemies, and gain +50% ATK for 2 rounds.',
    passive: [],
  },

  wish: {
    name: 'Wish', rarity: 'legendary',
    desc: 'Once per battle: heal ALL allies for 80% max HP and remove one debuff from each.',
    passive: [],
  },

  crescendo: {
    name: 'Crescendo', rarity: 'legendary',
    desc: 'Once per battle: stun all enemies for 1 round and restore 25% HP to all allies simultaneously.',
    passive: [],
  },

  monsoon: {
    name: 'Monsoon', rarity: 'legendary',
    desc: 'Once per battle: knock back all enemies and heal all allies for 25% HP per turn for 3 turns.',
    passive: [],
  },

  bailout: {
    name: 'Bailout', rarity: 'legendary',
    desc: 'Once per battle: grant an ally a second chance. If they die within the next 3 turns, they revive at 50% HP and go berserk (+125% ATK) for 2 turns before collapsing.',
    passive: [],
  },

  hostiletakeover: {
    name: 'Hostile Takeover', rarity: 'legendary',
    desc: 'Once per battle: one enemy goes berserk for 2 rounds, forced to attack their own allies instead of yours.',
    passive: [],
  },

  tidalwave: {
    name: 'Tidal Wave', rarity: 'legendary',
    desc: 'Once per battle: knock up all enemies for 1 turn. Upon landing, they are slowed by 60% SPD and lose 50% DEX for 2 rounds.',
    passive: [],
  },

  chronoshift: {
    name: 'Chronoshift', rarity: 'mythic',
    desc: 'When any ally (including yourself) would die, they instead survive at 50% HP and become invulnerable for 2 turns. This effect can trigger once per ally per battle. Every member of your team gets one second chance.',
    passive: [],
  },

  cosmicradiance: {
    name: 'Cosmic Radiance', rarity: 'mythic',
    desc: 'Once per battle: after a 1-turn channel, all allies become fully invulnerable for 2 rounds. They cannot be hurt, debuffed, or displaced.',
    passive: [],
  },

  temperedfate: {
    name: 'Tempered Fate', rarity: 'mythic',
    desc: 'Once per battle: freeze every unit except yourself in stasis for 4 turns. Allies and enemies alike cannot act or take damage. Only you may move and act freely.',
    passive: [],
  },

  attached: {
    name: 'Attached', rarity: 'mythic',
    desc: 'At battle start, tether to the nearest ally. While attached: you cannot be targeted, and you passively grant them 75% of all your stats as bonus stats. You may still act and use abilities freely.\n\nIf your tether ally dies, you detach. Your DEF drops by 50% for 2 turns while you are vulnerable.',
    passive: [],
    situational: [{ id: 'att-vulnerable', label: 'Detached / Vulnerable (-50% DEF)', passive: [{ stat: 'def', op: 'pct', value: -50 }] }],
  },

  // ============ SPECIAL ============
  girlyopscurse: {
    name: "Girlypop's Curse", rarity: 'legendary',
    desc: "MAG is doubled (x2). Upon receiving this curse, gain 2 random common traits and 1 random rare trait. Those bonus traits each have a 25% chance of being shimmyful. Your character's gender is permanently reversed.",
    passive: [{ stat: 'mag', op: 'mul', value: 2 }],
    notes: "On pickup: roll 2 commons + 1 rare, each with 25% shimmy chance. Gender reversal is a permanent RP/flavor mechanic.",
  },

  // ============ COMPLEX TRAITS ============
  gamblersruin: {
    name: "Gambler's Ruin", rarity: 'rare',
    desc: 'Before each action, secretly roll a die. On an even result: +50% ATK and MAG for that action. On an odd result: +50% damage taken for that action.',
    passive: [],
    situational: [{ id: 'gr-lucky', label: 'Lucky Roll (even) — +50% ATK & MAG', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }, { id: 'gr-unlucky', label: 'Unlucky Roll (odd) — +50% damage taken (−50% DEF)', passive: [{ stat: 'def', op: 'pct', value: -50 }] }],
  },

  envy: {
    name: 'Envy', rarity: 'epic',
    desc: 'Track the last stat buff any enemy used. You gain an identical bonus until they use a different one.',
    passive: [],
    notes: 'Mirrors the last stat buff used by any enemy. The copied bonus exactly matches their buff value and persists until they use a different one. Track manually.',
  },

  deadmanshand: {
    name: "Dead Man's Hand", rarity: 'legendary',
    desc: 'Start each battle with 5 cards (random stat modifiers, positive and negative). Reveal one per turn in order.',
    passive: [],
    notes: 'At battle start, draw 5 cards. Each is a random stat modifier (positive or negative). Reveal one per turn in the order drawn.',
  },

  symbiote: {
    name: 'Symbiote', rarity: 'legendary',
    desc: 'Bond with one ally at battle start. You both gain +30% HP and share a single HP pool. Any healing or damage either of you takes applies to the shared pool.',
    passive: [{ stat: 'hp', op: 'pct', value: 30 }],
    notes: 'Shared HP pool is RP-tracked. Both characters gain +30% HP at battle start.',
  },

  ouroboros: {
    name: 'Ouroboros', rarity: 'epic',
    desc: 'On death, fully revive at 100% HP. Your ATK and DEF swap values. Your MAG and SPD swap values. This inverted state lasts for the rest of the battle.',
    passive: [],
    situational: [{ id: 'ouro-phase', label: 'Ouroboros Phase (revived — ATK/DEF and MAG/SPD swapped)', passive: [] }],
    notes: 'On death: revive at 100% HP, ATK swaps with DEF, MAG swaps with SPD. Swap is permanent for that battle.',
  },

  // ============ TBOI-INSPIRED ============
  oddmushroom: {
    name: 'Odd Mushroom', rarity: 'common',
    desc: '+35% ATK but -15% SPD. You hit harder but move slower.',
    passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'spd', op: 'pct', value: -15 }],
  },

  spoonbender: {
    name: 'Spoon Bender', rarity: 'common',
    desc: 'Attacks home toward the enemy. +10% MAG and +15 Dexterity.',
    passive: [{ stat: 'mag', op: 'pct', value: 10 }, { stat: 'dexterity', op: 'add', value: 15 }],
  },

  bloodylust: {
    name: 'Bloody Lust', rarity: 'rare',
    desc: 'Each hit you land permanently stacks +5 ATK for the rest of that battle. Resets on a new battle.',
    passive: [],
    situational: [{ id: 'bl-5', label: '5 hits landed (+25 ATK)', passive: [{ stat: 'atk', op: 'add', value: 25 }] }, { id: 'bl-10', label: '10 hits landed (+50 ATK)', passive: [{ stat: 'atk', op: 'add', value: 50 }] }, { id: 'bl-20', label: '20 hits landed (+100 ATK)', passive: [{ stat: 'atk', op: 'add', value: 100 }] }],
  },

  holymantle: {
    name: 'Holy Mantle', rarity: 'rare',
    desc: 'Once per battle, the first hit that would damage you is completely nullified.',
    passive: [],
    situational: [{ id: 'hm-active', label: 'Holy Mantle active (shield up)', passive: [] }, { id: 'hm-broken', label: 'Holy Mantle consumed (shield gone)', passive: [] }],
  },

  whoreofbabylon: {
    name: 'Whore of Babylon', rarity: 'epic',
    desc: 'When below 33% HP: automatically gain +50% ATK, +40% SPD, and -30% DEF. Activates and deactivates based on your HP.',
    passive: [],
    situational: [{ id: 'wob-active', label: 'Whore of Babylon active (below 33% HP)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: -30 }] }],
  },

  missingno: {
    name: 'Missing No.', rarity: 'epic',
    desc: 'At the start of each battle, all your stats are independently randomized between x0.5 and x3 of their base values. Your total power is unpredictable.',
    passive: [],
    notes: 'Each main stat (HP, ATK, DEF, MAG, SPD) is independently rolled between 0.5x and 3x base value at battle start. Reroll every battle.',
  },

  goathead: {
    name: 'Goat Head', rarity: 'legendary',
    desc: 'At battle start: sacrifice 33% of your max HP to access a Devil Deal. Choose one revealed legendary or mythic trait that applies for this fight only.',
    passive: [],
    notes: 'Devil Deal: -33% HP to borrow one legendary or mythic trait for that battle. The borrowed trait is lost at battle end.',
  },

  sacredheart: {
    name: 'Sacred Heart', rarity: 'mythic',
    desc: '+200% ATK and MAG. +50% HP. +35 Heal Power. All your attacks home and pierce through enemies.',
    passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'mag', op: 'pct', value: 200 }, { stat: 'hp', op: 'pct', value: 50 }, { stat: 'heal_pow', op: 'add', value: 35 }],
  },

  // ============ GAMBLING TRAITS ============
  luckypenny: {
    name: 'Lucky Penny', rarity: 'common',
    desc: 'Start each battle with a coin flip. Heads: +15% to all main stats. Tails: -10% to all main stats.',
    passive: [],
    situational: [{ id: 'lp-heads', label: 'Heads — +15% all main stats', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'lp-tails', label: 'Tails — -10% all main stats', passive: [{ stat: 'all_main', op: 'pct', value: -10 }] }],
    notes: 'Flip a coin at battle start. Toggle the matching button.',
  },

  bust: {
    name: 'Bust', rarity: 'rare',
    desc: 'Every time you hit, roll a d6. On a 1: your ATK drops to 0 for that turn. On a 6: deal the hit twice.',
    passive: [],
    situational: [{ id: 'bust-1', label: 'Rolled a 1 — ATK is 0 this turn', passive: [{ stat: 'atk', op: 'mul', value: 0 }] }],
    notes: 'Roll d6 on each hit. 1 = ATK zeroed for 1 turn. 6 = hit twice. Toggle when you roll a 1, untoggle next turn.',
  },

  snakeeyes: {
    name: 'Snake Eyes', rarity: 'rare',
    desc: '+30% ATK. Each attack, roll a d6. Rolling a 1 triggers a fumble: you miss and take 5% max HP damage.',
    passive: [{ stat: 'atk', op: 'pct', value: 30 }],
    notes: 'Roll d6 on each attack. 1 = fumble (miss + 5% max HP self-damage). +30% ATK always active.',
  },

  jackpot: {
    name: 'Jackpot', rarity: 'epic',
    desc: 'On kill: roll 1d3. 1 = +20 ATK permanently. 2 = +20 DEF permanently. 3 = restore 30% HP.',
    passive: [],
    situational: [{ id: 'jp-atk1', label: '1x rolled 1 — +20 ATK', passive: [{ stat: 'atk', op: 'add', value: 20 }] }, { id: 'jp-atk2', label: '2x rolled 1 — +40 ATK', passive: [{ stat: 'atk', op: 'add', value: 40 }] }, { id: 'jp-atk3', label: '3x rolled 1 — +60 ATK', passive: [{ stat: 'atk', op: 'add', value: 60 }] }, { id: 'jp-def1', label: '1x rolled 2 — +20 DEF', passive: [{ stat: 'def', op: 'add', value: 20 }] }, { id: 'jp-def2', label: '2x rolled 2 — +40 DEF', passive: [{ stat: 'def', op: 'add', value: 40 }] }, { id: 'jp-def3', label: '3x rolled 2 — +60 DEF', passive: [{ stat: 'def', op: 'add', value: 60 }] }],
    notes: 'On kill, roll 1d3. Toggle the closest stack count for accumulated ATK/DEF rolls. Roll 3 = 30% HP restore (no button).',
  },

  devilsbargain: {
    name: "Devil's Bargain", rarity: 'legendary',
    desc: 'Triple your ATK and MAG (x3). At the end of each battle, one random stat (not ATK or MAG) is permanently cut by 10%.',
    passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }],
    notes: 'After each battle: one of HP/DEF/SPD/etc. is cut by -10% permanently. Track manually.',
  },

  russianroulette: {
    name: 'Russian Roulette', rarity: 'legendary',
    desc: 'All your main stats are +85%. At the start of each turn, there is a 1-in-6 chance you take 50% of your max HP as true damage.',
    passive: [{ stat: 'all_main', op: 'pct', value: 85 }],
    notes: 'Start of each turn: roll d6. On a 1, take 50% max HP as true damage. +85% all main stats is always active.',
  },

  // ============ STORY / THEMATIC TRAITS ============
  // MYTHIC
  thousanddoors: {
    name: 'A Thousand Doors, A Thousand Questions', rarity: 'mythic',
    desc: 'For every encounter, permanently increase or decrease a random stat by a random multiplier between x0.75 and x1.75. Effects compound and never reset.',
    passive: [],
    notes: 'Click ROLL ENCOUNTER after each fight. Results are permanent and compound.',
  },

  anotherandanother: {
    name: 'Another, and another.', rarity: 'mythic',
    desc: 'Every hit you deal or receive counts as a drink. ATK and MAG are fully randomized (biased toward lower values, max ~1000) each time you hit. DEF and HP are fully randomized each time you get hit. At 15 drinks: -50% SPD, -50% DEX, +100% Crit Chance, +30% Resilience.',
    passive: [],
    situational: [{ id: 'aaa-15', label: '15 drinks (max) — -50% SPD, -50% DEX, +100% Crit, +30% Resil', passive: [{ stat: 'spd', op: 'pct', value: -50 }, { stat: 'dexterity', op: 'pct', value: -50 }, { stat: 'crit_rate', op: 'pct', value: 100 }, { stat: 'resilience', op: 'pct', value: 30 }] }],
    notes: 'Use the REROLL buttons to randomize stats on hit or when hit.',
  },

  lovesick: {
    name: 'LOVESICK', rarity: 'mythic',
    desc: 'If you have a lover or partner, all healing toward them is multiplied by x50. You can no longer heal anyone else, including yourself.',
    passive: [],
    notes: 'x50 healing to designated partner only. Cannot heal self or any other ally.',
  },

  godslayer: {
    name: 'God Slayer', rarity: 'mythic',
    desc: 'If fighting an enemy stronger than you, copy their 3 highest stats and add those values to your own matching stats for the fight.',
    passive: [],
    notes: 'When facing a stronger enemy: manually add their 3 highest stat values to your base stats for that fight.',
  },

  sentafteryou: {
    name: 'If they sent me after you, then you must be forsaken.', rarity: 'mythic',
    desc: 'In a 1v1, the enemy\'s stats are permanently decreased by 75% for the duration of the fight.',
    passive: [],
    situational: [{ id: 'say-1v1', label: '1v1 active (enemy -75% all stats)', passive: [] }],
    notes: 'RP: in a 1v1, opponent suffers -75% all stats. No self stat impact.',
  },

  steelwillfix: {
    name: 'Steel will fix all your flaws.', rarity: 'mythic',
    desc: 'Become metallic. x3 DEF, ATK and MAG. You can replace any character\'s current trait with this one. Gain x1.25 all stats per metallic alive. Upon creating 7 metallics, use the EVOLVE button to upgrade to the hexxed form.',
    passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'def', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }],
    situational: [{ id: 'swf-1m', label: '1 metallic alive (x1.25 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }, { id: 'swf-2m', label: '2 metallics (x1.56 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 56 }] }, { id: 'swf-3m', label: '3 metallics (x1.95 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 95 }] }, { id: 'swf-4m', label: '4 metallics (x2.44 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 144 }] }, { id: 'swf-5m', label: '5 metallics (x3.05 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 205 }] }, { id: 'swf-6m', label: '6 metallics (x3.81 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 281 }] }],
  },

  replaceallemotions: {
    name: 'Replace all your petty emotions.', rarity: 'hexxed',
    desc: 'Evolved metallic form. x5 DEF, ATK and MAG. Gain the ability to turn anyone metallic. Gain x2 all stats per metallic alive.',
    passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }],
    situational: [{ id: 'rae-1m', label: '1 metallic alive (x2 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 100 }] }, { id: 'rae-2m', label: '2 metallics (x4 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 300 }] }, { id: 'rae-3m', label: '3 metallics (x8 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 700 }] }, { id: 'rae-4m', label: '4 metallics (x16 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 1500 }] }, { id: 'rae-5m', label: '5 metallics (x32 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 3100 }] }, { id: 'rae-6m', label: '6 metallics (x64 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 6300 }] }, { id: 'rae-7m', label: '7 metallics (x128 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 12700 }] }],
  },

  letthestage: {
    name: 'Let the stage see who\'s greater!', rarity: 'mythic',
    desc: 'In a 1v1, both you and the enemy\'s stats are multiplied by x5. The winner permanently absorbs the loser\'s stats after the fight.',
    passive: [],
    situational: [{ id: 'lts-1v1', label: '1v1 active (x5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }],
  },

  wontexist: {
    name: 'You won\'t exist anymore!', rarity: 'mythic',
    desc: 'Defeated enemies are permanently erased from existence. You gain dormant erasure powers.',
    passive: [],
    notes: 'RP mechanic. Defeated enemies cease to exist. Erasure abilities are DM-determined.',
  },

  iamgonnawin: {
    name: 'I\'m gonna win.', rarity: 'mythic',
    desc: 'Upon receiving an attack that would knock you out, instead heal to 100% HP and drain all stats from your party members to yourself.',
    passive: [],
    notes: 'One-time per fight: survive a lethal hit at 100% HP and absorb all ally stats.',
  },

  unbroken: {
    name: 'Unbroken', rarity: 'legendary',
    desc: 'You cannot take physical damage. Magical, true, and status damage still apply.',
    passive: [],
    notes: 'Physical damage immunity only.',
  },

  themoss: {
    name: 'The Moss', rarity: 'mythic',
    desc: 'On-hit, apply MOSS to enemies. Affected enemies are slowly consumed, losing -5% HP and -10% DEF per turn. MOSS is only removed by water.',
    passive: [],
    notes: 'MOSS: -5% HP and -10% DEF per turn. Removed only by water. Stacks on each hit.',
  },

  harbingerruin: {
    name: 'Harbinger of Ruin', rarity: 'mythic',
    desc: 'When hit, the attacker permanently loses 5% all non-HP stats. On-hit, apply RUIN: target loses 3% all non-HP stats per turn for 2 rounds (stacks up to 5). Upon defeating an enemy, they permanently lose 5% all stats.',
    passive: [],
    notes: 'Hit-reaction: permanent -5% all non-HP stats on attacker. RUIN: 3% per turn for 2 rounds, 5 stacks max.',
  },

  revived: {
    name: 'REVIVED', rarity: 'mythic',
    desc: 'Once per campaign: upon fully dying, revive at 100% HP and permanently gain x2 all stats. After reviving, gain one random legendary trait.',
    passive: [],
    situational: [{ id: 'rev-active', label: 'REVIVED (x2 all stats, permanent)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }],
    notes: 'One-time per campaign. On death: 100% HP + x2 all stats permanently + random legendary trait.',
  },

  // DUALITY
  redemptionretribution: {
    name: 'Redemption / Retribution', rarity: 'duality',
    desc: 'HEAVENLY (Redemption): for every enemy spared, gain +10% Heal Power and +10% MAG. HELLFORGED (Retribution): for every enemy killed, gain +10% ATK and +10% Crit Damage.',
    passive: [],
    heavenly: { name: 'Redemption', desc: 'For every enemy spared, gain +10% Heal Power and +10% MAG.', passive: [] },
    hellforged: { name: 'Retribution', desc: 'For every enemy killed, gain +10% ATK and +10% Crit Damage.', passive: [] },
    situational: [{ id: 'rdr-spa1', label: 'HEAVENLY: 1 enemy spared (+10% Heal, +10% MAG)', passive: [{ stat: 'heal_pow', op: 'add', value: 10 }, { stat: 'mag', op: 'pct', value: 10 }] }, { id: 'rdr-spa3', label: 'HEAVENLY: 3 enemies spared (+30% Heal, +30% MAG)', passive: [{ stat: 'heal_pow', op: 'add', value: 30 }, { stat: 'mag', op: 'pct', value: 30 }] }, { id: 'rdr-spa5', label: 'HEAVENLY: 5 enemies spared (+50% Heal, +50% MAG)', passive: [{ stat: 'heal_pow', op: 'add', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }, { id: 'rdr-spa10', label: 'HEAVENLY: 10 enemies spared (+100% Heal, +100% MAG)', passive: [{ stat: 'heal_pow', op: 'add', value: 100 }, { stat: 'mag', op: 'pct', value: 100 }] }, { id: 'rdr-kll1', label: 'HELLFORGED: 1 enemy killed (+10% ATK, +10% Crit DMG)', passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'crit_dmg', op: 'pct', value: 10 }] }, { id: 'rdr-kll3', label: 'HELLFORGED: 3 enemies killed (+30% ATK, +30% Crit DMG)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'crit_dmg', op: 'pct', value: 30 }] }, { id: 'rdr-kll5', label: 'HELLFORGED: 5 enemies killed (+50% ATK, +50% Crit DMG)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'crit_dmg', op: 'pct', value: 50 }] }, { id: 'rdr-kll10', label: 'HELLFORGED: 10 enemies killed (+100% ATK, +100% Crit DMG)', passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'crit_dmg', op: 'pct', value: 100 }] }],
  },

  warandglory: {
    name: 'War and Glory / Bold, Precise', rarity: 'duality',
    desc: 'HELLFORGED (War and Glory, Reinvention): 1 ATK = 1 True Damage, 1 True Damage = 1 Lifesteal, 1 Lifesteal = 1 Heal Power. HEAVENLY (Bold, Precise, Experimental): 1 DEF = +1 ATK, 2 ATK = +1 Resilience.',
    passive: [],
    heavenly: { name: 'Bold, Precise, Experimental', desc: '1 DEF = +1 ATK. 2 ATK = +1 Resilience.', passive: [{ op: 'derived', stat: 'atk', from: 'def', per: 1, perValue: 1 }, { op: 'derived', stat: 'resilience', from: 'atk', per: 2, perValue: 1 }] },
    hellforged: { name: 'War and Glory, Reinvention', desc: '1 ATK = 1 True Damage. 1 True Damage = 1 Lifesteal. 1 Lifesteal = 1 Heal Power.', passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 1, perValue: 1 }, { op: 'derived', stat: 'lifesteal', from: 'true_dmg', per: 1, perValue: 1 }, { op: 'derived', stat: 'heal_pow', from: 'lifesteal', per: 1, perValue: 1 }] },
    situational: [],
  },

  // LEGENDARY
  emotionless: {
    name: 'Emotionless', rarity: 'legendary',
    desc: 'Your character loses the capability of having emotions, but all substats are doubled (x2).',
    passive: [{ stat: 'heal_pow', op: 'pct', value: 100 }, { stat: 'crit_rate', op: 'pct', value: 100 }, { stat: 'crit_dmg', op: 'pct', value: 100 }, { stat: 'status_res', op: 'pct', value: 100 }, { stat: 'dexterity', op: 'pct', value: 100 }, { stat: 'resilience', op: 'pct', value: 100 }, { stat: 'true_dmg', op: 'pct', value: 100 }, { stat: 'lifesteal', op: 'pct', value: 100 }, { stat: 'cooldown_red', op: 'pct', value: 100 }],
  },

  reinforcecrew: {
    name: 'What better time to reinforce our crew?', rarity: 'legendary',
    desc: 'When any ally drops to 50% HP, everyone in the party gains +50% DEF and an extra turn for one round.',
    passive: [],
    situational: [{ id: 'rc-trigger', label: 'Ally at 50% HP triggered (+50% DEF, extra turn)', passive: [{ stat: 'def', op: 'pct', value: 50 }] }],
    notes: 'Toggle when triggered. Untoggle after the round ends.',
  },

  goodluckboys: {
    name: 'Good luck out there, boys', rarity: 'legendary',
    desc: 'When you drop below 50% HP, leave the fight. In return, the rest of your party has their turn count doubled for the remainder of the battle.',
    passive: [],
    notes: 'RP: below 50% HP, exit combat. Party receives doubled turns.',
  },

  holywar: {
    name: 'Holy War', rarity: 'legendary',
    desc: 'Triple your party\'s turn count when fighting a spirit. Double them when fighting someone significantly stronger than you.',
    passive: [],
    situational: [{ id: 'hw-spirit', label: 'Fighting a spirit (party x3 turns)', passive: [] }, { id: 'hw-stronger', label: 'Fighting someone way stronger (party x2 turns)', passive: [] }],
    notes: 'RP: multiplied party turns. No self stat impact.',
  },

  wegotthenumbers: {
    name: 'We got the numbers!', rarity: 'legendary',
    desc: 'If your party outnumbers the enemies, all your substats are tripled. If outnumbered, all substats drop by 50%.',
    passive: [],
    situational: [{ id: 'wgn-more', label: 'Outnumbering enemies (substats x3)', passive: [{ stat: 'heal_pow', op: 'pct', value: 200 }, { stat: 'crit_rate', op: 'pct', value: 200 }, { stat: 'crit_dmg', op: 'pct', value: 200 }, { stat: 'status_res', op: 'pct', value: 200 }, { stat: 'dexterity', op: 'pct', value: 200 }, { stat: 'resilience', op: 'pct', value: 200 }, { stat: 'true_dmg', op: 'pct', value: 200 }, { stat: 'lifesteal', op: 'pct', value: 200 }, { stat: 'cooldown_red', op: 'pct', value: 200 }] }, { id: 'wgn-less', label: 'Outnumbered by enemies (substats -50%)', passive: [{ stat: 'heal_pow', op: 'pct', value: -50 }, { stat: 'crit_rate', op: 'pct', value: -50 }, { stat: 'crit_dmg', op: 'pct', value: -50 }, { stat: 'status_res', op: 'pct', value: -50 }, { stat: 'dexterity', op: 'pct', value: -50 }, { stat: 'resilience', op: 'pct', value: -50 }, { stat: 'true_dmg', op: 'pct', value: -50 }, { stat: 'lifesteal', op: 'pct', value: -50 }, { stat: 'cooldown_red', op: 'pct', value: -50 }] }],
  },

  hailname: {
    name: 'Hail [NAME]', rarity: 'legendary',
    desc: 'Every time you defeat an enemy, you can recruit them by brainwashing them. Recruited characters fight for you but are permanently gone if defeated. [NAME] is replaced by your character\'s name.',
    passive: [],
    notes: 'RP mechanic. Recruited enemies fight for you. Lost forever on defeat.',
  },

  onlyatraitor: {
    name: 'Only a Traitor could consider making Peace', rarity: 'legendary',
    desc: 'You can no longer spare anyone. You may only kill. Upon receiving this trait, immediately roll 2 random extra legendary traits.',
    passive: [],
    notes: 'On pickup: auto-grants 2 random legendary traits. No sparing allowed (RP restriction).',
  },

  partypooper: {
    name: 'Party Pooper', rarity: 'legendary',
    desc: 'On-hit, apply FRACTURED to enemies. FRACTURED nullifies all healing and does not expire until battle ends. Gain +10% Lifesteal and +10% Crit Chance per Fractured enemy on the field.',
    passive: [],
    situational: [{ id: 'pp-1', label: '1 Fractured enemy (+10% Lifesteal, +10% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 10 }, { stat: 'crit_rate', op: 'add', value: 10 }] }, { id: 'pp-2', label: '2 Fractured enemies (+20% Lifesteal, +20% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 20 }, { stat: 'crit_rate', op: 'add', value: 20 }] }, { id: 'pp-3', label: '3 Fractured enemies (+30% Lifesteal, +30% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 30 }, { stat: 'crit_rate', op: 'add', value: 30 }] }, { id: 'pp-4', label: '4+ Fractured enemies (+40% Lifesteal, +40% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 40 }, { stat: 'crit_rate', op: 'add', value: 40 }] }],
  },

  turningpoint: {
    name: 'Turning Point', rarity: 'legendary',
    desc: 'When dropping below 40% HP, gain x10 SPD and x10 DEX. This decreases by 20% each round (minimum x0.25). Gain an extra turn while the multiplier is above x4.',
    passive: [],
    situational: [{ id: 'tp-t1', label: 'Turn 1: x10 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 10 }, { stat: 'dexterity', op: 'mul', value: 10 }] }, { id: 'tp-t2', label: 'Turn 2: x8 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 8 }, { stat: 'dexterity', op: 'mul', value: 8 }] }, { id: 'tp-t3', label: 'Turn 3: x6.4 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 6.4 }, { stat: 'dexterity', op: 'mul', value: 6.4 }] }, { id: 'tp-t4', label: 'Turn 4: x5.1 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 5.1 }, { stat: 'dexterity', op: 'mul', value: 5.1 }] }, { id: 'tp-t5', label: 'Turn 5: x4.1 SPD and DEX', passive: [{ stat: 'spd', op: 'mul', value: 4.1 }, { stat: 'dexterity', op: 'mul', value: 4.1 }] }, { id: 'tp-fade', label: 'Faded (x0.25 SPD and DEX floor)', passive: [{ stat: 'spd', op: 'mul', value: 0.25 }, { stat: 'dexterity', op: 'mul', value: 0.25 }] }],
  },

  keepup: {
    name: 'KEEP UP', rarity: 'legendary',
    desc: 'Start with x2 SPD and x2 DEX. Every turn your SPD and DEX increase by x1.5. Enemies\' SPD and DEX increase by x1.4 (your party is unaffected). +1 ATK per 20 SPD, +1 MAG per 5 DEX.',
    passive: [{ op: 'derived', stat: 'atk', from: 'spd', per: 20, perValue: 1 }, { op: 'derived', stat: 'mag', from: 'dexterity', per: 5, perValue: 1 }],
    situational: [{ id: 'ku-t1', label: 'Turn 1 (x2 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 2 }, { stat: 'dexterity', op: 'mul', value: 2 }] }, { id: 'ku-t2', label: 'Turn 2 (x3 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 3 }, { stat: 'dexterity', op: 'mul', value: 3 }] }, { id: 'ku-t3', label: 'Turn 3 (x4.5 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 4.5 }, { stat: 'dexterity', op: 'mul', value: 4.5 }] }, { id: 'ku-t4', label: 'Turn 4 (x6.75 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 6.75 }, { stat: 'dexterity', op: 'mul', value: 6.75 }] }, { id: 'ku-t5', label: 'Turn 5 (x10 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 10 }, { stat: 'dexterity', op: 'mul', value: 10 }] }, { id: 'ku-t6', label: 'Turn 6 (x15 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 15 }, { stat: 'dexterity', op: 'mul', value: 15 }] }],
    notes: 'Toggle exactly one turn button at a time. ATK and MAG bonuses from SPD/DEX are derived automatically.',
  },

  wartrivial: {
    name: 'War, What a Trivial thing.', rarity: 'legendary',
    desc: 'Permanently gain +10 to all stats for every fight you leave early.',
    passive: [],
    situational: [{ id: 'wt-1', label: '1 fight left early (+10 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 10 }] }, { id: 'wt-3', label: '3 fights left (+30 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 30 }] }, { id: 'wt-5', label: '5 fights left (+50 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 50 }] }, { id: 'wt-10', label: '10 fights left (+100 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 100 }] }, { id: 'wt-20', label: '20 fights left (+200 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 200 }] }],
  },

  perfectsoul: {
    name: 'I want a perfect soul.', rarity: 'legendary',
    desc: 'Absorb enemies\' souls if they are below 20% HP, gaining a portion of their stats. Each soul absorbed reduces your sanity.',
    passive: [],
    notes: 'Select a character and click ABSORB SOUL to permanently gain 40-80% of their stats.',
  },

  lotuswaters: {
    name: 'Lotus Waters', rarity: 'legendary',
    desc: 'Your water abilities turn pink, or you gain water manipulation. Your water heals allies for +5% HP per turn and damages them for -5% HP per turn while in it. Once per battle: flood the arena for 2 rounds.',
    passive: [],
    notes: 'No shimmyful. Has a Hexxed variant: Lavender Waters.',
  },

  lavenderwaters: {
    name: 'Lavender Waters', rarity: 'hexxed',
    desc: 'Your water abilities turn lavender, or you gain water manipulation. Your water heals allies for +15% HP per turn and damages them for -15% HP per turn while in it. Once per battle: flood the arena for 3 rounds.',
    passive: [],
    notes: 'Hexxed version of Lotus Waters. No shimmyful.',
  },

  reekofdisease: {
    name: 'You reek of disease.', rarity: 'legendary',
    desc: 'If an enemy is below 40% HP, immediately apply 5 stacks of POISON on them, dealing -20% HP per turn until they are defeated.',
    passive: [],
    notes: 'Auto-apply 5 poison stacks to enemies below 40% HP. -20% HP per turn total.',
  },

  megalostrikeback: {
    name: 'Megalo Strike Back', rarity: 'legendary',
    desc: 'If fighting the same enemy for the second time, gain +200% Crit Chance and +200% Crit Damage. Defeating that enemy permanently adds these bonuses to your stats.',
    passive: [],
    situational: [{ id: 'msb-2nd', label: 'Second fight vs this enemy (+200% Crit, +200% Crit DMG)', passive: [{ stat: 'crit_rate', op: 'pct', value: 200 }, { stat: 'crit_dmg', op: 'pct', value: 200 }] }, { id: 'msb-perm', label: 'Enemy defeated (permanent +200% Crit, +200% Crit DMG)', passive: [{ stat: 'crit_rate', op: 'pct', value: 200 }, { stat: 'crit_dmg', op: 'pct', value: 200 }] }],
  },

  engarde: {
    name: 'En garde!', rarity: 'legendary',
    desc: 'Pick one enemy and force them into a separate 1v1 arena. Neither can interact with other units. The arena lasts 3 rounds or until one is knocked out. The winner gains x1.5 ATK and SPD for the rest of the fight.',
    passive: [],
    situational: [{ id: 'eg-arena', label: 'In the arena (1v1 active)', passive: [] }, { id: 'eg-win', label: 'Won the arena (x1.5 ATK and SPD)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] }],
  },

  killingspree: {
    name: 'Killing Spree', rarity: 'legendary',
    desc: 'For every enemy killed this fight, permanently gain +5% SPD and +5% ATK. Losing a fight resets all stacks.',
    passive: [],
    situational: [{ id: 'ks-1', label: '1 kill (+5% SPD, +5% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 5 }, { stat: 'atk', op: 'pct', value: 5 }] }, { id: 'ks-3', label: '3 kills (+15% SPD, +15% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 15 }, { stat: 'atk', op: 'pct', value: 15 }] }, { id: 'ks-5', label: '5 kills (+25% SPD, +25% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 25 }, { stat: 'atk', op: 'pct', value: 25 }] }, { id: 'ks-10', label: '10 kills (+50% SPD, +50% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 50 }, { stat: 'atk', op: 'pct', value: 50 }] }, { id: 'ks-20', label: '20 kills (+100% SPD, +100% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 100 }, { stat: 'atk', op: 'pct', value: 100 }] }],
  },

  armyofshurima: {
    name: 'The army of Shurima never dies', rarity: 'legendary',
    desc: 'At the start of every fight, summon 3 sand soldiers with 70 HP, 50 ATK, 10 DEF, 30 SPD and 30 MAG each.',
    passive: [],
    notes: 'Summons 3 sand soldiers at battle start. They fight alongside and can be targeted.',
  },

  ialwayscomeback: {
    name: 'I always come back', rarity: 'legendary',
    desc: 'Every time you are defeated, permanently gain +25% to all base stats. The battle immediately after being defeated, all attacks deal 100% True Damage.',
    passive: [],
    situational: [{ id: 'iac-true', label: 'Battle after defeat (100% True Damage)', passive: [{ stat: 'true_dmg', op: 'add', value: 100 }] }, { id: 'iac-1', label: '1 defeat (+25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }, { id: 'iac-2', label: '2 defeats (+50% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }, { id: 'iac-3', label: '3 defeats (+75% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 75 }] }, { id: 'iac-5', label: '5 defeats (+125% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 125 }] }],
  },

  thefinalact: {
    name: 'The final act', rarity: 'legendary',
    desc: 'If anyone drops below 5% HP, everyone is healed, all DEF drops to 0, and your ATK and MAG increase by x1.35 per unit currently in the battle.',
    passive: [],
    situational: [{ id: 'tfa-2u', label: 'Triggered, 2 units in battle (x1.82 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 1.82 }, { stat: 'mag', op: 'mul', value: 1.82 }] }, { id: 'tfa-4u', label: 'Triggered, 4 units in battle (x3.32 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 3.32 }, { stat: 'mag', op: 'mul', value: 3.32 }] }, { id: 'tfa-6u', label: 'Triggered, 6 units in battle (x6.05 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 6.05 }, { stat: 'mag', op: 'mul', value: 6.05 }] }, { id: 'tfa-8u', label: 'Triggered, 8 units in battle (x11 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 11 }, { stat: 'mag', op: 'mul', value: 11 }] }],
  },

  truehero: {
    name: 'True Hero', rarity: 'legendary',
    desc: 'The more kills the enemy has, the higher your stats. Gain x1.03 to all main stats for every kill the target has to their name, to a max of 50 kills.',
    passive: [],
    situational: [{ id: 'th-5k', label: 'Enemy has 5 kills', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'th-10k', label: 'Enemy has 10 kills', passive: [{ stat: 'all_main', op: 'pct', value: 30 }] }, { id: 'th-20k', label: 'Enemy has 20 kills', passive: [{ stat: 'all_main', op: 'pct', value: 60 }] }, { id: 'th-50k', label: 'Enemy has 50 kills+ (maxxed)', passive: [{ stat: 'all_main', op: 'pct', value: 650 }] }],
  },

  breakunbreakable: {
    name: 'Break the Unbreakable', rarity: 'legendary',
    desc: 'Ignore all enemy DEF. Deal additional damage proportional to how much DEF the enemy has. The more armored they are, the harder you hit.',
    passive: [],
    notes: 'Enemy DEF completely ignored. Bonus damage = enemy DEF value (RP-adjudicated by DM).',
  },

  itwasutile: {
    name: 'It was Futile', rarity: 'legendary',
    desc: 'If hit by an enemy whose ATK is lower than yours, you take zero damage. The attack simply does not land.',
    passive: [],
    notes: 'Immune to attacks from enemies with lower ATK. RP-adjudicated.',
  },

  absoluteterritory: {
    name: 'Absolute Territory', rarity: 'legendary',
    desc: 'You are forced to wear thigh highs and a miniskirt. In exchange: x3.5 ATK, x3.5 DEF, x3.5 MAG and x3.5 Crit Chance.',
    passive: [{ stat: 'atk', op: 'mul', value: 3.5 }, { stat: 'def', op: 'mul', value: 3.5 }, { stat: 'mag', op: 'mul', value: 3.5 }, { stat: 'crit_rate', op: 'pct', value: 250 }],
  },

  ifeelmonster: {
    name: 'I feel like a Monster', rarity: 'legendary',
    desc: 'You can harm allies. For every ally you attack, gain +50% ATK and +50% MAG. Stacks per ally attacked.',
    passive: [],
    situational: [{ id: 'ifm-1a', label: '1 ally attacked (+50% ATK, +50% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }, { id: 'ifm-2a', label: '2 allies attacked (+100% ATK, +100% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'mag', op: 'pct', value: 100 }] }, { id: 'ifm-3a', label: '3 allies attacked (+150% ATK, +150% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }] }, { id: 'ifm-4a', label: '4+ allies attacked (+200% ATK, +200% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'mag', op: 'pct', value: 200 }] }],
  },

  nothereyou: {
    name: 'I\'m not here for you', rarity: 'legendary',
    desc: 'Choose one ally. You can only heal them and yourself. Every time you heal that ally, gain +50% to all non-HP stats for 1 round.',
    passive: [],
    situational: [{ id: 'nhy-heal', label: 'Just healed chosen ally (+50% ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'def', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] }],
  },

  woetothee: {
    name: 'Woe to Thee', rarity: 'legendary',
    desc: 'Every 2 ATK converts to 1% True Damage, capped at 90%. Upon receiving this trait, immediately roll one random shimmyful legendary trait on top of it.',
    passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 2, perValue: 1, cap: 90 }],
    notes: 'On pickup: auto-grants 1 random shimmyful legendary. True Damage scales with ATK automatically.',
  },

  paralyzer: {
    name: 'Paralyzer', rarity: 'legendary',
    desc: 'On-hit, apply PARALYZED to enemies. Paralyzed enemies skip a turn and lose all SPD and DEX. Gain +5% DEF per Paralyzed enemy on the field.',
    passive: [],
    situational: [{ id: 'par-1', label: '1 Paralyzed enemy (+5% DEF)', passive: [{ stat: 'def', op: 'pct', value: 5 }] }, { id: 'par-2', label: '2 Paralyzed enemies (+10% DEF)', passive: [{ stat: 'def', op: 'pct', value: 10 }] }, { id: 'par-3', label: '3 Paralyzed enemies (+15% DEF)', passive: [{ stat: 'def', op: 'pct', value: 15 }] }, { id: 'par-4', label: '4+ Paralyzed enemies (+20% DEF)', passive: [{ stat: 'def', op: 'pct', value: 20 }] }],
  },

  stillstanding: {
    name: 'Still Standing', rarity: 'legendary',
    desc: 'Upon reaching 25% HP, immediately heal back to 50% HP and gain FOCUS for 3 turns. FOCUS: attacks cannot miss and dodge chance is increased. Kills extend FOCUS with extra turns.',
    passive: [],
    situational: [{ id: 'ss-focus', label: 'FOCUS active (no misses, bonus dodge, 3 turns)', passive: [] }, { id: 'ss-kill', label: 'Kill extended FOCUS (extra turn granted)', passive: [] }],
    notes: 'At 25% HP: auto-heal to 50% + FOCUS. Kills while in FOCUS grant extra turns.',
  },

  willsurvive: {
    name: 'I will Survive!', rarity: 'legendary',
    desc: 'If your life is threatened, you instinctively teleport far away. You can still be knocked out.',
    passive: [],
    notes: 'on life-threatening situations, teleport away. Does not prevent knockouts entirely.',
  },

  banquet: {
    name: 'Banquet', rarity: 'legendary',
    desc: 'Various foods appear on the battlefield, invisible to enemies. You and your allies heal 10% HP per food eaten without wasting a turn, but lose -25% SPD for that turn.',
    passive: [],
    situational: [{ id: 'ban-eating', label: 'Eating food this turn (-25% SPD)', passive: [{ stat: 'spd', op: 'pct', value: -25 }] }],
  },

  raciallymotivated: {
    name: 'Racially Motivated', rarity: 'legendary',
    desc: 'Deal x2 damage to enemies of a different species. Deal x0.5 damage to enemies of the same species.',
    passive: [],
    situational: [{ id: 'rm-diff', label: 'Targeting different species (x2 damage)', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'mag', op: 'mul', value: 2 }] }, { id: 'rm-same', label: 'Targeting same species (x0.5 damage)', passive: [{ stat: 'atk', op: 'mul', value: 0.5 }, { stat: 'mag', op: 'mul', value: 0.5 }] }],
  },

  jolly: {
    name: 'Jolly', rarity: 'legendary',
    desc: 'During Christmas, get x5 all stats.',
    passive: [],
    situational: [{ id: 'jolly-xmas', label: 'It\'s Christmas (x5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }],
  },

  spooky: {
    name: 'Spooky', rarity: 'legendary',
    desc: 'During Halloween, get x5 all stats.',
    passive: [],
    situational: [{ id: 'spooky-hw', label: 'It\'s Halloween (x5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }],
  },

  anarchy: {
    name: 'Anarchy', rarity: 'legendary',
    desc: 'All enemies can hit each other and all allies can hit each other. Hitting a teammate grants them +5% all stats; same with enemies. You accumulate everyone\'s anarchy bonuses.',
    passive: [],
    notes: 'RP: friendly fire enabled. Each friendly-fire hit grants target +5% stats. You gain all such accumulated bonuses.',
  },

  yourearly: {
    name: 'You\'re early', rarity: 'legendary',
    desc: 'Apply BLEEDING, POISON and BURNING to the first enemy who attacks in the battle, lasting 2 rounds.',
    passive: [],
    notes: 'Reactive trigger on the first enemy attack of the battle. All three status effects for 2 rounds.',
  },

  // HEXXED
  killthesun: {
    name: 'Kill The Sun', rarity: 'hexxed',
    desc: 'Deal x50 damage to Spirits.',
    passive: [],
    situational: [{ id: 'kts-spirit', label: 'Fighting a Spirit (x50 ATK and MAG)', passive: [{ stat: 'atk', op: 'mul', value: 50 }, { stat: 'mag', op: 'mul', value: 50 }] }],
  },

  shimmyfuloverlord: {
    name: 'SHIMMYFUL OVERLORD', rarity: 'hexxed',
    desc: 'Upon dropping below 60% HP, push all enemies back and transform into a semi-cosmic being. All attacks become shimmies and apply SHIMMYFIED stacks. SHIMMYFIED: target glows and has 30% DEF pierce per stack. Gain x15 MAG in shimmyful state.',
    passive: [],
    situational: [{ id: 'sfo-active', label: 'SHIMMYFUL OVERLORD active (below 60% HP)', passive: [{ stat: 'mag', op: 'mul', value: 15 }] }],
  },

  // EPIC
  ascendedtogether: {
    name: 'Ascended Together.', rarity: 'epic',
    desc: 'If an ally transforms or ascends, you automatically transform into a similar version of their form.',
    passive: [],
    notes: 'RP: mirrors ally transformation. Form is DM-determined based on the ally\'s ascension.',
  },

  overlooked: {
    name: 'Overlooked', rarity: 'epic',
    desc: 'If your stats are lower than every other unit in the fight, gain x10 Crit Chance and x10 Crit Damage.',
    passive: [],
    situational: [{ id: 'ovk-active', label: 'Overlooked active (lowest stats in fight)', passive: [{ stat: 'crit_rate', op: 'pct', value: 900 }, { stat: 'crit_dmg', op: 'pct', value: 900 }] }],
  },

  soreloser: {
    name: 'Sore Loser', rarity: 'epic',
    desc: 'Upon being defeated, the enemy who dealt the killing blow permanently loses 25% of their highest stat.',
    passive: [],
    notes: 'On-defeat trigger: attacker loses 25% of their highest stat permanently.',
  },

  toottoo: {
    name: 'Too Too', rarity: 'epic',
    desc: 'You are equipped with a tutu. Gain +50% SPD every time you are hit (stacking). 1 SPD = +1 ATK.',
    passive: [{ op: 'derived', stat: 'atk', from: 'spd', per: 1, perValue: 1 }],
    situational: [{ id: 'tt-1', label: '1 hit taken (+50% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 50 }] }, { id: 'tt-2', label: '2 hits taken (+100% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 100 }] }, { id: 'tt-4', label: '4 hits taken (+200% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 200 }] }, { id: 'tt-6', label: '6 hits taken (+300% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 300 }] }, { id: 'tt-10', label: '10 hits taken (+500% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 500 }] }],
    notes: 'SPD stacks on each hit. ATK bonus from SPD is derived automatically.',
  },

  tillicollapse: {
    name: 'Till i Collapse', rarity: 'epic',
    desc: 'Push the knockout threshold, effectively gaining +50% HP. Your stats are x1.45 at full health, scaling down to x0.8 near the threshold.',
    passive: [{ stat: 'hp', op: 'pct', value: 50 }],
    situational: [{ id: 'tic-full', label: 'Full HP (x1.45 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 45 }] }, { id: 'tic-75', label: 'Below 75% HP (x1.3 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 30 }] }, { id: 'tic-50', label: 'Below 50% HP (x1.1 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 10 }] }, { id: 'tic-25', label: 'Below 25% HP (x0.9 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -10 }] }, { id: 'tic-low', label: 'Near knockout (x0.8 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -20 }] }],
  },

  // ── NEW LEGENDARIES ──────────────────────────────────────────
  blind_monk: {
    name: 'Blind Monk', rarity: 'legendary',
    desc: 'apply blinded-onhit and to yourself. +80% accuracy while above 60% HP. Apply CONFUSED on-hit with a 20% chance.',
    passive: [],
    situational: [{ id: 'bm-above60', label: 'Above 60% HP (+80% accuracy)', passive: [{ stat: 'dexterity', op: 'add', value: 80 }] }],
    notes: 'Applies BLINDED to self and on-hit. 20% chance to apply CONFUSED on-hit.',
  },

  warden_ally: {
    name: 'Warden', rarity: 'legendary',
    desc: '+50% DEF per ally.',
    passive: [],
    situational: [
      { id: 'wa-1', label: '1 ally (+50% DEF)', passive: [{ stat: 'def', op: 'pct', value: 50 }] },
      { id: 'wa-2', label: '2 allies (+100% DEF)', passive: [{ stat: 'def', op: 'pct', value: 100 }] },
      { id: 'wa-3', label: '3 allies (+150% DEF)', passive: [{ stat: 'def', op: 'pct', value: 150 }] },
      { id: 'wa-4', label: '4 allies (+200% DEF)', passive: [{ stat: 'def', op: 'pct', value: 200 }] },
      { id: 'wa-5', label: '5 allies (+250% DEF)', passive: [{ stat: 'def', op: 'pct', value: 250 }] },
    ],
  },

  funky_battle: {
    name: 'Funky Battle', rarity: 'legendary',
    desc: 'All units on the battle turn FUNKY. +30% to all non-hp stats. Gain +5% crit chance per hit during a fight. Gain +5% DEX per attack dodged during a fight.',
    passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'def', op: 'pct', value: 30 }, { stat: 'mag', op: 'pct', value: 30 }, { stat: 'spd', op: 'pct', value: 30 }],
    situational: [
      { id: 'fb-5h', label: '5 hits landed (+25% crit chance)', passive: [{ stat: 'crit_rate', op: 'add', value: 25 }] },
      { id: 'fb-10h', label: '10 hits landed (+50% crit chance)', passive: [{ stat: 'crit_rate', op: 'add', value: 50 }] },
      { id: 'fb-5d', label: '5 attacks dodged (+25% DEX)', passive: [{ stat: 'dexterity', op: 'add', value: 25 }] },
      { id: 'fb-10d', label: '10 attacks dodged (+50% DEX)', passive: [{ stat: 'dexterity', op: 'add', value: 50 }] },
    ],
    notes: 'Applies FUNKY to all units at fight start. +5% crit per hit, +5% DEX per dodge, track in situational.',
  },

  fear_aura: {
    name: 'FEAR', rarity: 'legendary',
    desc: 'Once a battle, let out a terrifying cry, applying FEAR to all units on the field for 1-2 rounds except you, including allies. +50% Lifesteal and crit chance per FEARED unit.',
    passive: [],
    situational: [
      { id: 'fear-1u', label: '1 FEARED unit (+50% Lifesteal, +50% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 50 }, { stat: 'crit_rate', op: 'add', value: 50 }] },
      { id: 'fear-2u', label: '2 FEARED units (+100% Lifesteal, +100% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 100 }, { stat: 'crit_rate', op: 'add', value: 100 }] },
      { id: 'fear-3u', label: '3 FEARED units (+150% Lifesteal, +150% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 150 }, { stat: 'crit_rate', op: 'add', value: 150 }] },
      { id: 'fear-4u', label: '4 FEARED units (+200% Lifesteal, +200% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 200 }, { stat: 'crit_rate', op: 'add', value: 200 }] },
    ],
    notes: 'Once per battle: apply FEAR to all units except self for 1-2 rounds.',
  },

  trinity_trait: {
    name: 'Trinity', rarity: 'legendary',
    desc: '+1 ATK per 1 DEF. +1 DEF per 1 SPE. +1 SPE per 2 ATK. +33% DEX, +33% Resilience, +33% Crit Chance',
    passive: [
      { op: 'derived', stat: 'atk', from: 'def', per: 1, perValue: 1 },
      { op: 'derived', stat: 'def', from: 'spd', per: 1, perValue: 1 },
      { op: 'derived', stat: 'spd', from: 'atk', per: 2, perValue: 1 },
      { stat: 'dexterity', op: 'add', value: 33 },
      { stat: 'resilience', op: 'add', value: 33 },
      { stat: 'crit_rate', op: 'add', value: 33 },
    ],
  },

  retribution: {
    name: 'Retribution', rarity: 'legendary',
    desc: 'for every time you\'re hit, gain x2.5 ATK for your next attack.',
    passive: [],
    situational: [{ id: 'ret-active', label: 'Just been hit (x2.5 ATK for next attack)', passive: [{ stat: 'atk', op: 'mul', value: 2.5 }] }],
    notes: 'Toggle when hit; untoggle after your next attack lands.',
  },

  beyond_edge: {
    name: 'Beyond the Edge', rarity: 'legendary',
    desc: 'When dropping below 0% HP, gain a new HP bar worth 100% of your max HP. DEF drops to 0',
    passive: [],
    situational: [{ id: 'bte-active', label: 'Second HP bar active (DEF → 0)', passive: [{ stat: 'def', op: 'mul', value: 0 }] }],
    notes: 'On reaching 0 HP: spawn second HP bar equal to max HP. DEF becomes 0.',
  },

  my_true_form: {
    name: 'MY TRUE FORM!', rarity: 'legendary',
    desc: 'Activate your EX form at any point, doubling the size of your legs and increasing your SPD, ATK and MAG x3, but lowering your defense by 50%',
    passive: [],
    situational: [{ id: 'mtf-active', label: 'EX Form active (x3 SPD/ATK/MAG, -50% DEF)', passive: [{ stat: 'spd', op: 'mul', value: 3 }, { stat: 'atk', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }, { stat: 'def', op: 'pct', value: -50 }] }],
    notes: 'Toggle to activate EX form manually.',
  },

  drama_romance: {
    name: 'Drama, Romance, Bloodshed!', rarity: 'legendary',
    desc: 'For every unit (ally or enemy) knocked out, gain +10% all substats to the whole team and apply 1 stack of ENVIGORATED to all allies for 3 rounds',
    passive: [],
    situational: [
      { id: 'drb-1ko', label: '1 KO (+10% all substats)', passive: [{ stat: 'all_sub', op: 'add', value: 10 }] },
      { id: 'drb-3ko', label: '3 KOs (+30% all substats)', passive: [{ stat: 'all_sub', op: 'add', value: 30 }] },
      { id: 'drb-5ko', label: '5 KOs (+50% all substats)', passive: [{ stat: 'all_sub', op: 'add', value: 50 }] },
    ],
    notes: 'Each KO applies ENVIGORATED to all allies for 3 rounds.',
  },

  imperial_march: {
    name: 'Imperial March', rarity: 'legendary',
    desc: 'Every unit defeated (not killed) has a chance to join your party permanently, turning into your subject. Gain a crown that increases your non-hp stats by +20% per subject.',
    passive: [],
    situational: [
      { id: 'im-1s', label: '1 subject (+20% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'def', op: 'pct', value: 20 }, { stat: 'mag', op: 'pct', value: 20 }, { stat: 'spd', op: 'pct', value: 20 }] },
      { id: 'im-3s', label: '3 subjects (+60% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'def', op: 'pct', value: 60 }, { stat: 'mag', op: 'pct', value: 60 }, { stat: 'spd', op: 'pct', value: 60 }] },
      { id: 'im-5s', label: '5 subjects (+100% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'def', op: 'pct', value: 100 }, { stat: 'mag', op: 'pct', value: 100 }, { stat: 'spd', op: 'pct', value: 100 }] },
    ],
    notes: 'Spared enemies have a chance to become subjects. +20% non-HP stats per subject (crown).',
  },

  violent_crusade: {
    name: 'Violent Crusade', rarity: 'legendary',
    desc: 'Permanently apply ADRENALINE status effect during every fight. Attacks deal NULLIFIED status effect. Killing an enemy grants HELLFIRE BURN for your next 3 attacks, carries over through fights. At 100 kills, gain permanent HELLFIRE BURN on your attacks and x10 ATK.',
    passive: [],
    cultivation: { label: 'Total Kills', perStack: [], defaultStacks: 0, maxStacks: 999 },
    situational: [
      { id: 'vc-100k', label: 'At 100 kills (permanent HELLFIRE BURN + x10 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 10 }] },
    ],
    notes: 'Always ADRENALINE in fight. NULLIFIED on-hit. 3 HELLFIRE BURN attacks per kill (carry over). At 100 kills: x10 ATK + permanent HELLFIRE BURN.',
  },

  brute_trait: {
    name: 'Brute', rarity: 'legendary',
    desc: 'can\'t use magic, MAG is set to 0. Gain +25% ATK per punch during a fight. Being physically hit increases DEF by +25%, stacking. Become slightly bigger and buffer per hit taken/dealt',
    passive: [{ stat: 'mag', op: 'mul', value: 0 }],
    situational: [
      { id: 'brute-5p', label: '5 punches landed (+125% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 125 }] },
      { id: 'brute-5h', label: '5 physical hits taken (+125% DEF)', passive: [{ stat: 'def', op: 'pct', value: 125 }] },
      { id: 'brute-10p', label: '10 punches (+250% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 250 }] },
      { id: 'brute-10h', label: '10 hits taken (+250% DEF)', passive: [{ stat: 'def', op: 'pct', value: 250 }] },
    ],
    notes: 'MAG set to 0. +25% ATK per punch, +25% DEF per physical hit. Track with situational.',
  },

  demon_pact: {
    name: 'Demon Pact', rarity: 'legendary',
    desc: 'Turn into a half-demon. +100% Lifesteal, -100% true damage. With every hit, apply CURSED for 2 turns (-60% stats to enemies). Being hit applies PIERCED to you.',
    passive: [{ stat: 'lifesteal', op: 'add', value: 100 }, { stat: 'true_dmg', op: 'add', value: -100 }],
    notes: 'On-hit: CURSED (2 turns). When hit: PIERCED applied to self.',
  },

  god_complex: {
    name: 'God Complex', rarity: 'legendary',
    desc: 'Apply BAIT to yourself. Get +100% DEX and SPD. Apply FLOWING to yourself every turn, non-stacking. Apply PATIENT and SHIELDED to yourself for the first time you\'re hit during a fight. Gain +10% all non-hp stats per enemy or ally you\'ve insulted or taunted in a fight, one stack per unit. Get 1 stack of Empowered every turn, stacking.',
    passive: [{ stat: 'dexterity', op: 'add', value: 100 }, { stat: 'spd', op: 'pct', value: 100 }],
    situational: [
      { id: 'gc-1t', label: '1 unit taunted/insulted (+10% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'def', op: 'pct', value: 10 }, { stat: 'mag', op: 'pct', value: 10 }, { stat: 'spd', op: 'pct', value: 10 }] },
      { id: 'gc-3t', label: '3 units taunted (+30% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'def', op: 'pct', value: 30 }, { stat: 'mag', op: 'pct', value: 30 }, { stat: 'spd', op: 'pct', value: 30 }] },
      { id: 'gc-5t', label: '5 units taunted (+50% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'def', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] },
    ],
    notes: 'Apply BAIT to self. Apply FLOWING each turn (non-stacking). First hit: PATIENT + SHIELDED. 1 Empowered stack/turn.',
  },

  facade_trait: {
    name: 'Façade', rarity: 'legendary',
    desc: 'First time you\'re hit during a fight, nullify all damage and increase your DEF and HP by the amount of ATK and SPD you have.',
    passive: [],
    situational: [{ id: 'fac-triggered', label: 'Façade triggered (first hit nullified, DEF+HP boosted)', passive: [] }],
    notes: 'First hit per fight: nullify damage. Gain flat DEF equal to your ATK value, flat HP equal to your SPD value.',
  },

  vortex_trait: {
    name: 'Vortex', rarity: 'legendary',
    desc: 'Apply DEFERRED status effect to the first enemy you hit. Apply Weighted to every enemy you hit afterwards. Enemies that hit you have a 25% chance of being applied with CONFUSED',
    passive: [],
    notes: 'First hit: DEFERRED. Subsequent hits: WEIGHTED. 25% chance enemies apply CONFUSED when they hit you.',
  },

  hypno: {
    name: 'Hypno', rarity: 'legendary',
    desc: 'Apply TIRED on-hit. Apply EXHAUSTED on-hit if hitting TIRED enemies. Apply ASLEEP on-hit if target is EXHAUSTED. Apply HAUNTED to all enemies the first turn',
    passive: [],
    notes: 'Chain: TIRED → EXHAUSTED (on TIRED) → ASLEEP (on EXHAUSTED). Apply HAUNTED to all enemies on turn 1.',
  },

  charmer: {
    name: 'Charmer', rarity: 'legendary',
    desc: 'Apply CHARMED on-hit with a 40% chance for 1 round,  and BRAINWASHED on-hit with a 5% chance for 2 rounds.  5% chance to apply BERSERK instead of BRAINWASHED, for 2 rounds.',
    passive: [],
    notes: '40% CHARMED (1 round). 5% BRAINWASHED (2 rounds). 5% BERSERK instead of BRAINWASHED (2 rounds).',
  },

  mero_mero: {
    name: 'Mero, mero!', rarity: 'legendary',
    desc: 'Apply PETRIFIED on-hit with a 20% chance, for 1 round. Gain +50% SPD and increase the effectivity of your range attacks by +50%',
    passive: [{ stat: 'spd', op: 'pct', value: 50 }],
    notes: '20% PETRIFIED on-hit for 1 round. Range attack effectiveness +50%.',
  },

  high_roller: {
    name: 'High-roller', rarity: 'legendary',
    desc: 'Apply ANTE UP to yourself every turn. Hitting an ANTE UP increases your next ANTE UP\'s buff by an extra 1 (so x4 turns into x5), resets upon missing or hitting an ally.',
    passive: [],
    notes: 'Apply ANTE UP to self each turn. Consecutive hits vs ANTE UP enemy escalate multiplier by 1. Miss/ally hit resets.',
  },

  energy_drain: {
    name: 'Energy Drain', rarity: 'legendary',
    desc: 'Apply TIRED for 3 turns to all enemies who attack you physically. Applies NULLIFIED for 3 turns to enemies who attack you with magic. Apply OVERHEATED for 3 rounds on-hit with a 40% chance. +5% all non-HP stats per OVERHEATED enemy.',
    passive: [],
    situational: [
      { id: 'ed-1ov', label: '1 OVERHEATED enemy (+5% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 5 }, { stat: 'def', op: 'pct', value: 5 }, { stat: 'mag', op: 'pct', value: 5 }, { stat: 'spd', op: 'pct', value: 5 }] },
      { id: 'ed-3ov', label: '3 OVERHEATED enemies (+15% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 15 }, { stat: 'def', op: 'pct', value: 15 }, { stat: 'mag', op: 'pct', value: 15 }, { stat: 'spd', op: 'pct', value: 15 }] },
      { id: 'ed-5ov', label: '5 OVERHEATED enemies (+25% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'def', op: 'pct', value: 25 }, { stat: 'mag', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 25 }] },
    ],
    notes: 'Physical attackers get TIRED (3 turns). Magic attackers get NULLIFIED (3 turns). 40% OVERHEATED on-hit.',
  },

  frostfire_trait: {
    name: 'Frostfire', rarity: 'legendary',
    desc: 'Apply FROZEN on-hit for 1 round with a 50% chance. Apply BURN on-hit for 1 round with a 50% chance. Applying both in one turn applies HELLFIRE BURN for 2 rounds and gives you +100% True Damage on your next hit. Can\'t be knocked out while an enemy is either frozen or burning.',
    passive: [],
    situational: [{ id: 'ff-bonus', label: 'Applied both FROZEN & BURN this turn (+100% True Damage next hit)', passive: [{ stat: 'true_dmg', op: 'add', value: 100 }] }],
    notes: '50% FROZEN on-hit, 50% BURN on-hit. Both in same turn → HELLFIRE BURN (2 rounds) + +100% True Dmg next hit. Cannot KO while enemy is FROZEN or BURN.',
  },

  karmic_retribution: {
    name: 'Karmic Retribution', rarity: 'legendary',
    desc: 'Your attacks deal x7 damage, applied in the span of 3 turns, to enemies who have more than 20 kills.',
    passive: [],
    situational: [{ id: 'kr-active', label: 'Targeting enemy with 20+ kills (x7 dmg over 3 turns)', passive: [{ stat: 'atk', op: 'mul', value: 7 }] }],
    notes: 'x7 damage vs 20+ kill enemies, delivered over 3 turns.',
  },

  soul_fighter: {
    name: 'Soul Fighter', rarity: 'legendary',
    desc: 'Your body can\'t take damage, instead your soul does. Losing a fight will kill you, but you gain x5 MAG, increased to x10 when below 15% HP.',
    passive: [{ stat: 'mag', op: 'mul', value: 5 }],
    situational: [{ id: 'sf-low', label: 'Below 15% HP (MAG x10 instead)', passive: [{ stat: 'mag', op: 'mul', value: 10 }] }],
    notes: 'Soul takes damage instead of body. Losing = death. x5 MAG normally, x10 below 15% HP.',
  },

  triple_threat: {
    name: 'Triple The Threat', rarity: 'legendary',
    desc: 'While in a TRIO, the entire TRIO gains x3.33 all non-hp stats, and apply ENVIGORATED to every ally for 3 rounds at the start of a fight. If someone in the trio is knocked out, your next attack will deal 3 stacks of BLEEDING for 3 turns, but you and your ally\'s stats will be dropped to x0.33 for the rest of the fight, unless the knocked out ally is revived.',
    passive: [],
    situational: [
      { id: 'tt-trio', label: 'In a TRIO (x3.33 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 3.33 }, { stat: 'def', op: 'mul', value: 3.33 }, { stat: 'mag', op: 'mul', value: 3.33 }, { stat: 'spd', op: 'mul', value: 3.33 }] },
      { id: 'tt-koed', label: 'Trio member KO\'d (x0.33 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 0.33 }, { stat: 'def', op: 'mul', value: 0.33 }, { stat: 'mag', op: 'mul', value: 0.33 }, { stat: 'spd', op: 'mul', value: 0.33 }] },
    ],
    notes: 'ENVIGORATED to all allies at fight start. Trio KO: next attack applies 3 BLEED stacks; stats drop to x0.33 unless revived.',
  },

  but_you_refused: {
    name: 'But You Refused', rarity: 'legendary',
    desc: 'upon dropping below 1% HP, revive on 50% HP and apply DETERMINED to yourself for the rest of the fight. ACT is more likely to succeed after.',
    passive: [],
    situational: [{ id: 'byr-active', label: 'Revived via But You Refused (DETERMINED active)', passive: [] }],
    notes: 'One-time per fight: survive below 1% HP, revive at 50% HP + DETERMINED status.',
  },

  i_am_perfect: {
    name: 'I am Perfect', rarity: 'legendary',
    desc: 'Become cocky, increasingly so as a fight goes on. For every dodged attack, gain +50% all non-HP stats for the rest of the fight. Landing an attack grants the same buff. Gain REFRESHED for 1 round upon being knocked below 20% HP',
    passive: [],
    situational: [
      { id: 'iap-1s', label: '1 dodge/hit (+50% all non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'def', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] },
      { id: 'iap-3s', label: '3 dodges/hits (+150% all non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'def', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }, { stat: 'spd', op: 'pct', value: 150 }] },
      { id: 'iap-5s', label: '5 dodges/hits (+250% all non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 250 }, { stat: 'def', op: 'pct', value: 250 }, { stat: 'mag', op: 'pct', value: 250 }, { stat: 'spd', op: 'pct', value: 250 }] },
    ],
    notes: '+50% non-HP stats per dodge or landed attack, stacking. REFRESHED on drop below 20% HP.',
  },

  stoner: {
    name: 'Stoner', rarity: 'legendary',
    desc: 'Apply DRUGGED to yourself every turn, stacking.',
    passive: [],
    notes: 'Apply 1 stack of DRUGGED to self each turn, infinitely stacking.',
  },

  drunkard: {
    name: 'Drunkard', rarity: 'legendary',
    desc: 'Apply DRUNK to yourself every turn, stacking.',
    passive: [],
    notes: 'Apply 1 stack of DRUNK to self each turn, infinitely stacking.',
  },

  rasta_fire: {
    name: 'Rasta Fire', rarity: 'legendary',
    desc: 'Apply BURNING and DRUGGED on-hit with a 80% chance. x20 DEF towards DRUGGED enemies.',
    passive: [],
    situational: [{ id: 'rf-drugged', label: 'Hitting DRUGGED enemy (x20 DEF)', passive: [{ stat: 'def', op: 'mul', value: 20 }] }],
    notes: '80% chance to apply BURNING and DRUGGED on-hit. x20 effective DEF vs DRUGGED targets.',
  },

  chemicals: {
    name: 'CHEMICALS', rarity: 'legendary',
    desc: 'Apply a random NEGATIVE status effect to all enemies at the beginning of a fight. Apply a random POSITIVE status effect to all allies at the beginning of a fight',
    passive: [],
    notes: 'At fight start: apply 1 random negative to enemies AND 1 random positive status to all enemies .',
  },

  chem_warrior: {
    name: 'Chem-warrior', rarity: 'legendary',
    desc: 'Apply a random NEUTRAL or NEGATIVE status effect to enemies on-hit. Gain +10% ATK and DEF per stack of any status effect on enemies.',
    passive: [],
    situational: [
      { id: 'cw-1s', label: '1 status stack on enemies (+10% ATK, +10% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'def', op: 'pct', value: 10 }] },
      { id: 'cw-5s', label: '5 status stacks (+50% ATK, +50% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'def', op: 'pct', value: 50 }] },
      { id: 'cw-10s', label: '10 status stacks (+100% ATK, +100% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'def', op: 'pct', value: 100 }] },
    ],
    notes: 'Random neutral/negative status on-hit. +10% ATK+DEF per total status stack on all enemies.',
  },

  aoe_all: {
    name: 'AOE', rarity: 'legendary',
    desc: 'All of your attacks turn AOE. Get +5% ATK per enemy hit in a fight, infinitely stacking. Apply ',
    passive: [],
    cultivation: { label: 'Enemies Hit', perStack: [{ stat: 'atk', op: 'pct', value: 5 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'All attacks become AOE. +5% ATK per enemy hit in a fight (use cultivation to track).',
  },

  hornet: {
    name: 'Hornet', rarity: 'legendary',
    desc: 'Apply POISON on-hit. Hitting a target that\'s poisoned doubles the poison stacks (x1 - x2 - x4 - x8 ...)',
    passive: [],
    notes: 'POISON on-hit. Each hit on a poisoned target doubles its current poison stack count.',
  },

  chaotic: {
    name: 'Chaotic', rarity: 'legendary',
    desc: 'Everyone\'s stats are shuffled in a fight.',
    passive: [],
    notes: 'At fight start: randomize/shuffle all stats for every unit including self.',
  },

  oh_brother: {
    name: 'Oh Brother, where art thou?', rarity: 'legendary',
    desc: 'Gain x4 all stats when fighting a sibling or with a sibling in your team.',
    passive: [],
    situational: [{ id: 'ob-active', label: 'Fighting/with a sibling (x4 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 4 }] }],
  },

  mimic_trait: {
    name: 'Mimic', rarity: 'legendary',
    desc: 'Choose an enemy, and steal all of their abilities, weapons, and add 50% of their stats to yours.',
    passive: [],
    notes: 'RP: choose one enemy, copy their abilities/weapons. Add 50% of each of their stats to yours.',
  },

  regicide: {
    name: 'Regicide', rarity: 'legendary',
    desc: 'Fighting someone with royal blood grants x3 all non-hp stats. Killing them grants 100 MAG and ATK permanently.',
    passive: [],
    situational: [{ id: 'reg-active', label: 'Fighting royalty (x3 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'def', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }] }, { id: 'reg-killed', label: 'Killed royalty (+100 ATK, +100 MAG, permanent)', passive: [{ stat: 'atk', op: 'add', value: 100 }, { stat: 'mag', op: 'add', value: 100 }] }],
  },

  supernova: {
    name: 'Supernova', rarity: 'legendary',
    desc: 'Defeating an enemy causes a cosmic explosion, dealing 20% of that enemy\'s max hp as true damage to every unit except yourself in the field. Everyone except you is applied DEFERRED and CORRODED for 3 rounds.',
    passive: [],
    notes: 'On kill: 20% max HP true damage AoE to all other units + DEFERRED + CORRODED (3 rounds).',
  },

  chilling_elegy: {
    name: 'Chilling Elegy', rarity: 'legendary',
    desc: 'Apply FROZEN on-hit with a 50% chance for 2 rounds. Hitting a FROZEN enemy applies DOOM to them.',
    passive: [],
    notes: '50% FROZEN on-hit (2 rounds). Hitting FROZEN enemy → DOOM.',
  },

  defiant: {
    name: 'Defiant', rarity: 'legendary',
    desc: 'Being hit grants ANGRY and ENVIGORATED, infinitely stacking.',
    passive: [],
    notes: 'Each hit received: apply 1 stack of ANGRY and ENVIGORATED to self. Infinite stacking.',
  },

  the_brutalizer: {
    name: 'The Brutalizer', rarity: 'legendary',
    desc: '+85 ATK, +50 DEF, +150 HP, +25% Crit chance, +25% Crit Damage',
    passive: [
      { stat: 'atk', op: 'add', value: 85 },
      { stat: 'def', op: 'add', value: 50 },
      { stat: 'hp', op: 'add', value: 150 },
      { stat: 'crit_rate', op: 'add', value: 25 },
      { stat: 'crit_dmg', op: 'add', value: 25 },
    ],
  },

  evils_bane: {
    name: 'Evil\'s Bane', rarity: 'legendary',
    desc: 'Apply DEFERRED for 3 rounds on-hit to enemies with more than 20 kills.',
    passive: [],
    notes: 'On-hit: apply DEFERRED (3 rounds) if target has 20+ kills.',
  },

  cheerleader: {
    name: 'Cheerleader', rarity: 'legendary',
    desc: 'Apply RALLIED to all allies when a fight starts, and JOYFUL to yourself',
    passive: [],
    notes: 'At fight start: RALLIED to all allies, JOYFUL to self.',
  },

  stand_til_end: {
    name: 'Stand Until The End', rarity: 'legendary',
    desc: 'Units in the field can no longer be knocked out, only killed. Get +10% Crit chance and crit damage per kill permanently.',
    passive: [],
    cultivation: { label: 'Kills', perStack: [{ stat: 'crit_rate', op: 'add', value: 10 }, { stat: 'crit_dmg', op: 'add', value: 10 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'No knockouts allowed — only kills. +10% crit chance & crit damage per kill, permanent.',
  },

  trial_justice: {
    name: 'Trial by Justice', rarity: 'legendary',
    desc: 'At the start of a fight, Check the enemy\'s total KILLS and SPARES. If the KILLS exceed the SPARES, deal 50% max hp true damage to them with an energy revolver. Doesn\'t consume a turn',
    passive: [],
    notes: 'At fight start: if enemy KILLS > SPARES, deal 50% max HP true damage instantly (no turn cost).',
  },

  eve_draws_close: {
    name: 'Your eve draws to a close', rarity: 'legendary',
    desc: 'When an enemy\'s HP drops below 25%, apply EXHAUSTED and SHATTERED to them for the rest of the fight. Gain +50% SPD for every EXHAUSTED or TIRED enemy on the field.',
    passive: [],
    situational: [
      { id: 'edc-1e', label: '1 EXHAUSTED/TIRED enemy (+50% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 50 }] },
      { id: 'edc-2e', label: '2 EXHAUSTED/TIRED enemies (+100% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 100 }] },
      { id: 'edc-3e', label: '3 EXHAUSTED/TIRED enemies (+150% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 150 }] },
    ],
    notes: 'Enemy below 25% HP: apply EXHAUSTED + SHATTERED for rest of fight. +50% SPD per EXHAUSTED/TIRED unit.',
  },

  one_hit_ko: {
    name: '1 Hit-KO', rarity: 'legendary',
    desc: 'Every fight, you have a chance to deal a punch that either has a 50% chance to knock you out or the enemy.',
    passive: [],
    notes: 'Once per fight: special punch — 50% chance to KO you, 50% to KO the enemy.',
  },

  shotgun_trait: {
    name: 'Shotgun', rarity: 'legendary',
    desc: 'You always skip the second turn. x4 ATK, attacks apply SOFTENED on-hit',
    passive: [{ stat: 'atk', op: 'mul', value: 4 }],
    notes: 'Always skip your second turn each round. x4 ATK. Attacks apply SOFTENED on-hit.',
  },

  // ── NEW MYTHICS ───────────────────────────────────────────────
  mathematical: {
    name: 'Mathematical', rarity: 'mythic',
    desc: 'Calculate the difference between your highest and lowest non-HP stat. Gain that difference as a flat bonus to all non-HP stats. Additionally, gain +5% to all non-HP stats at the start of each turn in a fight, permanently stacking.',
    passive: [],
    cultivation: { label: 'Fight Turns Elapsed', perStack: [{ stat: 'atk', op: 'pct', value: 5 }, { stat: 'def', op: 'pct', value: 5 }, { stat: 'mag', op: 'pct', value: 5 }, { stat: 'spd', op: 'pct', value: 5 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Flat bonus to non-HP stats = (highest non-HP stat − lowest non-HP stat). Use cultivation for fight-turn stacks.',
  },

  vampiric_gambler: {
    name: 'Vampiric Gambler', rarity: 'mythic',
    desc: 'Apply VAMPMARK to all enemies at the start of the fight, for 3 rounds. Hitting an enemy applies ANTE UP to yourself. Every time you\'re hit, roll 1d6. D3-D6 = you gain +50% ATK for 2 rounds. D1-D2: You take x3 damage in this hit.',
    passive: [],
    situational: [
      { id: 'vg-d3d6', label: 'Rolled D3-D6 (+50% ATK for 2 rounds)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] },
      { id: 'vg-d1d2', label: 'Rolled D1-D2 (x3 damage this hit)', passive: [] },
    ],
    notes: 'At fight start: VAMPMARK all enemies (3 rounds). ANTE UP on self when hitting. Roll 1d6 when hit: 3-6 = +50% ATK (2 rounds), 1-2 = x3 damage.',
  },

  intoxicator: {
    name: 'Intoxicator', rarity: 'mythic',
    desc: 'Apply DRUNK on-hit with a 70% chance. Apply DRUGGED on-hit with a 25% chance. If a target is DRUNK and DRUGGED, apply 1 stack of CORRODED on-hit, infinitely stacking. Gain +25% all non-hp stats per drunk, drugged or corroded enemy, all stacking with eachother. x10 DEF towards DRUGGED enemies.',
    passive: [],
    situational: [
      { id: 'int-1d', label: '1 DRUNK/DRUGGED/CORRODED enemy (+25% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'def', op: 'pct', value: 25 }, { stat: 'mag', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 25 }] },
      { id: 'int-3d', label: '3 such enemies (+75% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'def', op: 'pct', value: 75 }, { stat: 'mag', op: 'pct', value: 75 }, { stat: 'spd', op: 'pct', value: 75 }] },
      { id: 'int-drugged', label: 'Hitting DRUGGED enemy (x10 DEF)', passive: [{ stat: 'def', op: 'mul', value: 10 }] },
    ],
    notes: '70% DRUNK, 25% DRUGGED on-hit. DRUNK+DRUGGED → CORRODED (infinite stacks). +25% non-HP per affected enemy. x10 DEF vs DRUGGED.',
  },

  hand_of_desecration: {
    name: 'The Hand of Desecration', rarity: 'mythic',
    desc: 'When an enemy drops below 60% HP, apply DEFERRED, CONFUSED, DOOM, PARALYZED, CURSED, BLEEDING, EXHAUSTED, PIERCED, VAMPMARK, OVERHEAT, FEAR and CORRODED to them.',
    passive: [],
    notes: 'Trigger: enemy falls below 60% HP — apply all 12 listed status effects simultaneously.',
  },

  the_shooter: {
    name: 'THE SHOOTER', rarity: 'mythic',
    desc: 'If you don\'t have a firearm, gain an energy one based on your soul. Deal x5 damage, x3 attack speed, x2 true damage when using a firearm, as well as infinite ammo.',
    passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'true_dmg', op: 'add', value: 100 }],
    notes: 'If no firearm: gain energy firearm. x5 damage, x3 attack speed, x2 true damage, infinite ammo with firearms.',
  },

  forged_destiny: {
    name: 'Forged Destiny', rarity: 'mythic',
    desc: 'For every knockout, get +20 ATK. For every spare, get +20 DEF. At the start of a fight, grant flowing and critical. If HP drops below 50%, grant Adrenaline. If an enemy is spared, grant RALLIED for 3 rounds. If an enemy is knocked out, apply BLEEDING to all enemies on the field for 3 rounds.',
    passive: [],
    cultivation: { label: 'KOs (ATK) / Spares (DEF)', perStack: [], defaultStacks: 0, maxStacks: 999 },
    situational: [
      { id: 'fd-ko5', label: '5 KOs (+100 ATK)', passive: [{ stat: 'atk', op: 'add', value: 100 }] },
      { id: 'fd-sp5', label: '5 Spares (+100 DEF)', passive: [{ stat: 'def', op: 'add', value: 100 }] },
      { id: 'fd-low', label: 'Below 50% HP (ADRENALINE active)', passive: [] },
    ],
    notes: '+20 ATK per KO, +20 DEF per spare. Fight start: FLOWING + CRITICAL. Below 50%: ADRENALINE. Spare: RALLIED (3 rounds). KO: BLEEDING to all enemies (3 rounds).',
  },

  shinigami: {
    name: 'Shinigami', rarity: 'mythic',
    desc: 'Ability to bring back characters that the enemy has killed to fight alongside you. Two per fight, consumes a turn. Apply CURSED on-hit with a 30% chance. Apply HOLLOW on-hit with a 40% chance. Hitting CURSED enemies applies DOOM. +100% Lifesteal. Hitting HOLLOW enemies applies BRITTLE.',
    passive: [{ stat: 'lifesteal', op: 'add', value: 100 }],
    notes: '2 revivals per fight (uses a turn). 30% CURSED, 40% HOLLOW on-hit. CURSED → DOOM. HOLLOW → BRITTLE.',
  },

  sunrise_trait: {
    name: 'SUNRISE', rarity: 'mythic',
    desc: 'every 2 turns, your non-hp stats are multiplied by the Fibonacci formula. (x0, x1, x1, x2, x3, x5, x8...)',
    passive: [],
    situational: [
      { id: 'sun-t2', label: 'Turn 2 (x1 non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 1 }, { stat: 'def', op: 'mul', value: 1 }, { stat: 'mag', op: 'mul', value: 1 }, { stat: 'spd', op: 'mul', value: 1 }] },
      { id: 'sun-t4', label: 'Turn 4 (x1)', passive: [{ stat: 'atk', op: 'mul', value: 1 }, { stat: 'def', op: 'mul', value: 1 }, { stat: 'mag', op: 'mul', value: 1 }, { stat: 'spd', op: 'mul', value: 1 }] },
      { id: 'sun-t6', label: 'Turn 6 (x2)', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'def', op: 'mul', value: 2 }, { stat: 'mag', op: 'mul', value: 2 }, { stat: 'spd', op: 'mul', value: 2 }] },
      { id: 'sun-t8', label: 'Turn 8 (x3)', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'def', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }] },
      { id: 'sun-t10', label: 'Turn 10 (x5)', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'spd', op: 'mul', value: 5 }] },
      { id: 'sun-t12', label: 'Turn 12 (x8)', passive: [{ stat: 'atk', op: 'mul', value: 8 }, { stat: 'def', op: 'mul', value: 8 }, { stat: 'mag', op: 'mul', value: 8 }, { stat: 'spd', op: 'mul', value: 8 }] },
    ],
    notes: 'Every 2 turns: non-HP stats × next Fibonacci number (0,1,1,2,3,5,8...).',
  },

  thick_of_it: {
    name: 'Im in the Thick of It', rarity: 'mythic',
    desc: 'apply BAIT and MARKED to yourself, but gain x20 DEF and x2 ATK.',
    passive: [{ stat: 'def', op: 'mul', value: 20 }, { stat: 'atk', op: 'mul', value: 2 }],
    notes: 'Apply BAIT and MARKED to self at fight start. x20 DEF, x2 ATK.',
  },

  womanizer: {
    name: 'Womanizer', rarity: 'mythic',
    desc: 'changes people\'s genders on-hit with a 50% chance. +100% status effect resistance',
    passive: [{ stat: 'status_res', op: 'add', value: 100 }],
    notes: '50% chance on-hit: target\'s gender changes (RP). +100% status resistance.',
  },

  blood_blood_god: {
    name: 'Blood for the Blood God', rarity: 'mythic',
    desc: '+50 ATK for every 3% lifesteal. Applies BLEEDING on-hit, gain +20 atk for every stack of bleeding in a fight.',
    passive: [{ op: 'derived', stat: 'atk', from: 'lifesteal', per: 3, perValue: 50 }],
    cultivation: { label: 'BLEEDING stacks in fight', perStack: [{ stat: 'atk', op: 'add', value: 20 }], defaultStacks: 0, maxStacks: 999 },
    notes: '+50 ATK per 3% lifesteal (auto-derived). BLEEDING on-hit. +20 ATK per bleeding stack in fight.',
  },

  // ── NEW HEXXED ────────────────────────────────────────────────
  capitalist: {
    name: 'Capitalist', rarity: 'hexxed',
    desc: '90000 gold = 1 all non-hp & non-IQ stats. Gain x2 gold from all sources, lose 50% gold on defeat, shops are 90% cheaper.',
    passive: [],
    notes: 'Non-HP & Non-IQ stats = current gold total. x2 gold income. Lose 50% gold on defeat. 90% shop discount.',
  },

  communist: {
    name: 'Communist', rarity: 'hexxed',
    desc: 'get 35% of everyone\'s stats added to yours in a fight. Buying an item in a shop doubles that item. Gain x0.5 gold from all sources.',
    passive: [],
    notes: 'In fight: gain 35% of every other unit\'s stats as flat bonus. Shop items doubled. x0.5 gold income.',
  },

  alone_trait: {
    name: 'Alone', rarity: 'hexxed',
    desc: 'x11 all non-hp stats when alone. x0.25 stats when in a party. Applies SAD on-hit',
    passive: [],
    situational: [
      { id: 'aln-solo', label: 'Fighting alone (x11 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 11 }, { stat: 'def', op: 'mul', value: 11 }, { stat: 'mag', op: 'mul', value: 11 }, { stat: 'spd', op: 'mul', value: 11 }] },
      { id: 'aln-party', label: 'In a party (x0.25 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 0.25 }] },
    ],
    notes: 'Applies SAD on-hit.',
  },

  maybe_not_meant: {
    name: 'Maybe It wasn\'t meant to be', rarity: 'hexxed',
    desc: 'when a close ally is killed, permanently gain x5 all non-hp stats, infinitely stacking. Applies HOLLOW on-hit',
    passive: [],
    cultivation: { label: 'Close Allies Lost', perStack: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'spd', op: 'mul', value: 5 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Each close ally killed: x5 all non-HP stats, permanent. HOLLOW on-hit.',
  },

  outlaw_revived: {
    name: 'OUTLAW REVIVED', rarity: 'hexxed',
    desc: 'Revive once when killed, giving you a white streak of hair and teleporting somewhere random. When revived, permanently gain x5 all non-hp stats. The buff increases to x10 if you defeat the enemy who killed u, turning the white streak to glow in your soul color. When revived also Apply BLEEDING on-hit, infinitely stacking. Apply SLOWED on-hit, infinitely stacking, apply WEIGHTED on-hit, infinitely stacking. When defeated the enemy who killed you, also apply DOOM and SHATTERED on-hit.',
    passive: [],
    situational: [
      { id: 'or-revived', label: 'Revived (x5 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'spd', op: 'mul', value: 5 }] },
      { id: 'or-avenged', label: 'Defeated killer (x10 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 10 }, { stat: 'def', op: 'mul', value: 10 }, { stat: 'mag', op: 'mul', value: 10 }, { stat: 'spd', op: 'mul', value: 10 }] },
    ],
    notes: 'One-time revive. On revive: x5 non-HP stats + BLEEDING/SLOWED/WEIGHTED on-hit (infinite stacks). Defeat killer: upgrades to x10 + adds DOOM/SHATTERED on-hit.',
  },

  // ── Status-synergy traits ──────────────────────────────────

  shatter_seeker: {
    name: 'Shatter Seeker', rarity: 'epic',
    desc: 'Your critical hits apply BRITTLE to the target. Hitting a BRITTLE target always critically strikes.',
    passive: [],
    notes: 'Crits apply BRITTLE. Any hit on a BRITTLE target is a guaranteed crit. Self-sustaining crit loop.',
  },

  demolitions_expert: {
    name: 'Demolitions Expert', rarity: 'legendary',
    desc: 'Every 3rd hit applies VOLATILE to the target. When a VOLATILE explosion triggers, permanently gain +30 ATK.',
    passive: [],
    cultivation: { label: 'VOLATILE Explosions Triggered (+30 ATK each)', perStack: [{ stat: 'atk', op: 'add', value: 30 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Every 3rd hit applies VOLATILE. Each VOLATILE explosion = +30 permanent ATK.',
  },

  glass_coffin: {
    name: 'Glass Coffin', rarity: 'legendary',
    desc: 'When you would be knocked out, instead become PETRIFIED for 2 turns and revive with 40% HP. Can only trigger once per fight. When PETRIFIED ends, gain SURGE.',
    passive: [],
    notes: 'Once per fight: death → PETRIFIED (2 turns) + revive at 40% HP. On PETRIFIED expiry: gain SURGE.',
  },

  phantom_dance: {
    name: 'Phantom Dance', rarity: 'legendary',
    desc: 'Each successful dodge grants a stack of PHANTOM. When you are hit, all PHANTOM stacks are consumed and you heal for 5% HP per stack.',
    passive: [],
    notes: 'Each dodge = +1 PHANTOM stack. On hit: consume all stacks, heal 5% HP per stack.',
  },

  war_echo: {
    name: 'War Echo', rarity: 'legendary',
    desc: 'Your killing blow on an enemy triggers ECHO — the hit replays against the next enemy at 50% power. Chains up to 3 times per fight.',
    passive: [],
    notes: 'On kill: killing hit ECHO-replays onto next enemy at 50% power. Max 3 chains per fight.',
  },

  anchored_titan: {
    name: 'Anchored Titan', rarity: 'legendary',
    desc: 'Become permanently ANCHORED. Gain +20 DEF every turn, stacking infinitely. Voluntarily releasing ANCHORED converts all accumulated DEF stacks into a single devastating hit.',
    passive: [],
    cultivation: { label: 'Turns Spent ANCHORED (+20 DEF each)', perStack: [{ stat: 'def', op: 'add', value: 20 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Permanently ANCHORED. +20 DEF per turn (infinite stacks). Releasing ANCHORED converts all DEF stacks to one hit.',
  },

  counterstrike_protocol: {
    name: 'Counterstrike Protocol', rarity: 'legendary',
    desc: 'Gain MIRRORED at the start of every fight. Each time you reflect damage through MIRRORED, that reflected amount is permanently added to your ATK.',
    passive: [],
    notes: 'Fight start: MIRRORED. Every reflected damage instance permanently adds to ATK.',
  },

  jinxmaster: {
    name: 'Jinxmaster', rarity: 'legendary',
    desc: 'Attacks apply JINXED to enemies. You are permanently JINXED yourself, but deal +100% damage to JINXED targets.',
    passive: [],
    situational: [{ id: 'jm-jinxed', label: 'Attacking a JINXED target (+100% damage)', passive: [{ stat: 'atk', op: 'pct', value: 100 }] }],
    notes: 'On-hit: apply JINXED. Self is permanently JINXED. +100% ATK vs any JINXED target.',
  },

  switcheroo: {
    name: 'Switcheroo', rarity: 'legendary',
    desc: 'Once per fight, when you drop below 25% HP, swap your current HP percentage with the opponent who has the highest HP.',
    passive: [],
    notes: 'Once per fight: when HP drops below 25%, swap HP% with highest-HP opponent.',
  },

  copycat: {
    name: 'Copycat', rarity: 'legendary',
    desc: 'Each time you eliminate an opponent, permanently copy the SHIMMYFUL version of one of their traits (or regular if no shimmyful exists).',
    passive: [],
    notes: 'On kill: copy SHIMMYFUL version of target\'s trait (regular if no shimmyful exists). Permanent.',
  },

  loaded_dice: {
    name: 'Loaded Dice', rarity: 'legendary',
    desc: 'All chance-based effects (crits, dodges, on-hit procs, etc.) have their trigger rates doubled — yours and everyone else\'s.',
    passive: [],
    notes: 'All % chances (crit, dodge, proc) doubled for everyone in the fight.',
  },

  haunted: {
    name: 'Haunted', rarity: 'legendary',
    desc: 'Every round, your trait is swapped out for a random one from the full trait pool.',
    passive: [],
    notes: 'Every round: active trait swapped for a random one from the full pool.',
  },

  paper_crown: {
    name: 'Paper Crown', rarity: 'legendary',
    desc: 'You passively mirror the highest single stat bonus among all other fighters currently alive.',
    passive: [],
    notes: 'Mirror the highest single stat bonus from any living fighter. Updates each round.',
  },

  wildcard_trait: {
    name: 'Wildcard', rarity: 'legendary',
    desc: 'On pick, gain 4 random common traits. You can now hold 4 traits at once.',
    passive: [],
    notes: 'On pickup: grants 4 random common traits. Trait capacity increases to 4.',
  },

  big_spender: {
    name: 'Big Spender', rarity: 'legendary',
    desc: 'Once per fight, spend 10% HP to gain a random buff to any stat (x0.8–x1.75) for the whole fight.',
    passive: [],
    notes: 'Spend 10% HP: one random stat multiplied by x0.8–x1.75 for the fight.',
  },

  double_down: {
    name: 'Double Down', rarity: 'legendary',
    desc: 'Each fight, flip a coin. Heads: +40% ATK, DEF and MAG, x2.5 SPD. Tails: trait does nothing that fight.',
    passive: [],
    situational: [
      { id: 'dd-heads', label: 'HEADS (+40% ATK/DEF/MAG, x2.5 SPD)', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }, { stat: 'spd', op: 'mul', value: 2.5 }] },
      { id: 'dd-tails', label: 'TAILS — no effect this fight', passive: [] },
    ],
  },

  sore_loser: {
    name: 'Sore Loser', rarity: 'legendary',
    desc: 'Every time you take damage, a random opponent also takes 25% of that damage.',
    passive: [],
    notes: 'On-hit (received): 25% of damage dealt to you is also applied to a random opponent.',
  },

  comfort_food: {
    name: 'Comfort Food', rarity: 'legendary',
    desc: 'Each time you take damage, gain ATK equal to 50% of the HP lost. Stacks for the fight.',
    passive: [],
    cultivation: { label: 'HP Lost ÷10 (+5 ATK per stack)', perStack: [{ stat: 'atk', op: 'add', value: 5 }], defaultStacks: 0, maxStacks: 9999 },
    notes: 'Every 10 HP lost = +5 ATK. Track manually as stacks.',
  },

  training_arc: {
    name: 'Training Arc', rarity: 'legendary',
    desc: 'Your stats are halved for your first fight of the game. From then on, your SPD is permanently x5.',
    passive: [{ stat: 'spd', op: 'mul', value: 5 }],
    situational: [
      { id: 'ta-first', label: 'First fight of the game (all stats ÷2)', passive: [{ stat: 'all_main', op: 'pct', value: -50 }] },
    ],
  },

  anime_protagonist: {
    name: 'Anime Protagonist', rarity: 'legendary',
    desc: 'Every fight you lose this game, permanently gain +20% all stats.',
    passive: [],
    cultivation: { label: 'Fights Lost (+20% all stats each)', perStack: [{ stat: 'all_main', op: 'pct', value: 20 }], defaultStacks: 0, maxStacks: 100 },
  },

  tiki_tiki: {
    name: 'Tiki Tiki', rarity: 'legendary',
    desc: 'You gain x3 all non-HP stats while singing.',
    passive: [],
    situational: [
      { id: 'tt-singing', label: 'Currently singing (x3 ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'def', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }] },
    ],
  },

  plot_convenience: {
    name: 'Plot Convenience', rarity: 'legendary',
    desc: 'Once per game, a random opponent in your current fight randomly loses 40% of their current HP for absolutely no reason.',
    passive: [],
    notes: 'Once per game: one random opponent loses 40% of their current HP for no reason.',
  },

  the_crumbling: {
    name: 'The Crumbling', rarity: 'mythic',
    desc: 'At the start of every fight, apply DECAY to all enemies. For each turn an enemy survives under DECAY, permanently gain +15% ATK.',
    passive: [],
    cultivation: { label: 'Enemy-Turns Under DECAY (+15% ATK each)', perStack: [{ stat: 'atk', op: 'pct', value: 15 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Fight start: DECAY on all enemies. +15% ATK per enemy-turn survived under DECAY (tracks as stacks).',
  },

  fractured_reality: {
    name: 'Fractured Reality', rarity: 'mythic',
    desc: 'Your attacks apply FRACTURED to targets. Each FRACTURED echo that deals damage heals you for 10% of the echo\'s damage. FRACTURED stacks infinitely.',
    passive: [],
    notes: 'On-hit: apply FRACTURED (infinite stacks). Heal 10% of each FRACTURED echo\'s damage.',
  },

  resonance_cascade: {
    name: 'Resonance Cascade', rarity: 'mythic',
    desc: 'Gain RESONANT at the start of every fight. Each ability used adds another RESONANT stack. At 5 stacks, all abilities trigger twice simultaneously for the rest of the fight.',
    passive: [],
    situational: [{ id: 'rc-cascade', label: 'At 5 RESONANT stacks (all abilities fire twice)', passive: [] }],
    notes: 'Fight start: 1 RESONANT. Each ability use = +1 RESONANT. At 5 stacks: all abilities fire twice for the rest of the fight.',
  },

  the_contradiction: {
    name: 'The Contradiction', rarity: 'mythic',
    desc: 'Healing deals damage to you instead. Taking damage heals you instead. You are permanently MIRRORED. All status effects applied to you are inverted — debuffs become buffs and buffs become debuffs.',
    passive: [],
    notes: 'Healing ↔ damage inverted. Permanently MIRRORED. All incoming statuses are inverted (debuffs ↔ buffs).',
  },

  puppet_master: {
    name: 'Puppet Master', rarity: 'mythic',
    desc: 'Once per fight, take control of an enemy for 3 rounds. They fight on your side and cannot be targeted by allies.',
    passive: [],
    situational: [
      { id: 'pm-active', label: 'Enemy Puppeteered (3 rounds, fights for you)', passive: [] },
    ],
    notes: 'Once per fight: chosen enemy fights for you for 3 rounds and cannot be targeted by your allies.',
  },

  tyrant: {
    name: 'Tyrant', rarity: 'mythic',
    desc: 'Fighters without a mythic-or-higher rarity trait deal 60% less damage to you and take 60% more damage from you.',
    passive: [],
    situational: [
      { id: 'tyr-active', label: 'vs. non-mythic+ opponent (-60% dmg in, +60% dmg out)', passive: [{ stat: 'def', op: 'pct', value: 60 }, { stat: 'atk', op: 'pct', value: 60 }] },
    ],
    notes: 'Applies against all fighters whose rarity is common, rare, epic, or legendary.',
  },

  armageddon: {
    name: 'Armageddon', rarity: 'mythic',
    desc: "At the start of every fight, instantly deal 20% of each enemy's max HP as True Damage.",
    passive: [],
    notes: "Fight start: deal 20% max HP as True Damage to ALL enemies simultaneously. Bypasses defenses.",
  },

  zenith: {
    name: 'Zenith', rarity: 'mythic',
    desc: 'Once per fight, survive a killing blow at 1 HP. After surviving, gain 3 consecutive free turns.',
    passive: [],
    situational: [
      { id: 'zen-triggered', label: 'Zenith Triggered (survived killing blow, 3 free turns)', passive: [] },
    ],
    notes: 'Once per fight. After surviving the blow: take 3 uncontested turns during which you cannot be targeted.',
  },

  the_final_boss: {
    name: 'The Final Boss', rarity: 'mythic',
    desc: 'You have 3 phases. Each defeat triggers the next: full HP restore and +100% all stats (stacking per phase).',
    passive: [],
    situational: [
      { id: 'tfb-p2', label: 'Phase 2 (1st defeat — full HP restore, +100% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 100 }] },
      { id: 'tfb-p3', label: 'Phase 3 (2nd defeat — full HP restore, +200% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 200 }] },
    ],
    notes: '3 phases total. Each defeat: full HP restore + cumulative +100% all stats per phase.',
  },

  primordial: {
    name: 'Primordial', rarity: 'mythic',
    desc: 'Start every fight with 2 free rounds where you cannot be targeted or damaged.',
    passive: [],
    situational: [
      { id: 'prim-active', label: 'Round 1-2 (untargetable and immune to all damage)', passive: [] },
    ],
    notes: 'Rounds 1 and 2 of every fight: fully untargetable and immune to all damage.',
  },

  martyrs_flame: {
    name: "Martyr's Flame", rarity: 'mythic',
    desc: 'When any ally dies, instantly deal their full ATK + MAG as True Damage to all enemies.',
    passive: [],
    notes: "On any ally death: deal that ally's ATK + MAG as True Damage to ALL enemies simultaneously.",
  },

  the_abyss: {
    name: 'The Abyss', rarity: 'mythic',
    desc: 'At the end of each round n, all your stats are multiplied by 1.15^n. Round 1: x1.15, Round 3: x1.52, Round 5: x2.01, Round 7: x2.66, Round 10: x4.05.',
    passive: [],
    situational: [
      { id: 'abyss-r1',  label: 'Round 1  (x1.15 all stats)',  passive: [{ stat: 'all_main', op: 'mul', value: 1.15 }] },
      { id: 'abyss-r3',  label: 'Round 3  (x1.52 all stats)',  passive: [{ stat: 'all_main', op: 'mul', value: 1.52 }] },
      { id: 'abyss-r5',  label: 'Round 5  (x2.01 all stats)',  passive: [{ stat: 'all_main', op: 'mul', value: 2.01 }] },
      { id: 'abyss-r7',  label: 'Round 7  (x2.66 all stats)',  passive: [{ stat: 'all_main', op: 'mul', value: 2.66 }] },
      { id: 'abyss-r10', label: 'Round 10 (x4.05 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 4.05 }] },
    ],
    notes: 'Formula: 1.15^n where n is the round number. Use the matching situational button.',
  },

  gravity_well: {
    name: 'Gravity Well', rarity: 'mythic',
    desc: 'Redirect all damage intended for allies to yourself. All redirected damage is reduced by 60%.',
    passive: [],
    situational: [
      { id: 'gw-active', label: 'Gravity Well Active (all ally-targeted damage redirected to you, -60%)', passive: [{ stat: 'def', op: 'pct', value: 60 }] },
    ],
    notes: 'All damage targeting allies is redirected to you at 40% of its original value.',
  },

  consumed: {
    name: 'Consumed', rarity: 'mythic',
    desc: 'DEF is permanently set to 0. ATK and MAG are x5. You cannot be healed by anyone but yourself.',
    passive: [
      { stat: 'atk', op: 'mul', value: 5 },
      { stat: 'mag', op: 'mul', value: 5 },
    ],
    notes: 'DEF locked at 0. External healing (allies, items) is nullified. Self-healing still functions.',
  },

  blood_moon: {
    name: 'Blood Moon', rarity: 'mythic',
    desc: 'During night or full moon fights, x3 all stats. Permanently gain +2% all stats per fight survived.',
    passive: [],
    situational: [
      { id: 'bm-night', label: 'Night / full moon fight (x3 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 3 }] },
    ],
    cultivation: { label: 'Fights Survived (+2% all stats each)', perStack: [{ stat: 'all_main', op: 'pct', value: 2 }], defaultStacks: 0, maxStacks: 999 },
  },

  star_eater: {
    name: 'Star Eater', rarity: 'mythic',
    desc: "Attacks permanently reduce the target's max HP by 5%. After 10 reductions on the same target, they shatter instantly.",
    passive: [],
    notes: 'Each hit: -5% permanent max HP on target. At 10 stacks on the same target: instant defeat regardless of HP.',
  },

  time_freeze: {
    name: 'Time Freeze', rarity: 'mythic',
    desc: 'Once per game, freeze time for everyone but yourself. Take 3 free uncontested turns.',
    passive: [],
    situational: [
      { id: 'tf-active', label: 'Time Frozen (3 free uncontested turns, all others frozen)', passive: [] },
    ],
    notes: 'One use per game only. All other fighters are frozen while you take 3 free turns.',
  },

  forsaken_god: {
    name: 'Forsaken God', rarity: 'mythic',
    desc: 'Allies cannot heal you. Your self-healing is x10. You gain +100% all stats.',
    passive: [
      { stat: 'all_main', op: 'pct', value: 100 },
      { stat: 'heal_pow', op: 'add', value: 900 },
    ],
    notes: 'External healing nullified. Self-healing is x10 (+900 heal power). +100% all stats always active.',
  },

  void_stares_back: {
    name: 'The Void Stares Back', rarity: 'mythic',
    desc: 'Every status effect that would be applied to you instead permanently adds +10% to a random stat. Fully immune to all statuses.',
    passive: [{ stat: 'status_res', op: 'add', value: 100 }],
    cultivation: { label: 'Status Effects Deflected (+10% random stat each)', perStack: [{ stat: 'all_main', op: 'pct', value: 10 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'Full status immunity. Each blocked status permanently adds +10% to one random stat.',
  },

  warlord: {
    name: 'Warlord', rarity: 'mythic',
    desc: "Your stats are equal to the combined sum of all your allies' stats.",
    passive: [],
    notes: "HP, ATK, DEF, MAG, SPD become the total sum of all living allies' matching stats. Updates each round.",
  },

  glitch: {
    name: 'Glitch', rarity: 'mythic',
    desc: 'At the start of each round, all your stats multiply by a random value between x0.01 and x20.',
    passive: [],
    notes: 'New multipliers are rolled each round. Use the REROLL button to simulate a round-start roll.',
  },

  the_long_game: {
    name: 'The Long Game', rarity: 'mythic',
    desc: 'You gain nothing during fights. After each fight you win, permanently gain +10% all stats.',
    passive: [],
    cultivation: { label: 'Fights Won (+10% all stats each)', perStack: [{ stat: 'all_main', op: 'pct', value: 10 }], defaultStacks: 0, maxStacks: 999 },
    notes: 'No in-fight bonuses, buffs, or items apply at all. Only post-win stacks count.',
  },

  phoenix: {
    name: 'Phoenix', rarity: 'mythic',
    desc: 'Revive with no limit. Each revive halves your max HP but permanently doubles your ATK and MAG for that fight.',
    passive: [],
    cultivation: { label: 'Revives This Fight (ATK/MAG x2 per revive; max HP ÷2 per revive)', perStack: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'mag', op: 'mul', value: 2 }], defaultStacks: 0, maxStacks: 20 },
    notes: 'Unlimited revives per fight. Each revive: max HP halved (cumulative), ATK and MAG doubled (cumulative for that fight).',
  },

  no_u: {
    name: 'No U', rarity: 'mythic',
    desc: 'Every point of damage you take is immediately reflected back to the attacker as True Damage.',
    passive: [{ stat: 'true_dmg', op: 'add', value: 100 }],
    notes: 'All received damage is reflected 1:1 as True Damage to the attacker. You still take the original damage.',
  },

  hunger_strike: {
    name: 'Hunger Strike', rarity: 'mythic',
    desc: 'Cannot receive any external buffs, heals, or boosts from any source. x8 all stats.',
    passive: [{ stat: 'all_main', op: 'mul', value: 8 }],
    notes: 'No external buffs, heals, or power-ups of any kind apply. Only self-generated changes are allowed.',
  },

  pacifist_run: {
    name: 'Pacifist Run', rarity: 'mythic',
    desc: 'Cannot deal any damage. Take 90% less damage from all sources. All healing you perform is x20.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 1900 }],
    notes: 'Zero damage output from all sources. Incoming damage reduced by 90%. All healing output is x20.',
  },

  burden: {
    name: 'Burden', rarity: 'mythic',
    desc: 'Each living ally halves your ATK and MAG. Each dead ally triples all your stats.',
    passive: [],
    situational: [
      { id: 'bur-1a', label: '1 living ally (ATK/MAG ÷2)',   passive: [{ stat: 'atk', op: 'pct', value: -50 }, { stat: 'mag', op: 'pct', value: -50 }] },
      { id: 'bur-2a', label: '2 living allies (ATK/MAG ÷4)',  passive: [{ stat: 'atk', op: 'pct', value: -75 }, { stat: 'mag', op: 'pct', value: -75 }] },
      { id: 'bur-3a', label: '3 living allies (ATK/MAG ÷8)',  passive: [{ stat: 'atk', op: 'pct', value: -87 }, { stat: 'mag', op: 'pct', value: -87 }] },
      { id: 'bur-1d', label: '1 dead ally (x3 all stats)',    passive: [{ stat: 'all_main', op: 'mul', value: 3 }] },
      { id: 'bur-2d', label: '2 dead allies (x9 all stats)',  passive: [{ stat: 'all_main', op: 'mul', value: 9 }] },
      { id: 'bur-3d', label: '3 dead allies (x27 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 27 }] },
    ],
    notes: 'Each living ally: ATK and MAG halved (compounding). Each dead ally: all stats tripled (compounding).',
  },

  mall_cop: {
    name: 'Mall Cop', rarity: 'mythic',
    desc: 'SPD is permanently set to 1. DEF is x50. Cannot be knocked back or displaced.',
    passive: [{ stat: 'def', op: 'mul', value: 50 }],
    notes: 'SPD locked at 1. DEF x50. Immune to knockback, displacement, and repositioning effects.',
  },

  permafrost: {
    name: 'Permafrost', rarity: 'mythic',
    desc: 'Permanently FROZEN (cannot move or use abilities). All damage taken reduced by 80%. Passively deal 15% of your max HP as True Damage to all enemies at the start of each round.',
    passive: [],
    notes: 'Cannot move or use abilities ever. 80% damage reduction. Each round start: 15% max HP True Damage AoE to all enemies.',
  },

  berserker_god: {
    name: 'Berserker God', rarity: 'mythic',
    desc: 'Permanently BERSERK. Cannot choose targets. x6 ATK and MAG. Every hit inflicts BLEEDING for 5 turns.',
    passive: [{ stat: 'atk', op: 'mul', value: 6 }, { stat: 'mag', op: 'mul', value: 6 }],
    notes: 'BERSERK: attacks random targets only. On-hit: apply BLEEDING (5 turns). x6 ATK and MAG always.',
  },

  poisoned_chalice: {
    name: 'Poisoned Chalice', rarity: 'mythic',
    desc: 'Permanently POISONED at 10 stacks. Instead of losing HP, gain +10% ATK per stack. Attacks apply 5 stacks of POISON to enemies.',
    passive: [],
    cultivation: { label: 'POISON Stacks on Self (+10% ATK each)', perStack: [{ stat: 'atk', op: 'pct', value: 10 }], defaultStacks: 10, maxStacks: 999 },
    notes: 'Start with 10 POISON stacks. POISON deals no HP damage to you — each stack grants +10% ATK permanently.',
  },

  doomsday_clock: {
    name: 'Doomsday Clock', rarity: 'mythic',
    desc: 'At the start of every fight, apply DOOM to all enemies with a 5-round timer. Each round an enemy remains DOOMED, steal 10% of their current HP as True Damage.',
    passive: [],
    situational: [
      { id: 'ddc-doom', label: 'DOOM Active (steal 10% current HP per round per enemy)', passive: [] },
    ],
    notes: "Fight start: all enemies receive DOOM (5-round timer). Per round: deal 10% of each DOOMED enemy's current HP as True Damage.",
  },

  redline: {
    name: 'Redline', rarity: 'hexxed',
    desc: 'Permanently OVERLOADED. The lower your HP, the more self-damage OVERLOADED inflicts — but the more ATK you gain. Below 25% HP: x3 ATK. Below 10% HP: x7 ATK.',
    passive: [],
    situational: [
      { id: 'rl-low',  label: 'Below 25% HP (OVERLOADED: x3 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 3 }] },
      { id: 'rl-crit', label: 'Below 10% HP (OVERLOADED: x7 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 7 }] },
    ],
    notes: 'Permanently OVERLOADED. OVERLOADED self-damage scales with missing HP. Below 25% → x3 ATK. Below 10% → x7 ATK.',
  },

  voidwalker: {
    name: 'Voidwalker', rarity: 'hexxed',
    desc: 'You are permanently EXPOSED and BRITTLE. For every debuff currently on yourself, gain +50% ATK.',
    passive: [],
    cultivation: { label: 'Debuffs On Self (+50% ATK each)', perStack: [{ stat: 'atk', op: 'pct', value: 50 }], defaultStacks: 2, maxStacks: 999 },
    notes: 'Permanently EXPOSED + BRITTLE (2 base debuffs). Each debuff on self = +50% ATK. Stack more debuffs onto yourself to power up.',
  },
};

// ============================================================
// SHIMMYFUL — 0.1% upgrade for common traits
// ============================================================
const SHIMMYFUL_TRAITS = {
  favored: { name: 'SHIMMYFUL Favored', desc: '+50% Crit Chance.', passive: [{ stat: 'crit_rate', op: 'add', value: 50 }] },
  spicy: { name: 'SHIMMYFUL Spicy', desc: '+40% Resilience.', passive: [{ stat: 'resilience', op: 'add', value: 40 }] },
  sonic: { name: 'SHIMMYFUL Sonic', desc: '+40% SPD, +40% Dexterity.', passive: [{ stat: 'spd', op: 'pct', value: 40 }, { stat: 'dexterity', op: 'add', value: 40 }] },
  flaming: { name: 'SHIMMYFUL Flaming', desc: '100% chance to BURNING on hit. BURNING deals triple damage.', passive: [] },
  enchanted: { name: 'SHIMMYFUL Enchanted', desc: '+40% MAG, +40% Heal Power.', passive: [{ stat: 'mag', op: 'pct', value: 40 }, { stat: 'heal_pow', op: 'add', value: 40 }] },
  steadfast: { name: 'SHIMMYFUL Steadfast', desc: '+40% True Damage. Pierces all resistances.', passive: [{ stat: 'true_dmg', op: 'add', value: 40 }] },
  bombastic: { name: 'SHIMMYFUL Bombastic', desc: 'Explosions are x10 bigger and chain to nearby targets.', passive: [] },
  counterfeit: { name: 'SHIMMYFUL Counterfeit', desc: 'Shops are 60% cheaper.', passive: [] },
  sticky: { name: 'SHIMMYFUL Sticky', desc: "everything you touch is yours :)", passive: [] },
  tough: { name: 'SHIMMYFUL Tough', desc: '+50% DEF.', passive: [{ stat: 'def', op: 'pct', value: 50 }] },
  hearty: { name: 'SHIMMYFUL Hearty', desc: '+65% HP.', passive: [{ stat: 'hp', op: 'pct', value: 65 }] },
  keen: { name: 'SHIMMYFUL Keen', desc: '+45% ATK, +35% Crit Chance.', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'crit_rate', op: 'add', value: 35 }] },
  scholarly: { name: 'SHIMMYFUL Scholarly', desc: '+45% MAG, +50% Cooldown Reduction.', passive: [{ stat: 'mag', op: 'pct', value: 45 }, { stat: 'cooldown_red', op: 'add', value: 50 }] },
  lightfooted: { name: 'SHIMMYFUL Light-Footed', desc: '+75% SPD.', passive: [{ stat: 'spd', op: 'pct', value: 75 }] },
  regenerative: { name: 'SHIMMYFUL Regenerative', desc: '+65% Heal Power, +40% HP.', passive: [{ stat: 'heal_pow', op: 'add', value: 65 }, { stat: 'hp', op: 'pct', value: 40 }] },
  reckless: { name: 'SHIMMYFUL Reckless', desc: '+75% ATK. DEF penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 75 }] },
  ironclad: { name: 'SHIMMYFUL Ironclad', desc: '+65% DEF. SPD penalty removed.', passive: [{ stat: 'def', op: 'pct', value: 65 }] },
  precise: { name: 'SHIMMYFUL Precise', desc: '+55% Crit Chance, +55% Crit Damage. No penalties.', passive: [{ stat: 'crit_rate', op: 'add', value: 55 }, { stat: 'crit_dmg', op: 'add', value: 55 }] },
  glassjaw: { name: 'SHIMMYFUL Glass Jaw', desc: '+75% ATK. Resilience penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 75 }] },
  shocking: { name: 'SHIMMYFUL Shocking', desc: 'Every hit Shocks AND Stuns. Effects last longer.', passive: [] },
  wellfed: { name: 'SHIMMYFUL Well-Fed', desc: '+45% HP, +40% Lifesteal.', passive: [{ stat: 'hp', op: 'pct', value: 45 }, { stat: 'lifesteal', op: 'add', value: 40 }] },
  caffeinated: { name: 'SHIMMYFUL Caffeinated', desc: '+60% SPD, +60% Cooldown Reduction.', passive: [{ stat: 'spd', op: 'pct', value: 60 }, { stat: 'cooldown_red', op: 'add', value: 60 }] },
  stubborn: { name: 'SHIMMYFUL Stubborn', desc: 'Fully immune to ALL crowd control. No exceptions.', passive: [] },
  nightowl: { name: 'SHIMMYFUL Night Owl', desc: '+55% ATK, +55% SPD in the dark or at night.', passive: [], situational: [{ id: 'nightowl-dark', label: 'It is dark / nighttime', passive: [{ stat: 'atk', op: 'pct', value: 55 }, { stat: 'spd', op: 'pct', value: 55 }] }] },
  headstrong: { name: 'SHIMMYFUL Headstrong', desc: '+80% Status Resistance. Immune to 1 status effect per battle.', passive: [{ stat: 'status_res', op: 'add', value: 80 }] },
  resolute: { name: 'SHIMMYFUL Resolute', desc: '+45% Resilience. At ≤30% HP: +65% ATK AND immune to death once.', passive: [{ stat: 'resilience', op: 'add', value: 45 }], situational: [{ id: 'res-low', label: 'Currently at ≤30% HP', passive: [{ stat: 'atk', op: 'pct', value: 65 }] }] },
  grounded: { name: 'SHIMMYFUL Grounded', desc: '+55% DEF. Immune to knockback AND all crowd control.', passive: [{ stat: 'def', op: 'pct', value: 55 }] },
  // LoL-inspired commons
  killingedge: { name: 'SHIMMYFUL Killing Edge', desc: '+18% bonus damage to enemies below 40% HP. Below 20% HP: +35%.', passive: [], situational: [{ id: 'ke-s-40', label: 'Target below 40% HP (+18% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 18 }] }, { id: 'ke-s-20', label: 'Target below 20% HP (+35% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 35 }] }] },
  ironskin: { name: 'SHIMMYFUL Iron Skin', desc: '+18 DEF. Reduce all physical damage taken by 15.', passive: [{ stat: 'def', op: 'add', value: 18 }] },
  carnivore: { name: 'SHIMMYFUL Carnivore', desc: 'Restore 20 HP and 5% max HP on every kill.', passive: [], notes: 'Flat + percent HP restore on each kill.' },
  happyhour: { name: 'SHIMMYFUL Happy Hour', desc: '+18% Heal Power. Using a skill restores 8% of max HP.', passive: [{ stat: 'heal_pow', op: 'add', value: 18 }] },
  energized: { name: 'SHIMMYFUL Energized', desc: 'Every 5th attack deals +80% ATK damage.', passive: [], notes: 'Attack counter passive. Every 5th hit is empowered (+80% ATK).' },
  manasurge: { name: 'SHIMMYFUL Mana Surge', desc: 'Every 3rd attack restores a burst of energy AND grants +15% CDR for 1 turn.', passive: [{ stat: 'cooldown_red', op: 'add', value: 8 }], notes: 'Energy restore + CDR burst every 3rd attack.' },
  armorshred: { name: 'SHIMMYFUL Armor Shred', desc: 'Attacks reduce target DEF by 6% for 2 turns. Stacks up to 5x (max -30% DEF).', passive: [], notes: 'DEF debuff on target. Stacks up to 5x for 2 turns each.' },
  gatheringspeed: { name: 'SHIMMYFUL Gathering Speed', desc: 'Each attack adds +4 SPD per stack (max 8 stacks). Stacks decay when not attacking.', passive: [{ stat: 'spd', op: 'add', value: 20 }], notes: 'SPD shown as average stack value.' },
  poisontrail: { name: 'SHIMMYFUL Poison Trail', desc: 'Toxic trail deals 10 damage per turn and slows enemies 20% SPD for 2 turns.', passive: [], notes: 'Environmental hazard + slow. Higher damage tick.' },
  toughitout: { name: 'SHIMMYFUL Tough It Out', desc: 'After taking 2 hits, generate a shield equal to 15% max HP.', passive: [], notes: 'Shield triggered every 2 incoming hits.' },
  boneplating: { name: 'SHIMMYFUL Bone Plating', desc: 'The first 5 hits received each combat deal 12 less damage.', passive: [], notes: 'Damage reduction extended to first 5 hits per combat.' },
  quickdraw: { name: 'SHIMMYFUL Quick Draw', desc: 'Gain +25% ATK and +15% SPD after skipping an action.', passive: [], situational: [{ id: 'qd-s', label: 'After skipping an action', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 15 }] }] },
  battlescar: { name: 'SHIMMYFUL Battle Scar', desc: 'Gain +2 DEF permanently each time you are hit (max +20 per combat).', passive: [{ stat: 'def', op: 'add', value: 10 }], notes: 'DEF shown as average stack value (10).' },
  nimble: { name: 'SHIMMYFUL Nimble', desc: 'Take 8 less damage from all basic attacks. Also gain +20% Dexterity.', passive: [{ stat: 'def', op: 'add', value: 8 }, { stat: 'dexterity', op: 'add', value: 20 }] },
  arcaneedge: { name: 'SHIMMYFUL Arcane Edge', desc: 'After every skill use, the next attack deals bonus magic damage equal to 30% of MAG.', passive: [{ stat: 'mag', op: 'pct', value: 20 }], notes: 'Bonus magic hit after every skill use.' },
  triumph: { name: 'SHIMMYFUL Triumph', desc: 'On kill, restore 20% of missing HP and gain +10 ATK for 1 turn.', passive: [], situational: [{ id: 'tri-s', label: 'Post-kill turn (+10 ATK)', passive: [{ stat: 'atk', op: 'add', value: 10 }] }] },
  perseverance:  { name: 'SHIMMYFUL Perseverance', desc: '+20% Heal Power. Rapid HP regen begins after only 1 turn out of combat.', passive: [{ stat: 'heal_pow', op: 'add', value: 20 }] },
  oddmushroom:   { name: 'SHIMMYFUL Odd Mushroom', desc: '+35% ATK but only -8% SPD. The upside is bigger; the downside is much smaller.', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'spd', op: 'pct', value: -8 }] },
  spoonbender:   { name: 'SHIMMYFUL Spoon Bender', desc: 'Attacks home toward the enemy. +20% MAG and +25 Dexterity.', passive: [{ stat: 'mag', op: 'pct', value: 20 }, { stat: 'dexterity', op: 'add', value: 25 }] },
  luckypenny:    { name: 'SHIMMYFUL Lucky Penny', desc: 'Start each battle with a coin flip. Heads: +25% to all main stats. Tails: only -5% to all main stats.', passive: [], situational: [{ id: 'lp-s-heads', label: 'Heads — +25% all main stats', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }, { id: 'lp-s-tails', label: 'Tails — -5% all main stats', passive: [{ stat: 'all_main', op: 'pct', value: -5 }] }], notes: 'Flip a coin at battle start. Toggle the matching button.' },
};

// ============================================================
// SHIMMYFUL MYTHICS — 1% chance per mythic roll
// Orange ring matching mythic flame color. ✦ star, orange glow.
// Excludes 7 mythics that already have hexxed variants:
// adaptation, bloodlust, glasscannon, magical, nesting, vengeance, raidboss
const SHIMMYFUL_MYTHIC_TRAITS = {
  acclrsorc: { name: 'SHIMMYFUL Accelerating Sorcery', desc: 'Each turn, +20% Cooldown Reduction and +5% MAG.', passive: [], situational: [{ id: 'as-1', label: 'After 1 turn (+20% CDR, +5% MAG)', passive: [{ stat: 'cooldown_red', op: 'add', value: 20 }, { stat: 'mag', op: 'pct', value: 5 }] }, { id: 'as-3', label: 'After 3 turns (+60% CDR, +15% MAG)', passive: [{ stat: 'cooldown_red', op: 'add', value: 60 }, { stat: 'mag', op: 'pct', value: 15 }] }] },
  brave: { name: 'SHIMMYFUL Bravest of the Brave', desc: 'On pick, guaranteed 3 additional legendary traits. +25% all stats.', passive: [{ stat: 'all_main', op: 'pct', value: 25 }], notes: 'Meta. Grants 3 bonus rare/epic traits on pick; at least one must be epic. Also grants +25% to all stats.' },
  allforyou: { name: 'SHIMMYFUL All for You!', desc: 'Heals & buffs you give allies are x4. You also receive 25% of whatever you give.', passive: [], notes: 'Support multiplier. You receive 25% of buff/heal value as a bonus to yourself.' },
  adaptation: { name: 'SHIMMYFUL Adaptation', desc: 'Every hit from an enemy grants +80% DEF. Stacks infinitely per hit.', passive: [], cultivation: { label: 'Enemy Hits', perStack: { stat: 'def', op: 'pct', value: 80 }, defaultStacks: 0, maxStacks: 999 }, notes: 'Shimmyful version of Adaptation. Each stack represents one enemy hit.' },
  lucifer: { name: "SHIMMYFUL Hellborn", desc: '+50% all stats, +250% SPD, +90% Dex. BURNING stacks deal double damage.', passive: [{ stat: 'all_main', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 250 }, { stat: 'dexterity', op: 'add', value: 90 }] },
  zoe: { name: "SHIMMYFUL Absolute Vitality", desc: '+50% all stats, +250% HP, +90% Heal Power. Heal mirror to self is doubled.', passive: [{ stat: 'all_main', op: 'pct', value: 50 }, { stat: 'hp', op: 'pct', value: 250 }, { stat: 'heal_pow', op: 'add', value: 90 }] },
  honored_one: { name: 'SHIMMYFUL The Honored One', desc: 'If you are the last surviving ally: ATK x7, MAG x7, SPD x3.', passive: [], situational: [{ id: 'ho-last', label: 'Last ally standing', passive: [{ stat: 'atk', op: 'mul', value: 7 }, { stat: 'mag', op: 'mul', value: 7 }, { stat: 'spd', op: 'mul', value: 3 }] }] },
  transcendence: { name: 'SHIMMYFUL Transcendence', desc: 'Twice per session: for one fight, all damage dealt x3 and all damage received is quartered.', passive: [], notes: 'Two activations per session. No permanent stat change.' },
  world_ender: { name: 'SHIMMYFUL World Ender', desc: '+550% ATK, +70% True DMG. Your top 2 strongest attacks each fight bypass all defenses.', passive: [{ stat: 'atk', op: 'pct', value: 550 }, { stat: 'true_dmg', op: 'add', value: 70 }] },
  paradox: { name: 'SHIMMYFUL Paradox', desc: 'At fight start, all stats are inverted AND tripled. Your former highest becomes your new highest.', passive: [{ stat: 'all_main', op: 'mul', value: 3 }], situational: [{ id: 'shim-par-invert', label: 'Stats Inverted (highest ↔ lowest, x3)', passive: [{ stat: 'all_main', op: 'mul', value: 3 }] }], notes: 'At fight start: identify your highest and lowest stats and swap them (and all in-between). All stats are then multiplied by x3. Toggle situational button to show the inverted state is active.' },
  usurper: { name: 'SHIMMYFUL Usurper', desc: 'Steal the enemy\'s top TWO passive stat buffs at fight start. They also take 10% of each stolen stat as True Damage per round.', passive: [], notes: 'Steal top two passive buffs. Enemy bleeds 10% of each stolen value per round as True Damage.' },
  sovereign: { name: 'SHIMMYFUL Sovereign', desc: 'Immune to ALL debuffs, status effects, and damage-over-time. +75% all main stats.', passive: [{ stat: 'all_main', op: 'pct', value: 75 }, { stat: 'status_res', op: 'add', value: 100 }] },
  void_emperor: { name: 'SHIMMYFUL Void Emperor', desc: 'Twice per fight: permanently set any enemy stat to 0 for that fight. Can target HP (minimum 1 HP).', passive: [], notes: 'Valid targets: ATK, DEF, MAG, SPD, or HP (floored at 1 HP). Effect is irreversible for that fight.' },
  plague_bearer: { name: 'SHIMMYFUL Plague Bearer', desc: 'Every hit applies plague that stacks up to 3x. Each stack: -6% to all enemy stats until end of fight.', passive: [], notes: 'Up to 3 stacks per target. Each stack = -6% all stats. Stacks refresh on re-application.' },
  abyss_walker: { name: 'SHIMMYFUL Abyss Walker', desc: '60% chance to phase through any incoming attack (0 damage). Phased attacks also reflect 20% as True Damage. +45% all stats.', passive: [{ stat: 'all_main', op: 'pct', value: 45 }] },
  mythbreaker: { name: 'SHIMMYFUL Mythbreaker', desc: 'Nullify ALL enemy trait effects: legendary, mythic, hexxed, and duality. Your own traits are unaffected.', passive: [] },
  legacy: { name: 'SHIMMYFUL Legacy', desc: 'Upon knockout, transfer 150% of ALL your stats to one chosen ally for the rest of that fight.', passive: [], notes: 'All stats at 150% value transferred to chosen ally on knockout.' },
  ultrakill: { name: 'SHIMMYFUL Ultrakill', desc: 'x4 ATK and x4 SPD. Both drop by -3% each turn. Killing an enemy resets both to full AND grants an extra turn.', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'spd', op: 'mul', value: 4 }], situational: [{ id: 'uk-t1', label: 'After turn 1 (-3% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -3 }, { stat: 'spd', op: 'pct', value: -3 }] }, { id: 'uk-t3', label: 'After turn 3 (-9% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -9 }, { stat: 'spd', op: 'pct', value: -9 }] }, { id: 'uk-t5', label: 'Turn 5+ (-15% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -15 }, { stat: 'spd', op: 'pct', value: -15 }] }] },
  disturbing_peace: { name: 'SHIMMYFUL Disturbing The Peace', desc: 'x1.35 to ATK, MAG, SPD per round (compounding). Mercy Judgment requires only 2+ spares. Locked buff is x4, +150% Heal Power, +150% True DMG.', passive: [], situational: [{ id: 'dp-r1', label: 'Round 1 (x1.35 ATK/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 1.35 }, { stat: 'mag', op: 'mul', value: 1.35 }, { stat: 'spd', op: 'mul', value: 1.35 }] }, { id: 'dp-r2', label: 'Round 2 (x1.82)', passive: [{ stat: 'atk', op: 'mul', value: 1.82 }, { stat: 'mag', op: 'mul', value: 1.82 }, { stat: 'spd', op: 'mul', value: 1.82 }] }, { id: 'dp-r3', label: 'Round 3 (x2.46)', passive: [{ stat: 'atk', op: 'mul', value: 2.46 }, { stat: 'mag', op: 'mul', value: 2.46 }, { stat: 'spd', op: 'mul', value: 2.46 }] }, { id: 'dp-r6', label: 'Round 6 (x6.05)', passive: [{ stat: 'atk', op: 'mul', value: 6.05 }, { stat: 'mag', op: 'mul', value: 6.05 }, { stat: 'spd', op: 'mul', value: 6.05 }] }, { id: 'dp-mercy', label: 'MERCY JUDGMENT (2+ spares, 1 enemy left)', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'mag', op: 'mul', value: 4 }, { stat: 'spd', op: 'mul', value: 4 }, { stat: 'heal_pow', op: 'add', value: 150 }, { stat: 'true_dmg', op: 'add', value: 150 }] }] },
  soul_eater: { name: 'SHIMMYFUL Soul Eater', desc: 'Each kill: absorb 10% of enemy\'s highest stat AND 3% of all their other stats permanently.', passive: [], cultivation: { label: 'Souls Devoured', perStack: [{ stat: 'all_main', op: 'add', value: 5 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Per kill: +10% of enemy top stat to matching stat, +3% of all other enemy stats. Stack approx. for simulator.' },
  unrelentless_hunger: { name: 'SHIMMYFUL Unrelentless Hunger', desc: 'x3 ATK per bleeding enemy. All attacks inflict bleed for 5 turns. With 2+ bleeding enemies: x3 SPD.', passive: [], situational: [{ id: 'uh-1b', label: '1 enemy bleeding (x3 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 3 }] }, { id: 'uh-2b', label: '2 enemies bleeding (x6 ATK + x3 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 6 }, { stat: 'spd', op: 'mul', value: 3 }] }, { id: 'uh-3b', label: '3 enemies bleeding (x9 ATK + x3 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 9 }, { stat: 'spd', op: 'mul', value: 3 }] }, { id: 'uh-4b', label: '4+ enemies bleeding (x12 ATK + x3 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 12 }, { stat: 'spd', op: 'mul', value: 3 }] }] },
  chronoshift: { name: 'SHIMMYFUL Chronoshift', desc: 'When any ally (including yourself) would die, they survive at 60% HP and become invulnerable for 3 turns. Triggers up to 3 times per ally per battle.', passive: [] },
  cosmicradiance: { name: 'SHIMMYFUL Cosmic Radiance', desc: 'Once per battle: after a 1-turn channel, all allies are fully invulnerable for 5 turns and are fully healed at the start of each invulnerable turn.', passive: [] },
  temperedfate: { name: 'SHIMMYFUL Tempered Fate', desc: 'Once per battle: freeze every unit except yourself in stasis for 3 turns. While active, you gain +50% to all main stats and may act freely.', passive: [], situational: [{ id: 'tf-shimmy-active', label: 'SHIMMYFUL Tempered Fate active (+50% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }] },
  attached: { name: 'SHIMMYFUL Attached', desc: 'At battle start, tether to the nearest ally. While attached: you cannot be targeted and grant them 100% of all your stats as bonus stats. You may act freely.\n\nIf your tether ally dies, you detach. Your DEF only drops by 25% for 1 turn.', passive: [], situational: [{ id: 'att-vulnerable-shimmy', label: 'Detached / Vulnerable (-25% DEF)', passive: [{ stat: 'def', op: 'pct', value: -25 }] }] },
  girlyopscurse: { name: "SHIMMYFUL Girlypop's Curse", desc: "MAG is tripled (x3). Upon receiving this curse, gain 3 random common traits and 2 random rare traits. All bonus traits are guaranteed shimmyful. Your character's gender is permanently reversed.", passive: [{ stat: 'mag', op: 'mul', value: 3 }], notes: "On pickup: roll 3 commons + 2 rares, ALL guaranteed shimmyful. Gender reversal is a permanent RP/flavor mechanic." },
  // LoL-inspired mythics
  lastingspoils: { name: 'SHIMMYFUL Lasting Spoils', desc: 'Every enemy defeated permanently grants +10 ATK and +10 DEF per soul. No cap.', passive: [], cultivation: { label: 'Souls Collected', perStack: [{ stat: 'atk', op: 'add', value: 10 }, { stat: 'def', op: 'add', value: 10 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent soul-stacking: +10 ATK and +10 DEF per kill.' },
  icathiansurprise: { name: 'SHIMMYFUL Icathian Surprise', desc: 'On death, explode: deal true damage equal to 75% of your max HP to ALL nearby enemies.', passive: [], notes: 'Death explosion: 75% max HP true damage AoE.' },
  gloryindeath: { name: 'SHIMMYFUL Glory in Death', desc: 'On death, enter undead rage for 5 turns: deal 300% of normal damage and heal from all damage dealt. Cannot die until the 5 turns expire.', passive: [], situational: [{ id: 'gid-s', label: 'While in undead rage (5 turns)', passive: [{ stat: 'atk', op: 'pct', value: 300 }, { stat: 'lifesteal', op: 'add', value: 100 }] }] },
  feast: { name: 'SHIMMYFUL Feast', desc: 'On kill: permanently gain +30 HP, +8 ATK, +5 DEF, and +5 MAG. Every 3rd kill, all future growth bonuses double permanently.', passive: [], cultivation: { label: 'Kills', perStack: [{ stat: 'hp', op: 'add', value: 30 }, { stat: 'atk', op: 'add', value: 8 }, { stat: 'def', op: 'add', value: 5 }, { stat: 'mag', op: 'add', value: 5 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent scaling per kill. Every 3rd kill: growth doubles.' },
  ravonoushunger: { name: 'SHIMMYFUL Ravenous Hunger', desc: 'For every 10% HP missing: gain +25% ATK, +25% lifesteal, and +5% true damage.', passive: [], situational: [{ id: 'rh-s-50', label: 'At 50% HP missing', passive: [{ stat: 'atk', op: 'pct', value: 125 }, { stat: 'lifesteal', op: 'add', value: 125 }, { stat: 'true_dmg', op: 'add', value: 25 }] }, { id: 'rh-s-90', label: 'At 90% HP missing', passive: [{ stat: 'atk', op: 'pct', value: 72 }, { stat: 'lifesteal', op: 'add', value: 72 }, { stat: 'true_dmg', op: 'add', value: 45 }] }] },
  bloodfeud: { name: 'SHIMMYFUL Blood Feud', desc: 'Everyone in the party deals x3 damage to the highest stat enemy.', passive: [], notes: 'Auto-tracks highest-damage enemy. +40% dealt, -25% taken, stolen ATK.' },
  eclipsecycle: { name: 'SHIMMYFUL Eclipse Cycle', desc: 'After being struck, become untargetable for 2 rounds.', passive: [], notes: '2-hit trigger: 1-turn untargetable + reposition. 5-turn cooldown.' },
  voidrift: { name: 'SHIMMYFUL Void Rift', desc: 'Every 3rd skill tears a Void Rift: AoE magic damage equal to 25% of nearby enemies\' max HP and silences them for 2 turns.', passive: [], notes: 'Every 3rd skill: 25% max HP AoE + 2-turn silence.' },
  chronorift: { name: 'SHIMMYFUL Chronorift', desc: 'When you would take lethal damage, rewind to your position and HP from 2 turns ago. Can trigger TWICE per combat.', passive: [], notes: 'Two-use lethal rewind. Rewinds 2 turns of state.' },
  celestialopp: { name: 'SHIMMYFUL Celestial Opposition', desc: 'Alternate SOLAR (+50% ATK, +50% SPD) and LUNAR (+50% DEF, +50% MAG) stances after each action.', passive: [], situational: [{ id: 'co-s-solar', label: 'SOLAR stance (+50% ATK, +50% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] }, { id: 'co-s-lunar', label: 'LUNAR stance (+50% DEF, +50% MAG)', passive: [{ stat: 'def', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }] },
  deathmarklol: { name: 'SHIMMYFUL Deathmark', desc: 'Mark the highest-HP enemy. After 1 turn they take true damage equal to 35% of all damage dealt to them during that turn, and are stunned for 1 turn.', passive: [], notes: 'Burst-back at 35% of all damage + 1-turn stun. Refreshes on new targets.' },
  infiniteduress: { name: 'SHIMMYFUL Infinite Duress', desc: 'Lock onto your most-hit target. Deal +50% damage to them. Steal 10% of their ATK permanently for that combat.', passive: [], notes: '+50% damage vs most-hit target + permanent ATK steal for that fight.' },
  sacredheart:   { name: 'SHIMMYFUL Sacred Heart', desc: '+150% ATK and MAG. +75% HP. +60 Heal Power. All attacks home, pierce, and deal splash damage to adjacent enemies.', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }, { stat: 'hp', op: 'pct', value: 75 }, { stat: 'heal_pow', op: 'add', value: 60 }] },
  // Story/thematic mythics
  thousanddoors:    { name: 'SHIMMYFUL A Thousand Doors', desc: 'For every encounter, permanently increase or decrease a random stat by a random multiplier between x0.5 and x2.5. Effects compound. The multiplier is biased slightly toward positive outcomes.', passive: [], notes: 'Click ROLL ENCOUNTER after each fight. Results are permanent and compound. Wider range than base version.' },
  anotherandanother:{ name: 'SHIMMYFUL Another, and another.', desc: 'Every hit or received hit counts as a drink. ATK and MAG fully randomized (biased lower, max ~1500) on hit. DEF and HP fully randomized on being hit. At 15 drinks: -50% SPD, -50% DEX, +150% Crit Chance, +50% Resilience.', passive: [], situational: [{ id: 'aaa-15-s', label: '15 drinks (max) — -50% SPD, -50% DEX, +150% Crit, +50% Resil', passive: [{ stat: 'spd', op: 'pct', value: -50 }, { stat: 'dexterity', op: 'pct', value: -50 }, { stat: 'crit_rate', op: 'pct', value: 150 }, { stat: 'resilience', op: 'pct', value: 50 }] }], notes: 'Use the REROLL buttons to randomize stats. Shimmyful version has higher max stat values.' },
  lovesick:         { name: 'SHIMMYFUL LOVESICK', desc: 'If you have a lover or partner, all healing toward them is multiplied by x100. You can no longer heal anyone else, including yourself. Your partner also gains +30% all main stats permanently while you live.', passive: [], notes: 'x100 healing to designated partner only. Partner also gets +30% all main stats while you are alive.' },
  godslayer:        { name: 'SHIMMYFUL God Slayer', desc: 'If fighting an enemy stronger than you, copy their 5 highest stats and add those values to your own matching stats for the fight. You also gain +25% all stats against stronger enemies.', passive: [], situational: [{ id: 'gs-s-active', label: 'Fighting stronger enemy (+25% all stats + stat copy)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }], notes: 'When facing a stronger enemy: copy their top 5 stats + gain +25% all stats.' },
  sentafteryou:     { name: 'SHIMMYFUL If they sent me after you', desc: 'In a 1v1, the enemy\'s stats are permanently decreased by 90% for the duration of the fight. You also gain +25% all stats in a 1v1.', passive: [], situational: [{ id: 'say-1v1-s', label: '1v1 active (enemy -90% all stats, you +25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }], notes: 'RP: 1v1 gives +25% all stats to you and applies -90% to opponent.' },
  steelwillfix:     { name: 'SHIMMYFUL Steel will fix all your flaws.', desc: 'Become metallic. x4 DEF, ATK and MAG. You can replace any character\'s current trait with this one. Gain x1.5 all stats per metallic alive. Upon creating 7 metallics, use the EVOLVE button to upgrade to the hexxed form.', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'def', op: 'mul', value: 4 }, { stat: 'mag', op: 'mul', value: 4 }], situational: [{ id: 'swf-1m-s', label: '1 metallic alive (x1.5 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }, { id: 'swf-2m-s', label: '2 metallics (x2.25 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 125 }] }, { id: 'swf-3m-s', label: '3 metallics (x3.375 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 238 }] }, { id: 'swf-4m-s', label: '4 metallics (x5.06 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 406 }] }, { id: 'swf-5m-s', label: '5 metallics (x7.59 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 659 }] }, { id: 'swf-6m-s', label: '6 metallics (x11.39 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 1039 }] }] },
  letthestage:      { name: 'SHIMMYFUL Let the stage see who\'s greater!', desc: 'In a 1v1, both you and the enemy\'s stats are multiplied by x8. The winner permanently absorbs the loser\'s stats after the fight.', passive: [], situational: [{ id: 'lts-1v1-s', label: '1v1 active (x8 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 8 }] }] },
  wontexist:        { name: 'SHIMMYFUL You won\'t exist anymore!', desc: 'Defeated enemies are permanently erased from existence. You gain dormant erasure powers. Erased enemies cannot be referenced, revived, or remembered by other enemies in-universe.', passive: [], notes: 'RP mechanic. Enhanced flavor: erased enemies cannot be revived or referenced.' },
  iamgonnawin:      { name: 'SHIMMYFUL I\'m gonna win.', desc: 'Upon receiving an attack that would knock you out, instead heal to 100% HP and drain all stats from your party members to yourself at 150% efficiency.', passive: [], notes: 'One-time per fight: survive lethal hit at 100% HP and absorb 150% of all ally stats.' },
  unbroken:         { name: 'SHIMMYFUL Unbroken', desc: 'You cannot take physical damage. Magical, true, and status damage still apply. Once per battle, negate one magical hit entirely.', passive: [], notes: 'Physical damage immunity. Once per battle: also negate one magical hit.' },
  themoss:          { name: 'SHIMMYFUL The Moss', desc: 'On-hit, apply SHIMMYFUL MOSS to enemies. Affected enemies lose -10% HP and -20% DEF per turn. SHIMMYFUL MOSS spreads to adjacent enemies on each tick and is only removed by fire.', passive: [], notes: 'SHIMMYFUL MOSS: -10% HP and -20% DEF per turn. Spreads to adjacent enemies. Removed only by fire.' },
  harbingerruin:    { name: 'SHIMMYFUL Harbinger of Ruin', desc: 'When hit, the attacker permanently loses 10% all non-HP stats. On-hit, apply RUIN: target loses 6% all non-HP stats per turn for 3 rounds (stacks up to 7). Upon defeating an enemy, they permanently lose 10% all stats.', passive: [], notes: 'Hit-reaction: permanent -10% all non-HP stats on attacker. RUIN: 6% per turn for 3 rounds, 7 stacks max.' },
  revived:          { name: 'SHIMMYFUL REVIVED', desc: 'Once per campaign: upon fully dying, revive at 100% HP and permanently gain x3 all stats. After reviving, gain two random legendary traits.', passive: [], situational: [{ id: 'rev-active-s', label: 'SHIMMYFUL REVIVED (x3 all stats, permanent)', passive: [{ stat: 'all_main', op: 'mul', value: 3 }] }], notes: 'One-time per campaign. On death: 100% HP + x3 all stats permanently + two random legendary traits.' },

  // ── NEW MYTHIC SHIMMYFULS ────────────────────────────────────
  mathematical:        { name: 'SHIMMYFUL Mathematical', desc: 'Calculate the difference between your highest and lowest non-HP stat. Gain DOUBLE that difference as a flat bonus to all non-HP stats. Additionally, gain +8% to all non-HP stats at the start of each turn in a fight, permanently stacking.', passive: [], cultivation: { label: 'Fight Turns Elapsed', perStack: [{ stat: 'atk', op: 'pct', value: 8 }, { stat: 'def', op: 'pct', value: 8 }, { stat: 'mag', op: 'pct', value: 8 }, { stat: 'spd', op: 'pct', value: 8 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Flat bonus = 2×(highest − lowest non-HP stat). +8%/turn in fight stacking.' },

  vampiric_gambler:    { name: 'SHIMMYFUL Vampiric Gambler', desc: 'Apply VAMPMARK to all enemies at the start of the fight, for 5 rounds. Hitting an enemy applies ANTE UP to yourself. Every time you\'re hit, roll 1d6. D2-D6 = you gain +75% ATK for 2 rounds. D1: You take x3 damage in this hit.', passive: [], situational: [{ id: 'vg-s-d2d6', label: 'Rolled D2-D6 (+75% ATK for 2 rounds)', passive: [{ stat: 'atk', op: 'pct', value: 75 }] }, { id: 'vg-s-d1', label: 'Rolled D1 (x3 damage this hit)', passive: [] }], notes: 'VAMPMARK all enemies (5 rounds). ANTE UP on self when hitting. D1 = x3 damage. D2-D6 = +75% ATK (2 rounds).' },

  intoxicator:         { name: 'SHIMMYFUL Intoxicator', desc: 'Apply DRUNK on-hit with a 85% chance. Apply DRUGGED on-hit with a 50% chance. If a target is DRUNK and DRUGGED, apply 2 stacks of CORRODED on-hit, infinitely stacking. Gain +35% all non-hp stats per drunk, drugged or corroded enemy, all stacking with eachother. x15 DEF towards DRUGGED enemies.', passive: [], situational: [{ id: 'int-s-1d', label: '1 DRUNK/DRUGGED/CORRODED enemy (+35% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'def', op: 'pct', value: 35 }, { stat: 'mag', op: 'pct', value: 35 }, { stat: 'spd', op: 'pct', value: 35 }] }, { id: 'int-s-3d', label: '3 such enemies (+105% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 105 }, { stat: 'def', op: 'pct', value: 105 }, { stat: 'mag', op: 'pct', value: 105 }, { stat: 'spd', op: 'pct', value: 105 }] }, { id: 'int-s-drugged', label: 'Hitting DRUGGED enemy (x15 DEF)', passive: [{ stat: 'def', op: 'mul', value: 15 }] }] },

  hand_of_desecration: { name: 'SHIMMYFUL The Hand of Desecration', desc: 'When an enemy drops below 70% HP, apply DEFERRED, CONFUSED, DOOM, PARALYZED, CURSED, BLEEDING, EXHAUSTED, PIERCED, VAMPMARK, OVERHEAT, FEAR and CORRODED to them. The threshold resets each time they are cleansed.', passive: [], notes: 'Trigger at 70% HP (instead of 60%). Reapplies if statuses are cleansed.' },

  the_shooter:         { name: 'SHIMMYFUL THE SHOOTER', desc: 'If you don\'t have a firearm, gain an energy one based on your soul. Deal x8 damage, x5 attack speed, x3 true damage when using a firearm, as well as infinite ammo.', passive: [{ stat: 'atk', op: 'mul', value: 8 }, { stat: 'true_dmg', op: 'add', value: 150 }], notes: 'x8 damage, x5 attack speed, x3 true damage, infinite ammo with firearms.' },

  forged_destiny:      { name: 'SHIMMYFUL Forged Destiny', desc: 'For every knockout, get +30 ATK. For every spare, get +30 DEF. At the start of a fight, grant flowing and critical. If HP drops below 50%, grant Adrenaline. If an enemy is spared, grant RALLIED for 5 rounds. If an enemy is knocked out, apply BLEEDING to all enemies on the field for 5 rounds.', passive: [], cultivation: { label: 'KOs (ATK) / Spares (DEF)', perStack: [], defaultStacks: 0, maxStacks: 999 }, situational: [{ id: 'fd-s-ko5', label: '5 KOs (+150 ATK)', passive: [{ stat: 'atk', op: 'add', value: 150 }] }, { id: 'fd-s-sp5', label: '5 Spares (+150 DEF)', passive: [{ stat: 'def', op: 'add', value: 150 }] }] },

  shinigami:           { name: 'SHIMMYFUL Shinigami', desc: 'Ability to bring back characters that the enemy has killed to fight alongside you. Three per fight, consumes a turn. Apply CURSED on-hit with a 50% chance. Apply HOLLOW on-hit with a 60% chance. Hitting CURSED enemies applies DOOM. +150% Lifesteal. Hitting HOLLOW enemies applies BRITTLE.', passive: [{ stat: 'lifesteal', op: 'add', value: 150 }], notes: '3 revivals per fight. 50% CURSED, 60% HOLLOW on-hit. CURSED → DOOM. HOLLOW → BRITTLE.' },

  sunrise_trait:       { name: 'SHIMMYFUL SUNRISE', desc: 'every turn, your non-hp stats are multiplied by the Fibonacci formula. (x0, x1, x1, x2, x3, x5, x8...)', passive: [], situational: [{ id: 'sun-s-t1', label: 'Turn 1 (x1 non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 1 }, { stat: 'def', op: 'mul', value: 1 }, { stat: 'mag', op: 'mul', value: 1 }, { stat: 'spd', op: 'mul', value: 1 }] }, { id: 'sun-s-t2', label: 'Turn 2 (x1)', passive: [{ stat: 'atk', op: 'mul', value: 1 }, { stat: 'def', op: 'mul', value: 1 }, { stat: 'mag', op: 'mul', value: 1 }, { stat: 'spd', op: 'mul', value: 1 }] }, { id: 'sun-s-t3', label: 'Turn 3 (x2)', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'def', op: 'mul', value: 2 }, { stat: 'mag', op: 'mul', value: 2 }, { stat: 'spd', op: 'mul', value: 2 }] }, { id: 'sun-s-t4', label: 'Turn 4 (x3)', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'def', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }] }, { id: 'sun-s-t5', label: 'Turn 5 (x5)', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'spd', op: 'mul', value: 5 }] }, { id: 'sun-s-t6', label: 'Turn 6 (x8)',
   passive: [{ stat: 'atk', op: 'mul', value: 8 }, { stat: 'def', op: 'mul', value: 8 }, { stat: 'mag', op: 'mul', value: 8 }, { stat: 'spd', op: 'mul', value: 8 }] }], notes: 'Shimmyful: Fibonacci scales every turn instead of every 2.' },

  thick_of_it:         { name: 'SHIMMYFUL Im in the Thick of It', desc: 'apply BAIT and MARKED to yourself, but gain x30 DEF and x3 ATK.', passive: [{ stat: 'def', op: 'mul', value: 30 }, { stat: 'atk', op: 'mul', value: 3 }], notes: 'BAIT + MARKED on self. x30 DEF, x3 ATK.' },

  womanizer:           { name: 'SHIMMYFUL Womanizer', desc: 'changes people\'s genders on-hit with a 75% chance. +150% status effect resistance', passive: [{ stat: 'status_res', op: 'add', value: 150 }] },

  blood_blood_god:     { name: 'SHIMMYFUL Blood for the Blood God', desc: '+75 ATK for every 3% lifesteal. Applies BLEEDING on-hit, gain +30 atk for every stack of bleeding in a fight.', passive: [{ op: 'derived', stat: 'atk', from: 'lifesteal', per: 3, perValue: 75 }], cultivation: { label: 'BLEEDING stacks in fight', perStack: [{ stat: 'atk', op: 'add', value: 30 }], defaultStacks: 0, maxStacks: 999 } },

  // ── 28 NEW MYTHIC SHIMMYFULS ────────────────────────────────────
  puppet_master:    { name: 'SHIMMYFUL Puppet Master', desc: 'Twice per fight, take control of up to 2 enemies simultaneously for 4 rounds. Puppeteered enemies fight on your side and cannot be targeted by allies.', passive: [], situational: [{ id: 'pm-s-active', label: 'Puppeteering (up to 2 enemies, 4 rounds)', passive: [] }], notes: 'Twice per fight: control 2 enemies for 4 rounds. They cannot be targeted by your allies.' },

  tyrant:           { name: 'SHIMMYFUL Tyrant', desc: 'Fighters without a mythic-or-higher rarity trait deal 80% less damage to you and take 80% more damage from you. Additionally, +30% all stats at all times.', passive: [{ stat: 'all_main', op: 'pct', value: 30 }], situational: [{ id: 'tyr-s-active', label: 'vs. non-mythic+ opponent (-80% dmg in, +80% dmg out)', passive: [{ stat: 'def', op: 'pct', value: 80 }, { stat: 'atk', op: 'pct', value: 80 }] }] },

  armageddon:       { name: 'SHIMMYFUL Armageddon', desc: "At the start of every fight, instantly deal 30% of each enemy's max HP as True Damage and apply BURNING to all of them.", passive: [], notes: 'Fight start: 30% max HP True Damage AoE + BURNING on all enemies.' },

  zenith:           { name: 'SHIMMYFUL Zenith', desc: 'Survive a killing blow twice per fight. After each survival, gain 3 free turns AND permanently gain +50% all stats for that fight.', passive: [], situational: [{ id: 'zen-s-1', label: 'Zenith 1 triggered (+50% all stats, 3 free turns)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }, { id: 'zen-s-2', label: 'Zenith 2 triggered (+100% all stats total, 3 free turns)', passive: [{ stat: 'all_main', op: 'pct', value: 100 }] }] },

  the_final_boss:   { name: 'SHIMMYFUL The Final Boss', desc: 'You have 4 phases. Each defeat triggers the next: full HP restore and +150% all stats (stacking per phase).', passive: [], situational: [{ id: 'tfb-s-p2', label: 'Phase 2 (full HP, +150% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 150 }] }, { id: 'tfb-s-p3', label: 'Phase 3 (full HP, +300% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 300 }] }, { id: 'tfb-s-p4', label: 'Phase 4 (full HP, +450% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 450 }] }], notes: '4 phases. Each defeat: full HP restore + cumulative +150% all stats per phase.' },

  primordial:       { name: 'SHIMMYFUL Primordial', desc: 'Start every fight with 3 free rounds of full untargetability. After the untargetable phase, permanently gain +30% all stats for the rest of that fight.', passive: [], situational: [{ id: 'prim-s-active', label: 'Round 1-3 (untargetable)', passive: [] }, { id: 'prim-s-after', label: 'After untargetable phase (+30% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 30 }] }] },

  martyrs_flame:    { name: "SHIMMYFUL Martyr's Flame", desc: "When any ally dies, deal 200% of their ATK + MAG as True Damage to all enemies and permanently absorb 15% of all their stats.", passive: [], notes: "On ally death: 200% of their ATK + MAG as True Damage AoE + permanently absorb 15% of all their stats." },

  the_abyss:        { name: 'SHIMMYFUL The Abyss', desc: 'At the end of each round n, all your stats are multiplied by 1.25^n. Round 1: x1.25, Round 3: x1.95, Round 5: x3.05, Round 7: x4.77, Round 10: x9.31.', passive: [], situational: [{ id: 'abyss-s-r1', label: 'Round 1  (x1.25 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 1.25 }] }, { id: 'abyss-s-r3', label: 'Round 3  (x1.95 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 1.95 }] }, { id: 'abyss-s-r5', label: 'Round 5  (x3.05 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 3.05 }] }, { id: 'abyss-s-r7', label: 'Round 7  (x4.77 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 4.77 }] }, { id: 'abyss-s-r10', label: 'Round 10 (x9.31 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 9.31 }] }], notes: 'Formula: 1.25^n per round n.' },

  gravity_well:     { name: 'SHIMMYFUL Gravity Well', desc: 'Redirect all damage intended for allies to yourself at only 20% of its value. Reflect 20% of all redirected damage back to the attacker as True Damage.', passive: [], situational: [{ id: 'gw-s-active', label: 'Gravity Well Active (ally damage at 20%, 20% reflected as True Dmg)', passive: [{ stat: 'def', op: 'pct', value: 80 }] }], notes: 'Redirected damage reduced to 20%. 20% of redirected damage reflected as True Damage to attacker.' },

  consumed:         { name: 'SHIMMYFUL Consumed', desc: 'DEF is permanently set to 0. ATK and MAG are x8. You cannot be healed by anyone but yourself. Gain +5% to all non-DEF stats per fight turn (permanent).', passive: [{ stat: 'atk', op: 'mul', value: 8 }, { stat: 'mag', op: 'mul', value: 8 }], cultivation: { label: 'Fight Turns Elapsed (+5% ATK/MAG/SPD/HP each)', perStack: [{ stat: 'atk', op: 'pct', value: 5 }, { stat: 'mag', op: 'pct', value: 5 }, { stat: 'spd', op: 'pct', value: 5 }, { stat: 'hp', op: 'pct', value: 5 }], defaultStacks: 0, maxStacks: 999 }, notes: 'DEF locked at 0. x8 ATK and MAG. +5% non-DEF stats per fight turn (permanent).' },

  blood_moon:       { name: 'SHIMMYFUL Blood Moon', desc: 'During night or full moon fights, x5 all stats. Permanently gain +4% all stats per fight survived.', passive: [], situational: [{ id: 'bm-s-night', label: 'Night / full moon fight (x5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }], cultivation: { label: 'Fights Survived (+4% all stats each)', perStack: [{ stat: 'all_main', op: 'pct', value: 4 }], defaultStacks: 0, maxStacks: 999 } },

  star_eater:       { name: 'SHIMMYFUL Star Eater', desc: "Attacks permanently reduce the target's max HP by 8%. After 7 reductions on the same target, they shatter instantly.", passive: [], notes: 'Each hit: -8% permanent max HP on target. At 7 stacks on the same target: instant defeat.' },

  time_freeze:      { name: 'SHIMMYFUL Time Freeze', desc: 'Twice per game, freeze time for everyone but yourself and take 4 free uncontested turns. During the freeze, you are also invisible.', passive: [], situational: [{ id: 'tf-s-active', label: 'Time Frozen (4 free turns, all frozen, you invisible)', passive: [] }], notes: 'Two uses per game. 4 free uncontested turns each. You are invisible during the freeze.' },

  forsaken_god:     { name: 'SHIMMYFUL Forsaken God', desc: 'Allies cannot heal you. Your self-healing is x20. You gain +200% all stats.', passive: [{ stat: 'all_main', op: 'pct', value: 200 }, { stat: 'heal_pow', op: 'add', value: 1900 }], notes: 'External healing nullified. Self-healing is x20 (+1900 heal power). +200% all stats always active.' },

  void_stares_back: { name: 'SHIMMYFUL The Void Stares Back', desc: 'Every status effect that would be applied to you instead permanently adds +20% to a random stat. Fully immune to all statuses.', passive: [{ stat: 'status_res', op: 'add', value: 100 }], cultivation: { label: 'Status Effects Deflected (+20% random stat each)', perStack: [{ stat: 'all_main', op: 'pct', value: 20 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Full status immunity. Each blocked status permanently adds +20% to one random stat.' },

  warlord:          { name: 'SHIMMYFUL Warlord', desc: "Your stats are equal to 150% of the combined sum of all your allies' stats. Additionally, gain +10% all stats per living ally.", passive: [], notes: "Stats = 150% of combined ally stats. +10% all stats per living ally on top." },

  glitch:           { name: 'SHIMMYFUL Glitch', desc: 'At the start of each round, all your stats multiply by a random value between x0.01 and x30.', passive: [], notes: 'Wider chaos range than base.' },

  the_long_game:    { name: 'SHIMMYFUL The Long Game', desc: 'You gain nothing during fights. After each fight you win, permanently gain +12% all stats. Also gain +12% all stats for each fight survived (win or lose).', passive: [], cultivation: { label: 'Fights Won (+12% all stats each)', perStack: [{ stat: 'all_main', op: 'pct', value: 12 }], defaultStacks: 0, maxStacks: 999 }, notes: 'No in-fight bonuses. +12% all stats per win. +12% all stats per any fight survived (track separately).' },

  phoenix:          { name: 'SHIMMYFUL Phoenix', desc: 'Revive with no limit. Each revive only reduces max HP by 25% but permanently triples your ATK, MAG, and SPD for that fight.', passive: [], cultivation: { label: 'Revives This Fight (ATK/MAG/SPD x3 per revive; max HP -25%)', perStack: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }], defaultStacks: 0, maxStacks: 20 }, notes: 'Each revive: max HP -25% (cumulative); ATK, MAG, and SPD tripled (cumulative for that fight).' },

  no_u:             { name: 'SHIMMYFUL No U', desc: 'Every point of damage you take is reflected back to the attacker as 150% True Damage.', passive: [{ stat: 'true_dmg', op: 'add', value: 150 }], notes: 'All received damage is reflected at 150% as True Damage to the attacker. You still take the original damage.' },

  hunger_strike:    { name: 'SHIMMYFUL Hunger Strike', desc: 'Cannot receive any external buffs, heals, or boosts. x12 all stats.', passive: [{ stat: 'all_main', op: 'mul', value: 12 }], notes: 'No external buffs, heals, or power-ups of any kind. x12 all stats always active.' },

  pacifist_run:     { name: 'SHIMMYFUL Pacifist Run', desc: 'Cannot deal any damage. Take 95% less damage from all sources. All healing you perform is x40.', passive: [{ stat: 'heal_pow', op: 'add', value: 3900 }], notes: 'Zero damage output. Incoming damage reduced by 95%. All healing output is x40.' },

  burden:           { name: 'SHIMMYFUL Burden', desc: 'Each living ally halves your ATK and MAG. Each dead ally quintuples all your stats.', passive: [], situational: [{ id: 'bur-s-1a', label: '1 living ally (ATK/MAG ÷2)', passive: [{ stat: 'atk', op: 'pct', value: -50 }, { stat: 'mag', op: 'pct', value: -50 }] }, { id: 'bur-s-2a', label: '2 living allies (ATK/MAG ÷4)', passive: [{ stat: 'atk', op: 'pct', value: -75 }, { stat: 'mag', op: 'pct', value: -75 }] }, { id: 'bur-s-1d', label: '1 dead ally (x5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }, { id: 'bur-s-2d', label: '2 dead allies (x25 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 25 }] }, { id: 'bur-s-3d', label: '3 dead allies (x125 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 125 }] }], notes: 'Dead allies quintuple all stats (compounding). Living allies still halve ATK/MAG (compounding).' },

  mall_cop:         { name: 'SHIMMYFUL Mall Cop', desc: 'SPD permanently set to 1. DEF is x100. Cannot be knocked back, displaced, or have DEF reduced.', passive: [{ stat: 'def', op: 'mul', value: 100 }], notes: 'SPD locked at 1. DEF x100. Immune to knockback, displacement, and all DEF reduction effects.' },

  permafrost:       { name: 'SHIMMYFUL Permafrost', desc: 'Permanently FROZEN. All damage taken reduced by 90%. Passively deal 25% of your max HP as True Damage to all enemies at the start of each round.', passive: [], notes: 'Cannot move or use abilities. 90% damage reduction. Each round start: 25% max HP True Damage AoE to all enemies.' },

  berserker_god:    { name: 'SHIMMYFUL Berserker God', desc: 'Permanently BERSERK. x10 ATK and MAG. Every hit inflicts BLEEDING for 10 turns and applies MARKED to the target.', passive: [{ stat: 'atk', op: 'mul', value: 10 }, { stat: 'mag', op: 'mul', value: 10 }], notes: 'BERSERK: random targets only. On-hit: BLEEDING (10 turns) + MARKED. x10 ATK and MAG.' },

  poisoned_chalice: { name: 'SHIMMYFUL Poisoned Chalice', desc: 'Permanently POISONED at 20 stacks. Each stack grants +15% ATK and +10% MAG. Attacks apply 10 stacks of POISON to enemies.', passive: [], cultivation: { label: 'POISON Stacks on Self (+15% ATK, +10% MAG each)', perStack: [{ stat: 'atk', op: 'pct', value: 15 }, { stat: 'mag', op: 'pct', value: 10 }], defaultStacks: 20, maxStacks: 999 }, notes: 'Start with 20 POISON stacks. Each stack: +15% ATK, +10% MAG. On-hit: 10 stacks of POISON to enemy.' },

  doomsday_clock:   { name: 'SHIMMYFUL Doomsday Clock', desc: "At the start of every fight, apply DOOM to all enemies with a 10-round timer. Each round, steal 20% of each DOOMED enemy's current HP as True Damage.", passive: [], situational: [{ id: 'ddc-s-doom', label: 'DOOM Active (steal 20% current HP per round per enemy)', passive: [] }], notes: "Fight start: all enemies receive DOOM (10-round timer). Per round: 20% of each DOOMED enemy's current HP as True Damage." },
};

// ============================================================
// SHIMMYFUL EPICS — 1% chance per epic roll
// Purple ring matching epic color. ✦ star, purple glow.
// ============================================================
const SHIMMYFUL_EPIC_TRAITS = {
  economic: { name: 'SHIMMYFUL Economic', desc: 'Shops are 70% cheaper. Sell items for 35% more.', passive: [] },
  pyromaniac: { name: 'SHIMMYFUL Pyromaniac', desc: 'Explosions x8 bigger. BURN AND IGNITE nearby enemies. Heal 12% HP per turn per burning enemy.', passive: [], situational: [{ id: 'pyro-3', label: '3 burning enemies (heal preview)', desc: 'Heal scales with HP.', passive: [] }] },
  prime: { name: 'SHIMMYFUL Prime', desc: '+45% ATK, +45% DEF.', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'def', op: 'pct', value: 45 }] },
  overflowing: { name: 'SHIMMYFUL Overflowing', desc: '+60% Cooldown Reduction.', passive: [{ stat: 'cooldown_red', op: 'add', value: 60 }] },
  vampiric: { name: 'SHIMMYFUL Vampiric', desc: '+55% Lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 55 }] },
  solar: { name: 'SHIMMYFUL Solar', desc: '+65% SPD, +55% Dexterity.', passive: [{ stat: 'spd', op: 'pct', value: 65 }, { stat: 'dexterity', op: 'add', value: 55 }] },
  gambler: { name: 'SHIMMYFUL Gambler', desc: '+55% Crit Chance, +40% Crit Damage.', passive: [{ stat: 'crit_rate', op: 'add', value: 55 }, { stat: 'crit_dmg', op: 'add', value: 40 }] },
  deferred: { name: 'SHIMMYFUL Deferred', desc: '+80% ATK. Damage delivered over 3 turns, and each installment automatically crits.', passive: [{ stat: 'atk', op: 'pct', value: 80 }] },
  trueT: { name: 'SHIMMYFUL True', desc: '+80% True Damage.', passive: [{ stat: 'true_dmg', op: 'add', value: 80 }] },
  heavyhitter: { name: 'SHIMMYFUL Heavy Hitter', desc: '+10 ATK per 50 HP. Capped at +600 ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'hp', per: 50, perValue: 10, cap: 600 }] },
  clothesline: { name: 'SHIMMYFUL Clothesline', desc: 'Tether laser scales with ATK x1.5, slows enemies 25%, and stuns them on crit.', passive: [] },
  dawn: { name: "SHIMMYFUL Dawnbringer's Resolve", desc: 'At ≤60% HP, recover 20% HP every turn until full.', passive: [], situational: [{ id: 'dawn-low', label: 'Currently at ≤60% HP', desc: 'Sustained healing.', passive: [] }] },
  warmup: { name: 'SHIMMYFUL Warmup Routine', desc: 'Warmup takes only half a turn. After: +40% all main stats. Can keep going indefinitely.', passive: [], situational: [{ id: 'warmup-done', label: 'Warmup completed', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }] },
  colossus: { name: 'SHIMMYFUL Colossus', desc: '+60% HP, +60% DEF.', passive: [{ stat: 'hp', op: 'pct', value: 60 }, { stat: 'def', op: 'pct', value: 60 }] },
  archmage: { name: 'SHIMMYFUL Archmage', desc: '+65% MAG, +40% CDR, +40% Heal Power.', passive: [{ stat: 'mag', op: 'pct', value: 65 }, { stat: 'cooldown_red', op: 'add', value: 40 }, { stat: 'heal_pow', op: 'add', value: 40 }] },
  phantom: { name: 'SHIMMYFUL Phantom', desc: '+55% SPD, +45% Dexterity, +35% Crit Chance.', passive: [{ stat: 'spd', op: 'pct', value: 55 }, { stat: 'dexterity', op: 'add', value: 45 }, { stat: 'crit_rate', op: 'add', value: 35 }] },
  juggernaut: { name: 'SHIMMYFUL Juggernaut', desc: '+60% ATK, +40% HP. SPD penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'hp', op: 'pct', value: 40 }] },
  irongiant: { name: 'SHIMMYFUL Iron Giant', desc: '+16 DEF per 100 HP. The more HP you have, the tougher you get.', passive: [{ op: 'derived', stat: 'def', from: 'hp', per: 100, perValue: 16 }] },
  spellblade: { name: 'SHIMMYFUL Spellblade', desc: '+1 ATK per 2 MAG. Magic fuels your physical hits harder.', passive: [{ op: 'derived', stat: 'atk', from: 'mag', per: 2, perValue: 1 }] },
  reaper: { name: 'SHIMMYFUL Reaper', desc: 'Killing an enemy restores 50% HP AND permanently grants +10% ATK for that fight.', passive: [], situational: [{ id: 'reap-1', label: '1 kill (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'reap-3', label: '3 kills (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }] },
  onslaught: { name: 'SHIMMYFUL Onslaught', desc: 'Each consecutive attack turn without being hit: +10% ATK. Stacks up to 5x. Resets if you take damage.', passive: [], situational: [{ id: 'ons-1', label: '1 turn streak (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'ons-3', label: '3 turn streak (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'ons-5', label: '5 turn streak (+50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  absorbent: { name: 'SHIMMYFUL Absorbent', desc: 'Each hit you take: +4% DEF for the rest of the fight. Resets between fights.', passive: [], situational: [{ id: 'abs-5', label: 'After 5 hits taken (+20% DEF)', passive: [{ stat: 'def', op: 'pct', value: 20 }] }, { id: 'abs-10', label: 'After 10 hits taken (+40% DEF)', passive: [{ stat: 'def', op: 'pct', value: 40 }] }] },
  mirror: { name: 'SHIMMYFUL Mirror', desc: 'Reflect 35% of all damage taken back as True Damage.', passive: [] },
  echo: { name: 'SHIMMYFUL Echo', desc: 'Every 3rd attack fires twice for full damage. Both hits can crit and apply all on-hit effects.', passive: [] },
  timebomb: { name: 'SHIMMYFUL Time Bomb', desc: 'Once per fight, mark ALL enemies. Each takes double damage on their next hit received.', passive: [] },
  overdose: { name: 'SHIMMYFUL Overdose', desc: 'Being healed above max HP permanently converts the excess into +40% ATK for the rest of that fight.', passive: [], situational: [{ id: 'od-active', label: 'Overhealed (permanent ATK boost active)', passive: [{ stat: 'atk', op: 'pct', value: 40 }] }] },
  shieldbreak: { name: 'SHIMMYFUL Shield Breaker', desc: '+60% ATK AND +30% True Damage vs any enemy that has a shield or barrier active.', passive: [], situational: [{ id: 'sb-shielded', label: 'Enemy has a shield or barrier', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'true_dmg', op: 'add', value: 30 }] }] },
  warden: { name: 'SHIMMYFUL Warden', desc: 'When any ally drops below 40% HP, shield them for 30% of your HP AND grant them +15% ATK.', passive: [] },
  empower: { name: 'SHIMMYFUL Empower', desc: 'Buffs and heals you give allies are 100% stronger. Those buffs also affect you at 50% value.', passive: [] },
  commander: { name: 'SHIMMYFUL Commander', desc: 'All allies gain +30% ATK and +15% DEF while you are above 50% HP.', passive: [], situational: [{ id: 'cmd-up', label: 'You are above 50% HP (allies +30% ATK, +15% DEF)', desc: 'Ally buff. No self stat impact.', passive: [] }] },
  second_skin: { name: 'SHIMMYFUL Second Skin', desc: '+40% DEF. The first two hits you take each fight deal 0 damage.', passive: [{ stat: 'def', op: 'pct', value: 40 }] },
  blitz: { name: 'SHIMMYFUL Blitz', desc: '+65% ATK, +45% Crit Chance. DEF penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 65 }, { stat: 'crit_rate', op: 'add', value: 45 }] },
  siphon: { name: 'SHIMMYFUL Siphon', desc: 'At the end of each round, drain 12% of the target\'s current HP as healing.', passive: [], situational: [{ id: 'sp-1', label: '1 round of drain (12% target HP healed)', desc: 'Calculate from target\'s current HP each round.', passive: [] }] },
  double_tap: { name: 'SHIMMYFUL Double Tap', desc: 'After landing a kill, bonus attack on nearest enemy at +100% ATK. If that kills too, chain once more.', passive: [] },
  sentinel: { name: 'SHIMMYFUL Sentinel', desc: '40% of all damage dealt to nearby allies is redirected to you. -15% of that redirected damage. +30% DEF.', passive: [{ stat: 'def', op: 'pct', value: 30 }] },
  pressure_pt: { name: 'SHIMMYFUL Pressure Point', desc: 'Every 3rd consecutive hit on the same target deals triple damage and stuns them for 2 rounds.', passive: [] },
  deadweight: { name: 'SHIMMYFUL Deadweight', desc: '+12% ATK per item currently equipped. More gear, more force.', passive: [], situational: [{ id: 'dw-2', label: '2 items equipped (+24% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 24 }] }, { id: 'dw-4', label: '4 items equipped (+48% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 48 }] }, { id: 'dw-6', label: '6 items equipped (+72% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 72 }] }, { id: 'dw-8', label: '8 items equipped (+96% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 96 }] }] },
  chain: { name: 'SHIMMYFUL Chain', desc: 'Every crit arcs to TWO nearby enemies for 65% of the damage each.', passive: [] },
  war_drum: { name: 'SHIMMYFUL War Drum', desc: 'All allies gain +20% ATK. You gain an additional +10% ATK per ally that currently has any buff active.', passive: [], situational: [{ id: 'wd-1', label: '1 buffed ally (+10% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'wd-2', label: '2 buffed allies (+20% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 20 }] }, { id: 'wd-3', label: '3 buffed allies (+30% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }] },
  overclock: { name: 'SHIMMYFUL Overclock', desc: '+65% Cooldown Reduction. Damage penalty removed.', passive: [{ stat: 'cooldown_red', op: 'add', value: 65 }] },
  shadowstrike: { name: 'SHIMMYFUL Shadowstrike', desc: 'The first two attacks each fight ignore DEF entirely and deal True Damage equal to 40% of the target\'s current HP.', passive: [] },
  grounded: { name: 'SHIMMYFUL Grounded', desc: 'Immune to ALL crowd control. +40% DEF vs magic. +35% Status Resistance.', passive: [{ stat: 'status_res', op: 'add', value: 35 }] },
  piles_of_bones: { name: 'SHIMMYFUL Piles of Bones', desc: '+2% Crit Chance and +2% Crit Damage per kill. Permanent.', passive: [], cultivation: { label: 'Kills', perStack: [{ stat: 'crit_rate', op: 'add', value: 2 }, { stat: 'crit_dmg', op: 'add', value: 2 }], defaultStacks: 0, maxStacks: 500 } },
  spite: { name: 'SHIMMYFUL Spite', desc: '+30% ATK AND +15% DEF per debuff or status effect currently active on you.', passive: [], situational: [{ id: 'sp-1', label: '1 debuff active (+30% ATK, +15% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'def', op: 'pct', value: 15 }] }, { id: 'sp-2', label: '2 debuffs active (+60% ATK, +30% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'def', op: 'pct', value: 30 }] }, { id: 'sp-3', label: '3 debuffs active (+90% ATK, +45% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 90 }, { stat: 'def', op: 'pct', value: 45 }] }] },
  exposed: { name: 'SHIMMYFUL Exposed', desc: 'Your DEF is 0. After your first hit, target\'s DEF is 0 for the entire fight. +50% ATK compensation.', passive: [{ stat: 'def', op: 'pct', value: -100 }, { stat: 'atk', op: 'pct', value: 50 }] },
  vitalsiphon: { name: 'SHIMMYFUL Vital Siphon', desc: '+1% Lifesteal per 20 DEF.', passive: [{ op: 'derived', stat: 'lifesteal', from: 'def', per: 20, perValue: 1 }] },
  corepiercer: { name: 'SHIMMYFUL Core Piercer', desc: '+1% True Damage per 10 ATK.', passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 10, perValue: 1 }] },
  desperate: { name: 'SHIMMYFUL Desperate Measures', desc: 'At ≤40% HP: +80% MAG, +80% CDR, and +40% Heal Power.', passive: [], situational: [{ id: 'desperate-crisis', label: 'Currently at ≤40% HP', passive: [{ stat: 'mag', op: 'pct', value: 80 }, { stat: 'cooldown_red', op: 'add', value: 80 }, { stat: 'heal_pow', op: 'add', value: 40 }] }] },
  rampage: { name: 'SHIMMYFUL Rampage', desc: 'Each enemy defeated grants +25% ATK and +20% SPD for the rest of the fight (max 6x).', passive: [], situational: [{ id: 'rampage-1', label: '1 enemy defeated (+25% ATK, +20% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 20 }] }, { id: 'rampage-6', label: '6+ enemies defeated (+150% ATK, +120% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'spd', op: 'pct', value: 120 }] }] },
  bounty: { name: 'SHIMMYFUL Bounty Hunter', desc: 'Each enemy defeated permanently grants +2 Dexterity and +1 Crit Chance (max 100 stacks).', passive: [], cultivation: { label: 'Enemies Defeated', perStack: [{ stat: 'dexterity', op: 'add', value: 2 }, { stat: 'crit_rate', op: 'add', value: 1 }], defaultStacks: 0, maxStacks: 100 } },
  kinetic: { name: 'SHIMMYFUL Kinetic Shielding', desc: 'Taking damage grants +20% SPD and +20 Dexterity for 3 turns (max 5 stacks).', passive: [], situational: [{ id: 'kin-1', label: '1 stack active (+20% SPD, +20 Dexterity)', passive: [{ stat: 'spd', op: 'pct', value: 20 }, { stat: 'dexterity', op: 'add', value: 20 }] }, { id: 'kin-5', label: '5 stacks active (+100% SPD, +100 Dexterity)', passive: [{ stat: 'spd', op: 'pct', value: 100 }, { stat: 'dexterity', op: 'add', value: 100 }] }] },
  whimsy: { name: 'SHIMMYFUL Whimsy', desc: 'Choose a mode before battle.\n\nPOLYMORPH: Transform one enemy into a harmless critter for 2 turns.\nEMPOWER: Grant one ally +80% SPD, +50% ATK, and +50% MAG for 2 turns.', passive: [] },
  powerchord: { name: 'SHIMMYFUL Power Chord', desc: 'Every 2nd ability activates a Power Chord. All effects are doubled:\n♪ Hymn: +50% ATK to all allies for 2 turns.\n♪ Aria: Heal most-hurt ally for 40% HP.\n♪ Celerity: +60% SPD to all allies for 1 turn.', passive: [] },
  starcall: { name: 'SHIMMYFUL Starcall', desc: 'Passively heal all allies for 10% max HP each turn. If any enemy is silenced, healing triples to 30% HP.', passive: [] },
  cozycampfire: { name: 'SHIMMYFUL Cozy Campfire', desc: 'Deploy a healing zone for 4 turns. Allies inside heal 15% HP per turn and gain +25% to all healing received.', passive: [] },
  mantra: { name: 'SHIMMYFUL Mantra', desc: 'Every 3rd ability is Mantra-empowered, tripling its effect: shields are massive, heals restore far more, and debuffs last 2 extra turns.', passive: [] },
  equinox: { name: 'SHIMMYFUL Equinox', desc: 'Create a zone of silence for 3 turns. Enemies inside cannot use abilities and lose 20% SPD.', passive: [] },
  // LoL-inspired epics
  noxianmight: { name: 'SHIMMYFUL Noxian Might', desc: 'When Hemorrhage reaches 5 stacks on a target: gain +80% ATK for 3 turns.', passive: [], situational: [{ id: 'nm-s', label: 'Hemorrhage at 5 stacks (+80% ATK, 3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 80 }] }] },
  divineascent: { name: 'SHIMMYFUL Divine Ascent', desc: 'Build Zeal stacks (max 4). At 4 stacks, become Exalted for 2 turns: +50% ATK and 100% crit chance.', passive: [], situational: [{ id: 'da-s', label: 'While Exalted (2 turns, +50% ATK, 100% crit)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'crit_rate', op: 'add', value: 100 }] }] },
  pitgrit: { name: 'SHIMMYFUL Pit Grit', desc: 'Track all damage taken over 2 turns. Store 60% of that total as a shield that deploys when damage stops.', passive: [], notes: 'Damage absorption shield at 60% conversion.' },
  reignofanger: { name: 'SHIMMYFUL Reign of Anger', desc: 'Above 50 Fury: gain +35% ATK, +20% lifesteal, and +20% SPD. Fury decays out of combat.', passive: [], situational: [{ id: 'roa-s', label: 'Above 50 Fury (+35% ATK, +20% lifesteal, +20% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'lifesteal', op: 'add', value: 20 }, { stat: 'spd', op: 'pct', value: 20 }] }] },
  deathbringstance: { name: 'SHIMMYFUL Deathbringer Stance', desc: 'Every 3rd attack deals 12% of the target\'s max HP as bonus damage and heals you for the same amount.', passive: [], notes: 'Every 3rd hit: 12% max HP bonus damage + self heal.' },
  arcaneburstcharge: { name: 'SHIMMYFUL Arcane Burst', desc: 'At 2 attack charges between skill casts, the next skill deals +70% extra damage.', passive: [], notes: '2-attack charge counter between skill casts. Larger burst.' },
  brittleapply: { name: 'SHIMMYFUL Brittle', desc: 'Skills apply Brittle. Attacks against Brittle targets deal +25% damage and reduce their DEF for 2 turns.', passive: [], notes: 'Stronger Brittle mark. DEF reduction lasts 2 turns.' },
  fervorofbattle: { name: 'SHIMMYFUL Fervor of Battle', desc: 'Skills grant Fervor stacks (+5% ATK each, max 10 stacks). Stacks decay out of combat.', passive: [], situational: [{ id: 'fob-s-max', label: 'At max Fervor (10 stacks, +50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  shepherdofsouls: { name: 'SHIMMYFUL Shepherd of Souls', desc: 'Every nearby death spawns 2 Spectral Ghouls that fight alongside you for 5 turns.', passive: [], notes: 'Summons 2 ghouls per nearby death. Each lasts 5 turns.' },
  petricite: { name: 'SHIMMYFUL Petricite Burst', desc: 'Max 3 weapon charges. Charged attacks deal +45% magic damage in a large arc.', passive: [{ stat: 'mag', op: 'pct', value: 20 }], notes: '3-charge cap. Larger burst radius and higher magic damage.' },
  berserkerrage: { name: 'SHIMMYFUL Berserker Rage', desc: 'At 50% HP: +45% ATK speed. At 10% HP: +90% ATK speed and +20% lifesteal.', passive: [], situational: [{ id: 'br-s-half', label: 'At 50% HP (+45% ATK speed)', passive: [{ stat: 'spd', op: 'pct', value: 28 }] }, { id: 'br-s-low', label: 'At 10% HP (+90% ATK speed, +20% lifesteal)', passive: [{ stat: 'spd', op: 'pct', value: 55 }, { stat: 'lifesteal', op: 'add', value: 20 }] }] },
  markofthestorm: { name: 'SHIMMYFUL Mark of the Storm', desc: 'At 2 Storm Marks on one target: stun them for 2 turns and consume marks.', passive: [], notes: '2 marks = 2-turn stun. Marks applied by skills.' },
  runicblade: { name: 'SHIMMYFUL Runic Blade', desc: 'Each skill cast loads up to 5 empowered charges. Attacks spend charges for +20% ATK each.', passive: [], notes: 'Up to 5 charges at +20% ATK per hit.' },
  organicdeconstruct: { name: 'SHIMMYFUL Organic Deconstruction', desc: 'Hitting the same target with 3 different attack types triggers a true damage explosion equal to 20% of their max HP.', passive: [{ stat: 'true_dmg', op: 'add', value: 15 }], notes: '3-type combo: 20% max HP true damage explosion.' },
  sunlightmark: { name: 'SHIMMYFUL Sunlight', desc: 'Skills apply Sunlight mark. The next ally attack on a marked target deals bonus light damage equal to 30% of your MAG.', passive: [{ stat: 'mag', op: 'pct', value: 18 }], notes: 'Ally attacks on your marked targets deal 30% MAG bonus damage.' },
  presstheattack: { name: 'SHIMMYFUL Press the Attack', desc: 'Hit an enemy 3 times in a row to expose them: they take +25% increased damage from all sources for 3 turns.', passive: [], notes: '3 consecutive hits = 3-turn expose debuff.' },
  whiplash: { name: 'SHIMMYFUL Whiplash', desc: 'After any displacement, the next attack deals +70% damage and briefly stuns the target.', passive: [], notes: '+70% damage + stun on first attack after displacement.' },
  phaserush: { name: 'SHIMMYFUL Phase Rush', desc: 'Hitting an enemy 3 times in one turn grants +55 SPD and full slow immunity for 2 turns.', passive: [{ stat: 'spd', op: 'add', value: 20 }], situational: [{ id: 'pr-s', label: 'Phase Rush active (+55 SPD, 2 turns)', passive: [{ stat: 'spd', op: 'add', value: 55 }] }] },
  graspundying: { name: 'SHIMMYFUL Grasp of the Undying', desc: 'Every 2 turns, the next attack heals 12% of the target\'s max HP and permanently increases your max HP by 10.', passive: [{ stat: 'heal_pow', op: 'add', value: 20 }], notes: 'Higher heal + +10 max HP per proc.' },
  electrocute: { name: 'SHIMMYFUL Electrocute', desc: 'Hit an enemy with 3 separate attacks in one turn to trigger lightning dealing 80 + 60% ATK as magic damage.', passive: [], notes: '3-hit lightning within one turn. Larger damage.' },
  darkharvestlol: { name: 'SHIMMYFUL Dark Harvest', desc: 'Killing low-HP enemies permanently grants +4 true damage and +2% ATK per stack. Stacks persist across fights.', passive: [{ stat: 'true_dmg', op: 'add', value: 8 }, { stat: 'atk', op: 'pct', value: 5 }], notes: 'Stacking true damage and ATK on low-HP kills. Permanent.' },
  envy:          { name: 'SHIMMYFUL Envy', desc: 'Copy the last 2 different stat buffs used by any enemy simultaneously. Both bonuses persist until each is individually replaced.', passive: [], notes: 'Mirrors the 2 most recent distinct stat buffs from any enemy. Track both manually.' },
  ouroboros:     { name: 'SHIMMYFUL Ouroboros', desc: 'On death, fully revive at 100% HP. ATK/DEF and MAG/SPD swap, and you gain +50% to all main stats. Can trigger TWICE per battle.', passive: [], situational: [{ id: 'ouro-s-phase', label: 'Ouroboros Phase (stats swapped + +50% all main stats)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }], notes: 'Two-use revive per battle. Each revive: ATK swaps DEF, MAG swaps SPD, +50% all main stats.' },
  whoreofbabylon:{ name: 'SHIMMYFUL Whore of Babylon', desc: 'When below 33% HP: automatically gain +75% ATK, +60% SPD, and only -10% DEF. The downside nearly disappears.', passive: [], situational: [{ id: 'wob-s-active', label: 'SHIMMYFUL Whore of Babylon active (below 33% HP)', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'spd', op: 'pct', value: 60 }, { stat: 'def', op: 'pct', value: -10 }] }] },
  missingno:     { name: 'SHIMMYFUL Missing No.', desc: 'At the start of each battle, all your stats are independently randomized between x0.25 and x5.5 of their base values. One randomly chosen stat is also locked to exactly x3.', passive: [], notes: 'Each stat rolled 0.25x–5.5x base. One random stat guaranteed x3. Pure chaos with a guaranteed upside.' },
  jackpot:       { name: 'SHIMMYFUL Jackpot', desc: 'On kill: roll 1d3. 1 = +30 ATK permanently. 2 = +30 DEF permanently. 3 = restore 50% HP.', passive: [], situational: [{ id: 'jp-s-atk1', label: '1x rolled 1 — +30 ATK', passive: [{ stat: 'atk', op: 'add', value: 30 }] }, { id: 'jp-s-atk2', label: '2x rolled 1 — +60 ATK', passive: [{ stat: 'atk', op: 'add', value: 60 }] }, { id: 'jp-s-atk3', label: '3x rolled 1 — +90 ATK', passive: [{ stat: 'atk', op: 'add', value: 90 }] }, { id: 'jp-s-def1', label: '1x rolled 2 — +30 DEF', passive: [{ stat: 'def', op: 'add', value: 30 }] }, { id: 'jp-s-def2', label: '2x rolled 2 — +60 DEF', passive: [{ stat: 'def', op: 'add', value: 60 }] }, { id: 'jp-s-def3', label: '3x rolled 2 — +90 DEF', passive: [{ stat: 'def', op: 'add', value: 90 }] }], notes: 'On kill, roll 1d3. Toggle the closest stack count. Roll 3 = 50% HP restore.' },
  // Story/thematic epics
  ascendedtogether:{ name: 'SHIMMYFUL Ascended Together.', desc: 'If an ally transforms or ascends, you automatically transform into a similar version of their form and gain +30% all stats for the fight.', passive: [], situational: [{ id: 'at-s-active', label: 'Ascended (mirroring ally transformation, +30% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 30 }] }], notes: 'RP: mirrors ally transformation. +30% all stats while transformed.' },
  overlooked:      { name: 'SHIMMYFUL Overlooked', desc: 'If your stats are lower than every other unit in the fight, gain x15 Crit Chance and x15 Crit Damage.', passive: [], situational: [{ id: 'ovk-s-active', label: 'SHIMMYFUL Overlooked active (lowest stats in fight)', passive: [{ stat: 'crit_rate', op: 'pct', value: 1400 }, { stat: 'crit_dmg', op: 'pct', value: 1400 }] }] },
  soreloser:       { name: 'SHIMMYFUL Sore Loser', desc: 'Upon being defeated, the enemy who dealt the killing blow permanently loses 50% of their highest stat and 10% of all their other stats.', passive: [], notes: 'On-defeat trigger: attacker loses 50% of highest stat and 10% of all others permanently.' },
  toottoo:         { name: 'SHIMMYFUL Too Too', desc: 'You are equipped with a shimmyful tutu. Gain +75% SPD every time you are hit (stacking). 1 SPD = +1.5 ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'spd', per: 1, perValue: 1.5 }], situational: [{ id: 'tt-s-1', label: '1 hit taken (+75% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 75 }] }, { id: 'tt-s-2', label: '2 hits taken (+150% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 150 }] }, { id: 'tt-s-4', label: '4 hits taken (+300% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 300 }] }, { id: 'tt-s-6', label: '6 hits taken (+450% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 450 }] }, { id: 'tt-s-10', label: '10 hits taken (+750% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 750 }] }], notes: 'SPD stacks on each hit. ATK bonus from SPD is derived at 1.5x rate.' },
  tillicollapse:   { name: 'SHIMMYFUL Till i Collapse', desc: 'Push the knockout threshold even further, gaining +75% HP. Your stats are x1.6 at full health, scaling down to x0.75 near the threshold.', passive: [{ stat: 'hp', op: 'pct', value: 75 }], situational: [{ id: 'tic-s-full', label: 'Full HP (x1.6 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 60 }] }, { id: 'tic-s-75', label: 'Below 75% HP (x1.4 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }, { id: 'tic-s-50', label: 'Below 50% HP (x1.15 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'tic-s-25', label: 'Below 25% HP (x0.9 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -10 }] }, { id: 'tic-s-low', label: 'Near knockout (x0.75 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -25 }] }] },
};

// ============================================================
// SHIMMYFUL RARES — 1% chance per rare roll
// Blue ring. Same ✦ star as common, but blue-glowing.
// ============================================================
const SHIMMYFUL_RARE_TRAITS = {
  assassin: { name: 'SHIMMYFUL Assassin', desc: 'The higher the enemy HP, the greater your damage (0%–55%).', passive: [], situational: [{ id: 'asn-max', label: 'Enemy at MAX HP', passive: [{ stat: 'atk', op: 'pct', value: 55 }] }, { id: 'asn-half', label: 'Enemy at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 27 }] }] },
  executioner: { name: 'SHIMMYFUL Executioner', desc: 'The lower the enemy HP, the greater your damage (0%–55%).', passive: [], situational: [{ id: 'exe-low', label: 'Enemy near 0% HP', passive: [{ stat: 'atk', op: 'pct', value: 55 }] }, { id: 'exe-half', label: 'Enemy at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 27 }] }] },
  lethal: { name: 'SHIMMYFUL Lethal', desc: '+35% True Damage.', passive: [{ stat: 'true_dmg', op: 'add', value: 35 }] },
  toxic: { name: 'SHIMMYFUL Toxic', desc: 'Attacks POISON twice. Poisoned enemies take +20% ATK bonus damage from you.', passive: [] },
  frostbite: { name: 'SHIMMYFUL Frostbite', desc: 'Attacks FREEZE AND SHATTER. Shattered enemies take double ATK damage.', passive: [] },
  buff: { name: 'SHIMMYFUL Buff', desc: '+35% ATK.', passive: [{ stat: 'atk', op: 'pct', value: 35 }] },
  armored: { name: 'SHIMMYFUL Armored', desc: '+35% DEF.', passive: [{ stat: 'def', op: 'pct', value: 35 }] },
  workhorse: { name: 'SHIMMYFUL Workhorse', desc: '+35% Cooldown Reduction.', passive: [{ stat: 'cooldown_red', op: 'add', value: 35 }] },
  shielding: { name: 'SHIMMYFUL Shielding', desc: 'Start of fight: shield for 10% of HP. Each round at MAX HP, gain another. Stacks infinitely.', passive: [], situational: [{ id: 'shield-stack', label: 'Per shield stack (vs HP)', desc: 'Each stack = 10% HP as shield.', passive: [] }] },
  saving: { name: 'SHIMMYFUL Saving Habits', desc: 'Shops are 40% cheaper. Sell items for 25% more.', passive: [] },
  voided: { name: 'SHIMMYFUL Voided', desc: '15% chance on hit to spawn black holes that pull ALL nearby enemies and deal bonus True Damage.', passive: [] },
  legday: { name: 'SHIMMYFUL Leg Day', desc: 'MASSIVE thighs. +35% SPD, +35% Dexterity.', passive: [{ stat: 'spd', op: 'pct', value: 35 }, { stat: 'dexterity', op: 'add', value: 35 }] },
  shrinkray: { name: 'SHIMMYFUL Shrink Ray', desc: 'Damage shrinks enemies to 25% size, reducing their DEF by 15% AND ATK by 15%.', passive: [] },
  vital: { name: 'SHIMMYFUL Vital', desc: '+35% HP.', passive: [{ stat: 'hp', op: 'pct', value: 35 }] },
  swiftstrike: { name: 'SHIMMYFUL Swiftstrike', desc: '+35% SPD, +25% Crit Chance.', passive: [{ stat: 'spd', op: 'pct', value: 35 }, { stat: 'crit_rate', op: 'add', value: 25 }] },
  spellweaver: { name: 'SHIMMYFUL Spellweaver', desc: '+35% MAG, +25% Cooldown Reduction.', passive: [{ stat: 'mag', op: 'pct', value: 35 }, { stat: 'cooldown_red', op: 'add', value: 25 }] },
  lifeline: { name: 'SHIMMYFUL Lifeline', desc: '+25% Lifesteal, +25% Heal Power.', passive: [{ stat: 'lifesteal', op: 'add', value: 25 }, { stat: 'heal_pow', op: 'add', value: 25 }] },
  weakpoint: { name: 'SHIMMYFUL Weakpoint', desc: '+25% True Damage, +25% Crit Chance.', passive: [{ stat: 'true_dmg', op: 'add', value: 25 }, { stat: 'crit_rate', op: 'add', value: 25 }] },
  berserker: { name: 'SHIMMYFUL Berserker', desc: '+45% ATK. DEF penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 45 }] },
  bulwark: { name: 'SHIMMYFUL Bulwark', desc: '+40% DEF. ATK penalty removed.', passive: [{ stat: 'def', op: 'pct', value: 40 }] },
  overdrive: { name: 'SHIMMYFUL Overdrive', desc: '+40% ATK. HP penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 40 }] },
  solo: { name: 'SHIMMYFUL Solo', desc: '+40% all stats when fighting without allies.', passive: [], situational: [{ id: 'solo-alone', label: 'Fighting alone (no allies)', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }] },
  packhunter: { name: 'SHIMMYFUL Pack Hunter', desc: '+15% ATK per ally in the fight (up to +45%).', passive: [], situational: [{ id: 'pack-1', label: '1 ally in fight (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }, { id: 'pack-2', label: '2 allies in fight (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'pack-3', label: '3+ allies in fight (+45% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 45 }] }] },
  laststand: { name: 'SHIMMYFUL Last Stand', desc: 'At ≤25% HP: +45% ATK, +45% DEF, +30% SPD.', passive: [], situational: [{ id: 'ls-low', label: 'Currently at ≤25% HP', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'def', op: 'pct', value: 45 }, { stat: 'spd', op: 'pct', value: 30 }] }] },
  opportunist: { name: 'SHIMMYFUL Opportunist', desc: '+40% ATK and +20% True Damage vs enemies that are stunned, slowed, or poisoned.', passive: [], situational: [{ id: 'opp-cc', label: 'Enemy is stunned, slowed, or poisoned', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'true_dmg', op: 'add', value: 20 }] }] },
  momentum: { name: 'SHIMMYFUL Momentum', desc: 'Each consecutive hit without taking damage: +10% ATK. Stacks up to 5x.', passive: [], situational: [{ id: 'mom-1', label: '1 hit streak (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'mom-3', label: '3 hit streak (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'mom-5', label: '5+ hit streak (+50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  adrenaline: { name: 'SHIMMYFUL Adrenaline', desc: 'Taking damage grants +25% ATK and +15% SPD for 3 turns.', passive: [], situational: [{ id: 'adren-hit', label: 'Just took damage (+25% ATK, +15% SPD for 3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 15 }] }] },
  secondwind: { name: 'SHIMMYFUL Second Wind', desc: 'Survive two killing blows per fight, reviving at 30% HP each time.', passive: [] },
  mending: { name: 'SHIMMYFUL Mending', desc: '+35% Heal Power. Your heals restore 10% HP to yourself.', passive: [{ stat: 'heal_pow', op: 'add', value: 35 }] },
  fortify: { name: 'SHIMMYFUL Fortify', desc: 'After taking 2 hits in a row, gain +30% DEF and +15% ATK.', passive: [], situational: [{ id: 'fort-2hit', label: 'Took 2 hits in a row (+30% DEF, +15% ATK)', passive: [{ stat: 'def', op: 'pct', value: 30 }, { stat: 'atk', op: 'pct', value: 15 }] }] },
  evasion: { name: 'SHIMMYFUL Evasion', desc: '+45% Dexterity.', passive: [{ stat: 'dexterity', op: 'add', value: 45 }] },
  warcry: { name: 'SHIMMYFUL Warcry', desc: 'Once per fight, give all allies +30% ATK and +20% DEF for 3 turns.', passive: [] },
  bubbly: { name: 'SHIMMYFUL Bubbly', desc: '75% chance on hit to encase enemy in a bubble. Bubble explodes on break, dealing ATK × 0.5 as True Damage.', passive: [] },
  moonstonemending: { name: 'SHIMMYFUL Moonstone Mending', desc: 'Passively heal the two most-injured allies for 10% max HP whenever any ally takes damage. Triggers twice per turn.', passive: [] },
  eyeofthestorm: { name: 'SHIMMYFUL Eye of the Storm', desc: 'Shield one ally for 35% max HP. While the shield holds, they gain +40% ATK and +20% MAG.', passive: [] },
  warmhugs: { name: 'SHIMMYFUL Warm Hugs', desc: 'At the start of each turn, ALL allies receive a shield worth 12% of their max HP.', passive: [] },
  ardentcenser: { name: 'SHIMMYFUL Ardent Censer', desc: 'Whenever you heal or shield an ally, they gain +40% ATK, +30% SPD, and +20% MAG for 2 turns.', passive: [], situational: [{ id: 'ac-shimmy', label: 'Ally buffed by SHIMMYFUL Ardent Censer', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 30 }, { stat: 'mag', op: 'pct', value: 20 }] }] },
  pixswatch: { name: "SHIMMYFUL Pix's Watch", desc: "Shield one ally for 20% HP. Pix deals 8% MAG damage to every attacker and heals the shielded ally for 5% HP per hit taken.", passive: [] },
  rewind: { name: 'SHIMMYFUL Rewind', desc: 'Every 2 turns, reduce all your ability cooldowns by 2 turns.', passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }] },
  timewarp: { name: 'SHIMMYFUL Time Warp', desc: 'Grant ALL allies +80% SPD for 2 turns, OR slow ALL enemies by 80% SPD for 2 turns. Choose each use.', passive: [] },
  tidecallersblessing: { name: "SHIMMYFUL Tidecaller's Blessing", desc: 'Empower one ally: their next 5 attacks each slow the target by 40% SPD and deal bonus magic damage (+30% MAG).', passive: [] },
  focusedresolve: { name: 'SHIMMYFUL Focused Resolve', desc: 'Tether to one enemy for 3 turns. They cannot flee. If the tether holds the full duration: root them for 2 turns and heal yourself for 40% HP.', passive: [] },
  mikaelscleanse: { name: "SHIMMYFUL Mikael's Cleanse", desc: 'Once per battle: remove all crowd control and status effects from ALL allies and heal each of them for 30% HP.', passive: [] },
  zekesconvergence: { name: "SHIMMYFUL Zeke's Convergence", desc: 'Bind to one ally. Enemies who attack them are slowed 50% SPD, take +30% increased damage from all sources, and you gain +20% DEF for 2 turns per hit they absorb.', passive: [{ stat: 'def', op: 'pct', value: 20 }] },
  // LoL-inspired rares
  voracity: { name: 'SHIMMYFUL Voracity', desc: 'On kill or assist: reduce all cooldowns by 4 turns and gain +15% ATK for 1 turn.', passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }], situational: [{ id: 'vor-s', label: 'Post-kill turn (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }] },
  hemorrhage: { name: 'SHIMMYFUL Hemorrhage', desc: 'Bleed stacks up to 8. Each stack adds +8 ATK as bleeding damage. At 8 stacks, the target is rooted for 1 turn and slowed for 2 more.', passive: [], notes: 'Bleed stacks to 8. Root at full stacks.' },
  nighthunter: { name: 'SHIMMYFUL Night Hunter', desc: 'Gain +30 SPD and +20% Dexterity when pursuing a visible enemy.', passive: [{ stat: 'spd', op: 'add', value: 20 }, { stat: 'dexterity', op: 'add', value: 20 }] },
  doublestrike: { name: 'SHIMMYFUL Double Strike', desc: 'Every 5th attack on the same target strikes FOUR times instantly.', passive: [], notes: 'Every 5th consecutive hit on same target = quadruple hit.' },
  flurry: { name: 'SHIMMYFUL Flurry', desc: 'After casting a skill, the next 3 attacks deal +40% damage and cost no cooldown.', passive: [], notes: '+40% bonus on the 3 attacks immediately after a skill.' },
  martialcadence: { name: 'SHIMMYFUL Martial Cadence', desc: 'First attack on any new target deals bonus damage equal to 15% of their current HP.', passive: [], notes: '15% current HP bonus on first hit per new target.' },
  spikedshell: { name: 'SHIMMYFUL Spiked Shell', desc: '25% of total DEF is added to ATK.', passive: [{ stat: 'atk', op: 'pct', value: 20 }], notes: 'Higher DEF-to-ATK conversion.' },
  eternalhunger: { name: 'SHIMMYFUL Eternal Hunger', desc: 'Lifesteal scales with missing HP. At 50% HP: +20% lifesteal. At 10% HP: +55% lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 20 }], situational: [{ id: 'eh-s-half', label: 'At 50% HP missing (+20% lifesteal)', passive: [{ stat: 'lifesteal', op: 'add', value: 20 }] }, { id: 'eh-s-low', label: 'At 10% HP missing (+55% lifesteal)', passive: [{ stat: 'lifesteal', op: 'add', value: 55 }] }] },
  fleetoffoot: { name: 'SHIMMYFUL Fleet of Foot', desc: 'Gain +25 SPD for 2 turns after a skill hits a target.', passive: [{ stat: 'spd', op: 'add', value: 18 }] },
  livingvengeance: { name: 'SHIMMYFUL Living Vengeance', desc: 'On kill: +40 ATK for 3 turns. On elite kill: +70 ATK for 3 turns.', passive: [], situational: [{ id: 'lv-s-kill', label: 'On kill (+40 ATK, 3 turns)', passive: [{ stat: 'atk', op: 'add', value: 40 }] }, { id: 'lv-s-elite', label: 'On elite kill (+70 ATK, 3 turns)', passive: [{ stat: 'atk', op: 'add', value: 70 }] }] },
  lovetap: { name: 'SHIMMYFUL Love Tap', desc: 'Attacks against a target not hit last turn deal +40% bonus damage.', passive: [], notes: '+40% damage on first contact with a target each turn cycle.' },
  clockworkwindup: { name: 'SHIMMYFUL Clockwork Windup', desc: 'Consecutive attacks on the same target deal +8% damage per hit (max +40% at 5 hits).', passive: [], situational: [{ id: 'cw-s-max', label: 'At 5 consecutive hits (+40% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 40 }] }] },
  voidstone: { name: 'SHIMMYFUL Void Stone', desc: 'Reduce all magic damage taken by 35%. Absorbed magic damage charges your next magical hit for +20% MAG bonus damage.', passive: [{ stat: 'status_res', op: 'add', value: 25 }], notes: '-35% magic damage taken. Charge mechanic on magic hits.' },
  guerrillawarfare: { name: 'SHIMMYFUL Guerrilla Warfare', desc: 'Standing still for 1 turn renders you invisible. First attack from stealth deals +80% damage.', passive: [], notes: 'Stealth on idle turn. +80% on break-stealth attack.' },
  mortalwill: { name: 'SHIMMYFUL Mortal Will', desc: 'Build charges (max 5). At 5 charges, the next ability gains +60% damage and two bonus effects.', passive: [], notes: '5-charge system. Empowered next ability at full stacks.' },
  triumphantroar: { name: 'SHIMMYFUL Triumphant Roar', desc: 'When any nearby unit dies, restore 12% max HP and gain +10 ATK for 1 turn.', passive: [{ stat: 'heal_pow', op: 'add', value: 15 }], situational: [{ id: 'tr-s', label: 'Post-death turn (+10 ATK)', passive: [{ stat: 'atk', op: 'add', value: 10 }] }] },
  deadlyvenom: { name: 'SHIMMYFUL Deadly Venom', desc: 'Attacks apply stacking poison (max 8 stacks). Each stack deals 4 true damage per turn.', passive: [{ stat: 'true_dmg', op: 'add', value: 12 }], notes: 'Stacking poison: 4 true damage per turn per stack (max 8).' },
  salvation: { name: 'SHIMMYFUL Salvation', desc: 'Gain +40 SPD when rushing toward an ally below 30% HP. Also grant that ally a shield worth 10% of their max HP.', passive: [{ stat: 'spd', op: 'add', value: 15 }], notes: '+40 SPD + ally shield when rushing to low-HP ally.' },
  blaze: { name: 'SHIMMYFUL Blaze', desc: 'Skills ignite targets: deal 8% of their max HP as magic damage over 2 turns. Double ignite stacks trigger an explosion at 25% of their max HP.', passive: [], notes: 'Stronger DoT. Double-stack explosion at 25% max HP.' },
  hailofblades:  { name: 'SHIMMYFUL Hail of Blades', desc: 'Gain +80% ATK speed on the first 5 attacks of any combat encounter.', passive: [], notes: 'Burst ATK speed boost extended to first 5 attacks per combat.' },
  gamblersruin:  { name: "SHIMMYFUL Gambler's Ruin", desc: 'Before each action, secretly roll a die. On an even result: +75% ATK and MAG for that action. On an odd result: only +25% damage taken for that action.', passive: [], situational: [{ id: 'gr-s-lucky', label: 'Lucky Roll (even) — +75% ATK & MAG', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'mag', op: 'pct', value: 75 }] }, { id: 'gr-s-unlucky', label: 'Unlucky Roll (odd) — +25% damage taken (−25% DEF)', passive: [{ stat: 'def', op: 'pct', value: -25 }] }] },
  bloodylust:    { name: 'SHIMMYFUL Bloody Lust', desc: 'Each hit you land stacks +8 ATK for the rest of that battle. Stacks carry over to the next battle if you win.', passive: [], situational: [{ id: 'bl-s-5', label: '5 hits landed (+40 ATK)', passive: [{ stat: 'atk', op: 'add', value: 40 }] }, { id: 'bl-s-10', label: '10 hits landed (+80 ATK)', passive: [{ stat: 'atk', op: 'add', value: 80 }] }, { id: 'bl-s-20', label: '20 hits landed (+160 ATK)', passive: [{ stat: 'atk', op: 'add', value: 160 }] }] },
  holymantle:    { name: 'SHIMMYFUL Holy Mantle', desc: 'The first 2 hits that would damage you per battle are completely nullified. Both are automatic.', passive: [], notes: 'Two separate damage-nullification charges per battle. Both reset at battle start.' },
  bust:          { name: 'SHIMMYFUL Bust', desc: 'Every time you hit, roll a d6. On a 1: your ATK is only halved for that turn instead of zeroed. On a 6: deal the hit twice AND gain +20% ATK for 1 turn.', passive: [], situational: [{ id: 'bust-s-1', label: 'Rolled a 1 — ATK halved this turn', passive: [{ stat: 'atk', op: 'pct', value: -50 }] }, { id: 'bust-s-6', label: 'Rolled a 6 — hit twice + +20% ATK this turn', passive: [{ stat: 'atk', op: 'pct', value: 20 }] }], notes: 'Roll d6 on each hit. 1 = ATK halved for 1 turn. 6 = hit twice + 20% ATK bonus.' },
  snakeeyes:     { name: 'SHIMMYFUL Snake Eyes', desc: '+50% ATK. Each attack, roll a d6. Rolling a 1 triggers a fumble: you miss and take only 2% max HP damage. Rolling a 6: deal the hit twice.', passive: [{ stat: 'atk', op: 'pct', value: 50 }], notes: 'Roll d6 each attack. 1 = fumble (miss + 2% max HP). 6 = hit twice. +50% ATK always active.' },
};

// ============================================================
// SHIMMYFUL LEGENDARIES — 5% chance per legendary roll
// Gold/amber ring. Deeper reveal sound (rate 0.72).
// Excludes the 9 legendaries that already have hexxed variants.
// ============================================================
const SHIMMYFUL_LEGENDARY_TRAITS = {
  rct: { name: 'SHIMMYFUL RCT', desc: 'No HP penalty. Each turn, heal 5% HP per 5 MAG (cap 35%).', passive: [] },
  gluttonous: { name: 'SHIMMYFUL Gluttonous', desc: '+90% CDR. +8% ATK & +8% DEF per 10% CDR.', passive: [{ stat: 'cooldown_red', op: 'add', value: 90 }, { op: 'derived', stat: 'atk', from: 'cooldown_red', per: 10, perPct: 8 }, { op: 'derived', stat: 'def', from: 'cooldown_red', per: 10, perPct: 8 }] },
  celestial: { name: 'SHIMMYFUL Celestial Body', desc: '+350% HP, +75% DEF. Channels cosmic energy: +2 ATK per 50 HP (cap +400 ATK).', passive: [{ stat: 'hp', op: 'pct', value: 350 }, { stat: 'def', op: 'pct', value: 75 }, { op: 'derived', stat: 'atk', from: 'hp', per: 50, perValue: 2, cap: 400 }] },
  circle: { name: 'SHIMMYFUL Circle of Death', desc: 'Damage enemies when you heal. +8% Heal Power per 50 ATK.', passive: [{ op: 'derived', stat: 'heal_pow', from: 'atk', per: 50, perValue: 8 }] },
  bigbrain: { name: 'SHIMMYFUL Big Brain', desc: 'Start of fight: shield worth 200% of your IQ. Refreshes each round at 25% of MAG.', passive: [] },
  allin: { name: 'SHIMMYFUL All In', desc: 'ATK x2.5, MAG x2.5. DEF penalty completely removed.', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }] },
  thornwall: { name: 'SHIMMYFUL Thornwall', desc: 'Reflect 65% of all damage taken back as True Damage. Also reduces damage taken by 10%.', passive: [] },
  apex_pred: { name: 'SHIMMYFUL Apex Predator', desc: '+80% ATK and +18% True DMG per enemy. DEF penalty per ally removed.', passive: [], situational: [{ id: 'ap-1', label: '1 enemy (+80% ATK, +18% True DMG)', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'true_dmg', op: 'add', value: 18 }] }, { id: 'ap-3', label: '3 enemies (+240% ATK, +54% True DMG)', passive: [{ stat: 'atk', op: 'pct', value: 240 }, { stat: 'true_dmg', op: 'add', value: 54 }] }] },
  ironvow: { name: 'SHIMMYFUL Iron Vow', desc: 'Sacrifice one main stat (set to 1). All other main stats gain +65%.', passive: [] },
  soulforge: { name: 'SHIMMYFUL Soul Forge', desc: 'Sacrifice only 100 HP (floor: 1 HP) per stack. Each stack grants +90% MAG.', passive: [], cultivation: { label: 'HP Sacrifices Made', perStack: { stat: 'mag', op: 'pct', value: 90 }, defaultStacks: 0, maxStacks: 20 } },
  final_stand: { name: 'SHIMMYFUL Final Stand', desc: 'When HP drops below 25%, ALL stats quadruple. Once per fight.', passive: [], situational: [{ id: 'fs-active', label: 'Below 25% HP -- Final Stand active', passive: [{ stat: 'atk', op: 'pct', value: 300 }, { stat: 'def', op: 'pct', value: 300 }, { stat: 'mag', op: 'pct', value: 300 }, { stat: 'spd', op: 'pct', value: 300 }] }] },
  thousandcuts: { name: 'SHIMMYFUL Thousand Cuts', desc: 'Every attack hits 8 times for 1/8 damage each. All on-hit effects apply to every single hit.', passive: [] },
  eternal_flame: { name: 'SHIMMYFUL Eternal Flame', desc: 'On death, revive twice at 25% HP. Stats are doubled for the rest of the fight (not just one round).', passive: [] },
  entropy: { name: 'SHIMMYFUL Entropy', desc: 'Each hit deals True Damage equal to 6% of the target\'s current HP. Bypasses all resistances.', passive: [] },
  phantom_step: { name: 'SHIMMYFUL Phantom Step', desc: '+65% SPD, +55% Dexterity. Negate one attack per round. Once per fight, negate a second.', passive: [{ stat: 'spd', op: 'pct', value: 65 }, { stat: 'dexterity', op: 'add', value: 55 }] },
  apex_hunger: { name: 'SHIMMYFUL Apex Hunger', desc: 'Every kill grants +5% ATK and +2% True DMG permanently for the campaign. Stacks forever.', passive: [], cultivation: { label: 'Enemies Slain', perStack: [{ stat: 'atk', op: 'pct', value: 5 }, { stat: 'true_dmg', op: 'add', value: 2 }], defaultStacks: 0, maxStacks: 999 } },
  reapers_mark: { name: "SHIMMYFUL Reaper's Mark", desc: 'Every 2nd attack auto-crits at triple your normal crit multiplier.', passive: [] },
  parasite: { name: 'SHIMMYFUL Parasite', desc: 'Each round, drain 25% of the target\'s ATK, MAG, AND SPD, adding each to yours until combat ends.', passive: [], situational: [{ id: 'par-1', label: 'After 1 round of draining', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'mag', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 25 }] }] },
  forsaken: { name: 'SHIMMYFUL Forsaken', desc: 'Cannot receive ally heals. All self-healing is quintupled. +55% Lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 55 }] },
  twin_fangs: { name: 'SHIMMYFUL Twin Fangs', desc: 'Every attack hits 3 times. All three hits can crit and apply on-hit effects.', passive: [] },
  condemned: { name: 'SHIMMYFUL Condemned', desc: '8 rounds before death. Until then, +80% to ALL stats. Timer can reset once per fight.', passive: [], situational: [{ id: 'cond-active', label: 'Condemned -- rounds 1 through 8', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'def', op: 'pct', value: 80 }, { stat: 'mag', op: 'pct', value: 80 }, { stat: 'spd', op: 'pct', value: 80 }, { stat: 'hp', op: 'pct', value: 80 }] }] },
  warpath: { name: 'SHIMMYFUL Warpath', desc: 'Each round, permanently gain +10% ATK and +10% SPD for the rest of that fight.', passive: [], situational: [{ id: 'wp-1', label: 'After round 1 (+10% ATK, +10% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'spd', op: 'pct', value: 10 }] }, { id: 'wp-3', label: 'After round 3 (+30% ATK, +30% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'spd', op: 'pct', value: 30 }] }] },
  blood_frenzy: { name: 'SHIMMYFUL Blood Frenzy', desc: 'Each kill restores 40% HP and permanently stacks +15% ATK for the rest of the fight.', passive: [], situational: [{ id: 'bf-1', label: '1 kill (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }, { id: 'bf-3', label: '3 kills (+45% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 45 }] }] },
  voidborn: { name: 'SHIMMYFUL Voidborn', desc: '-10% HP. Full status immunity. Attacks ignore 45% of enemy DEF.', passive: [{ stat: 'hp', op: 'pct', value: -10 }, { stat: 'status_res', op: 'add', value: 100 }, { stat: 'true_dmg', op: 'add', value: 45 }] },
  martyr: { name: 'SHIMMYFUL Martyr', desc: 'Intercept any lethal ally hit. Survive at 10% HP. Gain +80% ATK and +80% DEF until combat ends.', passive: [], situational: [{ id: 'mart-active', label: 'Martyrdom triggered', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'def', op: 'pct', value: 80 }] }] },
  hex_eater: { name: 'SHIMMYFUL Hex Eater', desc: 'All debuffs convert to buffs. Those converted buffs are doubled in magnitude.', passive: [] },
  phantom_pain: { name: 'SHIMMYFUL Phantom Pain', desc: 'Whenever you take damage, deal 85% of that amount split across all enemies as True Damage.', passive: [] },
  ironclad: { name: 'SHIMMYFUL Ironclad', desc: 'Full displacement immunity. Every point of DEF also adds 8% ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'def', per: 1, perPct: 8 }] },
  guillotine: { name: 'SHIMMYFUL Guillotine', desc: 'If an enemy is at or below 30% HP when you attack, the hit is automatically lethal.', passive: [] },
  doppelganger: { name: 'SHIMMYFUL Doppelganger', desc: 'A copy with 80% of your stats appears and fights for 5 rounds before collapsing.', passive: [] },
  sundering: { name: 'SHIMMYFUL Sundering', desc: 'Each hit permanently reduces target DEF by 15% for that fight. No cap.', passive: [] },
  necromancer: { name: 'SHIMMYFUL Necromancer', desc: 'The first 2 enemies you kill each fight rise as thralls with 75% of their stats.', passive: [] },
  debt_collector: { name: 'SHIMMYFUL Debt Collector', desc: 'Store all damage taken. Release it as TWO separate True Damage hits on any target(s).', passive: [] },
  black_hole: { name: 'SHIMMYFUL Black Hole', desc: 'Each round: all enemies -8% all stats, you +8% all stats. Both effects stack.', passive: [], situational: [{ id: 'bh-1', label: 'After round 1 (you +8% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 8 }] }, { id: 'bh-3', label: 'After round 3 (you +24% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 24 }] }, { id: 'bh-5', label: 'After round 5 (you +40% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }] },
  thundergod: { name: 'SHIMMYFUL Thundergod', desc: 'Start of every round: deal True Damage equal to 50% of your ATK to ALL enemies simultaneously.', passive: [] },
  conqueror: { name: 'SHIMMYFUL Conqueror', desc: 'Every fight survived: +2% all main stats and +2 all substats. Stacks up to 100 victories.', passive: [], cultivation: { label: 'Victories', perStack: [{ stat: 'all_main', op: 'pct', value: 2 }, { stat: 'all_sub', op: 'add', value: 2 }], defaultStacks: 0, maxStacks: 100 } },
  soul_link: { name: 'SHIMMYFUL Soul Link', desc: 'Bond to one ally: share 80% of all buffs either receives. Split only 15% of all damage.', passive: [] },
  bloodrage: { name: 'SHIMMYFUL Bloodrage', desc: 'For every 10% max HP lost, gain +10% ATK. At 10% HP remaining: +90% ATK.', passive: [], situational: [{ id: 'br-10', label: 'Lost 10% HP (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'br-50', label: 'Lost 50% HP (+50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }, { id: 'br-90', label: 'Lost 90% HP (+90% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 90 }] }] },
  chrono_break: { name: 'SHIMMYFUL Chrono Break', desc: 'Undo the last round completely. Usable twice per fight.', passive: [] },
  cannibal: { name: 'SHIMMYFUL Cannibal', desc: 'Upon killing an enemy, gain 35% of their highest stat for the rest of that fight. Stacks per kill.', passive: [], situational: [{ id: 'can-1', label: '1 kill (+35% of target\'s top stat)', desc: 'Calculate from the defeated enemy\'s highest stat.', passive: [] }, { id: 'can-3', label: '3 kills (35% per kill, stacking)', desc: 'Each kill uses that enemy\'s own highest stat.', passive: [] }] },
  bulwark_aura: { name: 'SHIMMYFUL Bulwark Aura', desc: 'All allies gain +35% DEF, +25% Status Res. You also personally gain +20% DEF.', passive: [{ stat: 'def', op: 'pct', value: 20 }] },
  war_priest: { name: 'SHIMMYFUL War Priest', desc: 'Each ally you heal gains +20% ATK and +15% HP for that fight. Stacks per heal.', passive: [] },
  vanguard: { name: 'SHIMMYFUL Vanguard', desc: '+50% DEF. Redirect 25% of all ally damage to yourself. You take -20% of that redirected damage.', passive: [{ stat: 'def', op: 'pct', value: 50 }] },
  last_rites: { name: 'SHIMMYFUL Last Rites', desc: 'Knocked-out allies revive at 60% HP. Usable twice per ally per fight.', passive: [] },
  resonance: { name: 'SHIMMYFUL Resonance', desc: 'Your top two stats are each copied to every ally at 50% of their value as a flat bonus.', passive: [] },
  mentor: { name: 'SHIMMYFUL Mentor', desc: 'Each party win, choose one ally: they permanently gain +10% in their top two stats.', passive: [] },
  self_sacrifice: { name: 'SHIMMYFUL Sacrifice', desc: 'Sacrifice yourself to fully restore one ally\'s HP and grant them +80% all stats for that fight.', passive: [] },
  bodyguard: { name: 'SHIMMYFUL Bodyguard', desc: 'Allies cannot be one-shot. Designated ally gains +80% DEF AND +30% ATK.', passive: [] },
  rallying_cry: { name: 'SHIMMYFUL Rallying Cry', desc: 'Any hit exceeding 20% of your max HP triggers +40% ATK for all allies that round.', passive: [] },
  hexbinder: { name: 'SHIMMYFUL Hexbinder', desc: 'On hit, apply two random debuffs (-25% each). Both persist until the fight ends.', passive: [] },
  disruptor: { name: 'SHIMMYFUL Disruptor', desc: 'Enemies targeting your allies suffer -55% ATK AND -25% SPD.', passive: [] },
  nemesis: { name: 'SHIMMYFUL Nemesis', desc: 'Deal x3 damage to your Nemesis. Defeating them grants x1.5 to x3 to ALL stats permanently.', passive: [] },
  lonewolf: { name: 'SHIMMYFUL Lone Wolf', desc: 'Solo: x2.25 to ATK, DEF, MAG, and SPD. In a party: only -25% all stats (not x0.5).', passive: [], situational: [{ id: 'lw-solo', label: 'Fighting alone (x2.25 ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 2.25 }, { stat: 'def', op: 'mul', value: 2.25 }, { stat: 'mag', op: 'mul', value: 2.25 }, { stat: 'spd', op: 'mul', value: 2.25 }] }, { id: 'lw-party', label: 'In a party (-25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -25 }] }] },
  catastrophe: { name: 'SHIMMYFUL Catastrophe', desc: 'Every round, ALL combatants take your full ATK x1.5 as True Damage. Cannot be reduced.', passive: [] },
  life_support: { name: 'SHIMMYFUL Life Support', desc: 'Revive allies at cost of 30% current HP (cannot kill you). Each revive grants +40% DEF and +40% SPD.', passive: [], cultivation: { label: 'Allies Revived', perStack: [{ stat: 'def', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }], defaultStacks: 0, maxStacks: 10 } },
  schism: { name: 'SHIMMYFUL Schism', desc: '+3 ATK per 1% Heal Power you have.', passive: [{ op: 'derived', stat: 'atk', from: 'heal_pow', per: 1, perValue: 3 }] },
  find_your_spark: { name: 'SHIMMYFUL Find Your Spark', desc: '+2 DEF per 1 SPD. +4 HP per 1 Dexterity.', passive: [{ op: 'derived', stat: 'def', from: 'spd', per: 1, perValue: 2 }, { op: 'derived', stat: 'hp', from: 'dexterity', per: 1, perValue: 4 }] },
  wildgrowth: { name: 'SHIMMYFUL Wild Growth', desc: 'Usable twice per battle: instantly enlarge one ally. They gain +1000 HP, knock back all nearby enemies, and gain +150% ATK for 3 rounds.', passive: [] },
  wish: { name: 'SHIMMYFUL Wish', desc: 'Once per battle: heal ALL allies to full HP, remove all debuffs from each, and grant them +20% all main stats for 2 turns.', passive: [], situational: [{ id: 'wish-shimmy', label: 'SHIMMYFUL Wish buff active (+20% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 20 }] }] },
  crescendo: { name: 'SHIMMYFUL Crescendo', desc: 'Once per battle: stun all enemies for 2 turns, restore 30% HP to all allies, then grant all allies +20% ATK for 2 turns after the stun.', passive: [] },
  monsoon: { name: 'SHIMMYFUL Monsoon', desc: 'Once per battle: knock back all enemies and heal all allies for 30% HP per turn for 4 turns. Also grants all allies +20% DEF for the duration.', passive: [] },
  bailout: { name: 'SHIMMYFUL Bailout', desc: 'Usable twice per battle: grant an ally a second chance. If they die within 3 turns, they revive at 80% HP and go berserk (+150% ATK) for 2 turns.', passive: [] },
  hostiletakeover: { name: 'SHIMMYFUL Hostile Takeover', desc: 'Once per battle: one enemy goes berserk for 2 turns attacking their own allies. Additionally drain 20% of their highest stat and add it to yours until combat ends.', passive: [] },
  tidalwave: { name: 'SHIMMYFUL Tidal Wave', desc: 'Once per battle: knock up all enemies for 1 turn. Upon landing they are slowed 80% SPD, lose 80% DEX, and 30% DEF for 2 turns.', passive: [] },
  // LoL-inspired legendaries
  duelistsdance: { name: "SHIMMYFUL Duelist's Dance", desc: 'Vital Points heal 15% HP, grant +250 SPD, and deal +100% bonus damage each. All 4 Vitals refresh after being hit.', passive: [], notes: 'Enhanced Vital cycle. Higher heal, SPD, and bonus damage.' },
  damnation: { name: 'SHIMMYFUL Damnation', desc: 'Every enemy killed drops a Soul. Gain +5 ATK and +5 DEF per soul. No cap.', passive: [], cultivation: { label: 'Souls Collected', perStack: [{ stat: 'atk', op: 'add', value: 5 }, { stat: 'def', op: 'add', value: 5 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent soul-stack: +5 ATK and +5 DEF per kill.' },
  kindredmark: { name: 'SHIMMYFUL Mark of the Kindred', desc: 'Each hunted enemy defeated permanently grants +25 to all stats. Marks renew each combat.', passive: [], cultivation: { label: 'Hunted Kills', perStack: [{ stat: 'all_main', op: 'add', value: 25 }], defaultStacks: 0, maxStacks: 999 }, notes: '+25 all stats per marked kill. Permanent.' },
  crimsonpact: { name: 'SHIMMYFUL Crimson Pact', desc: 'Every 20 HP = +1 MAG. Every 8 MAG = +15 HP. Both stats scale off each other more aggressively.', passive: [{ op: 'derived', stat: 'mag', from: 'hp', per: 20, perValue: 1 }, { op: 'derived', stat: 'hp', from: 'mag', per: 8, perValue: 15 }], notes: 'Tighter HP/MAG conversion loop. Stats update whenever either is gained.' },
  mirageform: { name: 'SHIMMYFUL Mirage Form', desc: 'On dropping below 25% HP, spawn a combat-capable decoy with 80% of your stats for 5 turns.', passive: [], notes: 'Decoy with 80% stats, lasts 5 turns, draws aggro.' },
  wayofwanderer: { name: 'SHIMMYFUL Way of the Wanderer', desc: 'Flow builds faster. At full Flow, gain a shield equal to 25% max HP. All crits deal 300% damage regardless of source.', passive: [{ stat: 'crit_dmg', op: 'add', value: 200 }], notes: 'No normal crits. Faster Flow. 300% crit damage.' },
  ionianfervor: { name: 'SHIMMYFUL Ionian Fervor', desc: 'Multi-hit: up to -30% damage taken (vs 3+ enemies). Single target: +7% ATK per stack (max 6 stacks).', passive: [], situational: [{ id: 'if-s-multi', label: 'Hitting 3+ enemies (-30% damage taken)', passive: [{ stat: 'def', op: 'pct', value: 30 }] }, { id: 'if-s-single', label: 'At 6 single-target stacks (+42% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 42 }] }] },
  unseenpredator: { name: 'SHIMMYFUL Unseen Predator', desc: 'Stealth/backstab grants +8 ATK and +5 SPD per Trophy stack. Permanent, max 15 stacks.', passive: [], situational: [{ id: 'up-s-max', label: 'At max Trophies (15 stacks)', passive: [{ stat: 'atk', op: 'add', value: 120 }, { stat: 'spd', op: 'add', value: 75 }] }] },
  contemptweak: { name: 'SHIMMYFUL Contempt for the Weak', desc: 'Attacks against enemies below 50% HP deal bonus true damage equal to 10% of their max HP.', passive: [{ stat: 'true_dmg', op: 'add', value: 10 }], notes: '10% max HP true damage bonus on sub-50% targets.' },
  deathbydegrees: { name: 'SHIMMYFUL Death by Degrees', desc: 'Attacks deal bonus damage equal to 3% of the target\'s max HP and heal you for that full amount.', passive: [{ stat: 'lifesteal', op: 'add', value: 10 }, { stat: 'true_dmg', op: 'add', value: 8 }], notes: '3% max HP damage per hit + full lifesteal from it.' },
  wayofhunter: { name: 'SHIMMYFUL Way of the Hunter', desc: 'Every other attack deals bonus magic damage equal to 300% of ATK.', passive: [{ stat: 'mag', op: 'pct', value: 100 }], notes: 'Alternating physical/120% ATK magic on every other attack.' },
  darkinrebirth: { name: 'SHIMMYFUL Darkin Rebirth', desc: 'On death, channel briefly then revive at 60% HP with +100% ATK for 3 turns. Once per encounter.', passive: [], situational: [{ id: 'dr-s', label: 'Post-revive (+100% ATK for 3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 100 }] }] },
  shatteredtime: { name: 'SHIMMYFUL Shattered Time', desc: 'Each skill use reduces all cooldowns by 4 turns and grants +30 SPD.', passive: [{ stat: 'cooldown_red', op: 'add', value: 25 }, { stat: 'spd', op: 'add', value: 15 }] },
  livingforge: { name: 'SHIMMYFUL Living Forge', desc: 'Can upgrade TWO items mid-combat. All attacks apply Brittle; Brittle targets take +50% crit damage.', passive: [], notes: 'Upgrade two items. Brittle on all attacks grants +50% crit damage.' },
  undyinggrasp:  { name: 'SHIMMYFUL Undying Grasp', desc: 'When you would be killed: enter Stasis for 2 turns then revive at 40% HP. Usable TWICE per combat.', passive: [], notes: 'Two-use death prevention. 2-turn Stasis + revive at 40% HP.' },
  deadmanshand:  { name: "SHIMMYFUL Dead Man's Hand", desc: 'Start each battle with 5 cards (random stat modifiers, positive and negative). All 5 are revealed at battle start. You choose the order you activate them, one per turn.', passive: [], notes: 'Same 5-card system, but fully revealed upfront. Player chooses activation order.' },
  symbiote:      { name: 'SHIMMYFUL Symbiote', desc: 'Bond with one ally at battle start. You both gain +50% HP and share a single HP pool. Your bonded ally also gains +15% to all main stats.', passive: [{ stat: 'hp', op: 'pct', value: 50 }], notes: 'Shared HP pool. Both gain +50% HP. Bonded ally gets +15% all main stats on top.' },
  goathead:      { name: 'SHIMMYFUL Goat Head', desc: 'At battle start: sacrifice only 15% of your max HP to access a Devil Deal. Choose from 2 revealed legendary or mythic traits that apply for this fight only.', passive: [], notes: 'Devil Deal: -15% HP to borrow one of 2 revealed legendary or mythic traits for that battle. Borrowed trait lost at battle end.' },
  devilsbargain: { name: "SHIMMYFUL Devil's Bargain", desc: 'Quadruple your ATK and MAG (x4). At the end of each battle, one random stat (not ATK or MAG) is permanently cut by only 7%.', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'mag', op: 'mul', value: 4 }], notes: 'After each battle: one stat cut by -7% permanently. Smaller penalty than base.' },
  russianroulette:{ name: 'SHIMMYFUL Russian Roulette', desc: 'All your main stats are +100%. 1-in-6 chance each turn to take 50% max HP as true damage. If you survive the turn you were shot, gain +30% ATK for 2 turns.', passive: [{ stat: 'all_main', op: 'pct', value: 100 }], situational: [{ id: 'rr-s-survived', label: 'Survived the shot — +30% ATK for 2 turns', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }], notes: 'Roll d6 each turn. 1 = take 50% max HP true damage. Surviving grants +30% ATK for 2 turns. +100% all stats always.' },
  // Story/thematic legendaries
  emotionless:      { name: 'SHIMMYFUL Emotionless', desc: 'Your character loses the capability of having emotions, but all substats are tripled (x3).', passive: [{ stat: 'heal_pow', op: 'pct', value: 200 }, { stat: 'crit_rate', op: 'pct', value: 200 }, { stat: 'crit_dmg', op: 'pct', value: 200 }, { stat: 'status_res', op: 'pct', value: 200 }, { stat: 'dexterity', op: 'pct', value: 200 }, { stat: 'resilience', op: 'pct', value: 200 }, { stat: 'true_dmg', op: 'pct', value: 200 }, { stat: 'lifesteal', op: 'pct', value: 200 }, { stat: 'cooldown_red', op: 'pct', value: 200 }] },
  reinforcecrew:    { name: 'SHIMMYFUL What better time to reinforce our crew?', desc: 'When any ally drops to 50% HP, everyone in the party gains +75% DEF and two extra turns for one round.', passive: [], situational: [{ id: 'rc-s-trigger', label: 'Ally at 50% HP triggered (+75% DEF, 2 extra turns)', passive: [{ stat: 'def', op: 'pct', value: 75 }] }], notes: 'Toggle when triggered. Untoggle after the round ends.' },
  goodluckboys:     { name: 'SHIMMYFUL Good luck out there, boys', desc: 'When you drop below 75% HP, leave the fight. In return, the rest of your party has their turn count tripled for the remainder of the battle.', passive: [], notes: 'RP: below 75% HP, exit combat. Party receives tripled turns.' },
  holywar:          { name: 'SHIMMYFUL Holy War', desc: 'Quadruple your party\'s turn count when fighting a spirit. Triple them when fighting someone significantly stronger than you.', passive: [], situational: [{ id: 'hw-s-spirit', label: 'Fighting a spirit (party x4 turns)', passive: [] }, { id: 'hw-s-stronger', label: 'Fighting someone way stronger (party x3 turns)', passive: [] }], notes: 'RP: multiplied party turns. No self stat impact.' },
  wegotthenumbers:  { name: 'SHIMMYFUL We got the numbers!', desc: 'If your party outnumbers the enemies, all your substats are quintupled. If outnumbered, substats only drop by 25%.', passive: [], situational: [{ id: 'wgn-s-more', label: 'Outnumbering enemies (substats x5)', passive: [{ stat: 'heal_pow', op: 'pct', value: 400 }, { stat: 'crit_rate', op: 'pct', value: 400 }, { stat: 'crit_dmg', op: 'pct', value: 400 }, { stat: 'status_res', op: 'pct', value: 400 }, { stat: 'dexterity', op: 'pct', value: 400 }, { stat: 'resilience', op: 'pct', value: 400 }, { stat: 'true_dmg', op: 'pct', value: 400 }, { stat: 'lifesteal', op: 'pct', value: 400 }, { stat: 'cooldown_red', op: 'pct', value: 400 }] }, { id: 'wgn-s-less', label: 'Outnumbered by enemies (substats -25%)', passive: [{ stat: 'heal_pow', op: 'pct', value: -25 }, { stat: 'crit_rate', op: 'pct', value: -25 }, { stat: 'crit_dmg', op: 'pct', value: -25 }, { stat: 'status_res', op: 'pct', value: -25 }, { stat: 'dexterity', op: 'pct', value: -25 }, { stat: 'resilience', op: 'pct', value: -25 }, { stat: 'true_dmg', op: 'pct', value: -25 }, { stat: 'lifesteal', op: 'pct', value: -25 }, { stat: 'cooldown_red', op: 'pct', value: -25 }] }] },
  hailname:         { name: 'SHIMMYFUL Hail [NAME]', desc: 'Every time you defeat an enemy, you can recruit them by brainwashing them. Recruited characters fight for you but are permanently gone if defeated. Each recruited enemy also grants +5% all stats permanently.', passive: [], situational: [{ id: 'hn-s-1', label: '1 enemy recruited (+5% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 5 }] }, { id: 'hn-s-3', label: '3 enemies recruited (+15% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'hn-s-5', label: '5 enemies recruited (+25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }], notes: 'RP mechanic. Each recruited enemy also grants +5% all stats. [NAME] replaced by character name.' },
  onlyatraitor:     { name: 'SHIMMYFUL Only a Traitor could consider making Peace', desc: 'You can no longer spare anyone. You may only kill. Upon receiving this trait, immediately roll 3 random extra legendary traits.', passive: [], notes: 'On pickup: auto-grants 3 random legendary traits. No sparing allowed (RP restriction).' },
  partypooper:      { name: 'SHIMMYFUL Party Pooper', desc: 'On-hit, apply SHIMMYFUL FRACTURED. FRACTURED nullifies all healing and does not expire until battle ends. Gain +15% Lifesteal and +15% Crit Chance per Fractured enemy.', passive: [], situational: [{ id: 'pp-s-1', label: '1 Fractured enemy (+15% Lifesteal, +15% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 15 }, { stat: 'crit_rate', op: 'add', value: 15 }] }, { id: 'pp-s-2', label: '2 Fractured enemies (+30% Lifesteal, +30% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 30 }, { stat: 'crit_rate', op: 'add', value: 30 }] }, { id: 'pp-s-3', label: '3 Fractured enemies (+45% Lifesteal, +45% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 45 }, { stat: 'crit_rate', op: 'add', value: 45 }] }, { id: 'pp-s-4', label: '4+ Fractured enemies (+60% Lifesteal, +60% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 60 }, { stat: 'crit_rate', op: 'add', value: 60 }] }] },
  turningpoint:     { name: 'SHIMMYFUL Turning Point', desc: 'When dropping below 40% HP, gain x15 SPD and x15 DEX. This decreases by 20% each round (minimum x0.25). Gain an extra turn while the multiplier is above x4.', passive: [], situational: [{ id: 'tp-s-t1', label: 'Turn 1: x15 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 15 }, { stat: 'dexterity', op: 'mul', value: 15 }] }, { id: 'tp-s-t2', label: 'Turn 2: x12 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 12 }, { stat: 'dexterity', op: 'mul', value: 12 }] }, { id: 'tp-s-t3', label: 'Turn 3: x9.6 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 9.6 }, { stat: 'dexterity', op: 'mul', value: 9.6 }] }, { id: 'tp-s-t4', label: 'Turn 4: x7.68 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 7.68 }, { stat: 'dexterity', op: 'mul', value: 7.68 }] }, { id: 'tp-s-t5', label: 'Turn 5: x6.1 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 6.1 }, { stat: 'dexterity', op: 'mul', value: 6.1 }] }, { id: 'tp-s-fade', label: 'Faded (x0.25 SPD and DEX floor)', passive: [{ stat: 'spd', op: 'mul', value: 0.25 }, { stat: 'dexterity', op: 'mul', value: 0.25 }] }] },
  keepup:           { name: 'SHIMMYFUL KEEP UP', desc: 'Start with x3 SPD and x3 DEX. Every turn your SPD and DEX increase by x1.5. Enemies\' SPD and DEX increase by x1.4. +1 ATK per 10 SPD, +1 MAG per 2.5 DEX.', passive: [{ op: 'derived', stat: 'atk', from: 'spd', per: 10, perValue: 1 }, { op: 'derived', stat: 'mag', from: 'dexterity', per: 2.5, perValue: 1 }], situational: [{ id: 'ku-s-t1', label: 'Turn 1 (x3 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 3 }, { stat: 'dexterity', op: 'mul', value: 3 }] }, { id: 'ku-s-t2', label: 'Turn 2 (x4.5 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 4.5 }, { stat: 'dexterity', op: 'mul', value: 4.5 }] }, { id: 'ku-s-t3', label: 'Turn 3 (x6.75 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 6.75 }, { stat: 'dexterity', op: 'mul', value: 6.75 }] }, { id: 'ku-s-t4', label: 'Turn 4 (x10 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 10 }, { stat: 'dexterity', op: 'mul', value: 10 }] }, { id: 'ku-s-t5', label: 'Turn 5 (x15 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 15 }, { stat: 'dexterity', op: 'mul', value: 15 }] }, { id: 'ku-s-t6', label: 'Turn 6 (x22.5 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 22.5 }, { stat: 'dexterity', op: 'mul', value: 22.5 }] }], notes: 'Toggle exactly one turn button at a time. ATK/MAG from SPD/DEX derived at double rate.' },
  wartrivial:       { name: 'SHIMMYFUL War, What a Trivial thing.', desc: 'Permanently gain +15 to all stats for every fight you leave early.', passive: [], situational: [{ id: 'wt-s-1', label: '1 fight left early (+15 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 15 }] }, { id: 'wt-s-3', label: '3 fights left (+45 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 45 }] }, { id: 'wt-s-5', label: '5 fights left (+75 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 75 }] }, { id: 'wt-s-10', label: '10 fights left (+150 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 150 }] }, { id: 'wt-s-20', label: '20 fights left (+300 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 300 }] }] },
  perfectsoul:      { name: 'SHIMMYFUL I want a perfect soul.', desc: 'Absorb enemies\' souls if they are below 30% HP, gaining a larger portion of their stats. Each soul absorbed reduces your sanity.', passive: [], notes: 'Select a character and click ABSORB SOUL to permanently gain 55-90% of their stats (wider range than base).' },
  reekofdisease:    { name: 'SHIMMYFUL You reek of disease.', desc: 'If an enemy is below 55% HP, immediately apply 7 stacks of POISON on them, dealing -30% HP per turn until they are defeated.', passive: [], notes: 'Auto-apply 7 poison stacks to enemies below 55% HP. -30% HP per turn total.' },
  megalostrikeback: { name: 'SHIMMYFUL Megalo Strike Back', desc: 'If fighting the same enemy for the second time, gain +250% Crit Chance and +250% Crit Damage. Defeating that enemy permanently adds these bonuses to your stats.', passive: [], situational: [{ id: 'msb-s-2nd', label: 'Second fight vs this enemy (+250% Crit, +250% Crit DMG)', passive: [{ stat: 'crit_rate', op: 'pct', value: 250 }, { stat: 'crit_dmg', op: 'pct', value: 250 }] }, { id: 'msb-s-perm', label: 'Enemy defeated (permanent +250% Crit, +250% Crit DMG)', passive: [{ stat: 'crit_rate', op: 'pct', value: 250 }, { stat: 'crit_dmg', op: 'pct', value: 250 }] }] },
  engarde:          { name: 'SHIMMYFUL En garde!', desc: 'Pick one enemy and force them into a separate 1v1 arena. Neither can interact with other units. The arena lasts 5 rounds or until one is knocked out. The winner gains x2 ATK and SPD for the rest of the fight.', passive: [], situational: [{ id: 'eg-s-arena', label: 'In the arena (1v1 active)', passive: [] }, { id: 'eg-s-win', label: 'Won the arena (x2 ATK and SPD)', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'spd', op: 'mul', value: 2 }] }] },
  killingspree:     { name: 'SHIMMYFUL Killing Spree', desc: 'For every enemy killed this fight, permanently gain +8% SPD and +8% ATK. Losing a fight resets all stacks.', passive: [], situational: [{ id: 'ks-s-1', label: '1 kill (+8% SPD, +8% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 8 }, { stat: 'atk', op: 'pct', value: 8 }] }, { id: 'ks-s-3', label: '3 kills (+24% SPD, +24% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 24 }, { stat: 'atk', op: 'pct', value: 24 }] }, { id: 'ks-s-5', label: '5 kills (+40% SPD, +40% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 40 }, { stat: 'atk', op: 'pct', value: 40 }] }, { id: 'ks-s-10', label: '10 kills (+80% SPD, +80% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 80 }, { stat: 'atk', op: 'pct', value: 80 }] }, { id: 'ks-s-20', label: '20 kills (+160% SPD, +160% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 160 }, { stat: 'atk', op: 'pct', value: 160 }] }] },
  armyofshurima:    { name: 'SHIMMYFUL The army of Shurima never dies', desc: 'At the start of every fight, summon 5 sand soldiers with 100 HP, 75 ATK, 20 DEF, 45 SPD and 45 MAG each. Fallen soldiers respawn once per fight.', passive: [], notes: 'Summons 5 sand soldiers at battle start. Enhanced stats vs base version. Each soldier respawns once.' },
  ialwayscomeback:  { name: 'SHIMMYFUL I always come back', desc: 'Every time you are defeated, permanently gain +35% to all base stats. The battle immediately after being defeated, all attacks deal 100% True Damage.', passive: [], situational: [{ id: 'iac-s-true', label: 'Battle after defeat (100% True Damage)', passive: [{ stat: 'true_dmg', op: 'add', value: 100 }] }, { id: 'iac-s-1', label: '1 defeat (+35% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 35 }] }, { id: 'iac-s-2', label: '2 defeats (+70% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 70 }] }, { id: 'iac-s-3', label: '3 defeats (+105% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 105 }] }, { id: 'iac-s-5', label: '5 defeats (+175% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 175 }] }] },
  thefinalact:      { name: 'SHIMMYFUL The final act', desc: 'If anyone drops below 5% HP, everyone is healed, all DEF drops to 0, and your ATK and MAG increase by x1.5 per unit currently in the battle.', passive: [], situational: [{ id: 'tfa-s-2u', label: 'Triggered, 2 units in battle (x2.25 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 2.25 }, { stat: 'mag', op: 'mul', value: 2.25 }] }, { id: 'tfa-s-4u', label: 'Triggered, 4 units in battle (x5.06 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 5.06 }, { stat: 'mag', op: 'mul', value: 5.06 }] }, { id: 'tfa-s-6u', label: 'Triggered, 6 units in battle (x11.39 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 11.39 }, { stat: 'mag', op: 'mul', value: 11.39 }] }, { id: 'tfa-s-8u', label: 'Triggered, 8 units in battle (x25.63 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 25.63 }, { stat: 'mag', op: 'mul', value: 25.63 }] }] },
  truehero:         { name: 'SHIMMYFUL True Hero', desc: 'The more kills the enemy has, the higher your stats. Gain x1.05 to all main stats for every kill the target has to their name.', passive: [], situational: [{ id: 'th-s-5k', label: 'Enemy has 5 kills', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }, { id: 'th-s-10k', label: 'Enemy has 10 kills', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }, { id: 'th-s-20k', label: 'Enemy has 20 kills', passive: [{ stat: 'all_main', op: 'pct', value: 100 }] }, { id: 'th-s-50k', label: 'Enemy has 50+ kills, max', passive: [{ stat: 'all_main', op: 'pct', value: 200 }] }] },
  breakunbreakable: { name: 'SHIMMYFUL Break the Unbreakable', desc: 'Ignore all enemy DEF. Deal additional damage proportional to how much DEF the enemy has. Each point of enemy DEF also adds +0.5% ATK to you for the fight.', passive: [], notes: 'Enemy DEF completely ignored. Bonus damage = enemy DEF value. +0.5% ATK per point of enemy DEF for that fight.' },
  itwasutile:       { name: 'SHIMMYFUL It was Futile', desc: 'If hit by an enemy whose ATK is equal to or lower than yours, you take zero damage. The attack simply does not land.', passive: [], notes: 'Immune to attacks from enemies with equal or lower ATK. RP-adjudicated.' },
  absoluteterritory:{ name: 'SHIMMYFUL Absolute Territory', desc: 'You are forced to wear thigh highs and a miniskirt. In exchange: x5 ATK, x5 DEF, x5 MAG and x5 Crit Chance.', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'crit_rate', op: 'pct', value: 400 }] },
  ifeelmonster:     { name: 'SHIMMYFUL I feel like a Monster', desc: 'You can harm allies. For every ally you attack, gain +75% ATK and +75% MAG. Stacks per ally attacked.', passive: [], situational: [{ id: 'ifm-s-1a', label: '1 ally attacked (+75% ATK, +75% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'mag', op: 'pct', value: 75 }] }, { id: 'ifm-s-2a', label: '2 allies attacked (+150% ATK, +150% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }] }, { id: 'ifm-s-3a', label: '3 allies attacked (+225% ATK, +225% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 225 }, { stat: 'mag', op: 'pct', value: 225 }] }, { id: 'ifm-s-4a', label: '4+ allies attacked (+300% ATK, +300% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 300 }, { stat: 'mag', op: 'pct', value: 300 }] }] },
  nothereyou:       { name: 'SHIMMYFUL I\'m not here for you', desc: 'Choose one ally. You can only heal them and yourself. Every time you heal that ally, gain +80% to all non-HP stats for 1 round.', passive: [], situational: [{ id: 'nhy-s-heal', label: 'Just healed chosen ally (+80% ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'def', op: 'pct', value: 80 }, { stat: 'mag', op: 'pct', value: 80 }, { stat: 'spd', op: 'pct', value: 80 }] }] },
  woetothee:        { name: 'SHIMMYFUL Woe to Thee', desc: 'Every 2 ATK converts to 1% True Damage, capped at 90%. Upon receiving this trait, immediately roll two random shimmyful legendary traits on top of it.', passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 2, perValue: 1, cap: 90 }], notes: 'On pickup: auto-grants 2 random shimmyful legendaries. True Damage scales with ATK automatically.' },
  paralyzer:        { name: 'SHIMMYFUL Paralyzer', desc: 'On-hit, apply PARALYZED to enemies. Paralyzed enemies skip a turn and lose all SPD and DEX. Gain +8% DEF per Paralyzed enemy on the field.', passive: [], situational: [{ id: 'par-s-1', label: '1 Paralyzed enemy (+8% DEF)', passive: [{ stat: 'def', op: 'pct', value: 8 }] }, { id: 'par-s-2', label: '2 Paralyzed enemies (+16% DEF)', passive: [{ stat: 'def', op: 'pct', value: 16 }] }, { id: 'par-s-3', label: '3 Paralyzed enemies (+24% DEF)', passive: [{ stat: 'def', op: 'pct', value: 24 }] }, { id: 'par-s-4', label: '4+ Paralyzed enemies (+32% DEF)', passive: [{ stat: 'def', op: 'pct', value: 32 }] }] },
  stillstanding:    { name: 'SHIMMYFUL Still Standing', desc: 'Upon reaching 35% HP, immediately heal back to 60% HP and gain SHIMMYFUL FOCUS for 4 turns. SHIMMYFUL FOCUS: attacks cannot miss, dodge chance is greatly increased, and all attacks deal +25% bonus damage. Kills extend FOCUS with extra turns.', passive: [], situational: [{ id: 'ss-s-focus', label: 'SHIMMYFUL FOCUS active (4 turns, +25% bonus dmg)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'mag', op: 'pct', value: 25 }] }, { id: 'ss-s-kill', label: 'Kill extended SHIMMYFUL FOCUS (extra turn)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'mag', op: 'pct', value: 25 }] }], notes: 'At 35% HP: auto-heal to 60% + FOCUS for 4 turns. +25% ATK/MAG while FOCUS is active.' },
  willsurvive:      { name: 'SHIMMYFUL I will Survive!', desc: 'If your life is threatened, you instinctively teleport far away and gain +25% all stats for 1 round after teleporting. You can still be knocked out.', passive: [], situational: [{ id: 'ws-s-post', label: 'Teleported (round after, +25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }] },
  banquet:          { name: 'SHIMMYFUL Banquet', desc: 'Various foods appear on the battlefield, invisible to enemies. You and your allies heal 15% HP per food eaten without wasting a turn, but lose only -15% SPD for that turn.', passive: [], situational: [{ id: 'ban-s-eating', label: 'Eating food this turn (-15% SPD)', passive: [{ stat: 'spd', op: 'pct', value: -15 }] }] },
  raciallymotivated:{ name: 'SHIMMYFUL Racially Motivated', desc: 'Deal x2.5 damage to enemies of a different species. Deal x0.75 damage to enemies of the same species.', passive: [], situational: [{ id: 'rm-s-diff', label: 'Targeting different species (x2.5 damage)', passive: [{ stat: 'atk', op: 'mul', value: 2.5 }, { stat: 'mag', op: 'mul', value: 2.5 }] }, { id: 'rm-s-same', label: 'Targeting same species (x0.75 damage)', passive: [{ stat: 'atk', op: 'mul', value: 0.75 }, { stat: 'mag', op: 'mul', value: 0.75 }] }] },
  jolly:            { name: 'SHIMMYFUL Jolly', desc: 'During Christmas, get x8 all stats. Also, during the week leading up to Christmas, get x2 all stats.', passive: [], situational: [{ id: 'jolly-s-xmas', label: 'It\'s Christmas (x8 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 8 }] }, { id: 'jolly-s-pre', label: 'Week before Christmas (x2 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }] },
  spooky:           { name: 'SHIMMYFUL Spooky', desc: 'During Halloween, get x8 all stats. Also, during the week leading up to Halloween, get x2 all stats.', passive: [], situational: [{ id: 'spooky-s-hw', label: 'It\'s Halloween (x8 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 8 }] }, { id: 'spooky-s-pre', label: 'Week before Halloween (x2 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }] },
  anarchy:          { name: 'SHIMMYFUL Anarchy', desc: 'All enemies can hit each other and all allies can hit each other. Hitting a teammate grants them +8% all stats; same with enemies. You accumulate everyone\'s anarchy bonuses.', passive: [], notes: 'RP: friendly fire enabled. Each friendly-fire hit grants target +8% stats. You gain all such accumulated bonuses.' },
  yourearly:        { name: 'SHIMMYFUL You\'re early', desc: 'Apply BLEEDING, POISON, BURNING, and FROZEN to the first enemy who attacks in the battle, lasting 3 rounds.', passive: [], notes: 'Reactive trigger on the first enemy attack of the battle. All four status effects for 3 rounds.' },

  // ── NEW LEGENDARY SHIMMYFULS ─────────────────────────────────
  blind_monk:         { name: 'SHIMMYFUL Blind Monk', desc: 'apply blinded-onhit and to yourself. +100% accuracy while above 60% HP. Apply CONFUSED on-hit with a 40% chance.', passive: [], situational: [{ id: 'bm-s-above60', label: 'Above 60% HP (+100% accuracy)', passive: [{ stat: 'dexterity', op: 'add', value: 100 }] }] },

  warden_ally:        { name: 'SHIMMYFUL Warden', desc: '+65% DEF per ally.', passive: [], situational: [{ id: 'wa-s-1', label: '1 ally (+65% DEF)', passive: [{ stat: 'def', op: 'pct', value: 65 }] }, { id: 'wa-s-2', label: '2 allies (+130% DEF)', passive: [{ stat: 'def', op: 'pct', value: 130 }] }, { id: 'wa-s-3', label: '3 allies (+195% DEF)', passive: [{ stat: 'def', op: 'pct', value: 195 }] }, { id: 'wa-s-4', label: '4 allies (+260% DEF)', passive: [{ stat: 'def', op: 'pct', value: 260 }] }, { id: 'wa-s-5', label: '5 allies (+325% DEF)', passive: [{ stat: 'def', op: 'pct', value: 325 }] }] },

  funky_battle:       { name: 'SHIMMYFUL Funky Battle', desc: 'All units on the battle turn FUNKY. +45% to all non-hp stats. Gain +8% crit chance per hit during a fight. Gain +8% DEX per attack dodged during a fight.', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'def', op: 'pct', value: 45 }, { stat: 'mag', op: 'pct', value: 45 }, { stat: 'spd', op: 'pct', value: 45 }], situational: [{ id: 'fb-s-5h', label: '5 hits (+40% crit)', passive: [{ stat: 'crit_rate', op: 'add', value: 40 }] }, { id: 'fb-s-10h', label: '10 hits (+80% crit)', passive: [{ stat: 'crit_rate', op: 'add', value: 80 }] }, { id: 'fb-s-5d', label: '5 dodges (+40% DEX)', passive: [{ stat: 'dexterity', op: 'add', value: 40 }] }, { id: 'fb-s-10d', label: '10 dodges (+80% DEX)', passive: [{ stat: 'dexterity', op: 'add', value: 80 }] }] },

  fear_aura:          { name: 'SHIMMYFUL FEAR', desc: 'Twice a battle, let out a terrifying cry, applying FEAR to all units on the field for 2-3 rounds except you, including allies. +75% Lifesteal and crit chance per FEARED unit.', passive: [], situational: [{ id: 'fear-s-1u', label: '1 FEARED unit (+75% Lifesteal, +75% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 75 }, { stat: 'crit_rate', op: 'add', value: 75 }] }, { id: 'fear-s-2u', label: '2 FEARED units (+150% Lifesteal, +150% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 150 }, { stat: 'crit_rate', op: 'add', value: 150 }] }, { id: 'fear-s-3u', label: '3 FEARED units (+225% Lifesteal, +225% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 225 }, { stat: 'crit_rate', op: 'add', value: 225 }] }] },

  trinity_trait:      { name: 'SHIMMYFUL Trinity', desc: '+1 ATK per 1 DEF. +1 DEF per 1 SPE. +1 SPE per 2 ATK. +50% DEX, +50% Resilience, +50% Crit Chance', passive: [{ op: 'derived', stat: 'atk', from: 'def', per: 1, perValue: 1 }, { op: 'derived', stat: 'def', from: 'spd', per: 1, perValue: 1 }, { op: 'derived', stat: 'spd', from: 'atk', per: 2, perValue: 1 }, { stat: 'dexterity', op: 'add', value: 50 }, { stat: 'resilience', op: 'add', value: 50 }, { stat: 'crit_rate', op: 'add', value: 50 }] },

  retribution:        { name: 'SHIMMYFUL Retribution', desc: 'for every time you\'re hit, gain x8 ATK for your next attack.', passive: [], situational: [{ id: 'ret-s-active', label: 'Just been hit (x8 ATK for next attack)', passive: [{ stat: 'atk', op: 'mul', value: 8 }] }] },

  beyond_edge:        { name: 'SHIMMYFUL Beyond the Edge', desc: 'When dropping below 0% HP, gain a new HP bar worth 150% of your max HP. DEF drops to 0', passive: [], situational: [{ id: 'bte-s-active', label: 'Second HP bar active (DEF → 0)', passive: [{ stat: 'def', op: 'mul', value: 0 }] }] },

  my_true_form:       { name: 'SHIMMYFUL MY TRUE FORM!', desc: 'Activate your EX form at any point, doubling the size of your legs and increasing your SPD, ATK and MAG x4, but lowering your defense by 30%', passive: [], situational: [{ id: 'mtf-s-active', label: 'EX Form active (x4 SPD/ATK/MAG, -30% DEF)', passive: [{ stat: 'spd', op: 'mul', value: 4 }, { stat: 'atk', op: 'mul', value: 4 }, { stat: 'mag', op: 'mul', value: 4 }, { stat: 'def', op: 'pct', value: -30 }] }] },

  drama_romance:      { name: 'SHIMMYFUL Drama, Romance, Bloodshed!', desc: 'For every unit (ally or enemy) knocked out, gain +15% all substats to the whole team and apply 2 stacks of ENVIGORATED to all allies for 3 rounds', passive: [], situational: [{ id: 'drb-s-1ko', label: '1 KO (+15% all substats)', passive: [{ stat: 'all_sub', op: 'add', value: 15 }] }, { id: 'drb-s-3ko', label: '3 KOs (+45% all substats)', passive: [{ stat: 'all_sub', op: 'add', value: 45 }] }, { id: 'drb-s-5ko', label: '5 KOs (+75% all substats)', passive: [{ stat: 'all_sub', op: 'add', value: 75 }] }] },

  imperial_march:     { name: 'SHIMMYFUL Imperial March', desc: 'Every unit defeated (not killed) has a chance to join your party permanently, turning into your subject. Gain a crown that increases your non-hp stats by +30% per subject.', passive: [], situational: [{ id: 'im-s-1s', label: '1 subject (+30% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'def', op: 'pct', value: 30 }, { stat: 'mag', op: 'pct', value: 30 }, { stat: 'spd', op: 'pct', value: 30 }] }, { id: 'im-s-3s', label: '3 subjects (+90% non-HP stats)', passive: [{ stat: 'atk', op: 'pct', value: 90 }, { stat: 'def', op: 'pct', value: 90 }, { stat: 'mag', op: 'pct', value: 90 }, { stat: 'spd', op: 'pct', value: 90 }] }] },

  violent_crusade:    { name: 'SHIMMYFUL Violent Crusade', desc: 'Permanently apply ADRENALINE status effect during every fight. Attacks deal NULLIFIED status effect. Killing an enemy grants HELLFIRE BURN for your next 5 attacks, carries over through fights. At 50 kills, gain permanent HELLFIRE BURN on your attacks and x10 ATK.', passive: [], situational: [{ id: 'vc-s-50k', label: 'At 50 kills (permanent HELLFIRE BURN + x10 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 10 }] }], cultivation: { label: 'Total Kills', perStack: [], defaultStacks: 0, maxStacks: 999 } },

  brute_trait:        { name: 'SHIMMYFUL Brute', desc: 'can\'t use magic, MAG is set to 0. Gain +35% ATK per punch during a fight. Being physically hit increases DEF by +35%, stacking. Become slightly bigger and buffer per hit taken/dealt', passive: [{ stat: 'mag', op: 'mul', value: 0 }], situational: [{ id: 'brute-s-5p', label: '5 punches (+175% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 175 }] }, { id: 'brute-s-10p', label: '10 punches (+350% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 350 }] }, { id: 'brute-s-5h', label: '5 hits taken (+175% DEF)', passive: [{ stat: 'def', op: 'pct', value: 175 }] }, { id: 'brute-s-10h', label: '10 hits taken (+350% DEF)', passive: [{ stat: 'def', op: 'pct', value: 350 }] }] },

  demon_pact:         { name: 'SHIMMYFUL Demon Pact', desc: 'Turn into a half-demon. +150% Lifesteal, -75% true damage. With every hit, apply CURSED for 3 turns (-60% stats to enemies). Being hit applies PIERCED to you.', passive: [{ stat: 'lifesteal', op: 'add', value: 150 }, { stat: 'true_dmg', op: 'add', value: -75 }] },

  god_complex:        { name: 'SHIMMYFUL God Complex', desc: 'Apply BAIT to yourself. Get +150% DEX and SPD. Apply FLOWING to yourself every turn, non-stacking. Apply PATIENT and SHIELDED to yourself for the first time you\'re hit during a fight. Gain +15% all non-hp stats per enemy or ally you\'ve insulted or taunted in a fight, one stack per unit. Get 1 stack of Empowered every turn, stacking.', passive: [{ stat: 'dexterity', op: 'add', value: 150 }, { stat: 'spd', op: 'pct', value: 150 }], situational: [{ id: 'gc-s-1t', label: '1 unit taunted (+15% non-HP)', passive: [{ stat: 'atk', op: 'pct', value: 15 }, { stat: 'def', op: 'pct', value: 15 }, { stat: 'mag', op: 'pct', value: 15 }, { stat: 'spd', op: 'pct', value: 15 }] }, { id: 'gc-s-3t', label: '3 units taunted (+45% non-HP)', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'def', op: 'pct', value: 45 }, { stat: 'mag', op: 'pct', value: 45 }, { stat: 'spd', op: 'pct', value: 45 }] }] },

  facade_trait:       { name: 'SHIMMYFUL Façade', desc: 'First time you\'re hit during a fight, nullify all damage and increase your DEF and HP by 1.5x the amount of ATK and SPD you have.', passive: [], situational: [{ id: 'fac-s-triggered', label: 'Façade triggered (first hit nullified, DEF+HP boosted)', passive: [] }] },

  vortex_trait:       { name: 'SHIMMYFUL Vortex', desc: 'Apply DEFERRED status effect to the first enemy you hit. Apply Weighted to every enemy you hit afterwards. Enemies that hit you have a 50% chance of being applied with CONFUSED', passive: [], notes: 'First hit: DEFERRED. Subsequent hits: WEIGHTED. 50% CONFUSED when enemies hit you.' },

  hypno:              { name: 'SHIMMYFUL Hypno', desc: 'Apply TIRED on-hit. Apply EXHAUSTED on-hit if hitting TIRED enemies. Apply ASLEEP on-hit if target is EXHAUSTED. Apply HAUNTED to all enemies the first two turns', passive: [], notes: 'Chain: TIRED → EXHAUSTED → ASLEEP. HAUNTED to all enemies on turns 1 and 2.' },

  charmer:            { name: 'SHIMMYFUL Charmer', desc: 'Apply CHARMED on-hit with a 60% chance for 2 rounds,  and BRAINWASHED on-hit with a 15% chance for 3 rounds.  15% chance to apply BERSERK instead of BRAINWASHED, for 3 rounds.', passive: [] },

  mero_mero:          { name: 'SHIMMYFUL Mero, mero!', desc: 'Apply PETRIFIED on-hit with a 15% chance, for 2 rounds. Gain +75% SPD and increase the effectivity of your range attacks by +75%', passive: [{ stat: 'spd', op: 'pct', value: 75 }] },

  high_roller:        { name: 'SHIMMYFUL High-roller', desc: 'Apply ANTE UP to yourself every turn. Hitting an ANTE UP increases your next ANTE UP\'s buff by an extra 2 (so x4 turns into x6), resets upon missing or hitting an ally.', passive: [] },

  energy_drain:       { name: 'SHIMMYFUL Energy Drain', desc: 'Apply TIRED for 5 turns to all enemies who attack you physically. Applies NULLIFIED for 5 turns to enemies who attack you with magic. Apply OVERHEATED for 5 rounds on-hit with a 60% chance. +8% all non-HP stats per OVERHEATED enemy.', passive: [], situational: [{ id: 'ed-s-1ov', label: '1 OVERHEATED enemy (+8% non-HP)', passive: [{ stat: 'atk', op: 'pct', value: 8 }, { stat: 'def', op: 'pct', value: 8 }, { stat: 'mag', op: 'pct', value: 8 }, { stat: 'spd', op: 'pct', value: 8 }] }, { id: 'ed-s-3ov', label: '3 OVERHEATED enemies (+24% non-HP)', passive: [{ stat: 'atk', op: 'pct', value: 24 }, { stat: 'def', op: 'pct', value: 24 }, { stat: 'mag', op: 'pct', value: 24 }, { stat: 'spd', op: 'pct', value: 24 }] }, { id: 'ed-s-5ov', label: '5 OVERHEATED enemies (+40% non-HP)', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] }] },

  frostfire_trait:    { name: 'SHIMMYFUL Frostfire', desc: 'Apply FROZEN on-hit for 2 rounds with a 65% chance. Apply BURN on-hit for 2 rounds with a 65% chance. Applying both in one turn applies HELLFIRE BURN for 3 rounds and gives you +150% True Damage on your next hit. Can\'t be knocked out while an enemy is either frozen or burning.', passive: [], situational: [{ id: 'ff-s-bonus', label: 'Applied both FROZEN & BURN this turn (+150% True Damage next hit)', passive: [{ stat: 'true_dmg', op: 'add', value: 150 }] }] },

  karmic_retribution: { name: 'SHIMMYFUL Karmic Retribution', desc: 'Your attacks deal x10 damage, applied in the span of 3 turns, to enemies who have more than 15 kills.', passive: [], situational: [{ id: 'kr-s-active', label: 'Targeting enemy with 15+ kills (x10 dmg over 3 turns)', passive: [{ stat: 'atk', op: 'mul', value: 10 }] }] },

  soul_fighter:       { name: 'SHIMMYFUL Soul Fighter', desc: 'Your body can\'t take damage, instead your soul does. Losing a fight will kill you, but you gain x7 MAG, increased to x15 when below 15% HP.', passive: [{ stat: 'mag', op: 'mul', value: 7 }], situational: [{ id: 'sf-s-low', label: 'Below 15% HP (MAG x15 instead)', passive: [{ stat: 'mag', op: 'mul', value: 15 }] }] },

  triple_threat:      { name: 'SHIMMYFUL Triple The Threat', desc: 'While in a TRIO, the entire TRIO gains x5 all non-hp stats, and apply ENVIGORATED to every ally for 5 rounds at the start of a fight. If someone in the trio is knocked out, your next attack will deal 5 stacks of BLEEDING for 5 turns, but you and your ally\'s stats will be dropped to x0.5 for the rest of the fight, unless the knocked out ally is revived.', passive: [], situational: [{ id: 'tt-s-trio', label: 'In a TRIO (x5 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'spd', op: 'mul', value: 5 }] }, { id: 'tt-s-koed', label: 'Trio member KO\'d (x0.5 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 0.5 }, { stat: 'def', op: 'mul', value: 0.5 }, { stat: 'mag', op: 'mul', value: 0.5 }, { stat: 'spd', op: 'mul', value: 0.5 }] }] },

  but_you_refused:    { name: 'SHIMMYFUL But You Refused', desc: 'upon dropping below 1% HP, revive on 75% HP and apply DETERMINED to yourself for the rest of the fight. ACT is more likely to succeed after.', passive: [], situational: [{ id: 'byr-s-active', label: 'Revived via SHIMMYFUL But You Refused (DETERMINED)', passive: [] }] },

  i_am_perfect:       { name: 'SHIMMYFUL I am Perfect', desc: 'Become cocky, increasingly so as a fight goes on. For every dodged attack, gain +75% all non-HP stats for the rest of the fight. Landing an attack grants the same buff. Gain REFRESHED for 2 rounds upon being knocked below 20% HP', passive: [], situational: [{ id: 'iap-s-1s', label: '1 dodge/hit (+75% all non-HP)', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'def', op: 'pct', value: 75 }, { stat: 'mag', op: 'pct', value: 75 }, { stat: 'spd', op: 'pct', value: 75 }] }, { id: 'iap-s-3s', label: '3 dodges/hits (+225% all non-HP)', passive: [{ stat: 'atk', op: 'pct', value: 225 }, { stat: 'def', op: 'pct', value: 225 }, { stat: 'mag', op: 'pct', value: 225 }, { stat: 'spd', op: 'pct', value: 225 }] }] },

  stoner:             { name: 'SHIMMYFUL Stoner', desc: 'Apply 2 stacks of DRUGGED to yourself every turn, stacking.', passive: [] },

  drunkard:           { name: 'SHIMMYFUL Drunkard', desc: 'Apply 2 stacks of DRUNK to yourself every turn, stacking.', passive: [] },

  rasta_fire:         { name: 'SHIMMYFUL Rasta Fire', desc: 'Apply BURNING and DRUGGED on-hit with a 95% chance. x30 DEF towards DRUGGED enemies.', passive: [], situational: [{ id: 'rf-s-drugged', label: 'Hitting DRUGGED enemy (x30 DEF)', passive: [{ stat: 'def', op: 'mul', value: 30 }] }] },

  chemicals:          { name: 'SHIMMYFUL CHEMICALS', desc: 'Apply two random NEGATIVE status effects to all enemies at the beginning of a fight. Apply two random POSITIVE status effects to all allies at the beginning of a fight', passive: [] },

  chem_warrior:       { name: 'SHIMMYFUL Chem-warrior', desc: 'Apply a random NEUTRAL or NEGATIVE status effect to enemies on-hit. Gain +15% ATK and DEF per stack of any status effect on enemies.', passive: [], situational: [{ id: 'cw-s-1s', label: '1 status stack (+15% ATK, +15% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 15 }, { stat: 'def', op: 'pct', value: 15 }] }, { id: 'cw-s-5s', label: '5 stacks (+75% ATK, +75% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'def', op: 'pct', value: 75 }] }, { id: 'cw-s-10s', label: '10 stacks (+150% ATK, +150% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'def', op: 'pct', value: 150 }] }] },

  aoe_all:            { name: 'SHIMMYFUL AOE', desc: 'All of your attacks turn AOE. Get +8% ATK per enemy hit in a fight, infinitely stacking. Apply ', passive: [], cultivation: { label: 'Enemies Hit', perStack: [{ stat: 'atk', op: 'pct', value: 8 }], defaultStacks: 0, maxStacks: 999 } },

  hornet:             { name: 'SHIMMYFUL Hornet', desc: 'Apply POISON on-hit. Hitting a target that\'s poisoned triples the poison stacks (x1 - x3 - x9 - x27 ...)', passive: [] },

  chaotic:            { name: 'SHIMMYFUL Chaotic', desc: 'Everyone\'s stats are shuffled in a fight. Additionally, every 3 turns stats are reshuffled.', passive: [] },

  oh_brother:         { name: 'SHIMMYFUL Oh Brother, where art thou?', desc: 'Gain x6 all stats when fighting a sibling or with a sibling in your team.', passive: [], situational: [{ id: 'ob-s-active', label: 'Fighting/with a sibling (x6 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 6 }] }] },

  mimic_trait:        { name: 'SHIMMYFUL Mimic', desc: 'Choose an enemy, and steal all of their abilities, weapons, and add 75% of their stats to yours.', passive: [] },

  regicide:           { name: 'SHIMMYFUL Regicide', desc: 'Fighting someone with royal blood grants x5 all non-hp stats. Killing them grants 150 MAG and ATK permanently.', passive: [], situational: [{ id: 'reg-s-active', label: 'Fighting royalty (x5 all non-HP stats)', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'spd', op: 'mul', value: 5 }] }, { id: 'reg-s-killed', label: 'Killed royalty (+150 ATK, +150 MAG, permanent)', passive: [{ stat: 'atk', op: 'add', value: 150 }, { stat: 'mag', op: 'add', value: 150 }] }] },

  supernova:          { name: 'SHIMMYFUL Supernova', desc: 'Defeating an enemy causes a cosmic explosion, dealing 30% of that enemy\'s max hp as true damage to every unit except yourself in the field. Everyone except you is applied DEFERRED and CORRODED for 5 rounds.', passive: [] },

  chilling_elegy:     { name: 'SHIMMYFUL Chilling Elegy', desc: 'Apply FROZEN on-hit with a 70% chance for 3 rounds. Hitting a FROZEN enemy applies DOOM to them.', passive: [] },

  defiant:            { name: 'SHIMMYFUL Defiant', desc: 'Being hit grants ANGRY, ENVIGORATED, and EMPOWERED, infinitely stacking.', passive: [] },

  the_brutalizer:     { name: 'SHIMMYFUL The Brutalizer', desc: '+120 ATK, +80 DEF, +250 HP, +40% Crit chance, +40% Crit Damage', passive: [{ stat: 'atk', op: 'add', value: 120 }, { stat: 'def', op: 'add', value: 80 }, { stat: 'hp', op: 'add', value: 250 }, { stat: 'crit_rate', op: 'add', value: 40 }, { stat: 'crit_dmg', op: 'add', value: 40 }] },

  evils_bane:         { name: 'SHIMMYFUL Evil\'s Bane', desc: 'Apply DEFERRED and DOOM for 3 rounds on-hit to enemies with more than 15 kills.', passive: [] },

  cheerleader:        { name: 'SHIMMYFUL Cheerleader', desc: 'Apply RALLIED and EMPOWERED to all allies when a fight starts, and JOYFUL and REFRESHED to yourself', passive: [] },

  stand_til_end:      { name: 'SHIMMYFUL Stand Until The End', desc: 'Units in the field can no longer be knocked out, only killed. Get +15% Crit chance and crit damage per kill permanently.', passive: [], cultivation: { label: 'Kills', perStack: [{ stat: 'crit_rate', op: 'add', value: 15 }, { stat: 'crit_dmg', op: 'add', value: 15 }], defaultStacks: 0, maxStacks: 999 } },

  trial_justice:      { name: 'SHIMMYFUL Trial by Justice', desc: 'At the start of a fight, Check the enemy\'s total KILLS and SPARES. If the KILLS exceed the SPARES, deal 75% max hp true damage to them with an energy revolver. Doesn\'t consume a turn', passive: [] },

  eve_draws_close:    { name: 'SHIMMYFUL Your eve draws to a close', desc: 'When an enemy\'s HP drops below 35%, apply EXHAUSTED and SHATTERED to them for the rest of the fight. Gain +75% SPD for every EXHAUSTED or TIRED enemy on the field.', passive: [], situational: [{ id: 'edc-s-1e', label: '1 EXHAUSTED/TIRED enemy (+75% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 75 }] }, { id: 'edc-s-2e', label: '2 such enemies (+150% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 150 }] }, { id: 'edc-s-3e', label: '3 such enemies (+225% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 225 }] }] },

  one_hit_ko:         { name: 'SHIMMYFUL 1 Hit-KO', desc: 'Every fight, you have a chance to deal a punch that either has a 60% chance to knock you out or the enemy.', passive: [], notes: 'Once per fight: special punch — 60% chance to KO you, 40% to KO the enemy.' },

  shotgun_trait:      { name: 'SHIMMYFUL Shotgun', desc: 'You always skip the second turn. x6 ATK, attacks apply SOFTENED on-hit', passive: [{ stat: 'atk', op: 'mul', value: 6 }] },

  shatter_seeker:     { name: 'SHIMMYFUL Shatter Seeker', desc: 'Your critical hits apply BRITTLE to the target. Hitting a BRITTLE target always crits AND deals +50% True Damage. BRITTLE stacks are doubled on crit.', passive: [{ stat: 'true_dmg', op: 'add', value: 50 }] },

  demolitions_expert: { name: 'SHIMMYFUL Demolitions Expert', desc: 'Every 2nd hit applies VOLATILE to the target. When a VOLATILE explosion triggers, permanently gain +50 ATK and the explosion deals area damage to all enemies.', passive: [], cultivation: { label: 'VOLATILE Explosions Triggered (+50 ATK each)', perStack: [{ stat: 'atk', op: 'add', value: 50 }], defaultStacks: 0, maxStacks: 999 } },

  glass_coffin:       { name: 'SHIMMYFUL Glass Coffin', desc: 'When you would be knocked out, instead become PETRIFIED for 3 turns and revive with 60% HP. Triggers up to twice per fight. When PETRIFIED ends, gain SURGE and RECKLESS.', passive: [] },

  phantom_dance:      { name: 'SHIMMYFUL Phantom Dance', desc: 'Each successful dodge grants a stack of PHANTOM. When you are hit, all PHANTOM stacks are consumed — heal 8% HP per stack and gain +10% ATK per stack for the rest of the fight.', passive: [], cultivation: { label: 'ATK stacks from Phantom Dance', perStack: [{ stat: 'atk', op: 'pct', value: 10 }], defaultStacks: 0, maxStacks: 999 } },

  war_echo:           { name: 'SHIMMYFUL War Echo', desc: 'Your killing blow on an enemy triggers ECHO — the hit replays against the next enemy at 75% power. Chains up to 5 times per fight. Each echo that kills also chains.', passive: [] },

  anchored_titan:     { name: 'SHIMMYFUL Anchored Titan', desc: 'Become permanently ANCHORED. Gain +35 DEF every turn, stacking infinitely. Releasing ANCHORED converts all DEF stacks to one devastating hit and additionally applies VOLATILE and EXPOSED to the target.', passive: [], cultivation: { label: 'Turns Spent ANCHORED (+35 DEF each)', perStack: [{ stat: 'def', op: 'add', value: 35 }], defaultStacks: 0, maxStacks: 999 } },

  counterstrike_protocol: { name: 'SHIMMYFUL Counterstrike Protocol', desc: 'Gain MIRRORED at the start of every fight. Each reflected damage instance permanently adds to your ATK. When you reflect a killing blow, revive with 50% HP.', passive: [] },

  jinxmaster:         { name: 'SHIMMYFUL Jinxmaster', desc: 'Attacks apply JINXED to enemies. You are permanently JINXED. Deal +150% damage to JINXED targets and apply DECAY to JINXED enemies on-hit.', passive: [], situational: [{ id: 'jm-s-jinxed', label: 'Attacking a JINXED target (+150% damage)', passive: [{ stat: 'atk', op: 'pct', value: 150 }] }] },

  the_crumbling:      { name: 'SHIMMYFUL The Crumbling', desc: 'At the start of every fight, apply DECAY and FRACTURED to all enemies. For each turn an enemy survives under DECAY, permanently gain +25% ATK.', passive: [], cultivation: { label: 'Enemy-Turns Under DECAY (+25% ATK each)', perStack: [{ stat: 'atk', op: 'pct', value: 25 }], defaultStacks: 0, maxStacks: 999 } },

  fractured_reality:  { name: 'SHIMMYFUL Fractured Reality', desc: 'Your attacks apply FRACTURED to targets. Each FRACTURED echo heals you for 15% of the echo\'s damage and applies another stack of FRACTURED. FRACTURED stacks infinitely and each stack increases echo damage by 5%.', passive: [] },

  resonance_cascade:  { name: 'SHIMMYFUL Resonance Cascade', desc: 'Gain 2 RESONANT at the start of every fight. Each ability used adds another RESONANT stack. At 4 stacks, all abilities trigger twice. At 8 stacks, all abilities trigger three times.', passive: [], situational: [{ id: 'rc-s-4', label: 'At 4 RESONANT stacks (abilities fire twice)', passive: [] }, { id: 'rc-s-8', label: 'At 8 RESONANT stacks (abilities fire three times)', passive: [] }] },

  the_contradiction:  { name: 'SHIMMYFUL The Contradiction', desc: 'Healing deals damage to you instead. Taking damage heals you instead. You are permanently MIRRORED. All incoming status effects are inverted. Additionally, you reflect 50% of all magical damage as True Damage.', passive: [{ stat: 'true_dmg', op: 'add', value: 50 }] },

  redline:            { name: 'SHIMMYFUL Redline', desc: 'Permanently OVERLOADED. Below 25% HP: x5 ATK. Below 10% HP: x12 ATK. Additionally, OVERLOADED self-damage is halved.', passive: [], situational: [{ id: 'rl-s-low', label: 'Below 25% HP (OVERLOADED: x5 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 5 }] }, { id: 'rl-s-crit', label: 'Below 10% HP (OVERLOADED: x12 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 12 }] }] },

  voidwalker:         { name: 'SHIMMYFUL Voidwalker', desc: 'Permanently EXPOSED and BRITTLE. For every debuff on yourself, gain +75% ATK. Debuffs applied to you by enemies are added to the enemy instead (mirrored), and still count for your stack.', passive: [], cultivation: { label: 'Debuffs On Self (+75% ATK each)', perStack: [{ stat: 'atk', op: 'pct', value: 75 }], defaultStacks: 2, maxStacks: 999 } },

  switcheroo:         { name: 'SHIMMYFUL Switcheroo', desc: 'Twice per fight, when you drop below 40% HP, swap your current HP percentage with any opponent of your choice.', passive: [], notes: 'Twice per fight: at below 40% HP, choose any opponent to swap HP% with.' },

  copycat:            { name: 'SHIMMYFUL Copycat', desc: 'Each time you eliminate an opponent, permanently copy the SHIMMYFUL version of one of their traits and gain +30% all stats for that fight.', passive: [], situational: [{ id: 'cc-s-1', label: '1 kill (+30% all stats this fight)', passive: [{ stat: 'all_main', op: 'pct', value: 30 }] }, { id: 'cc-s-2', label: '2 kills (+60% all stats this fight)', passive: [{ stat: 'all_main', op: 'pct', value: 60 }] }, { id: 'cc-s-3', label: '3 kills (+90% all stats this fight)', passive: [{ stat: 'all_main', op: 'pct', value: 90 }] }] },

  loaded_dice:        { name: 'SHIMMYFUL Loaded Dice', desc: 'All chance-based effects (crits, dodges, procs) have their trigger rates tripled for everyone in the fight. The swings are enormous.', passive: [], notes: 'All % chances tripled for everyone in the fight.' },

  haunted:            { name: 'SHIMMYFUL Haunted', desc: 'Every round, your trait is swapped for a random one from the full pool and you gain +15% all stats (stacking).', passive: [], cultivation: { label: 'Rounds Passed (+15% all stats each)', perStack: [{ stat: 'all_main', op: 'pct', value: 15 }], defaultStacks: 0, maxStacks: 999 } },

  paper_crown:        { name: 'SHIMMYFUL Paper Crown', desc: 'You passively mirror the top TWO highest stat bonuses among all other fighters currently alive.', passive: [], notes: 'Mirror the two highest stat bonuses from any living fighter. Updates each round.' },

  wildcard_trait:     { name: 'SHIMMYFUL Wildcard', desc: 'On pick, gain 5 random common traits and 1 guaranteed rare trait. You can hold 5 traits at once.', passive: [], notes: 'On pickup: grants 5 random common + 1 random rare trait. Capacity increases to 5.' },

  big_spender:        { name: 'SHIMMYFUL Big Spender', desc: 'Once per fight, spend 5% HP to gain a random buff to any stat (x1.5–x3.0) for the whole fight. Always a positive roll.', passive: [], notes: 'Spend 5% HP: one random stat multiplied by x1.5–x3.0 for the fight.' },

  double_down:        { name: 'SHIMMYFUL Double Down', desc: 'Each fight, flip a coin. Heads: +80% ATK, DEF and MAG, x3.5 SPD. Tails: only -5% all stats.', passive: [], situational: [{ id: 'dd-s-heads', label: 'HEADS (+80% ATK/DEF/MAG, x3.5 SPD)', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'def', op: 'pct', value: 80 }, { stat: 'mag', op: 'pct', value: 80 }, { stat: 'spd', op: 'mul', value: 3.5 }] }, { id: 'dd-s-tails', label: 'TAILS (-5% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -5 }] }] },

  sore_loser:         { name: 'SHIMMYFUL Sore Loser (Legendary)', desc: 'Every time you take damage, a random opponent also takes 40% of that damage.', passive: [], notes: 'On-hit (received): 40% of damage dealt to you is also applied to a random opponent.' },

  comfort_food:       { name: 'SHIMMYFUL Comfort Food', desc: 'Each time you take damage, gain ATK equal to 100% of the HP lost. Stacks for the fight.', passive: [], cultivation: { label: 'HP Lost ÷10 (+10 ATK per stack)', perStack: [{ stat: 'atk', op: 'add', value: 10 }], defaultStacks: 0, maxStacks: 9999 } },

  training_arc:       { name: 'SHIMMYFUL Training Arc', desc: 'Your ATK, DEF, and MAG are halved for your first fight of the game. From then on, your SPD is permanently x8.', passive: [{ stat: 'spd', op: 'mul', value: 8 }], situational: [{ id: 'ta-s-first', label: 'First fight (ATK, DEF, MAG ÷2)', passive: [{ stat: 'atk', op: 'pct', value: -50 }, { stat: 'def', op: 'pct', value: -50 }, { stat: 'mag', op: 'pct', value: -50 }] }] },

  anime_protagonist:  { name: 'SHIMMYFUL Anime Protagonist', desc: 'Every fight you lose, permanently gain +30% all stats and +5% max HP.', passive: [], cultivation: { label: 'Fights Lost (+30% all stats, +5% HP each)', perStack: [{ stat: 'all_main', op: 'pct', value: 30 }, { stat: 'hp', op: 'pct', value: 5 }], defaultStacks: 0, maxStacks: 100 } },

  tiki_tiki:          { name: 'SHIMMYFUL Tiki Tiki', desc: 'You gain x5 all non-HP stats while singing. Opponents must listen, losing 20% all stats while the song continues.', passive: [], situational: [{ id: 'tt-s-singing', label: 'Currently singing (x5 ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'spd', op: 'mul', value: 5 }] }] },

  plot_convenience:   { name: 'SHIMMYFUL Plot Convenience', desc: 'Twice per game, a random opponent in your current fight randomly loses 60% of their current HP and gains EXPOSED for absolutely no reason.', passive: [], notes: 'Twice per game: one random opponent loses 60% current HP and gains EXPOSED for no reason.' },
};
