# AGENTS.md

Tauri v2 app: `view/` (Vite+TS frontend, entry `view/main.ts` via `index.html` → `dist/`) + `host/` (Rust backend, real logic in `host/src/lib.rs`; `main.rs` just calls `edytka_lib::run()`).

## Commands

- Setup: `npm ci` (Node 22 per CI). Dev: `npm run tauri dev` (Vite on `:1420`, `strictPort: true`; Vite ignores `host/`).
- Frontend verify: `npm test` (`vitest run`, only `view/**/*.test.ts`, `happy-dom`); single file: `npx vitest run view/<name>.test.ts`. Then `npm run build` (`tsc && vite build`; `tsconfig` includes only `view`, `strict` + `noUnusedLocals/Params` — unused vars fail build).
- Rust: `(cd host && cargo test)`; single test: `(cd host && cargo test <name>)`.
- Full local check (mirrors CI order): `npm test` → `npm run build` → `(cd host && cargo test)` → `npm run tauri build -- --bundles app` (fast bundle check; bundles land in `host/target/release/bundle/`).
- No linter/formatter (no eslint/prettier/clippy config) — don't add one unasked.

## Quirks that break builds

- `host/tauri.conf.json` is source of truth for bundling: `version` reads `../package.json`, `frontendDist` is `../dist`, `beforeBuildCommand` is `npm run build`. Never bump versions by hand — release-please syncs `package.json` → `host/Cargo.toml` + `package-lock.json` (see `release-please-config.json`).
- macOS ad-hoc sign only: `bundle.macOS.signingIdentity: "-"`, no notarization. First launch is Gatekeeper-blocked by design.
- `host/target/`, `host/gen/schemas/`, `dist/` are gitignored build output (`Cargo.lock` IS committed — it's an app). Don't edit generated schemas.
- Adding a file type touches 3 places or it silently regresses: `languages` in `view/main.ts`, `fileAssociations` in `host/tauri.conf.json`, and the `Info.plist` extension loop in `.github/workflows/ci.yml`. Unknown extensions fall back to Rust highlighting (first entry in `languages`).

## File-open / window model (don't simplify)

- OS files arrive via `RunEvent::Opened` → `PendingPaths` queue → claim protocol (`offer_claim`, `file_open_claim`, `take_pending_open`, 1s reply timeout). Cold start queues everything; `Ready` handler spawns overflow windows, main window boot-pulls one path. Spawned windows get their file via `window.__EDYTKA_OPEN_PATH` init script. Late/duplicate claim replies must be no-ops.
- Frontend bootstrap order in `view/main.ts` matters: claim listener → `take_pending_open` (main window only) → init-script path (`bootstrapPath` precedence: claim > pending > init script). Opens serialize through `queueOpen`.
- Keep pure decision logic in `view/state.ts` / `view/closeFlow.ts` (no Tauri/DOM imports) so it stays unit-testable; `Cmd+Q` quit bypasses close protection by design (v1).

## CI / release

- CI (`ci.yml`, `macos-latest`, on PR + `main`): `npm ci` → `npm test` → `npm run build` → `cargo test` (in `host`) → `tauri build --bundles app` → plist file-association assert.
- Commits must be Conventional Commits — release-please cuts versions from them: `fix:`/`perf:` patch, `feat:` minor, `+/BREAKING CHANGE:` major; `ci:`/`chore:`/`docs:` trigger no release. Use bare `ci:` (not `fix(ci):`) for CI-only changes to avoid an unwanted version bump.
- Branches use the same type prefix: `<type>/<short-kebab>` (e.g. `chore/init-agents`, `ci/dmg-artifact`), branched from `main`.
- Release (`release.yml`): push to `main` opens/updates a release-please PR (auto-merges if repo allows); merging it tags `vX.Y.Z` and `release-macos` builds `--target universal-apple-darwin` and attaches `.dmg` + `.app.tar.gz`.

## Spec docs

- For `openspec/` artifacts follow `openspec/AGENTS.md` (diagram-first, Mermaid before prose).
