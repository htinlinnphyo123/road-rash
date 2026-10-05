import * as CANNON from 'cannon-es';
import { GROUP } from '../core/constants.js';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -30, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;
    this.world.defaultContactMaterial.friction = 0;
    this.world.defaultContactMaterial.restitution = 0;

    this.groundMaterial = new CANNON.Material('ground');
    this.bikeMaterial = new CANNON.Material('bike');
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.groundMaterial, this.bikeMaterial, { friction: 0, restitution: 0 })
    );

    const ground = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.groundMaterial,
      collisionFilterGroup: GROUP.WORLD,
      collisionFilterMask: GROUP.BIKE,
    });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);
  }

  step(dt) { this.world.step(dt); }
}