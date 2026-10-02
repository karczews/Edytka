# Tasks

## 1. Backend: report file size

- [x] 1.1 Change `read_file` in `host/src/lib.rs` to return `{ text, size }`, with `size` from `std::fs::metadata` on the path, and verify `(cd host && cargo test)` passes
- [x] 1.2 Add a host unit test that `read_file` on a temporary file returns its exact byte length, and verify `(cd host && cargo test read_file)` passes

## 2. Frontend: threshold decision logic

- [x] 2.1 Add `LARGE_FILE_BYTES` (20 × 1024 × 1024) and `isLargeFile(size)` to `view/state.ts` with unit tests covering above, exactly at, and below the boundary, and verify `npx vitest run view/state.test.ts` passes

## 3. Frontend: wiring and indicator

- [x] 3.1 Update the `invoke` in `openPath` to the new `{ text, size }` shape, decide the mode with `isLargeFile`, and reconfigure the `language` Compartment to plain text for large files, and verify `npm run build` (strict tsc) passes
- [x] 3.2 Make `setPath` respect the mode so title updates and saves do not restore highlighting, and verify `npm test` and `npm run build` pass
- [x] 3.3 Add a hidden header span to `index.html` (`large file · highlighting off`) shown only in large-file mode and cleared for normal files, and verify manually with `npm run tauri dev`: a >20 MiB `.md` file shows no highlighting and the indicator, a smaller file restores highlighting and hides it

## 4. Integration check

- [x] 4.1 Run the full local check in CI order — `npm test`, `npm run build`, `(cd host && cargo test)`, `npm run tauri build -- --bundles app` — and verify all pass
