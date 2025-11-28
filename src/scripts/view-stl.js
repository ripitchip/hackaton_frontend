// Lightweight STL/GLB viewer script for /view-stl
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

(function(){
  const container = document.getElementById('stl-viewer');
  if (!container) return;

  const src = container.dataset.src || '/assets/model.stl';

  // renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  container.appendChild(renderer.domElement);

  // scene + camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eefb);
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 200);

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(1, 2, 3);
  scene.add(dir);

  // controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  let current = null;

  // logging helper: console + on-page
  const logEl = document.getElementById('viewer-log');
  function log(msg, level = 'info'){
    const ts = new Date().toISOString();
    const out = `[${ts}] ${msg}`;
    if (level === 'error') console.error(out); else console.log(out);
    if (logEl){
      logEl.textContent += out + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function disposeObject(obj){
    if (!obj) return;
    obj.traverse((c)=>{
      if (c.geometry) { c.geometry.dispose && c.geometry.dispose(); }
      if (c.material) { if (Array.isArray(c.material)) c.material.forEach(m=>m.dispose && m.dispose()); else c.material.dispose && c.material.dispose(); }
    });
  }

  function fitToView(object){
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI/180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.4; // factor so the model fits nicely
    camera.position.set(0, Math.max(size.y, 1) * 0.5, cameraZ);
    camera.lookAt(box.getCenter(new THREE.Vector3()));
    camera.updateProjectionMatrix();
  }

  function clearCurrent(){
    if (!current) return;
    scene.remove(current);
    disposeObject(current);
    current = null;
    log('Cleared current model from scene');
  }

  // load from url
  function loadUrl(url){
    log(`Loading model from URL: ${url}`);
    const lower = url.split('?')[0].toLowerCase();
    if (lower.endsWith('.stl')){
      const loader = new STLLoader();
      loader.load(url, (geometry)=>{
        geometry.computeVertexNormals && geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: 0x9aa8ff, metalness:0.05, roughness:0.7 });
        const mesh = new THREE.Mesh(geometry, material);
        clearCurrent();
        current = mesh;
        scene.add(mesh);
        fitToView(mesh);
        logModelStats(mesh);
        log(`STL loaded from URL: ${url}`);
      }, undefined, (err)=>{ console.error('STL load error', err); showDropHint(true); });
    } else {
      const loader = new GLTFLoader();
      loader.load(url, (gltf)=>{
        clearCurrent();
        current = gltf.scene || gltf.scenes[0];
        scene.add(current);
        fitToView(current);
        logModelStats(current);
        log(`GLTF/GLB loaded from URL: ${url}`);
      }, undefined, (err)=>{ console.error('GLTF load error', err); showDropHint(true); });
    }
  }

  // load from ArrayBuffer (drag/drop)
  function loadArrayBuffer(buffer, filename){
    log(`Loading model from dropped/selected file: ${filename} (${buffer.byteLength} bytes)`);
    const lower = (filename||'').toLowerCase();
    if (lower.endsWith('.stl')){
      const loader = new STLLoader();
      const geometry = loader.parse(buffer);
      geometry.computeVertexNormals && geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: 0x9aa8ff, metalness:0.05, roughness:0.7 });
      const mesh = new THREE.Mesh(geometry, material);
      clearCurrent(); current = mesh; scene.add(mesh); fitToView(mesh);
      logModelStats(mesh);
      log(`STL parsed from file: ${filename}`);
    } else if (lower.endsWith('.glb') || lower.endsWith('.gltf')){
      const loader = new GLTFLoader();
      loader.parse(buffer, '', (gltf)=>{ clearCurrent(); current = gltf.scene || gltf.scenes[0]; scene.add(current); fitToView(current); }, (err)=>{ console.error('GLTF parse error', err); showDropHint(true); });
      logModelStats(current);
      log(`GLTF/GLB parsed from file: ${filename}`);
    } else {
      showDropHint(true);
    }
  }

  function logModelStats(object){
    if (!object) return log('No model to report stats for', 'error');
    let meshCount = 0, triangleCount = 0, vertexCount = 0, materialCount = 0;
    object.traverse((c)=>{
      if (c.isMesh){
        meshCount += 1;
        const geom = c.geometry;
        if (geom){
          const pos = geom.attributes && (geom.attributes.position || geom.attributes.position);
          if (pos) vertexCount += pos.count;
          const idx = geom.index;
          if (idx) triangleCount += idx.count / 3; else if (pos) triangleCount += pos.count / 3;
        }
        if (c.material){
          if (Array.isArray(c.material)) materialCount += c.material.length; else materialCount += 1;
        }
      }
    });
    const bbox = new THREE.Box3().setFromObject(object);
    const size = bbox.getSize(new THREE.Vector3());
    log(`Model stats — meshes: ${meshCount}, vertices: ${vertexCount}, triangles(approx): ${Math.round(triangleCount)}, materials: ${materialCount}, bbox: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`);
  }

  function showDropHint(show){
    const hint = container.querySelector('.drop-hint');
    if (!hint) return;
    hint.style.display = show ? 'flex' : 'none';
  }

  // initial load
  loadUrl(src);

  // handle resize
  function onResize(){ renderer.setSize(container.clientWidth, container.clientHeight, false); camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', onResize);

  // drag & drop
  container.addEventListener('dragover', (e)=>{ e.preventDefault(); container.classList.add('dragging'); showDropHint(true); });
  container.addEventListener('dragleave', (e)=>{ e.preventDefault(); container.classList.remove('dragging'); showDropHint(false); });
  container.addEventListener('drop', (e)=>{
    e.preventDefault(); container.classList.remove('dragging'); showDropHint(false);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return; log(`File dropped: ${f.name} (${f.size} bytes)`); const reader = new FileReader(); reader.onload = (ev)=>{ loadArrayBuffer(ev.target.result, f.name); }; reader.readAsArrayBuffer(f);
  });

  // file input
  const fileInput = document.getElementById('stl-file');
  if (fileInput) fileInput.addEventListener('change', (e)=>{ const f = e.target.files && e.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = (ev)=>{ loadArrayBuffer(ev.target.result, f.name); }; reader.readAsArrayBuffer(f); });

  // reset button
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', ()=>{ clearCurrent(); loadUrl(src); });

  // log initial info
  log('Viewer initialized');
  log(`Attempting initial load from: ${src}`);

  // animate
  function animate(){
    requestAnimationFrame(animate);
    // no auto-rotation: keep model still unless user rotates with controls
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
})();
