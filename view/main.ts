import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { basicSetup, EditorView } from "codemirror";
import { Compartment, Text } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { rust } from "@codemirror/lang-rust";
import { markdown } from "@codemirror/lang-markdown";
import { java } from "@codemirror/lang-java";
import { kotlin, csharp } from "@codemirror/legacy-modes/mode/clike";
import { oneDark } from "@codemirror/theme-one-dark";
import { runCloseFlow } from "./closeFlow";
import {
  CLOSE_BUTTONS,
  bootstrapPath,
  closeDecision,
  documentTitle,
  shouldClaim,
} from "./state";

const languages = [
  { name: "Rust", extensions: ["rs"], support: rust },
  { name: "Markdown", extensions: ["md", "markdown"], support: markdown },
  { name: "Kotlin", extensions: ["kt", "kts"], support: () => StreamLanguage.define(kotlin) },
  { name: "Java", extensions: ["java"], support: java },
  { name: "C#", extensions: ["cs"], support: () => StreamLanguage.define(csharp) },
];

const fileFilters = languages.map(({ name, extensions }) => ({ name, extensions }));

let currentPath: string | null = null;
// Set synchronously before replying to a claim and held until the claimed
// path finishes opening, so a second claim in flight is refused.
let claimInFlight = false;

const language = new Compartment();
const theme = new Compartment();

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

// Unknown or missing extensions fall back to Rust, the first entry.
function languageFor(path: string | null) {
  const ext = path?.split(".").pop()?.toLowerCase() ?? "";
  const lang = languages.find((l) => l.extensions.includes(ext)) ?? languages[0];
  return lang.support();
}

function themeFor(dark: boolean) {
  return dark ? oneDark : [];
}

const dirtyEl = document.querySelector<HTMLElement>("#dirty")!;

// The document as last opened or saved. Comparing against it (instead of a
// flag) means typing a change and undoing it clears the indicator again.
let savedDoc: Text;

function updateDirty() {
  dirtyEl.hidden = view.state.doc.eq(savedDoc);
}

function dirty(): boolean {
  return !view.state.doc.eq(savedDoc);
}

const view = new EditorView({
  parent: document.querySelector("#editor")!,
  doc: "",
  extensions: [
    basicSetup,
    language.of(languageFor(null)),
    theme.of(themeFor(prefersDark.matches)),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) updateDirty();
    }),
  ],
});

savedDoc = view.state.doc;

prefersDark.addEventListener("change", (e) => {
  view.dispatch({ effects: theme.reconfigure(themeFor(e.matches)) });
});

function setPath(path: string | null) {
  currentPath = path;
  document.querySelector("#path")!.textContent = path ?? "untitled";
  getCurrentWindow().setTitle(documentTitle(path)).catch(() => {});
  view.dispatch({ effects: language.reconfigure(languageFor(path)) });
}

async function showError(heading: string, detail: string) {
  await message(`${heading}\n\n${detail}`, { title: "Edytka", kind: "error" });
}

// Serialize opens: a claim or boot source arriving while another open is in
// flight queues behind it instead of racing to replace the document.
let openChain: Promise<void> = Promise.resolve();
function queueOpen(path: string): Promise<void> {
  openChain = openChain.then(() => openPath(path));
  return openChain;
}

// The single load entry point: read, replace the document, mark clean.
// On a read failure the buffer stays intact and an error dialog is shown.
async function openPath(path: string) {
  let text: string;
  try {
    text = await invoke<string>("read_file", { path });
  } catch (error) {
    await showError(`Could not open ${path}`, String(error));
    return;
  }
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
  savedDoc = view.state.doc;
  updateDirty();
  setPath(path);
}

async function openFile() {
  const path = await open({ filters: fileFilters });
  if (!path) return;
  await openPath(path);
}

// Returns true iff the document was written (or already saved); false keeps
// the window open. An untitled document goes through the save dialog — a
// cancelled dialog resolves false without touching anything.
async function saveFile(): Promise<boolean> {
  const path = currentPath ?? (await save({ filters: fileFilters }));
  if (!path) return false;
  // Capture the doc being written: edits made while the write is in flight
  // must still count as unsaved.
  const written = view.state.doc;
  try {
    await invoke("write_file", { path, contents: written.toString() });
  } catch (error) {
    await showError(`Could not save ${path}`, String(error));
    return false;
  }
  savedDoc = written;
  updateDirty();
  setPath(path);
  return true;
}

document.querySelector("#open")!.addEventListener("click", openFile);
document.querySelector("#save")!.addEventListener("click", () => {
  saveFile();
});

// Ctrl+S everywhere, Cmd+S on macOS. Listening on the window (not an editor
// keymap) means it works even when a button has focus.
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveFile();
  }
});

// Startup bootstrap. The order matters: attach the claim listener first (so a
// claim arriving during boot is captured), then the boot-time pull, then the
// initialization-script path used by spawned windows.
async function bootstrap() {
  const isMain = getCurrentWindow().label === "main";

  let claimedPath: string | null = null;
  if (isMain) {
    await listen<{ id: number; path: string }>(
      "file-open-claim",
      async (event) => {
        const { id } = event.payload;
        const claimed = shouldClaim(currentPath, dirty(), claimInFlight);
        if (claimed) claimInFlight = true;
        try {
          const ack = await invoke<string | null>("file_open_claim", {
            id,
            claimed,
          });
          // The backend confirms which path the claim resolved to; a stale
          // or late claim gets a null ack and opens nothing.
          if (claimed && ack) {
            claimedPath = ack;
            await queueOpen(ack);
          }
        } finally {
          if (claimed) claimInFlight = false;
        }
      },
    );
  }

  let pendingPath: string | null = null;
  if (isMain) {
    // Only the main window pulls the pending queue; spawned windows must not
    // steal a path destined for it.
    pendingPath = await invoke<string | null>("take_pending_open").catch(
      () => null,
    );
  }

  const initPath = (window as { __EDYTKA_OPEN_PATH?: string })
    .__EDYTKA_OPEN_PATH;
  const path = bootstrapPath(claimedPath, pendingPath, initPath ?? null);
  if (path) await queueOpen(path);

  if (currentPath === null) {
    getCurrentWindow().setTitle(documentTitle(null)).catch(() => {});
  }
}

bootstrap().catch((error) => {
  console.error("bootstrap failed", error);
});

// Close protection: clean windows close immediately; dirty windows prompt
// Save / Don't Save / Cancel. Quitting (Cmd+Q) does not go through this path
// and remains unprotected for v1.
getCurrentWindow().onCloseRequested(async (event) => {
  if (closeDecision(dirty()) === "destroy") {
    await getCurrentWindow().destroy();
    return;
  }
  // Must be called synchronously, before the first await.
  event.preventDefault();
  await runCloseFlow(true, {
    destroy: () => getCurrentWindow().destroy(),
    promptSave: async () => {
      const result = await message("Save changes before closing?", {
        title: documentTitle(currentPath),
        kind: "warning",
        buttons: { ...CLOSE_BUTTONS },
      });
      const choice = result?.toString().toLowerCase();
      if (choice === "yes" || choice === "no") return choice;
      return "cancel"; // dialog dismissed
    },
    save: saveFile,
  });
});
