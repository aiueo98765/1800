'use strict';
/* ============================================================
   画面：ホーム / 復習 / 単語一覧 / タグ / 設定・データ / 単語カード
   ============================================================ */
const Views = {};

/* ---------- 単語カード（モーダル。類義語などで連鎖ジャンプ） ---------- */
function relChips(list, label) {
  if (!list.length) return '';
  const chips = list.map(r => {
    const t = Deck.get(r);
    return t ? `<button type="button" class="chip link" data-jump="${esc(t.id)}">${esc(r)}${icon('link')}</button>`
      : `<span class="chip link ext" data-tip="収録外の語">${esc(r)}</span>`;
  }).join('');
  return `<span>${label}</span><div>${chips}</div>`;
}
function relHTML(w, withRev = false) {
  const rev = withRev ? [...(Deck.rev.get(w.id) || [])].filter(id => ![...w.syn, ...w.ant, ...w.der].some(r => r.toLowerCase() === id)) : [];
  const h = relChips(w.syn, '類義語') + relChips(w.ant, '対義語') + relChips(w.der, '派生語') + relChips(rev.map(id => Deck.get(id).w), '関連');
  return h ? `<div class="rel">${h}</div>` : '';
}
function wordDetailHTML(w) {
  const p = SRS.p(w.id), st = SRS.status(w.id), r = SRS.retention(w.id);
  const tags = Tags.of(w.id);
  const all = Tags.all().map(([t]) => t);
  const sugg = [...new Set([...Tags.PRESETS, ...all])].filter(t => !tags.includes(t)).slice(0, 8);
  return `
  <div class="wd-head"><span class="chip pos">${POS[w.p]}</span><span class="num">No.${w.no}</span><span>${esc(w.part)} · Section ${w.sec}</span>${pill(st)}</div>
  <div class="wd-word"><span class="hw">${esc(w.w)}</span>${speakBtn(w.w)}<button type="button" class="speak sm" data-say="${esc(w.w)}" data-lang="en" aria-label="ゆっくり発音" data-tip="ゆっくり発音">${icon('turtle')}</button></div>
  <div class="wd-mean">${esc(w.m)} ${speakBtn(Speech.jaText(w.m), 'ja', 'sm', '意味を読み上げ')}</div>
  ${w.e ? `<div class="q-ex"><div class="en">${hlEx(w.e)} ${speakBtn(plainEx(w.e), 'en', 'sm', '例文を読み上げ')}</div>${w.j ? `<div class="ja">${esc(w.j)}</div>` : ''}</div>` : ''}
  ${relHTML(w, true) ? `<div class="wd-sec"><h4>連鎖ジャンプ（タップで移動）</h4>${relHTML(w, true)}</div>` : ''}
  <div class="wd-sec"><h4>タグ</h4>
    <div class="tag-editor">
      ${tags.map(t => `<span class="chip tag">#${esc(t)}<button class="x" data-untag="${esc(t)}" aria-label="#${esc(t)} を外す">${icon('x')}</button></span>`).join('')}
      <form data-tagform style="display:contents"><input class="input" name="t" placeholder="＋ タグを追加" list="tag-sugg" maxlength="24"></form>
      <datalist id="tag-sugg">${all.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    </div>
    ${sugg.length ? `<div class="row" style="margin-top:8px;gap:6px">${sugg.map(t => `<button type="button" class="chip" data-tag="${esc(t)}">${icon('plus')}#${esc(t)}</button>`).join('')}</div>` : ''}
  </div>
  <div class="wd-sec"><h4>記憶の状態</h4>
    <div class="wd-stats">
      <div class="wd-stat"><span>定着度</span><b>${r === null ? '—' : r + '%'}</b></div>
      <div class="wd-stat"><span>正答 / 回答</span><b>${p ? `${+p.c.toFixed(1)}/${p.n}` : '—'}</b></div>
      <div class="wd-stat"><span>連続正解</span><b>${p ? p.st : '—'}</b></div>
      <div class="wd-stat"><span>次の復習</span><b>${p && p.s ? fmtDue(p.d) : '—'}</b></div>
    </div>
  </div>
  <div class="wd-sec"><h4>自己評価をつける</h4>
    <div class="self-grade">
      <button class="g g-forgot" data-setg="forgot">忘れた</button>
      <button class="g g-unsure" data-setg="unsure">まだ怪しい</button>
      <button class="g g-known" data-setg="known">覚えた</button>
    </div>
  </div>`;
}
function openWord(id, { onChange } = {}) {
  const stack = [String(id).toLowerCase()];
  const m = openModal({ title: '単語カード', cls: 'word-modal', onClose: () => onChange?.() });
  const render = () => {
    const w = Deck.get(stack.at(-1));
    if (!w) { m.close(); return; }
    const trail = stack.length > 1 ? `<div class="trail">${stack.map((s, i) => i === stack.length - 1
      ? `<span class="cur">${esc(Deck.get(s)?.w || s)}</span>` : `<button data-trail="${i}">${esc(Deck.get(s)?.w || s)}</button>${icon('right')}`).join('')}</div>` : '単語カード';
    m.head.innerHTML = trail;
    m.body.innerHTML = wordDetailHTML(w);
    m.el.scrollTop = 0;
  };
  m.body.addEventListener('click', e => {
    const j = e.target.closest('[data-jump]');
    if (j) { stack.push(j.dataset.jump); render(); if (Store.s.settings.autoSpeak) Speech.say(Deck.get(j.dataset.jump).w); return; }
    const w = Deck.get(stack.at(-1));
    const ut = e.target.closest('[data-untag]');
    if (ut) { Tags.remove(w.id, ut.dataset.untag); render(); return; }
    const tg = e.target.closest('[data-tag]');
    if (tg) { Tags.add(w.id, tg.dataset.tag); render(); toast(`#${tg.dataset.tag} を付けました`, 'ok'); return; }
    const sg = e.target.closest('[data-setg]');
    if (sg) { SRS.grade(w.id, sg.dataset.setg); render(); toast(`「${STATUS[sg.dataset.setg]}」に設定しました`, 'ok'); }
  });
  m.head.addEventListener('click', e => {
    const t = e.target.closest('[data-trail]');
    if (t) { stack.length = +t.dataset.trail + 1; render(); }
  });
  m.body.addEventListener('submit', e => {
    if (!e.target.matches('[data-tagform]')) return;
    e.preventDefault();
    const w = Deck.get(stack.at(-1));
    const v = e.target.t.value;
    if (Tags.add(w.id, v)) toast(`#${Tags.clean(v)} を付けました`, 'ok');
    render();
    setTimeout(() => $('[data-tagform] input', m.body)?.focus(), 0);
  });
  render();
  return m;
}

/* ---------- ホーム：進捗ダッシュボード ---------- */
Views.home = el => {
  const W = Deck.words;
  const c = SRS.count(W);
  const due = SRS.dueWords().length;
  const weak = c.unsure + c.forgot;
  const today = Store.s.stats.daily[dkey()] || { n: 0, ok: 0 };
  const goal = Store.s.settings.dailyGoal;
  const streak = SRS.streak();
  const ta = Store.s.stats.ta;
  const pomoToday = Store.s.stats.pomo[dkey()] || 0;
  const avgR = SRS.avgRetention(W);

  const posRows = POS_KEYS.map(k => {
    const ws = W.filter(w => w.p === k);
    if (!ws.length) return '';
    const pc = SRS.count(ws);
    return `<div class="pos-row"><b>${POS[k]}</b>${segBar(pc, { label: POS[k] })}<span class="r"><b>${pct(pc.known, pc.total)}%</b> · ${pc.total}語</span></div>`;
  }).join('');

  const parts = Deck.groups.map(P => {
    const pw = P.ids.map(id => Deck.get(id));
    const pc = SRS.count(pw);
    return `<div class="part-block">
      <div class="part-head"><h3>${esc(P.part)}</h3><span class="muted">${esc(P.name)} · ${P.ids.length}語</span>
        <a class="btn sm soft" href="#/study?range=${encodeURIComponent('part:' + P.part)}">${icon('play')}Part全体を学習</a>
        <span class="pct">${pct(pc.known, pc.total)}%</span></div>
      <div class="secs">${P.secs.map(S => {
        const sw = S.ids.map(id => Deck.get(id));
        const sc = SRS.count(sw);
        const r = SRS.avgRetention(sw);
        const key = encodeURIComponent('sec:' + S.key);
        const rb = Rank.best('study', Rank.key('sec:' + S.key));
        return `<div class="sec-card">
          <div class="sec-top">${Rank.badge(rb?.r || 0, 30, 'sec-rank')}<b>Section ${S.sec}</b><span class="muted num">No.${S.from}–${S.to}</span><span class="pct">${pct(sc.known, sc.total)}%</span></div>
          ${segBar(sc, { label: `${P.part} Section ${S.sec}` })}
          <div class="sec-meta"><span>覚えた ${sc.known}/${sc.total}</span><span>要復習 ${sc.unsure + sc.forgot}</span><span>定着 ${r}%</span></div>
          <div class="sec-actions"><a class="btn sm primary" href="#/study?range=${key}">学習</a><a class="btn sm" href="#/study?range=${key}&mode=write">手書き</a><a class="btn sm" href="#/study?range=${key}&mode=choice">4択</a></div>
        </div>`;
      }).join('')}</div></div>`;
  }).join('');

  // 学習ヒートマップ（直近16週）
  const daily = Store.s.stats.daily;
  const weeks = 16;
  const start = sod() - ((weeks - 1) * 7 + new Date().getDay()) * DAY;
  let cells = '';
  for (let t = start; t <= sod(); t += DAY) {
    const tt = sod(t + DAY / 2); // DST 対策
    const n = daily[dkey(tt)]?.n || 0;
    const lv = n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4;
    const d = new Date(tt);
    cells += `<i class="h${lv}${dkey(tt) === dkey() ? ' today' : ''}" data-tip="${d.getMonth() + 1}/${d.getDate()}：${n}回答"></i>`;
  }

  const deck = Store.s.settings.deck;
  const introKey = deck === 'book' || deck === 'both' ? 'book' : 'own';
  const intro = Store.s.settings.hideIntro === introKey || Store.s.settings.hideIntro === true && introKey === 'own' ? '' : `<div class="notice mt" style="margin-bottom:16px">${icon('info')}
    <div>${introKey === 'book'
      ? `${esc(Deck.bookTitle || 'ターゲット1800')}の単語一覧から取り込んだ${nfmt(Deck.book.length)}語です。600語ずつ3つの Part、100語ずつ18の Section に分けてあります。Section を1つずつ「覚えた」にしていきましょう。`
      : `収録されている600語は、このアプリ用に独自に作成した入試頻出語です（書籍の訳語・例文・番号順は含みません）。手持ちの単語帳の番号どおりに学ぶには、<a href="#/data">設定・データ</a>から「マイ単語帳」を取り込めます。`}</div>
    <button class="icon-btn close" data-hide-intro="${introKey}" aria-label="閉じる">${icon('x')}</button></div>`;

  el.innerHTML = `
  <div class="page-head"><div><h1>今日も1周、回し切ろう</h1><p>${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })} · 連続学習 <b>${streak}</b> 日</p></div></div>
  ${intro}
  ${Level.cardHTML()}
  <section class="hero">
    <div class="card hero-main">
      <div class="hero-top">
        <div><div class="hero-label">全体の習得率（覚えた / 全${nfmt(c.total)}語）</div><div class="hero-fig">${pct(c.known, c.total)}<small>%</small></div></div>
        <div class="hero-meta">平均定着度 <b>${avgR}%</b><br>学習済み <b>${nfmt(c.total - c.new)}</b> 語</div>
      </div>
      ${segBar(c, { tall: true, label: '全体の状態' })}
      ${legendHTML(c)}
    </div>
    <div class="tiles">
      <a class="tile ${due ? 'accent' : ''}" href="#/review"><span class="tile-label">${icon('calendar')}今日の復習</span><span class="tile-value">${due}<small>語</small></span><span class="tile-foot">${due ? 'タップして復習開始' : '今日の分は完了'}</span></a>
      <a class="tile ${weak ? 'alert' : ''}" href="#/study?range=weak&loop=1"><span class="tile-label">${icon('repeat')}要復習リスト</span><span class="tile-value">${weak}<small>語</small></span><span class="tile-foot">忘れた ${c.forgot} · 怪しい ${c.unsure}</span></a>
      <div class="tile"><span class="tile-label">${icon('target')}今日の回答数</span><span class="tile-value">${today.n}<small>/ ${goal}</small></span><div class="meter" style="margin-top:6px"><i style="width:${Math.min(100, pct(today.n, goal))}%"></i></div></div>
      <a class="tile" href="#/attack"><span class="tile-label">${icon('trophy')}タイムアタック最高</span><span class="tile-value">${ta.bestCorrect}<small>問</small></span><span class="tile-foot">最大コンボ ${ta.bestCombo} · 🍅 今日 ${pomoToday}</span></a>
    </div>
  </section>

  <h2 style="font-size:15px;font-weight:800;margin:26px 0 12px">学習モード</h2>
  <div class="modes">
    ${[
      ['recall', 'eye-off', '意味だけ表示', 'スペルを隠して意味と例文から思い出す'],
      ['write', 'pen', 'A 意味→スペル', 'キャンバスに手書きして答え合わせ'],
      ['choice', 'choice', 'B スペル→意味', '4つの選択肢から正しい意味を選ぶ'],
      ['dict', 'ear', 'ディクテーション', '音声だけを頼りに書き取る'],
    ].map(([m, ic, t, d]) => `<a class="mode-tile" href="#/study?mode=${m}"><span class="mode-ico">${icon(ic)}</span><b>${t}</b><span>${d}</span></a>`).join('')}
    <a class="mode-tile" href="#/attack"><span class="mode-ico">${icon('zap')}</span><b>60秒タイムアタック</b><span>連続正解でコンボ演出が加速</span></a>
    <a class="mode-tile" href="#/listen"><span class="mode-ico">${icon('headphones')}</span><b>ながら聴き</b><span>英語→日本語を自動再生・シャドーイング</span></a>
    <a class="mode-tile wide" href="#/grammar"><span class="mode-ico">${icon('scroll')}</span><span class="mt-text"><b>文法・入試対策</b><span>中1〜中3の文法26単元・${Grammar.items.length}問。収録語で作った例文を、穴埋め・並べ替え・和文英訳・英文和訳で</span></span><span class="mt-go">${icon('right')}</span></a>
  </div>

  <div class="grid g2 mt" style="margin-top:16px">
    <section class="card"><h2>${icon('grid')}品詞別の進捗</h2><div class="pos-rows">${posRows}</div></section>
    <section class="card"><h2>${icon('calendar')}学習の記録（直近16週）</h2>
      <div class="heat-wrap"><div class="heat">${cells}</div></div>
      <div class="heat-legend">少<i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i>多 <span style="margin-left:auto">1日の回答数</span></div>
    </section>
  </div>

  ${(() => {
    const secs = Deck.groups.flatMap(P => P.secs);
    const cnt = Array(8).fill(0);
    for (const S of secs) cnt[Rank.best('study', Rank.key('sec:' + S.key))?.r || 0]++;
    const got = secs.length - cnt[0];
    return `<section class="card rk-home" style="margin-top:16px">
      <div class="rk-home-head"><h2>${icon('trophy')}スコアランク</h2><span class="muted">${secs.length} Section 中 <b>${got}</b> でランク獲得</span>
        <button class="btn sm ghost" data-rank-guide>${icon('info')}ランク表</button></div>
      <div class="rk-shelf">${Rank.TIERS.map((T, i) => `<div class="rk-slot${cnt[i + 1] ? '' : ' empty'}" style="--i:${i}">${Rank.badge(i + 1, 46)}<span><b>${cnt[i + 1]}</b></span></div>`).join('')}</div>
      <p class="card-sub" style="margin:10px 0 0">Section を${Rank.MIN_WORDS}語以上、最後まで解くとスコアに応じて全7段階のランクが付きます。上のランクを目指して腕を磨こう</p>
    </section>`;
  })()}

  <section class="card mt" style="margin-top:16px"><h2>${icon('book')}Part・Section 別の進捗</h2><p class="card-sub">Section を選んでそのまま学習を始められます</p>${parts || '<div class="empty">単語がありません</div>'}</section>`;

  el.addEventListener('click', e => {
    const hi = e.target.closest('[data-hide-intro]');
    if (hi) { Store.s.settings.hideIntro = hi.dataset.hideIntro; Store.save(); hi.closest('.notice').remove(); }
  });
};

/* ---------- 復習：今日の復習（間隔反復）と要復習リスト ---------- */
Views.review = el => {
  const due = SRS.dueWords();
  const weak = SRS.weakWords();
  const fc = SRS.forecast(7);
  const max = Math.max(1, ...fc);
  const wd = ['日', '月', '火', '水', '木', '金', '土'];
  const overdue = due.filter(w => SRS.p(w.id).d < sod()).length;
  let filter = 'all';

  const modeBtns = range => `<div class="row" style="gap:8px">
    <a class="btn primary" href="#/study?range=${range}&mode=recall&count=0&order=weak&loop=1&go=1">${icon('play')}意味だけ表示</a>
    <a class="btn" href="#/study?range=${range}&mode=write&count=0&order=weak&loop=1&go=1">${icon('pen')}手書き</a>
    <a class="btn" href="#/study?range=${range}&mode=choice&count=0&order=weak&loop=1&go=1">${icon('choice')}4択</a>
    <a class="btn" href="#/study?range=${range}&mode=dict&count=0&order=weak&loop=1&go=1">${icon('ear')}書き取り</a></div>`;

  el.innerHTML = `
  <div class="page-head"><div><h1>復習</h1><p>間隔反復エンジンが「今日やるべき単語」を自動で選びます</p></div></div>
  <div class="grid g2">
    <section class="card">
      <h2>${icon('calendar')}今日の復習（間隔反復）</h2>
      <div class="hero-top" style="margin-bottom:12px"><div class="hero-fig">${due.length}<small>語</small></div>
        <div class="hero-meta">うち期限切れ <b>${overdue}</b> 語<br>定着度の低い順に出題</div></div>
      ${due.length ? modeBtns('due') : `<div class="empty" style="padding:16px">${icon('check')}<b>今日の復習はありません</b>新しい単語を学習しましょう</div>`}
    </section>
    <section class="card">
      <h2>${icon('calendar')}これから7日間の復習予定</h2>
      <div class="cols" role="img" aria-label="${fc.map((n, i) => `${i === 0 ? '今日' : i === 1 ? '明日' : i + '日後'}${n}語`).join('、')}">
        ${fc.map((n, i) => `<div class="col${n ? '' : ' zero'}" data-tip="${i === 0 ? '今日' : i === 1 ? '明日' : i + '日後'}：${n}語"><span class="v">${n}</span><i style="height:${n / max * 100}%"></i></div>`).join('')}
      </div>
      <div class="cols-x">${fc.map((_, i) => `<span>${i === 0 ? '今日' : i === 1 ? '明日' : wd[new Date(Date.now() + i * DAY).getDay()]}</span>`).join('')}</div>
    </section>
  </div>
  <section class="card" style="margin-top:16px">
    <h2>${icon('repeat')}要復習リスト（苦手克服ループ）</h2>
    <p class="card-sub">「忘れた」「まだ怪しい」と答えた単語は自動でここに入り、「覚えた」と答えるまで同じセッション内で繰り返し出題されます。</p>
    ${weak.length ? modeBtns('weak') : ''}
    <div class="row" style="margin:14px 0 6px">
      <div class="seg-ctl" id="wf">
        <button class="on" data-f="all">すべて ${weak.length}</button>
        <button data-f="forgot">忘れた ${weak.filter(w => SRS.status(w.id) === 'forgot').length}</button>
        <button data-f="unsure">まだ怪しい ${weak.filter(w => SRS.status(w.id) === 'unsure').length}</button>
      </div>
    </div>
    <div class="wlist" id="wlist"></div>
  </section>`;

  const renderList = () => {
    const list = weak.filter(w => filter === 'all' || SRS.status(w.id) === filter);
    $('#wlist', el).innerHTML = list.length ? list.map(w => wordRow(w)).join('')
      : `<div class="empty">${icon('check')}<b>苦手な単語はありません</b>この調子！</div>`;
  };
  $('#wf', el).addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filter = b.dataset.f; $$('#wf button', el).forEach(x => x.classList.toggle('on', x === b)); renderList();
  });
  $('#wlist', el).addEventListener('click', e => { const r = e.target.closest('[data-word]'); if (r) openWord(r.dataset.word, { onChange: () => Router.refresh() }); });
  renderList();
};

function wordRow(w) {
  const st = SRS.status(w.id), r = SRS.retention(w.id), tags = Tags.of(w.id);
  return `<div class="wrow" data-word="${esc(w.id)}" role="button" tabindex="0">
    <span class="no">${w.no}</span>
    <span class="hw">${esc(w.w)}</span>
    <span class="m">${esc(w.m)}${tags.length ? `<span class="tagmini">${tags.map(t => '#' + esc(t)).join(' ')}</span>` : ''}</span>
    <span class="ret">${r === null ? '<span>—</span>' : `<span>定着 ${r}%</span><div class="meter"><i style="width:${r}%"></i></div>`}</span>
    <span class="st">${pill(st)}</span>
  </div>`;
}

/* ---------- 単語一覧：検索・絞り込み・一括タグ ---------- */
Views.words = (el, q) => {
  const f = { text: q.get('q') || '', st: q.get('st') || '', range: q.get('range') || 'all', pos: '', sort: 'num', from: 1, to: 100 };
  let limit = 150;
  el.innerHTML = `
  <div class="page-head"><div><h1>単語一覧</h1><p>タップで単語カード。類義語・対義語・派生語へワンタップで移動できます</p></div></div>
  <div class="filters">
    <label class="search">${icon('search')}<input class="input" id="f-text" placeholder="英単語・意味で検索" value="${esc(f.text)}"></label>
    <select class="select" id="f-st"><option value="">状態：すべて</option>${STATUS_KEYS.map(s => `<option value="${s}"${f.st === s ? ' selected' : ''}>${STATUS[s]}</option>`).join('')}<option value="weak"${f.st === 'weak' ? ' selected' : ''}>要復習（忘れた＋怪しい）</option></select>
    ${rangeSelectHTML('f-range', f.range)}
    <select class="select" id="f-pos"><option value="">品詞：すべて</option>${POS_KEYS.map(k => `<option value="${k}">${POS[k]}</option>`).join('')}</select>
    <select class="select" id="f-sort"><option value="num">番号順</option><option value="weak">苦手順</option><option value="ret">定着度の低い順</option><option value="abc">ABC順</option></select>
  </div>
  <div class="range-row" id="f-nums" hidden style="margin-top:10px"><div class="nums">No.<input class="input" type="number" id="f-from" value="1" min="1"> 〜 <input class="input" type="number" id="f-to" value="100" min="1"></div></div>
  <div class="wl-bar"><span><b id="f-count">0</b> 語</span><span class="spacer"></span>
    <button class="btn sm" id="bulk-tag">${icon('tag')}表示中の単語にタグ付け</button>
    <button class="btn sm primary" id="bulk-study">${icon('play')}この単語で学習</button></div>
  <div class="wlist" id="wl"></div>
  <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="more" hidden>さらに表示</button></div>`;

  const current = () => {
    let list = rangeWords(f.range, f.from, f.to);
    if (f.st === 'weak') list = list.filter(w => ['unsure', 'forgot'].includes(SRS.status(w.id)));
    else if (f.st) list = list.filter(w => SRS.status(w.id) === f.st);
    if (f.pos) list = list.filter(w => w.p === f.pos);
    const t = f.text.trim().toLowerCase();
    if (t) list = list.filter(w => w.id.includes(t) || w.m.includes(f.text.trim()) || w.syn.some(s => s.toLowerCase().includes(t)) || w.der.some(s => s.toLowerCase().includes(t)));
    if (f.sort === 'abc') list.sort((a, b) => a.id.localeCompare(b.id));
    else if (f.sort === 'ret') list.sort((a, b) => (SRS.retention(a.id) ?? -1) - (SRS.retention(b.id) ?? -1));
    else list = orderWords(list, f.sort === 'weak' ? 'weak' : 'num');
    return list;
  };
  const render = () => {
    const list = current();
    $('#f-count', el).textContent = nfmt(list.length);
    $('#wl', el).innerHTML = list.length ? list.slice(0, limit).map(wordRow).join('') : `<div class="empty">${icon('search')}<b>該当する単語がありません</b>条件を変えてみてください</div>`;
    $('#more', el).hidden = list.length <= limit;
  };
  const sync = () => {
    f.text = $('#f-text', el).value; f.st = $('#f-st', el).value; f.range = $('#f-range', el).value;
    f.pos = $('#f-pos', el).value; f.sort = $('#f-sort', el).value; f.from = $('#f-from', el).value; f.to = $('#f-to', el).value;
    $('#f-nums', el).hidden = f.range !== 'nums';
    limit = 150; render();
  };
  let tmr;
  $('#f-text', el).addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(sync, 120); });
  ['#f-st', '#f-range', '#f-pos', '#f-sort', '#f-from', '#f-to'].forEach(s => $(s, el).addEventListener('change', sync));
  $('#more', el).onclick = () => { limit += 300; render(); };
  $('#wl', el).addEventListener('click', e => { const r = e.target.closest('[data-word]'); if (r) openWord(r.dataset.word, { onChange: render }); });
  $('#wl', el).addEventListener('keydown', e => { if (e.key === 'Enter') { const r = e.target.closest('[data-word]'); if (r) openWord(r.dataset.word, { onChange: render }); } });
  $('#bulk-tag', el).onclick = async () => {
    const list = current();
    if (!list.length) return;
    const t = await promptBox(`表示中の ${list.length} 語にタグを付ける`, '', { ok: 'タグを付ける', placeholder: '例：学校テスト用' });
    if (!Tags.clean(t)) return;
    list.forEach(w => Tags.add(w.id, t));
    toast(`${list.length}語に #${Tags.clean(t)} を付けました`, 'ok');
    const sel = $('#f-range', el).value;
    $('#f-range', el).outerHTML = rangeSelectHTML('f-range', sel);
    $('#f-range', el).addEventListener('change', sync);
    render();
  };
  $('#bulk-study', el).onclick = () => {
    const ids = current().map(w => w.id);
    if (!ids.length) return;
    StudyStart.fromIds(ids, `一覧から ${ids.length}語`);
  };
  render();
};

/* ---------- タグ：タグごとの進捗と模試 ---------- */
Views.tags = el => {
  const render = () => {
    const tags = Tags.all();
    el.innerHTML = `
    <div class="page-head"><div><h1>タグ</h1><p>「#鬼門」「#学校テスト用」など自由にタグを付け、タグごとに学習・模試ができます</p></div></div>
    <div class="notice" style="margin-bottom:16px">${icon('bulb')}<div>タグは単語カード（どの画面でも単語をタップ）か、<a href="#/words">単語一覧</a>の「表示中の単語にタグ付け」で付けられます。テスト範囲を番号で絞ってまとめて付けるのが便利です。</div></div>
    <section class="card">
      ${tags.length ? `<div class="tag-rows">${tags.map(([t, n]) => {
        const ws = rangeWords('tag:' + t); const c = SRS.count(ws); const key = encodeURIComponent('tag:' + t);
        return `<div class="tag-row">
          <span class="name">#${esc(t)}</span><span class="muted num">${n}語 · 覚えた ${pct(c.known, c.total)}%</span>
          ${segBar(c, { label: '#' + t })}
          <div class="row" style="gap:6px">
            <a class="btn sm primary" href="#/study?range=${key}&exam=1&mode=choice&order=rand&count=0">${icon('target')}模試</a>
            <a class="btn sm" href="#/study?range=${key}&mode=write&order=rand&count=0">手書き模試</a>
            <a class="btn sm" href="#/study?range=${key}">学習</a>
            <a class="btn sm ghost" href="#/words?range=${key}">一覧</a>
            <button class="btn sm ghost" data-ren="${esc(t)}">名前変更</button>
            <button class="btn sm ghost danger" data-del="${esc(t)}">削除</button>
          </div></div>`;
      }).join('')}</div>`
      : `<div class="empty">${icon('tag')}<b>まだタグがありません</b>よく使うタグ：${Tags.PRESETS.map(t => '#' + t).join('　')}</div>`}
    </section>`;
  };
  el.addEventListener('click', async e => {
    const r = e.target.closest('[data-ren]');
    if (r) { const v = await promptBox('タグ名を変更', r.dataset.ren); if (v) { Tags.rename(r.dataset.ren, v); render(); } return; }
    const d = e.target.closest('[data-del]');
    if (d && await confirmBox('タグを削除', `#${esc(d.dataset.del)} をすべての単語から外します。単語や学習記録は消えません。`, { ok: '削除', danger: true })) { Tags.drop(d.dataset.del); render(); }
  });
  render();
};

/* ---------- 設定・データ（書き出し・読み込み・マイ単語帳） ---------- */
function parseWordText(text) {
  const out = [], errors = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('//')) return;
    const sep = t.includes('\t') ? '\t' : t.includes('|') ? '|' : t.includes(',') ? ',' : null;
    let f = sep ? t.split(sep).map(s => s.trim()) : t.split(/\s+/);
    if (!sep && f.length > 2) f = /^\d+$/.test(f[0]) ? [f[0], f[1], f.slice(2).join(' ')] : [f[0], f.slice(1).join(' ')];
    let no = 0;
    if (/^\d+$/.test(f[0])) no = parseInt(f.shift(), 10);
    const [w, m, p, e, j, syn, ant, der] = f;
    if (!w || !/[a-z]/i.test(w) || !m || (!sep && !/[^\x00-\x7f]/.test(m))) { errors.push(i + 1); return; }
    out.push({ no, w, m, p: p || '', e: e || '', j: j || '', syn: syn || '', ant: ant || '', der: der || '' });
  });
  return { out, errors };
}
Views.data = el => {
  const s = Store.s.settings;
  const enVoices = Speech.list('en'), jaVoices = Speech.list('ja');
  el.innerHTML = `
  <div class="page-head"><div><h1>設定・データ</h1><p>学習データの書き出し／読み込み、マイ単語帳、各種設定</p></div></div>
  <div class="grid g2">
    <section class="card">
      <h2>${icon('download')}ワンタップ書き出し／読み込み</h2>
      <p class="card-sub">学習記録・タグ・マイ単語帳・設定をまとめて JSON で保存します。機種変更やバックアップに。</p>
      <div class="row">
        <button class="btn primary" id="ex-all">${icon('download')}すべて書き出し</button>
        <button class="btn" id="ex-words">${icon('download')}マイ単語帳だけ</button>
        <label class="btn" style="cursor:pointer">${icon('upload')}JSONを読み込み<input type="file" id="im-file" accept=".json,application/json" hidden></label>
      </div>
      <p class="muted" style="font-size:12px;margin:10px 0 0">学習データはこの端末のブラウザ（localStorage）に保存されています。ブラウザのデータを消すと失われるので、ときどき書き出してください。</p>
    </section>
    <section class="card">
      <h2>${icon('book')}使う単語帳</h2>
      <div class="seg-ctl wrap" id="deck-sel">
        ${Deck.hasBook() ? `<button data-d="book">ターゲット1800（${Deck.book.length}）</button>` : ''}<button data-d="builtin">独自600語</button><button data-d="custom">マイ単語帳（${Store.s.custom.length}）</button><button data-d="both">${Deck.hasBook() ? '1800＋マイ単語帳' : '600語＋マイ単語帳'}</button>
      </div>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0">${Deck.hasBook() ? `ターゲット1800は、単語一覧PDFから取り込んだ${Deck.book.length}語です。600語ずつ3つの Part、100語ずつ18の Section に分けています。` : ''}マイ単語帳だけにすると、取り込んだ番号どおりに Part（1–800 / 801–1500 / 1501–）と Section（100語ごと）が組まれます。学習記録は英単語ごとに保存されるので、切り替えても消えません。</p>
    </section>
  </div>

  <section class="card" style="margin-top:16px">
    <h2>${icon('plus')}マイ単語帳を取り込む</h2>
    <p class="card-sub">1行に1語。タブ・カンマ・縦棒（|）区切り。<b>番号・英単語・意味</b>が最低限で、品詞・例文・例文訳・類義語・対義語・派生語は任意です。例文の見出し語を [ ] で囲むと穴埋めに使われます。</p>
    <pre class="code-sample">番号, 英単語, 意味, 品詞, 例文, 例文訳, 類義語, 対義語, 派生語
1, create, ～を創造する, 動, She [created] a new logo., 彼女は新しいロゴを作った。, make, destroy, creation
2	increase	増える；～を増やす	動
3|decrease|減る；～を減らす</pre>
    <textarea class="input" id="im-text" rows="7" placeholder="ここに貼り付け（Excel やスプレッドシートからそのままコピーできます）" style="margin-top:12px"></textarea>
    <div id="im-preview"></div>
    <div class="row mt">
      <button class="btn primary" id="im-add" disabled>${icon('plus')}マイ単語帳に追加</button>
      <button class="btn" id="im-replace" disabled>置き換えて取り込む</button>
      <span class="spacer" style="flex:1"></span>
      <button class="btn ghost danger" id="custom-clear"${Store.s.custom.length ? '' : ' disabled'}>マイ単語帳を空にする</button>
    </div>
  </section>

  <div class="grid g2" style="margin-top:16px">
    <section class="card">
      <h2>${icon('sliders')}学習の設定</h2>
      <label class="check"><input type="checkbox" id="s-auto"${s.autoSpeak ? ' checked' : ''}><span class="tg"></span><span>答えを表示したら自動で発音<small>ジャンプ先の単語も読み上げます</small></span></label>
      <label class="check"><input type="checkbox" id="s-sfx"${s.sfx ? ' checked' : ''}><span class="tg"></span><span>効果音（タイムアタック・正誤）</span></label>
      <div class="set-grid mt">
        <label class="field"><span>1日の目標回答数</span><input class="input" type="number" id="s-goal" min="5" max="1000" value="${s.dailyGoal}"></label>
        <label class="field"><span>4択で「怪しい」扱いにする秒数</span><input class="input" type="number" id="s-slow" min="2" max="30" value="${s.slowSec}"></label>
      </div>
      <label class="field mt"><span>テーマ</span>
        <select class="select" id="s-theme"><option value="auto">端末に合わせる</option><option value="light">ライト</option><option value="dark">ダーク</option></select></label>
    </section>
    <section class="card">
      <h2>${icon('volume')}音声の設定</h2>
      ${Speech.noEnglish() ? `<div class="notice" style="margin-bottom:12px">${icon('alert')}<div>${esc(Speech.NO_EN_MSG)}</div></div>` : ''}
      ${Speech.ok ? `
      <label class="field"><span>英語の声</span><select class="select" id="s-ven"><option value="">自動（おすすめ）</option>${enVoices.map(v => `<option value="${esc(v.voiceURI)}"${v.voiceURI === s.voiceEn ? ' selected' : ''}>${esc(v.name)}（${esc(v.lang)}）</option>`).join('')}</select></label>
      <label class="field mt"><span>日本語の声</span><select class="select" id="s-vja"><option value="">自動</option>${jaVoices.map(v => `<option value="${esc(v.voiceURI)}"${v.voiceURI === s.voiceJa ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
      <label class="field mt"><span>読み上げ速度 <b id="s-rate-v">${s.rate.toFixed(2)}</b></span><input class="slider" type="range" id="s-rate" min="0.5" max="1.5" step="0.05" value="${s.rate}"></label>
      <div class="row mt"><button class="btn sm" id="s-test">${icon('volume')}試しに聞く</button></div>`
      : `<div class="notice">${icon('alert')}<div>このブラウザは音声読み上げ（Web Speech API）に対応していません。</div></div>`}
    </section>
  </div>

  <section class="card" style="margin-top:16px">
    <h2>${icon('alert')}リセット</h2>
    <div class="row"><button class="btn danger" id="reset-progress">学習記録だけ消す</button><button class="btn danger" id="reset-all">すべて初期化</button></div>
  </section>
  <p class="muted" style="font-size:12px;margin-top:20px;line-height:1.7">本アプリは英単語帳『ターゲット1800』での学習を補助する非公式ツールです。出版社とは関係ありません。独自600語の訳語・例文はこのアプリのために作成したものです。${Deck.hasBook() ? 'ターゲット1800の1800語は、お手持ちの単語一覧PDFから個人の学習用に取り込んだもので、公開・配布はしないでください。' : ''}</p>`;

  $('#s-theme', el).value = s.theme;
  const deckBtns = () => $$('#deck-sel button', el).forEach(b => b.classList.toggle('on', b.dataset.d === s.deck));
  deckBtns();
  $('#deck-sel', el).addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    if ((b.dataset.d === 'custom' || b.dataset.d === 'both') && !Store.s.custom.length) { toast('先にマイ単語帳を取り込んでください', 'err'); return; }
    s.deck = b.dataset.d; s.deckPicked = true; Store.save(); Deck.build(); deckBtns(); Router.updateNav();
    toast(`単語帳を切り替えました（${Deck.words.length}語）`, 'ok');
  });

  $('#ex-all', el).onclick = () => {
    const data = { app: 'target1800-loop', version: 1, exportedAt: new Date().toISOString(), ...JSON.parse(JSON.stringify(Store.s)) };
    downloadFile(`target1800-backup-${dkey()}.json`, JSON.stringify(data, null, 1));
    toast('書き出しました', 'ok');
  };
  $('#ex-words', el).onclick = () => {
    if (!Store.s.custom.length) { toast('マイ単語帳は空です', 'err'); return; }
    downloadFile(`target1800-mywords-${dkey()}.json`, JSON.stringify({ app: 'target1800-loop', kind: 'words', words: Store.s.custom }, null, 1));
  };
  $('#im-file', el).onchange = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (_) { toast('JSONとして読めませんでした', 'err'); return; }
    const words = Array.isArray(data) ? data : data.kind === 'words' ? data.words : null;
    if (words) {
      const n = addCustom(words.map(w => typeof w === 'object' ? w : null).filter(Boolean), false);
      toast(`${n}語をマイ単語帳に追加しました`, 'ok'); Router.refresh(); return;
    }
    if (data && (data.progress || data.settings)) {
      const nP = Object.keys(data.progress || {}).length;
      const ok = await confirmBox('バックアップを読み込む', `学習記録 ${nP} 語分・タグ・マイ単語帳 ${(data.custom || []).length} 語・設定で、いまのデータを<b>置き換え</b>ます。`, { ok: '置き換える', danger: true });
      if (!ok) return;
      Store.replace(data); Theme.apply(); Deck.build(); toast('読み込みました', 'ok'); Router.refresh(); return;
    }
    toast('このアプリのデータではないようです', 'err');
  };

  let parsed = { out: [], errors: [] };
  $('#im-text', el).addEventListener('input', () => {
    parsed = parseWordText($('#im-text', el).value);
    $('#im-add', el).disabled = $('#im-replace', el).disabled = !parsed.out.length;
    $('#im-preview', el).innerHTML = parsed.out.length || parsed.errors.length ? `
      <p style="font-size:13px;margin:10px 0 0"><b>${parsed.out.length}</b> 語を認識${parsed.errors.length ? `　<span style="color:var(--forgot-text)">読めなかった行：${parsed.errors.slice(0, 10).join(', ')}${parsed.errors.length > 10 ? '…' : ''}</span>` : ''}</p>
      <div style="overflow-x:auto"><table class="preview-table"><tr><th>No</th><th>英単語</th><th>意味</th><th>品詞</th><th>例文</th></tr>
      ${parsed.out.slice(0, 5).map(w => `<tr><td>${w.no || '自動'}</td><td>${esc(w.w)}</td><td>${esc(w.m)}</td><td>${POS[normPos(w.p)]}</td><td>${esc(w.e)}</td></tr>`).join('')}</table></div>` : '';
  });
  const addCustom = (list, replace) => {
    if (replace) Store.s.custom = [];
    const idx = new Map(Store.s.custom.map((c, i) => [String(c.w).toLowerCase(), i]));
    let n = 0;
    for (const w of list) {
      const k = String(w.w || w.word || '').trim().toLowerCase();
      if (!k) continue;
      if (idx.has(k)) Store.s.custom[idx.get(k)] = { ...Store.s.custom[idx.get(k)], ...w };
      else { idx.set(k, Store.s.custom.length); Store.s.custom.push(w); }
      n++;
    }
    // ターゲット1800を使っているなら「1800＋マイ単語帳」に、独自600語なら「マイ単語帳」に切り替える
    if (Store.s.settings.deck === 'book') Store.s.settings.deck = 'both';
    else if (Store.s.settings.deck === 'builtin') Store.s.settings.deck = 'custom';
    Store.flush(); Deck.build();
    return n;
  };
  const deckName = () => ({ book: 'ターゲット1800', builtin: '独自600語', custom: 'マイ単語帳', both: Deck.hasBook() ? '1800＋マイ単語帳' : '600語＋マイ単語帳' })[Store.s.settings.deck];
  $('#im-add', el).onclick = () => { const n = addCustom(parsed.out, false); toast(`${n}語を取り込みました（使う単語帳：${deckName()}）`, 'ok'); Router.refresh(); };
  $('#im-replace', el).onclick = async () => {
    if (Store.s.custom.length && !await confirmBox('置き換え', `いまのマイ単語帳 ${Store.s.custom.length} 語を消して、${parsed.out.length} 語で置き換えます。学習記録は残ります。`, { ok: '置き換える', danger: true })) return;
    const n = addCustom(parsed.out, true); toast(`${n}語で置き換えました`, 'ok'); Router.refresh();
  };
  $('#custom-clear', el).onclick = async () => {
    if (!await confirmBox('マイ単語帳を空にする', `マイ単語帳の ${Store.s.custom.length} 語を削除します。学習記録は残ります。`, { ok: '空にする', danger: true })) return;
    Store.s.custom = []; Store.s.settings.deck = Deck.hasBook() ? 'book' : 'builtin'; Store.flush(); Deck.build(); Router.refresh();
  };

  const bindSet = (sel, fn, ev = 'change') => { const n = $(sel, el); if (n) n.addEventListener(ev, () => { fn(n); Store.save(); }); };
  bindSet('#s-auto', n => s.autoSpeak = n.checked);
  bindSet('#s-sfx', n => s.sfx = n.checked);
  bindSet('#s-goal', n => s.dailyGoal = clamp(parseInt(n.value, 10) || 50, 5, 1000));
  bindSet('#s-slow', n => s.slowSec = clamp(parseInt(n.value, 10) || 6, 2, 30));
  bindSet('#s-theme', n => { s.theme = n.value; Theme.apply(); });
  bindSet('#s-ven', n => s.voiceEn = n.value);
  bindSet('#s-vja', n => s.voiceJa = n.value);
  bindSet('#s-rate', n => { s.rate = +n.value; $('#s-rate-v', el).textContent = s.rate.toFixed(2); }, 'input');
  $('#s-test', el)?.addEventListener('click', async () => { await Speech.say('consider'); await Speech.speak('～をよく考える', 'ja'); });

  $('#reset-progress', el).onclick = async () => {
    if (!await confirmBox('学習記録を消す', '覚えた／怪しい／忘れた の状態、復習予定、回答履歴、スコアランク、文法の成績を消します。タグ・マイ単語帳・設定は残ります。<b>元に戻せません。</b>', { ok: '消す', danger: true })) return;
    Store.s.progress = {}; Store.s.stats.daily = {}; Store.s.stats.ta = { bestCorrect: 0, bestScore: 0, bestCombo: 0, plays: 0 }; Store.s.ranks = { study: {}, ta: {}, gram: {} }; Store.s.gram = {}; Store.flush();
    toast('学習記録を消しました', 'ok'); Router.refresh();
  };
  $('#reset-all', el).onclick = async () => {
    if (!await confirmBox('すべて初期化', '学習記録・タグ・マイ単語帳・設定をすべて消します。<b>元に戻せません。</b>先に書き出しておくのがおすすめです。', { ok: '初期化する', danger: true })) return;
    Store.reset(); Theme.apply(); Deck.build(); toast('初期化しました', 'ok'); location.hash = '#/home';
  };
  const onVoices = () => { if ($('#s-ven', el) && enVoices.length !== Speech.list('en').length) Router.refresh(); };
  document.addEventListener('voices', onVoices);
  return () => document.removeEventListener('voices', onVoices);
};
