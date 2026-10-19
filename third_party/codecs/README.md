# jSquash / MozJPEG corresponding source

`jsquash-source.zip` is the upstream source snapshot for `@jsquash/jpeg@1.6.0`, npm gitHead `1f62015f53e28bd18b2d7c8a3ca3326577efc445`:
https://github.com/jamsinclair/jSquash/tree/1f62015f53e28bd18b2d7c8a3ca3326577efc445

The encoder C++ source and build recipes are under `packages/jpeg/codec`. `tools/build-cpp.sh` and `tools/cpp.Dockerfile` describe the Emscripten 2.0.34 build environment. Its Makefile selects MozJPEG v3.3.1; the unmodified upstream C source is distributed alongside it as `mozjpeg-3.3.1-source.tar.gz`:
https://github.com/mozilla/mozjpeg/tree/v3.3.1

FORMA does not modify the native codec or bindings. The PDF encoder uses quality 97, full 4:4:4 chroma and progressive/optimized coding, without resizing. Image-tool settings remain separately defined in `src/lib/codecs.ts`. See package-lock.json for exact package integrity and THIRD_PARTY_NOTICES.md for Apache, IJG and native codec notices.

These archives are also directly available from the website under `third_party/codecs/`.
