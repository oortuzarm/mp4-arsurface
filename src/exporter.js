// Generates the AR demo HTML and ZIP package

import { getAspectRatio, getSizeDimensions } from './ui.js';

/**
 * Build the standalone AR demo index.html as a string.
 * The video is embedded as a base64 data URL so the file is self-contained.
 */
export async function buildArHtml(config, videoFile, posterDataUrl) {
  const { name, aspect, size, autoplay, loop, muted, shadow, videoWidth = 16, videoHeight = 9 } = config;

  const planeWidth = getSizeDimensions(size);

  // We embed video as object URL reference inside the HTML;
  // for the ZIP version we reference assets/video.mp4 instead.
  const videoSrc = config.zipMode ? 'assets/video.mp4' : '__VIDEO_BLOB_URL__';

  const autoplayAttr = autoplay ? 'autoplay' : '';
  const loopAttr = loop ? 'loop' : '';
  const mutedAttr = muted ? 'muted' : '';
  const posterAttr = posterDataUrl ? `poster="${posterDataUrl}"` : '';

  const aspectRatio = getAspectRatio({ aspect }, videoWidth, videoHeight);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>${escHtml(name)} · WebAR · Lookiar</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0a0f;color:#f0f0f5;font-family:system-ui,sans-serif;height:100dvh;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center}
    #start-screen{text-align:center;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:16px}
    .ar-logo{display:flex;align-items:center;gap:8px;color:#8b8ba0;font-size:13px;margin-bottom:8px}
    .logo-mark{width:26px;height:26px;background:linear-gradient(135deg,#6366f1,#a78bfa);border-radius:6px;display:grid;place-items:center;font-weight:700;font-size:12px;color:#fff}
    h1{font-size:22px;font-weight:700;letter-spacing:-0.5px;line-height:1.2}
    p{font-size:14px;color:#8b8ba0;max-width:300px;line-height:1.6}
    .badge{background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);color:#a78bfa;font-size:11px;padding:4px 10px;border-radius:99px;letter-spacing:.5px}
    .btn-start{background:linear-gradient(135deg,#6366f1,#a78bfa);color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 4px 20px rgba(99,102,241,.3);transition:opacity .15s,transform .15s}
    .btn-start:hover{opacity:.88;transform:translateY(-1px)}
    .device-warning{background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.2);color:#f43f5e;font-size:12px;padding:10px 14px;border-radius:8px;max-width:300px;line-height:1.5;display:none}
    #ar-container{position:fixed;inset:0;display:none}
    canvas{display:block;width:100%!important;height:100%!important}
    #hud{position:fixed;top:0;left:0;right:0;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,transparent 100%);pointer-events:none;z-index:10}
    #hud-title{font-size:13px;font-weight:600;color:#fff;opacity:.9}
    #hud-hint{font-size:12px;color:rgba(255,255,255,.6);text-align:center;margin-top:2px}
    .hud-pill{background:rgba(0,0,0,.4);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:99px;padding:5px 12px;pointer-events:auto}
    #btn-exit{background:rgba(0,0,0,.5);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;pointer-events:auto;font-family:inherit}
    #btn-reattach{background:rgba(99,102,241,.7);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;pointer-events:auto;font-family:inherit;display:none}
    #status-hint{position:fixed;bottom:32px;left:50%;transform:translateX(-50%);text-align:center;color:#fff;font-size:13px;pointer-events:none;z-index:10;transition:opacity .3s}
    #status-hint span{background:rgba(0,0,0,.55);backdrop-filter:blur(8px);padding:8px 18px;border-radius:99px;display:inline-block}
    #fallback{position:fixed;inset:0;background:#0a0a0f;display:none;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center;padding:32px}
    #fallback h2{font-size:20px;font-weight:600}
    #fallback p{color:#8b8ba0;font-size:14px;max-width:300px}
    #fallback video{max-width:min(400px,100%);border-radius:16px;box-shadow:0 0 60px rgba(99,102,241,.3)}
    .fb-badge{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);color:#a78bfa;font-size:11px;padding:4px 10px;border-radius:99px}
  </style>
</head>
<body>

<div id="start-screen">
  <div class="ar-logo">
    <div class="logo-mark">L</div>
    <span>Lookiar</span>
  </div>
  <div class="badge">WebAR Surface</div>
  <h1>${escHtml(name)}</h1>
  <p>Apunta la cámara hacia una superficie plana y toca la pantalla para colocar el video.</p>
  <button class="btn-start" id="btnStart">Iniciar experiencia AR</button>
  <div class="device-warning" id="deviceWarning">
    Este navegador no es compatible con WebXR. Se mostrará una vista de escritorio alternativa.
  </div>
</div>

<div id="ar-container">
  <div id="hud">
    <div class="hud-pill">
      <div id="hud-title">${escHtml(name)}</div>
      <div id="hud-hint">Buscando superficie…</div>
    </div>
    <div style="display:flex;gap:8px">
      <button id="btn-reattach">Recolocar</button>
      <button id="btn-exit">Salir</button>
    </div>
  </div>
  <div id="status-hint"><span>Apunta hacia una superficie plana</span></div>
</div>

<div id="fallback">
  <div class="fb-badge">Vista de escritorio — sin WebXR</div>
  <h2>${escHtml(name)}</h2>
  <video src="${videoSrc}" ${autoplayAttr} ${loopAttr} ${mutedAttr} ${posterAttr} playsinline controls></video>
  <p>Para la experiencia AR completa, abre este archivo desde Chrome en Android con soporte WebXR.</p>
</div>

<video id="arVideo" src="${videoSrc}" ${loopAttr} ${mutedAttr} ${posterAttr} playsinline style="display:none" crossorigin="anonymous"></video>

<script type="module">
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';

const PLANE_WIDTH = ${planeWidth};
const ASPECT = ${aspectRatio.toFixed(4)};
const PLANE_HEIGHT = PLANE_WIDTH / ASPECT;
const USE_SHADOW = ${shadow ? 'true' : 'false'};
const AUTOPLAY = ${autoplay ? 'true' : 'false'};

let renderer, scene, camera, xrSession;
let reticle, videoPlane, shadowPlane, videoMesh;
let placed = false;
let hitTestSource = null;
const video = document.getElementById('arVideo');

const btnStart   = document.getElementById('btnStart');
const arContainer = document.getElementById('ar-container');
const startScreen = document.getElementById('start-screen');
const fallbackEl  = document.getElementById('fallback');
const hintEl      = document.getElementById('status-hint');
const hudHint     = document.getElementById('hud-hint');
const btnReattach = document.getElementById('btn-reattach');
const btnExit     = document.getElementById('btn-exit');
const deviceWarn  = document.getElementById('deviceWarning');

// Check WebXR support
const hasXR = navigator.xr && await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
if (!hasXR) deviceWarn.style.display = 'block';

btnStart.addEventListener('click', async () => {
  if (!hasXR) { showFallback(); return; }
  await initAR();
});

btnExit.addEventListener('click', () => xrSession?.end());
btnReattach.addEventListener('click', () => {
  placed = false;
  videoMesh?.visible && (videoMesh.visible = false);
  if (shadowPlane) shadowPlane.visible = false;
  btnReattach.style.display = 'none';
  hintEl.style.opacity = '1';
  hudHint.textContent = 'Buscando superficie…';
  reticle && (reticle.visible = true);
  video.pause();
});

function showFallback() {
  startScreen.style.display = 'none';
  fallbackEl.style.display = 'flex';
}

async function initAR() {
  // Setup renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = true;
  arContainer.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  // Light
  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambient);

  // Reticle
  const reticleGeo = new THREE.RingGeometry(0.08, 0.1, 32);
  reticleGeo.rotateX(-Math.PI / 2);
  const reticleMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, side: THREE.DoubleSide });
  reticle = new THREE.Mesh(reticleGeo, reticleMat);
  reticle.visible = false;
  scene.add(reticle);

  // Video texture
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.colorSpace = THREE.SRGBColorSpace;

  // Video plane
  const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
  const planeMat = new THREE.MeshBasicMaterial({ map: videoTexture, side: THREE.DoubleSide });
  videoMesh = new THREE.Mesh(planeGeo, planeMat);
  videoMesh.visible = false;
  scene.add(videoMesh);

  // Shadow plane (fake)
  if (USE_SHADOW) {
    const shadowGeo = new THREE.PlaneGeometry(PLANE_WIDTH * 1.3, PLANE_HEIGHT * 0.25);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
    });
    shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.visible = false;
    scene.add(shadowPlane);
  }

  // XR session
  const sessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.getElementById('ar-container') },
  };

  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
  } catch (e) {
    console.error('XR session failed:', e);
    showFallback();
    return;
  }

  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(xrSession);

  xrSession.addEventListener('end', () => {
    arContainer.style.display = 'none';
    startScreen.style.display = 'flex';
    placed = false;
    video.pause();
    if (arContainer.contains(renderer.domElement)) arContainer.removeChild(renderer.domElement);
  });

  // Hit test source
  xrSession.requestReferenceSpace('viewer').then((viewerSpace) => {
    xrSession.requestHitTestSource({ space: viewerSpace }).then((src) => {
      hitTestSource = src;
    });
  });

  xrSession.addEventListener('select', onSelect);

  startScreen.style.display = 'none';
  arContainer.style.display = 'block';

  renderer.setAnimationLoop(onFrame);
}

function onSelect() {
  if (!reticle.visible) return;
  if (!placed) {
    placed = true;
    videoMesh.position.copy(reticle.position);
    videoMesh.position.y += PLANE_HEIGHT / 2;
    videoMesh.quaternion.copy(reticle.quaternion);
    videoMesh.visible = true;

    if (shadowPlane) {
      shadowPlane.position.copy(reticle.position);
      shadowPlane.position.y += 0.001;
      shadowPlane.visible = true;
    }

    reticle.visible = false;
    hintEl.style.opacity = '0';
    hudHint.textContent = 'Video colocado';
    btnReattach.style.display = 'inline-block';

    if (AUTOPLAY) {
      video.muted = true;
      video.play().catch(() => {});
    }
  }
}

function onFrame(timestamp, frame) {
  if (!frame) return;
  const referenceSpace = renderer.xr.getReferenceSpace();
  if (hitTestSource && !placed) {
    const hitTestResults = frame.getHitTestResults(hitTestSource);
    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(referenceSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
      hudHint.textContent = 'Toca para colocar el video';
    } else {
      reticle.visible = false;
      hudHint.textContent = 'Buscando superficie…';
    }
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
</script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Capture the first frame of a video element as a data URL.
 */
export function captureFirstFrame(videoEl) {
  return new Promise((resolve) => {
    const seek = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = videoEl.videoWidth  || 640;
      canvas.height = videoEl.videoHeight || 360;
      canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    if (videoEl.readyState >= 2) { seek(); return; }
    videoEl.addEventListener('loadeddata', seek, { once: true });
  });
}

/**
 * Build and trigger a ZIP download using JSZip.
 */
export async function exportZip(config, videoFile, htmlContent) {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip no está cargado. Recarga la página e intenta de nuevo.');
  }

  const zip = new JSZip();

  // index.html
  const finalHtml = htmlContent.replace('__VIDEO_BLOB_URL__', 'assets/video.mp4');
  zip.file('index.html', finalHtml);

  // Video file
  const videoArrayBuffer = await videoFile.arrayBuffer();
  zip.folder('assets').file('video.mp4', videoArrayBuffer);

  // README
  zip.file('README.txt', buildReadme(config));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  triggerDownload(blob, `${sanitizeFilename(config.name)}-ar.zip`);
}

function buildReadme(config) {
  return `AR Video Surface Builder — Lookiar
====================================

Proyecto: ${config.name}
Generado: ${new Date().toLocaleString('es-ES')}

CONTENIDO DEL PAQUETE
---------------------
index.html     — Experiencia WebAR principal
assets/video.mp4 — Tu video original
README.txt     — Este archivo

CÓMO USAR
---------
1. Sube todos los archivos a un servidor web (no funciona abriendo index.html
   directamente por restricciones de cámara en file://)
2. Abre la URL desde Chrome en Android (soporte WebXR completo)
3. Acepta los permisos de cámara
4. Apunta hacia una superficie plana
5. Toca la pantalla para colocar el video

DEPLOYMENT RÁPIDO (Vercel)
--------------------------
1. Instala Vercel CLI: npm i -g vercel
2. Dentro de la carpeta del ZIP: vercel
3. Copia la URL pública y ábrela desde tu móvil

SOPORTE WEBXR
-------------
- Chrome para Android (versión 81+)
- Samsung Internet (versión 11+)
- iOS: soporte limitado (Safari no implementa WebXR hit-test aún)
  → En iOS se muestra la vista de fallback automáticamente

CONFIGURACIÓN USADA
-------------------
Aspecto del plano : ${config.aspect}
Tamaño            : ${config.size}
Autoplay          : ${config.autoplay ? 'Sí' : 'No'}
Loop              : ${config.loop ? 'Sí' : 'No'}
Muted             : ${config.muted ? 'Sí' : 'No'}
Sombra falsa      : ${config.shadow ? 'Sí' : 'No'}

---
Herramienta gratuita por Lookiar · lookiar.com
`;
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ar-project';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
