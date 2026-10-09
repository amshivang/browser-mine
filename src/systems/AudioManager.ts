import type { Biome } from '../world/TerrainGenerator.ts';

export type Sound = 'break' | 'place' | 'pickup' | 'hurt' | 'jump' | 'attack' | 'ui' | 'water' | 'step' | 'enemy';

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private music?: GainNode;
  private wind?: GainNode;
  private windFilter?: BiquadFilterNode;
  private volumes = [ .55, .8, .25 ];
  private musicTimer = 0;
  private note = 0;

  resume(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain(); this.master.connect(this.context.destination);
        this.effects = this.context.createGain(); this.effects.connect(this.master);
        this.music = this.context.createGain(); this.music.connect(this.master);
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
        const data = buffer.getChannelData(0); let previous = 0;
        for (let i = 0; i < data.length; i += 1) { previous = (previous + (Math.random() * 2 - 1) * .08) / 1.02; data[i] = previous; }
        const noise = this.context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
        this.windFilter = this.context.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 600;
        this.wind = this.context.createGain(); this.wind.gain.value = .025;
        noise.connect(this.windFilter).connect(this.wind).connect(this.effects); noise.start();
        this.setVolumes(...this.volumes as [number, number, number]);
      }
      if (this.context.state === 'suspended') void this.context.resume();
    } catch { /* Audio is optional; gameplay continues without it. */ }
  }
  setVolumes(master: number, sound: number, music: number): void {
    this.volumes = [master, sound, music];
    if (this.master) this.master.gain.value = master;
    if (this.effects) this.effects.gain.value = sound;
    if (this.music) this.music.gain.value = music;
  }
  play(type: Sound): void {
    this.resume(); if (!this.context || !this.effects) return;
    const settings: Record<Sound, [number, number, OscillatorType, number]> = {
      break: [100, .08, 'square', .055], place: [180, .08, 'triangle', .12], pickup: [620, .18, 'sine', .1],
      hurt: [80, .2, 'sawtooth', .12], jump: [280, .12, 'sine', .05], attack: [150, .07, 'sawtooth', .04],
      ui: [420, .05, 'sine', .045], water: [210, .18, 'sine', .08], step: [55 + Math.random() * 20, .07, 'triangle', .085], enemy: [95, .2, 'triangle', .09],
    };
    const [frequency, duration, wave, volume] = settings[type]; this.tone(frequency, duration, wave, volume, this.effects, type === 'hurt' ? .55 : 1.25);
  }
  private tone(frequency: number, duration: number, wave: OscillatorType, volume: number, output: GainNode, end = 1): void {
    if (!this.context) return;
    const now = this.context.currentTime; const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = wave; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(frequency * end, now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume), now + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(output); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); }; oscillator.start(now); oscillator.stop(now + duration + .03);
  }
  update(dt: number, swimming: boolean, biome: Biome): void {
    if (!this.context || !this.music) return;
    if (this.windFilter) this.windFilter.frequency.value = swimming ? 180 : biome === 'dune' ? 900 : 450;
    if (this.wind) this.wind.gain.value = swimming ? .08 : biome === 'frost' ? .04 : .018;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 5 + (this.note % 3);
      const melody = [0, 7, 12, 4, 9, 7, 2, 4];
      this.tone(130.81 * 2 ** (melody[this.note++ % melody.length] / 12), 3.8, 'sine', .045, this.music);
    }
  }
}
