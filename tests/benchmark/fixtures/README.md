# Benchmark fixture provenance

- `photo.png`, `bird.png`, `landscape.png`, `monkey.png`: losslessly converted from the Mozilla MozJPEG test corpus at https://github.com/mozilla/mozjpeg/tree/master/testimages, respectively `testorig.ppm`, `shira_bird8.bmp`, `vgl_5674_0098.bmp`, `monkey16.ppm`. Downloaded 2026-10-18. Upstream codec notices are included under `third_party/` and `THIRD_PARTY_NOTICES.md`.
- `astronaut.png`: scikit-image `data.astronaut()`, the NASA photograph of Eileen Collins. Public domain NASA image; source and description: https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut.
- `logo.png`, `logo-optimized.png`, `gradient-alpha.png`: deterministic FORMA test artwork, created with Pillow, Arial bitmap-rendered text, solid shapes and mathematical RGBA gradients. These contain no user assets. The first and third are deliberately uncompressed PNGs; the optimized logo is the same pixels saved with PNG optimization enabled.
- Animated GIFs are generated deterministically by `scripts/benchmark-compression.mjs` and the browser tests, with gifenc, no remote assets.

Committed fixtures make every test independent of third-party downloads. The baseline file is the actual previous FORMA processor, with only its common-module import adjusted.
