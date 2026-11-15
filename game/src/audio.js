// Sound, synthesized live with WebAudio: no audio files, no network. Gunshots
// are filtered noise bursts, beeps are short sine blips, the explosion is noise
// through a lowpass with a falling sine underneath. The context starts on the
// first user gesture; everything is a no-op until then.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 0.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      return false;
    }
    return true;
  }

  function noise(dur, filterFreq, gain, type = 'lowpass', when = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function tone(freq, dur, gain, type = 'sine', slideTo = 0, when = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shot(near) {
      if (near) { noise(0.12, 1800, 0.5); tone(160, 0.09, 0.35, 'sine', 55); }
      else noise(0.18, 900, 0.16);
    },
    enemyShot(dist) {
      const g = Math.max(0.03, 0.2 - dist * 0.004);
      noise(0.14, 700, g);
    },
    reload() {
      tone(900, 0.05, 0.12, 'square');
      tone(600, 0.05, 0.12, 'square', 0, 0.18);
      tone(1100, 0.06, 0.14, 'square', 0, 0.55);
    },
    dryClick() { tone(1400, 0.03, 0.1, 'square'); },
    hit() { tone(1900, 0.06, 0.16, 'sine'); },
    headshot() { tone(2400, 0.09, 0.2, 'sine'); tone(3200, 0.08, 0.14, 'sine', 0, 0.05); },
    kill() { tone(520, 0.12, 0.2, 'triangle', 780); },
    plantBeep(urgent) { tone(urgent ? 1500 : 1100, 0.07, 0.16, 'square'); },
    explosion() {
      noise(0.9, 420, 0.8);
      tone(90, 0.8, 0.6, 'sine', 32);
      noise(0.4, 2400, 0.3, 'highpass');
    },
    grenadeThrow() { noise(0.08, 1200, 0.1); },
    roundWin() {
      tone(523, 0.14, 0.2, 'triangle');
      tone(659, 0.14, 0.2, 'triangle', 0, 0.13);
      tone(784, 0.22, 0.22, 'triangle', 0, 0.26);
    },
    roundLose() {
      tone(392, 0.16, 0.2, 'triangle');
      tone(330, 0.16, 0.2, 'triangle', 0, 0.15);
      tone(262, 0.3, 0.22, 'triangle', 0, 0.3);
    },
    buy() { tone(880, 0.06, 0.14, 'sine'); tone(1320, 0.08, 0.12, 'sine', 0, 0.05); },
    deny() { tone(220, 0.12, 0.16, 'square'); },
    step() { noise(0.05, 500, 0.05); },
    hurt() { tone(140, 0.14, 0.25, 'sawtooth', 70); },
  };
}
