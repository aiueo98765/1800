'use strict';
/* ============================================================
   学習：範囲とモードの選択 → セッション（意味だけ表示 / A手書き / B4択 / B自己採点 / ディクテーション）
   ============================================================ */
const MODES = {
  recall: { ic: 'eye-off', t: '意味だけ表示', d: 'スペルを隠し、意味と例文（空所つき）から単語を頭の中で思い出す' },
  write: { ic: 'pen', t: 'A 意味 → スペル（手書き）', d: '日本語の意味を見て、キャンバスにつづりを手書き。答え合わせで正解を重ねて表示' },
  choice: { ic: 'choice', t: 'B スペル → 意味（4択）', d: '英単語を見て正しい意味を4つから選ぶ。自動採点' },
  self: { ic: 'mic', t: 'B スペル → 意味（口頭で答える）', d: '英単語を見て意味を声に出して答え、表示して自己採点' },
  dict: { ic: 'ear', t: 'ディクテーション', d: '音声だけを頼りに、画面を見ずにつづりを書き取る' },
};

const StudyStart = {
  pending: null,
  fromIds(ids, label) { this.pending = { ids, label }; go('#/study?range=ids'); },
};
function go(hash) { if (location.hash === hash) Router.refresh(); else location.hash = hash; }

/* ---------- 範囲とモードの選択 ---------- */
Views.study = (el, q) => {
  const S = Store.s.settings.study;
  const o = {
    range: q.get('range') || S.range, mode: q.get('mode') || S.mode,
    count: q.has('count') ? parseInt(q.get('count'), 10) || 0 : S.count,
    order: q.get('order') || S.order, loop: q.has('loop') ? q.get('loop') === '1' : S.loop,
    exam: q.get('exam') === '1', skipKnown: q.has('range') ? false : S.skipKnown, from: S.from, to: S.to,
  };
  if (!MODES[o.mode]) o.mode = 'recall';
  if (o.range === 'ids' && !StudyStart.pending) o.range = 'all';
  if (o.exam) o.loop = false;
  if (['due', 'weak', 'st:forgot', 'st:unsure'].includes(o.range)) o.skipKnown = false;

  const words = () => {
    let list = o.range === 'ids' ? StudyStart.pending.ids.map(id => Deck.get(id)).filter(Boolean) : rangeWords(o.range, o.from, o.to);
    if (o.skipKnown) list = list.filter(w => SRS.status(w.id) !== 'known');
    return list;
  };
  const segBtns = (name, opts, cur) => `<div class="seg-ctl" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;

  el.innerHTML = `
  <div class="page-head"><div><h1>学習をはじめる</h1><p>範囲とモードを選んでスタート。回答はすべて間隔反復エンジンに記録されます</p></div></div>
  <div class="setup">
    <div class="stack">
      <section class="card">
        <h2><span class="step-n">1</span>範囲</h2>
        <div id="rg-wrap">${rangeSelectHTML('rg', o.range)}</div>
        <div class="range-row" id="nums" ${o.range === 'nums' ? '' : 'hidden'} style="margin-top:10px">
          <div class="nums">No.<input class="input" type="number" id="n-from" min="1" value="${o.from}"> 〜 <input class="input" type="number" id="n-to" min="1" value="${o.to}"></div>
        </div>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="skip"${o.skipKnown ? ' checked' : ''}><span class="tg"></span><span>「覚えた」単語を除く</span></label>
        <div class="count-line">対象 <b id="cnt">0</b> 語 <span class="muted" id="cnt-sub"></span></div>
      </section>
      <section class="card">
        <h2><span class="step-n">3</span>出題のしかた</h2>
        <div class="opt-group"><span>出題数</span>${segBtns('count', [[10, '10'], [20, '20'], [50, '50'], [100, '100'], [0, 'すべて']], o.count)}</div>
        <div class="opt-group"><span>順番</span>${segBtns('order', [['num', '番号順'], ['rand', 'ランダム'], ['weak', '苦手順']], o.order)}</div>
        <label class="check"><input type="checkbox" id="loop"${o.loop ? ' checked' : ''}><span class="tg"></span><span>苦手克服ループ<small>「忘れた」は3問後、「怪しい」は6問後にもう一度。全部「覚えた」になるまで終わりません</small></span></label>
        <label class="check"><input type="checkbox" id="exam"${o.exam ? ' checked' : ''}><span class="tg"></span><span>模試モード<small>ループなしで1回ずつ出題し、最後に点数を出します</small></span></label>
        <label class="check"><input type="checkbox" id="auto"${Store.s.settings.autoSpeak ? ' checked' : ''}><span class="tg"></span><span>答えを出したら自動で発音</span></label>
      </section>
    </div>
    <section class="card">
      <h2><span class="step-n">2</span>モード</h2>
      <div class="mode-pick">${Object.entries(MODES).map(([k, m]) => `
        <label class="mode-opt"><input type="radio" name="mode" value="${k}"${k === o.mode ? ' checked' : ''}>
          <span class="mode-ico">${icon(m.ic)}</span><span><b>${m.t}</b><small>${m.d}</small></span></label>`).join('')}
      </div>
      <button class="btn primary xl block setup-go" id="go" style="margin-top:16px">${icon('play')}<span id="go-label">スタート</span></button>
    </section>
  </div>`;

  if (o.range === 'ids' && StudyStart.pending) {
    const sel = $('#rg', el);
    sel.insertAdjacentHTML('afterbegin', `<option value="ids" selected>${esc(StudyStart.pending.label)}</option>`);
    sel.value = 'ids';
  }
  const update = () => {
    const n = words().length;
    const take = o.count ? Math.min(o.count, n) : n;
    $('#cnt', el).textContent = nfmt(n);
    $('#cnt-sub', el).textContent = n ? `（${take}語を出題）` : '';
    $('#go-label', el).textContent = n ? `${take}語でスタート` : '対象の単語がありません';
    $('#go', el).disabled = !n;
    $('#nums', el).hidden = o.range !== 'nums';
  };
  el.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'rg') o.range = t.value;
    if (t.id === 'n-from') o.from = t.value;
    if (t.id === 'n-to') o.to = t.value;
    if (t.id === 'skip') o.skipKnown = t.checked;
    if (t.id === 'loop') { o.loop = t.checked; if (o.loop) { o.exam = false; $('#exam', el).checked = false; } }
    if (t.id === 'exam') { o.exam = t.checked; if (o.exam) { o.loop = false; $('#loop', el).checked = false; } }
    if (t.id === 'auto') { Store.s.settings.autoSpeak = t.checked; Store.save(); }
    if (t.name === 'mode') o.mode = t.value;
    update();
  });
  el.addEventListener('input', e => { if (e.target.id === 'n-from' || e.target.id === 'n-to') { o[e.target.id === 'n-from' ? 'from' : 'to'] = e.target.value; update(); } });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-seg] button'); if (!b) return;
    const name = b.parentElement.dataset.seg;
    o[name] = name === 'count' ? +b.dataset.v : b.dataset.v;
    $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  const start = () => {
    let list = orderWords(words(), o.order);
    if (o.count) list = list.slice(0, o.count);
    if (!list.length) return;
    if (o.range !== 'ids') Object.assign(S, { range: o.range, mode: o.mode, count: o.count, order: o.order, loop: o.loop, exam: false, skipKnown: o.skipKnown, from: o.from, to: o.to });
    Store.save();
    const label = o.range === 'ids' ? StudyStart.pending.label : rangeLabel(o.range, o.from, o.to);
    Session.start(list, { ...o, label });
  };
  $('#go', el).onclick = start;
  update();
  if (q.get('go') === '1' && words().length) setTimeout(() => { history.replaceState(null, '', '#/study'); start(); }, 0);
};

/* ---------- セッション ---------- */
const Session = {
  cur: null,
  start(words, o) {
    if (!words.length) { toast('対象の単語がありません', 'err'); return; }
    const ids = words.map(w => w.id);
    this.cur = { o: { ...o }, q: ids.slice(), orig: ids, pos: 0, first: {}, last: {}, retry: {}, tries: 0, t0: Date.now() };
    go('#/session');
  },
};
const GRADES = ['forgot', 'unsure', 'known'];
function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // 隣り合う2文字の入れ替わりも1ミス
  }
  return d[m][n];
}
function ansHTML(w, { showWord = true } = {}) {
  return `<div class="ans">
    ${showWord ? `<div class="ans-word"><span class="hw">${esc(w.w)}</span>${speakBtn(w.w)}<span style="flex:1"></span><button class="btn sm ghost" data-open>${icon('tag')}カード・タグ</button></div>` : `<div class="row" style="justify-content:flex-end"><button class="btn sm ghost" data-open>${icon('tag')}カード・タグ</button></div>`}
    <div class="ans-mean"><span class="chip pos">${POS[w.p]}</span>${esc(w.m)}</div>
    ${w.e ? `<div class="q-ex"><div class="en">${hlEx(w.e)} ${speakBtn(plainEx(w.e), 'en', 'sm', '例文を読み上げ')}</div>${w.j ? `<div class="ja">${esc(w.j)}</div>` : ''}</div>` : ''}
    ${relHTML(w)}
  </div>`;
}

Views.session = el => {
  const S = Session.cur;
  if (!S) { location.replace('#/study'); return; }
  document.body.classList.add('focus-mode');
  el.innerHTML = `<div class="sess">
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
  const mode = S.o.mode;
  let pad = null, stage = 'q', w = null, t0 = 0, suggested = null, kb = false, hintLv = 0;

  const progress = () => {
    const total = S.q.length;
    $('#sp-count', el).textContent = `${Math.min(S.pos + 1, total)} / ${total}`;
    $('#sp-bar', el).style.width = `${S.pos / total * 100}%`;
    $('#sp-mode', el).textContent = `${MODES[mode].t} · ${S.o.label}${S.o.loop ? ' · ループ' : ''}${S.o.exam ? ' · 模試' : ''}`;
  };
  const meta = () => `<div class="q-meta"><span class="chip pos">${POS[w.p]}</span><span class="num">No.${w.no}</span>${pill(SRS.status(w.id))}${S.retry[w.id] ? '<span class="chip">再出題</span>' : ''}<span class="grow"></span></div>`;
  const exBlank = () => w.e ? `<div class="q-ex"><div class="en">${blankEx(w.e)}</div>${w.j ? `<div class="ja">${esc(w.j)}</div>` : ''}</div>` : '';
  const footQ = label => `<div class="foot-row">
    ${mode === 'recall' || mode === 'write' ? `<button class="btn side" data-hint>${icon('bulb')}ヒント</button>` : ''}
    <button class="btn primary" data-reveal>${label} <kbd>Enter</kbd></button></div>`;

  function show() {
    pad?.destroy(); pad = null;
    stage = 'q'; suggested = null; kb = false; hintLv = 0;
    if (S.pos >= S.q.length) return summary();
    w = Deck.get(S.q[S.pos]);
    if (!w) { S.pos++; return show(); }
    t0 = Date.now();
    progress();
    if (mode === 'recall') {
      sb.innerHTML = `<div class="qcard">${meta()}<div class="q-meaning">${esc(w.m)}</div>${exBlank()}<div class="q-hint" id="hint" hidden></div><div id="ans"></div></div>`;
      sf.innerHTML = footQ('答えを見る');
    } else if (mode === 'write') {
      sb.innerHTML = `<div class="qcard">${meta()}<div class="q-meaning">${esc(w.m)}</div>${exBlank()}<div class="q-hint" id="hint" hidden></div><div id="verdict"></div></div>${padBlock('pad')}<div id="ans" class="ans-out"></div>`;
      sf.innerHTML = footQ('答え合わせ');
      mountPad();
    } else if (mode === 'choice') {
      const cs = makeChoices(w, 'en');
      sb.innerHTML = `<div class="qcard">${meta()}<div class="q-word"><span class="hw">${esc(w.w)}</span>${speakBtn(w.w)}</div>
        <div class="choices">${cs.map((c, i) => `<button class="choice" data-id="${esc(c.id)}"><kbd>${i + 1}</kbd>${esc(c.m)}</button>`).join('')}</div>
        <div id="verdict"></div><div id="ans"></div></div>`;
      sf.innerHTML = `<p class="muted" style="text-align:center;margin:0;font-size:13px">正しい意味を選んでください（キー 1〜4）</p>`;
      if (Store.s.settings.autoSpeak) setTimeout(() => Speech.say(w.w), 150);
    } else if (mode === 'self') {
      sb.innerHTML = `<div class="qcard">${meta()}<div class="q-word"><span class="hw">${esc(w.w)}</span>${speakBtn(w.w)}</div>
        <p class="muted" style="margin:14px 0 0">意味を声に出して答えてから表示しましょう</p><div id="ans"></div></div>`;
      sf.innerHTML = footQ('意味を見る');
      if (Store.s.settings.autoSpeak) setTimeout(() => Speech.say(w.w), 150);
    } else if (mode === 'dict') {
      sb.innerHTML = `<div class="qcard">${meta()}
        <div class="dict-play">
          <button class="icon-btn" data-slow data-tip="ゆっくり再生" aria-label="ゆっくり再生" style="width:52px;height:52px;border:1px solid var(--line);border-radius:50%">${icon('turtle')}</button>
          <button class="dict-btn" data-play aria-label="音声を再生">${icon('volume')}</button>
          <button class="icon-btn" data-mhint data-tip="意味のヒント" aria-label="意味のヒントを表示" style="width:52px;height:52px;border:1px solid var(--line);border-radius:50%">${icon('eye')}</button>
        </div>
        <p class="muted" style="text-align:center;margin:6px 0 0;font-size:13px">聞こえた単語を下に書き取ろう（R キーで再生）</p>
        <div class="q-meaning" id="mhint" hidden style="font-size:18px;text-align:center;margin-top:8px">${esc(w.m)}</div>
        <div id="verdict"></div></div>${padBlock('pad')}<div id="ans" class="ans-out"></div>`;
      sf.innerHTML = footQ('答え合わせ');
      mountPad();
      setTimeout(() => playDict(), 250);
    }
    window.scrollTo(0, 0);
  }
  function mountPad() {
    pad = new Pad($('#pad', el));
    bindPadTools($('.pad-wrap', el), pad, {
      onKb: on => { kb = on; const inp = $('#pad-kb', el); inp.hidden = !on; if (on) inp.focus(); },
    });
  }
  async function playDict(rate) {
    const b = $('[data-play]', el); b?.classList.add('playing');
    await Speech.say(w.w, 'en', rate);
    b?.classList.remove('playing');
  }
  function hint() {
    if (stage !== 'q') return;
    hintLv = Math.min(2, hintLv + 1);
    const chars = [...w.w];
    const s = hintLv === 1 ? chars.map((c, i) => i === 0 || c === ' ' ? c : '_').join(' ') : chars.map((c, i) => i % 2 === 0 || c === ' ' ? c : '_').join(' ');
    const h = $('#hint', el); h.innerHTML = `${esc(s)}<small>${w.w.length}文字・ヒント${hintLv}</small>`; h.hidden = false;
  }
  function reveal() {
    if (stage !== 'q') return;
    stage = 'a';
    let verdict = '';
    if (mode === 'write' || mode === 'dict') {
      pad?.showAnswer(w.w);
      const typed = kb ? $('#pad-kb', el).value.trim() : '';
      if (typed) {
        const a = typed.toLowerCase(), b = w.w.toLowerCase();
        const d = lev(a, b);
        suggested = d === 0 ? 'known' : d === 1 && b.length >= 5 ? 'unsure' : 'forgot';
        d === 0 ? Sfx.ok() : Sfx.ng();
        const diff = [...typed].map((c, i) => c.toLowerCase() === (b[i] || '') ? esc(c) : `<span class="bad">${esc(c)}</span>`).join('');
        verdict = d === 0 ? `<div class="verdict ok">${icon('check')}正解！</div>`
          : `<div class="verdict ng">${icon('x')}${d === 1 ? 'おしい（1文字ちがい）' : '不正解'}　<span class="diff">${diff}</span></div>`;
      } else {
        verdict = `<div class="verdict" style="color:var(--ink-2)">${icon('pen')}書いた文字と、重ねた正解を見比べて自己採点しよう</div>`;
        if (pad && pad.isEmpty()) suggested = 'forgot';
      }
      $('#verdict', el).innerHTML = verdict;
      $('#mhint', el)?.removeAttribute('hidden');
    }
    if (hintLv && !suggested) suggested = 'unsure';
    $('#ans', el).innerHTML = ansHTML(w, { showWord: mode !== 'self' });
    afterReveal();
  }
  function choose(i) {
    if (stage !== 'q' || mode !== 'choice') return;
    const btns = $$('.choice', el), b = btns[i];
    if (!b) return;
    stage = 'a';
    const ok = b.dataset.id === w.id;
    const secs = (Date.now() - t0) / 1000;
    btns.forEach(x => x.classList.add(x.dataset.id === w.id ? 'correct' : x === b ? 'wrong' : 'dim'));
    $('.choices', el).classList.add('locked');
    suggested = ok ? (secs > Store.s.settings.slowSec ? 'unsure' : 'known') : 'forgot';
    ok ? Sfx.ok() : Sfx.ng();
    $('#verdict', el).innerHTML = ok ? `<div class="verdict ok">${icon('check')}正解${suggested === 'unsure' ? `（${secs.toFixed(1)}秒かかったので「怪しい」がおすすめ）` : ''}</div>`
      : `<div class="verdict ng">${icon('x')}不正解</div>`;
    $('#ans', el).innerHTML = ansHTML(w, { showWord: false });
    afterReveal(false);
  }
  function afterReveal(speak = true) {
    if (speak && Store.s.settings.autoSpeak && mode !== 'self') Speech.say(w.w);
    if (S.o.exam && mode === 'choice') {
      sf.innerHTML = `<div class="foot-row"><button class="btn primary" data-next>次へ <kbd>Enter</kbd></button></div>`;
    } else {
      sf.innerHTML = `<div class="grades">${GRADES.map((g, i) => `<button class="g g-${g}${g === suggested ? ' suggest' : ''}" data-g="${g}"><span>${STATUS[g]}</span><kbd>${i + 1}</kbd></button>`).join('')}</div>`;
    }
    setTimeout(() => ($('.pad-wrap', el) || $('#ans', el))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  }
  function grade(g) {
    if (stage !== 'a' || !w) return;
    stage = 'busy';
    SRS.grade(w.id, g);
    if (!(w.id in S.first)) S.first[w.id] = g;
    S.last[w.id] = g;
    S.tries++;
    if (S.o.loop && g !== 'known') {
      const at = Math.min(S.q.length, S.pos + 1 + (g === 'forgot' ? 3 : 6));
      S.q.splice(at, 0, w.id);
      S.retry[w.id] = true;
    }
    S.pos++;
    show();
  }
  async function quit() {
    if (!Object.keys(S.first).length) { location.hash = '#/study'; return; }
    if (S.pos < S.q.length && !await confirmBox('セッションを終了', 'ここまでの回答は保存済みです。結果を表示して終了しますか？', { ok: '終了して結果を見る' })) return;
    summary();
  }

  function summary() {
    pad?.destroy(); pad = null; stage = 'done';
    Speech.cancel();
    document.body.classList.remove('focus-mode');
    Pomo.undock();
    const ids = Object.keys(S.first);
    const n = ids.length;
    const firstKnown = ids.filter(id => S.first[id] === 'known').length;
    const c = { known: 0, unsure: 0, forgot: 0, new: 0, total: n };
    ids.forEach(id => c[S.last[id]]++);
    const firstWeak = ids.filter(id => S.first[id] !== 'known');
    const acc = pct(firstKnown, n);
    // スコアランク：10語以上を最後まで解いたときだけ判定し、範囲ごとの最高を残す
    const finished = S.pos >= S.q.length;
    const score = Rank.studyScore(S.first);
    const eligible = finished && n >= Rank.MIN_WORDS;
    const rank = eligible ? Rank.of(score, Rank.STUDY_TH) : 0;
    const rkey = S.o.range === 'ids' ? null : Rank.key(S.o.range, S.o.from, S.o.to);
    const rres = eligible ? Rank.record('study', rkey, rank, score) : null;
    const rnote = !finished ? '途中で終了したので、ランク判定はありません'
      : n < Rank.MIN_WORDS ? `${Rank.MIN_WORDS}語以上を解くとランクが付きます（今回 ${n}語）` : '';
    el.innerHTML = `<div class="summary">
      <section class="card sum-hero">
        <div class="hero-label">${S.o.exam ? '模試の得点（1回目で正解した割合）' : '1回目で「覚えた」と答えた割合'}</div>
        <div class="hero-fig">${acc}<small>${S.o.exam ? '点' : '%'}</small></div>
        <p class="muted" style="margin:6px 0 16px">${esc(MODES[mode].t)} · ${esc(S.o.label)}<br>出題 ${n}語 · 回答 ${S.tries}回 · ${fmtDur(Date.now() - S.t0)}</p>
        ${n ? Rank.resultHTML({ r: rank, score, unit: '点', th: Rank.STUDY_TH, res: rres, note: rnote }) : ''}
        ${n ? segBar(c, { tall: true, label: '最終的な状態' }) + '<div style="margin-top:10px;display:flex;justify-content:center">' + legendHTML(c) + '</div>' : ''}
      </section>
      <div class="row" style="justify-content:center">
        ${firstWeak.length ? `<button class="btn primary" data-again-weak>${icon('repeat')}つまずいた ${firstWeak.length}語をもう一周</button>` : ''}
        <button class="btn" data-again>${icon('refresh')}同じ範囲でもう一度</button>
        <a class="btn ghost" href="#/home">${icon('home')}ホームへ</a>
      </div>
      ${n ? `<section class="card"><h2>${icon('list')}出題した単語</h2><div class="sum-list">${ids.map(id => {
        const x = Deck.get(id); if (!x) return '';
        return `<div class="sum-item" data-word="${esc(id)}"><span class="hw">${esc(x.w)}</span><span class="m">${esc(x.m)}</span>${S.first[id] !== S.last[id] ? pill(S.first[id]) + icon('right') : ''}${pill(S.last[id])}</div>`;
      }).join('')}</div></section>` : ''}
    </div>`;
    window.scrollTo(0, 0);
    if (n && (acc >= 90 || rres?.up)) { Sfx.done(); confetti(); }
    el.onclick = e => {
      // つまずいた語だけの周回は範囲のランクに数えない（range: 'ids'）
      if (e.target.closest('[data-again-weak]')) Session.start(firstWeak.map(id => Deck.get(id)).filter(Boolean), { ...S.o, range: 'ids', loop: !S.o.exam, label: 'つまずいた単語' });
      else if (e.target.closest('[data-again]')) Session.start(orderWords(S.orig.map(id => Deck.get(id)).filter(Boolean), S.o.order === 'num' ? 'num' : S.o.order === 'weak' ? 'weak' : 'rand'), S.o);
      else { const r = e.target.closest('[data-word]'); if (r) openWord(r.dataset.word); }
    };
  }

  el.addEventListener('click', e => {
    if (stage === 'done') return;
    if (e.target.closest('[data-quit]')) return quit();
    if (e.target.closest('[data-reveal]')) return reveal();
    if (e.target.closest('[data-hint]')) return hint();
    if (e.target.closest('[data-next]')) return grade(suggested);
    const g = e.target.closest('[data-g]'); if (g) return grade(g.dataset.g);
    const c = e.target.closest('.choice'); if (c) return choose($$('.choice', el).indexOf(c));
    if (e.target.closest('[data-play]')) return playDict();
    if (e.target.closest('[data-slow]')) return playDict(0.55);
    if (e.target.closest('[data-mhint]')) { $('#mhint', el).hidden = !$('#mhint', el).hidden; return; }
    if (e.target.closest('[data-open]')) return openWord(w.id);
    const j = e.target.closest('[data-jump]'); if (j) { openWord(j.dataset.jump); if (Store.s.settings.autoSpeak) Speech.say(Deck.get(j.dataset.jump).w); }
  });
  const onKey = e => {
    if (stage === 'done' || document.querySelector('.modal-wrap')) return;
    if (e.target.matches?.('input, textarea, select')) {
      if (e.key === 'Enter' && e.target.id === 'pad-kb') { e.preventDefault(); if (stage === 'q') reveal(); else if (suggested) grade(suggested); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && pad) { e.preventDefault(); pad.undo(); } return; }
    const k = e.key.toLowerCase();
    if (stage === 'a') {
      if (S.o.exam && mode === 'choice') { if (k === 'enter' || k === ' ') { e.preventDefault(); grade(suggested); } return; }
      if (['1', '2', '3'].includes(k)) grade(GRADES[+k - 1]);
      else if ((k === 'enter' || k === ' ') && suggested) { e.preventDefault(); grade(suggested); }
    } else if (stage === 'q') {
      if (mode === 'choice' && ['1', '2', '3', '4'].includes(k)) choose(+k - 1);
      else if (k === 'enter' || (k === ' ' && mode !== 'choice')) { e.preventDefault(); reveal(); }
      else if (k === 'h') hint();
      else if (k === 'r' && mode === 'dict') playDict();
    }
    if (k === 's' && (stage === 'a' || mode === 'choice' || mode === 'self')) Speech.say(w.w);
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => {
    document.removeEventListener('keydown', onKey);
    pad?.destroy();
    document.body.classList.remove('focus-mode');
    Pomo.undock();
    Speech.cancel();
  };
};

/* 紙吹雪 */
function confetti(n = 70) {
  const cols = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
    s.style.cssText = `left:50%;top:35%;background:${cols[i % cols.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d + 120}px;width:${6 + Math.random() * 6}px;height:${6 + Math.random() * 6}px;border-radius:${Math.random() > .5 ? '50%' : '2px'};animation-duration:${.8 + Math.random() * .7}s`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1600);
  }
}
