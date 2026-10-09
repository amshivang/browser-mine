import * as THREE from 'three';
import { BIOMES } from '../world/BiomeGenerator.ts';
import type { World } from '../world/World.ts';

export class WeatherSystem {
  readonly points: THREE.Points;
  private readonly positions = new Float32Array(180 * 3);
  label = 'Clear';
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < this.positions.length; i += 3) { this.positions[i] = (Math.random() - .5) * 24; this.positions[i + 1] = Math.random() * 16; this.positions[i + 2] = (Math.random() - .5) * 24; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xc3e2f0, size: .08, transparent: true, opacity: .5, depthWrite: false })); this.points.frustumCulled = false; this.points.visible = false; scene.add(this.points);
  }
  update(dt: number, world: World, player: THREE.Vector3, time: number): void {
    const weather = BIOMES[world.generator.biomeAt(player.x, player.z)].weather;
    const active = weather !== 'clear' && Math.sin(time / 47) > -.2 && player.y > world.generator.heightAt(player.x, player.z) - 3;
    this.points.visible = active; this.label = active ? weather === 'snow' ? 'Snowfall' : 'Drizzle' : 'Clear';
    if (!active) return;
    this.points.position.copy(player);
    const material = this.points.material as THREE.PointsMaterial; material.size = weather === 'snow' ? .11 : .04;
    for (let i = 0; i < this.positions.length; i += 3) {
      this.positions[i + 1] -= dt * (weather === 'snow' ? 1.2 : 12);
      this.positions[i] += dt * (weather === 'snow' ? Math.sin(time + i) * .15 : .25);
      if (this.positions[i + 1] < -2) this.positions[i + 1] = 14;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
