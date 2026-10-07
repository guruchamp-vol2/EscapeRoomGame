// Tension system: manages environmental threats, timers, and escalating audio/visual cues.

export class TensionManager {
  constructor(b, ctx, levelState) {
    this.b = b;
    this.ctx = ctx;
    this.levelState = levelState;
    this.activeThreat = null;
    this.threatTimer = 0;
    this.threatIntensity = 0;
  }

  startThreat(threat) {
    this.activeThreat = threat;
    this.threatTimer = 0;
    this.threatIntensity = 0;
  }

  update(dt, player) {
    if (!this.activeThreat) return;

    this.threatTimer += dt;
    const progress = Math.min(1, this.threatTimer / this.activeThreat.duration);
    this.threatIntensity = progress;

    const audioThresholds = [0.3, 0.6, 0.85];
    for (let i = 0; i < audioThresholds.length; i++) {
      if (progress >= audioThresholds[i] && progress < audioThresholds[i] + dt * 2) {
        this.b.ctx?.sfx?.play?.(`warning_tone_${i}`);
      }
    }

    // The last stretch rumbles (through the game's screen shake).
    if (progress > 0.75) this.ctx?.shake?.((progress - 0.75) * dt * 0.8);

    if (this.activeThreat.onTick) {
      this.activeThreat.onTick(progress, this.b, player);
    }

    if (progress >= 1) {
      if (this.activeThreat.onComplete) this.activeThreat.onComplete(this.b, player);
      this.activeThreat = null;
    }
  }

  get remaining() {
    return this.activeThreat ? Math.max(0, this.activeThreat.duration - this.threatTimer) : null;
  }

  cancel() {
    if (!this.activeThreat) return;
    this.activeThreat = null;
    this.threatTimer = 0;
    this.threatIntensity = 0;
    this.b.ctx?.sfx?.play?.('threat_averted');
  }

  getUrgencyAlpha() {
    if (!this.activeThreat) return 0;
    return Math.pow(this.threatIntensity, 2) * 0.4;
  }
}
