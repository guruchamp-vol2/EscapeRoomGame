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

    if (progress > 0.5 && player && typeof player.addShake === 'function') {
      const shakeIntensity = (progress - 0.5) * 2;
      player.addShake(shakeIntensity * 0.02, dt);
    }

    if (this.activeThreat.onTick) {
      this.activeThreat.onTick(progress, this.b, player);
    }

    if (progress >= 1) {
      if (this.activeThreat.onComplete) this.activeThreat.onComplete(this.b, player);
      this.activeThreat = null;
    }
  }

  cancel() {
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
