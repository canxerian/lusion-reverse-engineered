import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { debugGui } from "./debugGui";
import { elementToLocalRectPoints } from "./utils";

const TINT_COLOUR_START = new THREE.Color("#5b1473");
const TINT_COLOUR_END = new THREE.Color("#ffffff");
const PANEL_START_ID = "video-panel-start";
const PANEL_END_ID = "video-panel-end";
const AUTOSCROLL_ENABLED = true;

export default class VideoPanelBones extends THREE.Group {
    animPlaybackPercent = 0;

    // The scroll positions used to calculate t, a percentage used to play the panel animation
    scrollYAnimStart = window.innerHeight * 1.1;
    scrollYAnimEnd = window.innerHeight * 1.4;

    localRectStart;
    localRectEnd;

    prevScrollY = 0;
    scrollDelta = 1;    // 1 down, -1 up

    material;

    panelScene;

    boneTL;
    boneTR;
    boneBL;
    boneBR;

    curveTL;
    curveTR;
    curveBL;
    curveBR;

    debugCurveGroup = new THREE.Group();
    debugCurvesEnabled = false;

    constructor(camera) {
        super();

        this.material = new THREE.MeshBasicMaterial({
            roughness: 0.1,
            metalness: 0,
            map: this.createVideoTexture(),
            side: THREE.FrontSide,
            color: TINT_COLOUR_START
        });

        new GLTFLoader().load('../assets/panel-anim-bones-02.glb', (gltf) => {
            this.panelScene = gltf.scene;

            const panelMesh = this.panelScene.children[0].children[0];
            panelMesh.material = this.material;

            this.panelScene.children[0].children.forEach(child => {
                if (child.type === "Bone") {
                    if (child.name === "BoneTR") {
                        this.boneTR = child;
                    }
                    else if (child.name === "BoneTL") {
                        this.boneTL = child;
                    }
                    else if (child.name === "BoneBR") {
                        this.boneBR = child;
                    }
                    else if (child.name === "BoneBL") {
                        this.boneBL = child;
                    }
                }
            });

            console.assert(this.boneBL);
            console.assert(this.boneBR);
            console.assert(this.boneTL);
            console.assert(this.boneTR);

            const parent = this.boneBL.parent;

            this.localRectStart = elementToLocalRectPoints(PANEL_START_ID, parent, camera);
            this.localRectEnd = elementToLocalRectPoints(PANEL_END_ID, parent, camera);

            this.curveTL = new THREE.CubicBezierCurve3(this.localRectStart.tl,
                this.localRectStart.tl.clone().add(new THREE.Vector3(1, 0, 0)),
                this.localRectEnd.tl.clone().add(new THREE.Vector3(-1, 0, 0)),
                this.localRectEnd.tl.clone()
            );

            this.curveTR = new THREE.CubicBezierCurve3(this.localRectStart.tr,
                this.localRectStart.tr.clone().add(new THREE.Vector3(10, -8, 0)),
                this.localRectEnd.tr.clone().add(new THREE.Vector3(0, 0, 0)),
                this.localRectEnd.tr.clone()
            );

            this.curveBL = new THREE.CubicBezierCurve3(this.localRectStart.bl,
                this.localRectStart.bl.clone().add(new THREE.Vector3(1, -8, 0)),
                this.localRectEnd.bl.clone().add(new THREE.Vector3(0, 0, 0)),
                this.localRectEnd.bl.clone()
            );

            this.curveBR = new THREE.CubicBezierCurve3(this.localRectStart.br,
                this.localRectStart.br.clone().add(new THREE.Vector3(1, -8, 0)),
                this.localRectEnd.br.clone().add(new THREE.Vector3(0, 0, 0)),
                this.localRectEnd.br.clone()
            );

            this.add(this.panelScene);

            this.onScroll();    // trigger scroll in case user refreshes mid scroll

            this.initDebug();
        }, undefined, (error) => {
            console.error(error);
        });

        window.addEventListener("scroll", this.onScroll);
    }

    initDebug() {
        const folder = debugGui.addFolder("VideoPanel");
        folder.add(this, "animPlaybackPercent", 0, 1).onChange(v => this.playAnimation(v));
        folder.add(this, "debugCurvesEnabled").onChange(v => {
            this.setDebugCurvedEnabled(v);
        });
    }

    playAnimation() {
        const tl = this.curveTL.getPointAt(this.animPlaybackPercent);
        this.boneTL.position.copy(tl);

        const tr = this.curveTR.getPointAt(this.animPlaybackPercent);
        this.boneTR.position.copy(tr);

        const bl = this.curveBL.getPointAt(this.animPlaybackPercent);
        this.boneBL.position.copy(bl);

        const br = this.curveBR.getPointAt(this.animPlaybackPercent);
        this.boneBR.position.copy(br);

        this.material.color.lerpColors(TINT_COLOUR_START, TINT_COLOUR_END, this.animPlaybackPercent);
    }

    createVideoTexture() {
        const video = document.createElement('video');
        video.src = 'assets/pexels-2519660-uhd_3840_2160_24fps.mp4';
        video.loop = true;
        video.muted = true;
        video.play();

        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;

        return texture;
    }

    setDebugCurvedEnabled = (enabled) => {
        const curves = [this.curveTR, this.curveTL, this.curveBL, this.curveBR];

        if (enabled) {

            if (this.debugCurveGroup.children.length === 0) {
                curves.forEach(curve => {
                    const points = curve.getPoints(50);
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
                    const curveObject = new THREE.Line(geometry, material);
                    this.debugCurveGroup.add(curveObject)
                });
            }

            this.add(this.debugCurveGroup);
        }
        else {
            this.remove(this.debugCurveGroup);
        }
    }

    onScroll = (e) => {
        this.animPlaybackPercent = THREE.MathUtils.clamp(THREE.MathUtils.inverseLerp(this.scrollYAnimStart, this.scrollYAnimEnd, window.scrollY), 0, 0.99);

        this.playAnimation()

        this.scrollDelta = (window.scrollY - this.prevScrollY);
        this.prevScrollY = window.scrollY;
    }

    update(dt) {
        if (!AUTOSCROLL_ENABLED) {
            return;
        }
        if (this.animPlaybackPercent > 0.3 && this.animPlaybackPercent < 0.99) {
            let target = window.scrollY;
            if (this.scrollDelta >= 1) {
                target = this.scrollYAnimEnd;
            }
            else if (this.scrollDelta <= 1) {
                target = this.scrollYAnimStart;
            }

            const scrollY = THREE.MathUtils.lerp(window.scrollY, target, dt * 3);
            window.scrollTo({ top: scrollY, behavior: "instant" })
        }
    }
}

const vertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Fragment Shader
const fragmentShader = `
    uniform float time;
    uniform vec2 resolution;
    void main()	{
        float x = mod(time + gl_FragCoord.x, 20.) < 10. ? 1. : 0.;
        float y = mod(time + gl_FragCoord.y, 20.) < 10. ? 1. : 0.;
        gl_FragColor = vec4(vec3(min(x, y)), 1.);
    }
`;
