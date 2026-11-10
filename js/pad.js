'use strict';
/* ============================================================
   手書きキャンバス：英語の4線・筆圧・消しゴム・取り消し・答えの重ね表示
   座標は 0〜1 に正規化して保持 → 画面サイズが変わっても書いた字が崩れない
   ============================================================ */
class Pad {
  constructor(host, { onInk } = {}) {
    this.host = host;
    this.onInk = onInk;
    host.classList.add('pad');
    host.innerHTML = '<canvas class="pad-bg"></canvas><canvas class="pad-ink" aria-label="手書きエリア"></canvas><canvas class="pad-ans"></canvas><div class="pad-hint">ここに指・ペン・マウスで書く</div>';
    [this.bg, this.ink, this.ansC] = host.querySelectorAll('canvas');
    this.strokes = [];
    this.cur = null;
    this.tool = 'pen';
    this.answer = null;
    this.w = 0; this.h = 0;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.onTheme = () => { this.drawGuides(); this.redraw(); this.drawAnswer(); };
    document.addEventListener('themechange', this.onTheme);

    const c = this.ink;
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => c.addEventListener(t, e => this.up(e)));
    c.addEventListener('contextmenu', e => e.preventDefault());
    this.resize();
  }
  colors() {
    const cs = getComputedStyle(this.host);
    const g = n => cs.getPropertyValue(n).trim();
    return { ink: g('--pad-ink') || '#14243d', guide: g('--pad-guide') || '#d9dde4', base: g('--pad-base') || '#f0a3a3', ans: g('--pad-ans') || 'rgba(42,120,214,.4)' };
  }
  resize() {
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.w = r.width; this.h = r.height;
    for (const cv of [this.bg, this.ink, this.ansC]) {
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.drawGuides(); this.redraw(); this.drawAnswer();
  }
  lines() { return [0.22, 0.42, 0.62, 0.82].map(f => Math.round(this.h * f) + 0.5); }
  drawGuides() {
    const ctx = this.bg.getContext('2d'), col = this.colors();
    ctx.clearRect(0, 0, this.w, this.h);
    this.lines().forEach((y, i) => {
      ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(this.w - 10, y);
      ctx.lineWidth = i === 2 ? 1.6 : 1;
      ctx.strokeStyle = i === 2 ? col.base : col.guide;
      ctx.setLineDash(i === 1 ? [5, 5] : []);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }
  baseWidth() { return clamp(this.h * 0.022, 2.6, 6.5); }
  pt(e) {
    const r = this.ink.getBoundingClientRect();
    const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return [(e.clientX - r.left) / this.w, (e.clientY - r.top) / this.h, p];
  }
  down(e) {
    if (e.button > 0) return;
    e.preventDefault();
    try { this.ink.setPointerCapture(e.pointerId); } catch (_) {}
    this.cur = { t: this.tool, pts: [this.pt(e)], drawn: 1 };
    this.strokes.push(this.cur);
    if (this.tool === 'pen') this.host.classList.add('has-ink');
    this.onInk?.();
  }
  move(e) {
    if (!this.cur) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) this.cur.pts.push(this.pt(ev));
    this.paint(this.ink.getContext('2d'), this.cur, this.cur.drawn);
    this.cur.drawn = this.cur.pts.length;
  }
  up() {
    if (!this.cur) return;
    const ctx = this.ink.getContext('2d');
    this.tail(ctx, this.cur);
    this.cur = null;
  }
  style(ctx, s) {
    const col = this.colors();
    ctx.globalCompositeOperation = s.t === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = ctx.fillStyle = s.t === 'eraser' ? '#000' : col.ink;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }
  width(s, p) { return s.t === 'eraser' ? Math.max(18, this.h * 0.09) : this.baseWidth() * (0.55 + 0.9 * p); }
  /* 中点を結ぶ二次ベジェで滑らかに描く */
  paint(ctx, s, from = 1) {
    const P = s.pts, W = this.w, H = this.h;
    this.style(ctx, s);
    for (let i = Math.max(1, from); i < P.length; i++) {
      const a = P[i - 2] || P[i - 1], b = P[i - 1], c = P[i];
      const m0x = (a[0] + b[0]) / 2 * W, m0y = (a[1] + b[1]) / 2 * H;
      const m1x = (b[0] + c[0]) / 2 * W, m1y = (b[1] + c[1]) / 2 * H;
      ctx.beginPath();
      ctx.moveTo(m0x, m0y);
      ctx.quadraticCurveTo(b[0] * W, b[1] * H, m1x, m1y);
      ctx.lineWidth = this.width(s, (b[2] + c[2]) / 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  tail(ctx, s) {
    const P = s.pts, W = this.w, H = this.h;
    this.style(ctx, s);
    if (P.length === 1) {
      ctx.beginPath(); ctx.arc(P[0][0] * W, P[0][1] * H, this.width(s, P[0][2]) / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      const b = P[P.length - 2], c = P[P.length - 1];
      ctx.beginPath(); ctx.moveTo((b[0] + c[0]) / 2 * W, (b[1] + c[1]) / 2 * H); ctx.lineTo(c[0] * W, c[1] * H);
      ctx.lineWidth = this.width(s, c[2]); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  redraw() {
    const ctx = this.ink.getContext('2d');
    ctx.clearRect(0, 0, this.w, this.h);
    for (const s of this.strokes) { this.paint(ctx, s, 1); this.tail(ctx, s); }
  }
  setTool(t) { this.tool = t; this.host.classList.toggle('eraser', t === 'eraser'); }
  undo() { this.strokes.pop(); this.redraw(); this.sync(); }
  clear() { this.strokes = []; this.redraw(); this.hideAnswer(); this.sync(); }
  sync() { this.host.classList.toggle('has-ink', this.strokes.some(s => s.t === 'pen')); }
  isEmpty() { return !this.strokes.some(s => s.t === 'pen'); }
  /* 正解のつづりを4線に合わせて半透明で重ねる */
  showAnswer(text) { this.answer = text; this.drawAnswer(); }
  hideAnswer() { this.answer = null; this.drawAnswer(); }
  drawAnswer() {
    const ctx = this.ansC.getContext('2d');
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.answer) return;
    const [l1, , l3] = this.lines();
    const capH = l3 - l1;
    let fs = capH / 0.7;
    const family = '"Fraunces", Georgia, serif';
    ctx.font = `500 ${fs}px ${family}`;
    const maxW = this.w * 0.92;
    const tw = ctx.measureText(this.answer).width;
    if (tw > maxW) { fs *= maxW / tw; ctx.font = `500 ${fs}px ${family}`; }
    ctx.fillStyle = this.colors().ans;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.answer, this.w * 0.04, l3);
  }
  destroy() { this.ro.disconnect(); document.removeEventListener('themechange', this.onTheme); }
}

/* 手書きエリア＋道具バー（ペン・消しゴム・取り消し・全消去・キーボード入力切替） */
function padBlock(id = 'pad') {
  return `<div class="pad-wrap">
    <div id="${id}"></div>
    <div class="pad-tools">
      <button class="icon-btn on" data-tool="pen" data-tip="ペン" aria-label="ペン">${icon('pen')}</button>
      <button class="icon-btn" data-tool="eraser" data-tip="消しゴム" aria-label="消しゴム">${icon('eraser')}</button>
      <button class="icon-btn" data-pad="undo" data-tip="1画戻す" aria-label="1画戻す">${icon('undo')}</button>
      <button class="icon-btn" data-pad="clear" data-tip="クリア" aria-label="クリア">${icon('trash')}</button>
      <span class="grow"></span>
      <button class="icon-btn" data-pad="kb" data-tip="キーボードで入力（自動採点）" aria-label="キーボード入力に切替">${icon('keyboard')}</button>
    </div>
    <input class="input kb-input" id="${id}-kb" hidden autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="つづりを入力して Enter">
  </div>`;
}
function bindPadTools(root, pad, { onKb } = {}) {
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tool]');
    if (t) { pad.setTool(t.dataset.tool); $$('[data-tool]', root).forEach(b => b.classList.toggle('on', b === t)); return; }
    const a = e.target.closest('[data-pad]');
    if (!a) return;
    if (a.dataset.pad === 'undo') pad.undo();
    if (a.dataset.pad === 'clear') pad.clear();
    if (a.dataset.pad === 'kb') { a.classList.toggle('on'); onKb?.(a.classList.contains('on')); }
  });
}
