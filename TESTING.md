# FORMA validation

Validated locally on 18 October 2026. Tests use deterministic synthetic fixtures and a small, attributed photographic corpus; no user files or external processing services are involved.

## Checks

- TypeScript check and Vite production build.
- 14 unit tests for landscape/portrait fitting, optional enlargement, stretching, invalid dimensions, canvas limits, PDF range parsing, units and filenames.
- 53 browser scenarios in Chrome, Firefox and WebKit (159 executions).
- Production build smoke test mounted at `/FORMA-TOOL/`, matching GitHub Pages. It verifies the compiled image worker, local PDF.js worker/resources, all three compiled image codecs (MozJPEG, Oxipng, Gifsicle), and a downloaded PDF’s page count and rotation. It rejects runtime errors and failed HTTP requests.
- Automated axe WCAG A/AA checks on the initial image workspace in both light and dark modes. These checks complement keyboard and visual review; they are not a comprehensive accessibility certification.
- Manual screenshot review of desktop Hebrew, mobile Hebrew, English dark mode and populated PDF workspace.

## What the browser scenarios inspect

| Area | Assertions |
| --- | --- |
| JPEG compression | Download decodes; maximum target of 20 KB is respected; requested 40% reduction is reflected in actual bytes |
| Resize | Portrait/landscape ratios, exact unlocked dimensions, single-file selection in a batch |
| Conversion | JPEG, PNG, WebP and GIF magic bytes, decoded dimensions and transparency; white background for JPEG |
| PNG | Independent PNG decoding verifies every raw RGBA value in logos, text and partial transparency; compression does not increase file size |
| GIF | All frames, colors, dimensions, frame delays and loop count survive resizing; compression tests compare full displayed frames with disposal 1/2/3 and transparency |
| ZIP and CSV | Actual ZIP entries decode, duplicate filenames become unique, CSV measures source files and guards formula-leading filenames |
| PDF organize | Real output page count, width/order, rotation, deletion, merging and selected range |
| PDF split | ZIP contains individual one-page PDFs with the expected source dimensions |
| PDF to images | Download contains an actual JPEG with expected 150 DPI dimensions |
| PDF compression | Both modes preserve native text, geometry, links, forms and outlines in nine fixed PDFs. Independent Poppler/QPDF/Python checks verify lossless pixels or SSIM >= 0.99, ICC/alpha payloads and vector operations; signed PDFs and failed codec downloads are tested |
| Images to PDF | Output pages retain both portrait and landscape proportions |
| Interface | Hebrew RTL by default, English LTR, saved dark/startup preferences, mobile page overflow, keyboard dismissal of help |
| Errors | Invalid image/PDF, invalid dimensions, invalid page range, recovery for a subsequent valid file |
| Network | No third-party network requests while opening the workspaces; processing code uses local File/Blob data |

See [the measured compression comparison](docs/COMPRESSION_BENCHMARK.md) for the old/new engine comparison, independent Pillow animation/pixel checks, JPEG SSIM/PSNR, and reproduction commands. Failed codec downloads are also tested.

## Reproduce

```sh
npm ci
npm test
npx playwright install chrome
npm run test:e2e
npm run build
npm run test:production

# Optional full browser matrix
npx playwright install firefox webkit
npm run test:browsers
```

The GitHub workflow reruns unit tests, Chrome browser scenarios, the full old/new benchmark with its independent Python quality assertions, the production build and the production smoke test before publishing. The test report is stored as a workflow artifact. A separate manual Firefox/WebKit run is supported locally.

The fixtures exercise the listed operations; unusual or damaged documents, every possible GIF disposal combination, color management profiles, very large files on every device, interactive PDF forms and digital signatures are not exhaustively covered. Product limits and output behavior are documented in the in-app help and README.

The current PDF engine implementation, exact byte comparisons and license/source distribution are described in [PDF_COMPRESSION_IMPLEMENTATION.md](docs/PDF_COMPRESSION_IMPLEMENTATION.md).
