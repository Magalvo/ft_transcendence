export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private audioInitialized = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private nextBeepTime = 0;
  

  public init(): void {
    if (this.audioInitialized) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    this.audioInitialized = true;

    // Create the continuous engine drone
    this.engineOsc = this.audioCtx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 40;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;

    this.engineGain = this.audioCtx.createGain();
    this.engineGain.gain.value = 0.0;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.audioCtx.destination);
    this.engineOsc.start();
  }

  public resume(): void {
    if (!this.audioInitialized || !this.audioCtx) return;
    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }
  }

  public pause(): void {
    if (!this.audioInitialized || !this.audioCtx) return;
    if (this.audioCtx.state === "running") {
      void this.audioCtx.suspend();
    }
  }

  public playLaserSound(): void {
    if (!this.audioInitialized || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playMissileLaunchSound(): void {
    if (!this.audioInitialized || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.6);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  public playExplosionSound(): void {
    if (!this.audioInitialized || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    // 1. Deep BOOM
    const osc = this.audioCtx.createOscillator();
    const oscGain = this.audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);

    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(oscGain);
    oscGain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // 2. Crackle/Hiss
    const bufferSize = this.audioCtx.sampleRate * 1.0;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 800;

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.audioCtx.destination);
    noise.start(now);
  }

  public updateEngineSound(speed: number, isDead: boolean): void {
    if (!this.audioInitialized || !this.audioCtx || !this.engineOsc || !this.engineGain) return;
    const now = this.audioCtx.currentTime;

    if (isDead) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.1);
      return;
    }

    const normalizedSpeed = (speed - 50) / 100; // Adjusted for your internal speed scale
    this.engineOsc.frequency.setTargetAtTime(40 + normalizedSpeed * 40, now, 0.1);
    this.engineGain.gain.setTargetAtTime(0.1 + normalizedSpeed * 0.15, now, 0.1);
  }

  public manageLockOnSound(isLockedOn: boolean, lockProgress: number): void {
    if (!this.audioInitialized || !this.audioCtx || !isLockedOn) return;
    const now = this.audioCtx.currentTime;

    if (now < this.nextBeepTime) return;

    const beepRate = lockProgress >= 1.0 ? 0.1 : 0.4 - lockProgress * 0.25;
    this.nextBeepTime = now + beepRate;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.value = lockProgress >= 1.0 ? 1200 : 800;

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.05);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public stop(): void {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch {
        // Ignore repeated stop calls during teardown.
      }
    }
    this.engineOsc = null;
    this.engineGain = null;
    this.nextBeepTime = 0;
    if (this.audioCtx && this.audioCtx.state === "running") {
      void this.audioCtx.suspend();
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      void this.audioCtx.close();
    }
    this.audioCtx = null;
    this.audioInitialized = false;
  }
}
