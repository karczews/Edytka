# Tasks

## 1. File associations

- [x] 1.1 Add `bundle.fileAssociations` to `host/tauri.conf.json` with six entries (Markdown: `md`, `markdown`; Rust: `rs`; Kotlin: `kt`, `kts`; Java: `java`; C#: `cs`; Text: `txt` with `mimeType: text/plain`), all `role: "Editor"`, and verify `npx tauri build --bundles app` produces a bundle whose `Edytka.app/Contents/Info.plist` contains `CFBundleDocumentTypes` covering all eight extensions

## 2. Rust open-event plumbing

- [x] 2.1 In `host/src/lib.rs` add the pending-path queue as pure functions (push / claim / take / pop-for-spawn, no Tauri window types) plus a mutex-backed state and the `file_open_claim` and `take_pending_open` commands that use them, and verify `cargo check` in `host/` passes
- [x] 2.2 Match `RunEvent::Opened { urls }` in the `.run()` callback, convert each file URL with a pure `to_path` helper using `to_file_path()` (skip non-file URLs), and push onto the queue; when the `main` window exists, emit `file-open-claim` to it and spawn a window on refusal, a dead window, or a 1s timeout; when it does not exist yet (cold start), emit nothing and rely on the boot pull; verify `cargo check` passes
- [x] 2.3 Add a spawn-window helper using `WebviewWindowBuilder` with a unique `window-N` label, the configured window size, the document filename as title, and an `initialization_script` setting `window.__EDYTKA_OPEN_PATH` to the JSON-escaped path, and verify `cargo check` passes
- [x] 2.4 Set `windows` to `["main", "window-*"]` and add `core:window:allow-destroy` to `host/capabilities/default.json`; verify `npx tauri build --bundles app` still succeeds (schema validation runs during the build) and confirm spawned-window runtime behavior in task 6.1
- [x] 2.5 Add `#[cfg(test)]` unit tests for the queue/claim mechanics (FIFO order, claim pops once, take leaves nothing stale, timeout/refusal paths) and `to_path` (file URL → path, non-file URL rejected), and verify `cargo test` in `host/` passes

## 3. Frontend open-path flow

- [x] 3.1 In `view/main.ts` extract `openPath(path)` from `openFile()` (read, replace doc, update `savedDoc` and `setPath`) and show a native error dialog when the read fails, keeping the buffer intact; verify `npm run build` passes (tsc + vite)
- [x] 3.2 On startup, before anything else: register the `file-open-claim` listener (reply `claimed: true` only when untitled and not dirty — set an in-flight flag synchronously before replying to avoid double-claims — then load the file); in the `main` window only, call `take_pending_open()` and open a returned path (spawned windows must not pull the queue); then check `window.__EDYTKA_OPEN_PATH` and open it; verify `npm run build` passes and `npm run tauri dev` still opens an empty untitled window with no console errors
- [x] 3.3 Update `setPath` so each window's title is the filename (basename) or `untitled`, replacing the `Edytka <version>` title, and verify `npm run build` passes
- [x] 3.4 Create `view/state.ts` with pure, Tauri-free functions — `shouldClaim(path, dirty)`, the bootstrap precedence rule, `documentTitle(path)`, and the close-decision helper — and rewire `main.ts` to call them instead of inline logic; verify `npm run build` passes
- [x] 3.5 Add `vitest` and `happy-dom` as dev dependencies, a `"test": "vitest run"` script, and the vitest config; verify `npm test` executes the (initially empty) suite
- [x] 3.6 Write Vitest tests for `state.ts`: claim is true only when untitled and not dirty (pristine, dirty, document-loaded cases), the in-flight flag prevents a double-claim when two claim events arrive in one tick, bootstrap precedence picks the claim path then `take_pending_open` then `__EDYTKA_OPEN_PATH`, and `documentTitle` yields basename / `untitled`; verify `npm test` passes

## 4. Window close-protection

- [x] 4.1 Register `getCurrentWindow().onCloseRequested`: destroy immediately when clean; when dirty, prevent the close and show one native dialog (`message` with `buttons: { yes: "Save", no: "Don't Save", cancel: "Cancel" }`, `kind: "warning"`); Save runs the existing save flow (including the untitled save dialog — a cancelled dialog keeps the window open) then destroys; a failed write keeps the window open and shows an error dialog; Don't Save destroys; Cancel keeps the window; verify `npm run build` passes
- [x] 4.2 Write Vitest tests for the close flow via the close-decision helper with mocked dialog/window APIs: clean → destroy with no dialog; dirty → dialog shown and each button outcome (Save → save then destroy, Don't Save → destroy, Cancel → no destroy); a cancelled save dialog and a failed write both leave the window open; a completed save dialog (untitled) saves then destroys; verify `npm test` passes

## 5. CI workflow

- [ ] 5.1 Add `.github/workflows/ci.yml` running on `macos-latest` for every push/PR: `cargo test` in `host/`, `npm ci` + `npm test` + `npm run build`, and `npx tauri build --bundles app` with a `plutil` assertion that `CFBundleDocumentTypes` in the built `Info.plist` covers all eight extensions; verify the workflow runs green on this branch's PR

## 6. Integration verification (bundled app)

- [ ] 6.1 With `npx tauri build --bundles app` installed (re-register with `lsregister -f` if macOS caches a stale bundle), verify each spec scenario on the real app: "Open With" lists Edytka for `md` and `txt`; cold-start double-click shows the file in exactly one window; warm open while running opens a window; opening a file with a dirty untitled window preserves it and spawns a new window; multiple files at once open one window each; window titles show filename/untitled; close prompts Save/Don't Save/Cancel correctly for dirty windows, is silent for clean ones, and unreadable files show an error while the app stays usable; repeat the clean/dirty close checks and the title check in a spawned window (not `main`) to confirm the capability covers `window-*`
