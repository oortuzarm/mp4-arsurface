// AR Video Surface Builder — Lookiar
// Script unificado (sin ES modules) — compatible con file://

// ─── DOM HELPERS ─────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function show() { Array.from(arguments).forEach(function(id) { var el = $(id); if (el) el.classList.remove('hidden'); }); }
function hide() { Array.from(arguments).forEach(function(id) { var el = $(id); if (el) el.classList.add('hidden'); }); }

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(secs) {
  if (!isFinite(secs) || secs === 0) return '—';
  var m = Math.floor(secs / 60);
  var s = Math.floor(secs % 60);
  return m > 0 ? m + 'm ' + s + 's' : s + 's';
}

function detectAspect(w, h) {
  if (!w || !h) return '—';
  var r = w / h;
  if (Math.abs(r - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.05) return '9:16';
  if (Math.abs(r - 1)      < 0.05) return '1:1';
  if (Math.abs(r - 4 / 3)  < 0.05) return '4:3';
  if (Math.abs(r - 21 / 9) < 0.05) return '21:9';
  return w + '×' + h;
}

function getAspectRatio(aspect, vw, vh) {
  var map = { '16:9': [16,9], '9:16': [9,16], '1:1': [1,1], 'auto': [vw||16, vh||9] };
  var pair = map[aspect] || [16,9];
  return pair[0] / pair[1];
}

function getSizeDimensions(sizeKey) {
  return { small: 0.3, medium: 0.6, large: 1.0 }[sizeKey] || 0.6;
}

function setProgressUI(pct, msg) {
  var fill  = $('progressFill');
  var label = $('generatingMsg');
  if (fill)  fill.style.width = Math.min(100, pct) + '%';
  if (label && msg) label.textContent = msg;
}

function delay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'ar-project';
}

function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a   = document.createElement('a');
  a.href  = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ─── APP STATE ────────────────────────────────────────────────────────────────
var state = {
  videoFile:     null,
  videoUrl:      null,
  videoDuration: 0,
  videoWidth:    0,
  videoHeight:   0,
  generatedHtml: null,
  posterDataUrl: null,
  config: {
    name:     'Mi experiencia AR',
    aspect:   'auto',
    size:     'medium',
    autoplay: true,
    loop:     true,
    muted:    true,
    shadow:   true,
    poster:   true,
    mode:     'demo',
  },
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  wireUpload();
  wireConfig();
  wireActions();
});

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
function wireUpload() {
  var zone   = $('uploadZone');
  var input  = $('fileInput');
  var browse = $('browseBtn');
  var remove = $('removeBtn');
  var retry  = $('retryBtn');

  function openFilePicker() { input.value = ''; input.click(); }

  browse.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); openFilePicker(); });

  zone.addEventListener('click', function(e) {
    if (e.target === browse || e.target.closest && e.target.closest('button')) return;
    openFilePicker();
  });

  zone.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); }
  });

  zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', function() { zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', function(e) {
    e.preventDefault();
    zone.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  input.addEventListener('change', function() {
    if (input.files && input.files[0]) handleFile(input.files[0]);
  });

  remove.addEventListener('click', function(e) { e.stopPropagation(); resetFile(); });
  retry.addEventListener('click',  function(e) { e.stopPropagation(); resetFile(); });
}

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.mp4')) {
    showUploadError('Solo se permiten archivos .mp4');
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    showUploadError('El archivo pesa ' + formatSize(file.size) + '. El límite es 100 MB.');
    return;
  }

  setUploadState('loading');

  loadVideo(file).then(function() {
    state.videoFile = file;
    setUploadState('success');
    $('fileName').textContent = file.name;
    $('fileMeta').textContent = formatSize(file.size) + ' · ' + formatDuration(state.videoDuration);
    showPreview();
  }).catch(function(err) {
    console.error(err);
    showUploadError('No se pudo leer el video. Verifica que el archivo esté completo.');
  });
}

function loadVideo(file) {
  return new Promise(function(resolve, reject) {
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.videoUrl = URL.createObjectURL(file);
    var video = $('previewVideo');
    video.src = state.videoUrl;

    function onMeta() {
      state.videoDuration = video.duration;
      state.videoWidth    = video.videoWidth;
      state.videoHeight   = video.videoHeight;
      cleanup();
      resolve();
    }
    function onErr() { cleanup(); reject(new Error('Video load error')); }
    function cleanup() {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onErr);
    }
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('error', onErr);
  });
}

function setUploadState(s) {
  hide('uploadIdle','uploadLoading','uploadSuccess','uploadError');
  var key = 'upload' + s.charAt(0).toUpperCase() + s.slice(1);
  show(key);
}

function showUploadError(msg) {
  $('errorMsg').textContent = msg;
  setUploadState('error');
}

function resetFile() {
  if (state.videoUrl) { URL.revokeObjectURL(state.videoUrl); state.videoUrl = null; }
  state.videoFile    = null;
  state.posterDataUrl = null;
  $('fileInput').value = '';
  $('previewVideo').src = '';
  setUploadState('idle');
  hide('step-preview','step-config','step-generating','step-result');
}

// ─── PREVIEW ──────────────────────────────────────────────────────────────────
function showPreview() {
  show('step-preview');
  $('statResolution').textContent = state.videoWidth + ' × ' + state.videoHeight;
  $('statDuration').textContent   = formatDuration(state.videoDuration);
  $('statAspect').textContent     = detectAspect(state.videoWidth, state.videoHeight);
  $('statSize').textContent       = formatSize(state.videoFile.size);

  var rawName = state.videoFile.name.replace(/\.mp4$/i,'').replace(/[-_]/g,' ');
  var defaultName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  $('projectName').value = defaultName;
  state.config.name = defaultName;

  show('step-config');
  setTimeout(function() {
    $('step-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
function wireConfig() {
  $('projectName').addEventListener('input', function(e) {
    state.config.name = e.target.value.trim() || 'Mi experiencia AR';
  });

  document.querySelectorAll('input[name="aspect"]').forEach(function(r) {
    r.addEventListener('change', function() { state.config.aspect = r.value; });
  });
  document.querySelectorAll('input[name="size"]').forEach(function(r) {
    r.addEventListener('change', function() { state.config.size = r.value; });
  });

  $('optAutoplay').addEventListener('change', function(e) { state.config.autoplay = e.target.checked; });
  $('optLoop').addEventListener('change',     function(e) { state.config.loop     = e.target.checked; });
  $('optMuted').addEventListener('change',    function(e) { state.config.muted    = e.target.checked; });
  $('optShadow').addEventListener('change',   function(e) { state.config.shadow   = e.target.checked; });
  $('optPoster').addEventListener('change',   function(e) { state.config.poster   = e.target.checked; });

  function setMode(val) {
    state.config.mode = val;
    $('modeDemo').classList.toggle('active', val === 'demo');
    $('modeExport').classList.toggle('active', val === 'export');
    document.querySelector('input[name="mode"][value="' + val + '"]').checked = true;
  }

  $('modeDemo').addEventListener('click',   function() { setMode('demo'); });
  $('modeExport').addEventListener('click', function() { setMode('export'); });

  document.querySelectorAll('input[name="mode"]').forEach(function(r) {
    r.addEventListener('change', function() { setMode(r.value); });
  });

  $('generateBtn').addEventListener('click', generate);
}

// ─── GENERATE ─────────────────────────────────────────────────────────────────
function generate() {
  if (!state.videoFile) return;
  hide('step-config');
  show('step-generating');
  setTimeout(function() {
    $('step-generating').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);

  var steps = [
    [15, 'Capturando primer frame…',              500],
    [35, 'Generando HTML de la experiencia…',     600],
    [60, 'Procesando configuración AR…',           400],
    [80, 'Aplicando opciones de reproducción…',   350],
    [95, 'Casi listo…',                           300],
  ];

  var i = 0;
  function runStep() {
    if (i >= steps.length) { doGenerate(); return; }
    var step = steps[i++];
    setProgressUI(step[0], step[1]);
    setTimeout(runStep, step[2]);
  }
  runStep();
}

function doGenerate() {
  startQrSession(); // establece state.qrExpiry = ahora + 1h
  Promise.resolve()
    .then(function() {
      if (state.config.poster) return captureFirstFrame($('previewVideo'));
      return null;
    })
    .then(function(poster) {
      state.posterDataUrl = poster;
      state.generatedHtml = buildArHtml(
        state.config,
        state.videoWidth,
        state.videoHeight,
        state.config.poster ? poster : null,
        false
      );
      setProgressUI(100, 'Completado');
      return delay(400);
    })
    .then(function() { showResult(); })
    .catch(function(err) {
      console.error('Generate error:', err);
      hide('step-generating');
      show('step-config');
      alert('Ocurrió un error al generar. Intenta de nuevo.\n\n' + err.message);
    });
}

// ─── CAPTURE FIRST FRAME ──────────────────────────────────────────────────────
function captureFirstFrame(videoEl) {
  return new Promise(function(resolve) {
    function doCapture() {
      try {
        var canvas = document.createElement('canvas');
        canvas.width  = videoEl.videoWidth  || 640;
        canvas.height = videoEl.videoHeight || 360;
        canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch(e) {
        resolve(null);
      }
    }
    if (videoEl.readyState >= 2) { doCapture(); }
    else { videoEl.addEventListener('loadeddata', doCapture, { once: true }); }
  });
}

// ─── BUILD AR HTML ────────────────────────────────────────────────────────────
function buildArHtml(config, vw, vh, posterDataUrl, zipMode) {
  var name       = config.name;
  var aspect     = config.aspect;
  var size       = config.size;
  var autoplay   = config.autoplay;
  var loop       = config.loop;
  var muted      = config.muted;
  var shadow     = config.shadow;

  var planeWidth  = getSizeDimensions(size);
  var aspectRatio = getAspectRatio(aspect, vw, vh);

  // Expiración: 1 hora desde el momento de generación del demo
  var expiresAt = state.qrExpiry || (Date.now() + QR_TTL_MS);

  var videoSrc    = zipMode ? 'assets/video.mp4' : '__VIDEO_BLOB_URL__';
  var autoplayA   = autoplay ? 'autoplay' : '';
  var loopA       = loop     ? 'loop'     : '';
  var mutedA      = muted    ? 'muted'    : '';
  var posterA     = posterDataUrl ? 'poster="' + posterDataUrl + '"' : '';

  return '<!DOCTYPE html>\n' +
'<html lang="es">\n' +
'<head>\n' +
'  <meta charset="UTF-8"/>\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>\n' +
'  <title>' + escHtml(name) + ' · WebAR · Lookiar</title>\n' +
'  <style>\n' +
'    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n' +
'    body{background:#0a0a0f;color:#f0f0f5;font-family:system-ui,sans-serif;height:100dvh;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center}\n' +
'    #start-screen{text-align:center;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:16px}\n' +
'    .ar-logo{display:flex;align-items:center;gap:8px;color:#8b8ba0;font-size:13px;margin-bottom:8px}\n' +
'    .logo-mark{width:26px;height:26px;background:linear-gradient(135deg,#6366f1,#a78bfa);border-radius:6px;display:grid;place-items:center;font-weight:700;font-size:12px;color:#fff}\n' +
'    h1{font-size:22px;font-weight:700;letter-spacing:-0.5px;line-height:1.2}\n' +
'    p{font-size:14px;color:#8b8ba0;max-width:300px;line-height:1.6}\n' +
'    .badge{background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);color:#a78bfa;font-size:11px;padding:4px 10px;border-radius:99px;letter-spacing:.5px}\n' +
'    .btn-start{background:linear-gradient(135deg,#6366f1,#a78bfa);color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 4px 20px rgba(99,102,241,.3)}\n' +
'    .device-warning{background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.2);color:#f43f5e;font-size:12px;padding:10px 14px;border-radius:8px;max-width:300px;line-height:1.5;display:none}\n' +
'    #ar-container{position:fixed;inset:0;display:none}\n' +
'    canvas{display:block;width:100%!important;height:100%!important}\n' +
'    #hud{position:fixed;top:0;left:0;right:0;padding:12px 16px;display:flex;align-items:flex-start;justify-content:space-between;background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,transparent 100%);pointer-events:none;z-index:10}\n' +
'    .hud-pill{background:rgba(0,0,0,.4);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:99px;padding:5px 12px;pointer-events:auto}\n' +
'    #hud-title{font-size:13px;font-weight:600;color:#fff;opacity:.9}\n' +
'    #hud-hint{font-size:12px;color:rgba(255,255,255,.6)}\n' +
'    .hud-btns{display:flex;gap:8px;pointer-events:auto}\n' +
'    .hud-btn{color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;background:rgba(0,0,0,.5)}\n' +
'    #btn-reattach{background:rgba(99,102,241,.7);border-color:transparent;display:none}\n' +
'    #status-hint{position:fixed;bottom:32px;left:50%;transform:translateX(-50%);text-align:center;color:#fff;font-size:13px;pointer-events:none;z-index:10;transition:opacity .3s;white-space:nowrap}\n' +
'    #status-hint span{background:rgba(0,0,0,.55);backdrop-filter:blur(8px);padding:8px 18px;border-radius:99px;display:inline-block}\n' +
'    #fallback{position:fixed;inset:0;background:#0a0a0f;display:none;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center;padding:32px}\n' +
'    #fallback h2{font-size:20px;font-weight:600}\n' +
'    #fallback p{color:#8b8ba0;font-size:14px;max-width:300px}\n' +
'    #fallback video{max-width:min(400px,100%);border-radius:16px;box-shadow:0 0 60px rgba(99,102,241,.3)}\n' +
'    .fb-badge{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);color:#a78bfa;font-size:11px;padding:4px 10px;border-radius:99px}\n' +
'    #expired-screen{position:fixed;inset:0;background:#0a0a0f;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:32px;z-index:999}\n' +
'    .expired-icon{width:64px;height:64px;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.2);border-radius:50%;display:grid;place-items:center;color:#f43f5e}\n' +
'    .expired-title{font-size:20px;font-weight:700;color:#f0f0f5}\n' +
'    .expired-desc{font-size:14px;color:#8b8ba0;max-width:280px;line-height:1.6}\n' +
'    .btn-expired{background:linear-gradient(135deg,#6366f1,#a78bfa);color:#fff;border:none;border-radius:12px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'\n' +
'<!-- Pantalla de enlace expirado (mobile) -->\n' +
'<div id="expired-screen">\n' +
'  <div class="expired-icon">\n' +
'    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>\n' +
'  </div>\n' +
'  <div class="ar-logo" style="margin:0"><div class="logo-mark">L</div><span style="color:#8b8ba0">Lookiar</span></div>\n' +
'  <p class="expired-title">Este enlace expiró</p>\n' +
'  <p class="expired-desc">El código QR tenía una vigencia de 1 hora. Regresa a la herramienta para generar uno nuevo.</p>\n' +
'  <button class="btn-expired" onclick="window.close();history.back()">Volver a generar experiencia</button>\n' +
'</div>\n' +
'\n' +
'<div id="start-screen">\n' +
'  <div class="ar-logo"><div class="logo-mark">L</div><span>Lookiar</span></div>\n' +
'  <div class="badge">WebAR Surface</div>\n' +
'  <h1>' + escHtml(name) + '</h1>\n' +
'  <p>Apunta la cámara hacia una superficie plana y toca la pantalla para colocar el video.</p>\n' +
'  <button class="btn-start" id="btnStart">Iniciar experiencia AR</button>\n' +
'  <div class="device-warning" id="deviceWarning">Este navegador no es compatible con WebXR. Se mostrará una vista alternativa.</div>\n' +
'</div>\n' +
'\n' +
'<div id="ar-container">\n' +
'  <div id="hud">\n' +
'    <div class="hud-pill"><div id="hud-title">' + escHtml(name) + '</div><div id="hud-hint">Buscando superficie…</div></div>\n' +
'    <div class="hud-btns"><button class="hud-btn" id="btn-reattach">Recolocar</button><button class="hud-btn" id="btn-exit">Salir</button></div>\n' +
'  </div>\n' +
'  <div id="status-hint"><span>Apunta hacia una superficie plana</span></div>\n' +
'</div>\n' +
'\n' +
'<div id="fallback">\n' +
'  <div class="fb-badge">Vista sin WebXR</div>\n' +
'  <h2>' + escHtml(name) + '</h2>\n' +
'  <video src="' + videoSrc + '" ' + autoplayA + ' ' + loopA + ' ' + mutedA + ' ' + posterA + ' playsinline controls></video>\n' +
'  <p>Para la experiencia AR completa abre este archivo desde Chrome en Android.</p>\n' +
'</div>\n' +
'\n' +
'<video id="arVideo" src="' + videoSrc + '" ' + loopA + ' ' + mutedA + ' ' + posterA + ' playsinline style="display:none" crossorigin="anonymous"></video>\n' +
'\n' +
'<script type="module">\n' +
'import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";\n' +
'\n' +
'const DEMO_EXPIRES_AT = ' + expiresAt + ';\n' +
'const PLANE_W  = ' + planeWidth.toFixed(3) + ';\n' +
'const ASPECT   = ' + aspectRatio.toFixed(4) + ';\n' +
'const PLANE_H  = PLANE_W / ASPECT;\n' +
'const SHADOW   = ' + (shadow ? 'true' : 'false') + ';\n' +
'const AUTOPLAY = ' + (autoplay ? 'true' : 'false') + ';\n' +
'\n' +
'let renderer, scene, camera, xrSession;\n' +
'let reticle, videoMesh, shadowMesh;\n' +
'let placed = false, hitTestSource = null;\n' +
'const video      = document.getElementById("arVideo");\n' +
'const btnStart   = document.getElementById("btnStart");\n' +
'const arContainer= document.getElementById("ar-container");\n' +
'const startScreen= document.getElementById("start-screen");\n' +
'const fallbackEl = document.getElementById("fallback");\n' +
'const hintEl     = document.getElementById("status-hint");\n' +
'const hudHint    = document.getElementById("hud-hint");\n' +
'const btnReattach= document.getElementById("btn-reattach");\n' +
'const btnExit    = document.getElementById("btn-exit");\n' +
'const deviceWarn = document.getElementById("deviceWarning");\n' +
'\n' +
'\n' +
'// Comprobar expiración al cargar\n' +
'if (Date.now() > DEMO_EXPIRES_AT) {\n' +
'  document.getElementById("expired-screen").style.display = "flex";\n' +
'} else {\n' +
'  // Ocultar pantalla de expirado (por si acaso)\n' +
'  document.getElementById("expired-screen").style.display = "none";\n' +
'}\n' +
'\n' +
'const hasXR = navigator.xr\n' +
'  ? await navigator.xr.isSessionSupported("immersive-ar").catch(()=>false)\n' +
'  : false;\n' +
'if (!hasXR) deviceWarn.style.display = "block";\n' +
'\n' +
'btnStart.addEventListener("click", async () => {\n' +
'  if (!hasXR) { showFallback(); return; }\n' +
'  await initAR();\n' +
'});\n' +
'\n' +
'btnExit.addEventListener("click", () => xrSession?.end());\n' +
'btnReattach.addEventListener("click", () => {\n' +
'  placed = false;\n' +
'  if (videoMesh) videoMesh.visible = false;\n' +
'  if (shadowMesh) shadowMesh.visible = false;\n' +
'  if (reticle) reticle.visible = true;\n' +
'  btnReattach.style.display = "none";\n' +
'  hintEl.style.opacity = "1";\n' +
'  hudHint.textContent = "Buscando superficie…";\n' +
'  video.pause();\n' +
'});\n' +
'\n' +
'function showFallback() {\n' +
'  startScreen.style.display = "none";\n' +
'  fallbackEl.style.display  = "flex";\n' +
'}\n' +
'\n' +
'async function initAR() {\n' +
'  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });\n' +
'  renderer.setPixelRatio(window.devicePixelRatio);\n' +
'  renderer.setSize(window.innerWidth, window.innerHeight);\n' +
'  renderer.xr.enabled = true;\n' +
'  arContainer.appendChild(renderer.domElement);\n' +
'  scene  = new THREE.Scene();\n' +
'  camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 20);\n' +
'  scene.add(new THREE.AmbientLight(0xffffff, 1.2));\n' +
'\n' +
'  // Reticle\n' +
'  const rGeo = new THREE.RingGeometry(0.08, 0.1, 32);\n' +
'  rGeo.rotateX(-Math.PI/2);\n' +
'  reticle = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({ color:0x6366f1, side:THREE.DoubleSide }));\n' +
'  reticle.visible = false;\n' +
'  scene.add(reticle);\n' +
'\n' +
'  // Video texture\n' +
'  const tex = new THREE.VideoTexture(video);\n' +
'  tex.minFilter = THREE.LinearFilter;\n' +
'  tex.colorSpace = THREE.SRGBColorSpace;\n' +
'  videoMesh = new THREE.Mesh(\n' +
'    new THREE.PlaneGeometry(PLANE_W, PLANE_H),\n' +
'    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })\n' +
'  );\n' +
'  videoMesh.visible = false;\n' +
'  scene.add(videoMesh);\n' +
'\n' +
'  // Shadow\n' +
'  if (SHADOW) {\n' +
'    const sGeo = new THREE.PlaneGeometry(PLANE_W*1.3, PLANE_H*0.2);\n' +
'    sGeo.rotateX(-Math.PI/2);\n' +
'    shadowMesh = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.32 }));\n' +
'    shadowMesh.visible = false;\n' +
'    scene.add(shadowMesh);\n' +
'  }\n' +
'\n' +
'  try {\n' +
'    xrSession = await navigator.xr.requestSession("immersive-ar", {\n' +
'      requiredFeatures: ["hit-test"],\n' +
'      optionalFeatures: ["dom-overlay"],\n' +
'      domOverlay: { root: arContainer },\n' +
'    });\n' +
'  } catch(e) { console.error(e); showFallback(); return; }\n' +
'\n' +
'  renderer.xr.setReferenceSpaceType("local");\n' +
'  await renderer.xr.setSession(xrSession);\n' +
'\n' +
'  xrSession.addEventListener("end", () => {\n' +
'    arContainer.style.display = "none";\n' +
'    startScreen.style.display = "flex";\n' +
'    placed = false; video.pause();\n' +
'    if (arContainer.contains(renderer.domElement)) arContainer.removeChild(renderer.domElement);\n' +
'  });\n' +
'\n' +
'  xrSession.requestReferenceSpace("viewer").then(vs => {\n' +
'    xrSession.requestHitTestSource({ space: vs }).then(src => { hitTestSource = src; });\n' +
'  });\n' +
'\n' +
'  xrSession.addEventListener("select", onSelect);\n' +
'  startScreen.style.display = "none";\n' +
'  arContainer.style.display = "block";\n' +
'  renderer.setAnimationLoop(onFrame);\n' +
'}\n' +
'\n' +
'function onSelect() {\n' +
'  if (!reticle.visible || placed) return;\n' +
'  placed = true;\n' +
'  videoMesh.position.copy(reticle.position);\n' +
'  videoMesh.position.y += PLANE_H / 2;\n' +
'  videoMesh.quaternion.copy(reticle.quaternion);\n' +
'  videoMesh.visible = true;\n' +
'  if (shadowMesh) { shadowMesh.position.copy(reticle.position); shadowMesh.position.y += 0.001; shadowMesh.visible = true; }\n' +
'  reticle.visible = false;\n' +
'  hintEl.style.opacity = "0";\n' +
'  hudHint.textContent = "Video colocado";\n' +
'  btnReattach.style.display = "inline-block";\n' +
'  if (AUTOPLAY) { video.muted = true; video.play().catch(()=>{}); }\n' +
'}\n' +
'\n' +
'function onFrame(t, frame) {\n' +
'  if (!frame) return;\n' +
'  const ref = renderer.xr.getReferenceSpace();\n' +
'  if (hitTestSource && !placed) {\n' +
'    const hits = frame.getHitTestResults(hitTestSource);\n' +
'    if (hits.length > 0) {\n' +
'      const pose = hits[0].getPose(ref);\n' +
'      reticle.visible = true;\n' +
'      reticle.matrix.fromArray(pose.transform.matrix);\n' +
'      reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);\n' +
'      hudHint.textContent = "Toca para colocar el video";\n' +
'    } else {\n' +
'      reticle.visible = false;\n' +
'      hudHint.textContent = "Buscando superficie…";\n' +
'    }\n' +
'  }\n' +
'  renderer.render(scene, camera);\n' +
'}\n' +
'\n' +
'window.addEventListener("resize", () => {\n' +
'  if (!renderer) return;\n' +
'  camera.aspect = window.innerWidth/window.innerHeight;\n' +
'  camera.updateProjectionMatrix();\n' +
'  renderer.setSize(window.innerWidth, window.innerHeight);\n' +
'});\n' +
'</script>\n' +
'</body>\n' +
'</html>';
}

// ─── RESULT ───────────────────────────────────────────────────────────────────
function showResult() {
  hide('step-generating');
  show('step-result');
  setTimeout(function() {
    $('step-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);

  var cfg = state.config;
  $('resSummaryName').textContent       = cfg.name;
  $('resSummaryDuration').textContent   = formatDuration(state.videoDuration);
  $('resSummaryResolution').textContent = state.videoWidth + '×' + state.videoHeight;
  $('resSummaryAspect').textContent     = cfg.aspect === 'auto' ? detectAspect(state.videoWidth, state.videoHeight) : cfg.aspect;
  $('resSummarySize').textContent       = { small:'Pequeño (0.3m)', medium:'Mediano (0.6m)', large:'Grande (1.0m)' }[cfg.size];

  var playParts = [];
  if (cfg.autoplay) playParts.push('autoplay');
  if (cfg.loop)     playParts.push('loop');
  if (cfg.muted)    playParts.push('muted');
  $('resSummaryPlay').textContent = playParts.length ? playParts.join(' · ') : 'manual';

  initQR();
}

// ─── QR EXPIRY ───────────────────────────────────────────────────────────────
var qrInstance       = null;
var countdownInterval = null;
var QR_TTL_MS        = 60 * 60 * 1000; // 1 hora

// Inicia una nueva sesión QR: guarda creación + expiración
function startQrSession() {
  state.qrCreatedAt = Date.now();
  state.qrExpiry    = state.qrCreatedAt + QR_TTL_MS;
}

function isQrExpired() {
  if (!state.qrExpiry) return false;
  return Date.now() >= state.qrExpiry;
}

function getQrSecondsLeft() {
  if (!state.qrExpiry) return QR_TTL_MS / 1000;
  return Math.max(0, Math.floor((state.qrExpiry - Date.now()) / 1000));
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function formatCountdown(secs) {
  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs % 3600) / 60);
  var s = secs % 60;
  return h > 0 ? pad2(h) + ':' + pad2(m) + ':' + pad2(s) : pad2(m) + ':' + pad2(s);
}

// Arranca o reinicia el contador regresivo en el modal
function startCountdown() {
  stopCountdown();
  renderCountdown(); // render inmediato
  countdownInterval = setInterval(renderCountdown, 1000);
}

function stopCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

function renderCountdown() {
  var secs     = getQrSecondsLeft();
  var textEl   = $('modalCountdownText');
  var dotEl    = $('modalTimerDot');
  var expOver  = $('modalQrExpiredOverlay');
  var expMsg   = $('modalQrExpiredMsg');
  var compatEl = $('modalQrCompat');

  if (secs <= 0) {
    stopCountdown();
    if (textEl)   textEl.textContent = 'Código QR expirado';
    if (dotEl)    { dotEl.className = 'timer-dot expired'; }
    if (expOver)  expOver.classList.remove('hidden');
    if (expMsg)   expMsg.classList.remove('hidden');
    if (compatEl) compatEl.classList.add('hidden');
    return;
  }

  // Texto del contador
  if (textEl) {
    textEl.textContent = secs > 3540
      ? 'Disponible por 1 hora'
      : 'Expira en ' + formatCountdown(secs);
  }

  // Dot: verde > 10 min, amarillo < 10 min, rojo < 1 min
  if (dotEl) {
    if (secs > 600)      dotEl.className = 'timer-dot active';
    else if (secs > 60)  dotEl.className = 'timer-dot warning';
    else                 dotEl.className = 'timer-dot expired';
  }
}

// ─── QR CODE ─────────────────────────────────────────────────────────────────

function initQR() {
  // La tarjeta QR fue eliminada. El QR vive solo en el modal.
}

// Descarga desde la tarjeta de resultado (delega a la función genérica)
function downloadStandaloneDemo() {
  downloadStandaloneDemoTo('qrUploadBtn', 'qrUploadLabel', 'standaloneSizeNote');
}

function readFileAsDataUrl(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function(e) { resolve(e.target.result); };
    reader.onerror = function()  { reject(new Error('No se pudo leer el video')); };
    reader.readAsDataURL(file);
  });
}



// ─── ACTIONS ─────────────────────────────────────────────────────────────────
function wireActions() {
  $('openDemoBtn').addEventListener('click', openDemo);
  $('downloadBtn').addEventListener('click', download);
  $('resetBtn').addEventListener('click',    resetAll);
  $('closeModal').addEventListener('click',  closeModal);
  $('arModal').addEventListener('click', function(e) {
    if (e.target === $('arModal')) closeModal();
  });

  // Modal: botón "Generar nuevo QR" tras expiración
  $('modalRefreshBtn').addEventListener('click', function() {
    openMobileModal(); // reabre la lógica completa con nueva sesión
  });
}

function openDemo() {
  if (!state.generatedHtml) return;

  if (isMobile()) {
    // Móvil: abrir la experiencia AR directamente en nueva pestaña
    var html = state.generatedHtml.replace(/__VIDEO_BLOB_URL__/g, state.videoUrl);
    var blob = new Blob([html], { type: 'text/html' });
    var url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } else {
    // Desktop: mostrar modal con QR + opciones para móvil
    openMobileModal();
  }
}

function openMobileModal() {
  // Resetear estado visual
  $('modalQrExpiredOverlay').classList.add('hidden');
  $('modalQrExpiredMsg').classList.add('hidden');
  $('modalQrCompat').classList.remove('hidden');
  $('modalNoUrl').classList.add('hidden');

  var onServer = window.location.protocol !== 'file:';

  if (isQrExpired() || !state.qrExpiry) {
    // Nueva sesión (primer uso o tras expiración)
    startQrSession();
    $('modalQrCanvas').innerHTML = '';
    $('modalQrPlaceholder').style.display = '';
  }

  if (onServer) {
    // Servidor: QR automático con la URL actual
    generateQRInto('modalQrCanvas', 'modalQrPlaceholder', window.location.href);
    startCountdown();
  } else {
    // file:// sin servidor → mostrar aviso limpio
    $('modalQrPlaceholder').style.display = 'none';
    $('modalQrCanvas').innerHTML =
      '<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;' +
      'flex-direction:column;gap:8px;background:#f5f5f5;color:#aaa;font-size:12px;text-align:center;padding:20px">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.2">' +
      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>' +
      '<rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/></svg>' +
      'Despliega en Vercel<br>para activar el QR</div>';
    $('modalNoUrl').classList.remove('hidden');
    $('modalQrCompat').classList.add('hidden');
    stopCountdown();
  }

  $('arModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function download() {
  if (!state.videoFile || !state.generatedHtml) return;

  var btn = $('downloadBtn');
  btn.textContent = 'Generando ZIP…';
  btn.disabled = true;

  var zipHtml = buildArHtml(
    state.config,
    state.videoWidth,
    state.videoHeight,
    state.config.poster ? state.posterDataUrl : null,
    true
  );

  state.videoFile.arrayBuffer().then(function(buf) {
    var zip = new JSZip();
    zip.file('index.html', zipHtml);
    zip.folder('assets').file('video.mp4', buf);
    zip.file('README.txt', buildReadme(state.config));
    return zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{ level:6 } });
  }).then(function(blob) {
    triggerDownload(blob, sanitizeFilename(state.config.name) + '-ar.zip');
  }).catch(function(err) {
    alert('Error al generar el ZIP: ' + err.message);
  }).finally(function() {
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar paquete ZIP';
    btn.disabled = false;
  });
}

function buildReadme(config) {
  return 'AR Video Surface Builder — Lookiar\n====================================\n\nProyecto: ' + config.name + '\nGenerado: ' + new Date().toLocaleString('es-ES') + '\n\nCONTENIDO\n---------\nindex.html       — Experiencia WebAR\nassets/video.mp4 — Video original\n\nUSO\n---\n1. Sube los archivos a un servidor HTTPS\n2. Abre desde Chrome en Android\n3. Apunta a una superficie plana\n4. Toca para colocar el video\n\nDEPLOY RAPIDO (Vercel)\n----------------------\nnpm i -g vercel && vercel\n\n---\nHerramienta gratuita por Lookiar · lookiar.com\n';
}

function closeModal() {
  $('arModal').classList.add('hidden');
  document.body.style.overflow = '';
  stopCountdown();
}

// Genera QR en cualquier contenedor (reutilizable para tarjeta y modal)
function generateQRInto(canvasId, placeholderId, url) {
  var container   = $(canvasId);
  var placeholder = $(placeholderId);
  if (!container) return;
  container.innerHTML = '';
  if (!url) return;
  try {
    new QRCode(container, {
      text:         url,
      width:        156,
      height:       156,
      colorDark:    '#111118',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
    if (placeholder) placeholder.style.display = 'none';
  } catch(e) { console.error('QR error:', e); }
}

// Descarga el demo standalone, con botón/label/nota configurables (para tarjeta y modal)
function downloadStandaloneDemoTo(btnId, labelId, noteId) {
  if (!state.generatedHtml || !state.videoFile) return;
  var btn   = $(btnId);
  var label = $(labelId);
  var note  = $(noteId);
  btn.disabled = true;
  label.textContent = 'Procesando…';

  readFileAsDataUrl(state.videoFile)
    .then(function(dataUrl) {
      label.textContent = 'Generando archivo…';
      var html = state.generatedHtml.replace(/__VIDEO_BLOB_URL__/g, dataUrl);
      var blob = new Blob([html], { type: 'text/html' });
      var outMB = (blob.size / (1024 * 1024)).toFixed(1);
      triggerDownload(blob, sanitizeFilename(state.config.name) + '-ar-demo.html');
      if (note) {
        note.innerHTML = '✓ <strong>' + outMB + ' MB</strong> descargado · Envíalo al móvil y ábrelo en Chrome';
        note.classList.remove('hidden');
      }
    })
    .catch(function(err) {
      console.error(err);
      if (note) { note.textContent = 'Error al generar. Intenta de nuevo.'; note.classList.remove('hidden'); }
    })
    .finally(function() {
      btn.disabled = false;
      label.textContent = 'Descargar demo para móvil';
    });
}

function resetAll() {
  resetFile();
  state.generatedHtml  = null;
  state.posterDataUrl  = null;
  state.qrCreatedAt    = null;
  state.qrExpiry       = null;
  qrInstance           = null;
  var c = $('modalQrCanvas'); if (c) c.innerHTML = '';
  var p = $('modalQrPlaceholder'); if (p) p.style.display = '';
  closeModal();
  setProgressUI(0, 'Preparando el entorno WebAR');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
