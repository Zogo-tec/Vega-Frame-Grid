/**
 * VEGA Frame Grid Generator - Frame Extractor
 */

import {
  createSafeTimestamps,
  createFPSTimestamps,
  createIntervalTimestamps,
  clamp,
  sleep,
} from './utils.js';

export class FrameExtractor {
  constructor() {
    this.cancelled = false;
    this.workCanvas = null;
    this.workCtx = null;
  }

  cancel() {
    this.cancelled = true;
  }

  resetCancel() {
    this.cancelled = false;
  }

  isCancelled() {
    return this.cancelled;
  }

  ensureWorkCanvas(width, height) {
    if (!this.workCanvas) {
      this.workCanvas = document.createElement('canvas');
      this.workCtx = this.workCanvas.getContext('2d', {
        willReadFrequently: false,
        alpha: true,
      });
    }
    if (this.workCanvas.width !== width || this.workCanvas.height !== height) {
      this.workCanvas.width = width;
      this.workCanvas.height = height;
    }
    return { canvas: this.workCanvas, ctx: this.workCtx };
  }

  /**
   * Seek video to a specific time and wait for the frame to be ready.
   */
  async seekToTime(video, time, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (this.cancelled) {
        reject(new Error('Cancelled'));
        return;
      }

      const target = clamp(time, 0, Math.max(0, video.duration - 0.001));

      // Already close enough
      if (Math.abs(video.currentTime - target) < 0.02 && video.readyState >= 2) {
        resolve();
        return;
      }

      let settled = false;
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        clearTimeout(timer);
      };

      const onSeeked = () => {
        if (settled) return;
        settled = true;
        cleanup();
        // Small extra wait for some browsers to fully decode
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      };

      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Seek failed'));
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        // Resolve anyway with whatever frame is available
        resolve();
      }, timeoutMs);

      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);

      try {
        video.currentTime = target;
      } catch (e) {
        settled = true;
        cleanup();
        reject(e);
      }
    });
  }

  /**
   * Draw a single frame from video onto a canvas with the selected fit mode.
   */
  drawFrame(video, ctx, destX, destY, destW, destH, fitMode = 'crop') {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    ctx.save();

    if (fitMode === 'stretch') {
      ctx.drawImage(video, destX, destY, destW, destH);
    } else if (fitMode === 'contain') {
      const scale = Math.min(destW / vw, destH / vh);
      const dw = Math.round(vw * scale);
      const dh = Math.round(vh * scale);
      const dx = destX + Math.floor((destW - dw) / 2);
      const dy = destY + Math.floor((destH - dh) / 2);
      // Clear cell first for transparency / background
      ctx.clearRect(destX, destY, destW, destH);
      ctx.drawImage(video, dx, dy, dw, dh);
    } else {
      // Center crop (default)
      const scale = Math.max(destW / vw, destH / vh);
      const sw = destW / scale;
      const sh = destH / scale;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      ctx.drawImage(video, sx, sy, sw, sh, destX, destY, destW, destH);
    }

    ctx.restore();
  }

  /**
   * Generate list of timestamps based on extraction mode.
   */
  generateTimestamps(options) {
    const {
      mode = 'normal',
      startTime = 0,
      endTime,
      gridCols,
      gridRows,
      fps = 5,
      interval = 1,
      duration,
    } = options;

    const end = endTime ?? duration;
    const totalCells = gridCols * gridRows;

    if (mode === 'fps') {
      return createFPSTimestamps(startTime, end, fps);
    }
    if (mode === 'interval') {
      return createIntervalTimestamps(startTime, end, interval);
    }
    // Normal mode - even distribution for exact grid capacity
    return createSafeTimestamps(startTime, end, totalCells);
  }

  /**
   * Extract frames and build sprite sheet(s).
   * Returns array of { canvas, blob?, frameCount }
   */
  async extractAndBuild(options) {
    this.resetCancel();

    const {
      video,
      mode = 'normal',
      startTime = 0,
      endTime,
      gridCols = 8,
      gridRows = 8,
      outputSize = 2048,
      fitMode = 'crop',
      incompletePolicy = 'repeat', // 'repeat' | 'loop' | 'transparent'
      overflowPolicy = 'multi', // 'multi' | 'sample'
      fps = 5,
      interval = 1,
      onProgress = () => {},
      backgroundColor = null, // for JPG / non-transparent
    } = options;

    if (!video || !video.videoWidth) {
      throw new Error('No valid video loaded.');
    }

    const duration = video.duration;
    const end = Math.min(endTime ?? duration, duration);
    const start = clamp(startTime, 0, end);

    let timestamps = this.generateTimestamps({
      mode,
      startTime: start,
      endTime: end,
      gridCols,
      gridRows,
      fps,
      interval,
      duration,
    });

    if (timestamps.length === 0) {
      throw new Error('No frames to extract in the selected time range.');
    }

    const totalCells = gridCols * gridRows;
    const cellSize = Math.floor(outputSize / gridCols);
    // Ensure exact division - adjust output size if needed
    const actualOutputSize = cellSize * gridCols;

    // Handle overflow
    if (timestamps.length > totalCells && overflowPolicy === 'sample') {
      timestamps = createSafeTimestamps(start, end, totalCells);
    }

    // Handle underflow later per sheet

    const sheets = [];
    const totalFrames = timestamps.length;
    let frameIndex = 0;
    let sheetIndex = 0;

    // Ensure video is paused
    video.pause();

    while (frameIndex < totalFrames && !this.cancelled) {
      const sheetTimestamps = timestamps.slice(frameIndex, frameIndex + totalCells);
      const sheetCanvas = document.createElement('canvas');
      sheetCanvas.width = actualOutputSize;
      sheetCanvas.height = actualOutputSize;
      const sheetCtx = sheetCanvas.getContext('2d', { alpha: true });

      // Background
      if (backgroundColor) {
        sheetCtx.fillStyle = backgroundColor;
        sheetCtx.fillRect(0, 0, actualOutputSize, actualOutputSize);
      } else {
        sheetCtx.clearRect(0, 0, actualOutputSize, actualOutputSize);
      }

      const framesInThisSheet = sheetTimestamps.length;
      let lastFrameDrawn = null;

      for (let i = 0; i < totalCells; i++) {
        if (this.cancelled) break;

        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        const dx = col * cellSize;
        const dy = row * cellSize;

        let ts;
        if (i < framesInThisSheet) {
          ts = sheetTimestamps[i];
        } else {
          // Incomplete grid handling
          if (incompletePolicy === 'transparent') {
            // leave empty (already cleared)
            onProgress({
              phase: 'extracting',
              currentFrame: frameIndex + i + 1,
              totalFrames: Math.max(totalFrames, totalCells),
              sheetIndex,
              percent: Math.min(99, ((frameIndex + i + 1) / Math.max(totalFrames, 1)) * 100),
            });
            continue;
          } else if (incompletePolicy === 'loop' && framesInThisSheet > 0) {
            ts = sheetTimestamps[i % framesInThisSheet];
          } else {
            // repeat last
            if (lastFrameDrawn === null && framesInThisSheet > 0) {
              ts = sheetTimestamps[framesInThisSheet - 1];
            } else if (lastFrameDrawn !== null) {
              // just redraw last
              sheetCtx.drawImage(
                sheetCanvas,
                ((framesInThisSheet - 1) % gridCols) * cellSize,
                Math.floor((framesInThisSheet - 1) / gridCols) * cellSize,
                cellSize,
                cellSize,
                dx,
                dy,
                cellSize,
                cellSize
              );
              onProgress({
                phase: 'extracting',
                currentFrame: frameIndex + framesInThisSheet,
                totalFrames,
                sheetIndex,
                percent: Math.min(99, ((frameIndex + framesInThisSheet) / totalFrames) * 100),
              });
              continue;
            } else {
              continue;
            }
          }
        }

        try {
          await this.seekToTime(video, ts);
          if (this.cancelled) break;

          this.drawFrame(video, sheetCtx, dx, dy, cellSize, cellSize, fitMode);
          lastFrameDrawn = ts;
        } catch (err) {
          if (err.message === 'Cancelled') break;
          console.warn('Frame extract failed at', ts, err);
          // leave cell as is
        }

        onProgress({
          phase: 'extracting',
          currentFrame: frameIndex + Math.min(i + 1, framesInThisSheet),
          totalFrames,
          sheetIndex,
          percent: Math.min(99, ((frameIndex + Math.min(i + 1, framesInThisSheet)) / totalFrames) * 100),
        });

        // Yield to UI periodically
        if (i % 4 === 0) {
          await sleep(0);
        }
      }

      if (this.cancelled) {
        // Cleanup partial
        break;
      }

      sheets.push({
        canvas: sheetCanvas,
        frameCount: framesInThisSheet,
        sheetIndex,
        cellSize,
        outputSize: actualOutputSize,
      });

      frameIndex += totalCells;
      sheetIndex++;

      // If single sheet mode and we sampled, stop
      if (overflowPolicy === 'sample') break;
      // If normal mode we only wanted one sheet worth
      if (mode === 'normal') break;
    }

    if (this.cancelled) {
      throw new Error('Processing cancelled by user.');
    }

    onProgress({
      phase: 'done',
      currentFrame: totalFrames,
      totalFrames,
      sheetIndex: sheets.length,
      percent: 100,
    });

    return {
      sheets,
      totalExtracted: Math.min(timestamps.length, mode === 'normal' ? totalCells : timestamps.length),
      timestamps: timestamps.slice(0, mode === 'normal' ? totalCells : undefined),
      cellSize,
      outputSize: actualOutputSize,
      gridCols,
      gridRows,
    };
  }

  destroy() {
    this.cancel();
    this.workCanvas = null;
    this.workCtx = null;
  }
}
