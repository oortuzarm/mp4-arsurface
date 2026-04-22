// UI state management and DOM helpers

export const $ = (id) => document.getElementById(id);

export const show = (...ids) => ids.forEach(id => $(`${id}`)?.classList.remove('hidden'));
export const hide = (...ids) => ids.forEach(id => $(`${id}`)?.classList.add('hidden'));

export function setProgress(pct, msg) {
  const fill = $('progressFill');
  const label = $('generatingMsg');
  if (fill) fill.style.width = `${Math.min(100, pct)}%`;
  if (label && msg) label.textContent = msg;
}

export function animateProgress(steps, onDone) {
  let i = 0;
  function next() {
    if (i >= steps.length) { onDone?.(); return; }
    const [pct, msg, delay] = steps[i++];
    setProgress(pct, msg);
    setTimeout(next, delay);
  }
  next();
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(secs) {
  if (!isFinite(secs)) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function detectAspect(w, h) {
  if (!w || !h) return '—';
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.05) return '9:16';
  if (Math.abs(r - 1) < 0.05) return '1:1';
  if (Math.abs(r - 4 / 3) < 0.05) return '4:3';
  if (Math.abs(r - 21 / 9) < 0.05) return '21:9';
  return `${w}×${h}`;
}

export function getAspectRatio(config, videoW, videoH) {
  const aspectMap = {
    '16:9': [16, 9],
    '9:16': [9, 16],
    '1:1':  [1, 1],
    'auto': [videoW || 16, videoH || 9],
  };
  const [w, h] = aspectMap[config.aspect] || [16, 9];
  return w / h;
}

export function getSizeDimensions(sizeKey) {
  const map = { small: 0.3, medium: 0.6, large: 1.0 };
  return map[sizeKey] ?? 0.6;
}
