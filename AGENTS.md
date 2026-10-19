# FORMA development notes

- Preserve Hebrew as the default language and RTL layout. Keep English translations complete.
- Open directly on the tools for daily use. Keep introductions and general explanations in Help or below the workspace, never in a hero section above the tools.
- Use golden yellow accents with white, black and neutral grays in both light and dark themes. Do not reintroduce the previous green palette.
- Primary action buttons must display the selected operation's name, for both image and PDF tools, in the active language.
- Indicate the active tool through its color highlight; do not add a redundant checkmark to tool buttons.
- Process user files locally. Do not add file uploads, accounts, telemetry or external processing services without an explicit request.
- Keep originals untouched, report actual output sizes and dimensions, and never claim guaranteed lossless compression for PNG/GIF color quantization or rasterized PDF compression.
- GitHub Pages is enabled by the owner. The workflow must not enable it itself. The expected site is `https://bigmisha87.github.io/FORMA-TOOL/`.
- Test meaningful file changes through downloaded output, not only success messages. Run `npm test`, the relevant browser tests, `npm run build`, and `npm run test:production` when processing, workers, dependencies or deployment paths change. Optional full browser matrix: `npm run test:browsers`.
- Compression uses MozJPEG (standard quantization, fixed 4:2:0), Oxipng (alpha optimization off), and Gifsicle -O2 --careful. PNG/GIF default to all colors (colors=0). Do not silently enable lossy palette reduction. Keep the codec source archives and notices in the published build. Run the old/new benchmark and independent quality audit when changing codec settings; see docs/COMPRESSION_BENCHMARK.md.
- The PNG encoder uses the ESM-compatible `@pdf-lib/upng` fork. Check both development and compiled worker builds when changing encoders.

## Misha's media generation rules

Each image/video/audio generation request authorizes one generation attempt only, unless an explicit number is requested. Do not reroll, correct, replace, insert or submit a paid alternative after imperfect output without explicit approval for the additional attempt. Preserve and individually inspect the original result; failed QA is a reason to report findings and stop. Do not autonomously edit or assemble generated media.

Never chain GPT image corrections or use a failed render as the base of another edit. An additionally authorized fresh attempt must use the original approved character, location and prop anchors and a complete scene prompt. Inspect sharpness, style, anatomy, glasses, hands, prop identity, orientation and continuity yourself. Recurring objects and rooms require fixed approved anchors with documented scale, construction, placement and layout; compare consecutive appearances at the same display scale. Never explain furniture changes as camera movement without verifying physical geometry.

If working in After Effects with computer control, dismiss ordinary blocking informational dialogs yourself. Do not automatically approve saves, deletion or consequential choices.

- PDF compression uses the official MuPDF 1.28.1 package and a project-owned worker, with MozJPEG quality 97/full chroma for eligible photographic streams. Preserve text and image dimensions. Keep fonts complete for AcroForm documents and reject digital signatures. Retain the AGPL license, prominent source download, native source archives and source/build scripts. Do not reintroduce rasterized-page compression or research-only pdf-optimizer/sharp dependencies. Run scripts/check-pdf-production.py on actual downloaded results when changing the engine.
