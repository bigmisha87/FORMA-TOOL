# PDF regression corpus

These are fixed copies of the inputs described in `docs/PDF_COMPRESSION_BENCHMARK.md`, used to validate actual production-worker downloads, not just a research adapter.

Eight controlled files were created by `tests/pdf-benchmark/generate.py`. The photographic content is the NASA Eileen Collins photograph from scikit-image's public-domain `data.astronaut()` fixture; the mathematical graphics originate from FORMA's own image-test fixtures. Some PDFs embed the local Arial font as a document font; no standalone font file is distributed. `scan-ocr.pdf` deliberately combines an image with a pre-existing invisible text layer; it does not claim that compression performs OCR.

`tracemonkey.pdf` is the 14-page public test document from Mozilla PDF.js, downloaded from commit `98cfa3ec8781575f3aa9c698a53598dd498b4fb5`:
https://github.com/mozilla/pdf.js/blob/98cfa3ec8781575f3aa9c698a53598dd498b4fb5/test/pdfs/tracemonkey.pdf
SHA-256: `3662ff519e485810520552bf301d8c3b2b917fd2f83303f4965d7abed367e113`.

All files remain local during tests. The independent audit checks decoded ICC profile payloads, alpha masks, text positions, page geometry, forms, links, outlines, vector counts and complete-page Poppler renders. Byte-level input hashes are recorded in the research report.
