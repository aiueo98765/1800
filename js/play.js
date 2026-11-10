'use strict';
/* ============================================================
   60秒タイムアタック ＆ ながら聴き・シャドーイング
   ============================================================ */

/* ---------- 60秒タイムアタック ---------- */
Views.attack = el => {
  const A = Store.s.settings.attack;
  const DUR = 60000;
  const TIERS = [0, 5, 10, 20, 30];
  const TIER_NAME = ['', 'NICE!', 'GREAT!!', 'FEVER!!!', 'GODLIKE!!!!'];
  let raf = 0, alive = true, answering = false;
  let words = [], qi = 0, cur = null, score = 0, correct = 0, wrong = 0, combo = 0, maxCombo = 0, endAt = 0, qStart = 0, tier = 0, wrongIds = [];
  const later = (fn, ms) => setTimeout(() => { if (alive) fn(); }, ms);

  function menu() {
    document.body.classList.remove('focus-mode');
    Pomo.undock();
    const ta = Store.s.stats.ta;
    el.innerHTML = `<div class="ta-menu">
      <div class="page-head"><div><h1>60秒タイムアタック</h1><p>制限時間内に何問解けるか。連続正解でコンボが伸び、演出がどんどん派手になります</p></div></div>
      <section class="card">
        <div class="ta-best">
          <div class="tile"><span class="tile-label">${icon('trophy')}最高正解数</span><span class="tile-value">${ta.bestCorrect}<small>問</small></span></div>
          <div class="tile"><span class="tile-label">${icon('flame')}最大コンボ</span><span class="tile-value">${ta.bestCombo}</span></div>
          <div class="tile"><span class="tile-label">${icon('zap')}ハイスコア</span><span class="tile-value">${nfmt(ta.bestScore)}</span></div>
        </div>
        <div class="ta-rank" id="ta-rank"></div>
        <div class="set-grid mt">
          <label class="field"><span>出題範囲</span>${rangeSelectHTML('ta-range', A.range)}</label>
          <div class="field"><span>出題形式</span><div class="seg-ctl" id="ta-dir">${[['en', '英 → 日'], ['ja', '日 → 英'], ['mix', 'ミックス']].map(([v, l]) => `<button data-v="${v}" class="${A.dir === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        </div>
        <div class="range-row" id="ta-nums" ${A.range === 'nums' ? '' : 'hidden'} style="margin-top:10px"><div class="nums">No.<input class="input" type="number" id="ta-from" value="${A.from}"> 〜 <input class="input" type="number" id="ta-to" value="${A.to}"></div></div>
        <ul class="muted" style="font-size:13px;line-height:1.9;margin:14px 0 0;padding-left:1.2em">
          <li>正解で +100点 × コンボ倍率（5コンボごとに +0.5倍）＋ スピードボーナス</li>
          <li>不正解は <b>−3秒</b>＆コンボ切れ。その単語は自動で「要復習リスト」へ</li>
          <li>5・10・20・30 コンボで演出が変化。キー 1〜4 でも回答できます</li>
          <li>得点に応じて全7段階のスコアランク（${Rank.TIERS.map(T => T.k).join('・')}）が付き、出題範囲ごとに最高ランクが残ります</li>
        </ul>
        <button class="btn primary xl block mt" id="ta-go">${icon('zap')}スタート</button>
      </section></div>`;
    const showRank = () => {
      const key = Rank.key(A.range, A.from, A.to), b = Rank.best('ta', key);
      $('#ta-rank', el).innerHTML = `${Rank.badge(b?.r || 0, 44)}<div><span class="tile-label">この範囲の最高ランク</span>
        <b>${b ? `「${Rank.name(b.r)}」<small>${nfmt(b.s)}点</small>` : key ? 'まだありません' : 'この範囲は記録しません'}</b></div>
        <button class="btn sm ghost" data-rank-guide aria-label="ランク表">${icon('info')}<span>ランク表</span></button>`;
    };
    showRank();
    $('#ta-range', el).onchange = e => { A.range = e.target.value; $('#ta-nums', el).hidden = A.range !== 'nums'; Store.save(); showRank(); };
    $('#ta-from', el).onchange = e => { A.from = e.target.value; Store.save(); showRank(); };
    $('#ta-to', el).onchange = e => { A.to = e.target.value; Store.save(); showRank(); };
    $('#ta-dir', el).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; A.dir = b.dataset.v; Store.save(); $$('#ta-dir button', el).forEach(x => x.classList.toggle('on', x === b)); };
    $('#ta-go', el).onclick = begin;
  }

  async function begin() {
    words = shuffle(rangeWords(A.range, A.from, A.to));
    if (!words.length) { toast('この範囲には単語がありません', 'err'); return; }
    if (Deck.words.length < 4) { toast('4択を作るには4語以上必要です', 'err'); return; }
    Sfx.ac();
    document.body.classList.add('focus-mode');
    const cd = document.createElement('div'); cd.className = 'countdown';
    document.body.appendChild(cd);
    for (const n of ['3', '2', '1', 'GO!']) {
      if (!alive) { cd.remove(); return; }
      cd.innerHTML = `<span>${n}</span>`; n === 'GO!' ? Sfx.tier() : Sfx.tick();
      await sleep(n === 'GO!' ? 450 : 700);
    }
    cd.remove();
    if (alive) play();
  }

  function play() {
    score = correct = wrong = combo = maxCombo = tier = qi = 0; wrongIds = [];
    el.innerHTML = `<div class="ta-stage" data-tier="0" id="stage">
      <div class="ta-head">
        <button class="icon-btn" data-ta-quit aria-label="やめる">${icon('x')}</button>
        <span class="ta-time" id="ta-time">60.0</span>
        <div class="ta-bar"><i id="ta-bar"></i></div>
        <div id="pomo-slot"></div>
        <button class="icon-btn" data-fs-btn></button>
      </div>
      <div class="ta-score">
        <div class="sc"><b id="ta-correct">0</b>問正解 · <span id="ta-pts">0</span>点</div>
        <div class="combo" id="ta-combo">${icon('flame')}<span class="n">0</span><span>COMBO</span></div>
      </div>
      <div class="ta-q" id="ta-q"></div>
      <div class="ta-choices" id="ta-ch"></div>
    </div>`;
    FS.sync();
    Pomo.dock($('#pomo-slot', el));
    endAt = performance.now() + DUR;
    next();
    tick();
  }
  function tick() {
    if (!alive) return;
    const left = Math.max(0, endAt - performance.now());
    const t = $('#ta-time', el), b = $('#ta-bar', el);
    if (!t) return;
    t.textContent = (left / 1000).toFixed(1);
    t.classList.toggle('low', left < 10000);
    b.style.transform = `scaleX(${left / DUR})`;
    b.style.background = left < 10000 ? 'var(--forgot)' : '';
    if (left <= 0) return finish();
    raf = requestAnimationFrame(tick);
  }
  function next() {
    if (!alive || !$('#ta-q', el)) return;
    if (qi > 0 && qi % words.length === 0) shuffle(words);
    cur = words[qi++ % words.length];
    const dir = A.dir === 'mix' ? (Math.random() < .5 ? 'en' : 'ja') : A.dir;
    const cs = makeChoices(cur, dir);
    $('#ta-q', el).innerHTML = dir === 'en'
      ? `<span class="dir">英 → 日</span><span class="hw">${esc(cur.w)}</span>`
      : `<span class="dir">日 → 英</span><span class="jp">${esc(cur.m)}</span>`;
    $('#ta-ch', el).innerHTML = cs.map((c, i) => `<button class="choice${dir === 'ja' ? ' en' : ''}" data-id="${esc(c.id)}"><kbd>${i + 1}</kbd>${esc(dir === 'en' ? c.m : c.w)}</button>`).join('');
    answering = true;
    qStart = performance.now();
  }
  function answer(btn) {
    if (!answering || !btn) return;
    answering = false;
    const stage = $('#stage', el);
    const ok = btn.dataset.id === cur.id;
    const r = btn.getBoundingClientRect();
    if (ok) {
      combo++; correct++; maxCombo = Math.max(maxCombo, combo);
      const mult = 1 + Math.floor(combo / 5) * 0.5;
      const bonus = Math.round(Math.max(0, 3000 - (performance.now() - qStart)) / 3000 * 50);
      const pts = Math.round(100 * mult) + bonus;
      score += pts;
      btn.classList.add('correct');
      pop(r, `+${pts}`);
      sparks(r, 6 + tier * 7);
      Sfx.ok(combo);
      stage.classList.remove('hit'); void stage.offsetWidth; stage.classList.add('hit');
      const nt = TIERS.reduce((a, th, i) => combo >= th ? i : a, 0);
      if (nt > tier) { banner(TIER_NAME[nt]); Sfx.tier(); }
      tier = nt;
      SRS.quick(cur.id, true);
      later(next, 170);
    } else {
      combo = 0; tier = 0; wrong++;
      endAt -= 3000;
      btn.classList.add('wrong');
      $$('.choice', el).forEach(x => { if (x.dataset.id === cur.id) x.classList.add('correct'); });
      pop(r, '−3秒', 'ng');
      Sfx.ng();
      stage.classList.remove('miss'); void stage.offsetWidth; stage.classList.add('miss');
      if (!wrongIds.includes(cur.id)) wrongIds.push(cur.id);
      SRS.quick(cur.id, false);
      later(next, 750);
    }
    stage.dataset.tier = tier;
    $('#ta-correct', el).textContent = correct;
    $('#ta-pts', el).textContent = nfmt(score);
    const cb = $('#ta-combo', el);
    $('.n', cb).textContent = combo;
    cb.classList.remove('bump'); void cb.offsetWidth; if (ok) cb.classList.add('bump');
  }
  function pop(r, text, cls = '') {
    const p = document.createElement('div');
    p.className = `ta-pop ${cls}`; p.textContent = text;
    p.style.left = r.left + r.width / 2 + 'px'; p.style.top = r.top + 'px';
    document.body.appendChild(p); setTimeout(() => p.remove(), 850);
  }
  function sparks(r, n) {
    const cols = tier >= 4 ? ['#e87ba4', '#3987e5', '#1baf7a', '#eda100'] : tier >= 3 ? ['#eb6834', '#eda100', '#e34948'] : tier >= 2 ? ['#6250d6', '#9085e9'] : ['#2a78d6', '#1baf7a'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'spark';
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * (60 + tier * 30);
      s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${cols[i % cols.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
      document.body.appendChild(s); setTimeout(() => s.remove(), 750);
    }
  }
  function banner(text) {
    const b = document.createElement('div'); b.className = 'ta-banner'; b.textContent = text;
    document.body.appendChild(b); setTimeout(() => b.remove(), 1000);
  }
  function finish() {
    cancelAnimationFrame(raf); answering = false;
    const ta = Store.s.stats.ta;
    const nb = { c: correct > ta.bestCorrect, s: score > ta.bestScore, k: maxCombo > ta.bestCombo };
    ta.bestCorrect = Math.max(ta.bestCorrect, correct);
    ta.bestScore = Math.max(ta.bestScore, score);
    ta.bestCombo = Math.max(ta.bestCombo, maxCombo);
    ta.plays = (ta.plays || 0) + 1;
    const rank = Rank.of(score, Rank.TA_TH);
    const rres = Rank.record('ta', Rank.key(A.range, A.from, A.to), rank, score);
    Store.save();
    document.body.classList.remove('focus-mode');
    Pomo.undock();
    Sfx.done();
    const total = correct + wrong;
    const nbTag = f => f ? '<span class="badge" style="background:var(--known);margin-left:6px">自己ベスト</span>' : '';
    el.innerHTML = `<div class="summary">
      <section class="card sum-hero">
        <div class="hero-label">TIME UP! 正解数</div>
        <div class="hero-fig">${correct}<small>問</small></div>${nbTag(nb.c)}
        ${Rank.resultHTML({ r: rank, score, unit: '点', th: Rank.TA_TH, res: rres })}
        <div class="ta-best" style="margin-top:18px">
          <div class="tile"><span class="tile-label">スコア</span><span class="tile-value">${nfmt(score)}</span>${nbTag(nb.s)}</div>
          <div class="tile"><span class="tile-label">最大コンボ</span><span class="tile-value">${maxCombo}</span>${nbTag(nb.k)}</div>
          <div class="tile"><span class="tile-label">正答率</span><span class="tile-value">${pct(correct, total)}<small>%</small></span></div>
        </div>
      </section>
      <div class="row" style="justify-content:center">
        <button class="btn primary" data-retry>${icon('refresh')}もう一度</button>
        ${wrongIds.length ? `<button class="btn" data-review>${icon('repeat')}間違えた ${wrongIds.length}語を復習</button>` : ''}
        <button class="btn ghost" data-menu>メニューへ</button>
      </div>
      ${wrongIds.length ? `<section class="card"><h2>${icon('alert')}間違えた単語（要復習リストに追加済み）</h2><div class="sum-list">${wrongIds.map(id => { const x = Deck.get(id); return `<div class="sum-item" data-word="${esc(id)}"><span class="hw">${esc(x.w)}</span><span class="m">${esc(x.m)}</span>${pill(SRS.status(id))}</div>`; }).join('')}</div></section>` : ''}
    </div>`;
    if (nb.c || nb.s || nb.k || rres.up) confetti();
  }

  el.addEventListener('click', e => {
    if (e.target.closest('[data-ta-quit]')) { cancelAnimationFrame(raf); answering = false; menu(); return; }
    const c = e.target.closest('#ta-ch .choice'); if (c) return answer(c);
    if (e.target.closest('[data-retry]')) return begin();
    if (e.target.closest('[data-menu]')) return menu();
    if (e.target.closest('[data-review]')) return StudyStart.fromIds(wrongIds.slice(), 'タイムアタックで間違えた単語');
    const r = e.target.closest('[data-word]'); if (r) openWord(r.dataset.word);
  });
  const onKey = e => {
    if (!answering || e.target.matches?.('input, select, textarea')) return;
    if (['1', '2', '3', '4'].includes(e.key)) answer($$('#ta-ch .choice', el)[+e.key - 1]);
  };
  document.addEventListener('keydown', onKey);
  menu();
  return () => {
    alive = false; cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('focus-mode');
    Pomo.undock();
    $$('.countdown, .ta-banner, .ta-pop').forEach(n => n.remove());
  };
};

/* ---------- ながら聴き・シャドーイング ---------- */
Views.listen = el => {
  const L = Store.s.settings.listen;
  let list = [], i = 0, playing = false, token = 0, wake = null;
  const seg = (name, opts, cur) => `<div class="seg-ctl" data-lseg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const chk = (id, on, label, sub = '') => `<label class="check"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><span class="tg"></span><span>${label}${sub ? `<small>${sub}</small>` : ''}</span></label>`;

  el.innerHTML = `
  <div class="page-head"><div><h1>ながら聴き・シャドーイング</h1><p>英単語 → 日本語 → 例文 を自動で読み上げ。後に続いて声に出す「間」も作れます</p></div></div>
  ${Speech.ok ? '' : `<div class="notice" style="margin-bottom:16px">${icon('alert')}<div>このブラウザは音声読み上げに対応していません。Chrome / Edge / Safari の最新版でお試しください。</div></div>`}
  <div id="voice-warn"></div>
  <div class="listen">
    <section class="card ls-stage${L.blind ? ' blind' : ''}" id="stage">
      <div class="ls-count num" id="ls-count"></div>
      <div class="ls-word hw" id="ls-word"></div>
      <div class="ls-mean" id="ls-mean"></div>
      <div class="ls-ex" id="ls-ex"></div>
      <div class="ls-steps" id="ls-steps"></div>
      <div class="ls-ctrl">
        <button class="icon-btn" id="ls-prev" aria-label="前の単語">${icon('prev')}</button>
        <button class="ls-play" id="ls-play" aria-label="再生">${icon('play')}</button>
        <button class="icon-btn" id="ls-next" aria-label="次の単語">${icon('next')}</button>
      </div>
      <p class="muted" style="font-size:12px;margin:14px 0 0">スペース：再生/停止 · ← →：前後の単語</p>
      <div class="ls-shadow"><i id="ls-shadow"></i></div>
    </section>
    <section class="card">
      <h2>${icon('sliders')}再生の設定</h2>
      <label class="field"><span>範囲</span>${rangeSelectHTML('ls-range', L.range)}</label>
      <div class="range-row" id="ls-nums" ${L.range === 'nums' ? '' : 'hidden'} style="margin-top:10px"><div class="nums">No.<input class="input" type="number" id="ls-from" value="${L.from}"> 〜 <input class="input" type="number" id="ls-to" value="${L.to}"></div></div>
      <div class="opt-group mt"><span>順番</span>${seg('order', [['num', '番号順'], ['rand', 'ランダム'], ['weak', '苦手順']], L.order)}</div>
      <div class="opt-group"><span>英単語を読む回数</span>${seg('enTimes', [[1, '1回'], [2, '2回'], [3, '3回']], L.enTimes)}</div>
      ${chk('ls-ja', L.ja, '日本語の意味も読む')}
      ${chk('ls-ex', L.ex, '例文も読む')}
      ${chk('ls-loop', L.loop, '最後まで行ったら最初から')}
      ${chk('ls-blind', L.blind, '画面を見ないモード', '文字をぼかして耳だけで覚える')}
      <label class="field mt"><span>シャドーイングの間 <b id="gap-v">${L.gap}秒</b></span><input class="slider" type="range" id="ls-gap" min="0" max="5" step="0.5" value="${L.gap}"></label>
      <label class="field mt"><span>英語の速さ <b id="rate-v">${(+L.rate).toFixed(2)}</b></span><input class="slider" type="range" id="ls-rate" min="0.5" max="1.4" step="0.05" value="${L.rate}"></label>
    </section>
  </div>`;

  const build = () => { list = orderWords(rangeWords(L.range, L.from, L.to), L.order); i = 0; };
  const steps = () => {
    const s = [];
    for (let k = 0; k < L.enTimes; k++) s.push(['en' + k, `英語${L.enTimes > 1 ? ' ' + (k + 1) : ''}`]);
    if (L.ja) s.push(['ja', '日本語']);
    if (L.ex) s.push(['ex', '例文']);
    if (L.gap > 0) s.push(['gap', 'リピート']);
    $('#ls-steps', el).innerHTML = s.map(([k, l]) => `<span data-step="${k}">${l}</span>`).join('');
  };
  const step = k => $$('#ls-steps span', el).forEach(s => s.classList.toggle('on', s.dataset.step === k));
  const render = () => {
    const w = list[i];
    $('#ls-count', el).textContent = list.length ? `${i + 1} / ${list.length}　·　${rangeLabel(L.range, L.from, L.to)}` : '';
    if (!w) { $('#ls-word', el).textContent = '—'; $('#ls-mean', el).textContent = 'この範囲には単語がありません'; $('#ls-ex', el).innerHTML = ''; return; }
    $('#ls-word', el).textContent = w.w;
    $('#ls-mean', el).textContent = L.ja ? w.m : '';
    $('#ls-ex', el).innerHTML = L.ex && w.e ? `${hlEx(w.e)}<div class="ja">${esc(w.j)}</div>` : '';
    steps();
  };
  const setPlayBtn = () => { $('#ls-play', el).innerHTML = icon(playing ? 'pause' : 'play'); $('#ls-play', el).setAttribute('aria-label', playing ? '一時停止' : '再生'); };
  async function gap(ms, tk) {
    const bar = $('#ls-shadow', el);
    bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth;
    bar.style.transition = `width ${ms}ms linear`; bar.style.width = '100%';
    await sleep(ms);
    if (tk === token) { bar.style.transition = 'none'; bar.style.width = '0'; }
  }
  async function run(tk) {
    while (playing && tk === token) {
      if (i >= list.length) {
        if (L.loop && list.length) { i = 0; if (L.order === 'rand') shuffle(list); }
        else { stop(); i = Math.max(0, list.length - 1); render(); toast('最後まで聴きました', 'ok'); return; }
      }
      const w = list[i];
      render();
      for (let k = 0; k < L.enTimes; k++) {
        step('en' + k);
        await Speech.speak(w.w, 'en', L.rate); if (tk !== token) return;
        await sleep(k < L.enTimes - 1 ? 550 : 350); if (tk !== token) return;
      }
      if (L.ja) { step('ja'); await Speech.speak(Speech.jaText(w.m), 'ja', Math.min(1.4, +L.rate + 0.15)); if (tk !== token) return; await sleep(300); if (tk !== token) return; }
      if (L.ex && w.e) { step('ex'); await Speech.speak(plainEx(w.e), 'en', L.rate); if (tk !== token) return; await sleep(300); if (tk !== token) return; }
      if (L.gap > 0) { step('gap'); await gap(L.gap * 1000, tk); if (tk !== token) return; }
      i++;
    }
  }
  async function start() {
    if (!Speech.ok) { toast('音声読み上げに対応していないブラウザです', 'err'); return; }
    if (!list.length) { toast('この範囲には単語がありません', 'err'); return; }
    playing = true; token++; Speech.cancel(); setPlayBtn();
    try { wake = await navigator.wakeLock?.request('screen'); } catch (_) { wake = null; }
    run(token);
  }
  function stop() {
    playing = false; token++; Speech.cancel(); setPlayBtn(); step('');
    const bar = $('#ls-shadow', el); if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; }
    wake?.release?.().catch(() => {}); wake = null;
  }
  const jump = d => {
    if (!list.length) return;
    i = clamp(i + d, 0, list.length - 1);
    if (playing) { token++; Speech.cancel(); run(token); } else render();
  };
  $('#ls-play', el).onclick = () => playing ? stop() : start();
  $('#ls-prev', el).onclick = () => jump(-1);
  $('#ls-next', el).onclick = () => jump(1);
  const restartIfPlaying = () => { if (playing) { token++; Speech.cancel(); run(token); } else render(); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-lseg] button'); if (!b) return;
    const name = b.parentElement.dataset.lseg;
    L[name] = name === 'enTimes' ? +b.dataset.v : b.dataset.v;
    $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b));
    Store.save();
    if (name === 'order') { build(); restartIfPlaying(); } else render();
  });
  el.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'ls-range') { L.range = t.value; $('#ls-nums', el).hidden = L.range !== 'nums'; build(); restartIfPlaying(); }
    if (t.id === 'ls-from' || t.id === 'ls-to') { L[t.id === 'ls-from' ? 'from' : 'to'] = t.value; build(); restartIfPlaying(); }
    if (t.id === 'ls-ja') { L.ja = t.checked; render(); }
    if (t.id === 'ls-ex') { L.ex = t.checked; render(); }
    if (t.id === 'ls-loop') L.loop = t.checked;
    if (t.id === 'ls-blind') { L.blind = t.checked; $('#stage', el).classList.toggle('blind', L.blind); }
    Store.save();
  });
  el.addEventListener('input', e => {
    if (e.target.id === 'ls-gap') { L.gap = +e.target.value; $('#gap-v', el).textContent = L.gap + '秒'; steps(); Store.save(); }
    if (e.target.id === 'ls-rate') { L.rate = +e.target.value; $('#rate-v', el).textContent = L.rate.toFixed(2); Store.save(); }
  });
  const onKey = e => {
    if (e.target.matches?.('input, select, textarea') || document.querySelector('.modal-wrap')) return;
    if (e.key === ' ') { e.preventDefault(); playing ? stop() : start(); }
    if (e.key === 'ArrowRight') jump(1);
    if (e.key === 'ArrowLeft') jump(-1);
  };
  document.addEventListener('keydown', onKey);
  const onVis = async () => { if (!document.hidden && playing && (!wake || wake.released)) { try { wake = await navigator.wakeLock?.request('screen'); } catch (_) {} } };
  document.addEventListener('visibilitychange', onVis);
  const voiceWarn = () => { $('#voice-warn', el).innerHTML = Speech.noEnglish() ? `<div class="notice" style="margin-bottom:16px">${icon('alert')}<div>${esc(Speech.NO_EN_MSG)}</div></div>` : ''; };
  document.addEventListener('voices', voiceWarn);
  voiceWarn();
  build(); render();
  return () => { stop(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); document.removeEventListener('voices', voiceWarn); };
};
