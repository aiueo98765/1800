'use strict';
/* ============================================================
   ルーター / ナビゲーション / 起動
   ============================================================ */
const NAV = [
  { id: 'home', label: 'ホーム', ic: 'home' },
  { id: 'study', label: '学習', ic: 'book' },
  { id: 'grammar', label: '文法・入試', ic: 'scroll' },
  { id: 'review', label: '復習', ic: 'repeat', badge: () => SRS.dueWords().length },
  { id: 'attack', label: 'タイムアタック', ic: 'zap' },
  { id: 'listen', label: 'ながら聴き', ic: 'headphones' },
  { id: 'words', label: '単語一覧', ic: 'list' },
  { id: 'tags', label: 'タグ', ic: 'tag' },
  { id: 'data', label: '設定・データ', ic: 'sliders' },
];
const TABS = ['home', 'study', 'grammar', 'review'];
const TITLES = { home: 'ホーム', study: '学習', session: '学習中', review: '復習', attack: 'タイムアタック', listen: 'ながら聴き', words: '単語一覧', tags: 'タグ', data: '設定・データ', grammar: '文法・入試対策', gsession: '文法演習中' };

const Router = {
  cleanup: null,
  name: 'home',
  parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, qs] = h.split('?');
    return { name: Views[name] ? name : 'home', q: new URLSearchParams(qs || '') };
  },
  render() {
    const { name, q } = this.parse();
    try { this.cleanup?.(); } catch (e) { console.error(e); }
    this.cleanup = null;
    Speech.cancel();
    $$('.modal-wrap').forEach(m => m.remove());
    const old = $('#view');
    const el = old.cloneNode(false); // 古いイベントリスナーを持ち越さない
    old.replaceWith(el);
    this.name = name;
    document.body.dataset.view = name;
    try {
      const ret = Views[name](el, q);
      if (typeof ret === 'function') this.cleanup = ret;
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="empty">${icon('alert')}<b>表示中にエラーが起きました</b>${esc(e.message)}</div>`;
    }
    $('#view-title').textContent = TITLES[name] || '';
    document.title = `${TITLES[name] || ''} | ターゲット1800 究極反復学習システム`;
    FS.sync();
    this.updateNav();
    if (name !== 'session' && name !== 'gsession') window.scrollTo(0, 0);
  },
  refresh() { this.render(); },
  updateNav() {
    const cur = this.name === 'session' ? 'study' : this.name === 'gsession' ? 'grammar' : this.name;
    const badge = n => n ? `<span class="badge">${n > 99 ? '99+' : n}</span>` : '';
    $('#nav').innerHTML = NAV.map((n, i) => `${i === 6 ? '<div class="nav-sep"></div>' : ''}<a href="#/${n.id}" class="${cur === n.id ? 'on' : ''}">${icon(n.ic)}<span>${n.label}</span>${n.badge ? badge(n.badge()) : ''}</a>`).join('');
    $('#tabbar').innerHTML = TABS.map(id => {
      const n = NAV.find(x => x.id === id);
      return `<a href="#/${id}" class="${cur === id ? 'on' : ''}">${icon(n.ic)}<span>${n.label}</span>${n.badge ? badge(n.badge()) : ''}</a>`;
    }).join('') + `<button type="button" data-more class="${TABS.includes(cur) ? '' : 'on'}">${icon('more')}<span>その他</span></button>`;

    const sl = $('#side-level'); if (sl) sl.innerHTML = Level.sideHTML();
  },
};

function openMoreMenu() {
  const items = NAV.filter(n => !TABS.includes(n.id));
  const m = openModal({ title: 'メニュー', body: `<div class="menu-list">${items.map(n => `<a href="#/${n.id}"><span class="mode-ico">${icon(n.ic)}</span>${n.label}</a>`).join('')}</div>` });
  m.body.addEventListener('click', e => { if (e.target.closest('a')) m.close(); });
}

/* 画面をまたいで効く操作（発音ボタン・フルスクリーン・単語カードを開く） */
document.addEventListener('click', async e => {
  const say = e.target.closest('[data-say]');
  if (say) {
    e.preventDefault();
    say.classList.add('playing');
    const slow = say.classList.contains('sm') && say.getAttribute('aria-label') === 'ゆっくり発音';
    await Speech.say(say.dataset.say, say.dataset.lang || 'en', slow ? 0.55 : undefined);
    say.classList.remove('playing');
    return;
  }
  if (e.target.closest('[data-fs-btn]')) { FS.toggle(); return; }
  if (e.target.closest('#theme-btn')) { Theme.cycle(); return; }
  if (e.target.closest('[data-more]')) { openMoreMenu(); return; }
});

/* 起動 */
(function boot() {
  Store.load();
  Deck.parse();
  Deck.parseBook();
  Grammar.parse();
  const S = Store.s.settings;
  const home = Deck.hasBook() ? 'book' : 'builtin';
  // 一覧PDFの1800語を入れたので、自分で単語帳を選んだことがなければそちらを使う
  if (!S.deckPicked && S.deck === 'builtin') S.deck = home;
  if ((S.deck === 'custom' || S.deck === 'both') && !Store.s.custom.length) S.deck = home;
  if (S.deck === 'book' && !Deck.hasBook()) S.deck = 'builtin';
  Deck.build();
  Theme.apply();
  Speech.init();
  Tip.init();
  Pomo.init();
  addEventListener('hashchange', () => Router.render());
  Router.render();
  // 日付が変わったら復習バッジを更新
  let day = dkey();
  setInterval(() => { if (dkey() !== day) { day = dkey(); Router.updateNav(); } }, 60000);
})();
