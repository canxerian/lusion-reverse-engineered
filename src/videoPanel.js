import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { debugGui } from "./debugGui";
import { pageToWorldCoords } from "./utils";

export class VideoPanel extends THREE.Group {
    mixer = null;
    action = null;
    animPlaybackPercent = 0;
    animClip;
    animDuration;
    animFrameCount;
    animFPS;

    constructor(camera) {
        super();

        this.initDebug();

        const loader = new GLTFLoader();
        const material = new THREE.MeshStandardMaterial({
            roughness: 0.7,
            metalness: 0.2,
        });
        loader.load('../assets/panel-anim-bones.glb', (gltf) => {
            const mesh = gltf.scene.children[0];
            mesh.material = material;

            this.add(gltf.scene);

            // Set up the animation mixer
            this.mixer = new THREE.AnimationMixer(gltf.scene);

            this.animClip = gltf.animations[0];
            this.action = this.mixer.clipAction(this.animClip);
            this.action.play();

            this.animDuration = this.animClip.duration;
            this.animFrameCount = this.animClip.tracks[0].times.length;
            this.animFPS = Math.floor(this.animFrameCount / this.animDuration);

            console.log("anim fps", this.animFPS)
        }, undefined, (error) => {
            console.error(error);
        });

        const halfPage = window.innerHeight * 0.5;
        const pageY = window.innerHeight * 2 + halfPage;
        this.position.copy(pageToWorldCoords(200, pageY, camera));
    }

    initDebug() {
        const folder = debugGui.addFolder("VideoPanel");
        folder.add(this, "animPlaybackPercent", 0, 1).onChange(v => this.playAnimation(v));
    }

    playAnimation(percent) {
        if (this.action) {
            const time = Math.min(percent * this.animDuration, this.animDuration);
            this.mixer.setTime(time);
        }
    }

    update(dt) {
        // this.mixer && this.mixer.update(dt);
    }
}