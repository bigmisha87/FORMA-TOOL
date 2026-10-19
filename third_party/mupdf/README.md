# MuPDF 1.28.1 corresponding source

FORMA uses the official `mupdf@1.28.1` npm package, without modifications to MuPDF. The complete application is distributed under AGPL-3.0-or-later. Library copyrights and licenses remain with their authors.

`mupdf-1.28.1-source.tar.gz` is the unmodified complete upstream source release, including third-party sources and `platform/wasm` JavaScript bindings/build instructions. Its `platform/wasm/package.json` identifies npm version 1.28.1.

Upstream archive: https://github.com/ArtifexSoftware/mupdf-downloads/releases/download/1.28.1/mupdf-1.28.1-source.tar.gz

Rebuild instructions are in `platform/wasm/README.md`, `platform/wasm/Makefile` and `platform/wasm/tools/build.sh` within the archive. Use Emscripten and the bundled source dependencies as documented there. No local patches are applied. Package version/integrity is pinned in FORMA's `package-lock.json`.

The same archive is served at `third_party/mupdf/mupdf-1.28.1-source.tar.gz` on the website. `forma-source.zip` provides FORMA's application source and build scripts; `LICENSE.txt` contains the full AGPL license. Source is also available at https://github.com/bigmisha87/FORMA-TOOL.
