import * as THREE from 'three';
import { World } from '../world/World.ts';
import { BLOCKS } from '../world/blocks.ts';

export class DayNightSystem {
  time = 160;
  readonly sun = new THREE.DirectionalLight(0xffe5b0, 2.1);
  readonly moon = new THREE.DirectionalLight(0x7596c4, .25);
  readonly ambient = new THREE.HemisphereLight(0x9fd3df, 0x26352e, .7);
  readonly sky = new THREE.Color(0x87b9c5);
  readonly fog = new THREE.Fog(this.sky, 35, 85);
  private readonly sunDisk = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), new THREE.MeshBasicMaterial({ color: 0xffe6ae, fog: false }));
  private readonly moonDisk = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 1), new THREE.MeshBasicMaterial({ color: 0xaad2de, fog: false }));
  private readonly stars: THREE.Points;
  private readonly skyDome: THREE.Mesh;
  private readonly torchLights: THREE.PointLight[] = [];
  private lightTimer = 0;
  private readonly scratchDir = new THREE.Vector3();
  private readonly scratchPos = new THREE.Vector3();
  private readonly dayColor = new THREE.Color(0x8dbbc6);
  private readonly duskColor = new THREE.Color(0xb48891);
  private readonly nightColor = new THREE.Color(0x101b30);
  private readonly fenColor = new THREE.Color(0x839d8f);
  private readonly topNightColor = new THREE.Color(0x071429);
  private readonly topDayColor = new THREE.Color(0x3e92be);
  cycleLength = 600;
  isNight = false;

  constructor(scene: THREE.Scene) {
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { near: 1, far: 150, left: -35, right: 35, top: 35, bottom: -35 });
    this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .045;
    scene.add(this.sun, this.sun.target, this.moon, this.moon.target, this.ambient, this.sunDisk, this.moonDisk);
    const vertices: number[] = [];
    for (let i = 0; i < 200; i += 1) { const theta = i * 2.39996; const yy = (i + .5) / 200; const rr = Math.sqrt(1 - yy * yy); vertices.push(Math.cos(theta) * rr * 130, yy * 130, Math.sin(theta) * rr * 130); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)), new THREE.PointsMaterial({ color: 0xd7efff, size: .32, transparent: true, fog: false }));
    scene.add(this.stars);
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(160, 16, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x518fae) }, horizon: { value: this.sky } },
      vertexShader: 'varying vec3 vDirection; void main(){vDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vDirection; void main(){float t=pow(max(0.0,vDirection.y),0.65); gl_FragColor=vec4(mix(horizon,top,t),1.0); #include <colorspace_fragment> }'.replace(' #include', '\n#include').replace(' }', '\n}'),
    })); this.skyDome.renderOrder = -10; scene.add(this.skyDome);
    for (let i = 0; i < 8; i += 1) { const light = new THREE.PointLight(0xffcd81, 0, 10, 1.3); this.torchLights.push(light); scene.add(light); }
    scene.background = this.sky; scene.fog = this.fog;
  }

  update(dt: number, target: THREE.Vector3, world?: World): void {
    this.time = (this.time + dt) % this.cycleLength;
    const phase = this.time / this.cycleLength * Math.PI * 2 - Math.PI / 2;
    const daylight = Math.max(0, Math.sin(phase)); this.isNight = daylight < .08;
    const direction = this.scratchDir.set(Math.cos(phase), Math.sin(phase), .35).normalize();
    this.sun.position.copy(target).addScaledVector(direction, 65); this.sun.target.position.copy(target);
    this.moon.position.copy(target).addScaledVector(direction, -65); this.moon.target.position.copy(target);
    this.sunDisk.position.copy(target).addScaledVector(direction, 120); this.moonDisk.position.copy(target).addScaledVector(direction, -120);
    this.sun.intensity = .06 + daylight * 2; this.moon.intensity = .08 + (1 - daylight) * .22; this.ambient.intensity = .14 + daylight * .68;
    if (daylight > .12) {
      this.sky.copy(this.duskColor).lerp(this.dayColor, Math.min(1, (daylight - .12) * 1.7));
    } else {
      this.sky.copy(this.nightColor).lerp(this.duskColor, daylight / .12);
    }
    if (world?.generator.biomeAt(target.x, target.z) === 'fen') this.sky.lerp(this.fenColor, .2);
    this.stars.position.copy(target); (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - daylight * 4);
    this.skyDome.position.copy(target); ((this.skyDome.material as THREE.ShaderMaterial).uniforms.top.value as THREE.Color).copy(this.topNightColor).lerp(this.topDayColor, daylight);
    const view = (world?.renderDistance ?? 3) * 16;
    this.fog.color.copy(this.sky); this.fog.near = view * .55; this.fog.far = view + 18;
    this.lightTimer -= dt;
    if (world && this.lightTimer <= 0) {
      this.lightTimer = .7;
      const sources: Array<{ x: number; y: number; z: number; distance: number; strength: number }> = [];
      for (const [key, id] of world.modifications) {
        const strength = BLOCKS[id].light;
        if (!strength) continue;
        const [x, y, z] = key.split(',').map(Number);
        this.scratchPos.set(x + .5, y + .8, z + .5);
        const dist = this.scratchPos.distanceToSquared(target);
        if (dist < 1600) sources.push({ x: x + .5, y: y + .8, z: z + .5, distance: dist, strength });
      }
      sources.sort((a, b) => a.distance - b.distance);
      this.torchLights.forEach((light, i) => {
        const source = sources[i];
        light.intensity = source ? 7 : 0;
        if (source) { light.position.set(source.x, source.y, source.z); light.distance = source.strength; }
      });
    }
  }
}
