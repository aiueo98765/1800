'use strict';
/* ============================================================
   core: ユーティリティ / 保存 / 単語帳 / 間隔反復 / 音声 / UI部品
   ============================================================ */

/* ---------- utils ---------- */
const DAY = 864e5;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad2 = n => String(n).padStart(2, '0');
const dkey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const sod = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const eod = (t = Date.now()) => sod(t) + DAY - 1;
const fmtDue = t => {
  const d = Math.round((sod(t) - sod()) / DAY);
  if (d <= 0) return '今日';
  if (d === 1) return '明日';
  if (d < 31) return `${d}日後`;
  const x = new Date(t); return `${x.getMonth() + 1}/${x.getDate()}`;
};
const fmtDur = ms => { const s = Math.max(0, Math.round(ms / 1000)); const m = Math.floor(s / 60); return m ? `${m}分${pad2(s % 60)}秒` : `${s}秒`; };
const hlEx = ex => esc(ex).replace(/\[([^\]]+)\]/g, '<mark class="hl">$1</mark>');
const blankEx = ex => esc(ex).replace(/\[([^\]]+)\]/g, (_, w) => `<span class="blank" aria-label="空所">${'_'.repeat(Math.max(4, w.length))}</span>`);
const plainEx = ex => String(ex || '').replace(/\[([^\]]+)\]/g, '$1');
const nfmt = n => Number(n).toLocaleString('ja-JP');

const POS = { '動': '動詞', '名': '名詞', '形': '形容詞', '副': '副詞', '代': '代名詞', '前': '前置詞', '接': '接続詞', '助': '助動詞', '他': 'その他' };
const POS_KEYS = ['動', '名', '形', '副', '代', '前', '接', '助', '他'];
const STATUS = { known: '覚えた', unsure: 'まだ怪しい', forgot: '忘れた', new: '未学習' };
const STATUS_KEYS = ['known', 'unsure', 'forgot', 'new'];
const pill = s => `<span class="pill ${s}">${STATUS[s]}</span>`;

/* ---------- 保存（localStorage） ---------- */
const DEFAULT_SETTINGS = () => ({
  theme: 'auto', autoSpeak: true, rate: 0.95, voiceEn: '', voiceJa: '', sfx: true, dailyGoal: 50,
  deck: 'book', deckPicked: false, slowSec: 6, hideIntro: false,
  study: { range: 'all', mode: 'recall', count: 20, order: 'num', loop: true, exam: false, skipKnown: false, from: 1, to: 100 },
  listen: { range: 'all', from: 1, to: 100, order: 'num', enTimes: 2, ja: true, ex: false, gap: 1.5, rate: 0.9, loop: true, blind: false },
  attack: { range: 'all', dir: 'en', from: 1, to: 100 },
  pomo: { focus: 25, short: 5, long: 15, every: 4, auto: false, notify: false },
  gram: { g: 'all', t: 'mix', n: 20 },
});
const Store = (() => {
  const KEY = 't1800:v1';
  const fresh = () => ({
    version: 1, progress: {}, tags: {}, custom: [], settings: DEFAULT_SETTINGS(),
    stats: { daily: {}, ta: { bestCorrect: 0, bestScore: 0, bestCombo: 0, plays: 0 }, pomo: {} },
    ranks: { study: {}, ta: {}, gram: {} }, gram: {},
  });
  let state = fresh();
  function merge(raw) {
    const s = fresh();
    if (!raw || typeof raw !== 'object') return s;
    s.progress = raw.progress && typeof raw.progress === 'object' ? raw.progress : {};
    s.tags = raw.tags && typeof raw.tags === 'object' ? raw.tags : {};
    s.custom = Array.isArray(raw.custom) ? raw.custom : [];
    const rs = raw.settings || {};
    for (const k of Object.keys(s.settings)) {
      if (rs[k] === undefined) continue;
      if (typeof s.settings[k] === 'object') Object.assign(s.settings[k], rs[k]);
      else s.settings[k] = rs[k];
    }
    const st = raw.stats || {};
    s.stats.daily = st.daily || {};
    Object.assign(s.stats.ta, st.ta || {});
    s.stats.pomo = st.pomo || {};
    const rk = raw.ranks || {};
    for (const k of ['study', 'ta', 'gram']) if (rk[k] && typeof rk[k] === 'object') s.ranks[k] = rk[k];
    s.gram = raw.gram && typeof raw.gram === 'object' ? raw.gram : {};
    return s;
  }
  function write() {
    clearTimeout(timer);
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('保存できませんでした（ブラウザの容量不足の可能性）', 'err'); }
  }
  let timer;
  return {
    KEY,
    get s() { return state; },
    load() { try { state = merge(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { state = fresh(); } },
    save() { clearTimeout(timer); timer = setTimeout(write, 250); },
    flush: write,
    replace(raw) { state = merge(raw); write(); },
    reset() { state = fresh(); write(); },
    fresh, merge,
  };
})();
addEventListener('pagehide', () => Store.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flush(); });

/* ---------- 単語帳 ---------- */
const POS_ALIASES = {
  '動': '動', '動詞': '動', v: '動', verb: '動', vt: '動', vi: '動',
  '名': '名', '名詞': '名', n: '名', noun: '名',
  '形': '形', '形容詞': '形', a: '形', adj: '形', adjective: '形',
  '副': '副', '副詞': '副', ad: '副', adv: '副', adverb: '副',
  '代': '代', '代名詞': '代', pron: '代', pronoun: '代',
  '前': '前', '前置詞': '前', prep: '前', preposition: '前',
  '接': '接', '接続詞': '接', conj: '接', conjunction: '接',
  '助': '助', '助動詞': '助', aux: '助',
};
/* 単語一覧PDFから取り込んだ1800語の分け方（600語ずつ3 Part、100語ずつ18 Section） */
const BOOK_PARTS = [
  { part: 'Part 1', name: '基礎（No.1–600）', to: 600 },
  { part: 'Part 2', name: '標準（No.601–1200）', to: 1200 },
  { part: 'Part 3', name: '発展（No.1201–1800）', to: Infinity },
];
const normPos = p => POS_ALIASES[String(p || '').trim().toLowerCase()] || POS_ALIASES[String(p || '').trim()] || (p ? '他' : '他');
const splitList = v => Array.isArray(v) ? v.map(s => String(s).trim()).filter(Boolean) : String(v || '').split(/[,、，/]/).map(s => s.trim()).filter(Boolean);

const Deck = {
  builtin: [], book: [], bookTitle: '', words: [], byId: new Map(), groups: [], rev: new Map(),
  partOf(no) { return no <= 800 ? 'Part 1' : no <= 1500 ? 'Part 2' : 'Part 3'; },
  hasBook() { return this.book.length > 0; },
  /* 単語一覧PDFから取り込んだ語（js/words-book.js）。行は「番号|英単語|品詞|意味」 */
  parseBook() {
    const B = window.T1800_BOOK;
    if (!B || !B.src) return;
    this.bookTitle = B.title || '';
    const seen = new Set(), out = [];
    for (const line of B.src.split('\n')) {
      const f = line.split('|');
      if (f.length < 4 || !f[1]) continue;
      const no = parseInt(f[0], 10);
      const P = BOOK_PARTS.find(x => no <= x.to);
      const w = this.norm({ no, w: f[1], p: f[2], m: f[3], part: P.part, pname: P.name }, 'k');
      // May（5月）と may（助動詞）のように小文字で重なる語は番号つきの別IDにする
      if (seen.has(w.id)) w.id = `${w.id}_${no}`;
      seen.add(w.id);
      out.push(w);
    }
    // 独自600語と重なる語には、独自に作った例文・類義語などを添える（意味は一覧のまま）
    const extra = new Map(this.builtin.map(b => [b.id, b]));
    for (const w of out) {
      const b = extra.get(w.id);
      if (b) Object.assign(w, { e: b.e, j: b.j, syn: b.syn, ant: b.ant, der: b.der });
    }
    this.book = out;
  },
  norm(o, src) {
    const w = String(o.w || o.word || '').trim();
    return {
      id: w.toLowerCase(), w, no: Math.max(0, parseInt(o.no, 10) || 0), p: normPos(o.p || o.pos),
      m: String(o.m || o.meaning || '').trim(), e: String(o.e || o.example || '').trim(), j: String(o.j || o.exampleJa || '').trim(),
      syn: splitList(o.syn), ant: splitList(o.ant), der: splitList(o.der),
      part: String(o.part || '').trim(), pname: o.pname || '', src,
    };
  },
  parse() {
    const src = (window.T1800_SRC || []).join('\n');
    let no = 0, part = 'Part 1', pname = '';
    const out = [];
    for (const line of src.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('#P|')) { [, part, pname] = t.split('|'); continue; }
      const f = t.split('|');
      out.push(this.norm({ no: ++no, w: f[0], p: f[1], m: f[2], e: f[3], j: f[4], syn: f[5], ant: f[6], der: f[7], part, pname }, 'b'));
    }
    this.builtin = out;
  },
  build() {
    let mode = Store.s.settings.deck;
    if (mode === 'book' && !this.hasBook()) mode = 'builtin';
    const base = this.hasBook() && mode !== 'builtin' ? this.book : this.builtin;
    let list = mode === 'custom' ? [] : base.map(w => ({ ...w }));
    const idx = new Map(list.map((w, i) => [w.id, i]));
    if (mode === 'custom' || mode === 'both') {
      let maxNo = Store.s.custom.reduce((m, c) => Math.max(m, parseInt(c.no, 10) || 0), 0);
      for (const c of Store.s.custom) {
        const w = this.norm(c, 'c');
        if (!w.id || !w.m) continue;
        if (!w.no) w.no = ++maxNo;
        if (!w.part) w.part = this.partOf(w.no);
        if (idx.has(w.id)) {
          if (mode === 'both') {
            const b = list[idx.get(w.id)];
            for (const k of ['m', 'e', 'j']) if (w[k]) b[k] = w[k];
            for (const k of ['syn', 'ant', 'der']) if (w[k].length) b[k] = w[k];
          }
          continue;
        }
        if (mode === 'both') w.part = 'MY ' + w.part;
        idx.set(w.id, list.length);
        list.push(w);
      }
    }
    for (const w of list) w.sec = Math.max(1, Math.ceil(w.no / 100));
    this.words = list;
    this.byId = new Map(list.map(w => [w.id, w]));
    const pmap = new Map();
    for (const w of list) {
      let P = pmap.get(w.part);
      if (!P) { P = { part: w.part, name: w.pname || '', ids: [], secs: new Map() }; pmap.set(w.part, P); }
      P.ids.push(w.id);
      let S = P.secs.get(w.sec);
      if (!S) { S = { key: `${w.part}|${w.sec}`, part: w.part, sec: w.sec, ids: [], from: w.no, to: w.no }; P.secs.set(w.sec, S); }
      S.ids.push(w.id); S.from = Math.min(S.from, w.no); S.to = Math.max(S.to, w.no);
    }
    this.groups = [...pmap.values()].map(P => ({ ...P, secs: [...P.secs.values()].sort((a, b) => a.sec - b.sec) }));
    this.rev = new Map();
    for (const w of list) {
      for (const r of [...w.syn, ...w.ant, ...w.der]) {
        const k = r.toLowerCase();
        if (k === w.id || !this.byId.has(k)) continue;
        if (!this.rev.has(k)) this.rev.set(k, new Set());
        this.rev.get(k).add(w.id);
      }
    }
  },
  get(id) { return this.byId.get(String(id || '').toLowerCase()); },
  secOf(w) { return Deck.groups.find(P => P.part === w.part)?.secs.find(S => S.sec === w.sec); },
};

/* ---------- タグ ---------- */
const Tags = {
  clean: t => String(t || '').trim().replace(/^[#＃]+/, '').replace(/\s+/g, '').slice(0, 24),
  of: id => Store.s.tags[id] || [],
  add(id, t) {
    t = this.clean(t); if (!t) return false;
    const a = this.of(id); if (a.includes(t)) return false;
    Store.s.tags[id] = [...a, t]; Store.save(); return true;
  },
  remove(id, t) {
    const a = this.of(id).filter(x => x !== t);
    if (a.length) Store.s.tags[id] = a; else delete Store.s.tags[id];
    Store.save();
  },
  all() {
    const m = new Map();
    for (const w of Deck.words) for (const t of this.of(w.id)) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
  },
  rename(from, to) {
    to = this.clean(to); if (!to || to === from) return;
    for (const id of Object.keys(Store.s.tags)) {
      const a = Store.s.tags[id]; const i = a.indexOf(from);
      if (i < 0) continue;
      a.splice(i, 1); if (!a.includes(to)) a.push(to);
    }
    Store.save();
  },
  drop(t) { for (const id of Object.keys(Store.s.tags)) this.remove(id, t); },
  PRESETS: ['鬼門', '学校テスト用', 'スペル注意', '発音注意', '多義語'],
};

/* ---------- 間隔反復エンジン ----------
   progress[id] = { s:状態, n:回答数, c:正答点(覚えた=1, 怪しい=0.5), st:連続正解, e:易しさ係数, i:間隔(日),
                    d:次回日時, l:最終回答, lo:直近の正解日時, x:忘却回数, h:直近履歴 }
   定着度 = 正答率(ベイズ平滑) × 想起確率 0.9^(直近の正解からの経過日数 / 安定度)            */
const SRS = {
  p: id => Store.s.progress[id],
  status(id) { return this.p(id)?.s || 'new'; },
  ensure(id) {
    return Store.s.progress[id] ||= { s: null, n: 0, c: 0, st: 0, e: 2.5, i: 0, d: 0, l: 0, lo: 0, x: 0, h: '' };
  },
  logDay(ok) {
    const k = dkey(); const d = Store.s.stats.daily[k] ||= { n: 0, ok: 0 };
    d.n++; if (ok) d.ok++;
  },
  grade(id, g) {
    const now = Date.now(), p = this.ensure(id), first = p.n === 0;
    p.n++; p.l = now;
    if (g === 'known') {
      p.c += 1; p.st++; p.lo = now;
      p.i = first ? 4 : p.i < 1 ? 1 : p.i < 3 ? 3 : Math.round(p.i * p.e);
      p.i = Math.min(p.i, 365);
      p.e = Math.min(3.0, p.e + 0.1);
      p.d = sod(now) + p.i * DAY;
    } else if (g === 'unsure') {
      p.c += 0.5; p.st = 0; p.lo = now;
      p.e = Math.max(1.3, p.e - 0.15);
      p.i = 1; p.d = sod(now) + DAY;
    } else {
      p.st = 0; p.x++;
      p.e = Math.max(1.3, p.e - 0.2);
      p.i = 0; p.d = now;
    }
    p.s = g;
    p.h = (p.h + g[0]).slice(-12);
    this.logDay(g === 'known');
    Store.save();
  },
  /* タイムアタック用：正解は記録だけ（間隔は動かさない）、不正解は「忘れた」へ */
  quick(id, ok) {
    if (!ok) return this.grade(id, 'forgot');
    const p = this.ensure(id); const now = Date.now();
    p.n++; p.c += 1; p.l = now; p.lo = now;
    this.logDay(true);
    Store.save();
  },
  retention(id, now = Date.now()) {
    const p = this.p(id);
    if (!p || !p.n || !p.s) return null; // 学習モードで一度も自己評価していない語は対象外
    const acc = (p.c + 1) / (p.n + 2);
    if (!p.lo) return 0;
    const t = Math.max(0, (now - p.lo) / DAY);
    const S = Math.max(0.25, p.i || 0.25);
    let R = Math.pow(0.9, t / S);
    if (p.s === 'forgot') R *= 0.35;
    return Math.round(100 * acc * R);
  },
  isDue(id, end = eod()) { const p = this.p(id); return !!(p && p.s && p.d <= end); },
  dueWords() {
    const end = eod();
    return Deck.words.filter(w => this.isDue(w.id, end)).sort((a, b) => (this.retention(a.id) ?? 0) - (this.retention(b.id) ?? 0));
  },
  weakWords() { return Deck.words.filter(w => { const s = this.status(w.id); return s === 'unsure' || s === 'forgot'; }); },
  count(words = Deck.words) {
    const c = { known: 0, unsure: 0, forgot: 0, new: 0, total: words.length };
    for (const w of words) c[this.status(w.id)]++;
    return c;
  },
  avgRetention(words = Deck.words) {
    let s = 0, n = 0;
    for (const w of words) { const r = this.retention(w.id); if (r !== null) { s += r; n++; } }
    return n ? Math.round(s / n) : 0;
  },
  forecast(days = 7) {
    const out = Array(days).fill(0); const base = sod();
    for (const w of Deck.words) {
      const p = this.p(w.id); if (!p || !p.s) continue;
      const k = Math.max(0, Math.floor((sod(p.d) - base) / DAY));
      if (k < days) out[k]++;
    }
    return out;
  },
  streak() {
    const daily = Store.s.stats.daily; let n = 0; let t = Date.now();
    if (!daily[dkey(t)]?.n) t -= DAY;
    while (daily[dkey(t)]?.n) { n++; t -= DAY; }
    return n;
  },
};
const weakRank = { forgot: 0, unsure: 1, new: 2, known: 3 };
function orderWords(list, order) {
  if (order === 'rand') return shuffle(list.slice());
  if (order === 'weak') return list.slice().sort((a, b) => weakRank[SRS.status(a.id)] - weakRank[SRS.status(b.id)] || (SRS.retention(a.id) ?? 0) - (SRS.retention(b.id) ?? 0) || a.no - b.no);
  return list.slice().sort((a, b) => a.no - b.no);
}

/* ---------- 範囲（Part / Section / タグ / 状態 / 番号） ---------- */
function rangeWords(val, from, to) {
  const W = Deck.words;
  if (!val || val === 'all') return W.slice();
  const i = val.indexOf(':');
  const type = i < 0 ? val : val.slice(0, i), arg = i < 0 ? '' : val.slice(i + 1);
  switch (type) {
    case 'part': return W.filter(w => w.part === arg);
    case 'sec': return W.filter(w => `${w.part}|${w.sec}` === arg);
    case 'tag': return W.filter(w => Tags.of(w.id).includes(arg));
    case 'pos': return W.filter(w => w.p === arg);
    case 'st': return W.filter(w => SRS.status(w.id) === arg);
    case 'weak': return SRS.weakWords();
    case 'due': return SRS.dueWords();
    case 'nums': {
      const a = parseInt(from, 10) || 1, b = parseInt(to, 10) || 99999;
      return W.filter(w => w.no >= Math.min(a, b) && w.no <= Math.max(a, b));
    }
  }
  return W.slice();
}
function rangeLabel(val, from, to) {
  if (!val || val === 'all') return 'すべて';
  const i = val.indexOf(':'); const type = i < 0 ? val : val.slice(0, i), arg = i < 0 ? '' : val.slice(i + 1);
  return ({
    part: () => arg, sec: () => arg.replace('|', ' · Section '), tag: () => '#' + arg, pos: () => POS[arg],
    st: () => STATUS[arg], weak: () => '要復習リスト', due: () => '今日の復習', nums: () => `No.${from}–${to}`,
  }[type] || (() => val))();
}
function rangeSelectHTML(id, val) {
  const o = (v, l) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`;
  const c = SRS.count();
  let h = `<select class="select" id="${id}">` + o('all', `すべて（${Deck.words.length}語）`);
  h += `<optgroup label="復習・状態">${o('due', `今日の復習（${SRS.dueWords().length}）`)}${o('weak', `要復習リスト（${c.unsure + c.forgot}）`)}`
    + STATUS_KEYS.map(s => o('st:' + s, `${STATUS[s]}（${c[s]}）`)).join('') + '</optgroup>';
  for (const P of Deck.groups) {
    h += `<optgroup label="${esc(P.part + (P.name ? ' ' + P.name : ''))}">` + o('part:' + P.part, `${P.part} 全体（${P.ids.length}）`)
      + P.secs.map(S => o('sec:' + S.key, `${P.part} · Section ${S.sec}（No.${S.from}–${S.to}）`)).join('') + '</optgroup>';
  }
  const tags = Tags.all();
  if (tags.length) h += `<optgroup label="タグ">${tags.map(([t, n]) => o('tag:' + t, `#${t}（${n}）`)).join('')}</optgroup>`;
  h += `<optgroup label="品詞">${POS_KEYS.map(k => o('pos:' + k, POS[k])).join('')}</optgroup>`;
  h += `<optgroup label="番号指定">${o('nums', '番号で範囲を指定…')}</optgroup></select>`;
  return h;
}

/* ---------- 選択肢（4択） ---------- */
function makeChoices(w, dir = 'en', n = 4) {
  const pool = Deck.words.filter(x => x.id !== w.id && x.m !== w.m);
  const same = shuffle(pool.filter(x => x.p === w.p));
  const others = shuffle(pool.filter(x => x.p !== w.p));
  const picked = [];
  const seen = new Set([dir === 'en' ? w.m : w.id]);
  for (const x of [...same, ...others]) {
    const key = dir === 'en' ? x.m : x.id;
    if (seen.has(key)) continue;
    seen.add(key); picked.push(x);
    if (picked.length >= n - 1) break;
  }
  return shuffle([w, ...picked]);
}

/* ---------- 音声（Web Speech API） ---------- */
const Speech = {
  ok: 'speechSynthesis' in window,
  voices: [],
  init() {
    if (!this.ok) return;
    const load = () => { this.voices = speechSynthesis.getVoices(); document.dispatchEvent(new Event('voices')); };
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
  },
  list(lang) { return this.voices.filter(v => lang === 'en' ? /^en/i.test(v.lang) : /^ja/i.test(v.lang)); },
  voice(lang) {
    const pref = lang === 'en' ? Store.s.settings.voiceEn : Store.s.settings.voiceJa;
    if (pref) { const v = this.voices.find(v => v.voiceURI === pref); if (v) return v; }
    let c = this.voices.filter(v => lang === 'en' ? /^en[-_]US/i.test(v.lang) : /^ja/i.test(v.lang));
    if (!c.length && lang === 'en') c = this.voices.filter(v => /^en/i.test(v.lang));
    return c.find(v => /natural|online|google|aria|jenny|samantha|nanami|kyoko/i.test(v.name)) || c[0] || null;
  },
  // 読み上げ用：【品詞】〔補足〕［言い換え］（注）や ①② ～ … を外して、意味の部分だけにする
  jaText: m => String(m || '')
    .replace(/【[^】]*】|〔[^〕]*〕|［[^］]*］|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, ' ')
    .replace(/[①-⑳]/g, '、').replace(/[～〜~…]/g, '').replace(/[；;]/g, '、')
    .replace(/\s*、[\s、]*/g, '、').replace(/^[\s、]+|[\s、]+$/g, '').replace(/\s+/g, '、'),
  noEnglish() { return this.ok && this.voices.length > 0 && !this.list('en').length; },
  NO_EN_MSG: 'この環境には英語の音声が入っていません。Chrome（Google の英語音声）か Edge で開くか、Windows の「設定 → 時刻と言語 → 音声 → 音声を追加」で「英語（米国）」を追加してください。',
  speak(text, lang = 'en', rate) {
    if (lang === 'en' && !this._warned && this.noEnglish()) { this._warned = true; toast('英語の音声が見つかりません（設定・データに対処法）', 'err'); }
    return new Promise(res => {
      if (!this.ok || !text) return res();
      const u = new SpeechSynthesisUtterance(text);
      const v = this.voice(lang);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang === 'en' ? 'en-US' : 'ja-JP';
      u.rate = rate ?? Store.s.settings.rate;
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(to); res(); };
      const to = setTimeout(fin, 2500 + text.length * (lang === 'en' ? 130 : 260) / u.rate);
      u.onend = fin; u.onerror = fin;
      this._keep = u; // GC で onend が来なくなる不具合の回避
      speechSynthesis.speak(u);
    });
  },
  say(text, lang = 'en', rate) { this.cancel(); return this.speak(text, lang, rate); },
  cancel() { if (this.ok) speechSynthesis.cancel(); },
};
const speakBtn = (text, lang = 'en', cls = '', label = '発音を聞く') =>
  `<button type="button" class="speak ${cls}" data-say="${esc(text)}" data-lang="${lang}" aria-label="${label}">${icon('volume')}</button>`;

/* ---------- 効果音（WebAudio） ---------- */
const Sfx = {
  ctx: null,
  on() { return Store.s.settings.sfx; },
  ac() {
    if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; this.ctx = new C(); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(f, dur = .12, type = 'sine', vol = .12, delay = 0) {
    if (!this.on()) return; const c = this.ac(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
  },
  ok(combo = 0) { const b = 660 * Math.pow(2, Math.min(combo, 24) / 24); this.tone(b, .09, 'triangle', .14); this.tone(b * 1.5, .12, 'triangle', .1, .06); },
  ng() { this.tone(220, .18, 'sawtooth', .07); this.tone(165, .22, 'sawtooth', .06, .08); },
  tier() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .16, 'triangle', .12, i * .07)); },
  tick() { this.tone(1200, .03, 'square', .04); },
  done() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, .22, 'sine', .12, i * .12)); },
  bell() { [880, 1320, 880, 1320].forEach((f, i) => this.tone(f, .5, 'sine', .1, i * .35)); },
};

/* ---------- UI 部品 ---------- */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = (type === 'ok' ? icon('check') : type === 'err' ? icon('alert') : '') + `<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2400);
}

function openModal({ title = '', body = '', cls = '', onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal-backdrop"></div><div class="modal ${cls}" role="dialog" aria-modal="true">
    <div class="modal-head"><h3></h3><button class="icon-btn" data-close aria-label="閉じる">${icon('x')}</button></div>
    <div class="modal-body"></div></div>`;
  const m = { wrap, el: $('.modal', wrap), body: $('.modal-body', wrap), head: $('.modal-head h3', wrap) };
  m.head.innerHTML = title;
  if (typeof body === 'string') m.body.innerHTML = body; else if (body) m.body.appendChild(body);
  const prev = document.activeElement;
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); m.close(); } };
  m.close = () => {
    if (!wrap.isConnected) return;
    wrap.remove(); document.removeEventListener('keydown', onKey, true);
    onClose?.(); prev?.focus?.({ preventScroll: true });
  };
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target.classList.contains('modal-backdrop')) m.close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(wrap);
  setTimeout(() => $('[data-close]', wrap)?.focus({ preventScroll: true }), 30);
  return m;
}
function confirmBox(title, text, { ok = 'OK', danger = false } = {}) {
  return new Promise(res => {
    let v = false;
    const m = openModal({ title: esc(title), cls: 'sm', body: `<p style="margin:0 0 18px;line-height:1.7">${text}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>キャンセル</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button></div>`, onClose: () => res(v) });
    $('[data-ok]', m.body).onclick = () => { v = true; m.close(); };
  });
}
function promptBox(title, value = '', { ok = '決定', placeholder = '' } = {}) {
  return new Promise(res => {
    let v = null;
    const m = openModal({ title: esc(title), cls: 'sm', body: `<form><input class="input" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="24">
      <div class="row mt" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>キャンセル</button><button class="btn primary">${esc(ok)}</button></div></form>`,
      onClose: () => res(v) });
    const inp = $('input', m.body);
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
    $('form', m.body).onsubmit = e => { e.preventDefault(); v = inp.value; m.close(); };
  });
}

/* ツールチップ（data-tip） */
const Tip = {
  el: null,
  init() {
    this.el = document.createElement('div'); this.el.className = 'tip'; this.el.hidden = true; document.body.appendChild(this.el);
    const show = t => {
      const r = t.getBoundingClientRect();
      this.el.textContent = t.dataset.tip; this.el.hidden = false;
      const w = this.el.offsetWidth;
      this.el.style.left = clamp(r.left + r.width / 2, w / 2 + 6, innerWidth - w / 2 - 6) + 'px';
      this.el.style.top = Math.max(r.top, this.el.offsetHeight + 12) + 'px';
    };
    document.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const t = e.target.closest('[data-tip]'); if (t) show(t); else this.el.hidden = true; });
    document.addEventListener('focusin', e => { const t = e.target.closest?.('[data-tip]'); if (t) show(t); });
    document.addEventListener('focusout', () => { this.el.hidden = true; });
    addEventListener('scroll', () => { this.el.hidden = true; }, true);
  },
};

/* フルスクリーン（Fullscreen API。非対応端末は没入表示で代替） */
const FS = {
  api() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); },
  el() { return document.fullscreenElement || document.webkitFullscreenElement; },
  is() { return !!this.el() || document.body.classList.contains('pseudo-fs'); },
  async toggle() {
    try {
      if (this.api()) {
        if (this.el()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const r = document.documentElement; await (r.requestFullscreen || r.webkitRequestFullscreen).call(r, { navigationUI: 'hide' }); }
      } else {
        document.body.classList.toggle('pseudo-fs');
        if (document.body.classList.contains('pseudo-fs')) toast('この端末はフルスクリーン非対応のため、没入表示に切り替えました');
      }
    } catch (e) { document.body.classList.toggle('pseudo-fs'); }
    this.sync();
  },
  sync() {
    const on = this.is();
    document.body.classList.toggle('is-fs', on);
    $$('[data-fs-btn]').forEach(b => { b.innerHTML = icon(on ? 'minimize' : 'maximize'); b.setAttribute('aria-label', on ? 'フルスクリーン解除' : 'フルスクリーン'); b.dataset.tip = on ? 'フルスクリーン解除' : 'フルスクリーン'; });
  },
};
document.addEventListener('fullscreenchange', () => FS.sync());
document.addEventListener('webkitfullscreenchange', () => FS.sync());

/* テーマ */
const Theme = {
  apply() {
    const t = Store.s.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const b = $('#theme-btn');
    if (b) { b.innerHTML = icon(t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'auto'); b.dataset.tip = { auto: 'テーマ: 端末に合わせる', light: 'テーマ: ライト', dark: 'テーマ: ダーク' }[t] || ''; }
    document.dispatchEvent(new Event('themechange'));
  },
  cycle() {
    const order = ['auto', 'light', 'dark'];
    Store.s.settings.theme = order[(order.indexOf(Store.s.settings.theme) + 1) % 3];
    Store.save(); this.apply();
  },
};
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => document.dispatchEvent(new Event('themechange')));

function downloadFile(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* 状態の分布バー（覚えた/怪しい/忘れた/未学習） */
function segBar(c, { tall = false, label = '' } = {}) {
  const total = c.total || 1;
  const aria = `${label}${label ? '：' : ''}` + STATUS_KEYS.map(k => `${STATUS[k]}${c[k]}語`).join('、');
  const parts = STATUS_KEYS.filter(k => c[k] > 0).map(k => {
    const pct = c[k] / total * 100;
    const txt = tall && pct >= 9 ? `${Math.round(pct)}%` : '';
    return `<span class="s-${k}" style="flex:${c[k]} 1 0" data-tip="${STATUS[k]} ${c[k]}語（${pct.toFixed(1)}%）">${txt}</span>`;
  }).join('');
  return `<div class="seg${tall ? ' tall' : ''}" role="img" aria-label="${esc(aria)}">${parts || '<span class="s-new" style="flex:1"></span>'}</div>`;
}
function legendHTML(c) {
  return `<div class="legend">${STATUS_KEYS.map(k => `<span><i class="s-${k}"></i>${STATUS[k]} <b>${nfmt(c[k])}</b></span>`).join('')}</div>`;
}
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
