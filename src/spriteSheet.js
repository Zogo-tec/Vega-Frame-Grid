/**
 * VEGA Frame Grid Generator - Sprite Sheet Preview Helpers
 */

export class SpriteSheetPreview {
  constructor(container) {
    this.container = container;
    this.wrapper = null;
    this.canvas = null;
    this.overlayCanvas = null;
    this.ctx = null;
    this.overlayCtx = null;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isPanning = false;
    this.lastX = 0;
    this.lastY = 0;
    this.showGrid = false;
    this.showNumbers = false;
    this.currentSheet = null;
    this.gridCols = 8;
    this.gridRows = 8;
    this.cellSize = 0;

    this._setup();
  }

  _setup() {
    this.container.innerHTML = '';
    this.container.classList.add('preview-container');
    this.container.style.cssText = 'flex:1;width:100%;height:100%;min-height:280px;position:relative;overflow:hidden;';

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'preview-wrapper';
    this.wrapper.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      cursor: grab;
      background: #0B0B10;
    `;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      image-rendering: pixelated;
      transform-origin: 0 0;
    `;

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      transform-origin: 0 0;
    `;

    this.wrapper.appendChild(this.canvas);
    this.wrapper.appendChild(this.overlayCanvas);
    this.container.appendChild(this.wrapper);

    this.ctx = this.canvas.getContext('2d');
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    this._bindEvents();
  }

  _bindEvents() {
    this.wrapper.addEventListener('mousedown', (e) => {
      this.isPanning = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.wrapper.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this._applyTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.wrapper.style.cursor = 'grab';
    });

    this.wrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom(delta, e.offsetX, e.offsetY);
    }, { passive: false });
  }

  setSheet(sheetData, gridCols, gridRows) {
    this.currentSheet = sheetData;
    this.gridCols = gridCols;
    this.gridRows = gridRows;
    this.cellSize = sheetData.cellSize;

    const src = sheetData.canvas;
    this.canvas.width = src.width;
    this.canvas.height = src.height;
    this.overlayCanvas.width = src.width;
    this.overlayCanvas.height = src.height;

    this.ctx.clearRect(0, 0, src.width, src.height);
    this.ctx.drawImage(src, 0, 0);

    this.fitToScreen();
    this._drawOverlay();
  }

  clear() {
    this.currentSheet = null;
    this.ctx && this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.overlayCtx && this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  zoom(factor, pivotX, pivotY) {
    const newScale = Math.min(8, Math.max(0.1, this.scale * factor));
    if (newScale === this.scale) return;

    // Zoom toward pointer
    const rect = this.wrapper.getBoundingClientRect();
    const mx = pivotX ?? rect.width / 2;
    const my = pivotY ?? rect.height / 2;

    this.offsetX = mx - (mx - this.offsetX) * (newScale / this.scale);
    this.offsetY = my - (my - this.offsetY) * (newScale / this.scale);
    this.scale = newScale;
    this._applyTransform();
  }

  zoomIn() {
    this.zoom(1.25);
  }

  zoomOut() {
    this.zoom(0.8);
  }

  fitToScreen() {
    if (!this.currentSheet) return;
    const rect = this.wrapper.getBoundingClientRect();
    const pad = 24;
    const scaleX = (rect.width - pad) / this.canvas.width;
    const scaleY = (rect.height - pad) / this.canvas.height;
    this.scale = Math.min(scaleX, scaleY, 1);
    this.offsetX = (rect.width - this.canvas.width * this.scale) / 2;
    this.offsetY = (rect.height - this.canvas.height * this.scale) / 2;
    this._applyTransform();
  }

  setShowGrid(show) {
    this.showGrid = show;
    this._drawOverlay();
  }

  setShowNumbers(show) {
    this.showNumbers = show;
    this._drawOverlay();
  }

  _applyTransform() {
    const t = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
    this.canvas.style.transform = t;
    this.overlayCanvas.style.transform = t;
  }

  _drawOverlay() {
    if (!this.overlayCtx || !this.currentSheet) return;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;
    this.overlayCtx.clearRect(0, 0, w, h);

    if (!this.showGrid && !this.showNumbers) return;

    const cols = this.gridCols;
    const rows = this.gridRows;
    const cell = this.cellSize;

    this.overlayCtx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
    this.overlayCtx.lineWidth = Math.max(1, 1 / this.scale);
    this.overlayCtx.font = `${Math.max(10, cell * 0.18)}px Inter, system-ui, sans-serif`;
    this.overlayCtx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.textBaseline = 'middle';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cell;
        const y = r * cell;
        if (this.showGrid) {
          this.overlayCtx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
        if (this.showNumbers) {
          const num = r * cols + c + 1;
          this.overlayCtx.fillText(String(num), x + cell / 2, y + cell / 2);
        }
      }
    }
  }

  getScale() {
    return this.scale;
  }
}
