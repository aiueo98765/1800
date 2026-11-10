'use strict';
/* ============================================================
   スコアランク（全7段階）
   - 学習：10語以上を最後まで解くと、1回目の答え（覚えた=1・まだ怪しい=0.5・忘れた=0）の
     平均を100点満点にしたスコアでランクが付く
   - タイムアタック：得点でランクが付く
   - 範囲（Section・Part・タグなど）ごと、単語帳ごとに最高ランクを記録する
   ============================================================ */
const Rank = {
  // k=バッジの字 / mat=素材 / c=[暗, 中, 明] / ink=字のふち
  TIERS: [
    { k: '初', read: 'しょ', mat: '銅', c: ['#5c3215', '#a8652f', '#f2b783'], ink: '#3d1f0a' },
    { k: '習', read: 'しゅう', mat: '銀', c: ['#4e5866', '#97a3b1', '#f1f5f9'], ink: '#2c333d' },
    { k: '得', read: 'とく', mat: '金', c: ['#7a5208', '#c9971c', '#ffe58a'], ink: '#4a3204' },
    { k: '熟', read: 'じゅく', mat: '翠', c: ['#0b5a3a', '#17a06a', '#8ff0c4'], ink: '#05331f' },
    { k: '達', read: 'たつ', mat: '蒼', c: ['#12347a', '#2f6fdc', '#9cc4ff'], ink: '#0a1f4d' },
    { k: '傑', read: 'けつ', mat: '紅', c: ['#6e0c22', '#d02a4c', '#ff9fb3'], ink: '#420614' },
    { k: '天', read: 'てん', mat: '虹', c: ['#2a1660', '#6a3fd0', '#ffffff'], ink: '#1d0d47' },
  ],
  STUDY_TH: [50, 60, 70, 80, 90, 95, 100],
  TA_TH: [1000, 2000, 3500, 5500, 8000, 11000, 15000],
  MIN_WORDS: 10,

  of(score, th) { let r = 0; th.forEach((t, i) => { if (score >= t) r = i + 1; }); return r; },
  name(r) { return r ? this.TIERS[r - 1].k : ''; },
  /* 学習のスコア（100点満点・小数1桁） */
  studyScore(first) {
    const v = Object.values(first);
    if (!v.length) return 0;
    const pts = v.reduce((a, g) => a + (g === 'known' ? 1 : g === 'unsure' ? 0.5 : 0), 0);
    return Math.round(pts / v.length * 1000) / 10;
  },
  /* 記録の鍵。復習・状態・その場の寄せ集めは中身が変わるので記録しない */
  key(range, from, to) {
    if (!range) range = 'all';
    const type = range.split(':')[0];
    if (!['all', 'part', 'sec', 'tag', 'pos', 'nums'].includes(type)) return null;
    const r = type === 'nums' ? `nums:${Math.min(+from || 1, +to || 1)}-${Math.max(+from || 1, +to || 1)}` : range;
    return `${Store.s.settings.deck}::${r}`;
  },
  best(kind, key) { return key ? Store.s.ranks[kind][key] || null : null; },
  /* 記録して、前の最高と比べた結果を返す */
  record(kind, key, r, s) {
    const prev = this.best(kind, key);
    if (!key || !r) return { prev, up: false, best: prev };
    const better = !prev || r > prev.r || (r === prev.r && s > prev.s);
    if (better) { Store.s.ranks[kind][key] = { r, s, t: Date.now() }; Store.save(); }
    return { prev, up: !prev || r > prev.r, newBest: better, best: Store.s.ranks[kind][key] };
  },

  /* バッジ（亀甲＝六角形の紋。素材の色はランクごと） */
  _uid: 0,
  badge(r, size = 48, cls = '') {
    const hex = R => Array.from({ length: 6 }, (_, i) => {
      const a = (-90 + i * 60) * Math.PI / 180;
      return `${(50 + R * Math.cos(a)).toFixed(2)},${(50 + R * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
    if (!r) return `<span class="rank-badge none ${cls}" style="--s:${size}px" role="img" aria-label="ランクなし"><svg viewBox="0 0 100 100"><polygon points="${hex(44)}" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="7 6" stroke-linejoin="round"/></svg></span>`;
    const T = this.TIERS[r - 1], id = 'rk' + (++this._uid);
    const top = r === 7;
    const rim = top
      ? `<linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b8b"/><stop offset=".2" stop-color="#ffc35a"/><stop offset=".4" stop-color="#fff27a"/><stop offset=".6" stop-color="#6ee7a8"/><stop offset=".8" stop-color="#5fb4ff"/><stop offset="1" stop-color="#b27bff"/></linearGradient>`
      : `<linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.c[2]}"/><stop offset=".45" stop-color="${T.c[1]}"/><stop offset=".55" stop-color="${T.c[0]}"/><stop offset=".8" stop-color="${T.c[1]}"/><stop offset="1" stop-color="${T.c[2]}"/></linearGradient>`;
    const body = `<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top ? '#5b3bc4' : T.c[1]}"/><stop offset="1" stop-color="${T.c[0]}"/></linearGradient>`;
    const star = (x, y, s) => `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="#fff"/>`;
    const stars = r >= 5 ? `<g class="rk-stars">${star(86, 14, 7)}${star(13, 80, 5)}${r >= 6 ? star(90, 84, 4.5) : ''}${top ? star(10, 18, 5.5) : ''}</g>` : '';
    return `<span class="rank-badge r${r} ${cls}" style="--s:${size}px" role="img" aria-label="スコアランク ${T.k}（${T.mat}）">
      <svg viewBox="0 0 100 100"><defs>${rim}${body}
        <clipPath id="${id}c"><polygon points="${hex(36)}"/></clipPath></defs>
        <polygon points="${hex(46)}" fill="${T.ink}" opacity=".35" transform="translate(0 3)"/>
        <polygon points="${hex(46)}" fill="url(#${id}a)" stroke="${T.ink}" stroke-width="1.5" stroke-linejoin="round"/>
        <polygon points="${hex(36)}" fill="url(#${id}b)" stroke="${T.ink}" stroke-opacity=".5" stroke-width="1.5" stroke-linejoin="round"/>
        <g clip-path="url(#${id}c)" opacity=".18" stroke="#fff" stroke-width="1.2" fill="none">
          ${[0, 1, 2].map(i => `<polygon points="${hex(30 - i * 9)}"/>`).join('')}
        </g>
        <ellipse cx="38" cy="26" rx="30" ry="16" fill="#fff" opacity=".22" clip-path="url(#${id}c)"/>
        <text x="50" y="53" text-anchor="middle" dominant-baseline="central" font-size="42" font-weight="900"
          font-family='"Yu Mincho","YuMincho","Hiragino Mincho ProN","Noto Serif JP","Noto Serif CJK JP",serif'
          fill="#fff" stroke="${T.ink}" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${T.k}</text>
        ${stars}
      </svg></span>`;
  },

  /* ランク表（モーダル） */
  guideHTML() {
    return `<div class="rk-guide">
      <p class="rk-lead">単語の学習・文法演習・タイムアタックのスコアに応じて、<b>全7段階</b>のスコアランクが付きます。範囲ごとに最高ランクが残るので、上のランクを目指して何度でも挑戦できます。</p>
      <div class="rk-stairs">${this.TIERS.map((T, i) => `<div class="rk-step" style="--i:${i}">${this.badge(i + 1, 52)}</div>`).join('')}</div>
      <table class="rk-table">
        <thead><tr><th>ランク</th><th>学習・文法のスコア</th><th>タイムアタック</th></tr></thead>
        <tbody>${this.TIERS.map((T, i) => `<tr><td><div class="rk-cell">${this.badge(i + 1, 30)}<span><b>${T.k}</b><small>${T.read} · ${T.mat}</small></span></div></td>
          <td>${i === 6 ? '100点（全問1回目で覚えた）' : `${this.STUDY_TH[i]}点以上`}</td><td>${nfmt(this.TA_TH[i])}点以上</td></tr>`).join('')}</tbody>
      </table>
      <ul class="rk-notes">
        <li>学習のスコア＝1回目の答えの平均（覚えた 1・まだ怪しい 0.5・忘れた 0）を100点満点にしたもの。<b>${this.MIN_WORDS}語以上を最後まで</b>解くと判定されます</li>
        <li>Section・Part・タグ・品詞・番号の範囲ごとに、単語帳ごとの最高ランクを記録します（今日の復習・要復習リストなどは中身が毎回変わるので記録しません）</li>
        <li>文法演習も同じ基準（正解 1・おしい／あやしい 0.5・不正解 0）。単元×出題形式ごと、入試実戦テストごとに記録します</li>
        <li>タイムアタックは得点で判定し、出題範囲ごとに記録します</li>
      </ul>
    </div>`;
  },
  openGuide() { const m = openModal({ title: 'スコアランク 全7段階', cls: 'rk-modal' }); m.body.innerHTML = this.guideHTML(); return m; },

  /* 結果画面のランク表示。res = record() の戻り値 */
  resultHTML({ r, score, unit, th, res, note }) {
    if (!r) {
      return `<div class="rk-result none">${this.badge(0, 84)}<div class="rk-res-text"><div class="rk-res-title">スコアランクなし</div>
        <div class="rk-res-score">スコア <b>${nfmt(score)}</b>${unit}</div>
        <div class="muted">${note || `「${this.TIERS[0].k}」まであと ${nfmt(Math.ceil((th[0] - score) * 10) / 10)}${unit}`}</div>
        <button class="btn sm ghost" data-rank-guide>${icon('info')}ランク表</button></div></div>`;
    }
    const T = this.TIERS[r - 1];
    const nextTh = th[r];
    const prev = res?.prev;
    const tag = res?.up && prev ? `<span class="badge rk-up">ランクアップ ${this.name(prev.r)} → ${T.k}</span>`
      : res?.up ? '<span class="badge rk-up">初ランク獲得</span>'
      : res?.newBest ? '<span class="badge rk-up">自己ベスト更新</span>' : '';
    return `<div class="rk-result">
      ${this.badge(r, 112, 'reveal')}
      <div class="rk-res-text">
        <div class="rk-res-sub">スコアランク</div>
        <div class="rk-res-title">「${T.k}」<small>${T.read} · ${T.mat}</small> 獲得！</div>
        <div class="rk-res-score">スコア <b>${nfmt(score)}</b>${unit}</div>
        ${tag}
        <div class="muted">${nextTh != null ? `次の「${this.TIERS[r].k}」まで あと <b>${nfmt(Math.ceil((nextTh - score) * 10) / 10)}${unit}</b>` : '最高ランクです'}${prev && !res.newBest ? ` · この範囲の最高は「${this.name(prev.r)}」` : ''}</div>
        <button class="btn sm ghost" data-rank-guide>${icon('info')}ランク表</button>
      </div>
    </div>`;
  },
};
document.addEventListener('click', e => { if (e.target.closest('[data-rank-guide]')) Rank.openGuide(); });

/* ============================================================
   学習ランク（段位：10級〜十段）
   - 毎日の回答で増える：1回答 = 1pt、正解ならさらに +1pt（学習量に比例）
   - 学習しなかった日は減る：1日目 −3%、続けて休むほど大きく（−5%, −7% …最大 −15%/日）
   - 回答の記録（stats.daily）から毎回計算し直すので、別に保存はしない
   ============================================================ */
const Level = {
  TIERS: [
    ['10級', 0], ['9級', 30], ['8級', 80], ['7級', 150], ['6級', 250], ['5級', 400], ['4級', 600], ['3級', 850], ['2級', 1150], ['1級', 1500],
    ['初段', 2000], ['二段', 2600], ['三段', 3300], ['四段', 4100], ['五段', 5000], ['六段', 6000], ['七段', 7200], ['八段', 8600], ['九段', 10200], ['十段', 12000],
  ],
  // 段位の色の組（10〜6級 / 5〜1級 / 初段〜四段 / 五段〜九段 / 十段）
  COLORS: [['#0d5c3a', '#2fa36b', '#9be8c0'], ['#13357d', '#2f6fdc', '#a9cbff'], ['#2c1766', '#6a3fd0', '#cdb8ff'], ['#650b20', '#c0263f', '#ffa6b8'], ['#5a3a00', '#c9971c', '#ffe9a0']],
  gain: d => d ? (d.n || 0) + (d.ok || 0) : 0,
  decay: k => Math.min(0.15, 0.03 + 0.02 * (k - 1)),
  dayOf(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); },
  tierOf(p) { let i = 0; this.TIERS.forEach(([, min], j) => { if (p >= min) i = j; }); return i; },
  colorOf(i) { return this.COLORS[i < 5 ? 0 : i < 10 ? 1 : i < 14 ? 2 : i < 19 ? 3 : 4]; },
  compute() {
    const daily = Store.s.stats.daily;
    const keys = Object.keys(daily).filter(k => daily[k]?.n > 0).sort();
    const today = sod();
    const series = [];
    let p = 0, miss = 0;
    if (keys.length) {
      for (let t = this.dayOf(keys[0]); t <= today; t = sod(t + DAY * 1.5)) {
        const g = this.gain(daily[dkey(t)]);
        let loss = 0;
        if (g > 0) { p += g; miss = 0; }
        else if (t < today) { miss++; loss = p * this.decay(miss); p -= loss; }
        series.push({ t, p, g, loss, rest: g === 0 && t < today });
      }
    }
    const i = this.tierOf(p);
    const next = this.TIERS[i + 1];
    const todayGain = this.gain(daily[dkey()]);
    const riskRate = this.decay(miss + 1);
    return {
      p, i, name: this.TIERS[i][0], next: next ? next[0] : null, toNext: next ? next[1] - p : 0,
      frac: next ? (p - this.TIERS[i][1]) / (next[1] - this.TIERS[i][1]) : 1,
      todayGain, risk: todayGain ? 0 : p * riskRate, riskRate, miss, series, started: keys.length > 0,
    };
  },
  emblem(i, size = 64) {
    const [d, m, l] = this.colorOf(i), id = 'lv' + (++Rank._uid), name = this.TIERS[i][0];
    const fs = name.length >= 3 ? 25 : 30;
    return `<span class="lv-emblem${i === 19 ? ' top' : ''}" style="--s:${size}px" role="img" aria-label="学習ランク ${name}">
      <svg viewBox="0 0 100 100"><defs>
        <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${l}"/><stop offset=".5" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></linearGradient>
        <radialGradient id="${id}b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></radialGradient></defs>
        <circle cx="50" cy="53" r="46" fill="${d}" opacity=".35"/>
        <circle cx="50" cy="50" r="46" fill="url(#${id}a)"/>
        <circle cx="50" cy="50" r="37" fill="url(#${id}b)"/>
        <circle cx="50" cy="50" r="33" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="2 3"/>
        <ellipse cx="40" cy="30" rx="24" ry="11" fill="#fff" opacity=".18"/>
        <text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="900"
          font-family='"Yu Mincho","YuMincho","Hiragino Mincho ProN","Noto Serif JP","Noto Serif CJK JP",serif'
          fill="#fff" stroke="${d}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${name}</text>
      </svg></span>`;
  },
  /* ホームのカード（段位・次まで・直近30日のポイント推移） */
  cardHTML() {
    const L = this.compute();
    const last = 30, today = sod();
    const pts = [];
    for (let k = last - 1; k >= 0; k--) {
      const t = sod(today - k * DAY + DAY / 2);
      const s = L.series.find(x => x.t === t);
      pts.push({ t, p: s ? s.p : 0, g: s ? s.g : 0, loss: s ? s.loss : 0, rest: s ? s.rest : false });
    }
    const W = 320, H = 96, pad = 4, step = (W - pad * 2) / (last - 1);
    const max = Math.max(10, ...pts.map(x => x.p)) * 1.12;
    const X = j => pad + j * step, Y = v => H - 14 - v / max * (H - 24);
    const line = pts.map((x, j) => `${j ? 'L' : 'M'}${X(j).toFixed(1)} ${Y(x.p).toFixed(1)}`).join(' ');
    const area = `${line} L${X(last - 1).toFixed(1)} ${H - 14} L${X(0).toFixed(1)} ${H - 14} Z`;
    const md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
    const hits = pts.map((x, j) => {
      const tip = `${md(x.t)}：${nfmt(Math.floor(x.p))}pt${x.g ? `（+${x.g}）` : x.rest ? `（休み −${nfmt(Math.round(x.loss))}）` : ''}`;
      return `<rect x="${(X(j) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}" fill="transparent" data-tip="${tip}"/>`;
    }).join('');
    const rests = pts.map((x, j) => x.rest ? `<circle cx="${X(j).toFixed(1)}" cy="${Y(x.p).toFixed(1)}" r="3.4" class="lv-rest"/>` : '').join('');
    const status = !L.started ? `<span class="lv-note">${icon('info')}回答すると学習ランクが上がります</span>`
      : L.todayGain ? `<span class="lv-note ok">${icon('check')}今日 <b>+${nfmt(L.todayGain)}pt</b>。この調子で続けよう</span>`
      : `<span class="lv-note warn">${icon('alert')}今日はまだ学習していません。このままだと明日 <b>−${nfmt(Math.ceil(L.risk))}pt</b>（−${Math.round(L.riskRate * 100)}%）</span>`;
    return `<section class="card lv-card">
      <div class="lv-main">
        ${this.emblem(L.i, 76)}
        <div class="lv-info">
          <div class="lv-label">学習ランク</div>
          <div class="lv-name">${L.name}<small>${nfmt(Math.floor(L.p))} pt</small></div>
          <div class="meter lv-meter"><i style="width:${(L.frac * 100).toFixed(1)}%"></i></div>
          <div class="lv-next">${L.next ? `「${L.next}」まで あと <b>${nfmt(Math.ceil(L.toNext))}pt</b>` : '最高段位です'}</div>
        </div>
      </div>
      <div class="lv-chart">
        <div class="lv-chart-head"><span>直近30日の学習ポイント</span><span class="lv-legend"><i></i>休んだ日（減少）</span></div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="直近30日の学習ポイントの推移">
          <line x1="${pad}" x2="${W - pad}" y1="${H - 14}" y2="${H - 14}" class="lv-base"/>
          <path d="${area}" class="lv-area"/><path d="${line}" class="lv-line"/>${rests}${hits}
        </svg>
        <div class="lv-ax"><span>${md(pts[0].t)}</span><span>今日</span></div>
      </div>
      <div class="lv-foot">${status}<button class="btn sm ghost" data-level-guide>${icon('info')}しくみ</button></div>
    </section>`;
  },
  /* サイドバーの小さな表示 */
  sideHTML() {
    const L = this.compute();
    return `${this.emblem(L.i, 34)}<span><small>学習ランク</small><b>${L.name}</b></span>${L.started && !L.todayGain ? `<i class="lv-dot" data-tip="今日まだ学習していません"></i>` : ''}`;
  },
  openGuide() {
    const L = this.compute();
    const m = openModal({ title: '学習ランク（段位）', cls: 'rk-modal' });
    m.body.innerHTML = `<div class="rk-guide">
      <p class="rk-lead">全体の学習量に比例して上がる段位です。<b>1回答で1pt、正解ならさらに1pt</b>。単語・文法・タイムアタックのどの回答でも増えます。<br>学習しなかった日は、次の日に <b>−3%</b>。続けて休むほど減り方が大きくなり（−5%、−7% … 最大 −15%/日）、段位が下がることもあります。</p>
      <div class="lv-grid">${this.TIERS.map(([n, min], i) => `<div class="lv-tier${i === L.i ? ' cur' : ''}">${this.emblem(i, 40)}<span><b>${n}</b><small>${nfmt(min)}pt〜</small></span></div>`).join('')}</div>
    </div>`;
  },
};
document.addEventListener('click', e => { if (e.target.closest('[data-level-guide]')) Level.openGuide(); });
