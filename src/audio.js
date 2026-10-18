'use strict';
// ============================================================
//  Audio: synthesised effects and a generative score
// ============================================================
const SCALES = {
  pelog: [0, 1, 3, 7, 8], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], pentatonic: [0, 2, 4, 7, 9],
  insen: [0, 1, 5, 7, 10], hijaz: [0, 1, 4, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], gong: [0, 2, 4, 7, 9],
};
const BELL_SCALES = { pelog: 1, insen: 1, gong: 1, pentatonic: 1 };
const Audio2 = {
  ctx: null, master: null, sfxG: null, musG: null, last: {}, mus: null, noiseBuf: null,
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { }); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(this.master);
      this.sfxG = c.createGain(); this.sfxG.connect(comp);
      this.musG = c.createGain(); this.musG.connect(comp);
      // shared delay for music
      this.delay = c.createDelay(1); this.delay.delayTime.value = .36;
      this.fb = c.createGain(); this.fb.gain.value = .32;
      this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.musG);
      const len = c.sampleRate * 1.5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.applyVolumes();
      this.startMusic(this.pendingCiv || 'majapahit');
    } catch (e) { this.ctx = null; }
  },
  applyVolumes() {
    if (!this.ctx) return;
    this.sfxG.gain.value = Settings.sfx;
    this.musG.gain.value = Settings.music * .55;
  },
  // ---- primitives ----
  tone(f, dur, type, vol, when, f2, dest, att) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + (att || .005)); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur);
    o.connect(g); g.connect(dest || this.out || this.sfxG);
    o.start(t0); o.stop(t0 + dur + .05);
  },
  noise(dur, ftype, freq, q, vol, when, f2, dest) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t0); f.Q.value = q || 1;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.out || this.sfxG);
    s.start(t0, Math.random() * .5); s.stop(t0 + dur + .05);
  },
  sfx(name, vol, pan) {
    if (!this.ctx || Settings.sfx <= 0) return;
    const now = this.ctx.currentTime;
    const gap = { chop: .09, mine: .09, hammer: .09, sword: .05, bow: .05, die: .08 }[name] || .04;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    vol = vol == null ? 1 : vol;
    let dest = this.sfxG;
    if (pan) { try { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(this.sfxG); dest = p; } catch (e) { } }
    const g = this.ctx.createGain(); g.gain.value = vol; g.connect(dest);
    this.out = g;
    switch (name) {
      case 'click': this.tone(880, .05, 'triangle', .12); break;
      case 'error': this.tone(220, .09, 'square', .07); this.tone(165, .14, 'square', .07, .08); break;
      case 'queue': this.tone(660, .06, 'triangle', .12); this.tone(990, .08, 'triangle', .08, .04); break;
      case 'place': this.noise(.15, 'lowpass', 400, 1, .4); this.tone(110, .14, 'sine', .3); break;
      case 'built': [523, 659, 784].forEach((f, i) => this.tone(f, .5, 'triangle', .12, i * .07)); break;
      case 'research': [660, 880, 1046].forEach((f, i) => this.tone(f, .35, 'sine', .1, i * .06)); break;
      case 'fanfare': [[392, 0, .22], [523, .18, .22], [659, .36, .22], [784, .54, .7]].forEach(([f, w, d]) => { this.tone(f, d, 'sawtooth', .07, w, null, null, .02); this.tone(f * 1.005, d, 'square', .03, w); }); break;
      case 'victory': [[523, 0, .3], [659, .25, .3], [784, .5, .3], [1046, .75, 1.2]].forEach(([f, w, d]) => this.tone(f, d, 'sawtooth', .08, w, null, null, .02)); break;
      case 'defeat': [[392, 0, .5], [349, .4, .5], [311, .8, .5], [262, 1.2, 1.4]].forEach(([f, w, d]) => this.tone(f, d, 'triangle', .12, w)); break;
      case 'alert': this.tone(196, .42, 'sawtooth', .1, 0, 190, null, .05); this.tone(233, .55, 'sawtooth', .1, .45, 228, null, .05); this.noise(.4, 'lowpass', 700, 1, .05); break;
      case 'chop': this.noise(.06, 'bandpass', 1300, 4, .5); this.tone(170, .05, 'square', .06); break;
      case 'mine': this.tone(2400, .08, 'triangle', .1); this.tone(3150, .06, 'sine', .06); break;
      case 'hammer': this.noise(.04, 'bandpass', 900, 3, .4); this.tone(320, .04, 'square', .05); break;
      case 'sword': this.noise(.07, 'highpass', 3000, 1, .25); this.tone(1800 + Math.random() * 300, .12, 'square', .03); this.tone(2700, .1, 'sine', .04); break;
      case 'hitBld': this.noise(.12, 'lowpass', 600, 1, .35); break;
      case 'ram': this.noise(.25, 'lowpass', 220, 1, .7); this.tone(70, .25, 'sine', .4); break;
      case 'bow': this.noise(.12, 'bandpass', 2600, 3, .25, 0, 700); break;
      case 'gun': this.noise(.3, 'lowpass', 1400, 1, .8, 0, 300); this.tone(80, .25, 'sine', .4); break;
      case 'catapult': this.tone(130, .15, 'sawtooth', .06, 0, 90); this.noise(.35, 'bandpass', 900, 2, .2, .05, 300); break;
      case 'impact': this.noise(.35, 'lowpass', 500, 1, .6); this.tone(60, .3, 'sine', .4); break;
      case 'collapse': case 'crash': this.noise(1.1, 'lowpass', 380, 1, .8, 0, 120); this.noise(.6, 'highpass', 2500, 1, .15, .1); this.tone(55, .8, 'sine', .3); break;
      case 'die': this.noise(.12, 'bandpass', 500 + Math.random() * 300, 2, .25); break;
      case 'thud': this.tone(90, .12, 'sine', .25); break;
      case 'trained': this.tone(784, .12, 'sine', .08); this.tone(1046, .16, 'sine', .06, .06); break;
      case 'garrison': this.tone(300, .06, 'square', .05); this.tone(220, .08, 'square', .05, .06); break;
      case 'relic': this.tone(1318, .5, 'sine', .08); this.tone(1760, .7, 'sine', .06, .08); break;
      case 'wololo': this.wololo(); break;
      case 'sel_vil': this.tone(660, .07, 'triangle', .1); this.tone(880, .09, 'triangle', .07, .05); break;
      case 'sel_mil': this.tone(220, .08, 'square', .06); this.tone(330, .1, 'square', .05, .06); break;
      case 'sel_cav': this.noise(.12, 'bandpass', 700, 2, .2); this.tone(260, .1, 'square', .05, .05); break;
      case 'sel_siege': this.tone(110, .2, 'sawtooth', .06, 0, 95); break;
      case 'sel_monk': this.tone(1046, .6, 'sine', .08); this.tone(2830, .3, 'sine', .02); break;
      case 'sel_ship': this.tone(147, .35, 'sawtooth', .05, 0, 140, null, .04); break;
      case 'sel_bld': this.tone(392, .07, 'triangle', .08); break;
      case 'ack': this.tone(523, .06, 'triangle', .08); this.tone(784, .07, 'triangle', .06, .05); break;
      case 'ackAtk': this.tone(330, .07, 'square', .06); this.tone(440, .09, 'square', .06, .05); break;
    }
    this.out = null;
  },
  wololo() {
    const c = this.ctx, t0 = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
    const g = c.createGain(); g.gain.value = 0;
    o.connect(f); o.connect(f2); f.connect(g); f2.connect(g); g.connect(this.out || this.sfxG);
    const syl = [[0, .26, 140, 420, 700], [.28, .2, 165, 600, 1000], [.5, .32, 150, 600, 1000]];
    for (const [s, d, pitch, fa, fb] of syl) {
      o.frequency.setValueAtTime(pitch, t0 + s); o.frequency.linearRampToValueAtTime(pitch * 1.06, t0 + s + d);
      f.frequency.setValueAtTime(fa * .7, t0 + s); f.frequency.linearRampToValueAtTime(fa, t0 + s + d);
      f2.frequency.setValueAtTime(fb * .8, t0 + s); f2.frequency.linearRampToValueAtTime(fb * 1.2, t0 + s + d);
      g.gain.setValueAtTime(0, t0 + s); g.gain.linearRampToValueAtTime(.5, t0 + s + .04); g.gain.linearRampToValueAtTime(.35, t0 + s + d - .04); g.gain.linearRampToValueAtTime(0, t0 + s + d);
    }
    o.start(t0); o.stop(t0 + 1);
  },
  select(e) {
    if (!e) return;
    if (e.k === 'b') return this.sfx('sel_bld');
    if (e.k !== 'u') return;
    const d = U[e.type];
    this.sfx(e.type === 'villager' ? 'sel_vil' : e.type === 'monk' ? 'sel_monk' : d.dom === 'w' ? 'sel_ship' : d.cls.includes('siege') ? 'sel_siege' : d.cls.includes('cavalry') ? 'sel_cav' : 'sel_mil');
  },
  ack(u, hostile) { if (u) this.sfx(hostile ? 'ackAtk' : 'ack'); },
  processSfx() {
    if (!G) return;
    const list = G.sfx; G.sfx = [];
    if (!this.ctx || G.cfg.attract) return;
    const hv = G.human >= 0 ? G.vis[G.human] : null;
    let n = 0;
    for (const s of list) {
      if (s.p != null && s.p !== G.human) continue;
      if (hv && G.cfg.reveal !== 'all' && hv[tIdx(s.x, s.y)] !== 2) continue;
      const [sx, sy] = R.toScreen(s.x, s.y);
      const dx = sx - R.W / 2, dy = sy - R.H / 2;
      const dd = Math.hypot(dx, dy / .6) / Math.max(R.W, 600);
      if (dd > .9) continue;
      if (s.s === 'trained' && s.p !== G.human) continue;
      this.sfx(s.s, clamp(1.1 - dd * 1.1, .1, 1) * (s.s === 'chop' || s.s === 'mine' || s.s === 'hammer' ? .5 : 1), dx / (R.W / 2) * .6);
      if (++n > 12) break;
    }
  },
  // ---- generative music ----
  startMusic(civ) {
    this.pendingCiv = civ;
    if (!this.ctx) return;
    const C = CIVS[civ] || CIVS.majapahit;
    const scale = SCALES[C.music] || SCALES.dorian;
    const bell = !!BELL_SCALES[C.music];
    const root = { pelog: 57, dorian: 50, mixolydian: 55, pentatonic: 52, insen: 52, hijaz: 50, phrygian: 52, gong: 55 }[C.music] || 52;
    if (this.mus) clearInterval(this.mus.timer);
    const m = this.mus = { scale, bell, root, next: this.ctx.currentTime + .3, step: 0, deg: 2, bar: 0, phrase: [] };
    m.timer = setInterval(() => this.schedule(), 150);
  },
  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  note(deg, oct) { const m = this.mus, L = m.scale.length; const o = Math.floor(deg / L); const s = ((deg % L) + L) % L; return m.root + m.scale[s] + 12 * (o + (oct || 0)); },
  schedule() {
    const c = this.ctx, m = this.mus;
    if (!c || !m || Settings.music <= 0) { if (m && c) m.next = c.currentTime + .2; return; }
    const beat = 60 / 76 / 2;
    while (m.next < c.currentTime + 1.2) {
      const when = m.next - c.currentTime;
      const st = m.step % 16;
      // drone at the start of each bar pair
      if (st === 0 && m.step % 32 === 0) {
        const f = this.midi(m.root - 12), f5 = this.midi(m.root - 5);
        this.pad(f, beat * 32, when); this.pad(f5, beat * 32, when, .5);
      }
      // frame drum / gong pattern
      if (st === 0) { this.drum(when, 1); if (m.bell && m.step % 64 === 0) this.gong(when); }
      if (st === 6 || st === 10) this.drum(when, .45);
      // melody: phrase-based random walk with rests
      if (!m.phrase.length) {
        const len = 8; m.phrase = [];
        for (let i = 0; i < len; i++) { m.deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]; m.deg = clamp(m.deg, 0, m.scale.length * 2); m.phrase.push(Math.random() < .28 ? null : m.deg); }
        m.phrase.push(null, null);
      }
      if (st % 2 === 0) {
        const d = m.phrase.shift();
        if (d != null) { const f = this.midi(this.note(d)); if (m.bell) this.bellNote(f, when); else this.pluck(f, when); }
        if (Math.random() < .18 && d != null) { const f = this.midi(this.note(d - 2, 1)); m.bell ? this.bellNote(f, when + beat, .4) : this.pluck(f, when + beat, .4); }
      }
      m.next += beat; m.step++;
    }
  },
  pad(f, dur, when, k) {
    const c = this.ctx, t0 = c.currentTime + when;
    for (const det of [-3, 3]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; o.detune.value = det;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.05 * (k || 1), t0 + 2.5); g.gain.linearRampToValueAtTime(.0001, t0 + dur);
      o.connect(g); g.connect(this.musG); o.start(t0); o.stop(t0 + dur + .1);
    }
  },
  pluck(f, when, k) {
    const c = this.ctx, t0 = c.currentTime + when;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sawtooth'; o2.frequency.value = f * 2.001;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(2600, t0); fl.frequency.exponentialRampToValueAtTime(500, t0 + .6);
    const g2 = c.createGain(); g2.gain.value = .15;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.12 * (k || 1), t0 + .008); g.gain.exponentialRampToValueAtTime(.0008, t0 + 1.4);
    o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(this.musG); g.connect(this.delay);
    o.start(t0); o2.start(t0); o.stop(t0 + 1.5); o2.stop(t0 + 1.5);
  },
  bellNote(f, when, k) {
    const c = this.ctx, t0 = c.currentTime + when;
    for (const [mul, v, dec] of [[1, .1, 1.8], [2.76, .03, .7], [5.4, .015, .35]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v * (k || 1), t0 + .004); g.gain.exponentialRampToValueAtTime(.0005, t0 + dec);
      o.connect(g); g.connect(this.musG); g.connect(this.delay); o.start(t0); o.stop(t0 + dec + .05);
    }
  },
  drum(when, v) {
    const c = this.ctx, t0 = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(48, t0 + .25);
    g.gain.setValueAtTime(.16 * v, t0); g.gain.exponentialRampToValueAtTime(.0008, t0 + .35);
    o.connect(g); g.connect(this.musG); o.start(t0); o.stop(t0 + .4);
  },
  gong(when) {
    const c = this.ctx, t0 = c.currentTime + when;
    const f = this.midi(this.mus.root - 17);
    for (const [mul, v] of [[1, .07], [1.48, .03], [2.1, .02]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * mul * 1.01, t0); o.frequency.exponentialRampToValueAtTime(f * mul, t0 + 1);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + .02); g.gain.exponentialRampToValueAtTime(.0005, t0 + 4.5);
      o.connect(g); g.connect(this.musG); o.start(t0); o.stop(t0 + 4.6);
    }
  },
};
