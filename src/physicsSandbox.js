import RAPIER, { Ray } from "@dimforge/rapier3d";
import * as THREE from "three";

const OBJECT_COUNT = 30;
const DAMPING = 0.6
const ATTRACTION_FORCE = 3.5;
const MOUSE_FORCE_COEF = 10;
const MOUSE_LIGHT_INTENSITY = 40;
const STENCIL_REF = 1;

export default class PhysicsSandbox extends THREE.Group {
    positionReuse;

    /** @type RAPIER.World */
    world = null;
    /** @type Map<THREE.Mesh, RAPIER.RigidBody */
    meshBodyLookup = new Map();
    /** @type {{ mesh: THREE.Mesh, rigidbody: RAPIER.RigidBody }} */
    mouseBall;
    camera;
    physicsMaskMesh;
    attractionPos = new THREE.Vector3(0, 0, 0);
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    lastMousePos = new THREE.Vector3();

    constructor(camera) {
        super();

        this.camera = camera;

        this.initViewMask();
        this.initObjects();

        window.addEventListener('mousemove', this.onMouseMove, false);
        window.addEventListener('resize', this.onWindowResized);
    }

    initViewMask = () => {
        const stencilMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.02, 0.02, 0.02),
            depthWrite: false,
            stencilWrite: true,
            stencilRef: STENCIL_REF,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp
        });

        const width = Math.abs(this.camera.left * 1.8);
        const height = Math.abs(this.camera.top);
        const x = width / 2;
        const y = height / 2;

        const shape = new THREE.Shape();
        const radius = 0.1;
        shape.moveTo(-x + radius, y);
        shape.lineTo(x - radius, y);
        shape.quadraticCurveTo(x, y, x, y - radius);
        shape.lineTo(x, -y + radius);
        shape.quadraticCurveTo(x, -y, x - radius, -y);
        shape.lineTo(-x + radius, -y);
        shape.quadraticCurveTo(-x, -y, -x, -y + radius);
        shape.lineTo(-x, y - radius);
        shape.quadraticCurveTo(-x, y, -x + radius, y);

        const geometry = new THREE.ShapeGeometry(shape);
        this.physicsMaskMesh = new THREE.Mesh(geometry, stencilMat);
        this.add(this.physicsMaskMesh);
    }

    initObjects() {
        for (let i = 0; i < OBJECT_COUNT; i++) {
            const ball = this.createBall(0.6, this.getRandomPosition(5));
            this.add(ball.mesh);
            this.addToWorld(ball.mesh, ball.rigidbody);
        }

        this.mouseBall = this.createBall(0.6, { x: 0, y: 0, z: 0 }, true);
        this.mouseBall.mesh.add(new THREE.PointLight(new THREE.Color(1, 1, 1), MOUSE_LIGHT_INTENSITY));
        this.add(this.mouseBall.mesh);
    }

    createBall(ballRadius, ballPosition, isKinematic = false, ballRestitution = 0.3) {
        const { x, y, z } = ballPosition;

        const rigidbodyDesc = isKinematic
            ? RAPIER.RigidBodyDesc.kinematicPositionBased()
            : RAPIER.RigidBodyDesc.dynamic();
        rigidbodyDesc.setTranslation(x, y, z);
        rigidbodyDesc.setLinearDamping(DAMPING);

        const shape = RAPIER.ColliderDesc.ball(ballRadius);
        shape.setMass(ballRadius);
        shape.setRestitution(ballRestitution);

        const rigidbody = this.world.createRigidBody(rigidbodyDesc);
        this.world.createCollider(shape, rigidbody);

        const material = new THREE.MeshStandardMaterial({
            color: 0xE91E63,
            metalness: 0,
            roughness: 0.22,
            stencilWrite: true,
            stencilRef: STENCIL_REF,
            stencilFunc: THREE.EqualStencilFunc,
        });

        const mesh = new THREE.Mesh(new THREE.SphereGeometry(ballRadius), material);
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.renderOrder = 2;
        return { rigidbody, mesh };
    }

    getRandomPosition(radius) {
        if (!this.positionReuse) {
            this.positionReuse = new THREE.Vector3();
        }

        return this.positionReuse.randomDirection().multiplyScalar(radius);
    }

    onMouseMove = (event) => {
        const normalisedX = (event.clientX / window.innerWidth) * 2 - 1;
        const normalisedY = -(event.clientY / window.innerHeight) * 2 + 1;

        const x = normalisedX * 10;
        const y = normalisedY * 10;
        const z = 0;

        this.mouseBall.rigidbody.setTranslation({ x, y, z });
        this.mouseBall.mesh.position.set(x, y, z);

        const mouseDelta = this.mouseBall.mesh.position.clone().sub(this.lastMousePos);

        this.lastMousePos.copy(this.mouseBall.mesh.position);

        const ray = new Ray(this.camera.position, this.lastMousePos.clone().sub(this.camera.position));
        const hit = this.world.castRay(ray, 50, true);

        if (hit) {
            this.meshBodyLookup.forEach((rigidbody, mesh) => {
                if (rigidbody === hit.collider.parent()) {
                    rigidbody.applyImpulseAtPoint(mouseDelta.multiplyScalar(MOUSE_FORCE_COEF), this.lastMousePos, true);
                }
            });
        }
    }

    addToWorld(mesh, rigidbody) {
        this.meshBodyLookup.set(mesh, rigidbody);
    }

    onWindowResized = () => {
        this.remove(this.physicsMaskMesh);
        this.initViewMask();
    }

    update(dt) {
        if (this.world) {
            this.world.step();
        }

        this.meshBodyLookup.forEach((rigidbody, mesh) => {
            const dirToCenter = this.attractionPos.clone().sub(mesh.position).setLength(ATTRACTION_FORCE);
            rigidbody.resetForces(true);
            rigidbody.addForce(dirToCenter);

            mesh.position.copy(rigidbody.translation());
            mesh.quaternion.copy(rigidbody.rotation());
        });
    }
}