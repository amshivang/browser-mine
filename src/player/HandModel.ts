import * as THREE from 'three';
import { ITEMS } from '../inventory/items.ts';

export class HandModel {
  readonly group = new THREE.Group();
  private readonly held = new THREE.Group();
  private selected = '';
  private swing = 0;
  private readonly skin = new THREE.MeshLambertMaterial({ color: 0xc69571, depthTest: false });
  private readonly sleeve = new THREE.MeshLambertMaterial({ color: 0x3f675b, depthTest: false });

  constructor(camera: THREE.Camera) {
    this.group.position.set(.37, -.35, -.62);
    this.group.scale.setScalar(.55);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.16, .18, .35), this.sleeve); arm.position.set(0, -.12, .15);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(.17, .16, .17), this.skin); this.group.add(arm, fist, this.held); camera.add(this.group);
    this.group.traverse((object) => object.renderOrder = 10);
  }
  attack(): void { this.swing = 1; }
  update(dt: number, itemId?: string, mining = false): void {
    if ((itemId ?? '') !== this.selected) { this.selected = itemId ?? ''; this.rebuild(); }
    this.swing = Math.max(0, this.swing - dt * 3.8);
    const angle = Math.sin(this.swing * Math.PI);
    this.group.rotation.set(-angle * .8, angle * .25, -angle * .6);
    this.group.position.y = -.35 - angle * .12;
    if (mining) this.group.rotation.x += Math.sin(performance.now() / 85) * .12;
  }
  private rebuild(): void {
    this.held.children.forEach((child) => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); } }); this.held.clear();
    const item = ITEMS[this.selected]; if (!item) return;
    const material = new THREE.MeshLambertMaterial({ color: item.color, depthTest: false });
    const add = (w: number, h: number, d: number, x: number, y: number) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, -.05); mesh.renderOrder = 11; this.held.add(mesh); };
    if (item.tool) {
      add(.045, .42, .05, 0, .16);
      if (item.tool.kind === 'sword') { add(.07, .48, .03, 0, .44); add(.2, .035, .06, 0, .2); }
      else if (item.tool.kind === 'pickaxe') { add(.36, .07, .065, 0, .38); add(.055, .1, .06, -.15, .32); add(.055, .1, .06, .15, .32); }
      else add(item.tool.kind === 'axe' ? .18 : .14, .16, .045, -.04, .34);
    } else add(.2, .2, .2, 0, .16);
  }
  dispose(): void { this.group.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } }); this.group.removeFromParent(); }
}
