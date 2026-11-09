/**
 * VEGA Frame Grid Generator - Export Manager
 * Uses global JSZip (loaded from CDN) when available.
 */

import { downloadBlob } from './utils.js';

function getJSZip() {
  if (typeof JSZip !== 'undefined') return JSZip;
  throw new Error('JSZip library not loaded. Please check your internet connection or include the script.');
}

export class ExportManager {
  constructor() {
    this.jpgQuality = 0.95;
  }

  setJpgQuality(q) {
    this.jpgQuality = Math.min(1, Math.max(0.01, q / 100));
  }

  async canvasToBlob(canvas, format = 'png', quality = 0.95) {
    return new Promise((resolve, reject) => {
      const mime = format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const q = mime === 'image/jpeg' ? quality : undefined;

      if (mime === 'image/jpeg') {
        const temp = document.createElement('canvas');
        temp.width = canvas.width;
        temp.height = canvas.height;
        const ctx = temp.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, temp.width, temp.height);
        ctx.drawImage(canvas, 0, 0);
        temp.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create JPEG blob'))),
          mime,
          q
        );
      } else {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create PNG blob'))),
          mime
        );
      }
    });
  }

  buildFilename(gridCols, gridRows, outputSize, index, format = 'png') {
    const ext = format === 'jpg' || format === 'jpeg' ? 'jpg' : 'png';
    const num = String(index + 1).padStart(3, '0');
    return `VEGA_Grid_${gridCols}x${gridRows}_${outputSize}px_${num}.${ext}`;
  }

  async exportSheets(sheets, options = {}) {
    const {
      format = 'png',
      gridCols = 8,
      gridRows = 8,
      outputSize = 2048,
      quality = 95,
      asZip = false,
      includeIndividualFrames = false,
      incompletePolicy = 'repeat',
      onProgress = () => {},
    } = options;

    this.setJpgQuality(quality);

    if (sheets.length === 0) {
      throw new Error('No sprite sheets to export.');
    }

    // Single file, no zip
    if (!asZip && sheets.length === 1 && !includeIndividualFrames) {
      onProgress({ phase: 'exporting', percent: 50 });
      const blob = await this.canvasToBlob(sheets[0].canvas, format, this.jpgQuality);
      const name = this.buildFilename(gridCols, gridRows, outputSize, 0, format);
      downloadBlob(blob, name);
      onProgress({ phase: 'done', percent: 100 });
      return { files: 1 };
    }

    const JSZipCtor = getJSZip();
    const zip = new JSZipCtor();
    const folder = zip.folder('VEGA_Frame_Grid');

    for (let i = 0; i < sheets.length; i++) {
      onProgress({
        phase: 'exporting',
        current: i + 1,
        total: sheets.length,
        percent: ((i + 1) / sheets.length) * 80,
      });
      const blob = await this.canvasToBlob(sheets[i].canvas, format, this.jpgQuality);
      const name = this.buildFilename(gridCols, gridRows, outputSize, i, format);
      folder.file(name, blob);
    }

    if (includeIndividualFrames) {
      const framesFolder = folder.folder('frames');
      let frameNum = 1;
      for (let s = 0; s < sheets.length; s++) {
        const sheet = sheets[s];
        const cell = sheet.cellSize;
        const cols = gridCols;
        const rows = gridRows;
        const src = sheet.canvas;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (idx >= sheet.frameCount && incompletePolicy === 'transparent') {
              continue;
            }
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = cell;
            frameCanvas.height = cell;
            const fctx = frameCanvas.getContext('2d');
            fctx.drawImage(src, c * cell, r * cell, cell, cell, 0, 0, cell, cell);
            const fblob = await this.canvasToBlob(frameCanvas, format, this.jpgQuality);
            const fname = `frame_${String(frameNum).padStart(4, '0')}.${format === 'jpg' ? 'jpg' : 'png'}`;
            framesFolder.file(fname, fblob);
            frameNum++;
          }
        }
      }
    }

    onProgress({ phase: 'zipping', percent: 90 });
    const zipBlob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (meta) => {
        onProgress({
          phase: 'zipping',
          percent: 90 + (meta.percent || 0) * 0.1,
        });
      }
    );

    const zipName = `VEGA_Grid_${gridCols}x${gridRows}_${outputSize}px.zip`;
    downloadBlob(zipBlob, zipName);
    onProgress({ phase: 'done', percent: 100 });
    return { files: sheets.length, zip: true };
  }
}
