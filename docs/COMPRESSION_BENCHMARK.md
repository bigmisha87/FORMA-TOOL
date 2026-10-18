# Compression benchmark — 18 October 2026

Compared against the actual pre-integration FORMA engine at commit `6eb9edc` (snapshot in `tests/benchmark/image-legacy.ts`). Chrome on Windows, local files, identical dimensions, no user uploads. Timing includes initialization and is illustrative, not a performance promise.

## JPEG: same requested 40% reduction

Inputs were decoded from the committed photo fixtures and encoded once at Canvas JPEG quality 0.96, then processed by each engine with the same 40% reduction request. Quality is measured against that decoded JPEG input, not the pristine camera original. SSIM uses scikit-image's per-channel RGB structural similarity; PSNR uses the same RGB pixels. Higher is better. All output dimensions remained unchanged. Both outputs meet the same byte ceiling; their sizes are close, not artificially forced to be identical.

| Fixture | Original bytes | Old Canvas bytes | MozJPEG bytes | Old SSIM | New SSIM | Old / new PSNR dB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| photo | 9,299 | 5,557 | 5,524 | 0.973356 | 0.985497 | 38.927 / 41.324 |
| bird | 19,617 | 11,663 | 11,328 | 0.969272 | 0.975718 | 33.873 / 35.027 |
| landscape | 13,326 | 7,892 | 7,980 | 0.980246 | 0.983708 | 27.271 / 28.164 |
| monkey | 22,592 | 13,394 | 13,392 | 0.957086 | 0.967216 | 34.678 / 36.345 |
| astronaut | 108,432 | 62,180 | 63,955 | 0.972947 | 0.975596 | 38.832 / 39.124 |

MozJPEG saves 40–42% against these inputs and improves SSIM on all five examples versus the old engine. It is not always smaller than the old output: both are searching for a byte target, and integer quality steps leave different unused budgets. This is a quality improvement at a similar size, not a claim of universal extra size savings. JPEG is still lossy. Very low targets can cause visible degradation or dimension reduction.

The initial codec defaults regressed on the dense-detail fixture. The tested settings use the standard quantization table (`quant_table: 0`), fixed 4:2:0 sampling, progressive output and optimized coding. See the native-scale [visual comparison](compression-comparison.png). The images were visually reviewed as well as measured.

## PNG: preserving pixels versus reducing colors

Oxipng receives the original PNG bytes, not a Canvas round trip. Its alpha optimization is disabled. Independent Pillow decoding confirms every RGBA sample is identical in all four outputs, including partially transparent pixels. The browser regression tests use a separate PNG decoder (`pngjs`).

| Fixture | Original bytes | Old 128-color default | Old without quantization | New lossless | Savings vs old without quantization |
| --- | ---: | ---: | ---: | ---: | ---: |
| logo | 1,076,040 | 4,208 | 4,611 | 3,952 | 14.3% |
| gradient-alpha | 1,076,040 | 14,132 | 322,991 | 16,054 | 95.0% |
| astronaut | 440,418 | 101,779 | 440,418 | 420,607 | 4.5% |
| logo-optimized | 8,229 | 4,208 | 4,611 | 3,952 | 14.3% |

The gradient and logo fixtures include uncompressed PNG inputs to exercise optimization; `logo-optimized` and the NASA photo are already compressed inputs. The old lossless path includes Canvas conversion and can change low-alpha RGB values. The old 128-color path can be smaller, especially for photos, because it discards colors. The new default prioritizes exact pixels; optional palette reduction remains available. An already smaller original is returned unchanged.

## GIF: lossless animation optimization

Eight-frame deterministic animations exercise disposal 1, 2 and 3, changed areas, transparent backgrounds, varying 80–220 ms delays and a finite loop count of 2. Gifsicle uses `-O2 --careful`, without `--lossy` or palette reduction by default. Independent Pillow compositing and the browser tests compare the displayed RGBA of every frame, delays and loop count.

| Fixture | Original bytes | Old default bytes | New bytes | Savings vs old | Exact animation |
| --- | ---: | ---: | ---: | ---: | --- |
| animation-disposal-1 | 3,992 | 3,944 | 1,466 | 62.8% | Yes |
| animation-disposal-2 | 3,992 | 3,944 | 858 | 78.2% | Yes |
| animation-disposal-3 | 3,992 | 3,944 | 858 | 78.2% | Yes |

The old 256-color variant produced the same byte counts on these limited-palette animations. These are regression examples, not a comprehensive GIF corpus. Resize still resamples and re-encodes; exact-pixel guarantees here concern compression at unchanged dimensions with all colors preserved.

## Reproduce

Run the benchmark with its temporary local Vite server:

```sh
npm ci
npm run benchmark
python -m pip install -r tests/benchmark/requirements.txt
python scripts/measure-compression.py
```

The Python audit asserts JPEG SSIM does not regress on this corpus, all new results are no bigger than their source, PNG RGBA equality, and exact GIF animation/timing/loops. Machine-readable results, including timing and old pixel differences, are in [compression-benchmark.json](compression-benchmark.json). The old and new engines run against the same in-memory files. Baseline results must not be used as a universal guarantee for arbitrary images, ICC profiles, metadata, huge inputs or every browser's JPEG decoder.

The WASM codecs are slower than native Canvas JPEG: these small samples took roughly 67–419 ms versus 4–41 ms in the old engine. Image processing runs in a worker where supported. Codec files and all processing remain local to the website/device.
