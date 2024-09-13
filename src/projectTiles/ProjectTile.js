import * as THREE from "three";
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { debugGui } from "../debugGui";
import projectTileFrag from "../shaders/projectTileFrag.glsl";
import projectTileVert from "../shaders/projectTileVert.glsl";
import { animateAsync, randomSign, waitAsync } from "../utils/animationUtils";
import { elementToWorldRect } from "../utils/utils";

const ASPECT = 16 / 9;
const DEFAULT_BG_COLOUR = "#eee";
const DEFAULT_CAM_POS = new THREE.Vector3(0, 0, 4);
const CAMERA_LOOKAT = new THREE.Vector3(0, 0, 0);
const CAMERA_MOVEMENT_COEF = 0.6;
const RENDER_TEXTURE_WIDTH = 2048;
const RENDER_TEXTURE_HEIGHT = RENDER_TEXTURE_WIDTH / ASPECT;

export default class ProjectTile extends THREE.Group {
    tileElementId;
    homeScene;
    renderTarget = new THREE.WebGLRenderTarget(RENDER_TEXTURE_WIDTH, RENDER_TEXTURE_HEIGHT, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
    });
    portalCamera = new THREE.PerspectiveCamera(45, ASPECT);
    portalScene = new THREE.Scene();
    forceRenderOnce = true;
    taperAmount = { value: 0.5 };

    get renderTexture() {
        return this.renderTarget.texture;
    }

    constructor(elementId, homeScene) {
        super();

        this.elementId = elementId;
        this.homeScene = homeScene;

        this.initPortalScene();
        this.initTileMesh();

        document.getElementById(elementId).addEventListener("mousemove", this.onMouseMove);
        document.getElementById(elementId).addEventListener("mouseleave", this.onMouseLeave);
        document.getElementById(elementId).addEventListener("click", this.onClick);

        this.initDebug();
    }

    initPortalScene = async (backgroundColor, cameraPosition) => {
        this.portalScene.background = new THREE.Color(DEFAULT_BG_COLOUR);

        this.targetCameraPosition = DEFAULT_CAM_POS.clone();

        this.portalCamera.position.copy(DEFAULT_CAM_POS);
        this.portalCamera.lookAt(CAMERA_LOOKAT);

        const texture = await new RGBELoader().setPath('../assets/hdri/').loadAsync('studio_small_08_1k.hdr');
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.portalScene.environment = texture;
        this.portalScene.environmentIntensity = 0.8;
    }

    initTileMesh() {
        const tileWorldRect = elementToWorldRect(this.elementId, this.homeScene.camera);

        this.tileMeshMat = new THREE.ShaderMaterial({
            uniforms: {
                taperAmount: this.taperAmount,
                aspect: { value: tileWorldRect.width / tileWorldRect.height },
                map: { value: this.renderTexture },
            },
            vertexShader: projectTileVert,
            fragmentShader: projectTileFrag,
            transparent: true,
        });

        this.tileMeshMat.map = this.renderTexture;
        this.tileMesh = new THREE.Mesh(new THREE.PlaneGeometry(tileWorldRect.width, tileWorldRect.height, 16), this.tileMeshMat);
        this.tileMesh.position.copy(tileWorldRect.position);

        this.add(this.tileMesh);
    }

    addToPortalScene = (object) => {
        this.portalScene.add(object);
    }

    onMouseMove = (e) => {
        const rect = e.target.getBoundingClientRect();
        const xAbs = e.clientX - rect.left; //x position within the element.
        const yAbs = e.clientY - rect.top;  //y position within the element.

        let x = xAbs / rect.width;
        let y = yAbs / rect.height;

        x = (x - 0.5) * 2 * CAMERA_MOVEMENT_COEF;
        y = (y - 0.5) * 2 * CAMERA_MOVEMENT_COEF;

        this.targetCameraPosition.x = DEFAULT_CAM_POS.x + x;
        this.targetCameraPosition.y = DEFAULT_CAM_POS.y - y;
        this.targetCameraPosition.z = DEFAULT_CAM_POS.z;
    }

    onMouseLeave = (e) => {
        this.targetCameraPosition.copy(DEFAULT_CAM_POS);
    }

    onClick = async () => {
        function addCssClass(isForward) {
            const homeContent = document.getElementById("home-content");
            if (isForward) {
                homeContent.classList.add("fade-out");
            }
            else {
                homeContent.classList.remove("fade-out");
            }
        }

        const zoomSequence = async (portalCamTargetZoom, pageCamTargetFrustum, pageCamTargetPosition, pageCamTargetRotationZ, isForward) => {
            const portalCamStartZoom = this.portalCamera.zoom;
            const pageCamStartFrustum = this.homeScene.frustumSize;
            const pageCamStartPosition = this.homeScene.camera.position.clone();
            const pageCamStartRotationZ = this.homeScene.camera.rotation.z;

            await animateAsync(500, (percent) => {
                const portalCamZoom = THREE.MathUtils.lerp(portalCamStartZoom, portalCamTargetZoom, percent);
                const pageCamFrustum = THREE.MathUtils.lerp(pageCamStartFrustum, pageCamTargetFrustum, percent);
                const pageCamRotationZ = THREE.MathUtils.lerp(pageCamStartRotationZ, pageCamTargetRotationZ, percent);

                this.homeScene.setCameraFrustumSize(pageCamFrustum);
                this.homeScene.camera.position.lerpVectors(pageCamStartPosition, pageCamTargetPosition, percent);
                this.homeScene.camera.rotation.z = pageCamRotationZ;

                this.portalCamera.zoom = portalCamZoom;
                this.portalCamera.updateProjectionMatrix();

                this.portalScene.children.forEach(child => {
                    if (child.type === "Mesh") {
                        child.material.opacity = isForward ? 1 - percent : percent;
                    }
                })
            });
        }

        const portalCamStartZoom = this.portalCamera.zoom;
        const pageCamStartFrustumSize = this.homeScene.frustumSize;
        const pageCamStartPosition = this.homeScene.camera.position.clone();
        const pageCamStartRotationZ = this.homeScene.camera.rotation.z;

        const onBack = async (e) => {
            e.preventDefault();
            document.getElementById("project-tile-1").classList.remove("show");
            await waitAsync(1000);
            await zoomSequence(portalCamStartZoom, pageCamStartFrustumSize, pageCamStartPosition, pageCamStartRotationZ, false);
            addCssClass(false);
            document.body.style.overflow = 'auto';
            document.getElementById("home-content").style.visibility = "visible"

            for (let button of buttons) {
                button.removeEventListener("click", onBack);
            }
        }

        document.body.style.overflow = 'hidden';
        addCssClass(true);
        await waitAsync(1000);
        await zoomSequence(3, this.calculatePageCamTargetFrustum(), this.tileMesh.position.clone(), randomSign() * 0.1, true);
        await waitAsync(500);
        document.getElementById("home-content").style.visibility = "hidden"
        document.getElementById("project-tile-1").classList.add("show");

        const buttons = document.getElementsByClassName("project-tile-back-button");
        for (let button of buttons) {
            console.log("btn", button)
            button.addEventListener("click", onBack)
        }
    }

    calculatePageCamTargetFrustum = () => {
        const height = document.getElementById(this.elementId).getBoundingClientRect().height;
        const ratio = height / window.innerHeight;
        const fudge = 0.4;
        return (this.homeScene.frustumSize * ratio) - fudge;
    }

    initDebug = () => {
        const folder = debugGui.addFolder("Project Tile");
        folder.add(this.taperAmount, "value", -1, 1).name("Taper amount");
    }

    update(dt, renderer) {
        this.portalCamera.position.lerp(this.targetCameraPosition, dt * 10);
        // this.portalCamera.lookAt(CAMERA_LOOKAT);

        // if (!this.forceRenderOnce) {
        //     const vec = new THREE.Vector3();
        //     vec.subVectors(this.targetCameraPosition, this.portalCamera.position);

        //     if (vec.lengthSq() < 0.00001) {
        //         return;
        //     }
        // }
        renderer.setRenderTarget(this.renderTarget);
        renderer.render(this.portalScene, this.portalCamera);
        renderer.setRenderTarget(null);

        // this.forceRenderOnce = false;
    }

    cleanup() {
        this.renderTarget.dispose();
        this.tileMeshMat.dispose();

        document.getElementById(this.elementId).removeEventListener("mousemove", this.onMouseMove);
        document.getElementById(this.elementId).removeEventListener("mouseleave", this.onMouseLeave);
    }
}