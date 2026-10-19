'use strict';
// ============================================================
//  UI: settings, menus, HUD, command card, input, modals
// ============================================================
const Settings = Object.assign({ lang: '', music: .4, sfx: .7, speed: 1.5, scroll: 1, edge: true, hpBars: 'damaged', lowFx: false, autoReseed: true }, store('eok.settings') || {});
function saveSettings() { store('eok.settings', Settings); }

const SVG = {
  food: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 18V7" stroke="#8a6a20" stroke-width="1.4"/><g fill="#e8bf4c" stroke="#8a6a20" stroke-width=".8"><ellipse cx="10" cy="4" rx="1.8" ry="3"/><ellipse cx="7" cy="8" rx="1.6" ry="2.8" transform="rotate(-30 7 8)"/><ellipse cx="13" cy="8" rx="1.6" ry="2.8" transform="rotate(30 13 8)"/><ellipse cx="7" cy="12" rx="1.6" ry="2.6" transform="rotate(-35 7 12)"/><ellipse cx="13" cy="12" rx="1.6" ry="2.6" transform="rotate(35 13 12)"/></g></svg>',
  wood: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="7" width="13" height="7" rx="1" fill="#8b5a2b" stroke="#4a2e14"/><ellipse cx="15" cy="10.5" rx="2.6" ry="3.5" fill="#d9a865" stroke="#4a2e14"/><ellipse cx="15" cy="10.5" rx="1" ry="1.4" fill="none" stroke="#8b5a2b"/></svg>',
  gold: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15l3-6 4 1 3-4 4 9z" fill="#f0c64a" stroke="#8a6a10"/><path d="M6 9l2 6M13 6l-1 9" stroke="#fff3b0" stroke-width=".8"/></svg>',
  stone: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 15l3-6 5-2 4 3 4 5z" fill="#a5a5a0" stroke="#55554f"/><path d="M8 15l2-5 4 1" fill="none" stroke="#6f6f69"/></svg>',
  pop: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6" r="3" fill="#e9dcc0"/><path d="M4 17c0-4 3-6 6-6s6 2 6 6z" fill="#e9dcc0"/></svg>',
  atk: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 3l-9 9 2 2 9-9V3z" fill="#d7dbe0" stroke="#555"/><path d="M5 11l4 4M3 17l3-3" stroke="#a87a2a" stroke-width="2"/></svg>',
  armM: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l7 3v5c0 4-3 6-7 8-4-2-7-4-7-8V5z" fill="#7b8db0" stroke="#2a3550"/></svg>',
  armP: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l7 3v5c0 4-3 6-7 8-4-2-7-4-7-8V5z" fill="#9a7b50" stroke="#3a2a14"/><path d="M5 15l10-10M13 5h2v2" stroke="#eee" stroke-width="1.2" fill="none"/></svg>',
  rng: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2c8 2 8 14 0 16" fill="none" stroke="#b07a3a" stroke-width="1.6"/><path d="M5 2v16M3 10h14M14 7l3 3-3 3" stroke="#ddd" fill="none"/></svg>',
  spd: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3h4v8l6 2v4H6z" fill="#a07a44" stroke="#4a3018"/></svg>',
  los: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 10c3-5 15-5 18 0-3 5-15 5-18 0z" fill="#e8e2d0"/><circle cx="10" cy="10" r="3" fill="#3a6aa0"/></svg>',
  time: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h10M5 18h10M6 2c0 5 8 5 8 8s-8 3-8 8M14 2c0 5-8 5-8 8s8 3 8 8" fill="none" stroke="#d9c79c" stroke-width="1.3"/></svg>',
  gar: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 17V8l8-6 8 6v9z" fill="#8a6a3a" stroke="#3a2a14"/><rect x="8" y="11" width="4" height="6" fill="#2a1a0c"/></svg>',
  idle: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="5" r="3" fill="#e9dcc0"/><path d="M4 18c0-5 2-8 5-8s5 3 5 8z" fill="#8b6a43"/><text x="14" y="8" font-size="8" fill="#e3b84a" font-weight="700">z</text></svg>',
  tree: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3" width="4" height="4" fill="#c39a5c"/><rect x="14" y="3" width="4" height="4" fill="#c39a5c"/><rect x="8" y="13" width="4" height="4" fill="#c39a5c"/><path d="M4 7v3h12V7M10 10v3" stroke="#c39a5c" fill="none"/></svg>',
  score: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17h14M5 17V9M10 17V4M15 17v-6" stroke="#c39a5c" stroke-width="2.2"/></svg>',
  menu: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="#e9dcc0" stroke-width="2"/></svg>',
  pause: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4v12M14 4v12" stroke="#e9dcc0" stroke-width="3"/></svg>',
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="#e9dcc0"/></svg>',
  relic: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="7" width="12" height="9" fill="#d4a640" stroke="#7a5a10"/><path d="M4 7l3-3h6l3 3" fill="#e8c060" stroke="#7a5a10"/></svg>',
  heal: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3h4v5h5v4h-5v5H8v-5H3V8h5z" fill="#79c46e"/></svg>',
};
const RES_SVG = r => SVG[r];
const GRID_KEYS = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G', 'Z', 'X', 'C', 'V', 'B'];
const ECO_BLD = ['house', 'mill', 'lumber', 'mining', 'farm', 'dock', 'market', 'university', 'tc', 'wonder'];
const MIL_BLD = ['barracks', 'archery', 'stable', 'blacksmith', 'siege', 'monastery', 'castle', 'tower', 'palisade', 'wall', 'gate'];
const LANGS = [['en', 'English'], ['id', 'Bahasa Indonesia'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'], ['ja', '日本語']];
const AI_NAMES = { majapahit: 'Gajah Mada', britons: 'Edward', franks: 'Charlemagne', mongols: 'Temüjin', japanese: 'Oda Nobunaga', ottomans: 'Mehmed', byzantines: 'Basil', chinese: 'Zhu Di' };
const $ = id => document.getElementById(id);
const nameOf = type => t(U[type] ? 'unit.' + type : 'bld.' + type);
const techName = id => t('tech.' + id);
const ageName = n => t('age.' + n);
const civName = c => t('civ.' + c);
const pname = pid => pid < 0 ? t('ui.gaia') : (G.players[pid].name || ('P' + (pid + 1)));
const pcol = pid => pid < 0 ? '#bbb' : PCOLORS[G.players[pid].color].c;

// ------------------------------------------------------------
// Effect descriptions (generated, translated)
// ------------------------------------------------------------
function whoName(w) {
  const arr = Array.isArray(w) ? w : [w];
  return arr.map(x => U[x] ? t('unit.' + x) : B[x] ? t('bld.' + x) : t('cls.' + x)).join(', ');
}
function describeFx(fx) {
  const pct = m => Math.round(Math.abs(m - 1) * 100);
  switch (fx.t) {
    case 'stat': {
      if (fx.stat === 'rof') return t('fx.rof', { who: whoName(fx.who), pct: Math.round((1 / fx.mul - 1) * 100) });
      if (fx.stat === 'recharge') return t('fx.recharge', { who: whoName(fx.who), pct: pct(fx.mul) });
      const st = t('stat.' + fx.stat);
      if (fx.add != null) { const n = fx.stat === 'acc' ? Math.round(fx.add * 100) + '%' : fx.add; return t('fx.statAdd', { who: whoName(fx.who), stat: st, n: (fx.add > 0 ? '+' : '') + n }); }
      return t('fx.statMul', { who: whoName(fx.who), stat: st, n: (fx.mul >= 1 ? '+' : '−') + pct(fx.mul) + '%' });
    }
    case 'gather': return t('fx.gather', { res: t('gres.' + fx.res), pct: pct(fx.mul) });
    case 'carry': return t('fx.carry', { n: fx.add });
    case 'line': return t('fx.line', { from: nameOf(fx.from), to: nameOf(fx.to) });
    case 'cost': return fx.res ? t('fx.costRes', { who: whoName(fx.who), pct: pct(fx.mul), res: t('res.' + fx.res) }) : t('fx.cost', { who: whoName(fx.who), pct: pct(fx.mul) });
    case 'time': return t('fx.time', { who: whoName(fx.who), pct: Math.round((1 / fx.mul - 1) * 100) });
    case 'build': return t('fx.build', { pct: pct(fx.mul) });
    case 'farm': return t('fx.farm', { n: fx.add });
    case 'pop': return t('fx.pop', { who: whoName(fx.who), n: fx.add });
    case 'start': return t('fx.start', { n: (fx.add > 0 ? '+' : '') + fx.add, res: t('res.' + fx.res) });
    case 'startVil': return t('fx.startVil', { n: fx.add });
    case 'techCost': return t('fx.techCost', { pct: pct(fx.mul) });
    case 'commission': return t('fx.commission', { pct: Math.round(fx.set * 100) });
    case 'tribute': return t('fx.tribute', { pct: Math.round(fx.set * 100) });
    case 'flag': return t('flag.' + fx.k);
    case 'age': return t('fx.age', { age: ageName(fx.n) });
    case 'elite': return t('fx.elite');
    case 'convRes': return t('fx.convRes', { pct: pct(fx.mul) });
  }
  return '';
}
function costHTML(cost, p) {
  return '<div class="cost">' + RES.filter(r => cost[r]).map(r => `<span class="${p && p.res[r] < cost[r] ? 'no' : ''}">${SVG[r]}<b class="num">${Math.round(cost[r])}</b></span>`).join('') + '</div>';
}

// ------------------------------------------------------------
// UI object
// ------------------------------------------------------------
const UI = {
  sel: [], groups: {}, page: 'main', mode: null, modeData: null, lastClick: { t: 0, id: 0 }, alertPos: null,
  hudT: 0, slots: [], hoverSlot: -1, ptrs: new Map(), paused: false, speed: 1.5, screen: 'loading', tutStep: 0, endShown: false,
  mouse: { x: 0, y: 0, in: false }, boxMode: false, lastSig: '', selSig: '', pendingEnd: 0, banner: 0,

  init() {
    if (!Settings.lang) { const nl = (navigator.language || 'en').slice(0, 2); Settings.lang = LANGS.some(l => l[0] === nl) ? nl : 'en'; }
    setLang(Settings.lang);
    this.speed = Settings.speed;
    const cv = $('view');
    R.init(cv);
    this.buildCmdGrid();
    this.bindInput(cv);
    this.bindMinimap($('minimap'));
    window.addEventListener('resize', () => R.resize());
    $('tooltip').style.display = 'none';
    $('objectives').addEventListener('click', e => {
      if (this.tutCollapsed || e.target.closest('[data-a="tut-toggle"]')) this.toggleTutorial();
    });
  },
  // ---------------- screens ----------------
  showMenu() {
    this.screen = 'menu';
    $('hud').hidden = true; $('modal').hidden = true; $('menu').hidden = false;
    const hasAuto = !!store('eok.save.auto');
    $('menu').innerHTML = `<div class="menu-col">
      <div class="brand"><div class="eyebrow">${t('ui.eyebrow')}</div><h1>Era of<br>Kingdoms</h1><p>${t('ui.tagline')}</p></div>
      <nav class="menu-list" aria-label="Main menu">
        ${hasAuto ? `<button class="menu-item" data-a="continue">${t('menu.continue')}<small>${t('pm.auto')}</small></button>` : ''}
        <button class="menu-item" data-a="skirmish">${t('menu.skirmish')}<small>${t('menu.skirmishSub')}</small></button>
        <button class="menu-item" data-a="tutorial">${t('menu.tutorial')}<small>${t('menu.tutorialSub')}</small></button>
        <button class="menu-item" data-a="load">${t('menu.load')}</button>
        <button class="menu-item" data-a="civs">${t('menu.civs')}</button>
        <button class="menu-item" data-a="howto">${t('menu.howto')}</button>
        <button class="menu-item" data-a="settings">${t('menu.settings')}</button>
      </nav>
      <div><div class="eyebrow" style="margin-bottom:8px">${t('set.language')}</div><div class="langs">${LANGS.map(([k, n]) => `<button class="chip ${Settings.lang === k ? 'on' : ''}" data-lang="${k}">${n}</button>`).join('')}</div></div>
      <div class="foot">${t('ui.foot')}<br>v${GAME_VERSION}</div>
    </div>`;
    $('menu').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      Audio2.ensure(); Audio2.sfx('click');
      if (b.dataset.lang) { setLang(b.dataset.lang); Settings.lang = b.dataset.lang; saveSettings(); this.showMenu(); return; }
      const a = b.dataset.a;
      if (a === 'skirmish') this.showSetup();
      else if (a === 'tutorial') startTutorial();
      else if (a === 'load') this.showLoad(false);
      else if (a === 'civs') this.showCivs();
      else if (a === 'howto') this.showHowTo();
      else if (a === 'settings') this.showSettings(false);
      else if (a === 'continue') loadGame('auto');
    };
  },
  modal(html, onClick, cls) {
    const m = $('modal');
    m.hidden = false;
    m.innerHTML = `<div class="sheet lacquer ${cls || ''}" role="dialog">${html}</div>`;
    m.onclick = e => {
      if (e.target === m) { this.closeModal(); return; }
      const b = e.target.closest('[data-a]');
      if (b && b.dataset.a === 'close') { Audio2.sfx('click'); this.closeModal(); return; }
      if (onClick) onClick(e, b);
    };
    m.onchange = e => onClick && onClick(e, e.target, true);
    m.oninput = e => onClick && onClick(e, e.target, true);
  },
  closeModal() {
    $('modal').hidden = true; $('modal').innerHTML = '';
    this.hideTip();
    if (this.onModalClose) { const f = this.onModalClose; this.onModalClose = null; f(); }
    this.renderPause();
  },
  head(title, sub) { return `<div class="sheet-head"><div>${sub ? `<div class="eyebrow">${sub}</div>` : ''}<h2>${title}</h2></div><button class="x" data-a="close" aria-label="${t('set.close')}">×</button></div>`; },
  // ---------------- skirmish setup ----------------
  setup: null,
  defaultSetup() {
    return {
      map: 'continental', size: 'small', seed: '', victory: 'standard', startRes: 'std', startAge: 0, reveal: 'normal', popCap: 200, treaty: 0, timeLimit: 40,
      players: [
        { human: true, civ: 'majapahit', color: 0, team: 0, name: t('setup.you') },
        { ai: 'normal', civ: 'random', color: 1, team: 0 },
      ],
    };
  },
  showSetup() {
    if (!this.setup) this.setup = store('eok.setup') || this.defaultSetup();
    const S = this.setup;
    const civOpts = (sel, rnd) => (rnd ? `<option value="random" ${sel === 'random' ? 'selected' : ''}>${t('setup.random')}</option>` : '') + CIV_IDS.map(c => `<option value="${c}" ${sel === c ? 'selected' : ''}>${civName(c)}</option>`).join('');
    const opt = (k, v, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${k}</option>`;
    const rows = S.players.map((p, i) => `<div class="prow">
        <button class="swatch" data-a="color" data-i="${i}" style="background:${PCOLORS[p.color].c}" aria-label="${t('setup.color')}"></button>
        <div class="ctrl">${p.human ? `<input type="text" data-k="name" data-i="${i}" value="${esc(p.name || t('setup.you'))}" maxlength="18" aria-label="${t('setup.player')}">` : `<select data-k="ai" data-i="${i}" aria-label="${t('setup.difficulty')}">${['easy', 'normal', 'hard', 'hardest'].map(d => opt(t('diff.' + d), d, p.ai)).join('')}</select>`}</div>
        <select data-k="civ" data-i="${i}" aria-label="${t('setup.civ')}">${civOpts(p.civ, true)}</select>
        <select class="team" data-k="team" data-i="${i}" aria-label="${t('setup.team')}">${[0, 1, 2, 3, 4].map(tm => opt(tm ? t('dip.team', { n: tm }) : t('setup.noTeam'), tm, p.team)).join('')}</select>
        <div class="muted small">${p.human ? t('setup.you') : t('setup.ai')}</div>
        ${p.human ? '<span></span>' : `<button class="x" data-a="rm" data-i="${i}" aria-label="${t('setup.remove')}">×</button>`}
      </div>`).join('');
    const human = S.players.find(p => p.human);
    const civ = human.civ === 'random' ? null : human.civ;
    const maxP = S.size === 'tiny' ? 2 : S.size === 'small' ? 4 : 8;
    this.modal(`${this.head(t('setup.title'), t('menu.skirmish'))}
      <div class="sheet-body"><div class="setup-grid">
        <div class="setup-sec">
          <div class="eyebrow">${t('setup.players')}</div>
          ${rows}
          <div><button class="btn small" data-a="add" ${S.players.length >= maxP ? 'disabled' : ''}>+ ${t('setup.addAI')}</button></div>
          <div class="eyebrow" style="margin-top:8px">${t('setup.options')}</div>
          <div class="opts">
            <label class="field">${t('setup.mapType')}<select data-k="map">${MAP_TYPES.map(m => opt(t('map.' + m), m, S.map)).join('')}</select></label>
            <label class="field">${t('setup.size')}<select data-k="size">${Object.keys(MAP_SIZES).map(m => opt(t('size.' + m), m, S.size)).join('')}</select></label>
            <label class="field">${t('setup.victory')}<select data-k="victory">${['standard', 'conquest', 'wonder', 'relics', 'time'].map(v => opt(t('vic.' + v), v, S.victory)).join('')}</select></label>
            <label class="field">${t('setup.resources')}<select data-k="startRes">${['std', 'med', 'high'].map(v => opt(t('sres.' + v), v, S.startRes)).join('')}</select></label>
            <label class="field">${t('setup.age')}<select data-k="startAge">${[0, 1, 2, 3].map(v => opt(ageName(v), v, S.startAge)).join('')}</select></label>
            <label class="field">${t('setup.reveal')}<select data-k="reveal">${['normal', 'explored', 'all'].map(v => opt(t('rev.' + v), v, S.reveal)).join('')}</select></label>
            <label class="field">${t('setup.pop')}<select data-k="popCap">${[75, 125, 200].map(v => opt(v, v, S.popCap)).join('')}</select></label>
            <label class="field">${t('setup.treaty')}<select data-k="treaty">${[0, 10, 20, 30].map(v => opt(v ? t('ui.min', { n: v }) : t('ui.none'), v, S.treaty)).join('')}</select></label>
            ${S.victory === 'time' ? `<label class="field">${t('setup.timeLimit')}<select data-k="timeLimit">${[20, 30, 40, 60, 90].map(v => opt(t('ui.min', { n: v }), v, S.timeLimit)).join('')}</select></label>` : ''}
            <label class="field">${t('setup.seed')}<input type="text" data-k="seed" value="${esc(S.seed)}" placeholder="${t('setup.random')}" maxlength="10"></label>
          </div>
        </div>
        <div class="setup-sec">
          <div class="eyebrow">${t('setup.civInfo')}</div>
          ${civ ? civCard(civ) : `<div class="civcard"><h3>${t('setup.random')}</h3><p class="muted">${t('setup.randomCiv')}</p></div>`}
        </div>
      </div></div>
      <div class="sheet-foot"><button class="btn ghost" data-a="close">${t('setup.back')}</button><button class="btn primary" data-a="start">${t('setup.start')}</button></div>`,
      (e, el, isChange) => {
        if (!el) return;
        const i = el.dataset.i != null ? +el.dataset.i : -1;
        if (isChange) {
          const k = el.dataset.k; if (!k) return;
          if (e.type === 'input' && el.tagName !== 'INPUT') return;
          if (i >= 0) { const p = S.players[i]; p[k] = k === 'team' ? +el.value : el.value; if (k === 'name') return; }
          else S[k] = ['startAge', 'popCap', 'treaty', 'timeLimit'].includes(k) ? +el.value : el.value;
          if (k === 'seed' || k === 'name') return;
          if (k === 'size') { const mx = el.value === 'tiny' ? 2 : el.value === 'small' ? 4 : 8; S.players = S.players.slice(0, mx); }
          this.showSetup(); return;
        }
        const a = el.dataset.a;
        Audio2.sfx('click');
        if (a === 'color') { const used = new Set(S.players.map(p => p.color)); let c = S.players[i].color; for (let k = 0; k < 8; k++) { c = (c + 1) % 8; if (!used.has(c)) break; } S.players[i].color = c; this.showSetup(); }
        else if (a === 'rm') { S.players.splice(i, 1); this.showSetup(); }
        else if (a === 'add') { const used = new Set(S.players.map(p => p.color)); let c = 0; while (used.has(c)) c++; S.players.push({ ai: 'normal', civ: 'random', color: c, team: 0 }); this.showSetup(); }
        else if (a === 'start') { store('eok.setup', S); this.closeModal(); startSkirmish(S); }
      });
  },
  showCivs() {
    this.modal(`${this.head(t('menu.civs'), t('ui.eyebrow'))}<div class="sheet-body"><div class="civ-grid">${CIV_IDS.map(civCard).join('')}</div></div>`);
  },
  showHowTo() {
    const keys = [['LMB', t('how.k.select')], ['LMB drag', t('how.k.box')], ['RMB', t('how.k.order')], ['Shift', t('how.k.queue')], ['Ctrl+1…9', t('how.k.group')], ['1…9', t('how.k.recall')], ['A', t('how.k.amove')], ['H', t('how.k.tc')], ['.', t('how.k.idle')], ['Space', t('how.k.alert')], ['Del', t('how.k.del')], ['P / F3', t('how.k.pause')], ['+ / −', t('how.k.speed')], ['Arrows', t('how.k.scroll')], ['Wheel', t('how.k.zoom')], ['Q W E R T…', t('how.k.grid')], ['Alt+RMB', t('how.k.garrison')], ['Esc', t('how.k.esc')]];
    const sec = k => `<section><h3>${t('how.' + k + '.t')}</h3><ul>${t('how.' + k + '.b').split('|').map(s => `<li>${s}</li>`).join('')}</ul></section>`;
    this.modal(`${this.head(t('menu.howto'), t('ui.eyebrow'))}<div class="sheet-body"><div class="howto">
      ${sec('eco')}${sec('mil')}${sec('ages')}${sec('win')}
      <section><h3>${t('how.keys')}</h3><div class="keys">${keys.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('')}</div></section>
      ${sec('touch')}
    </div></div>`);
  },
  showSettings(inGame) {
    const seg = (k, vals, labels) => `<div class="seg">${vals.map((v, i) => `<button data-a="set" data-k="${k}" data-v="${v}" class="${String(Settings[k]) === String(v) ? 'on' : ''}">${labels[i]}</button>`).join('')}</div>`;
    this.modal(`${this.head(t('set.title'))}<div class="sheet-body"><div class="set-grid">
      <div class="set-row"><span>${t('set.language')}</span><select data-k="lang">${LANGS.map(([k, n]) => `<option value="${k}" ${Settings.lang === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="set-row"><span>${t('set.music')}</span><input type="range" min="0" max="1" step=".05" data-k="music" value="${Settings.music}"></div>
      <div class="set-row"><span>${t('set.sfx')}</span><input type="range" min="0" max="1" step=".05" data-k="sfx" value="${Settings.sfx}"></div>
      <div class="set-row"><span>${t('set.speed')}</span>${seg('speed', [1, 1.5, 2, 3], ['1×', '1.5×', '2×', '3×'])}</div>
      <div class="set-row"><span>${t('set.scroll')}</span><input type="range" min=".4" max="2.5" step=".1" data-k="scroll" value="${Settings.scroll}"></div>
      <div class="set-row"><span>${t('set.edge')}</span>${seg('edge', [true, false], [t('set.on'), t('set.off')])}</div>
      <div class="set-row"><span>${t('set.hp')}</span>${seg('hpBars', ['selected', 'damaged', 'all'], [t('set.hp.selected'), t('set.hp.damaged'), t('set.hp.all')])}</div>
      <div class="set-row"><span>${t('set.fx')}</span>${seg('lowFx', [false, true], [t('set.fx.high'), t('set.fx.low')])}</div>
      <div class="set-row"><span>${t('set.reseed')}</span>${seg('autoReseed', [true, false], [t('set.on'), t('set.off')])}</div>
      <div class="set-row"><span>${t('set.fullscreen')}</span><div><button class="btn small" data-a="fs">${t('set.fullscreen')}</button></div></div>
    </div></div><div class="sheet-foot"><button class="btn primary" data-a="close">${t('set.close')}</button></div>`, (e, el, isChange) => {
      if (!el) return;
      const k = el.dataset.k;
      if (isChange && k) {
        if (k === 'lang') { setLang(el.value); Settings.lang = el.value; saveSettings(); this.showSettings(inGame); this.refreshLang(); return; }
        Settings[k] = +el.value; saveSettings(); Audio2.applyVolumes(); return;
      }
      if (el.dataset.a === 'set') {
        let v = el.dataset.v; v = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
        Settings[k] = v; saveSettings(); Audio2.sfx('click');
        if (k === 'speed' && !inGame) this.speed = v;
        if (k === 'autoReseed' && G && G.human >= 0) G.players[G.human].autoReseed = v;
        this.showSettings(inGame);
      }
      if (el.dataset.a === 'fs') { const d = document.documentElement; try { (document.fullscreenElement ? document.exitFullscreen() : d.requestFullscreen()).catch(() => { }); } catch (err) { } }
    }, 'narrow');
  },
  refreshLang() {
    if (this.screen === 'menu') this.showMenu();
    if (this.screen === 'game') { this.buildTopbar(); this.lastSig = ''; this.selSig = ''; this.updateObjectives(true); }
  },
  showLoad(inGame) {
    const slots = ['auto', '1', '2', '3'];
    const row = s => {
      const m = store('eok.meta.' + s);
      return `<div class="slot"><div><b>${s === 'auto' ? t('pm.auto') : t('pm.slot', { n: s })}</b><div class="muted small">${m ? `${esc(civName(m.civ))} · ${t('map.' + m.map)} · ${ageName(m.age)} · ${fmtTime(m.time)} · ${new Date(m.date).toLocaleString(Settings.lang)}` : t('pm.empty')}</div></div>
      <div class="acts">${inGame && s !== 'auto' ? `<button class="btn small" data-a="save" data-s="${s}">${t('pm.save')}</button>` : ''}${m ? `<button class="btn small primary" data-a="load" data-s="${s}">${t('pm.load')}</button><button class="btn small ghost" data-a="del" data-s="${s}" aria-label="${t('pm.delete')}">×</button>` : ''}</div></div>`;
    };
    this.modal(`${this.head(inGame ? t('pm.saveload') : t('menu.load'))}<div class="sheet-body"><div class="slots">${slots.map(row).join('')}</div><p class="muted small" id="loadNote"></p></div>`, (e, el) => {
      if (!el || !el.dataset.a) return;
      const s = el.dataset.s;
      if (el.dataset.a === 'save') { const ok = saveGame(s); $('loadNote').textContent = ok ? t('pm.saved') : t('pm.saveFail'); if (ok) this.showLoad(inGame); }
      else if (el.dataset.a === 'load') { this.closeModal(); loadGame(s); }
      else if (el.dataset.a === 'del') {
        if (el.dataset.c) { storeDel('eok.save.' + s); storeDel('eok.meta.' + s); this.showLoad(inGame); }
        else { el.dataset.c = '1'; el.textContent = t('pm.confirmDel'); }
      }
    }, 'narrow');
  },
  // Any open window freezes the game (see the main loop); the manual pause state is kept as it was.
  pauseMenu() {
    this.modal(`${this.head(t('pm.title'))}<div class="sheet-body"><div class="menu-list">
      <button class="menu-item" data-a="resume">${t('pm.resume')}</button>
      <button class="menu-item" data-a="saveload">${t('pm.saveload')}</button>
      <button class="menu-item" data-a="settings">${t('menu.settings')}</button>
      <button class="menu-item" data-a="howto">${t('menu.howto')}</button>
      <button class="menu-item" data-a="restart">${t('pm.restart')}</button>
      <button class="menu-item" data-a="quit">${t('pm.quit')}</button>
    </div></div>`, (e, el) => {
      if (!el) return;
      const a = el.dataset.a; Audio2.sfx('click');
      if (a === 'resume') { this.closeModal(); this.resume(); }
      else if (a === 'saveload') { this.onModalClose = null; this.showLoad(true); }
      else if (a === 'settings') { this.onModalClose = null; this.showSettings(true); }
      else if (a === 'howto') this.showHowTo();
      else if (a === 'restart') { if (el.dataset.c) { this.onModalClose = null; this.closeModal(); restartGame(); } else { el.dataset.c = 1; el.textContent = t('pm.confirmRestart'); } }
      else if (a === 'quit') { if (el.dataset.c) { this.onModalClose = null; this.closeModal(); quitToMenu(); } else { el.dataset.c = 1; el.textContent = t('pm.confirmQuit'); } }
    }, 'narrow');
  },
  pause(on) { this.paused = on; this.renderPause(); },
  resume() { this.paused = false; this.renderPause(); },
  // The PAUSED overlay always mirrors the real state: in a game, paused, and no window open.
  renderPause() {
    const show = this.screen === 'game' && this.paused && $('modal').hidden;
    let el = $('pausebadge');
    if (show) {
      if (!el) { el = document.createElement('div'); el.id = 'pausebadge'; el.className = 'pausebadge'; $('hud').appendChild(el); }
      const txt = t('hud.paused'); if (el.textContent !== txt) el.textContent = txt;
    } else if (el) el.remove();
  },
  // ---------------- HUD ----------------
  enterGame() {
    this.screen = 'game';
    $('menu').hidden = true; $('hud').hidden = false; $('modal').hidden = true;
    this.sel = []; this.groups = {}; this.page = 'main'; this.mode = null; R.ghost = null; this.endShown = false; this.pendingEnd = 0;
    this.buildTopbar(); this.lastSig = ''; this.selSig = '';
    $('feed').innerHTML = '';
    this.updateObjectives(true);
    $('touchbar').innerHTML = `<button class="tbtn" id="tbBox">${t('hud.boxSelect')}</button><button class="tbtn" id="tbDesel">${t('hud.deselect')}</button>`;
    $('tbBox').onclick = () => { this.boxMode = !this.boxMode; $('tbBox').classList.toggle('on', this.boxMode); $('tbBox').style.borderColor = this.boxMode ? 'var(--good)' : ''; };
    $('tbDesel').onclick = () => { this.sel = []; this.page = 'main'; this.cancelMode(); };
  },
  buildTopbar() {
    const p = G.players[G.human];
    $('topin').innerHTML = RES.map(r => `<div class="resb" id="rb_${r}" data-tip="res.${r}">${SVG[r]}<span class="v num" id="rv_${r}">0</span><span class="g num" id="rg_${r}"></span></div>`).join('') +
      `<div class="resb" id="rb_pop" data-tip="res.pop">${SVG.pop}<span class="v num" id="rv_pop">0/0</span></div>
      <div class="agebox"><span id="ageName"></span><div class="agebar" id="ageBar" hidden><i id="ageFill" style="width:0"></i></div></div>
      <div class="spacer"></div>
      <span class="clock num" id="clock">00:00</span>
      <button class="tbtn" id="btnSpeed" title="${t('hud.speedHelp')}"><span class="num" id="speedV">${this.speed}×</span></button>
      <button class="tbtn" id="btnPause" aria-label="${t('hud.paused')}">${SVG.pause}</button>
      <button class="tbtn" id="btnIdle" title="${t('hud.idle')} (.)">${SVG.idle}<span class="cnt num" id="idleN">0</span></button>
      <button class="tbtn" id="btnTree" title="${t('hud.techtree')}">${SVG.tree}</button>
      <button class="tbtn" id="btnScore" title="${t('hud.score')}">${SVG.score}</button>
      <button class="tbtn" id="btnMenu" title="${t('hud.menu')} (F10)">${SVG.menu}</button>`;
    $('btnSpeed').onclick = () => this.cycleSpeed(1, true);
    $('btnSpeed').oncontextmenu = e => { e.preventDefault(); this.cycleSpeed(-1, true); };
    $('btnPause').onclick = () => this.togglePause();
    $('btnIdle').onclick = () => this.nextIdle();
    $('btnTree').onclick = () => this.showTechTree();
    $('btnScore').onclick = () => this.showScores();
    $('btnMenu').onclick = () => this.pauseMenu();
    for (const el of $('topin').querySelectorAll('[data-tip]')) {
      const tip = () => this.showTip(el, `<div class="tt-t">${t(el.dataset.tip)}</div>${el.dataset.tip === 'res.pop' ? t('tt.popHelp') : t('tt.resHelp')}`);
      el.onpointerenter = e => { if (e.pointerType === 'mouse') tip(); };
      el.onpointerleave = e => { if (e.pointerType === 'mouse') this.hideTip(); };
      el.onpointerdown = e => { if (e.pointerType !== 'mouse') { tip(); this.hideTipSoon(); } };
    }
    void p;
  },
  // Button: 1× → 1.5× → 2× → 3× → 1× (wraps). Keys + and −: step up/down without wrapping.
  cycleSpeed(d, wrap) {
    const sp = [1, 1.5, 2, 3];
    let i = sp.indexOf(this.speed); if (i < 0) i = 1;
    i = wrap ? (i + d + sp.length) % sp.length : clamp(i + d, 0, sp.length - 1);
    this.speed = sp[i];
    const v = $('speedV'); if (v) v.textContent = this.speed + '×';
    Audio2.sfx('click');
  },
  togglePause() { if (!$('modal').hidden) return; this.paused = !this.paused; this.renderPause(); },
  updateHUD() {
    if (!G || G.human < 0) return;
    this.renderPause();
    const p = G.players[G.human];
    for (const r of RES) {
      $('rv_' + r).textContent = Math.floor(p.res[r]);
      const n = p.gathN[r] || 0; $('rg_' + r).textContent = n ? n : '';
    }
    const housed = p.pop >= p.cap && p.cap < (G.cfg.popCap || MAX_POP);
    $('rv_pop').textContent = p.pop + '/' + p.cap;
    $('rv_pop').style.color = housed ? 'var(--bad)' : '';
    $('ageName').textContent = ageName(p.age);
    const aging = p.aging ? G.blds.find(b => b.owner === p.id && b.q.length && b.q[0].k === 't' && T[b.q[0].id].ageUp) : null;
    $('ageBar').hidden = !aging;
    if (aging) { const it = aging.q[0]; $('ageFill').style.width = (it.t / T[it.id].time * 100).toFixed(1) + '%'; }
    $('clock').textContent = fmtTime(G.time);
    $('speedV').textContent = this.speed + '×';
    $('btnPause').innerHTML = this.paused ? SVG.play : SVG.pause;
    $('idleN').textContent = p.idle.length;
    // wonders / relics countdowns
    const wb = [];
    for (const id in G.wonders) { const w = G.wonders[id]; wb.push(`<span style="color:${pcol(w.owner)}">${t('hud.wonder', { p: esc(pname(w.owner)), t: fmtTime(w.t) })}</span>`); }
    if (G.relicHold) wb.push(`<span style="color:${pcol(G.relicHold.owner)}">${t('hud.relics', { p: esc(pname(G.relicHold.owner)), t: fmtTime(G.relicHold.t) })}</span>`);
    if (G.cfg.victory === 'time') wb.push(`<span>${t('hud.timeLeft', { t: fmtTime(G.cfg.timeLimit * 60 - G.time) })}</span>`);
    if (G.cfg.treaty && G.time < G.cfg.treaty * 60) wb.push(`<span>${t('hud.treaty', { t: fmtTime(G.cfg.treaty * 60 - G.time) })}</span>`);
    const wbh = wb.join(''); if ($('wonderbar').innerHTML !== wbh) $('wonderbar').innerHTML = wbh;
    this.updateSelPanel();
    this.updateCmdGrid();
    if (G.cfg.tutorial) this.updateObjectives();
  },
  // ---------------- selection panel ----------------
  updateSelPanel() {
    this.sel = this.sel.filter(id => { const e = byId(id); return e && !e.dead && !(e.k === 'u' && e.gIn) && !(e.k === 'r' && (e.carrier || e.inB)); });
    const sp = $('selpanel');
    if (!this.sel.length) { if (sp.dataset.s !== 'none') { sp.innerHTML = `<div class="sinfo"><div class="sub">${t('hud.nothing')}</div></div>`; sp.dataset.s = 'none'; } return; }
    sp.dataset.s = 'x';
    const ents = this.sel.map(byId);
    if (ents.length === 1) { sp.innerHTML = this.infoHTML(ents[0]); return; }
    sp.innerHTML = `<div class="multi">${ents.slice(0, 60).map(e => { const f = e.hp / e.mhp; return `<button class="mu" data-id="${e.id}" aria-label="${esc(nameOf(e.type))}"><img src="${this.iconFor(e)}" alt=""><i style="width:${(f * 100).toFixed(0)}%;background:${f > .6 ? '#5bd15b' : f > .3 ? '#e6c229' : '#e04a3a'}"></i></button>`; }).join('')}</div>`;
  },
  iconFor(e) {
    if (e.k === 'u') return iconURL('unit', e.type, e.owner >= 0 ? G.players[e.owner].color : 6);
    if (e.k === 'b') return iconURL('bld', e.type, CIVS[G.players[e.owner].civ].arch);
    return iconURL('res', e.type, 0);
  },
  infoHTML(e) {
    const own = e.owner === G.human;
    let h = `<img class="portrait" src="${e.k === 'r' ? resIcon(e.type) : this.iconFor(e)}" alt="">`;
    h += '<div class="sinfo">';
    if (e.k === 'r') {
      h += `<div class="nm">${t('res.' + (e.type === 'relic' ? 'relic' : e.type === 'carcass' ? 'carcass' : e.type === 'tree' ? 'tree' : e.type === 'fish' ? 'fishShoal' : e.type === 'berry' ? 'berries' : e.type + 'Mine'))}</div>`;
      if (e.type === 'relic') h += `<div class="sub">${t('tt.relicHelp')}</div>`;
      else { const rk = RES_KIND[e.type]; h += `<div class="stats"><span>${SVG[rk.res]} <b class="num">${Math.ceil(e.amt)}</b></span></div>`; }
      return h + '</div>';
    }
    const s = ST(e.owner, e.type);
    const p = e.owner >= 0 ? G.players[e.owner] : null;
    const f = clamp(e.hp / e.mhp, 0, 1);
    h += `<div class="nm">${esc(nameOf(e.type))}</div>`;
    h += `<div class="sub">${p ? `<span class="pdot" style="background:${pcol(e.owner)}"></span>${esc(pname(e.owner))} · ${civName(p.civ)}` : t('ui.gaia')}</div>`;
    h += `<div class="hpbar"><i style="width:${(f * 100).toFixed(1)}%;background:${f > .6 ? '#5bd15b' : f > .3 ? '#e6c229' : '#e04a3a'}"></i></div>`;
    const st = [];
    st.push(`<span title="${t('stat.hp')}">♥ <b class="num">${Math.ceil(e.hp)}/${e.mhp}</b></span>`);
    if (s.atk) st.push(`<span title="${t('stat.atk')}">${SVG.atk}<b class="num">${s.atk}</b>${s.shots > 1 ? '×' + s.shots : ''}</span>`);
    st.push(`<span title="${t('stat.armM')}">${SVG.armM}<b class="num">${s.armM}</b></span><span title="${t('stat.armP')}">${SVG.armP}<b class="num">${s.armP}</b></span>`);
    if (s.rng) st.push(`<span title="${t('stat.rng')}">${SVG.rng}<b class="num">${s.rng}</b></span>`);
    if (e.k === 'u' && !U[e.type].animal) st.push(`<span title="${t('stat.spd')}">${SVG.spd}<b class="num">${s.spd.toFixed(2)}</b></span>`);
    if (e.k === 'u' && e.carry > 0) st.push(`<span title="${t('tt.carry')}">${SVG[e.cres]}<b class="num">${Math.floor(e.carry)}</b></span>`);
    if (e.k === 'b' && B[e.type].garrison) st.push(`<span title="${t('tt.garrison')}">${SVG.gar}<b class="num">${e.gar.length}/${B[e.type].garrison}</b></span>`);
    if (e.k === 'b' && e.type === 'farm' && e.built) st.push(`<span title="${t('tt.food')}">${SVG.food}<b class="num">${Math.ceil(e.food)}</b></span>`);
    if (e.k === 'b' && e.relics.length) st.push(`<span title="${t('res.relic')}">${SVG.relic}<b class="num">${e.relics.length}</b></span>`);
    if (e.k === 'u' && e.relic) st.push(`<span>${SVG.relic}</span>`);
    if (e.k === 'u' && e.type === 'monk' && e.rest > 0) st.push(`<span class="muted">${t('tt.resting', { s: Math.ceil(e.rest) })}</span>`);
    if (e.k === 'u' && U[e.type].food && e.owner < 0) st.push(`<span>${SVG.food}<b class="num">${U[e.type].food}</b></span>`);
    h += `<div class="stats">${st.join('')}</div>`;
    if (e.k === 'u' && own && !U[e.type].animal) h += `<div class="sub">${t('stance.' + e.stance)}${e.kills ? '' : ''}</div>`;
    if (e.k === 'b' && !e.built) h += `<div class="sub">${t('tt.building', { p: Math.floor(e.prog * 100) })}</div>`;
    if (e.k === 'b' && own && e.q.length) {
      const groups = [];
      for (let i = 0; i < e.q.length; i++) { const it = e.q[i]; const key = it.k + (it.type || it.id); if (i > 0 && groups.length && groups[groups.length - 1].key === key) groups[groups.length - 1].n++; else groups.push({ key, it, i, n: 1 }); }
      h += `<div class="queue">${groups.map((g, gi) => { const it = g.it; const icon = it.k === 'u' ? iconURL('unit', resolveTrain(p, it.key), p.color) : iconURL('tech', T[it.id].ageUp ? 'age' + T[it.id].ageUp : T[it.id].icon, 0); const tot = it.k === 'u' ? ST(p.id, resolveTrain(p, it.key)).time : T[it.id].time; return `<button class="qi ${gi === 0 && it.wait ? 'wait' : ''}" data-q="${g.i}" title="${t('tt.cancel')}"><img src="${icon}" alt="">${gi === 0 ? `<span class="p" style="width:${(it.t / tot * 100).toFixed(0)}%"></span>` : ''}${g.n > 1 ? `<span class="n">${g.n}</span>` : ''}</button>`; }).join('')}</div>`;
    }
    return h + '</div>';
  },
  // ---------------- command card ----------------
  buildCmdGrid() {
    const g = $('cmdgrid');
    g.innerHTML = '';
    this.slotEls = [];
    for (let i = 0; i < 15; i++) {
      const b = document.createElement('button');
      b.className = 'cb empty'; b.dataset.i = i;
      b.innerHTML = `<img alt=""><span class="hk">${GRID_KEYS[i]}</span><span class="bd"></span><span class="pr"></span>`;
      b.addEventListener('click', e => { this.slotClick(i, e.shiftKey, false); });
      b.addEventListener('contextmenu', e => { e.preventDefault(); this.slotClick(i, e.shiftKey, true); });
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { this.hoverSlot = i; this.slotTip(i); } });
      b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { this.hoverSlot = -1; this.hideTip(); } });
      // touch has no hover: show the details briefly, then get out of the way
      b.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { this.slotTip(i); this.hideTipSoon(); } });
      g.appendChild(b);
      this.slotEls.push(b);
    }
  },
  slotClick(i, shift, right) {
    const s = this.slots[i];
    if (!s) return;
    Audio2.ensure();
    if (right) { if (s.rfn) s.rfn(); this.lastSig = ''; return; }
    if (s.off) { Audio2.sfx('error'); if (s.reason) this.feed(s.reason, 'bad'); return; }
    if (s.poor) { Audio2.sfx('error'); this.flashRes(s.cost); this.feed(t('msg.notEnough'), 'bad'); return; }
    Audio2.sfx('click');
    s.fn(shift);
    this.lastSig = '';
    this.updateCmdGrid();
    if (this.hoverSlot === i) this.slotTip(i);
  },
  flashRes(cost) {
    const p = G.players[G.human];
    for (const r of RES) if (cost && cost[r] > p.res[r]) { const el = $('rb_' + r); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  },
  updateCmdGrid() {
    const slots = this.computeSlots();
    this.slots = slots;
    for (let i = 0; i < 15; i++) {
      const s = slots[i], el = this.slotEls[i];
      if (!s) { if (!el.classList.contains('empty')) el.className = 'cb empty'; continue; }
      const img = el.firstChild;
      if (img.dataset.src !== s.icon) { img.src = s.icon; img.dataset.src = s.icon; }
      const cls = 'cb' + (s.off ? ' off' : '') + (s.poor && !s.off ? ' poor' : '') + (s.on ? ' on' : '');
      if (el.className !== cls) el.className = cls;
      const bd = el.querySelector('.bd'); const bt = s.badge != null ? String(s.badge) : ''; if (bd.textContent !== bt) bd.textContent = bt;
      const pr = el.querySelector('.pr'); const pw = s.prog != null ? (s.prog * 100).toFixed(0) + '%' : '0'; if (pr.style.width !== pw) pr.style.width = pw;
      el.setAttribute('aria-label', s.name);
    }
    if (this.hoverSlot >= 0 && this.tipSig !== this.slotSig(this.hoverSlot)) this.slotTip(this.hoverSlot);
  },
  slotSig(i) { const s = this.slots[i]; return s ? s.name + '|' + !!s.off + '|' + !!s.poor + '|' + (s.badge || '') : ''; },
  computeSlots() {
    const out = new Array(15).fill(null);
    if (!G || G.human < 0) return out;
    const p = G.players[G.human];
    const ents = this.sel.map(byId).filter(e => e && !e.dead);
    const mine = ents.filter(e => e.owner === G.human);
    if (!mine.length || mine.length !== ents.length) return out;
    const units = mine.filter(e => e.k === 'u'), blds = mine.filter(e => e.k === 'b');
    const put = (i, s) => { out[i] = s; };
    const cmdS = (id, name, fn, opt) => Object.assign({ icon: iconURL('cmd', id, 0), name, fn, desc: '' }, opt || {});
    if (units.length) {
      const allVil = units.every(isVil);
      if (allVil) {
        if (this.page === 'eco' || this.page === 'mil') {
          const list = this.page === 'eco' ? ECO_BLD : MIL_BLD;
          list.forEach((type, i) => put(i, this.bldSlot(p, type, units)));
          put(14, cmdS('back', t('cmd.back'), () => { this.page = 'main'; }));
          return out;
        }
        put(0, cmdS('ecoB', t('cmd.ecoB'), () => { this.page = 'eco'; }));
        put(1, cmdS('milB', t('cmd.milB'), () => { this.page = 'mil'; }));
        put(2, cmdS('repair', t('cmd.repair'), () => this.setMode('repair'), { desc: t('cmdd.repair') }));
      } else {
        put(0, cmdS('amove', t('cmd.amove'), () => this.setMode('amove'), { desc: t('cmdd.amove') }));
        put(1, cmdS('patrol', t('cmd.patrol'), () => this.setMode('patrol'), { desc: t('cmdd.patrol') }));
        if (units.some(u => ST(u.owner, u.type).ground)) put(2, cmdS('ground', t('cmd.ground'), () => this.setMode('ground'), { desc: t('cmdd.ground') }));
        if (units.some(u => u.relic)) put(3, cmdS('drop', t('cmd.dropRelic'), () => Cmd.dropRelic(units)));
        const st = units[0].stance;
        ['agg', 'def', 'stand', 'none'].forEach((s, i) => put(5 + i, cmdS(s, t('stance.' + s), () => Cmd.stance(units, s), { on: units.every(u => u.stance === s), desc: t('stanced.' + s) })));
        void st;
      }
      put(10, cmdS('stop', t('cmd.stop'), () => Cmd.stop(units)));
      put(11, cmdS('garrison', t('cmd.garrison'), () => this.setMode('garrison'), { desc: t('cmdd.garrison') }));
      if (p.cnt.tc || p.cnt.castle || p.cnt.tower) put(12, cmdS('bell', p.bell ? t('cmd.bellOff') : t('cmd.bell'), () => Cmd.bell(p), { on: p.bell, desc: t('cmdd.bell') }));
      put(14, cmdS('del', t('cmd.del'), () => { Cmd.del(units); this.sel = []; }, { desc: t('cmdd.del') }));
      return out;
    }
    // buildings (same type)
    const type = blds[0].type;
    if (!blds.every(b => b.type === type)) return out;
    const d = B[type];
    const b = blds.slice().sort((a, c) => a.q.length - c.q.length)[0];
    let i = 0;
    if (b.built) {
      if (d.market) {
        for (const r of ['food', 'wood', 'stone']) {
          const price = Math.round(p.market[r] * (1 + p.commission)), gain = Math.round(p.market[r] * (1 - p.commission));
          put(i++, cmdS('buy_' + r, t('cmd.buy', { res: t('res.' + r) }), () => Cmd.market(p, r, true), { poor: p.res.gold < price, cost: { gold: price }, desc: t('cmdd.buy', { n: 100, res: t('res.' + r), g: price }) }));
          put(i++, cmdS('sell_' + r, t('cmd.sell', { res: t('res.' + r) }), () => Cmd.market(p, r, false), { poor: p.res[r] < 100, cost: { [r]: 100 }, desc: t('cmdd.sell', { n: 100, res: t('res.' + r), g: gain }) }));
        }
      }
      for (const key of d.trains) {
        const tp = resolveTrain(p, key);
        const ud = U[tp];
        if (!ud) continue;
        if (ud.req && !p.techs[ud.req] && p.age >= 3 && key !== 'handCannoneer' && key !== 'bombard') continue;
        const avail = unitAvailable(p, key);
        const s = ST(p.id, tp);
        const queued = blds.reduce((n, x) => n + x.q.filter(it => it.k === 'u' && it.key === key).length, 0);
        const reason = !avail ? (p.age < ud.age ? t('tt.needAge', { age: ageName(ud.age) }) : ud.req ? t('tt.needTech', { tech: techName(ud.req) }) : '') : '';
        put(i++, {
          icon: iconURL('unit', tp, p.color), name: nameOf(tp), kind: 'unit', type: tp, cost: s.cost, time: s.time, off: !avail, reason, poor: avail && !canAfford(p, s.cost), badge: queued || null,
          fn: shift => { const tb = blds.slice().sort((a, c) => a.q.length - c.q.length)[0]; const n = Cmd.train(tb, key, shift ? 5 : 1); if (n) Audio2.sfx('queue'); else this.flashRes(s.cost); },
          rfn: () => { for (const x of blds) { for (let k = x.q.length - 1; k >= 0; k--) if (x.q[k].k === 'u' && x.q[k].key === key) { Cmd.cancel(x, k); return; } } },
        });
      }
      for (const id of d.techs) {
        if (!techVisible(p, id)) continue;
        const tt = T[id];
        const avail = techAvailable(p, id) && (!tt.ageUp || ageReqMet(p));
        const res = p.researching[id];
        const c = techCost(p, id);
        let reason = '';
        if (!avail && !res) reason = p.age < tt.age ? t('tt.needAge', { age: ageName(tt.age) }) : tt.ageUp ? t('tt.ageReq') : tt.req.filter(r => !p.techs[r]).map(r => t('tt.needTech', { tech: techName(r) })).join(' ');
        let prog = null;
        if (res) { const rb = byId(res); const it = rb && rb.q.find(q => q.k === 't' && q.id === id); if (it && rb.q[0] === it) prog = it.t / tt.time; }
        put(i++, {
          icon: iconURL('tech', tt.ageUp ? 'age' + tt.ageUp : tt.icon, 0), name: techName(id), kind: 'tech', id, cost: c, time: tt.time, off: !avail && !res, reason, poor: avail && !canAfford(p, c), on: !!res, prog,
          fn: () => { if (res) return; if (Cmd.research(b, id)) Audio2.sfx('queue'); },
          rfn: () => { const rb = byId(res); if (rb) { const k = rb.q.findIndex(q => q.k === 't' && q.id === id); if (k >= 0) Cmd.cancel(rb, k); } },
        });
        if (i >= 10) break;
      }
      if (d.trains.length || type === 'tc') put(10, cmdS('rally', t('cmd.rally'), () => this.setMode('rally'), { desc: t('cmdd.rally') }));
      if (d.garrison) put(11, cmdS('ungarrison', t('cmd.ungarrison'), () => { for (const x of blds) Cmd.ungarrison(x); }, { off: !blds.some(x => x.gar.length), badge: blds.reduce((n, x) => n + x.gar.length, 0) || null }));
      if (type === 'tc') put(12, cmdS('bell', p.bell ? t('cmd.bellOff') : t('cmd.bell'), () => Cmd.bell(p), { on: p.bell, desc: t('cmdd.bell') }));
      if (type === 'monastery' && b.relics.length) put(13, cmdS('drop', t('cmd.relicsHeld', { n: b.relics.length }), () => { }, { off: true, reason: t('tt.relicHelp') }));
    }
    put(14, cmdS('del', t('cmd.del'), () => { Cmd.del(blds); this.sel = []; }, { desc: t('cmdd.del') }));
    return out;
  },
  bldSlot(p, type, units) {
    const d = B[type], s = ST(p.id, type);
    let reason = '';
    if (p.age < d.age) reason = t('tt.needAge', { age: ageName(d.age) });
    else if (d.req && !(p.cnt[d.req] > 0)) reason = t('tt.needBld', { bld: nameOf(d.req) });
    else if (type === 'wonder' && (p.cntAll.wonder || 0) >= 1) reason = t('tt.oneWonder');
    return {
      icon: iconURL('bld', type, CIVS[p.civ].arch), name: nameOf(type), kind: 'bld', type, cost: s.cost, time: s.time, off: !!reason, reason, poor: !reason && !canAfford(p, s.cost),
      fn: () => { this.setMode('place', { type, units: units.map(u => u.id) }); },
    };
  },
  slotTip(i) {
    const s = this.slots[i];
    if (!s) { this.hideTip(); return; }
    this.tipSig = this.slotSig(i);
    const p = G.players[G.human];
    let h = `<div class="tt-t"><span>${esc(s.name)}</span><kbd>${GRID_KEYS[i]}</kbd></div>`;
    if (s.cost && Object.keys(s.cost).length) h += costHTML(s.cost, p);
    if (s.time) h += `<div class="muted">${SVG.time} ${Math.round(s.time)}s</div>`;
    if (s.kind === 'unit') h += unitDesc(p, s.type);
    else if (s.kind === 'tech') h += `<ul>${T[s.id].fx.map(f => `<li>${describeFx(f)}</li>`).join('')}</ul>`;
    else if (s.kind === 'bld') h += bldDesc(p, s.type);
    else if (s.desc) h += `<div>${s.desc}</div>`;
    if (s.reason) h += `<div class="req">${s.reason}</div>`;
    if (s.kind === 'unit') h += `<div class="muted small">${t('tt.trainHint')}</div>`;
    const el = this.slotEls[i];
    this.showTip(el, h);
  },
  showTip(el, html) {
    const tip = $('tooltip');
    tip.innerHTML = html; tip.style.display = 'block';
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    x = clamp(x, 8, window.innerWidth - tw - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  },
  hideTip() { clearTimeout(this.tipT); $('tooltip').style.display = 'none'; },
  hideTipSoon(ms) { clearTimeout(this.tipT); this.tipT = setTimeout(() => { $('tooltip').style.display = 'none'; }, ms || 2500); },
  // ---------------- modes ----------------
  setMode(m, data) {
    this.mode = m; this.modeData = data || null;
    $('view').style.cursor = m === 'place' ? 'crosshair' : m ? 'crosshair' : '';
    if (m !== 'place') R.ghost = null;
  },
  cancelMode() { this.mode = null; this.modeData = null; R.ghost = null; $('view').style.cursor = ''; },
  // ---------------- selection helpers ----------------
  myUnits() { return this.sel.map(byId).filter(e => e && !e.dead && e.k === 'u' && e.owner === G.human); },
  myBlds() { return this.sel.map(byId).filter(e => e && !e.dead && e.k === 'b' && e.owner === G.human); },
  select(ids, add) {
    if (add) { for (const id of ids) { const i = this.sel.indexOf(id); if (i >= 0) this.sel.splice(i, 1); else this.sel.push(id); } }
    else this.sel = ids.slice();
    this.page = 'main';
    const first = byId(this.sel[0]);
    if (first && first.owner === G.human) Audio2.select(first);
    this.lastSig = '';
    this.updateCmdGrid();
  },
  clickSelect(sx, sy, shift, dbl) {
    const e = R.pick(sx, sy);
    if (!e) { if (!shift) this.select([], false); return; }
    if (e.owner === G.human && e.k === 'u' && (dbl || this.ctrl)) {
      const [x0, y0] = [0, 0];
      const ids = [];
      for (const u of G.units) if (!u.dead && !u.gIn && u.owner === G.human && u.type === e.type) { const [px, py] = R.toScreen(u.x, u.y); if (px >= x0 && py >= y0 && px <= R.W && py <= R.H) ids.push(u.id); }
      this.select(ids, false); return;
    }
    if (e.owner === G.human && e.k === 'b' && (dbl || this.ctrl)) {
      const ids = G.blds.filter(b => !b.dead && b.owner === G.human && b.type === e.type && b.built).map(b => b.id);
      this.select(ids, false); return;
    }
    if (shift && e.owner === G.human && this.sel.every(id => { const x = byId(id); return x && x.owner === G.human; })) { this.select([e.id], true); return; }
    this.select([e.id], false);
  },
  boxSelect(b, shift) {
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    const ids = [];
    for (const u of G.units) {
      if (u.dead || u.gIn || u.owner !== G.human) continue;
      const [sx, sy] = R.toScreen(u.x, u.y);
      if (sx >= x0 && sx <= x1 && sy - 12 * R.cam.z >= y0 - 12 && sy - 12 * R.cam.z <= y1 + 6) ids.push(u.id);
    }
    if (!ids.length) { if (!shift) this.clickSelect((x0 + x1) / 2, (y0 + y1) / 2, false, false); return; }
    // prefer military over villagers when mixed (like many RTS games)
    const mil = ids.filter(id => !isVil(byId(id)));
    const pick = mil.length && mil.length < ids.length && !shift ? mil : ids;
    if (shift) { for (const id of pick) if (!this.sel.includes(id)) this.sel.push(id); this.lastSig = ''; Audio2.select(byId(pick[0])); }
    else this.select(pick, false);
  },
  // ---------------- commands from the map ----------------
  command(sx, sy, shift, alt) {
    const [wx, wy] = R.toWorld(sx, sy);
    const tgt = R.pick(sx, sy);
    const units = this.myUnits();
    const blds = this.myBlds();
    if (units.length) {
      if (this.mode && this.mode !== 'place') { this.applyMode(wx, wy, tgt, shift); return; }
      const hostileT = tgt && tgt.owner >= 0 && isEnemy(G.human, tgt.owner);
      Cmd.smart(units, wx, wy, tgt, { shift, alt });
      R.marks.push({ x: tgt ? tgt.x + (tgt.w || 0) / 2 : wx, y: tgt ? tgt.y + (tgt.h || 0) / 2 : wy, t: R.t, col: hostileT ? 'rgba(255,90,70,A)' : tgt && tgt.k === 'r' ? 'rgba(255,220,100,A)' : 'rgba(140,255,140,A)' });
      Audio2.ack(units[0], hostileT);
      return;
    }
    if (blds.length) {
      for (const b of blds) Cmd.rally(b, wx, wy, tgt && tgt !== b ? tgt.id : 0);
      R.marks.push({ x: wx, y: wy, t: R.t, col: 'rgba(240,230,190,A)' });
      Audio2.sfx('click');
    }
  },
  applyMode(wx, wy, tgt, shift) {
    const units = this.myUnits();
    const m = this.mode;
    if (m === 'amove') { Cmd.move(units, wx, wy, { amove: true, shift }); R.marks.push({ x: wx, y: wy, t: R.t, col: 'rgba(255,90,70,A)' }); Audio2.ack(units[0], true); }
    else if (m === 'patrol') { Cmd.patrol(units, wx, wy); R.marks.push({ x: wx, y: wy, t: R.t, col: 'rgba(255,220,100,A)' }); Audio2.ack(units[0], false); }
    else if (m === 'ground') { Cmd.ground(units, wx, wy); R.marks.push({ x: wx, y: wy, t: R.t, col: 'rgba(255,90,70,A)' }); }
    else if (m === 'garrison') { if (tgt && tgt.k === 'b' && tgt.owner === G.human) { if (tgt.type === 'monastery') Cmd.smart(units, wx, wy, tgt, {}); else Cmd.garrison(units, tgt); Audio2.ack(units[0], false); } }
    else if (m === 'repair') { if (tgt && tgt.k === 'b' && allied(tgt.owner, G.human)) Cmd.build(units.filter(isVil), tgt, shift); }
    else if (m === 'rally') { for (const b of this.myBlds()) Cmd.rally(b, wx, wy, tgt && tgt !== b ? tgt.id : 0); R.marks.push({ x: wx, y: wy, t: R.t, col: 'rgba(240,230,190,A)' }); }
    if (!shift || m === 'rally') this.cancelMode();
  },
  updateGhost(sx, sy) {
    if (this.mode !== 'place') { R.ghost = null; return; }
    const { type } = this.modeData;
    const d = B[type], p = G.players[G.human];
    const [wx, wy] = R.toWorld(sx, sy);
    const tx = Math.round(wx - d.w / 2), ty = Math.round(wy - d.h / 2);
    let tiles;
    if (d.wall && this.wallStart) tiles = wallTiles(this.wallStart[0], this.wallStart[1], Math.floor(wx), Math.floor(wy)).map(([x, y]) => ({ x, y }));
    else tiles = [{ x: d.w === 1 ? Math.floor(wx) : tx, y: d.w === 1 ? Math.floor(wy) : ty }];
    for (const q of tiles) q.ok = canPlace(p, type, q.x, q.y, false);
    R.ghost = { type, w: d.w, h: d.h, tiles };
  },
  placeAt(shift) {
    const g = R.ghost; if (!g) return;
    const p = G.players[G.human];
    const units = (this.modeData.units || []).map(byId).filter(u => u && !u.dead);
    let placed = 0, first = null;
    for (const q of g.tiles) {
      if (!q.ok) continue;
      const b = placeBld(p, g.type, q.x, q.y, null, false);
      if (b) { placed++; if (!first) { first = b; Cmd.build(units, b, shift); } else for (const u of units) issue(u, { t: 'build', id: b.id }, true); }
      else if (!canAfford(p, ST(p.id, g.type).cost)) { this.flashRes(ST(p.id, g.type).cost); this.feed(t('msg.notEnough'), 'bad'); break; }
    }
    if (placed) { Audio2.sfx('place'); Audio2.ack(units[0], false); }
    else { Audio2.sfx('error'); if (!g.tiles.some(q => q.ok)) this.feed(t('msg.cantPlace'), 'bad'); }
    this.wallStart = null;
    if (!shift) { this.cancelMode(); this.page = 'main'; }
  },
  nextIdle() {
    const p = G.players[G.human];
    if (!p.idle.length) { this.feed(t('msg.noIdle'), 'info'); return; }
    this.idleI = ((this.idleI || 0) + 1) % p.idle.length;
    const u = p.idle[this.idleI];
    this.select([u.id], false);
    R.centerOn(u.x, u.y);
  },
  // ---------------- input ----------------
  bindInput(cv) {
    const down = this.down = { on: false };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      Audio2.ensure();
      if (this.screen !== 'game' || !G) return;
      cv.setPointerCapture(e.pointerId);
      this.ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, t: performance.now(), type: e.pointerType });
      document.body.classList.toggle('touch', e.pointerType === 'touch');
      if (e.pointerType === 'touch') { this.touchDown(e); return; }
      const x = e.offsetX, y = e.offsetY;
      if (e.button === 1) { down.pan = { x, y, cx: R.cam.x, cy: R.cam.y }; e.preventDefault(); return; }
      if (e.button === 2) {
        if (this.mode) { this.cancelMode(); this.wallStart = null; return; }
        this.command(x, y, e.shiftKey, e.altKey); return;
      }
      if (e.button === 0) {
        if (this.mode === 'place') {
          const d = B[this.modeData.type];
          if (d.wall) { const [wx, wy] = R.toWorld(x, y); this.wallStart = [Math.floor(wx), Math.floor(wy)]; this.updateGhost(x, y); return; }
          this.placeAt(e.shiftKey); return;
        }
        if (this.mode) { const [wx, wy] = R.toWorld(x, y); this.applyMode(wx, wy, R.pick(x, y), e.shiftKey); return; }
        down.on = true; down.x = x; down.y = y; down.shift = e.shiftKey; down.box = false;
      }
    });
    cv.addEventListener('pointermove', e => {
      const x = e.offsetX, y = e.offsetY;
      this.mouse.x = x; this.mouse.y = y; this.mouse.in = true;
      const pt = this.ptrs.get(e.pointerId);
      if (pt) { pt.x = x; pt.y = y; }
      if (this.screen !== 'game' || !G) return;
      if (e.pointerType === 'touch') { this.touchMove(e); return; }
      if (down.pan) { R.cam.x = down.pan.cx - (x - down.pan.x) / R.cam.z; R.cam.y = down.pan.cy - (y - down.pan.y) / R.cam.z; R.clampCam(); return; }
      if (down.on) {
        if (!down.box && Math.hypot(x - down.x, y - down.y) > 6) down.box = true;
        if (down.box) R.box = { x0: Math.min(down.x, x), y0: Math.min(down.y, y), x1: Math.max(down.x, x), y1: Math.max(down.y, y) };
      }
      if (this.mode === 'place') this.updateGhost(x, y);
      R.hover = R.pick(x, y);
      this.updateCursor();
    });
    const up = e => {
      const pt = this.ptrs.get(e.pointerId);
      this.ptrs.delete(e.pointerId);
      if (this.screen !== 'game' || !G) return;
      if (e.pointerType === 'touch') { this.touchUp(e, pt); return; }
      const x = e.offsetX, y = e.offsetY;
      if (down.pan) { down.pan = null; return; }
      if (this.mode === 'place' && this.wallStart && e.button === 0) { this.updateGhost(x, y); this.placeAt(e.shiftKey); return; }
      if (!down.on) return;
      down.on = false;
      if (down.box) { this.boxSelect({ x0: down.x, y0: down.y, x1: x, y1: y }, e.shiftKey); R.box = null; return; }
      const now = performance.now();
      const hit = R.pick(x, y);
      const dbl = hit && this.lastClick.id === hit.id && now - this.lastClick.t < 380;
      this.lastClick = { t: now, id: hit ? hit.id : 0 };
      this.ctrl = e.ctrlKey || e.metaKey;
      this.clickSelect(x, y, e.shiftKey, dbl);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { this.ptrs.delete(e.pointerId); down.on = false; down.pan = null; R.box = null; });
    cv.addEventListener('pointerleave', () => { this.mouse.in = false; });
    cv.addEventListener('pointerdown', () => this.hideTip(), true);
    window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.edge = { x: e.clientX, y: e.clientY, in: true }; }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { if (this.edge) this.edge.in = false; });
    window.addEventListener('blur', () => { if (this.edge) this.edge.in = false; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.screen !== 'game' || !G) return;
      const [wx, wy] = R.toWorld(e.offsetX, e.offsetY);
      const z0 = R.cam.z;
      R.cam.z = clamp(z0 * (e.deltaY < 0 ? 1.12 : 1 / 1.12), .45, 2.2);
      const [nx, ny] = R.toWorld(e.offsetX, e.offsetY);
      R.cam.x += (isoX(wx, wy) - isoX(nx, ny)); R.cam.y += (isoY(wx, wy) - isoY(nx, ny));
      R.clampCam();
    }, { passive: false });
    window.addEventListener('keydown', e => this.key(e));
    window.addEventListener('keyup', e => { this.keys[e.key] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  },
  keys: {},
  updateCursor() {
    const cv = $('view');
    if (this.mode) { cv.style.cursor = 'crosshair'; return; }
    const h = R.hover, units = this.myUnits();
    let c = '';
    if (h && units.length) {
      if (h.owner >= 0 && isEnemy(G.human, h.owner)) c = 'crosshair';
      else if (h.k === 'r' || (h.k === 'u' && h.owner === -1)) c = 'cell';
      else if (h.k === 'b' && h.owner === G.human) c = 'pointer';
    } else if (h) c = 'pointer';
    if (cv.style.cursor !== c) cv.style.cursor = c;
  },
  // --- touch ---
  touchDown(e) {
    const n = this.ptrs.size;
    if (n === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: R.cam.z, cx: R.cam.x, cy: R.cam.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; this.tpan = null; R.box = null; return; }
    this.tpan = { x: e.offsetX, y: e.offsetY, cx: R.cam.x, cy: R.cam.y, moved: false, t: performance.now() };
    clearTimeout(this.lpT);
    this.lpT = setTimeout(() => { if (this.tpan && !this.tpan.moved) { this.tpan.box = true; Audio2.sfx('click'); } }, 450);
  },
  touchMove(e) {
    if (this.ptrs.size >= 2 && this.pinch) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      R.cam.z = clamp(this.pinch.z * d / this.pinch.d, .45, 2.2);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      R.cam.x = this.pinch.cx - (mx - this.pinch.mx) / R.cam.z; R.cam.y = this.pinch.cy - (my - this.pinch.my) / R.cam.z;
      R.clampCam(); return;
    }
    const tp = this.tpan; if (!tp) return;
    const x = e.offsetX, y = e.offsetY;
    if (Math.hypot(x - tp.x, y - tp.y) > 10) tp.moved = true;
    if (tp.box || this.boxMode) { if (tp.moved) R.box = { x0: Math.min(tp.x, x), y0: Math.min(tp.y, y), x1: Math.max(tp.x, x), y1: Math.max(tp.y, y) }; return; }
    if (this.mode === 'place') { this.updateGhost(x, y); return; }
    if (tp.moved) { R.cam.x = tp.cx - (x - tp.x) / R.cam.z; R.cam.y = tp.cy - (y - tp.y) / R.cam.z; R.clampCam(); }
  },
  touchUp(e, pt) {
    clearTimeout(this.lpT);
    if (this.ptrs.size >= 1) { this.pinch = null; return; }
    if (this.pinch) { this.pinch = null; return; }
    const tp = this.tpan; this.tpan = null;
    if (!tp) return;
    const x = e.offsetX, y = e.offsetY;
    if (R.box) { this.boxSelect(R.box, false); R.box = null; return; }
    if (tp.moved) return;
    // tap
    if (this.mode === 'place') { this.updateGhost(x, y); this.placeAt(false); return; }
    if (this.mode) { const [wx, wy] = R.toWorld(x, y); this.applyMode(wx, wy, R.pick(x, y), false); return; }
    const hit = R.pick(x, y);
    const units = this.myUnits(), blds = this.myBlds();
    if (hit && hit.owner === G.human && (hit.k === 'u' || !units.length || (hit.k === 'b' && hit.built && !units.some(isVil) && !(B[hit.type].garrison)))) {
      const now = performance.now();
      const dbl = this.lastClick.id === hit.id && now - this.lastClick.t < 400;
      this.lastClick = { t: now, id: hit.id };
      this.clickSelect(x, y, false, dbl); return;
    }
    if (units.length || blds.length) { this.command(x, y, false, false); return; }
    this.clickSelect(x, y, false, false);
    void pt;
  },
  bindMinimap(mc) {
    const act = (e, right) => {
      if (this.screen !== 'game' || !G) return;
      const r = mc.getBoundingClientRect();
      const [wx, wy] = R.miniToWorld(mc, e.clientX - r.left, e.clientY - r.top);
      if (wx < 0 || wy < 0 || wx > G.N || wy > G.N) return;
      if (right) {
        const units = this.myUnits();
        if (units.length) { Cmd.move(units, wx, wy, { shift: e.shiftKey, amove: this.mode === 'amove' }); this.cancelMode(); Audio2.ack(units[0], false); R.marks.push({ x: wx, y: wy, t: R.t, col: 'rgba(140,255,140,A)' }); }
        else for (const b of this.myBlds()) Cmd.rally(b, wx, wy, 0);
      } else R.centerOn(wx, wy);
    };
    let drag = false;
    mc.addEventListener('contextmenu', e => e.preventDefault());
    mc.addEventListener('pointerdown', e => { Audio2.ensure(); if (e.button === 2 || (e.pointerType === 'touch' && (this.myUnits().length || this.mode))) { act(e, true); return; } drag = true; mc.setPointerCapture(e.pointerId); act(e, false); });
    mc.addEventListener('pointermove', e => { if (drag) act(e, false); });
    mc.addEventListener('pointerup', () => { drag = false; });
  },
  key(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    this.keys[e.key] = true;
    if (this.screen !== 'game' || !G) { if (e.key === 'Escape' && !$('modal').hidden) this.closeModal(); return; }
    const k = e.key;
    if (k === 'Escape') {
      if (!$('modal').hidden) { this.closeModal(); return; }
      if (this.mode) { this.cancelMode(); this.wallStart = null; return; }
      if (this.page !== 'main') { this.page = 'main'; return; }
      if (this.sel.length) { this.sel = []; this.updateCmdGrid(); return; }
      this.pauseMenu(); return;
    }
    if (!$('modal').hidden) return;
    if (k === 'F10') { e.preventDefault(); this.pauseMenu(); return; }
    if (k === 'F3' || k === 'p' || k === 'P' || k === 'Pause') { e.preventDefault(); this.togglePause(); return; }
    if (k === '+' || k === '=') { this.cycleSpeed(1); return; }
    if (k === '-' || k === '_') { this.cycleSpeed(-1); return; }
    if (/^[0-9]$/.test(k)) {
      const n = +k;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.groups[n] = this.sel.filter(id => { const x = byId(id); return x && x.owner === G.human; }); this.feed(t('msg.group', { n }), 'info'); return; }
      const g = (this.groups[n] || []).filter(id => { const x = byId(id); return x && !x.dead && !x.gIn; });
      if (!g.length) return;
      const now = performance.now();
      if (this.lastGroup === n && now - this.lastGroupT < 400) { const f = byId(g[0]); R.centerOn(f.x + (f.w || 0) / 2, f.y + (f.h || 0) / 2); }
      this.lastGroup = n; this.lastGroupT = now;
      this.select(g, e.shiftKey); return;
    }
    if (k === '.') { this.nextIdle(); return; }
    if (k === ' ') { e.preventDefault(); const a = G.players[G.human].lastAttack; if (a) R.centerOn(a.x, a.y); return; }
    if (k === 'Delete') { const ents = this.sel.map(byId).filter(x => x && x.owner === G.human); if (ents.length) { Cmd.del(ents); this.sel = []; } return; }
    if (k === 'h' || k === 'H') { const tcs = G.blds.filter(b => !b.dead && b.owner === G.human && b.type === 'tc'); if (tcs.length) { this.tcI = ((this.tcI || 0) + 1) % tcs.length; const b = tcs[this.tcI]; this.select([b.id], false); R.centerOn(b.x + 2, b.y + 2); } return; }
    if (k.startsWith('Arrow')) return;
    const gi = GRID_KEYS.indexOf(k.toUpperCase());
    if (gi >= 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.updateCmdGrid();
      // when a unit selection has "A" (attack-move) mapped to Q, also accept the classic A
      if (k.toUpperCase() === 'A' && this.myUnits().length && !this.myUnits().every(isVil) && this.slots[5] && this.slots[5].name === t('stance.agg') && !e.shiftKey) { this.setMode('amove'); return; }
      if (this.slots[gi]) { e.preventDefault(); this.slotClick(gi, e.shiftKey, false); }
    }
  },
  scrollCamera(dt) {
    if (this.screen !== 'game' || !G) return;
    const sp = 900 * Settings.scroll * dt / R.cam.z;
    let dx = 0, dy = 0;
    if (this.keys.ArrowLeft) dx -= 1; if (this.keys.ArrowRight) dx += 1; if (this.keys.ArrowUp) dy -= 1; if (this.keys.ArrowDown) dy += 1;
    const ed = this.edge;
    if (Settings.edge && ed && ed.in && !document.body.classList.contains('touch') && $('modal').hidden && this.mode !== 'place') {
      const m = 6, W = window.innerWidth, H = window.innerHeight;
      if (ed.x < m) dx -= 1; if (ed.x > W - m) dx += 1; if (ed.y < m) dy -= 1; if (ed.y > H - m) dy += 1;
    }
    if (dx || dy) { R.cam.x += dx * sp; R.cam.y += dy * sp * .7; R.clampCam(); }
  },
  // ---------------- events / notifications ----------------
  feed(text, cls) {
    const el = document.createElement('div');
    el.className = 'msg ' + (cls || '');
    el.textContent = text;
    const f = $('feed');
    f.appendChild(el);
    while (f.children.length > 6) f.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 7000);
    setTimeout(() => el.remove(), 8000);
  },
  showBanner(text, sub, dur) {
    const b = $('banner');
    b.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
    b.hidden = false;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.hidden = true; }, (dur || 4) * 1000);
  },
  processEvents() {
    if (!G || !G.events.length) return;
    const H = G.human;
    const evs = G.events; G.events = [];
    if (G.cfg.attract) return;
    for (const ev of evs) {
      if (ev.p !== -1 && ev.p !== H) continue;
      const pos = ev.x != null ? { x: ev.x, y: ev.y } : null;
      switch (ev.k) {
        case 'underAttack': case 'vilAttacked': case 'bldAttacked':
          this.feed(t('msg.' + ev.k), 'bad'); R.pings.push({ x: ev.x, y: ev.y, t: R.t }); Audio2.sfx('alert'); break;
        case 'bldDone': this.feed(t('msg.bldDone', { bld: nameOf(ev.type) }), 'good'); Audio2.sfx('built'); break;
        case 'researched': this.feed(t('msg.researched', { tech: techName(ev.tech) }), 'info'); Audio2.sfx('research'); break;
        case 'ageUp':
          if (ev.owner === H) { this.showBanner(t('msg.ageUpYou', { age: ageName(ev.age) }), civName(G.players[H].civ)); Audio2.sfx('fanfare'); }
          else this.feed(t('msg.ageUp', { player: pname(ev.owner), age: ageName(ev.age) }), 'info');
          break;
        case 'housed': this.feed(t('msg.housed'), 'bad'); Audio2.sfx('error'); break;
        case 'popMax': this.feed(t('msg.popMax'), 'info'); break;
        case 'farmGone': this.feed(t('msg.farmGone'), 'info'); break;
        case 'converted': this.feed(t('msg.converted'), 'bad'); break;
        case 'relicStored': this.feed(t('msg.relicStored'), 'good'); break;
        case 'wonderBuilt': this.feed(t('msg.wonderBuilt', { player: pname(ev.owner), time: fmtTime(G.cfg.wonderTime || 300) }), ev.owner === H || allied(ev.owner, H) ? 'good' : 'bad'); this.showBanner(t('msg.wonderBuiltB', { player: pname(ev.owner) }), '', 4); Audio2.sfx('fanfare'); break;
        case 'wonderLost': this.feed(t('msg.wonderLost'), 'info'); break;
        case 'relicsAll': this.feed(t('msg.relicsAll', { player: pname(ev.owner) }), 'info'); break;
        case 'relicsLost': this.feed(t('msg.relicsLost'), 'info'); break;
        case 'defeated': this.feed(t('msg.defeated', { player: pname(ev.owner) }), ev.owner === H ? 'bad' : 'info'); break;
        case 'tribute': this.feed(t('msg.tribute', { player: pname(ev.from), amt: ev.amt, res: t('res.' + ev.res) }), 'good'); break;
        case 'bldLost': if (['tc', 'castle', 'wonder', 'monastery'].includes(ev.type)) this.feed(t('msg.bldLost', { bld: nameOf(ev.type) }), 'bad'); break;
        case 'victory': case 'defeat':
          this.showBanner(t(ev.k === 'victory' ? 'end.victory' : 'end.defeat'), '', 6);
          Audio2.sfx(ev.k === 'victory' ? 'victory' : 'defeat');
          this.pendingEnd = performance.now() + 3500; break;
      }
      void pos;
    }
  },
  // ---------------- objectives / tutorial ----------------
  updateObjectives(force) {
    const box = $('objectives');
    if (!G || !G.cfg.tutorial) { box.hidden = true; document.body.classList.remove('has-tut'); return; }
    const p = G.players[G.human];
    let step = G.tutStep || 0;
    while (step < TUT.length && TUT[step].check(p)) { step++; if (step < TUT.length) { Audio2.sfx('research'); } }
    if (step !== G.tutStep || force) {
      G.tutStep = step;
      if (step >= TUT.length) G.tutDone = true;
      const advanced = !force && step !== G.tutStep;
      G.tutStep = step;
      if (step >= TUT.length) G.tutDone = true;
      box.hidden = false;
      document.body.classList.add('has-tut');
      if (this.tutCollapsed == null) { const saved = store('eok.tutCollapsed'); this.tutCollapsed = saved != null ? !!saved : window.innerWidth <= 760; }
      box.classList.toggle('collapsed', this.tutCollapsed);
      const cur = TUT[Math.min(step, TUT.length - 1)];
      const curText = step < TUT.length ? t('tut.' + cur.k) : t('tut.done');
      box.innerHTML = `<div class="tut-head"><div class="eyebrow">${t('menu.tutorial')} · ${Math.min(step + 1, TUT.length)}/${TUT.length}</div>` +
        `<button class="tut-tog" data-a="tut-toggle" aria-expanded="${!this.tutCollapsed}">${this.tutCollapsed ? t('tut.show') + ' ▾' : t('tut.hide') + ' ▴'}</button></div>` +
        `<div class="tut-cur">▸ ${curText}</div>` +
        `<div class="tut-body"><h3>${t('tut.title')}</h3>` +
        TUT.map((s, i) => `<div class="obj ${i < step ? 'done' : ''}" ${i > step ? 'style="opacity:.45"' : ''}><span>${i < step ? '✓' : i === step ? '▸' : '·'}</span><span>${t('tut.' + s.k)}</span></div>`).join('') +
        (step < TUT.length ? `<div class="hint">${t('tut.' + cur.k + '.h')}</div>` : `<div class="hint">${t('tut.done')}</div>`) + `</div>`;
      if (advanced) { box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse'); }
    }
  },
  toggleTutorial() {
    this.tutCollapsed = !this.tutCollapsed;
    store('eok.tutCollapsed', this.tutCollapsed);
    Audio2.sfx('click');
    this.updateObjectives(true);
  },
  // ---------------- modals: tech tree, scores, end ----------------
  showTechTree() {
    const p = G.players[G.human];
    const rows = ['tc', 'barracks', 'archery', 'stable', 'siege', 'castle', 'monastery', 'blacksmith', 'university', 'mill', 'lumber', 'mining', 'dock', 'market', 'tower'];
    const cell = (b, a) => {
      const items = [];
      for (const key of B[b].trains) {
        const list = key === 'uu' ? [CIVS[p.civ].uu] : LINES[key] ? LINES[key] : [key];
        for (const tp of list) if (U[tp].age === a) items.push({ k: 'u', tp });
      }
      for (const id of B[b].techs) if (T[id].age === a && !T[id].ageUp) items.push({ k: 't', id });
      if (b === 'tc' && a > 0) items.unshift({ k: 't', id: ['', 'feudal', 'castle', 'imperial'][a] });
      return items.map(it => {
        if (it.k === 'u') {
          const has = p.cnt[it.tp] > 0 || p.line[U[it.tp].line] === it.tp || it.tp === CIVS[p.civ].uu && p.age >= 2;
          const lock = p.age < U[it.tp].age;
          return `<button class="tnode ${has ? 'done' : ''} ${lock ? 'lock' : ''}" data-tip="u:${it.tp}" aria-label="${esc(nameOf(it.tp))}"><img src="${iconURL('unit', it.tp, p.color)}" alt=""></button>`;
        }
        const tt = T[it.id]; const done = p.techs[it.id]; const lock = p.age < tt.age;
        return `<button class="tnode ${done ? 'done' : ''} ${lock ? 'lock' : ''}" data-tip="t:${it.id}" aria-label="${esc(techName(it.id))}"><img src="${iconURL('tech', tt.ageUp ? 'age' + tt.ageUp : tt.icon, 0)}" alt=""></button>`;
      }).join('');
    };
    this.modal(`${this.head(t('hud.techtree'), civName(p.civ))}<div class="sheet-body">
      <div class="legend" style="margin-bottom:10px"><span><i style="box-shadow:0 0 0 2px var(--good)"></i>${t('tree.done')}</span><span><i style="background:#666"></i>${t('tree.locked')}</span><span>${t('tree.hint')}</span></div>
      <div class="scroll-x"><div class="tree">
        <div class="tree-row head"><div></div>${[0, 1, 2, 3].map(a => `<div>${ageName(a)}</div>`).join('')}</div>
        ${rows.map(b => `<div class="tree-row"><div class="tree-b"><img src="${iconURL('bld', b, CIVS[p.civ].arch)}" alt="">${nameOf(b)}</div>${[0, 1, 2, 3].map(a => `<div class="tree-c">${cell(b, a)}</div>`).join('')}</div>`).join('')}
      </div></div></div>`, (e, el) => { void el; });
    const m = $('modal');
    m.onmouseover = e => { const n = e.target.closest('[data-tip]'); if (!n) return; const [k, id] = n.dataset.tip.split(':'); this.showTip(n, k === 'u' ? `<div class="tt-t">${esc(nameOf(id))}</div>${costHTML(ST(p.id, id).cost, p)}${unitDesc(p, id)}` : `<div class="tt-t">${esc(techName(id))}</div>${costHTML(techCost(p, id), p)}<ul>${T[id].fx.map(f => `<li>${describeFx(f)}</li>`).join('')}</ul>`); };
    m.onmouseout = e => { if (e.target.closest('[data-tip]')) this.hideTip(); };
  },
  showScores() {
    const H = G.human, me = G.players[H];
    const rows = G.players.map(p => {
      const sc = calcScore(p);
      const rel = p.id === H ? t('dip.you') : allied(H, p.id) ? t('dip.ally') : t('dip.enemy');
      const trib = allied(H, p.id) && p.id !== H && p.alive ? `<span class="confirm">${['food', 'wood', 'gold', 'stone'].map(r => `<button class="btn small" data-a="trib" data-p="${p.id}" data-r="${r}" title="${t('cmd.tribute')} 100 ${t('res.' + r)}">${SVG[r]}</button>`).join('')}</span>` : '';
      return `<tr><td><span class="pdot" style="background:${PCOLORS[p.color].c}"></span>${esc(p.name)}</td><td>${civName(p.civ)}</td><td>${p.team ? t('dip.team', { n: p.team }) : '—'}</td><td>${p.alive ? rel : t('dip.defeated')}</td><td>${ageName(p.age)}</td><td class="r">${p.pop}</td><td class="r"><b>${sc.total}</b></td><td>${trib}</td></tr>`;
    }).join('');
    this.modal(`${this.head(t('hud.score'))}<div class="sheet-body"><div class="scroll-x"><table class="tbl"><thead><tr><th>${t('end.player')}</th><th>${t('setup.civ')}</th><th>${t('setup.team')}</th><th>${t('dip.status')}</th><th>${t('dip.age')}</th><th class="r">${t('res.pop')}</th><th class="r">${t('end.score')}</th><th>${me.cnt.market ? t('cmd.tribute') : ''}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted small">${me.cnt.market ? t('dip.tribHelp', { pct: Math.round(me.tributeFee * 100) }) : t('dip.needMarket')}</p></div>`, (e, el) => {
      if (el && el.dataset.a === 'trib') { const ok = Cmd.tribute(me, +el.dataset.p, el.dataset.r, 100); Audio2.sfx(ok ? 'click' : 'error'); if (!ok) this.feed(t('msg.notEnough'), 'bad'); }
    });
  },
  showEnd() {
    if (this.endShown) return;
    this.endShown = true;
    const H = G.human;
    const won = H >= 0 && teamKey(H) === G.winner;
    this.endTab = 'summary';
    const render = () => {
      const tab = this.endTab;
      const ps = G.players;
      let body = '';
      const hdr = cols => `<thead><tr><th>${t('end.player')}</th>${cols.map(c => `<th class="r">${c}</th>`).join('')}</tr></thead>`;
      const row = (p, vals) => `<tr><td><span class="pdot" style="background:${PCOLORS[p.color].c}"></span>${esc(p.name)} <span class="muted small">${civName(p.civ)}</span></td>${vals.map(v => `<td class="r">${v}</td>`).join('')}</tr>`;
      if (tab === 'summary') body = `<table class="tbl">${hdr([t('end.military'), t('end.economy'), t('end.technology'), t('end.society'), t('end.score')])}<tbody>${ps.map(p => { const s = calcScore(p); return row(p, [s.mil, s.eco, s.tech, s.soc, `<b>${s.total}</b>`]); }).join('')}</tbody></table>`;
      if (tab === 'military') body = `<table class="tbl">${hdr([t('end.unitsKilled'), t('end.unitsLost'), t('end.bldRazed'), t('end.bldLost'), t('end.conversions'), t('end.trained')])}<tbody>${ps.map(p => row(p, [p.st.killsU, p.st.lostU, p.st.razed, p.st.lostB, p.st.conv, p.st.trained])).join('')}</tbody></table>`;
      if (tab === 'economy') body = `<table class="tbl">${hdr([t('res.food'), t('res.wood'), t('res.gold'), t('res.stone'), t('end.trib'), t('end.built')])}<tbody>${ps.map(p => row(p, [...RES.map(r => Math.round(p.st.gath[r])), p.st.trib, p.st.built])).join('')}</tbody></table>`;
      if (tab === 'technology') body = `<table class="tbl">${hdr([t('end.techs'), ageName(1), ageName(2), ageName(3), t('end.wonders')])}<tbody>${ps.map(p => row(p, [p.st.techs, ...[1, 2, 3].map(a => p.st.ageT[a] != null ? fmtTime(p.st.ageT[a]) : '—'), p.st.wonders])).join('')}</tbody></table>`;
      if (tab === 'timeline') body = `<canvas class="chart" id="chart" width="900" height="280"></canvas>`;
      $('endBody').innerHTML = `<div class="scroll-x">${body}</div>`;
      if (tab === 'timeline') drawTimeline($('chart'));
      for (const b of $('modal').querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    };
    this.modal(`<div class="endhead ${won ? '' : 'lost'}"><div class="eyebrow">${fmtTime(G.time)} · ${t('map.' + G.mapType)}</div><h1>${t(won ? 'end.victory' : 'end.defeat')}</h1><p class="muted">${t(won ? 'end.wonText' : 'end.lostText')}</p></div>
      <div class="sheet-body"><div class="tabs" style="margin-bottom:12px">${['summary', 'military', 'economy', 'technology', 'timeline'].map(k => `<button data-a="tab" data-tab="${k}">${t('end.' + k)}</button>`).join('')}</div><div id="endBody"></div></div>
      <div class="sheet-foot"><button class="btn ghost" data-a="watch">${t('end.continue')}</button><button class="btn primary" data-a="menu">${t('end.menu')}</button></div>`, (e, el) => {
      if (!el) return;
      if (el.dataset.a === 'tab') { this.endTab = el.dataset.tab; render(); }
      if (el.dataset.a === 'watch') this.closeModal();
      if (el.dataset.a === 'menu') { this.onModalClose = null; this.closeModal(); quitToMenu(); }
    });
    render();
  },
};

function resIcon(type) { return iconURL('res', type, 0); }
// resource portraits reuse the sprite art
const _iconURL = iconURL;
iconURL = function (kind, id, col) {
  if (kind !== 'res') return _iconURL(kind, id, col);
  const key = 'I|res|' + id;
  const hit = Art.cache.get(key);
  if (hit) return hit;
  const S = 64, cv = mkCanvas(S, S), c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#3a4a2a'); g.addColorStop(1, '#22301a'); c.fillStyle = g; c.fillRect(0, 0, S, S);
  const sp = id === 'tree' ? treeSprite(1, 'leaf') : id === 'carcass' ? corpseSprite('deer', 6) : id === 'fish' ? null : resSprite(id, 1);
  if (sp) { const sc = Math.min(S / sp.w, S / sp.h) * (id === 'tree' ? .95 : 1.3); c.drawImage(sp.c, S / 2 - sp.ax * sc, S * .92 - sp.ay * sc, sp.w * sc, sp.h * sc); }
  else { c.fillStyle = '#2a5a7a'; c.fillRect(0, 0, S, S); c.fillStyle = '#9fd6f0'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(16 + i * 9, 26 + (i % 2) * 12, 7, 3, .3, 0, 7); c.fill(); } }
  const url = cv.toDataURL(); Art.cache.set(key, url); return url;
};

function unitDesc(p, type) {
  const s = ST(p.id, type), d = U[type];
  let h = `<div class="stats" style="margin:4px 0">♥ ${s.hp} &nbsp;${SVG.atk}${s.atk}${s.shots > 1 ? '×' + s.shots : ''} &nbsp;${SVG.armM}${s.armM} &nbsp;${SVG.armP}${s.armP}${s.rng ? ' &nbsp;' + SVG.rng + s.rng : ''} &nbsp;${SVG.spd}${s.spd.toFixed(2)}</div>`;
  const strong = Object.keys(s.bonus).filter(k => s.bonus[k] > 0 && k !== 'animal');
  if (type === 'villager') h += `<div>${t('role.villager')}</div>`;
  else if (type === 'monk') h += `<div>${t('role.monk')}</div>`;
  else if (type === 'fishingShip') h += `<div>${t('role.fishingShip')}</div>`;
  if (strong.length) h += `<div><span class="muted">${t('tt.strong')}:</span> ${strong.map(k => t('cls.' + k)).join(', ')}</div>`;
  if (d.weak && d.weak.length) h += `<div><span class="muted">${t('tt.weak')}:</span> ${d.weak.map(k => t('cls.' + k)).join(', ')}</div>`;
  if (d.area) h += `<div class="muted">${t('tt.area')}</div>`;
  if (d.onlyBld) h += `<div class="muted">${t('tt.onlyBld')}</div>`;
  return h;
}
function bldDesc(p, type) {
  const d = B[type], s = ST(p.id, type);
  const parts = [];
  parts.push(`<div class="muted">♥ ${s.hp}${s.pop ? ' · ' + t('tt.housing', { n: s.pop }) : ''}${d.garrison ? ' · ' + t('tt.garrison') + ' ' + d.garrison : ''}</div>`);
  parts.push(`<div>${t('bldd.' + type)}</div>`);
  if (d.drop.length) parts.push(`<div class="muted">${t('tt.dropoff')}: ${d.drop.map(r => t('res.' + r)).join(', ')}</div>`);
  return parts.join('');
}
function civCard(c) {
  const C = CIVS[c], uu = C.uu;
  const s = U[uu];
  return `<div class="civcard"><div><div class="eyebrow">${t('civ.' + c + '.r')}</div><h3>${civName(c)}</h3><p class="muted small" style="margin:4px 0 0">${t('civ.' + c + '.d')}</p></div>
    <ul>${C.fx.map(f => `<li>${describeFx(f)}</li>`).join('')}</ul>
    <div class="uu"><img src="${iconURL('unit', uu, 0)}" alt=""><div><div class="eyebrow">${t('setup.uniqueUnit')}</div><b>${nameOf(uu)}</b><div class="muted small">♥ ${s.hp} · ${t('stat.atk')} ${s.atk} · ${s.armM}/${s.armP}${s.rng ? ' · ' + t('stat.rng') + ' ' + s.rng : ''}</div><div class="small">${t('uu.' + uu)}</div></div></div></div>`;
}
function drawTimeline(cv) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, pad = 40;
  ctx.clearRect(0, 0, W, H);
  const ps = G.players;
  let maxT = 1, maxS = 10;
  for (const p of ps) for (const h of p.st.hist) { maxT = Math.max(maxT, h[0]); maxS = Math.max(maxS, h[1]); }
  maxS = Math.ceil(maxS / 100) * 100;
  ctx.strokeStyle = 'rgba(195,154,92,.18)'; ctx.fillStyle = '#a9a290'; ctx.font = '12px "Alegreya Sans", sans-serif'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = H - pad - (H - pad * 1.6) * i / 4; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - 12, y); ctx.stroke(); ctx.fillText(String(Math.round(maxS * i / 4)), 4, y + 4); }
  for (let i = 0; i <= 5; i++) { const x = pad + (W - pad - 12) * i / 5; ctx.fillText(fmtTime(maxT * i / 5), x - 14, H - 14); }
  for (const p of ps) {
    if (!p.st.hist.length) continue;
    ctx.strokeStyle = PCOLORS[p.color].c; ctx.lineWidth = 2.2; ctx.beginPath();
    p.st.hist.forEach((h, i) => { const x = pad + (W - pad - 12) * h[0] / maxT, y = H - pad - (H - pad * 1.6) * h[1] / maxS; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    const last = p.st.hist[p.st.hist.length - 1];
    const x = pad + (W - pad - 12) * last[0] / maxT, y = H - pad - (H - pad * 1.6) * last[1] / maxS;
    ctx.fillStyle = PCOLORS[p.color].c; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0e8d6'; ctx.fillText(p.name, Math.min(x + 6, W - 80), y - 6);
  }
}

// ------------------------------------------------------------
// Tutorial objectives
// ------------------------------------------------------------
const TUT = [
  { k: 'select', check: p => UI.sel.some(id => { const u = byId(id); return u && u.type === 'villager' && u.owner === p.id; }) },
  { k: 'food', check: p => p.gathN.food >= 2 },
  { k: 'vil', check: p => p.vil >= 6 },
  { k: 'house', check: p => (p.cnt.house || 0) >= 2 },
  { k: 'wood', check: p => (p.cnt.lumber || 0) >= 1 && p.gathN.wood >= 3 },
  { k: 'farm', check: p => (p.cnt.mill || 0) >= 1 && (p.cnt.farm || 0) >= 1 },
  { k: 'barracks', check: p => (p.cnt.barracks || 0) >= 1 },
  { k: 'army', check: p => ((p.cnt.militia || 0) + (p.cnt.manAtArms || 0) + (p.cnt.spearman || 0)) >= 4 },
  { k: 'feudal', check: p => p.age >= 1 },
  { k: 'archers', check: p => (p.cnt.archer || 0) + (p.cnt.skirmisher || 0) >= 3 },
  { k: 'attack', check: () => G.players.filter(q => q.id !== G.human).every(q => !q.alive) },
];
