# Edytka

A minimal code and Markdown editor, built with Tauri.

Edytka outperforms TextEdit on large files — see the [performance comparison](docs/performance.md).

![Edytka](assets/edytka-sample.png)

## Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [Rust](https://www.rust-lang.org/tools/install) (via rustup)
- Tauri's platform dependencies — see [Tauri prerequisites](https://tauri.app/start/prerequisites/)

## Run

```sh
npm install
npm run tauri dev
```

This starts the Vite dev server on http://localhost:1420 and opens the app window with hot reload.

## Build

```sh
npm run tauri build
```

The bundles are written to `host/target/release/bundle/` (e.g. `macos/Edytka.app`). To build only the macOS app bundle:

```sh
npm run tauri build -- --bundles app
```
