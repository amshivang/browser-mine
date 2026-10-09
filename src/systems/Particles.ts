import * as THREE from 'three';

interface Particle { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number; }

export class ParticleSystem {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private readonly geometry = new THREE.BoxGeometry(.08, .08, .08);

  burst(position: THREE.Vector3, color: number, amount = 8): void {
    for (let i = 0; i < amount; i += 1) {
      const mesh = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(position); mesh.scale.setScalar(.6 + Math.random());
      const particle: Particle = { mesh, velocity: new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 4, (Math.random() - .5) * 3), life: .45 + Math.random() * .45, maxLife: .9 };
      this.particles.push(particle); this.group.add(mesh);
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i]; p.life -= dt; p.velocity.y -= 9 * dt; p.mesh.position.addScaledVector(p.velocity, dt); p.mesh.rotation.x += dt * 4;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) { this.group.remove(p.mesh); (p.mesh.material as THREE.Material).dispose(); this.particles.splice(i, 1); }
    }
  }
}
