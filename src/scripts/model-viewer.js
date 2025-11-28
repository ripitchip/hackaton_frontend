import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

// Client-side three.js model viewer (GLB/STL loader)

const container = document.getElementById('model-viewer');
if (!container) {
  // Nothing to do on server or pages without the viewer
} else {
  (() => {
    const src = container.dataset.src || '/assets/model.stl';

    // build scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f6ff);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 3);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 10, 10);
    scene.add(dir);

  const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0);

    // load model using the selected loader (also support drag/drop)
    let modelRoot = null;
    function clearModel() {
      if (modelRoot) {
        scene.remove(modelRoot);
        modelRoot.traverse && modelRoot.traverse((c) => { if (c.geometry) c.geometry.dispose && c.geometry.dispose(); if (c.material) c.material.dispose && c.material.dispose(); });
        modelRoot = null;
      }
    }

    function loadUrl(url) {
      const lower = url.split('?')[0].toLowerCase();
      if (lower.endsWith('.stl')) {
        const loader = new STLLoader();
        loader.load(url, (geometry) => {
          geometry.computeVertexNormals && geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.1, roughness: 0.9 });
          clearModel();
          modelRoot = new THREE.Mesh(geometry, material);
          finalizeModel(modelRoot);
        }, undefined, () => { showError(); });
      } else {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => { clearModel(); modelRoot = gltf.scene || gltf.scenes[0]; finalizeModel(modelRoot); }, undefined, () => { showError(); });
      }
    }

    // file parsing (for drag/drop or file input)
    function loadArrayBuffer(buffer, filename) {
      const lower = (filename || '').toLowerCase();
      if (lower.endsWith('.stl')) {
        const loader = new STLLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals && geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.1, roughness: 0.9 });
        clearModel();
        modelRoot = new THREE.Mesh(geometry, material);
        finalizeModel(modelRoot);
      } else if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
        const loader = new GLTFLoader();
        loader.parse(buffer, '', (gltf) => { clearModel(); modelRoot = gltf.scene || gltf.scenes[0]; finalizeModel(modelRoot); }, () => { showError(); });
      } else {
        showError();
      }
    }

    function showError() { const errEl = document.getElementById('model-error'); if (errEl) errEl.hidden = false; }

    // initial load from src attribute
    loadUrl(src);

    // drag & drop support
    const dropHint = document.getElementById('drop-hint');
    container.addEventListener('dragover', (e) => { e.preventDefault(); dropHint && dropHint.classList.add('drag'); });
    container.addEventListener('dragleave', (e) => { e.preventDefault(); dropHint && dropHint.classList.remove('drag'); });
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      dropHint && dropHint.classList.remove('drag');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => { loadArrayBuffer(ev.target.result, f.name); };
      reader.readAsArrayBuffer(f);
    });

    // file input fallback
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = (e) => { loadArrayBuffer(e.target.result, f.name); };
        reader.readAsArrayBuffer(f);
      });
    }

    function finalizeModel(model) {
      // Normalize size and center
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 1.4 / maxDim;
        model.scale.setScalar(scale);
      }
      box.setFromObject(model);
      const center = box.getCenter(new THREE.Vector3()).multiplyScalar(-1);
      model.position.add(center);

      scene.add(model);

      // adjust camera to fit
      const dist = 2.2;
      camera.position.set(0, 1.2, dist);
      controls.update();
    }

    // resize handling
    function onWindowResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    window.addEventListener('resize', onWindowResize);

    // animate
    function animate() {
      requestAnimationFrame(animate);
      // no auto-rotation: model remains static unless user rotates via controls
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  })();
}
