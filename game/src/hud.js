// The DOM HUD: crosshair, hit marker, health, ammo, money, timer, score, killfeed,
// banners, the buy menu and the overlays. It never touches the simulation;
// main.js pushes numbers in and reads callbacks out.
const OVERLAY_COPY = {
  start: {
    title: 'SANDLINE',
    copy: 'Yard 7 — plant the spike at Warehouse A or Silo B, or wipe the Sentinels out. First to 5 rounds takes the match.',
    action: 'Click to play',
  },
  paused: {
    title: 'SANDLINE',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  dead: {
    title: 'You are down',
    copy: 'Watching a teammate. The round plays on without you.',
    action: 'Keep watching',
  },
  match: {
    title: 'Match over',
    copy: '',
    action: 'Play again',
  },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const copy = $('overlay-copy');
  const play = $('play');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const ammoBox = $('ammo');
  const healthFill = $('health-fill');
  const healthNum = $('health-num');
  const moneyValue = $('money-value');
  const timerValue = $('timer-value');
  const scoreV = $('score-vanguard');
  const scoreS = $('score-sentinel');
  const roundValue = $('round-value');
  const killfeed = $('killfeed');
  const hitmarker = $('hitmarker');
  const crosshair = $('crosshair');
  const banner = $('banner');
  const bannerTitle = $('banner-title');
  const bannerSub = $('banner-sub');
  const buyMenu = $('buymenu');
  const buyList = $('buy-list');
  const buyMoney = $('buy-money');
  const bombStatus = $('bomb-status');
  const bombText = $('bomb-text');
  const vignette = $('vignette');
  const grenadeCount = $('grenade-count');
  const weaponName = $('weapon-name');
  const scope = $('scope');
  let hitTimer = 0;
  let lastAmmo = '';
  let lastHealth = -1;
  let lastMoney = -1;
  let lastTimer = '';
  let lastScore = '';
  let bannerTimer = 0;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  return {
    setAmmo(mag, reserve) {
      const key = `${mag}/${reserve}`;
      if (key === lastAmmo) return;
      lastAmmo = key;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      ammoBox.classList.toggle('empty', mag === 0);
    },
    setHealth(hp) {
      const v = Math.max(0, Math.round(hp));
      if (v === lastHealth) return;
      lastHealth = v;
      healthFill.style.width = `${v}%`;
      healthFill.classList.toggle('low', v <= 30);
      healthNum.textContent = String(v);
    },
    setMoney(m) {
      if (m === lastMoney) return;
      lastMoney = m;
      moneyValue.textContent = `$${m}`;
    },
    setTimer(seconds, urgent) {
      const s = Math.max(0, Math.ceil(seconds));
      const key = `${s}:${urgent ? 'u' : ''}`;
      if (key === lastTimer) return;
      lastTimer = key;
      timerValue.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      timerValue.classList.toggle('urgent', !!urgent);
    },
    setScore(v, s, round) {
      const key = `${v}-${s}-${round}`;
      if (key === lastScore) return;
      lastScore = key;
      scoreV.textContent = String(v);
      scoreS.textContent = String(s);
      roundValue.textContent = `ROUND ${round}`;
    },
    setWeapon(name) { weaponName.textContent = name; },
    setGrenades(n) { grenadeCount.textContent = n > 0 ? `◉ ${n}` : ''; },
    setCrosshair(gapPx) {
      crosshair.style.setProperty('--gap', `${gapPx.toFixed(1)}px`);
    },
    setScoped(on) { scope.hidden = !on; },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      if (killed) hitmarker.classList.add('kill');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    killfeed(killer, victim, headshot) {
      const row = el('div', 'feed-row');
      row.appendChild(el('span', killer === 'You' ? 'feed-you' : 'feed-name', killer));
      if (headshot) row.appendChild(el('span', 'feed-head', '◎'));
      row.appendChild(el('span', 'feed-x', '✕'));
      row.appendChild(el('span', victim === 'You' ? 'feed-you' : 'feed-name', victim));
      killfeed.prepend(row);
      while (killfeed.children.length > 5) killfeed.removeChild(killfeed.lastChild);
      setTimeout(() => { if (row.parentNode) row.parentNode.removeChild(row); }, 6000);
    },
    damageFlash() {
      vignette.classList.add('hit');
      setTimeout(() => vignette.classList.remove('hit'), 180);
    },
    showBanner(titleText, subText, ms = 3600) {
      bannerTitle.textContent = titleText;
      bannerSub.textContent = subText;
      banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { banner.hidden = true; }, ms);
    },
    hideBanner() { banner.hidden = true; },
    showOverlay(mode, extra) {
      const text = OVERLAY_COPY[mode];
      title.textContent = text.title;
      copy.textContent = mode === 'match' && extra ? extra : text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() { overlay.hidden = true; },
    onPlay(handler) { play.addEventListener('click', handler); },
    showBuyMenu(items, money, round, onBuy) {
      document.getElementById('buy-round').textContent = String(round);
      buyMoney.textContent = `$${money}`;
      buyList.innerHTML = '';
      for (const item of items) {
        const row = el('button', 'buy-row');
        row.type = 'button';
        const affordable = money >= item.price;
        row.classList.toggle('poor', !affordable);
        row.appendChild(el('span', 'buy-key', item.index === 99 ? 'G' : String(item.index + 1)));
        const mid = el('span', 'buy-mid');
        mid.appendChild(el('b', '', item.name));
        mid.appendChild(el('i', '', item.desc));
        row.appendChild(mid);
        row.appendChild(el('span', 'buy-price', item.price === 0 ? 'FREE' : `$${item.price}`));
        row.addEventListener('click', () => onBuy(item));
        buyList.appendChild(row);
      }
      buyMenu.hidden = false;
    },
    hideBuyMenu() { buyMenu.hidden = true; },
    setBomb(text, urgent) {
      if (!text) { bombStatus.hidden = true; return; }
      bombStatus.hidden = false;
      bombText.textContent = text;
      bombText.classList.toggle('urgent', !!urgent);
    },
  };
}
