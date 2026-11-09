/**
 * VEGA Frame Grid Generator - Video Loader
 */

import { formatFileSize, formatDuration, getAspectRatio } from './utils.js';

export class VideoLoader {
  constructor() {
    this.video = null;
    this.objectUrl = null;
    this.file = null;
    this.metadata = null;
    this.onLoad = null;
    this.onError = null;
    this.onProgress = null;
  }

  async loadFile(file) {
    this.cleanup();

    if (!file || !file.type.startsWith('video/')) {
      throw new Error('File is not a supported video format. Please upload MP4, WebM, or MOV.');
    }

    this.file = file;
    this.objectUrl = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      const timeout = setTimeout(() => {
        cleanupListeners();
        reject(new Error('Video loading timed out. The file may be corrupted or use an unsupported codec.'));
      }, 30000);

      const cleanupListeners = () => {
        clearTimeout(timeout);
        video.onloadedmetadata = null;
        video.onerror = null;
        video.oncanplay = null;
      };

      video.onloadedmetadata = () => {
        cleanupListeners();

        if (!isFinite(video.duration) || video.duration <= 0) {
          this.cleanup();
          reject(new Error('Invalid video duration. The file may be corrupted.'));
          return;
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
          this.cleanup();
          reject(new Error('Unable to read video resolution. Codec may not be supported by this browser.'));
          return;
        }

        this.video = video;
        this.metadata = {
          name: file.name,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          duration: video.duration,
          durationFormatted: formatDuration(video.duration),
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: getAspectRatio(video.videoWidth, video.videoHeight),
          fps: null, // Not reliably available via HTML5 API
        };

        resolve(this.metadata);
      };

      video.onerror = () => {
        cleanupListeners();
        this.cleanup();
        const err = video.error;
        let msg = 'Failed to load video.';
        if (err) {
          switch (err.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              msg = 'Video loading was aborted.';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              msg = 'Network error while loading video.';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              msg = 'Video decoding failed. The codec may not be supported by this browser.';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              msg = 'Video format or codec is not supported by this browser. Try converting to MP4 (H.264) or WebM.';
              break;
            default:
              msg = 'Unknown video loading error.';
          }
        }
        reject(new Error(msg));
      };

      video.src = this.objectUrl;
    });
  }

  getVideoElement() {
    return this.video;
  }

  getMetadata() {
    return this.metadata;
  }

  getFile() {
    return this.file;
  }

  cleanup() {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.file = null;
    this.metadata = null;
  }

  isLoaded() {
    return !!this.video && !!this.metadata;
  }
}
