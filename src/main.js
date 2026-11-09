/**
 * VEGA Frame Grid Generator - Main Application
 */

import { VideoLoader } from './videoLoader.js';
import { FrameExtractor } from './frameExtractor.js';
import { SpriteSheetPreview } from './spriteSheet.js';
import { ExportManager } from './exportManager.js';
import {
  formatTime,
  formatDuration,
  estimateCanvasMemory,
  getMaxCanvasSize,
  clamp,
} from './utils.js';

// ── State ──────────────────────────────────────────────
const state = {
  mode: 'normal', // normal | fps | interval
  gridCols: 8,
  gridRows: 8,
  outputSize: 2048,
  fitMode: 'crop',
  incompletePolicy: 'repeat',
  overflowPolicy: 'multi',
  fps: 5,
  interval: 1,
  startTime: 0,
  endTime: 0,
  duration: 0,
  jpgQuality: 95,
  result: null,
  currentSheetIndex: 0,
  processing: false,
};

const loader = new VideoLoader();
const extractor = new FrameExtractor();
const exporter = new ExportManager();
let preview = null;

// ── DOM refs ───────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  uploadZone: $('#uploadZone'),
  fileInput: $('#fileInput'),
  videoSection: $('#videoSection'),
  previewVideo: $('#previewVideo'),
  infoSection: $('#infoSection'),
  timelineSection: $('#timelineSection'),
  infoName: $('#infoName'),
  infoSize: $('#infoSize'),
  infoDuration: $('#infoDuration'),
  infoRes: $('#infoRes'),
  infoAspect: $('#infoAspect'),
  startTime: $('#startTime'),
  endTime: $('#endTime'),
  startTimeVal: $('#startTimeVal'),
  endTimeVal: $('#endTimeVal'),
  selectedDuration: $('#selectedDuration'),
  resetRangeBtn: $('#resetRangeBtn'),
  replaceBtn: $('#replaceBtn'),
  removeBtn: $('#removeBtn'),
  generateBtn: $('#generateBtn'),
  cancelBtn: $('#cancelBtn'),
  progressWrap: $('#progressWrap'),
  progressFill: $('#progressFill'),
  progressStatus: $('#progressStatus'),
  progressPercent: $('#progressPercent'),
  previewPlaceholder: $('#previewPlaceholder'),
  previewHost: $('#previewHost'),
  previewControls: $('#previewControls'),
  outputInfo: $('#outputInfo'),
  downloadBar: $('#downloadBar'),
  sheetNav: $('#sheetNav'),
  sheetLabel: $('#sheetLabel'),
  errorAlert: $('#errorAlert'),
  warnAlert: $('#warnAlert'),
  successAlert: $('#successAlert'),
  memoryHint: $('#memoryHint'),
  // modes
  modeTabs: $$('.mode-tab'),
  modeNormal: $('#modeNormal'),
  modeFps: $('#modeFps'),
  modeInterval: $('#modeInterval'),
  fpsSelect: $('#fpsSelect'),
  customFpsGroup: $('#customFpsGroup'),
  customFps: $('#customFps'),
  intervalSlider: $('#intervalSlider'),
  intervalInput: $('#intervalInput'),
  intervalVal: $('#intervalVal'),
  // grid
  gridSelect: $('#gridSelect'),
  customGridRow: $('#customGridRow'),
  customCols: $('#customCols'),
  customRows: $('#customRows'),
  incompleteSelect: $('#incompleteSelect'),
  // fit
  fitOptions: $$('[data-fit]'),
  overflowOptions: $$('[data-overflow]'),
  // res
  resSelect: $('#resSelect'),
  customResGroup: $('#customResGroup'),
  customRes: $('#customRes'),
  jpgQuality: $('#jpgQuality'),
  jpgQualityVal: $('#jpgQualityVal'),
  includeFramesZip: $('#includeFramesZip'),
  // download
  downloadPngBtn: $('#downloadPngBtn'),
  downloadJpgBtn: $('#downloadJpgBtn'),
  downloadZipBtn: $('#downloadZipBtn'),
  // preview controls
  zoomInBtn: $('#zoomInBtn'),
  zoomOutBtn: $('#zoomOutBtn'),
  fitBtn: $('#fitBtn'),
  toggleGrid: $('#toggleGrid'),
  toggleNumbers: $('#toggleNumbers'),
  prevSheetBtn: $('#prevSheetBtn'),
  nextSheetBtn: $('#nextSheetBtn'),
  // about
  aboutBtn: $('#aboutBtn'),
  aboutModal: $('#aboutModal'),
  closeAboutBtn: $('#closeAboutBtn'),
};

// ── Alerts ─────────────────────────────────────────────
function showAlert(type, msg, duration = 6000) {
  const map = { error: els.errorAlert, warning: els.warnAlert, success: els.successAlert };
  Object.values(map).forEach((el) => {
    el.classList.remove('visible');
    el.textContent = '';
  });
  const el = map[type];
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  if (duration > 0) {
    setTimeout(() => el.classList.remove('visible'), duration);
  }
}

function clearAlerts() {
  [els.errorAlert, els.warnAlert, els.successAlert].forEach((el) => {
    el.classList.remove('visible');
    el.textContent = '';
  });
}

// ── Upload ─────────────────────────────────────────────
function setupUpload() {
  const zone = els.uploadZone;
  const input = els.fileInput;

  zone.addEventListener('click', () => input.click());
  zone.querySelector('.browse-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) handleFile(file);
    input.value = '';
  });

  els.replaceBtn.addEventListener('click', () => input.click());
  els.removeBtn.addEventListener('click', removeVideo);
}

async function handleFile(file) {
  clearAlerts();
  try {
    const meta = await loader.loadFile(file);

    // Attach to preview
    const video = loader.getVideoElement();
    els.previewVideo.src = video.src;
    els.previewVideo.load();

    state.duration = meta.duration;
    state.startTime = 0;
    state.endTime = meta.duration;

    // Update UI
    els.uploadZone.classList.add('has-video', 'hidden');
    els.videoSection.classList.remove('hidden');
    els.infoSection.classList.remove('hidden');
    els.timelineSection.classList.remove('hidden');

    els.infoName.textContent = meta.name;
    els.infoSize.textContent = meta.sizeFormatted;
    els.infoDuration.textContent = meta.durationFormatted;
    els.infoRes.textContent = `${meta.width} × ${meta.height}`;
    els.infoAspect.textContent = meta.aspectRatio;

    // Timeline
    els.startTime.min = 0;
    els.startTime.max = meta.duration;
    els.startTime.step = 0.01;
    els.startTime.value = 0;
    els.endTime.min = 0;
    els.endTime.max = meta.duration;
    els.endTime.step = 0.01;
    els.endTime.value = meta.duration;
    updateTimelineLabels();

    // Interval max
    els.intervalSlider.max = Math.max(0.5, meta.duration);
    els.intervalInput.max = meta.duration;

    els.generateBtn.disabled = false;
    updateMemoryHint();
    clearAlerts();
  } catch (err) {
    showAlert('error', err.message || 'Failed to load video.');
    removeVideo();
  }
}

function removeVideo() {
  loader.cleanup();
  extractor.cancel();
  state.result = null;
  state.processing = false;

  els.previewVideo.removeAttribute('src');
  els.previewVideo.load();
  els.uploadZone.classList.remove('has-video', 'hidden');
  els.videoSection.classList.add('hidden');
  els.infoSection.classList.add('hidden');
  els.timelineSection.classList.add('hidden');
  els.generateBtn.disabled = true;
  els.cancelBtn.classList.add('hidden');
  els.progressWrap.classList.remove('visible');
  els.previewPlaceholder.classList.remove('hidden');
  els.previewHost.classList.add('hidden');
  els.previewControls.classList.add('hidden');
  els.outputInfo.classList.add('hidden');
  els.downloadBar.classList.add('hidden');
  els.sheetNav.classList.add('hidden');
  if (preview) preview.clear();
  clearAlerts();
}

// ── Timeline ───────────────────────────────────────────
function updateTimelineLabels() {
  const s = parseFloat(els.startTime.value);
  const e = parseFloat(els.endTime.value);
  state.startTime = s;
  state.endTime = e;
  els.startTimeVal.textContent = formatTime(s);
  els.endTimeVal.textContent = formatTime(e);
  const dur = Math.max(0, e - s);
  els.selectedDuration.textContent = formatDuration(dur);
}

function setupTimeline() {
  els.startTime.addEventListener('input', () => {
    let s = parseFloat(els.startTime.value);
    let e = parseFloat(els.endTime.value);
    if (s >= e) {
      s = Math.max(0, e - 0.1);
      els.startTime.value = s;
    }
    updateTimelineLabels();
  });
  els.endTime.addEventListener('input', () => {
    let s = parseFloat(els.startTime.value);
    let e = parseFloat(els.endTime.value);
    if (e <= s) {
      e = Math.min(state.duration, s + 0.1);
      els.endTime.value = e;
    }
    updateTimelineLabels();
  });
  els.resetRangeBtn.addEventListener('click', () => {
    els.startTime.value = 0;
    els.endTime.value = state.duration;
    updateTimelineLabels();
  });
}

// ── Mode Tabs ──────────────────────────────────────────
function setupModes() {
  els.modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      els.modeTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.mode = tab.dataset.mode;
      els.modeNormal.classList.toggle('active', state.mode === 'normal');
      els.modeFps.classList.toggle('active', state.mode === 'fps');
      els.modeInterval.classList.toggle('active', state.mode === 'interval');
    });
  });

  els.fpsSelect.addEventListener('change', () => {
    const v = els.fpsSelect.value;
    if (v === 'custom') {
      els.customFpsGroup.classList.remove('hidden');
      state.fps = parseFloat(els.customFps.value) || 12;
    } else {
      els.customFpsGroup.classList.add('hidden');
      state.fps = parseFloat(v);
    }
  });
  els.customFps.addEventListener('input', () => {
    state.fps = parseFloat(els.customFps.value) || 1;
  });

  const syncInterval = (fromSlider) => {
    if (fromSlider) {
      state.interval = parseFloat(els.intervalSlider.value);
      els.intervalInput.value = state.interval;
    } else {
      state.interval = parseFloat(els.intervalInput.value) || 0.1;
      els.intervalSlider.value = clamp(state.interval, 0.05, parseFloat(els.intervalSlider.max));
    }
    els.intervalVal.textContent = state.interval.toFixed(2) + 's';
  };
  els.intervalSlider.addEventListener('input', () => syncInterval(true));
  els.intervalInput.addEventListener('input', () => syncInterval(false));

  els.overflowOptions.forEach((el) => {
    el.addEventListener('click', () => {
      els.overflowOptions.forEach((o) => o.classList.remove('active'));
      el.classList.add('active');
      el.querySelector('input').checked = true;
      state.overflowPolicy = el.dataset.overflow;
    });
  });
}

// ── Grid & Resolution ──────────────────────────────────
function setupGridRes() {
  els.gridSelect.addEventListener('change', () => {
    const v = els.gridSelect.value;
    if (v === 'custom') {
      els.customGridRow.classList.remove('hidden');
      state.gridCols = parseInt(els.customCols.value) || 8;
      state.gridRows = parseInt(els.customRows.value) || 8;
    } else {
      els.customGridRow.classList.add('hidden');
      state.gridCols = state.gridRows = parseInt(v);
    }
    updateMemoryHint();
  });
  els.customCols.addEventListener('input', () => {
    state.gridCols = clamp(parseInt(els.customCols.value) || 1, 1, 64);
    updateMemoryHint();
  });
  els.customRows.addEventListener('input', () => {
    state.gridRows = clamp(parseInt(els.customRows.value) || 1, 1, 64);
    updateMemoryHint();
  });

  els.incompleteSelect.addEventListener('change', () => {
    state.incompletePolicy = els.incompleteSelect.value;
  });

  els.fitOptions.forEach((el) => {
    el.addEventListener('click', () => {
      els.fitOptions.forEach((o) => o.classList.remove('active'));
      el.classList.add('active');
      el.querySelector('input').checked = true;
      state.fitMode = el.dataset.fit;
    });
  });

  els.resSelect.addEventListener('change', () => {
    const v = els.resSelect.value;
    if (v === 'custom') {
      els.customResGroup.classList.remove('hidden');
      state.outputSize = parseInt(els.customRes.value) || 2048;
    } else {
      els.customResGroup.classList.add('hidden');
      state.outputSize = parseInt(v);
    }
    updateMemoryHint();
  });
  els.customRes.addEventListener('input', () => {
    state.outputSize = clamp(parseInt(els.customRes.value) || 64, 64, 8192);
    updateMemoryHint();
  });

  els.jpgQuality.addEventListener('input', () => {
    state.jpgQuality = parseInt(els.jpgQuality.value);
    els.jpgQualityVal.textContent = state.jpgQuality + '%';
  });
}

function updateMemoryHint() {
  const mem = estimateCanvasMemory(state.outputSize, state.outputSize);
  const max = getMaxCanvasSize();
  els.memoryHint.textContent = `Est. canvas memory: ~${mem} MB · Max safe: ${max}px`;
  els.memoryHint.classList.toggle('warn', state.outputSize > max || parseFloat(mem) > 256);
}

// ── Generate ───────────────────────────────────────────
function setupGenerate() {
  els.generateBtn.addEventListener('click', startGenerate);
  els.cancelBtn.addEventListener('click', () => {
    extractor.cancel();
  });
}

async function startGenerate() {
  if (!loader.isLoaded() || state.processing) return;

  clearAlerts();
  state.processing = true;
  state.result = null;
  state.currentSheetIndex = 0;

  els.generateBtn.disabled = true;
  els.cancelBtn.classList.remove('hidden');
  els.progressWrap.classList.add('visible');
  els.progressFill.style.width = '0%';
  els.progressStatus.textContent = 'Extracting frames…';
  els.progressPercent.textContent = '0%';
  els.previewPlaceholder.classList.add('hidden');
  els.downloadBar.classList.add('hidden');
  els.outputInfo.classList.add('hidden');
  els.sheetNav.classList.add('hidden');

  // Validate resolution
  const maxCanvas = getMaxCanvasSize();
  if (state.outputSize > maxCanvas) {
    showAlert('warning', `Requested ${state.outputSize}px exceeds browser limit (~${maxCanvas}px). Results may fail.`);
  }

  try {
    const video = loader.getVideoElement();
    // Use a dedicated video element for extraction to avoid interfering with preview
    const extractVideo = document.createElement('video');
    extractVideo.src = video.src;
    extractVideo.muted = true;
    extractVideo.playsInline = true;
    extractVideo.preload = 'auto';
    await new Promise((resolve, reject) => {
      extractVideo.onloadeddata = resolve;
      extractVideo.onerror = () => reject(new Error('Failed to prepare video for extraction'));
      extractVideo.load();
    });

    const result = await extractor.extractAndBuild({
      video: extractVideo,
      mode: state.mode,
      startTime: state.startTime,
      endTime: state.endTime,
      gridCols: state.gridCols,
      gridRows: state.gridRows,
      outputSize: state.outputSize,
      fitMode: state.fitMode,
      incompletePolicy: state.incompletePolicy,
      overflowPolicy: state.overflowPolicy,
      fps: state.fps,
      interval: state.interval,
      onProgress: (p) => {
        els.progressFill.style.width = `${p.percent || 0}%`;
        els.progressPercent.textContent = `${Math.round(p.percent || 0)}%`;
        if (p.phase === 'extracting') {
          els.progressStatus.textContent = `Frame ${p.currentFrame || 0} / ${p.totalFrames || 0}` +
            (p.sheetIndex > 0 ? ` · Sheet ${p.sheetIndex + 1}` : '');
        } else if (p.phase === 'done') {
          els.progressStatus.textContent = 'Done';
        }
      },
    });

    // Cleanup extract video
    extractVideo.removeAttribute('src');
    extractVideo.load();

    state.result = result;
    showResult(result);
    showAlert('success', `Generated ${result.sheets.length} sprite sheet(s) with ${result.totalExtracted} frames.`);
  } catch (err) {
    if (err.message && err.message.includes('cancelled')) {
      showAlert('warning', 'Processing cancelled.');
    } else {
      showAlert('error', err.message || 'Generation failed.');
      console.error(err);
    }
    // Only restore placeholder if there is no previous successful result
    if (!state.result) {
      els.previewPlaceholder.classList.remove('hidden');
      els.previewHost.classList.add('hidden');
      els.previewControls.classList.add('hidden');
      els.downloadBar.classList.add('hidden');
      els.outputInfo.classList.add('hidden');
    }
  } finally {
    state.processing = false;
    els.generateBtn.disabled = false;
    els.cancelBtn.classList.add('hidden');
    setTimeout(() => els.progressWrap.classList.remove('visible'), 800);
  }
}

function showResult(result) {
  // Hide placeholder completely, show preview host
  els.previewPlaceholder.classList.add('hidden');
  els.previewHost.classList.remove('hidden');
  els.previewControls.classList.remove('hidden');

  // Preview
  if (!preview) {
    preview = new SpriteSheetPreview(els.previewHost);
  }
  preview.setSheet(result.sheets[0], result.gridCols, result.gridRows);

  // Output info
  els.outputInfo.classList.remove('hidden');
  els.outFrames.textContent = result.totalExtracted;
  els.outGrid.textContent = `${result.gridCols}×${result.gridRows}`;
  els.outSheets.textContent = result.sheets.length;
  els.outRes.textContent = `${result.outputSize}×${result.outputSize}`;
  els.outCell.textContent = `${result.cellSize}×${result.cellSize}`;
  els.outMode.textContent = state.mode.charAt(0).toUpperCase() + state.mode.slice(1);

  // Download buttons in toolbar
  els.downloadBar.classList.remove('hidden');

  // Sheet nav
  if (result.sheets.length > 1) {
    els.sheetNav.classList.remove('hidden');
    updateSheetNav();
  } else {
    els.sheetNav.classList.add('hidden');
  }

  // Fit after layout settles
  requestAnimationFrame(() => {
    requestAnimationFrame(() => preview?.fitToScreen());
  });
}

function updateSheetNav() {
  if (!state.result) return;
  const total = state.result.sheets.length;
  const idx = state.currentSheetIndex;
  els.sheetLabel.textContent = `Sheet ${idx + 1} / ${total}`;
  els.prevSheetBtn.disabled = idx <= 0;
  els.nextSheetBtn.disabled = idx >= total - 1;
  if (preview) {
    preview.setSheet(state.result.sheets[idx], state.result.gridCols, state.result.gridRows);
  }
}

// ── Preview Controls ───────────────────────────────────
function setupPreviewControls() {
  els.zoomInBtn.addEventListener('click', () => preview?.zoomIn());
  els.zoomOutBtn.addEventListener('click', () => preview?.zoomOut());
  els.fitBtn.addEventListener('click', () => preview?.fitToScreen());
  els.toggleGrid.addEventListener('change', () => preview?.setShowGrid(els.toggleGrid.checked));
  els.toggleNumbers.addEventListener('change', () => preview?.setShowNumbers(els.toggleNumbers.checked));
  els.prevSheetBtn.addEventListener('click', () => {
    if (state.currentSheetIndex > 0) {
      state.currentSheetIndex--;
      updateSheetNav();
    }
  });
  els.nextSheetBtn.addEventListener('click', () => {
    if (state.result && state.currentSheetIndex < state.result.sheets.length - 1) {
      state.currentSheetIndex++;
      updateSheetNav();
    }
  });
}

// ── Export ─────────────────────────────────────────────
function setupExport() {
  els.downloadPngBtn.addEventListener('click', () => doExport('png', false));
  els.downloadJpgBtn.addEventListener('click', () => doExport('jpg', false));
  els.downloadZipBtn.addEventListener('click', () => doExport('png', true));
}

async function doExport(format, asZip) {
  if (!state.result || !state.result.sheets.length) return;
  try {
    els.progressWrap.classList.add('visible');
    els.progressStatus.textContent = 'Exporting…';
    await exporter.exportSheets(state.result.sheets, {
      format,
      gridCols: state.result.gridCols,
      gridRows: state.result.gridRows,
      outputSize: state.result.outputSize,
      quality: state.jpgQuality,
      asZip: asZip || state.result.sheets.length > 1,
      includeIndividualFrames: els.includeFramesZip.checked,
      incompletePolicy: state.incompletePolicy,
      onProgress: (p) => {
        els.progressFill.style.width = `${p.percent || 0}%`;
        els.progressPercent.textContent = `${Math.round(p.percent || 0)}%`;
        els.progressStatus.textContent =
          p.phase === 'zipping' ? 'Creating ZIP…' : 'Exporting…';
      },
    });
    showAlert('success', 'Download started.');
  } catch (err) {
    showAlert('error', err.message || 'Export failed.');
  } finally {
    setTimeout(() => els.progressWrap.classList.remove('visible'), 600);
  }
}

// ── About ──────────────────────────────────────────────
function setupAbout() {
  els.aboutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    els.aboutModal.classList.add('open');
  });
  els.closeAboutBtn.addEventListener('click', () => els.aboutModal.classList.remove('open'));
  els.aboutModal.addEventListener('click', (e) => {
    if (e.target === els.aboutModal) els.aboutModal.classList.remove('open');
  });
}

// ── Init ───────────────────────────────────────────────
function init() {
  setupUpload();
  setupTimeline();
  setupModes();
  setupGridRes();
  setupGenerate();
  setupPreviewControls();
  setupExport();
  setupAbout();
  updateMemoryHint();
}

init();
