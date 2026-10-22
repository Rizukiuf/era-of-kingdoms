'use strict';
// ============================================================
//  ERA OF KINGDOMS — game data
// ============================================================
// shown in the main menu and written into exported saves; between releases main carries the next version with -dev,
// and the release PR drops the suffix (AGENTS.md, Project status)
const GAME_VERSION = '1.1.0-dev';
const RES = ['food', 'wood', 'gold', 'stone'];
const AGE_IDS = ['dark', 'feudal', 'castle', 'imperial'];
const TW = 64, TH = 32;           // isometric tile size in screen px at zoom 1
const STEP = 1 / 30;              // simulation step (game seconds)
const MAX_POP = 200;

const PCOLORS = [
  { k: 'blue',   c: '#2f6fe4', d: '#1b3f8a', l: '#9cbcf6' },
  { k: 'red',    c: '#d8392b', d: '#7d1d14', l: '#f3a197' },
  { k: 'green',  c: '#3a9f3d', d: '#1d5a20', l: '#9bd69c' },
  { k: 'yellow', c: '#e6c229', d: '#8a7012', l: '#f6e294' },
  { k: 'teal',   c: '#20b0bb', d: '#126970', l: '#93dfe5' },
  { k: 'purple', c: '#9150d0', d: '#4f2479', l: '#cba6ef' },
  { k: 'grey',   c: '#a3a3a3', d: '#575757', l: '#e0e0e0' },
  { k: 'orange', c: '#ec7f22', d: '#8a4610', l: '#f7c08f' },
];
// Color-blind mode (Settings.cb): the Okabe–Ito palette, which stays distinguishable with protanopia, deuteranopia
// and tritanopia. Same order as PCOLORS, because p.color is an index stored in saves; d is c × .55, l is c + 30% white.
const PCOLORS_CB = [
  { k: 'blue',   c: '#0072b2', d: '#003f62', l: '#4d9cc9' },
  { k: 'red',    c: '#d55e00', d: '#753400', l: '#e28e4d' },
  { k: 'green',  c: '#009e73', d: '#00573f', l: '#4dbb9d' },
  { k: 'yellow', c: '#f0e442', d: '#847d24', l: '#f5ec7b' },
  { k: 'teal',   c: '#56b4e9', d: '#2f6380', l: '#89cbf0' },
  { k: 'purple', c: '#cc79a7', d: '#70435c', l: '#dba1c1' },
  { k: 'grey',   c: '#e0e0e0', d: '#7b7b7b', l: '#e9e9e9' },
  { k: 'orange', c: '#e69f00', d: '#7f5700', l: '#eebc4d' },
];

// Unit upgrade lines. A building trains a line; the player's current member of the line is produced.
const LINES = {
  militia: ['militia', 'manAtArms', 'longSwordsman', 'champion'],
  spear: ['spearman', 'pikeman', 'halberdier'],
  archer: ['archer', 'crossbowman', 'arbalester'],
  skirm: ['skirmisher', 'eliteSkirmisher'],
  cavArcher: ['cavArcher', 'heavyCavArcher'],
  scout: ['scout', 'lightCav'],
  knight: ['knight', 'cavalier', 'paladin'],
  ram: ['ram', 'cappedRam'],
  mangonel: ['mangonel', 'onager'],
  galley: ['galley', 'warGalley', 'galleon'],
};

// ------------------------------------------------------------
// UNITS  (stats loosely follow Age of Empires II conventions)
// a:[melee armor, pierce armor]; at: 'm' melee / 'p' pierce; rof: reload seconds
// spd: tiles/sec; los/rng in tiles; acc: base accuracy of projectiles
// ------------------------------------------------------------
const U = {
  villager: { cls: ['villager'], hp: 25, atk: 3, at: 'm', a: [0, 0], rof: 2, spd: .8, los: 4, cost: { food: 50 }, time: 25, from: 'tc', age: 0, r: .2, carry: 10, bonus: { animal: 2 }, weak: ['cavalry', 'archer'], art: 'villager' },

  militia: { cls: ['infantry'], hp: 40, atk: 4, at: 'm', a: [0, 1], rof: 2, spd: .9, los: 4, cost: { food: 60, gold: 20 }, time: 21, from: 'barracks', age: 0, r: .22, line: 'militia', weak: ['archer', 'cavalry'], art: 'militia' },
  manAtArms: { hp: 45, atk: 6, age: 1, art: 'manAtArms' },
  longSwordsman: { hp: 60, atk: 9, age: 2, los: 5, art: 'longSwordsman' },
  champion: { hp: 70, atk: 13, a: [1, 1], age: 3, los: 5, art: 'champion' },

  spearman: { cls: ['infantry', 'spear'], hp: 45, atk: 3, at: 'm', a: [0, 0], bonus: { cavalry: 15 }, rof: 3, spd: 1, los: 4, cost: { food: 35, wood: 25 }, time: 22, from: 'barracks', age: 1, r: .22, line: 'spear', weak: ['archer', 'infantry'], art: 'spearman' },
  pikeman: { hp: 55, atk: 4, bonus: { cavalry: 22 }, age: 2, art: 'pikeman' },
  halberdier: { hp: 60, atk: 6, bonus: { cavalry: 32 }, age: 3, art: 'halberdier' },

  archer: { cls: ['archer'], hp: 30, atk: 4, at: 'p', a: [0, 0], rng: 4, rof: 2, spd: .96, los: 6, cost: { wood: 25, gold: 45 }, time: 35, from: 'archery', age: 1, r: .2, acc: .8, proj: 'arrow', bonus: { spear: 3 }, line: 'archer', weak: ['skirm', 'cavalry', 'siege'], art: 'archer' },
  crossbowman: { hp: 35, atk: 5, rng: 5, acc: .85, age: 2, los: 7, proj: 'bolt', art: 'crossbowman' },
  arbalester: { hp: 40, atk: 6, rng: 5, acc: .9, age: 3, los: 7, proj: 'bolt', art: 'arbalester' },

  skirmisher: { cls: ['archer', 'skirm'], hp: 30, atk: 2, at: 'p', a: [0, 3], rng: 4, rof: 3, spd: .96, los: 6, cost: { food: 25, wood: 35 }, time: 22, from: 'archery', age: 1, r: .2, acc: .9, proj: 'arrow', bonus: { archer: 3, spear: 1 }, line: 'skirm', weak: ['infantry', 'cavalry'], art: 'skirmisher' },
  eliteSkirmisher: { hp: 35, atk: 3, a: [0, 4], rng: 5, bonus: { archer: 4, spear: 2 }, age: 2, art: 'eliteSkirmisher' },

  cavArcher: { cls: ['cavalry', 'archer', 'cavArcher'], hp: 50, atk: 6, at: 'p', a: [0, 0], rng: 4, rof: 2, spd: 1.4, los: 5, cost: { wood: 40, gold: 70 }, time: 34, from: 'archery', age: 2, r: .3, acc: .65, proj: 'arrow', line: 'cavArcher', weak: ['skirm', 'spear'], art: 'cavArcher' },
  heavyCavArcher: { hp: 60, atk: 7, a: [1, 0], acc: .72, age: 3, art: 'heavyCavArcher' },

  handCannoneer: { cls: ['infantry', 'gunpowder'], hp: 35, atk: 17, at: 'p', a: [1, 0], rng: 7, rof: 3.45, spd: .96, los: 9, cost: { food: 45, gold: 50 }, time: 34, from: 'archery', age: 3, req: 'chemistry', r: .2, acc: .75, proj: 'ball', bonus: { infantry: 10 }, weak: ['skirm', 'cavalry', 'siege'], art: 'handCannoneer' },

  scout: { cls: ['cavalry'], hp: 45, atk: 3, at: 'm', a: [0, 2], rof: 2, spd: 1.55, los: 6, cost: { food: 80 }, time: 30, from: 'stable', age: 1, r: .3, line: 'scout', bonus: { monk: 6 }, weak: ['spear', 'infantry'], art: 'scout' },
  lightCav: { hp: 60, atk: 7, a: [0, 2], spd: 1.5, los: 8, bonus: { monk: 10 }, age: 2, art: 'lightCav' },

  knight: { cls: ['cavalry'], hp: 100, atk: 10, at: 'm', a: [2, 2], rof: 1.8, spd: 1.35, los: 4, cost: { food: 60, gold: 75 }, time: 30, from: 'stable', age: 2, r: .32, line: 'knight', weak: ['spear', 'monk'], art: 'knight' },
  cavalier: { hp: 120, atk: 12, age: 3, art: 'cavalier' },
  paladin: { hp: 160, atk: 14, a: [2, 3], age: 3, art: 'paladin' },

  ram: { cls: ['siege', 'ram'], hp: 175, atk: 2, at: 'm', a: [0, 180], rof: 4, spd: .5, los: 3, cost: { wood: 160, gold: 75 }, time: 36, from: 'siege', age: 2, r: .45, bonus: { building: 125, siege: 10 }, onlyBld: true, line: 'ram', weak: ['infantry', 'cavalry'], art: 'ram', noConvert: true },
  cappedRam: { hp: 200, atk: 3, a: [0, 190], bonus: { building: 150, siege: 15 }, age: 3, art: 'cappedRam' },

  mangonel: { cls: ['siege'], hp: 50, atk: 40, at: 'm', a: [0, 6], rng: 7, minRng: 3, rof: 6, spd: .6, los: 9, cost: { wood: 160, gold: 135 }, time: 46, from: 'siege', age: 2, r: .42, area: .55, proj: 'stone', acc: 1, ff: true, ground: true, bonus: { building: 35 }, line: 'mangonel', weak: ['cavalry', 'ram'], art: 'mangonel' },
  onager: { hp: 60, atk: 50, rng: 8, area: .8, age: 3, art: 'onager' },

  trebuchet: { cls: ['siege', 'treb'], hp: 150, atk: 200, at: 'm', a: [2, 150], rng: 16, minRng: 4, rof: 10, spd: .8, los: 19, cost: { wood: 200, gold: 200 }, time: 50, from: 'castle', age: 2, r: .5, proj: 'boulder', acc: .85, accUnit: .2, setup: 3, ground: true, bonus: { building: 250 }, weak: ['cavalry', 'infantry'], art: 'trebuchet' },
  bombard: { cls: ['siege', 'gunpowder'], hp: 80, atk: 40, at: 'm', a: [2, 5], rng: 12, rof: 6.5, spd: .7, los: 14, cost: { wood: 225, gold: 225 }, time: 56, from: 'siege', age: 3, req: 'chemistry', r: .42, proj: 'ball', acc: .92, area: .2, bonus: { building: 200, ship: 40, siege: 20 }, weak: ['cavalry'], art: 'bombard' },

  monk: { cls: ['monk'], hp: 30, atk: 0, at: 'm', a: [0, 0], rng: 9, spd: .7, los: 11, cost: { gold: 100 }, time: 51, from: 'monastery', age: 2, r: .2, conv: true, heal: 1, weak: ['cavalry', 'archer'], art: 'monk' },

  fishingShip: { cls: ['ship', 'fishing'], hp: 60, atk: 0, at: 'm', a: [0, 4], spd: 1.26, los: 5, cost: { wood: 75 }, time: 40, from: 'dock', age: 0, r: .42, dom: 'w', carry: 15, weak: ['ship'], art: 'fishingShip' },
  galley: { cls: ['ship', 'warship'], hp: 120, atk: 6, at: 'p', a: [0, 6], rng: 5, rof: 3, spd: 1.43, los: 7, cost: { wood: 90, gold: 30 }, time: 60, from: 'dock', age: 1, r: .48, dom: 'w', proj: 'arrow', acc: .9, bonus: { ship: 2 }, line: 'galley', weak: ['siege'], art: 'galley' },
  warGalley: { hp: 135, atk: 7, rng: 6, age: 2, art: 'warGalley' },
  galleon: { hp: 165, atk: 8, rng: 7, age: 3, art: 'galleon' },

  // ---- unique units (trained at the Castle) ----
  bhayangkara: { cls: ['infantry', 'unique'], hp: 70, atk: 8, at: 'm', a: [2, 2], rof: 2, spd: 1, los: 5, cost: { food: 60, gold: 40 }, time: 15, from: 'castle', age: 2, r: .22, bonus: { cavalry: 8 }, weak: ['archer', 'siege'], elite: { hp: 15, atk: 2, armP: 1 }, art: 'bhayangkara' },
  longbowman: { cls: ['archer', 'unique'], hp: 35, atk: 6, at: 'p', a: [0, 0], rng: 5, rof: 2, spd: .96, los: 7, cost: { wood: 35, gold: 40 }, time: 19, from: 'castle', age: 2, r: .2, acc: .85, proj: 'arrow', weak: ['skirm', 'cavalry'], elite: { hp: 5, atk: 1, rng: 1, acc: .05 }, art: 'longbowman' },
  throwingAxeman: { cls: ['infantry', 'unique'], hp: 60, atk: 7, at: 'm', a: [0, 0], rng: 3, rof: 2, spd: 1, los: 5, cost: { food: 55, gold: 25 }, time: 17, from: 'castle', age: 2, r: .22, acc: 1, proj: 'axe', weak: ['archer', 'cavalry'], elite: { hp: 10, atk: 1, rng: 1 }, art: 'throwingAxeman' },
  mangudai: { cls: ['cavalry', 'archer', 'cavArcher', 'unique'], hp: 60, atk: 6, at: 'p', a: [0, 0], rng: 4, rof: 2.1, spd: 1.45, los: 6, cost: { wood: 55, gold: 65 }, time: 26, from: 'castle', age: 2, r: .3, acc: .95, proj: 'arrow', bonus: { siege: 3 }, weak: ['skirm', 'spear'], elite: { hp: 15, atk: 2, rng: 1 }, art: 'mangudai' },
  samurai: { cls: ['infantry', 'unique'], hp: 60, atk: 8, at: 'm', a: [1, 1], rof: 1.45, spd: 1, los: 4, cost: { food: 60, gold: 30 }, time: 9, from: 'castle', age: 2, r: .22, bonus: { unique: 10 }, weak: ['archer', 'cavalry'], elite: { hp: 20, atk: 4 }, art: 'samurai' },
  janissary: { cls: ['infantry', 'gunpowder', 'unique'], hp: 35, atk: 17, at: 'p', a: [1, 0], rng: 8, rof: 3.45, spd: .96, los: 10, cost: { food: 60, gold: 55 }, time: 17, from: 'castle', age: 2, r: .2, acc: .5, proj: 'ball', weak: ['skirm', 'cavalry'], elite: { hp: 5, atk: 5, acc: .15 }, art: 'janissary' },
  cataphract: { cls: ['cavalry', 'unique'], hp: 110, atk: 9, at: 'm', a: [2, 1], rof: 1.8, spd: 1.2, los: 4, cost: { food: 70, gold: 75 }, time: 20, from: 'castle', age: 2, r: .32, bonus: { infantry: 9 }, weak: ['archer', 'monk'], elite: { hp: 40, atk: 3 }, art: 'cataphract' },
  chuKoNu: { cls: ['archer', 'unique'], hp: 45, atk: 8, at: 'p', a: [0, 0], rng: 4, rof: 3, spd: .96, los: 6, cost: { wood: 40, gold: 35 }, time: 16, from: 'castle', age: 2, r: .2, acc: .85, proj: 'bolt', shots: 3, weak: ['skirm', 'siege'], elite: { hp: 5, shots: 2 }, art: 'chuKoNu' },

  // ---- wildlife ----
  deer: { cls: ['animal'], hp: 5, atk: 0, at: 'm', a: [0, 0], spd: 1.1, los: 4, r: .22, food: 140, animal: 'flee', art: 'deer' },
  boar: { cls: ['animal'], hp: 75, atk: 8, at: 'm', a: [0, 1], rof: 2, spd: .7, los: 4, r: .26, food: 340, animal: 'boar', art: 'boar' },
  wolf: { cls: ['animal'], hp: 25, atk: 3, at: 'm', a: [0, 0], rof: 1.5, spd: 1.15, los: 5, r: .22, food: 0, animal: 'wolf', art: 'wolf' },
  sheep: { cls: ['animal', 'herd'], hp: 7, atk: 0, at: 'm', a: [0, 0], spd: .7, los: 2, r: .2, food: 100, animal: 'herd', art: 'sheep' },
};

// ------------------------------------------------------------
// BUILDINGS
// ------------------------------------------------------------
const B = {
  tc: { w: 4, h: 4, hp: 2400, a: [3, 5], cost: { wood: 275, stone: 100 }, time: 150, age: 2, pop: 5, los: 8, cat: 'eco', drop: ['food', 'wood', 'gold', 'stone'], trains: ['villager'], techs: ['feudal', 'castle', 'imperial', 'loom', 'wheelbarrow', 'handcart', 'townWatch', 'townPatrol'], attack: { atk: 5, at: 'p', rng: 6, rof: 2, arrows: 1, minRng: 0 }, garrison: 15, gcls: ['villager', 'infantry', 'archer', 'monk'], cls: ['building', 'tc'] },
  house: { w: 2, h: 2, hp: 550, a: [0, 7], cost: { wood: 25 }, time: 25, age: 0, pop: 5, los: 2, cat: 'eco', cls: ['building', 'house'] },
  mill: { w: 2, h: 2, hp: 1000, a: [0, 7], cost: { wood: 100 }, time: 35, age: 0, los: 6, cat: 'eco', drop: ['food'], techs: ['horseCollar', 'heavyPlow', 'cropRotation'], qual: true, cls: ['building'] },
  lumber: { w: 2, h: 2, hp: 1000, a: [0, 7], cost: { wood: 100 }, time: 35, age: 0, los: 6, cat: 'eco', drop: ['wood'], techs: ['doubleBit', 'bowSaw', 'twoManSaw'], qual: true, cls: ['building'] },
  mining: { w: 2, h: 2, hp: 1000, a: [0, 7], cost: { wood: 100 }, time: 35, age: 0, los: 6, cat: 'eco', drop: ['gold', 'stone'], techs: ['goldMining', 'stoneMining', 'goldShaft', 'stoneShaft'], qual: true, cls: ['building'] },
  farm: { w: 3, h: 3, hp: 480, a: [0, 0], cost: { wood: 60 }, time: 15, age: 0, req: 'mill', los: 1, cat: 'eco', pass: true, food: 175, cls: ['building', 'farm'] },
  dock: { w: 3, h: 3, hp: 1800, a: [0, 7], cost: { wood: 150 }, time: 35, age: 0, los: 6, cat: 'eco', water: true, drop: ['food'], trains: ['fishingShip', 'galley'], techs: ['gillnets', 'warGalley', 'galleon'], qual: true, cls: ['building'] },
  market: { w: 3, h: 3, hp: 2100, a: [0, 7], cost: { wood: 175 }, time: 60, age: 1, req: 'mill', los: 6, cat: 'eco', techs: ['coinage', 'guilds'], qual: true, market: true, cls: ['building'] },
  university: { w: 3, h: 3, hp: 2100, a: [0, 8], cost: { wood: 200 }, time: 60, age: 2, req: 'blacksmith', los: 6, cat: 'eco', techs: ['masonry', 'ballistics', 'murderHoles', 'treadmill', 'chemistry', 'architecture'], qual: true, cls: ['building'] },
  wonder: { w: 5, h: 5, hp: 4800, a: [1, 10], cost: { food: 1000, wood: 1000, gold: 1000, stone: 1000 }, time: 1200, age: 3, los: 8, cat: 'eco', cls: ['building', 'wonder'] },

  barracks: { w: 3, h: 3, hp: 1200, a: [0, 7], cost: { wood: 175 }, time: 50, age: 0, los: 6, cat: 'mil', trains: ['militia', 'spear'], techs: ['manAtArms', 'longSwordsman', 'champion', 'pikeman', 'halberdier', 'squires'], qual: true, cls: ['building'] },
  archery: { w: 3, h: 3, hp: 1200, a: [0, 7], cost: { wood: 175 }, time: 50, age: 1, req: 'barracks', los: 6, cat: 'mil', trains: ['archer', 'skirm', 'cavArcher', 'handCannoneer'], techs: ['crossbowman', 'arbalester', 'eliteSkirmisher', 'heavyCavArcher', 'thumbRing'], qual: true, cls: ['building'] },
  stable: { w: 3, h: 3, hp: 1200, a: [0, 7], cost: { wood: 175 }, time: 50, age: 1, req: 'barracks', los: 6, cat: 'mil', trains: ['scout', 'knight'], techs: ['bloodlines', 'husbandry', 'lightCav', 'cavalier', 'paladin'], qual: true, cls: ['building'] },
  blacksmith: { w: 3, h: 3, hp: 1200, a: [0, 7], cost: { wood: 150 }, time: 40, age: 1, los: 6, cat: 'mil', techs: ['forging', 'ironCasting', 'blastFurnace', 'scaleMail', 'chainMail', 'plateMail', 'scaleBarding', 'chainBarding', 'plateBarding', 'fletching', 'bodkin', 'bracer', 'paddedArcher', 'leatherArcher', 'ringArcher'], qual: true, cls: ['building'] },
  siege: { w: 3, h: 3, hp: 1500, a: [0, 8], cost: { wood: 200 }, time: 40, age: 2, req: 'blacksmith', los: 6, cat: 'mil', trains: ['ram', 'mangonel', 'bombard'], techs: ['cappedRam', 'onager'], qual: true, cls: ['building'] },
  monastery: { w: 3, h: 3, hp: 2100, a: [0, 8], cost: { wood: 175 }, time: 40, age: 2, los: 6, cat: 'mil', trains: ['monk'], techs: ['fervor', 'sanctity', 'illumination', 'faith'], qual: true, relics: true, cls: ['building', 'monastery'] },
  castle: { w: 4, h: 4, hp: 4800, a: [8, 11], cost: { stone: 650 }, time: 200, age: 2, pop: 20, los: 11, cat: 'mil', trains: ['uu', 'trebuchet'], techs: ['eliteUU', 'hoardings', 'conscription'], attack: { atk: 11, at: 'p', rng: 8, rof: 2, arrows: 4, minRng: 1 }, garrison: 20, gcls: ['villager', 'infantry', 'archer', 'cavalry', 'monk'], qual: true, qual2: true, cls: ['building', 'castle'] },
  tower: { w: 1, h: 1, hp: 1020, a: [1, 7], cost: { wood: 25, stone: 125 }, time: 80, age: 1, los: 10, cat: 'mil', techs: ['guardTower', 'keep'], attack: { atk: 5, at: 'p', rng: 8, rof: 2, arrows: 1, minRng: 1 }, garrison: 5, gcls: ['villager', 'infantry', 'archer'], cls: ['building', 'tower'] },
  palisade: { w: 1, h: 1, hp: 250, a: [2, 5], cost: { wood: 2 }, time: 6, age: 0, los: 2, cat: 'mil', wall: true, cls: ['building', 'wall'] },
  wall: { w: 1, h: 1, hp: 1800, a: [8, 10], cost: { stone: 5 }, time: 10, age: 1, los: 2, cat: 'mil', wall: true, cls: ['building', 'wall'] },
  gate: { w: 1, h: 1, hp: 2750, a: [6, 6], cost: { stone: 30 }, time: 30, age: 1, los: 3, cat: 'mil', gate: true, cls: ['building', 'wall', 'gate'] },
};

// ------------------------------------------------------------
// TECHNOLOGIES
// fx effect types: stat, gather, carry, line, cost, time, build, farm, pop, flag, age, elite, commission, tribute, convRes
// ------------------------------------------------------------
const T = {
  // --- ages ---
  feudal:   { at: 'tc', age: 0, cost: { food: 500 }, time: 130, icon: 'age1', fx: [{ t: 'age', n: 1 }], ageUp: 1 },
  castle:   { at: 'tc', age: 1, cost: { food: 800, gold: 200 }, time: 160, icon: 'age2', fx: [{ t: 'age', n: 2 }], ageUp: 2 },
  imperial: { at: 'tc', age: 2, cost: { food: 1000, gold: 800 }, time: 190, icon: 'age3', fx: [{ t: 'age', n: 3 }], ageUp: 3 },
  // --- town center ---
  loom:        { at: 'tc', age: 0, cost: { gold: 50 }, time: 25, icon: 'loom', fx: [{ t: 'stat', who: 'villager', stat: 'hp', add: 15 }, { t: 'stat', who: 'villager', stat: 'armM', add: 1 }, { t: 'stat', who: 'villager', stat: 'armP', add: 2 }] },
  wheelbarrow: { at: 'tc', age: 1, cost: { food: 175, wood: 50 }, time: 75, icon: 'wheel', fx: [{ t: 'stat', who: 'villager', stat: 'spd', mul: 1.1 }, { t: 'carry', add: 3 }] },
  handcart:    { at: 'tc', age: 2, cost: { food: 300, wood: 200 }, time: 55, icon: 'cart', req: ['wheelbarrow'], fx: [{ t: 'stat', who: 'villager', stat: 'spd', mul: 1.1 }, { t: 'carry', add: 4 }] },
  townWatch:   { at: 'tc', age: 1, cost: { food: 75 }, time: 25, icon: 'eye', fx: [{ t: 'stat', who: 'building', stat: 'los', add: 4 }] },
  townPatrol:  { at: 'tc', age: 2, cost: { food: 300, gold: 100 }, time: 40, icon: 'eye2', req: ['townWatch'], fx: [{ t: 'stat', who: 'building', stat: 'los', add: 4 }] },
  // --- mill ---
  horseCollar:  { at: 'mill', age: 1, cost: { food: 75, wood: 75 }, time: 20, icon: 'plow', fx: [{ t: 'farm', add: 75 }] },
  heavyPlow:    { at: 'mill', age: 2, cost: { food: 125, wood: 125 }, time: 40, icon: 'plow2', req: ['horseCollar'], fx: [{ t: 'farm', add: 125 }, { t: 'gather', res: 'farm', mul: 1.1 }] },
  cropRotation: { at: 'mill', age: 3, cost: { food: 250, wood: 250 }, time: 70, icon: 'sickle', req: ['heavyPlow'], fx: [{ t: 'farm', add: 175 }] },
  // --- lumber camp ---
  doubleBit: { at: 'lumber', age: 1, cost: { food: 100, wood: 50 }, time: 25, icon: 'axe', fx: [{ t: 'gather', res: 'wood', mul: 1.2 }] },
  bowSaw:    { at: 'lumber', age: 2, cost: { food: 150, wood: 100 }, time: 50, icon: 'saw', req: ['doubleBit'], fx: [{ t: 'gather', res: 'wood', mul: 1.2 }] },
  twoManSaw: { at: 'lumber', age: 3, cost: { food: 300, wood: 200 }, time: 100, icon: 'saw2', req: ['bowSaw'], fx: [{ t: 'gather', res: 'wood', mul: 1.1 }] },
  // --- mining camp ---
  goldMining:  { at: 'mining', age: 1, cost: { food: 100, wood: 75 }, time: 30, icon: 'pick', fx: [{ t: 'gather', res: 'gold', mul: 1.15 }] },
  stoneMining: { at: 'mining', age: 1, cost: { food: 100, wood: 75 }, time: 30, icon: 'pickS', fx: [{ t: 'gather', res: 'stone', mul: 1.15 }] },
  goldShaft:   { at: 'mining', age: 2, cost: { food: 200, wood: 150 }, time: 75, icon: 'shaft', req: ['goldMining'], fx: [{ t: 'gather', res: 'gold', mul: 1.15 }] },
  stoneShaft:  { at: 'mining', age: 2, cost: { food: 200, wood: 150 }, time: 75, icon: 'shaftS', req: ['stoneMining'], fx: [{ t: 'gather', res: 'stone', mul: 1.15 }] },
  // --- dock ---
  gillnets:  { at: 'dock', age: 2, cost: { food: 150, wood: 200 }, time: 45, icon: 'net', fx: [{ t: 'gather', res: 'fish', mul: 1.25 }] },
  warGalley: { at: 'dock', age: 2, cost: { food: 230, gold: 100 }, time: 50, icon: 'up', fx: [{ t: 'line', line: 'galley', from: 'galley', to: 'warGalley' }] },
  galleon:   { at: 'dock', age: 3, cost: { food: 400, wood: 315 }, time: 65, icon: 'up', fx: [{ t: 'line', line: 'galley', from: 'warGalley', to: 'galleon' }] },
  // --- market ---
  coinage: { at: 'market', age: 2, cost: { food: 200, gold: 100 }, time: 50, icon: 'coin', fx: [{ t: 'tribute', set: .2 }] },
  guilds:  { at: 'market', age: 3, cost: { food: 300, gold: 200 }, time: 50, icon: 'scales', fx: [{ t: 'commission', set: .15 }] },
  // --- university ---
  masonry:      { at: 'university', age: 2, cost: { food: 175, stone: 150 }, time: 50, icon: 'brick', fx: [{ t: 'stat', who: 'building', stat: 'hp', mul: 1.1 }, { t: 'stat', who: 'building', stat: 'armM', add: 1 }, { t: 'stat', who: 'building', stat: 'armP', add: 1 }] },
  architecture: { at: 'university', age: 3, cost: { food: 300, stone: 200 }, time: 70, icon: 'brick2', req: ['masonry'], fx: [{ t: 'stat', who: 'building', stat: 'hp', mul: 1.1 }, { t: 'stat', who: 'building', stat: 'armM', add: 1 }, { t: 'stat', who: 'building', stat: 'armP', add: 1 }] },
  ballistics:   { at: 'university', age: 2, cost: { wood: 300, gold: 175 }, time: 60, icon: 'target', fx: [{ t: 'flag', k: 'ballistics' }] },
  murderHoles:  { at: 'university', age: 2, cost: { food: 200, stone: 100 }, time: 60, icon: 'holes', fx: [{ t: 'flag', k: 'murderHoles' }] },
  treadmill:    { at: 'university', age: 2, cost: { food: 300, wood: 200 }, time: 40, icon: 'crane', fx: [{ t: 'build', mul: 1.2 }] },
  chemistry:    { at: 'university', age: 3, cost: { food: 300, gold: 200 }, time: 100, icon: 'flask', fx: [{ t: 'stat', who: ['archer', 'tower', 'tc', 'castle', 'warship'], not: 'gunpowder', stat: 'atk', add: 1 }, { t: 'flag', k: 'chemistry' }] },
  // --- barracks ---
  manAtArms:     { at: 'barracks', age: 1, cost: { food: 100, gold: 40 }, time: 40, icon: 'up', fx: [{ t: 'line', line: 'militia', from: 'militia', to: 'manAtArms' }] },
  longSwordsman: { at: 'barracks', age: 2, cost: { food: 200, gold: 65 }, time: 45, icon: 'up', fx: [{ t: 'line', line: 'militia', from: 'manAtArms', to: 'longSwordsman' }] },
  champion:      { at: 'barracks', age: 3, cost: { food: 750, gold: 350 }, time: 80, icon: 'up', fx: [{ t: 'line', line: 'militia', from: 'longSwordsman', to: 'champion' }] },
  pikeman:       { at: 'barracks', age: 2, cost: { food: 215, gold: 90 }, time: 45, icon: 'up', fx: [{ t: 'line', line: 'spear', from: 'spearman', to: 'pikeman' }] },
  halberdier:    { at: 'barracks', age: 3, cost: { food: 300, gold: 600 }, time: 50, icon: 'up', fx: [{ t: 'line', line: 'spear', from: 'pikeman', to: 'halberdier' }] },
  squires:       { at: 'barracks', age: 2, cost: { food: 200 }, time: 40, icon: 'boot', fx: [{ t: 'stat', who: 'infantry', stat: 'spd', mul: 1.1 }] },
  // --- archery range ---
  crossbowman:     { at: 'archery', age: 2, cost: { food: 125, gold: 75 }, time: 35, icon: 'up', fx: [{ t: 'line', line: 'archer', from: 'archer', to: 'crossbowman' }] },
  arbalester:      { at: 'archery', age: 3, cost: { food: 350, gold: 300 }, time: 50, icon: 'up', fx: [{ t: 'line', line: 'archer', from: 'crossbowman', to: 'arbalester' }] },
  eliteSkirmisher: { at: 'archery', age: 2, cost: { wood: 230, gold: 130 }, time: 50, icon: 'up', fx: [{ t: 'line', line: 'skirm', from: 'skirmisher', to: 'eliteSkirmisher' }] },
  heavyCavArcher:  { at: 'archery', age: 3, cost: { food: 900, gold: 500 }, time: 50, icon: 'up', fx: [{ t: 'line', line: 'cavArcher', from: 'cavArcher', to: 'heavyCavArcher' }] },
  thumbRing:       { at: 'archery', age: 2, cost: { food: 300, wood: 250 }, time: 45, icon: 'ring', fx: [{ t: 'stat', who: 'archer', stat: 'rof', mul: .85 }, { t: 'stat', who: 'archer', stat: 'acc', add: .15 }] },
  // --- stable ---
  bloodlines: { at: 'stable', age: 1, cost: { food: 150, gold: 100 }, time: 50, icon: 'horse', fx: [{ t: 'stat', who: 'cavalry', stat: 'hp', add: 20 }] },
  husbandry:  { at: 'stable', age: 2, cost: { food: 150 }, time: 40, icon: 'horse2', fx: [{ t: 'stat', who: 'cavalry', stat: 'spd', mul: 1.1 }] },
  lightCav:   { at: 'stable', age: 2, cost: { food: 150, gold: 50 }, time: 45, icon: 'up', fx: [{ t: 'line', line: 'scout', from: 'scout', to: 'lightCav' }] },
  cavalier:   { at: 'stable', age: 3, cost: { food: 300, gold: 300 }, time: 100, icon: 'up', fx: [{ t: 'line', line: 'knight', from: 'knight', to: 'cavalier' }] },
  paladin:    { at: 'stable', age: 3, cost: { food: 1300, gold: 750 }, time: 170, icon: 'up', fx: [{ t: 'line', line: 'knight', from: 'cavalier', to: 'paladin' }] },
  // --- blacksmith ---
  forging:      { at: 'blacksmith', age: 1, cost: { food: 150 }, time: 50, icon: 'sword', fx: [{ t: 'stat', who: ['infantry', 'cavalry'], not: 'archer', stat: 'atk', add: 1 }] },
  ironCasting:  { at: 'blacksmith', age: 2, cost: { food: 220, gold: 120 }, time: 75, icon: 'sword2', req: ['forging'], fx: [{ t: 'stat', who: ['infantry', 'cavalry'], not: 'archer', stat: 'atk', add: 1 }] },
  blastFurnace: { at: 'blacksmith', age: 3, cost: { food: 275, gold: 225 }, time: 100, icon: 'sword3', req: ['ironCasting'], fx: [{ t: 'stat', who: ['infantry', 'cavalry'], not: 'archer', stat: 'atk', add: 2 }] },
  scaleMail:    { at: 'blacksmith', age: 1, cost: { food: 100 }, time: 40, icon: 'mail', fx: [{ t: 'stat', who: 'infantry', stat: 'armM', add: 1 }, { t: 'stat', who: 'infantry', stat: 'armP', add: 1 }] },
  chainMail:    { at: 'blacksmith', age: 2, cost: { food: 200, gold: 100 }, time: 55, icon: 'mail2', req: ['scaleMail'], fx: [{ t: 'stat', who: 'infantry', stat: 'armM', add: 1 }, { t: 'stat', who: 'infantry', stat: 'armP', add: 1 }] },
  plateMail:    { at: 'blacksmith', age: 3, cost: { food: 300, gold: 150 }, time: 70, icon: 'mail3', req: ['chainMail'], fx: [{ t: 'stat', who: 'infantry', stat: 'armM', add: 1 }, { t: 'stat', who: 'infantry', stat: 'armP', add: 2 }] },
  scaleBarding: { at: 'blacksmith', age: 1, cost: { food: 150 }, time: 45, icon: 'bard', fx: [{ t: 'stat', who: 'cavalry', stat: 'armM', add: 1 }, { t: 'stat', who: 'cavalry', stat: 'armP', add: 1 }] },
  chainBarding: { at: 'blacksmith', age: 2, cost: { food: 250, gold: 150 }, time: 60, icon: 'bard2', req: ['scaleBarding'], fx: [{ t: 'stat', who: 'cavalry', stat: 'armM', add: 1 }, { t: 'stat', who: 'cavalry', stat: 'armP', add: 1 }] },
  plateBarding: { at: 'blacksmith', age: 3, cost: { food: 350, gold: 200 }, time: 75, icon: 'bard3', req: ['chainBarding'], fx: [{ t: 'stat', who: 'cavalry', stat: 'armM', add: 1 }, { t: 'stat', who: 'cavalry', stat: 'armP', add: 2 }] },
  fletching:    { at: 'blacksmith', age: 1, cost: { food: 100, gold: 50 }, time: 30, icon: 'arrow', fx: [{ t: 'stat', who: ['archer', 'tower', 'tc', 'castle', 'warship'], not: 'gunpowder', stat: 'atk', add: 1 }, { t: 'stat', who: ['archer', 'tower', 'tc', 'castle', 'warship'], not: 'gunpowder', stat: 'rng', add: 1 }] },
  bodkin:       { at: 'blacksmith', age: 2, cost: { food: 200, gold: 100 }, time: 35, icon: 'arrow2', req: ['fletching'], fx: [{ t: 'stat', who: ['archer', 'tower', 'tc', 'castle', 'warship'], not: 'gunpowder', stat: 'atk', add: 1 }, { t: 'stat', who: ['archer', 'tower', 'tc', 'castle', 'warship'], not: 'gunpowder', stat: 'rng', add: 1 }] },
  bracer:       { at: 'blacksmith', age: 3, cost: { food: 300, gold: 200 }, time: 40, icon: 'arrow3', req: ['bodkin'], fx: [{ t: 'stat', who: ['archer', 'tower', 'tc', 'castle', 'warship'], not: 'gunpowder', stat: 'atk', add: 1 }, { t: 'stat', who: ['archer', 'tower', 'tc', 'castle', 'warship'], not: 'gunpowder', stat: 'rng', add: 1 }] },
  paddedArcher: { at: 'blacksmith', age: 1, cost: { food: 100 }, time: 40, icon: 'pad', fx: [{ t: 'stat', who: 'archer', stat: 'armM', add: 1 }, { t: 'stat', who: 'archer', stat: 'armP', add: 1 }] },
  leatherArcher:{ at: 'blacksmith', age: 2, cost: { food: 150, gold: 150 }, time: 55, icon: 'pad2', req: ['paddedArcher'], fx: [{ t: 'stat', who: 'archer', stat: 'armM', add: 1 }, { t: 'stat', who: 'archer', stat: 'armP', add: 1 }] },
  ringArcher:   { at: 'blacksmith', age: 3, cost: { food: 250, gold: 250 }, time: 70, icon: 'pad3', req: ['leatherArcher'], fx: [{ t: 'stat', who: 'archer', stat: 'armM', add: 1 }, { t: 'stat', who: 'archer', stat: 'armP', add: 2 }] },
  // --- siege workshop ---
  cappedRam: { at: 'siege', age: 3, cost: { food: 300 }, time: 50, icon: 'up', fx: [{ t: 'line', line: 'ram', from: 'ram', to: 'cappedRam' }] },
  onager:    { at: 'siege', age: 3, cost: { food: 800, gold: 500 }, time: 75, icon: 'up', fx: [{ t: 'line', line: 'mangonel', from: 'mangonel', to: 'onager' }] },
  // --- monastery ---
  fervor:       { at: 'monastery', age: 2, cost: { gold: 140 }, time: 50, icon: 'sandal', fx: [{ t: 'stat', who: 'monk', stat: 'spd', mul: 1.15 }] },
  sanctity:     { at: 'monastery', age: 2, cost: { gold: 120 }, time: 60, icon: 'halo', fx: [{ t: 'stat', who: 'monk', stat: 'hp', add: 15 }] },
  illumination: { at: 'monastery', age: 3, cost: { gold: 120 }, time: 65, icon: 'lamp', fx: [{ t: 'stat', who: 'monk', stat: 'recharge', mul: .5 }] },
  faith:        { at: 'monastery', age: 3, cost: { food: 750, gold: 1000 }, time: 60, icon: 'book', fx: [{ t: 'convRes', mul: 1.5 }] },
  // --- castle ---
  eliteUU:      { at: 'castle', age: 3, cost: { food: 800, gold: 600 }, time: 60, icon: 'crown', fx: [{ t: 'elite' }] },
  hoardings:    { at: 'castle', age: 3, cost: { food: 400, wood: 400 }, time: 75, icon: 'castle', fx: [{ t: 'stat', who: 'castle', stat: 'hp', mul: 1.21 }] },
  conscription: { at: 'castle', age: 3, cost: { food: 150, gold: 150 }, time: 60, icon: 'drum', fx: [{ t: 'time', who: ['infantry', 'cavalry', 'archer'], mul: .75 }] },
  // --- tower ---
  guardTower: { at: 'tower', age: 2, cost: { food: 100, stone: 250 }, time: 30, icon: 'tower', fx: [{ t: 'stat', who: 'tower', stat: 'hp', add: 480 }, { t: 'stat', who: 'tower', stat: 'atk', add: 1 }, { t: 'stat', who: 'tower', stat: 'armP', add: 1 }] },
  keep:       { at: 'tower', age: 3, cost: { food: 500, wood: 350 }, time: 75, icon: 'tower2', req: ['guardTower'], fx: [{ t: 'stat', who: 'tower', stat: 'hp', add: 750 }, { t: 'stat', who: 'tower', stat: 'atk', add: 1 }, { t: 'stat', who: 'tower', stat: 'armP', add: 1 }] },
};

// ------------------------------------------------------------
// CIVILIZATIONS
// arch: architecture set; music: scale used by the generative score
// ------------------------------------------------------------
const CIVS = {
  majapahit:  { uu: 'bhayangkara', arch: 'nusa', music: 'pelog', fx: [{ t: 'gather', res: 'fish', mul: 1.2 }, { t: 'gather', res: 'farm', mul: 1.15 }, { t: 'commission', set: .15 }, { t: 'cost', who: 'dock', mul: .75 }] },
  britons:    { uu: 'longbowman', arch: 'west', music: 'dorian', fx: [{ t: 'stat', who: 'archer', not: 'cavalry', stat: 'rng', add: 1 }, { t: 'cost', who: 'tc', mul: .5, res: 'wood' }, { t: 'gather', res: 'hunt', mul: 1.25 }] },
  franks:     { uu: 'throwingAxeman', arch: 'west', music: 'mixolydian', fx: [{ t: 'cost', who: 'castle', mul: .75 }, { t: 'stat', who: 'cavalry', stat: 'hp', mul: 1.2 }, { t: 'gather', res: 'berry', mul: 1.25 }] },
  mongols:    { uu: 'mangudai', arch: 'east', music: 'pentatonic', fx: [{ t: 'stat', who: 'cavArcher', stat: 'rof', mul: .8 }, { t: 'stat', who: ['scout', 'lightCav'], stat: 'hp', mul: 1.3 }, { t: 'gather', res: 'hunt', mul: 1.4 }] },
  japanese:   { uu: 'samurai', arch: 'east', music: 'insen', fx: [{ t: 'stat', who: 'infantry', not: 'gunpowder', stat: 'rof', mul: .75 }, { t: 'cost', who: ['lumber', 'mining', 'mill'], mul: .5 }, { t: 'stat', who: 'fishing', stat: 'hp', mul: 2 }] },
  ottomans:   { uu: 'janissary', arch: 'mideast', music: 'hijaz', fx: [{ t: 'stat', who: 'gunpowder', stat: 'hp', mul: 1.25 }, { t: 'gather', res: 'gold', mul: 1.2 }, { t: 'time', who: 'gunpowder', mul: .75 }] },
  byzantines: { uu: 'cataphract', arch: 'mideast', music: 'phrygian', fx: [{ t: 'stat', who: 'building', stat: 'hp', mul: 1.1 }, { t: 'cost', who: ['skirm', 'spear'], mul: .75 }, { t: 'stat', who: 'monk', stat: 'heal', mul: 1.5 }] },
  chinese:    { uu: 'chuKoNu', arch: 'east', music: 'gong', fx: [{ t: 'startVil', add: 3 }, { t: 'start', res: 'food', add: -150 }, { t: 'techCost', mul: .9 }, { t: 'pop', who: 'tc', add: 5 }] },
};
const CIV_IDS = Object.keys(CIVS);

// Gather rates in resource units per game second (before technology)
const GATHER = { berry: .34, hunt: .45, farm: .35, fish: .49, wood: .43, gold: .41, stone: .39 };
// Map resource entity type -> gather subtype + stockpile resource
const RES_KIND = {
  tree: { g: 'wood', res: 'wood', amt: 100 },
  berry: { g: 'berry', res: 'food', amt: 125 },
  gold: { g: 'gold', res: 'gold', amt: 800 },
  stone: { g: 'stone', res: 'stone', amt: 350 },
  fish: { g: 'fish', res: 'food', amt: 225 },
  carcass: { g: 'hunt', res: 'food', amt: 0 },
  farm: { g: 'farm', res: 'food', amt: 0 },
};
const PROJ = {
  arrow: { spd: 7.5, arc: .16 },
  bolt: { spd: 8.5, arc: .1 },
  ball: { spd: 14, arc: .02 },
  stone: { spd: 5, arc: .32 },
  boulder: { spd: 4.2, arc: .42 },
  axe: { spd: 6, arc: .12 },
};

// ------------------------------------------------------------
// Data normalisation
// ------------------------------------------------------------
(function initData() {
  // expand line members: inherit from previous member
  for (const line in LINES) {
    const arr = LINES[line];
    for (let i = 1; i < arr.length; i++) {
      const prev = U[arr[i - 1]], cur = U[arr[i]];
      U[arr[i]] = Object.assign({}, prev, cur, { line });
      if (!cur.bonus && prev.bonus) U[arr[i]].bonus = Object.assign({}, prev.bonus);
    }
    U[arr[0]].line = line;
  }
  for (const k in U) {
    const u = U[k];
    u.id = k;
    u.armM = u.a[0]; u.armP = u.a[1];
    u.rng = u.rng || 0; u.minRng = u.minRng || 0;
    u.rof = u.rof || 2; u.acc = u.acc == null ? 1 : u.acc;
    u.bonus = u.bonus || {}; u.cost = u.cost || {};
    u.pop = u.cls.includes('animal') ? 0 : 1;
    u.dom = u.dom || 'l';
    u.r = u.r || .22;
    u.shots = u.shots || 1;
    u.art = u.art || k;
    u.isUnit = true;
  }
  for (const k in B) {
    const b = B[k];
    b.id = k;
    b.armM = b.a[0]; b.armP = b.a[1];
    b.trains = b.trains || []; b.techs = b.techs || [];
    b.pop = b.pop || 0; b.drop = b.drop || [];
    b.cls = b.cls || ['building'];
    b.isBld = true;
    if (b.attack) { b.atk = b.attack.atk; b.rng = b.attack.rng; b.rof = b.attack.rof; b.minRng = b.attack.minRng; b.at = 'p'; b.arrows = b.attack.arrows; }
    else { b.atk = 0; b.rng = 0; b.arrows = 0; }
    b.bonus = {}; b.acc = .85;
  }
  for (const k in T) { T[k].id = k; T[k].req = T[k].req || []; }
})();

function lineOf(type) { return U[type] && U[type].line; }
function defOf(type) { return U[type] || B[type]; }
