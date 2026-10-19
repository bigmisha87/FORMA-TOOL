# FORMA source and license

FORMA's project-authored code is licensed under **AGPL-3.0-or-later**, with the complete license in [LICENSE](LICENSE). Copyright 2026 FORMA contributors. Third-party authors retain their own copyrights and licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The website footer provides the AGPL license, a download of the application's source and a link to this repository. The complete editable application source, dependency lockfile, build scripts and tests are public at https://github.com/bigmisha87/FORMA-TOOL. The `forma-source.zip` download is generated from the current checkout at build time. Build with Node.js 24: `npm ci`, then `npm run build`.

Native codec source archives are supplied separately on the same website and in the repository:

- `third_party/mupdf/mupdf-1.28.1-source.tar.gz`: complete MuPDF sources, third-party sources and WASM build tooling. SHA-256 `dc94c60b2537e2ac9a2d379dd3801545f84a3a302d15c9da358362a1270707c3`.
- `third_party/codecs/jsquash-source.zip` and `mozjpeg-3.3.1-source.tar.gz`: jSquash encoder bindings/build scripts and MozJPEG source.
- `third_party/gifsicle/`: Gifsicle engine source, browser wrapper, WASM build materials and GPL license.

Their README files give upstream URLs, versions and build instructions. No native-library patches are applied by FORMA. Other JavaScript dependencies and local font assets are pinned by package-lock.json and included via npm; library notices and original license texts are retained. The research-only pdf-optimizer/sharp/Vite dependency tree is not part of the distributed application.

Direct website paths are relative to https://bigmisha87.github.io/FORMA-TOOL/. No source downloads require registration or a payment.
