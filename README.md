# VEGA Frame Grid Generator

**Part of VEGA UNIVERSE**

A professional, 100% browser-based **Video → Sprite Sheet** converter. Upload a video, extract frames with flexible modes, and export seamless square 1:1 grids as PNG, JPG, or ZIP.

- No backend · No API keys · No server FFmpeg
- Fully client-side (privacy-friendly)
- GitHub Pages ready (pure static files)
- Responsive (desktop / tablet / mobile)

## Features

- **Drag & drop** video upload (MP4, WebM, MOV)
- Three extraction modes:
  - **Normal** – even sampling to exactly fill the grid
  - **FPS** – extract at 1–60+ frames per second
  - **Interval** – custom time step between frames
- Timeline range (start / end) controls
- Grid sizes: 4×4, 8×8, 16×16, 32×32, or custom
- Output resolutions: 512 → 4096 px (or custom)
- Frame fit: Center Crop (default), Stretch, Contain
- Incomplete grid policies: Repeat last / Loop / Transparent
- Live preview with zoom, pan, grid overlay, frame numbers
- Multi-sheet support when frames exceed one grid
- Export PNG (lossless), JPG (quality slider), or ZIP (+ optional individual frames)

## Run Locally

No build step required. Just serve the folder with any static server:

```bash
# Python
python -m http.server 8080

# Node (if you have npx)
npx serve .

# VS Code Live Server, etc.
```

Then open `http://localhost:8080`.

Or open `index.html` directly in a modern browser (some browsers restrict modules from `file://`; a local server is recommended).

## Deploy to GitHub Pages

1. Create a repository (e.g. `vega-frame-grid`).
2. Upload / push the entire project (keep the folder structure).
3. In **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: `main` (or `gh-pages`), folder: `/ (root)`
4. The site will be available at `https://<user>.github.io/vega-frame-grid/`.

All paths are relative (`./src/...`), so it works on both root and project pages.

**Note:** JSZip is loaded from CDN (`cdn.jsdelivr.net`). An internet connection is needed for ZIP export. PNG/JPG single-file export works offline after the page has loaded.

## Project Structure

```
vega-frame-grid/
├── index.html
├── src/
│   ├── main.js
│   ├── styles.css
│   ├── videoLoader.js
│   ├── frameExtractor.js
│   ├── spriteSheet.js
│   ├── exportManager.js
│   └── utils.js
├── public/
│   └── assets/
├── package.json          # optional (for Vite if desired)
├── vite.config.js        # optional
├── README.md
└── .gitignore
```

## Optional: Vite Development

If you prefer hot-reload during development:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build   # output in dist/
```

Remember to set `base: './'` in `vite.config.js` for GitHub Pages.

## Technical Notes

- Frame extraction uses the HTML5 `<video>` element + Canvas 2D.
- Seeking is synchronized with the `seeked` event and a short decode wait.
- Exact frame-perfect capture is not guaranteed for every codec/browser (HTML5 limitation).
- Large canvases (4K+) may hit browser memory limits; a warning is shown.
- All processing stays in the browser; videos never leave the device.

## Default Settings

| Setting            | Default              |
|--------------------|----------------------|
| Extraction Mode    | Normal               |
| Grid               | 8 × 8                |
| Resolution         | 2048 × 2048          |
| Aspect / Fit       | Center Crop          |
| Export             | PNG                  |
| Incomplete Grid    | Repeat Last Frame    |

## License

MIT – free to use, modify, and host.
