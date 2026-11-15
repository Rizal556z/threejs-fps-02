// The match: rounds, money, the buy menu and the score. Pure state and rules —
// no DOM, no three.js. main.js drives it and the HUD shows it.
//
// Flow: buy (12 s, frozen in spawn, shop open) -> live (100 s clock) -> end
// (banner, 4 s) -> next buy ... first to 5 rounds wins the match (max 9).
// Attackers win a round by elimination or by detonation; defenders by
// elimination, defusal or the clock.
import { WEAPONS, GRENADE_PRICE } from './weapons.js';

export const BUY_TIME = 12;
export const ROUND_TIME = 100;
export const END_TIME = 4;
export const WIN_ROUNDS = 5;
export const MAX_ROUNDS = 9;

export const REWARDS = {
  kill: 300,
  roundWin: 325,
  roundLoss: 1400,
  plant: 300,
  detonate: 300,
};

export function createMatch() {
  const state = {
    phase: 'buy', // buy | live | end | match
    round: 1,
    score: { vanguard: 0, sentinel: 0 },
    timer: BUY_TIME,
    money: 800,
    kills: 0,
    deaths: 0,
    plants: 0,
    winner: null,
    reason: '',
    matchWinner: null,
    buyOpen: true,
  };

  function startRound() {
    state.phase = 'buy';
    state.timer = BUY_TIME;
    state.buyOpen = true;
    state.winner = null;
    state.reason = '';
  }

  function startLive() {
    state.phase = 'live';
    state.timer = ROUND_TIME;
    state.buyOpen = false;
  }

  function endRound(winner, reason) {
    if (state.phase === 'end' || state.phase === 'match') return false;
    state.phase = 'end';
    state.timer = END_TIME;
    state.winner = winner;
    state.reason = reason;
    state.score[winner] += 1;
    state.money += winner === 'vanguard' ? REWARDS.roundWin : REWARDS.roundLoss;
    if (state.score[winner] >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
      state.phase = 'match';
      state.matchWinner = state.score.vanguard > state.score.sentinel ? 'vanguard' : 'sentinel';
    }
    return true;
  }

  function nextRound() {
    state.round += 1;
    startRound();
  }

  function tick(dt) {
    if (state.phase === 'buy' || state.phase === 'live' || state.phase === 'end') {
      state.timer -= dt;
      if (state.timer <= 0) {
        if (state.phase === 'buy') startLive();
        else if (state.phase === 'live') return 'timeout';
        else if (state.phase === 'end') return 'next';
      }
    }
    return null;
  }

  function buyList() {
    return WEAPONS.map((w, i) => ({
      index: i,
      id: w.id,
      name: w.name,
      price: w.price,
      desc: `${w.damage} dmg · ${w.mag} rounds`,
    })).concat([{ index: 99, id: 'frag', name: 'Frag Grenade', price: GRENADE_PRICE, desc: 'Blast damage, 6.5 m radius' }]);
  }

  return {
    state,
    startRound,
    startLive,
    endRound,
    nextRound,
    tick,
    buyList,
    addMoney(n) { state.money += n; },
    addKill() { state.kills += 1; state.money += REWARDS.kill; },
    addDeath() { state.deaths += 1; },
    addPlant() { state.plants += 1; state.money += REWARDS.plant; },
    reset() {
      state.phase = 'buy';
      state.round = 1;
      state.score = { vanguard: 0, sentinel: 0 };
      state.timer = BUY_TIME;
      state.money = 800;
      state.kills = 0;
      state.deaths = 0;
      state.plants = 0;
      state.winner = null;
      state.reason = '';
      state.matchWinner = null;
      state.buyOpen = true;
    },
  };
}
