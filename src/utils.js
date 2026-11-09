/**
 * VEGA Frame Grid Generator - Utility Functions
 */

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0.00s';
  return seconds.toFixed(2) + 's';
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

export function getAspectRatio(width, height) {
  if (!width || !height) return '—';
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

export function estimateCanvasMemory(width, height) {
  // Approximate RGBA memory in MB
  const bytes = width * height * 4;
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function getMaxCanvasSize() {
  // Conservative browser limit
  const canvas = document.createElement('canvas');
  const sizes = [16384, 8192, 4096, 2048];
  for (const size of sizes) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        ctx.fillRect(0, 0, 1, 1);
        return size;
      } catch (e) {
        continue;
      }
    }
  }
  return 4096;
}

export function createSafeTimestamps(start, end, count) {
  if (count <= 0) return [];
  if (count === 1) return [start];
  const duration = end - start;
  // Avoid exact end which often fails to decode
  const safeEnd = Math.max(start, end - 0.04);
  const timestamps = [];
  for (let i = 0; i < count; i++) {
    const t = start + (i / (count - 1 || 1)) * (safeEnd - start);
    timestamps.push(clamp(t, start, safeEnd));
  }
  return timestamps;
}

export function createFPSTimestamps(start, end, fps) {
  const timestamps = [];
  const interval = 1 / fps;
  let t = start;
  const safeEnd = Math.max(start, end - 0.04);
  while (t <= safeEnd + 0.001) {
    timestamps.push(clamp(t, start, safeEnd));
    t += interval;
  }
  return timestamps;
}

export function createIntervalTimestamps(start, end, interval) {
  const timestamps = [];
  let t = start;
  const safeEnd = Math.max(start, end - 0.04);
  while (t <= safeEnd + 0.001) {
    timestamps.push(clamp(t, start, safeEnd));
    t += interval;
  }
  return timestamps;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
