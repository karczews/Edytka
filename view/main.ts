import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { basicSetup, EditorView } from "codemirror";
import { Compartment, Text } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { rust } from "@codemirror/lang-rust";
import { markdown } from "@codemirror/lang-markdown";
import { java } from "@codemirror/lang-java";
import { kotlin, csharp } from "@codemirror/legacy-modes/mode/clike";
import { oneDark } from "@codemirror/theme-one-dark";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";

const languages = [
  { name: "Rust", extensions: ["rs"], support: rust },
  { name: "Markdown", extensions: ["md", "markdown"], support: markdown },
  { name: "Kotlin", extensions: ["kt", "kts"], support: () => StreamLanguage.define(kotlin) },
  { name: "Java", extensions: ["java"], support: java },
  { name: "C#", extensions: ["cs"], support: () => StreamLanguage.define(csharp) },
];

const fileFilters = languages.map(({ name, extensions }) => ({ name, extensions }));

let currentPath: string | null = null;

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
  view.dispatch({ effects: language.reconfigure(languageFor(path)) });
}

async function openFile() {
  const path = await open({ filters: fileFilters });
  if (!path) return;
  const text = await invoke<string>("read_file", { path });
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  savedDoc = view.state.doc;
  updateDirty();
  setPath(path);
}

async function saveFile() {
  const path = currentPath ?? (await save({ filters: fileFilters }));
  if (!path) return;
  // Capture the doc being written: edits made while the write is in flight
  // must still count as unsaved.
  const written = view.state.doc;
  await invoke("write_file", { path, contents: written.toString() });
  savedDoc = written;
  updateDirty();
  setPath(path);
}

document.querySelector("#open")!.addEventListener("click", openFile);
document.querySelector("#save")!.addEventListener("click", saveFile);

// Ctrl+S everywhere, Cmd+S on macOS. Listening on the window (not an editor
// keymap) means it works even when a button has focus.
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveFile();
  }
});

async function setWindowTitle() {
  const version = await getVersion();
  await getCurrentWindow().setTitle(`Edytka ${version}`);
}

// In a plain browser (Vite without Tauri) the API is missing, so the title
// stays as set in index.html.
setWindowTitle().catch(() => {});
