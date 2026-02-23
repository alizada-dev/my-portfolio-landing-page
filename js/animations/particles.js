import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

const canvas = document.getElementById("space-bg");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// IMPORTANT: alpha true so body background shows through
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0); // transparent

// helper to read CSS variable color
function cssVarToHexInt(varName) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    // v like "#2563eb"
    return parseInt(v.replace("#", ""), 16);
}

// clean circle texture (no glow)
function createStarTexture(color) {
    const size = 32;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    return new THREE.CanvasTexture(c);
}

let starTexture = createStarTexture(getComputedStyle(document.documentElement).getPropertyValue("--star").trim());
const material = new THREE.PointsMaterial({
    size: 2,
    map: starTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
});

const starCount = 15000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 2000;
    positions[i3 + 1] = (Math.random() - 0.5) * 2000;
    positions[i3 + 2] = Math.random() * -2000;
}

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const stars = new THREE.Points(geometry, material);
scene.add(stars);

camera.position.z = 5;

const speed = 1;

function animate() {
    requestAnimationFrame(animate);

    const arr = geometry.attributes.position.array;
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        arr[i3 + 2] += speed;

        if (arr[i3 + 2] > 5) {
            arr[i3 + 2] = -2000;
            arr[i3] = (Math.random() - 0.5) * 2000;
            arr[i3 + 1] = (Math.random() - 0.5) * 2000;
        }
    }
    geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Expose a function for theme updates
window.updateStarTheme = () => {
    const starColor = getComputedStyle(document.documentElement).getPropertyValue("--star").trim();

    // update texture + material color
    const newTexture = createStarTexture(starColor);
    material.map.dispose();
    material.map = newTexture;
    material.needsUpdate = true;
};