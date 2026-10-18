# Gifsicle source and build materials

The distributed browser worker contains Gifsicle 1.92, licensed under GPL-2.0-or-later, and the MIT browser wrapper from gifsicle-wasm-browser 1.5.19. The wrapper's MIT label does not replace the engine's GPL license.

Corresponding source and build materials are distributed alongside the worker on the website and in this repository:

- `gifsicle-1.92-source.zip`: upstream engine source, https://github.com/kohler/gifsicle/tree/v1.92
- `wasm-codecs-source.zip`: Gifsicle package and root notices from https://github.com/cyrilwanner/wasm-codecs/tree/89fb54b412e262832d61d9da5b4deb02ead184d4 (downloaded 2026-10-18). Its Dockerfile selects Gifsicle v1.92, Emscripten 1.39.18, and documents the configure adjustment. `build.sh` and `lib/pre.js` contain the WASM build instructions and glue.
- `browser-wrapper-source.zip`: https://github.com/renzhezhilu/gifsicle-wasm-browser/tree/7033183ee0db22bb339a878571d743b9642e1c77 (downloaded 2026-10-18). `src/build.js` embeds the WASM and worker; source, glue, and shipped WASM are included.
- `COPYING`: full GNU GPL version 2.

FORMA extracts the package's worker string without altering its engine. See `scripts/prepare-assets.mjs` and the exact npm versions/integrity hashes in `package-lock.json`. No `--lossy` option is enabled. The complete FORMA application source is publicly available at https://github.com/bigmisha87/FORMA-TOOL.
