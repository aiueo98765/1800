'use strict';
/* ============================================================
   ポモドーロ・タイマー（画面右下に常駐。学習中はヘッダーに格納）
   終了時刻を保存するので、リロードしても時間は進み続ける
   ============================================================ */
const Pomo = {
  KEY: 't1800:pomo',
  st: { mode: 'focus', running: false, endsAt: 0, left: 0, cycle: 0 },
  root: null, home: null, open: false,
  LABEL: { focus: '集中', short: '休憩', long: '長い休憩' },
  dur(mode = this.st.mode) { const p = Store.s.settings.pomo; return (mode === 'focus' ? p.focus : mode === 'short' ? p.short : p.long) * 60000; },
  init() {
    this.root = $('#pomo');
    try { Object.assign(this.st, JSON.parse(localStorage.getItem(this.KEY) || '{}')); } catch (_) {}
    if (!this.st.left) this.st.left = this.dur();
    this.root.innerHTML = `
      <button class="pomo-pill" aria-expanded="false" aria-label="ポモドーロ・タイマー">
        <svg viewBox="0 0 36 36"><circle class="trk" cx="18" cy="18" r="15" fill="none" stroke-width="4"/><circle class="prg" cx="18" cy="18" r="15" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="0"/></svg>
        <span class="t">25:00</span>
      </button>
      <div class="pomo-panel" hidden>
        <div class="seg-ctl" style="display:flex">${['focus', 'short', 'long'].map(m => `<button data-pm="${m}" style="flex:1">${this.LABEL[m]}</button>`).join('')}</div>
        <div class="pomo-ring">
          <svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52" fill="none" stroke="var(--surface-3)" stroke-width="8"/><circle class="prg2" cx="60" cy="60" r="52" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="326.73" stroke-dashoffset="0"/></svg>
          <div class="t"><b class="num">25:00</b><span class="lbl">集中</span></div>
        </div>
        <div class="pomo-ctrl">
          <button class="icon-btn" data-pa="reset" aria-label="リセット" data-tip="リセット">${icon('refresh')}</button>
          <button class="main" data-pa="toggle" aria-label="開始">${icon('play')}</button>
          <button class="icon-btn" data-pa="skip" aria-label="次へスキップ" data-tip="スキップ">${icon('skip')}</button>
        </div>
        <div class="pomo-meta"></div>
        <details><summary>時間の設定</summary>
          <div class="pomo-set">
            <label>集中（分）<input class="input" type="number" min="1" max="120" data-ps="focus"></label>
            <label>休憩（分）<input class="input" type="number" min="1" max="60" data-ps="short"></label>
            <label>長い休憩（分）<input class="input" type="number" min="1" max="90" data-ps="long"></label>
          </div>
          <label class="check" style="margin-top:6px"><input type="checkbox" data-ps="auto"><span class="tg"></span><span>次のタイマーを自動で開始</span></label>
          <label class="check"><input type="checkbox" data-ps="notify"><span class="tg"></span><span>終了を通知で知らせる</span></label>
        </details>
      </div>`;
    const p = Store.s.settings.pomo;
    $$('[data-ps]', this.root).forEach(inp => { if (inp.type === 'checkbox') inp.checked = !!p[inp.dataset.ps]; else inp.value = p[inp.dataset.ps]; });
    this.root.addEventListener('click', e => this.onClick(e));
    this.root.addEventListener('change', e => this.onSet(e));
    document.addEventListener('pointerdown', e => { if (this.open && !this.root.contains(e.target)) this.toggle(false); });
    setInterval(() => this.tick(), 500);
    this.tick();
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.st)); } catch (_) {} },
  remaining() { return this.st.running ? Math.max(0, this.st.endsAt - Date.now()) : this.st.left; },
  toggle(v = !this.open) {
    this.open = v;
    $('.pomo-panel', this.root).hidden = !v;
    $('.pomo-pill', this.root).setAttribute('aria-expanded', v);
  },
  start() { this.st.running = true; this.st.endsAt = Date.now() + this.st.left; this.save(); this.tick(); },
  pause() { this.st.left = this.remaining(); this.st.running = false; this.save(); this.tick(); },
  setMode(m, autostart = false) {
    this.st.mode = m; this.st.left = this.dur(m); this.st.running = false;
    if (autostart) this.start(); else { this.save(); this.tick(); }
  },
  complete() {
    const p = Store.s.settings.pomo;
    const wasFocus = this.st.mode === 'focus';
    let nextMode = 'focus';
    if (wasFocus) {
      this.st.cycle++;
      const k = dkey(); Store.s.stats.pomo[k] = (Store.s.stats.pomo[k] || 0) + 1; Store.save();
      nextMode = this.st.cycle % (p.every || 4) === 0 ? 'long' : 'short';
    }
    Sfx.bell();
    const msg = wasFocus ? `集中おつかれさま！ ${this.LABEL[nextMode]}（${p[nextMode]}分）にしましょう` : '休憩おわり。次の25分、いきましょう';
    toast(msg, 'ok');
    if (p.notify && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('ポモドーロ', { body: msg, tag: 't1800-pomo' }); } catch (_) {}
    }
    this.setMode(nextMode, p.auto);
  },
  tick() {
    if (this.st.running && Date.now() >= this.st.endsAt) { this.st.running = false; this.st.left = 0; this.complete(); return; }
    const left = this.remaining(), total = this.dur();
    const s = Math.ceil(left / 1000), txt = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
    const frac = total ? left / total : 0;
    this.root.dataset.mode = this.st.mode;
    if (this.st.running) this.root.dataset.running = ''; else delete this.root.dataset.running;
    $('.pomo-pill .t', this.root).textContent = txt;
    $('.pomo-pill .prg', this.root).style.strokeDashoffset = 94.25 * (1 - frac);
    $('.pomo-ring b', this.root).textContent = txt;
    $('.pomo-ring .lbl', this.root).textContent = this.LABEL[this.st.mode] + (this.st.running ? '' : '（停止中）');
    const prg = $('.prg2', this.root);
    prg.style.stroke = this.st.mode === 'focus' ? 'var(--accent)' : 'var(--break)';
    prg.style.strokeDashoffset = 326.73 * (1 - frac);
    const main = $('[data-pa="toggle"]', this.root);
    const want = this.st.running ? 'pause' : 'play';
    if (main.dataset.ic !== want) { main.innerHTML = icon(want); main.dataset.ic = want; main.setAttribute('aria-label', this.st.running ? '一時停止' : '開始'); }
    $$('[data-pm]', this.root).forEach(b => b.classList.toggle('on', b.dataset.pm === this.st.mode));
    const today = Store.s.stats.pomo[dkey()] || 0;
    $('.pomo-meta', this.root).textContent = `今日の集中 ${today}回 · ${Store.s.settings.pomo.every}回ごとに長い休憩`;
    $('.pomo-pill', this.root).dataset.tip = `${this.LABEL[this.st.mode]} ${txt}${this.st.running ? '' : '（停止中）'}`;
  },
  onClick(e) {
    if (e.target.closest('.pomo-pill')) { this.toggle(); Sfx.ac(); return; }
    const m = e.target.closest('[data-pm]');
    if (m) { this.setMode(m.dataset.pm); return; }
    const a = e.target.closest('[data-pa]');
    if (!a) return;
    if (a.dataset.pa === 'toggle') this.st.running ? this.pause() : this.start();
    if (a.dataset.pa === 'reset') this.setMode(this.st.mode);
    if (a.dataset.pa === 'skip') { this.st.running = false; this.complete(); }
  },
  async onSet(e) {
    const k = e.target.dataset.ps; if (!k) return;
    const p = Store.s.settings.pomo;
    if (e.target.type === 'checkbox') {
      p[k] = e.target.checked;
      if (k === 'notify' && p.notify && 'Notification' in window && Notification.permission !== 'granted') {
        const r = await Notification.requestPermission().catch(() => 'denied');
        if (r !== 'granted') { p.notify = false; e.target.checked = false; toast('通知が許可されませんでした', 'err'); }
      }
    } else {
      p[k] = clamp(parseInt(e.target.value, 10) || p[k], 1, 120);
      e.target.value = p[k];
      if (!this.st.running && ((k === 'focus' && this.st.mode === 'focus') || (k !== 'focus' && this.st.mode === k))) this.st.left = this.dur();
    }
    Store.save(); this.save(); this.tick();
  },
  /* 学習中は学習画面のヘッダーへ、それ以外は上部バーへ */
  dock(slot) { if (!slot || !this.root) return; this.toggle(false); slot.appendChild(this.root); },
  undock() { const home = $('#pomo-home'); if (!this.root || !home || home.contains(this.root)) return; this.toggle(false); home.appendChild(this.root); },
};
