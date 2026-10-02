use std::collections::VecDeque;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State, Url, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("{path}: {e}"))
}

/// Paths handed to Edytka by the OS, waiting to be opened in a window.
/// All mutation goes through the methods below (push / pop / pop_if_front).
#[derive(Default)]
struct PendingPaths(Mutex<VecDeque<String>>);

impl PendingPaths {
    fn push(&self, path: String) {
        self.0.lock().unwrap().push_back(path);
    }

    /// `take`/`pop-for-spawn`: take the next path off the front of the queue.
    fn pop(&self) -> Option<String> {
        self.0.lock().unwrap().pop_front()
    }

    /// Pop the front path only if it still matches, guarding against a stale
    /// claim resolving out of order. On mismatch the queue is left untouched.
    fn pop_if_front(&self, path: &str) -> Option<String> {
        let mut queue = self.0.lock().unwrap();
        if queue.front().map(String::as_str) == Some(path) {
            queue.pop_front()
        } else {
            None
        }
    }

    fn len(&self) -> usize {
        self.0.lock().unwrap().len()
    }
}

/// A claim offered to the main window: unique id, the path, and a channel the
/// frontend's reply resolves. Claims resolve FIFO, matching the order the
/// `file-open-claim` events are emitted.
#[derive(Default)]
struct PendingClaims(Mutex<VecDeque<PendingClaim>>);

struct PendingClaim {
    id: u64,
    path: String,
    tx: mpsc::Sender<bool>,
}

/// True once `RunEvent::Ready` has fired; used to tell a true cold start
/// (before the config `main` window exists) from "main was closed later".
static READY: AtomicBool = AtomicBool::new(false);

fn next_claim_id() -> u64 {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    COUNTER.fetch_add(1, Ordering::Relaxed)
}

/// Convert an OS-delivered URL to a file path; non-`file:` URLs are dropped.
fn to_path(url: &Url) -> Option<String> {
    (url.scheme() == "file")
        .then(|| url.to_file_path().ok())
        .flatten()
        .map(|p| p.to_string_lossy().into_owned())
}

/// Resolve a claim from the frontend reply: `claimed: true` returns the path
/// for the frontend to open (the queue entry is consumed by the waiter);
/// `claimed: false` returns nothing (the waiter pops and spawns). Unknown or
/// already-resolved ids (e.g. the reply arrived after the 1s timeout) are a
/// no-op so a late reply can never open a path twice.
#[tauri::command]
fn file_open_claim(claims: State<PendingClaims>, id: u64, claimed: bool) -> Option<String> {
    let mut queue = claims.0.lock().unwrap();
    let index = queue.iter().position(|c| c.id == id);
    let Some(index) = index else {
        return None;
    };
    let claim = queue.remove(index).unwrap();
    let _ = claim.tx.send(claimed);
    if claimed { Some(claim.path) } else { None }
}

/// Boot-time pull for the main window: take the next unclaimed path, if any.
#[tauri::command]
fn take_pending_open(paths: State<PendingPaths>) -> Option<String> {
    paths.pop()
}

/// Offer the first path of a warm open to the main window. The frontend
/// replies through `file_open_claim`; if it refuses (or never replies within
/// 1s), the path is popped and opened in a spawned window instead.
fn offer_claim(app: &AppHandle, path: String) {
    let main = app.get_webview_window("main");
    let Some(main) = main else {
        spawn_window(app, &path);
        return;
    };

    let (tx, rx) = mpsc::channel();
    let id = next_claim_id();
    app.state::<PendingClaims>()
        .0
        .lock()
        .unwrap()
        .push_back(PendingClaim { id, path: path.clone(), tx });

    let payload = serde_json::json!({ "id": id, "path": path });
    if main.emit("file-open-claim", payload).is_err() {
        // The window is gone or the emit failed: treat as refusal.
        app.state::<PendingClaims>()
            .0
            .lock()
            .unwrap()
            .retain(|c| c.id != id);
        if app.state::<PendingPaths>().pop_if_front(&path).is_some() {
            spawn_window(app, &path);
        }
        return;
    }

    // The wait runs off the main thread; window creation hops back via
    // `run_on_main_thread` (windows must be built on the main thread).
    let app = app.clone();
    std::thread::spawn(move || {
        let claimed = matches!(rx.recv_timeout(Duration::from_secs(1)), Ok(true));
        let paths = app.state::<PendingPaths>();
        let Some(path) = paths.pop_if_front(&path) else {
            return; // already resolved (e.g. another claim drained it)
        };
        if claimed {
            return; // frontend opened it
        }
        let app = app.clone();
        let value = app.clone();
        let _ = app.run_on_main_thread(move || spawn_window(&value, &path));
    });
}

/// Handle an OS open-file request (macOS Apple Event, cold or warm).
fn handle_opened(app: &AppHandle, urls: Vec<Url>) {
    let paths: Vec<String> = urls.iter().filter_map(to_path).collect();
    if paths.is_empty() {
        return;
    }

    let Some(_main) = app.get_webview_window("main") else {
        if READY.load(Ordering::Acquire) {
            // Main window closed later; no claim possible — open everything.
            for path in paths {
                spawn_window(app, &path);
            }
        } else {
            // Cold start: `Opened` arrives before `Ready`, so the config
            // window does not exist yet. No emit, no timeout — the main
            // window's boot pull takes the first path and the `Ready`
            // handler opens the rest.
            let queue = app.state::<PendingPaths>();
            for path in paths {
                queue.push(path);
            }
        }
        return;
    };

    // Warm open: offer the first path to the main window, spawn the rest.
    let mut iter = paths.into_iter();
    let first = iter.next().unwrap();
    let queue = app.state::<PendingPaths>();
    queue.push(first.clone());
    offer_claim(app, first);
    for path in iter {
        spawn_window(app, &path);
    }
}

/// Cold-start multi-file open: `Opened` queued every path before `Ready`.
/// Leave one for the main window's boot pull; open the rest now.
fn spawn_overflow_windows(app: &AppHandle) {
    let queue = app.state::<PendingPaths>();
    while queue.len() > 1 {
        if let Some(path) = queue.pop() {
            spawn_window(app, &path);
        }
    }
}

/// Create a window that loads the given file on startup via
/// `window.__EDYTKA_OPEN_PATH` (set by an initialization script, which runs
/// before the frontend's listeners attach).
fn spawn_window(app: &AppHandle, path: &str) {
    static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(0);
    let label = format!("window-{}", WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed) + 1);
    let title = Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string());
    let script = format!(
        "window.__EDYTKA_OPEN_PATH = {};",
        serde_json::to_string(path).unwrap_or_else(|_| "\"\"".into())
    );

    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
        .title(&title)
        .inner_size(800.0, 600.0)
        .initialization_script(&script)
        .build();
    if let Err(e) = window {
        eprintln!("failed to open {path}: {e}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingPaths::default())
        .manage(PendingClaims::default())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            file_open_claim,
            take_pending_open
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            tauri::RunEvent::Opened { urls } => handle_opened(app, urls),
            tauri::RunEvent::Ready => {
                READY.store(true, Ordering::Release);
                spawn_overflow_windows(app);
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queue_is_fifo() {
        let queue = PendingPaths::default();
        queue.push("a".into());
        queue.push("b".into());
        queue.push("c".into());
        assert_eq!(queue.pop().as_deref(), Some("a"));
        assert_eq!(queue.pop().as_deref(), Some("b"));
        assert_eq!(queue.pop().as_deref(), Some("c"));
        assert_eq!(queue.pop(), None);
    }

    #[test]
    fn pop_on_empty_queue_returns_none() {
        let queue = PendingPaths::default();
        assert_eq!(queue.pop(), None);
    }

    #[test]
    fn pop_if_front_matching_pops_once() {
        let queue = PendingPaths::default();
        queue.push("a".into());
        assert_eq!(queue.pop_if_front("a").as_deref(), Some("a"));
        // The path is consumed exactly once.
        assert_eq!(queue.pop_if_front("a"), None);
        assert_eq!(queue.pop(), None);
    }

    #[test]
    fn pop_if_front_mismatch_leaves_queue_intact() {
        let queue = PendingPaths::default();
        queue.push("a".into());
        queue.push("b".into());
        assert_eq!(queue.pop_if_front("b"), None);
        assert_eq!(queue.len(), 2);
        assert_eq!(queue.pop().as_deref(), Some("a"));
    }

    #[test]
    fn to_path_accepts_file_urls() {
        let url = Url::parse("file:///tmp/notes.md").unwrap();
        assert_eq!(to_path(&url).as_deref(), Some("/tmp/notes.md"));
    }

    #[test]
    fn to_path_rejects_non_file_urls() {
        let url = Url::parse("https://example.com/notes.md").unwrap();
        assert_eq!(to_path(&url), None);
    }
}
