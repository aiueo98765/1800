'use strict';
/* ============================================================
   文法・入試対策（中1〜中3・26単元）
   出題形式：穴埋め（4択）/ 並べ替え / 和文英訳（入力して自動採点）/ 英文和訳（自己採点）
   成績は Store.s.gram[問題ID] = { n:回答数, c:得点の合計, r:直近の得点(0/0.5/1), t:日時 }
   ============================================================ */
const GTYPES = {
  fill: { t: '穴埋め', d: '空所に入る語句を4つから選ぶ', ic: 'choice' },
  order: { t: '並べ替え', d: '日本語に合うように語を並べる', ic: 'list' },
  je: { t: '和文英訳', d: '日本語を見て英文を書く', ic: 'keyboard' },
  ej: { t: '英文和訳', d: '英文の意味を考えて自己採点', ic: 'eye' },
  mix: { t: 'ミックス', d: '4つの形式をまぜて出題', ic: 'zap' },
};
const G_STOP = new Set('a an the to of in on at for and but or so if as by with from than then there here this that these those it its i you he she we they my your his her our their me him us them be am is are was were been do does did not no yes very too also please can will what who where when why how which whose'.split(' '));
const G_IRR = { stolen: 'steal', lost: 'lose', sung: 'sing', sang: 'sing', taught: 'teach', forgot: 'forget', forgotten: 'forget', drew: 'draw', drawn: 'draw', grew: 'grow', grown: 'grow', flew: 'fly', flown: 'fly', worn: 'wear', swum: 'swim', teeth: 'tooth', knives: 'knife', fell: 'fall', chose: 'choose', won: 'win', became: 'become', shown: 'show', lying: 'lie', slept: 'sleep', kept: 'keep', felt: 'feel', paid: 'pay', went: 'go', gone: 'go', saw: 'see', seen: 'see', bought: 'buy', made: 'make', took: 'take', taken: 'take', wrote: 'write', written: 'write', broke: 'break', broken: 'break', spoken: 'speak', spoke: 'speak', built: 'build', known: 'know', knew: 'know', had: 'have', has: 'have', ate: 'eat', eaten: 'eat', gave: 'give', given: 'give', told: 'tell', sent: 'send', sat: 'sit', stood: 'stand', found: 'find', came: 'come', began: 'begin', wore: 'wear', left: 'leave', got: 'get', children: 'child', women: 'woman', men: 'man', better: 'good', best: 'good', thought: 'think', said: 'say', ran: 'run', heard: 'hear', met: 'meet', lent: 'lend', used: 'use', cities: 'city', countries: 'country', taller: 'tall', biggest: 'big', highest: 'high', youngest: 'young', faster: 'fast', heavier: 'heavy', stories: 'story', places: 'place', parents: 'parent' };

const Grammar = {
  units: [], items: [], byId: new Map(), unitById: new Map(), pending: null,
  GRADES: ['中1', '中2', '中3'],
  parse() {
    let u = null, i = 0;
    for (const line of String(window.T1800_GRAMMAR || '').split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('#U|')) {
        const [, id, grade, name, sub, point] = t.split('|');
        u = { id, grade, name, sub, point: (point || '').split('／'), items: [] };
        this.units.push(u); this.unitById.set(id, u); i = 0;
        continue;
      }
      const m = t.match(/^(.*\{[^}]*\}.*?)\|([^|{}]+)$/);
      if (!m || !u) continue;
      const raw = m[1], ja = m[2].trim();
      const g = raw.match(/\{([^}]*)\}/);
      const opts = g[1].split('|');
      const it = { id: `${u.id}-${++i}`, unit: u.id, ja, ans: opts[0], opts, pre: raw.slice(0, g.index), post: raw.slice(g.index + g[0].length) };
      it.en = it.pre + it.ans + it.post;
      u.items.push(it); this.items.push(it); this.byId.set(it.id, it);
    }
  },
  rec(id) { return Store.s.gram[id]; },
  status(id) { const r = this.rec(id); return !r ? 'new' : r.r >= 1 ? 'known' : r.r > 0 ? 'unsure' : 'forgot'; },
  count(list) {
    const c = { known: 0, unsure: 0, forgot: 0, new: 0, total: list.length };
    for (const it of list) c[this.status(it.id)]++;
    return c;
  },
  log(id, score) {
    const r = Store.s.gram[id] ||= { n: 0, c: 0, r: 0, t: 0 };
    r.n++; r.c += score; r.r = score; r.t = Date.now();
    SRS.logDay(score >= 1);
    Store.save();
  },
  weak() { return this.items.filter(it => ['unsure', 'forgot'].includes(this.status(it.id))); },
  /* 英文の比べ方：大文字小文字・句読点・短縮形の違いは同じとみなす */
  norm(s) {
    s = ' ' + String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”"]/g, '') + ' ';
    const R = [[/\bcan't\b/g, 'cannot'], [/\bcan not\b/g, 'cannot'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'], [/n't\b/g, ' not'],
      [/\bi'm\b/g, 'i am'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'], [/\bi'd\b/g, 'i would'],
      [/\b(it|he|she|that|what|who|there|here|where|how)'s\b/g, '$1 is'], [/\blet's\b/g, 'let us']];
    for (const [re, to] of R) s = s.replace(re, to);
    return s.replace(/[.,!?;:—–]/g, ' ').replace(/\s+/g, ' ').trim();
  },
  /* 並べ替え用：語に分け、文末の記号は固定で表示。文頭の大文字は答えのヒントにならないよう小文字に */
  tokens(it) {
    const m = it.en.match(/^(.*?)([.?!])$/);
    const body = m ? m[1] : it.en, end = m ? m[2] : '';
    const toks = body.split(/\s+/).filter(Boolean);
    // 文頭でも大文字のままにする語（I・敬称・人名・地名・言語など）。それ以外は小文字にして答えのヒントにしない
    const keepCap = w => /^I\b|^I'/.test(w) || /^(Mr|Ms|Mrs|Mt|Dr)\./.test(w) || /^(Ken|Tom|Emi|Yuki|Mike|Aya|Lisa|Brown|Green|Sato|Tanaka|Kyoto|Tokyo|Osaka|Okinawa|Hokkaido|Hawaii|Japan|Japanese|English|Chinese|French|Canada|London|Australia|America|China|France|Italy|Brazil|Fuji|Sunday)\b/.test(w);
    const shown = toks.map((w, i) => i === 0 && !keepCap(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w);
    return { toks, shown, end };
  },
  lemma(t) {
    t = t.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '');
    if (!t) return null;
    const c = [t, G_IRR[t]];
    if (t.endsWith("'s")) c.push(t.slice(0, -2));
    if (t.endsWith('ies')) c.push(t.slice(0, -3) + 'y');
    if (t.endsWith('es')) c.push(t.slice(0, -2));
    if (t.endsWith('s')) c.push(t.slice(0, -1));
    if (t.endsWith('ied')) c.push(t.slice(0, -3) + 'y');
    if (t.endsWith('ed')) { c.push(t.slice(0, -2), t.slice(0, -1)); if (/(.)\1ed$/.test(t)) c.push(t.slice(0, -3)); }
    if (t.endsWith('ing')) { const b = t.slice(0, -3); c.push(b, b + 'e'); if (/(.)\1$/.test(b)) c.push(b.slice(0, -1)); }
    if (t.endsWith('er')) { c.push(t.slice(0, -2), t.slice(0, -1)); if (/(.)\1er$/.test(t)) c.push(t.slice(0, -3)); }
    if (t.endsWith('est')) { c.push(t.slice(0, -3), t.slice(0, -2)); if (/(.)\1est$/.test(t)) c.push(t.slice(0, -4)); }
    if (t.endsWith('ly')) c.push(t.slice(0, -2));
    for (const x of c) if (x && Deck.get(x)) return Deck.get(x);
    return null;
  },
  /* 文の中の収録語（基本的な機能語は省く） */
  words(it) {
    const seen = new Set(), out = [];
    for (const tok of it.en.split(/\s+/)) {
      const w = this.lemma(tok);
      if (!w || seen.has(w.id) || G_STOP.has(w.id)) continue;
      seen.add(w.id); out.push(w);
    }
    return out;
  },
  key(o) {
    if (o.u === 'exam') return 'gram::exam';
    if (o.u === 'rand') return `gram::r:${o.g}:${o.t}`;
    if (this.unitById.has(o.u)) return `gram::u:${o.u}:${o.t}`;
    return null;
  },
  bestOfUnit(id) {
    let best = null;
    for (const t of Object.keys(GTYPES)) { const b = Rank.best('gram', `gram::u:${id}:${t}`); if (b && (!best || b.r > best.r)) best = b; }
    return best;
  },
  pointHTML(u, open = false) {
    return `<details class="gq-point"${open ? ' open' : ''}><summary>${icon('bulb')}ポイント：${esc(u.name)}</summary><ul>${u.point.map(p => `<li>${esc(p)}</li>`).join('')}</ul></details>`;
  },
};

/* ---------- 文法トップ ---------- */
Views.grammar = el => {
  const s = Store.s.settings.gram;
  const all = Grammar.items, c = Grammar.count(all), weak = Grammar.weak().length;
  const exam = Rank.best('gram', 'gram::exam');
  const seg = (name, list, cur) => `<div class="seg-ctl" data-gseg="${name}">${list.map(([v, l]) => `<button data-v="${esc(v)}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const typeBtns = id => Object.entries(GTYPES).map(([t, T]) => `<a class="btn sm${t === 'fill' ? ' primary' : ''}" href="#/gsession?u=${id}&t=${t}">${T.t}</a>`).join('');
  const unitCard = u => {
    const uc = Grammar.count(u.items), b = Grammar.bestOfUnit(u.id);
    return `<section class="card gunit">
      <div class="gunit-top"><span class="chip">${u.grade}</span><h3>${esc(u.name)}</h3>${Rank.badge(b?.r || 0, 32)}</div>
      <p class="gunit-sub">${esc(u.sub)}</p>
      ${segBar(uc, { label: u.name })}
      <div class="gunit-meta"><span>正解 ${uc.known}/${uc.total}問</span><span>要復習 ${uc.unsure + uc.forgot}</span>${b ? `<span>最高「${Rank.name(b.r)}」</span>` : ''}</div>
      <div class="gunit-acts">${typeBtns(u.id)}</div>
      ${Grammar.pointHTML(u)}
    </section>`;
  };
  el.innerHTML = `
  <div class="page-head"><div><h1>文法・入試対策</h1><p>中1〜中3の文法${Grammar.units.length}単元・${all.length}問。ターゲット1800の収録語で作った例文を、穴埋め・並べ替え・英訳・和訳で解きます</p></div></div>
  <div class="gtop">
    <section class="card gx-exam">
      <div class="gx-head">${Rank.badge(exam?.r || 0, 52)}<div><h2>${icon('target')}入試実戦テスト</h2><p class="card-sub" style="margin:0">全学年の単元から20問。4つの形式をまぜて出題し、スコアランクを判定します</p></div></div>
      <div class="gx-meta">${exam ? `最高ランク「${Rank.name(exam.r)}」 · ${exam.s}点` : 'まだ受けていません'}</div>
      <a class="btn primary block" href="#/gsession?u=exam">${icon('play')}テストを始める</a>
    </section>
    <section class="card">
      <h2>${icon('zap')}ランダム演習</h2>
      <div class="opt-group"><span>学年</span>${seg('g', [['all', '全学年'], ...Grammar.GRADES.map(g => [g, g])], s.g)}</div>
      <div class="opt-group"><span>形式</span>${seg('t', Object.entries(GTYPES).map(([t, T]) => [t, T.t]), s.t)}</div>
      <div class="opt-group"><span>問題数</span>${seg('n', [[10, '10'], [20, '20'], [30, '30']], s.n)}</div>
      <button class="btn primary block mt" id="g-rand">${icon('play')}ランダムで始める</button>
    </section>
    <section class="card">
      <h2>${icon('grid')}全体の進捗</h2>
      ${segBar(c, { tall: true, label: '文法全体' })}${legendHTML(c)}
      <a class="btn block mt${weak ? '' : ' disabled'}" ${weak ? 'href="#/gsession?u=weak&t=mix"' : 'aria-disabled="true"'}>${icon('repeat')}間違えた問題をやり直す（${weak}問）</a>
    </section>
  </div>
  ${Grammar.GRADES.map(g => {
    const us = Grammar.units.filter(u => u.grade === g);
    const gc = Grammar.count(us.flatMap(u => u.items));
    return `<div class="gr-head"><h2>${g}</h2><span class="muted">${us.length}単元 · 正解 ${gc.known}/${gc.total}問</span></div>
      <div class="gunits">${us.map(unitCard).join('')}</div>`;
  }).join('')}`;

  el.addEventListener('click', e => {
    const b = e.target.closest('[data-gseg] button');
    if (b) {
      const name = b.parentElement.dataset.gseg;
      s[name] = name === 'n' ? +b.dataset.v : b.dataset.v; Store.save();
      $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b));
      return;
    }
    if (e.target.closest('#g-rand')) location.hash = `#/gsession?u=rand&g=${encodeURIComponent(s.g)}&t=${s.t}&n=${s.n}`;
    if (e.target.closest('a.disabled')) e.preventDefault();
  });
};

/* ---------- 文法の演習 ---------- */
Views.gsession = (el, q) => {
  const o = { u: q.get('u') || 'rand', t: q.get('t') || 'mix', g: q.get('g') || 'all', n: parseInt(q.get('n'), 10) || 0 };
  const pick = () => {
    const rnd = () => { const r = Math.random(); return r < .35 ? 'fill' : r < .65 ? 'order' : r < .85 ? 'je' : 'ej'; };
    const typed = list => list.map(it => ({ id: it.id, type: o.t === 'mix' ? rnd() : o.t }));
    if (o.u === 'exam') {
      // 単元が偏らないように、ランダムに選んだ20単元から1問ずつ。形式は 穴埋め8・並べ替え5・英訳4・和訳3
      const us = shuffle(Grammar.units.slice()).slice(0, 20);
      const types = shuffle([...Array(8).fill('fill'), ...Array(5).fill('order'), ...Array(4).fill('je'), ...Array(3).fill('ej')]);
      o.label = '入試実戦テスト'; o.t = 'mix'; o.exam = true;
      return us.map((u, i) => ({ id: shuffle(u.items.slice())[0].id, type: types[i] }));
    }
    if (o.u === 'weak') { o.label = '間違えた問題'; return typed(shuffle(Grammar.weak())); }
    if (o.u === 'ids') { const p = Grammar.pending; o.label = p?.label || '選んだ問題'; return p ? p.list.slice() : []; }
    if (o.u === 'rand') {
      const pool = Grammar.items.filter(it => o.g === 'all' || Grammar.unitById.get(it.unit).grade === o.g);
      o.label = `ランダム · ${o.g === 'all' ? '全学年' : o.g}`;
      return typed(shuffle(pool.slice()).slice(0, o.n || 20));
    }
    const u = Grammar.unitById.get(o.u);
    if (!u) return [];
    o.label = `${u.grade} · ${u.name}`;
    const list = shuffle(u.items.slice());
    return typed(o.n ? list.slice(0, o.n) : list);
  };
  const Q = pick();
  if (!Q.length) { location.replace('#/grammar'); return; }
  const S = { q: Q, pos: 0, res: [], t0: Date.now(), key: Grammar.key(o) };

  document.body.classList.add('focus-mode');
  el.innerHTML = `<div class="sess gsess">
    <header class="sess-head">
      <button class="icon-btn" data-quit aria-label="終了" data-tip="終了">${icon('x')}</button>
      <div class="sess-prog"><div class="sess-prog-meta"><span id="sp-mode"></span><span id="sp-count" class="num"></span></div><div class="meter"><i id="sp-bar"></i></div></div>
      <div id="pomo-slot"></div>
      <button class="icon-btn" data-fs-btn></button>
    </header>
    <div class="sess-body" id="sb"></div>
    <footer class="sess-foot" id="sf"></footer>
  </div>`;
  FS.sync();
  Pomo.dock($('#pomo-slot', el));
  const sb = $('#sb', el), sf = $('#sf', el);
  let it = null, u = null, type = '', stage = 'q', placed = [], hintLv = 0, score = 0, tk = null, memo = '';

  const progress = () => {
    const n = S.q.length;
    $('#sp-count', el).textContent = `${Math.min(S.pos + 1, n)} / ${n}`;
    $('#sp-bar', el).style.width = `${S.pos / n * 100}%`;
    $('#sp-mode', el).textContent = `${o.label} · ${GTYPES[type]?.t || ''}`;
  };
  const meta = () => `<div class="q-meta"><span class="chip">${u.grade}</span><span class="chip pos">${esc(u.name)}</span><span class="chip">${GTYPES[type].t}</span>${pill(Grammar.status(it.id))}<span class="grow"></span></div>`;
  const fullEN = () => `${esc(it.pre)}<mark class="hl">${esc(it.ans)}</mark>${esc(it.post)}`;

  function show() {
    stage = 'q'; placed = []; hintLv = 0; score = 0;
    if (S.pos >= S.q.length) return summary(true);
    const cur = S.q[S.pos];
    it = Grammar.byId.get(cur.id); type = cur.type;
    if (!it) { S.pos++; return show(); }
    u = Grammar.unitById.get(it.unit);
    progress();
    if (type === 'fill') {
      const opts = shuffle(it.opts.slice());
      sb.innerHTML = `<div class="qcard gq">${meta()}
        <div class="gq-en">${esc(it.pre)}<span class="gq-blank">（　　　）</span>${esc(it.post)}</div>
        <div class="gq-ja">${esc(it.ja)}</div>
        <div class="choices gq-choices">${opts.map((x, i) => `<button class="choice en" data-opt="${esc(x)}"><kbd>${i + 1}</kbd>${esc(x)}</button>`).join('')}</div>
        <div id="gfb"></div></div>`;
      sf.innerHTML = `<div class="foot-row"><span class="muted" style="font-size:13px">正しいものを選んでください（キー 1〜4）</span></div>`;
    } else if (type === 'order') {
      tk = Grammar.tokens(it);
      tk.order = shuffle(tk.shown.map((_, i) => i));
      if (tk.order.every((x, i) => x === i) && tk.order.length > 1) tk.order.reverse();
      sb.innerHTML = `<div class="qcard gq">${meta()}
        <div class="gq-ja big">${esc(it.ja)}</div>
        <div class="gq-line" id="gline" aria-label="答えの並び"></div>
        <div class="gq-pool" id="gpool"></div>
        <div id="gfb"></div></div>`;
      sf.innerHTML = `<div class="foot-row">
        ${o.exam ? '' : `<button class="btn side" data-ghint aria-label="ヒント">${icon('bulb')}<span class="lbl">ヒント</span></button>`}
        <button class="btn side" data-greset aria-label="やり直す">${icon('undo')}<span class="lbl">やり直す</span></button>
        <button class="btn primary" data-gcheck disabled>答え合わせ <kbd>Enter</kbd></button></div>`;
      drawOrder();
    } else if (type === 'je') {
      sb.innerHTML = `<div class="qcard gq">${meta()}
        <div class="gq-ja big">${esc(it.ja)}</div>
        <input class="input gq-input" id="gin" type="text" placeholder="英文を入力（Enter で答え合わせ）" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
        <div class="q-hint" id="ghint" hidden></div>
        <div id="gfb"></div></div>`;
      sf.innerHTML = `<div class="foot-row">
        ${o.exam ? '' : `<button class="btn side" data-ghint>${icon('bulb')}ヒント</button>`}
        <button class="btn primary" data-gcheck>答え合わせ <kbd>Enter</kbd></button></div>`;
      if (matchMedia('(hover: hover)').matches) setTimeout(() => $('#gin', el)?.focus(), 50);
    } else {
      sb.innerHTML = `<div class="qcard gq">${meta()}
        <div class="gq-en big">${esc(it.en)} ${speakBtn(it.en, 'en', 'sm', '英文を読み上げ')}</div>
        <textarea class="input gq-memo" id="gmemo" rows="2" placeholder="訳を書いてみる（書かなくてもOK）"></textarea>
        <div id="gfb"></div></div>`;
      sf.innerHTML = `<div class="foot-row"><button class="btn primary" data-greveal>訳を見る <kbd>Enter</kbd></button></div>`;
    }
  }

  /* 並べ替え */
  function drawOrder() {
    const used = new Set(placed);
    $('#gline', el).innerHTML = placed.map((i, k) => `<button class="gtok on" data-pl="${k}">${esc(tk.shown[i])}</button>`).join('')
      + (placed.length ? '' : '<span class="gq-ph">下の語をタップして並べよう</span>') + `<span class="gq-end">${esc(tk.end)}</span>`;
    $('#gpool', el).innerHTML = tk.order.map(i => `<button class="gtok" data-tk="${i}"${used.has(i) ? ' disabled' : ''}>${esc(tk.shown[i])}</button>`).join('');
    const b = $('[data-gcheck]', el); if (b) b.disabled = placed.length !== tk.shown.length;
  }
  function orderHint() {
    if (stage !== 'q') return;
    // 先頭から正しい語を1つずつ置いていく
    let k = 0;
    while (k < placed.length && tk.shown[placed[k]].toLowerCase() === tk.shown[k].toLowerCase()) k++;
    placed = placed.slice(0, k);
    if (k < tk.shown.length) {
      const want = tk.shown[k].toLowerCase();
      const idx = tk.shown.findIndex((w, i) => w.toLowerCase() === want && !placed.includes(i));
      placed.push(idx);
    }
    hintLv++;
    drawOrder();
  }

  /* 答え合わせ */
  function judge(sc, yours) {
    stage = 'a'; score = sc;
    S.res[S.pos] = sc;
    Grammar.log(it.id, sc);
    sc >= 1 ? Sfx.ok() : Sfx.ng();
    feedback(yours);
    footAfter();
  }
  function feedback(yours) {
    const v = score >= 1 ? `<div class="verdict ok">${icon('check')}正解！</div>`
      : score > 0 ? `<div class="verdict half">${icon('alert')}${type === 'ej' ? 'あやしい' : 'おしい'}</div>`
      : `<div class="verdict ng">${icon('x')}${type === 'ej' ? 'できなかった' : '不正解'}</div>`;
    const words = Grammar.words(it);
    $('#gfb', el).innerHTML = `${type === 'ej' && stage === 'r' ? '' : v}
      <div class="gq-ans">
        <div class="en">${fullEN()} ${speakBtn(it.en, 'en', 'sm', '英文を読み上げ')}</div>
        <div class="ja">${esc(it.ja)}</div>
        ${yours != null && yours !== '' ? `<div class="gq-yours"><span>あなたの答え</span>${esc(yours)}</div>` : ''}
      </div>
      ${Grammar.pointHTML(u, score < 1)}
      ${words.length ? `<div class="gq-words"><span>この文の単語</span>${words.slice(0, 10).map(w => `<button class="chip link" data-word="${esc(w.id)}">${esc(w.w)}<small>No.${w.no}</small></button>`).join('')}</div>` : ''}`;
    setTimeout(() => $('#gfb', el)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  }
  function footAfter() {
    const fix = type === 'je' && score < 1 ? `<button class="btn side" data-gfix>${icon('check')}正解にする</button>` : '';
    sf.innerHTML = `<div class="foot-row">${fix}<button class="btn primary" data-gnext>${S.pos + 1 >= S.q.length ? '結果を見る' : '次へ'} <kbd>Enter</kbd></button></div>`;
  }
  function choose(i) {
    if (stage !== 'q' || type !== 'fill') return;
    const btns = $$('.gq-choices .choice', el), b = btns[i];
    if (!b) return;
    const ok = b.dataset.opt === it.ans;
    btns.forEach(x => x.classList.add(x.dataset.opt === it.ans ? 'correct' : x === b ? 'wrong' : 'dim'));
    $('.gq-choices', el).classList.add('locked');
    $('.gq-blank', el).innerHTML = `<mark class="hl">${esc(it.ans)}</mark>`;
    judge(ok ? 1 : 0);
  }
  function checkOrder() {
    if (stage !== 'q' || placed.length !== tk.shown.length) return;
    const yours = placed.map(i => tk.shown[i]).join(' ');
    const ok = Grammar.norm(yours) === Grammar.norm(tk.shown.join(' '));
    $$('#gline .gtok', el).forEach((b, k) => b.classList.add(tk.shown[placed[k]].toLowerCase() === tk.shown[k].toLowerCase() ? 'good' : 'bad'));
    $('#gpool', el).innerHTML = '';
    judge(ok ? 1 : 0, ok ? null : yours + tk.end);
  }
  function checkJE() {
    if (stage !== 'q') return;
    const inp = $('#gin', el), yours = inp.value.trim();
    if (!yours) { inp.focus(); toast('英文を入力してください', 'err'); return; }
    const a = Grammar.norm(yours), b = Grammar.norm(it.en);
    let sc = 0;
    if (a === b) sc = 1;
    else if (lev(a, b) <= Math.max(1, Math.floor(b.length * 0.06))) sc = 0.5; // つづりの小さなミス
    inp.disabled = true;
    judge(sc, yours);
  }
  function revealEJ() {
    if (stage !== 'q') return;
    stage = 'r';
    memo = $('#gmemo', el).value.trim();
    $('#gmemo', el).disabled = true;
    feedback(memo || null);
    sf.innerHTML = `<div class="grades">${[['forgot', 'できなかった', 0], ['unsure', 'あやしい', 0.5], ['known', 'できた', 1]].map(([g, l, v], i) => `<button class="g g-${g}" data-gej="${v}"><span>${l}</span><kbd>${i + 1}</kbd></button>`).join('')}</div>`;
    if (Store.s.settings.autoSpeak) Speech.say(it.en);
  }
  function gradeEJ(v) {
    if (stage !== 'r') return;
    judge(v, memo || null);
  }
  function hintJE() {
    if (stage !== 'q') return;
    hintLv = Math.min(2, hintLv + 1);
    const t = Grammar.tokens(it);
    const h = $('#ghint', el);
    h.innerHTML = hintLv === 1
      ? `最初の語は <b>${esc(t.toks[0])}</b>、全部で <b>${t.toks.length}語</b><small>ヒント1</small>`
      : `使う語：${shuffle(t.shown.slice()).map(w => `<span class="gtok mini">${esc(w)}</span>`).join(' ')}<small>ヒント2</small>`;
    h.hidden = false;
  }
  function next() { if (stage !== 'a') return; S.pos++; show(); }
  function fixAsCorrect() {
    if (stage !== 'a' || type !== 'je' || score >= 1) return;
    const r = Store.s.gram[it.id]; r.c += 1 - score; r.r = 1; Store.save();
    const d = Store.s.stats.daily[dkey()]; if (d && score < 1) { d.ok++; }
    score = 1; S.res[S.pos] = 1;
    $('.verdict', el).outerHTML = `<div class="verdict ok">${icon('check')}正解にしました</div>`;
    footAfter();
  }

  async function quit() {
    if (!S.res.length) { location.hash = '#/grammar'; return; }
    if (S.pos < S.q.length && !await confirmBox('演習を終了', 'ここまでの回答は保存済みです。結果を表示して終了しますか？', { ok: '終了して結果を見る' })) return;
    summary(false);
  }
  function summary(finished) {
    stage = 'done';
    Speech.cancel();
    document.body.classList.remove('focus-mode');
    Pomo.undock();
    const done = S.q.slice(0, S.res.length);
    const n = done.length;
    const sum = S.res.reduce((a, b) => a + (b || 0), 0);
    const scoreAll = n ? Math.round(sum / n * 1000) / 10 : 0;
    const eligible = finished && n >= Rank.MIN_WORDS;
    const rank = eligible ? Rank.of(scoreAll, Rank.STUDY_TH) : 0;
    const rres = eligible ? Rank.record('gram', S.key, rank, scoreAll) : null;
    const note = !finished ? '途中で終了したので、ランク判定はありません' : n < Rank.MIN_WORDS ? `${Rank.MIN_WORDS}問以上を解くとランクが付きます（今回 ${n}問）` : '';
    const c = { known: 0, unsure: 0, forgot: 0, new: 0, total: n };
    S.res.forEach(r => c[r >= 1 ? 'known' : r > 0 ? 'unsure' : 'forgot']++);
    const wrong = done.filter((x, i) => S.res[i] < 1);
    // 単元ごとの出来（複数単元のときだけ）
    const byUnit = new Map();
    done.forEach((x, i) => { const uid = Grammar.byId.get(x.id).unit; const a = byUnit.get(uid) || { n: 0, s: 0 }; a.n++; a.s += S.res[i]; byUnit.set(uid, a); });
    const unitRows = byUnit.size > 1 ? [...byUnit.entries()].sort((a, b) => a[1].s / a[1].n - b[1].s / b[1].n).map(([uid, a]) => {
      const uu = Grammar.unitById.get(uid), p = Math.round(a.s / a.n * 100);
      return `<tr><td><span class="chip">${uu.grade}</span> ${esc(uu.name)}</td><td class="num">${+a.s.toFixed(1)}/${a.n}</td><td><div class="meter"><i style="width:${p}%;background:${p >= 100 ? 'var(--known)' : p > 0 ? 'var(--unsure)' : 'var(--forgot)'}"></i></div></td><td><a class="btn sm" href="#/gsession?u=${uid}&t=mix">${p < 100 ? '復習' : 'もう一度'}</a></td></tr>`;
    }).join('') : '';
    el.innerHTML = `<div class="summary">
      <section class="card sum-hero">
        <div class="hero-label">${esc(o.label)} の得点</div>
        <div class="hero-fig">${scoreAll}<small>点</small></div>
        <p class="muted" style="margin:6px 0 16px">${o.exam ? '4形式ミックス' : esc(GTYPES[o.t]?.t || '')} · ${n}問 · ${fmtDur(Date.now() - S.t0)}</p>
        ${n ? Rank.resultHTML({ r: rank, score: scoreAll, unit: '点', th: Rank.STUDY_TH, res: rres, note }) : ''}
        ${n ? segBar(c, { tall: true, label: '結果' }) + `<div style="margin-top:10px;display:flex;justify-content:center"><div class="legend"><span><i class="s-known"></i>正解 <b>${c.known}</b></span><span><i class="s-unsure"></i>おしい・あやしい <b>${c.unsure}</b></span><span><i class="s-forgot"></i>不正解 <b>${c.forgot}</b></span></div></div>` : ''}
      </section>
      <div class="row" style="justify-content:center">
        ${wrong.length ? `<button class="btn primary" data-gwrong>${icon('repeat')}間違えた ${wrong.length}問をやり直す</button>` : ''}
        <button class="btn" data-gagain>${icon('refresh')}${o.exam ? '別の問題でもう一度' : '同じ条件でもう一度'}</button>
        <a class="btn ghost" href="#/grammar">${icon('book')}文法トップへ</a>
      </div>
      ${unitRows ? `<section class="card"><h2>${icon('grid')}単元ごとの出来（苦手な順）</h2><div style="overflow-x:auto"><table class="gunit-table">${unitRows}</table></div></section>` : ''}
      <section class="card"><h2>${icon('list')}解いた問題</h2><div class="gsum-list">${done.map((x, i) => {
        const t = Grammar.byId.get(x.id), r = S.res[i];
        return `<div class="gsum-item"><span class="pill ${r >= 1 ? 'known' : r > 0 ? 'unsure' : 'forgot'}">${r >= 1 ? '正解' : r > 0 ? 'おしい' : '不正解'}</span>
          <div><div class="en">${esc(t.pre)}<mark class="hl">${esc(t.ans)}</mark>${esc(t.post)}</div><div class="ja">${esc(t.ja)} <span class="muted">· ${esc(Grammar.unitById.get(t.unit).name)} · ${GTYPES[x.type].t}</span></div></div></div>`;
      }).join('')}</div></section>
    </div>`;
    window.scrollTo(0, 0);
    if (n && (scoreAll >= 90 || rres?.up)) { Sfx.done(); confetti(); }
    el.onclick = e => {
      if (e.target.closest('[data-gwrong]')) { Grammar.pending = { list: wrong, label: '間違えた問題' }; Router.name === 'gsession' && location.hash.includes('u=ids') ? Router.refresh() : (location.hash = '#/gsession?u=ids'); }
      else if (e.target.closest('[data-gagain]')) Router.refresh();
    };
  }

  el.addEventListener('click', e => {
    if (stage === 'done') return;
    if (e.target.closest('[data-quit]')) return quit();
    const c = e.target.closest('.gq-choices .choice'); if (c) return choose($$('.gq-choices .choice', el).indexOf(c));
    const t = e.target.closest('[data-tk]'); if (t && stage === 'q') { placed.push(+t.dataset.tk); drawOrder(); return; }
    const p = e.target.closest('[data-pl]'); if (p && stage === 'q') { placed.splice(+p.dataset.pl, 1); drawOrder(); return; }
    if (e.target.closest('[data-greset]')) { if (stage === 'q') { placed = []; drawOrder(); } return; }
    if (e.target.closest('[data-ghint]')) return type === 'order' ? orderHint() : hintJE();
    if (e.target.closest('[data-gcheck]')) return type === 'order' ? checkOrder() : checkJE();
    if (e.target.closest('[data-greveal]')) return revealEJ();
    const g = e.target.closest('[data-gej]'); if (g) return gradeEJ(+g.dataset.gej);
    if (e.target.closest('[data-gnext]')) return next();
    if (e.target.closest('[data-gfix]')) return fixAsCorrect();
    const w = e.target.closest('[data-word]'); if (w) openWord(w.dataset.word);
  });
  const onKey = e => {
    if (stage === 'done' || document.querySelector('.modal-wrap')) return;
    if (e.target.matches?.('input, textarea, select')) {
      if (e.key === 'Enter' && e.target.id === 'gin' && !e.isComposing) { e.preventDefault(); if (stage === 'q') checkJE(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (stage === 'a') { if (k === 'Enter' || k === ' ') { e.preventDefault(); next(); } return; }
    if (stage === 'r') { if (['1', '2', '3'].includes(k)) gradeEJ([0, 0.5, 1][+k - 1]); return; }
    if (type === 'fill' && ['1', '2', '3', '4'].includes(k)) choose(+k - 1);
    else if (type === 'order') {
      if (k === 'Enter') { e.preventDefault(); checkOrder(); }
      else if (k === 'Backspace' && placed.length) { e.preventDefault(); placed.pop(); drawOrder(); }
    } else if (type === 'ej' && k === 'Enter') { e.preventDefault(); revealEJ(); }
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => {
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('focus-mode');
    Pomo.undock();
    Speech.cancel();
  };
};
