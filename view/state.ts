// Pure decision logic for document state. No Tauri or DOM imports, so it can
// be unit-tested without a webview.

/**
 * May this window claim an incoming file? Only the pristine untitled window
 * claims: no document loaded, no unsaved changes, and no claim in flight.
 */
export function shouldClaim(
  currentPath: string | null,
  dirty: boolean,
  inFlight: boolean,
): boolean {
  return currentPath === null && !dirty && !inFlight;
}

/** Window title for a document: its filename, or "untitled" when none. */
export function documentTitle(path: string | null): string {
  if (path === null) return "untitled";
  const base = path.split(/[\\/]/).pop();
  return base && base.length > 0 ? base : "untitled";
}

/**
 * Bootstrap precedence for opening a path at startup: a path acquired through
 * the claim protocol wins, then the boot-time pull, then the
 * initialization-script variable used by spawned windows.
 */
export function bootstrapPath(
  claimedPath: string | null,
  pendingPath: string | null,
  initScriptPath: string | null,
): string | null {
  return claimedPath ?? pendingPath ?? initScriptPath;
}

export type CloseDecision = "destroy" | "prompt";

/** Closing a clean window destroys it directly; a dirty one prompts first. */
export function closeDecision(dirty: boolean): CloseDecision {
  return dirty ? "prompt" : "destroy";
}

/** Labels for the native close prompt (custom buttons). */
export const CLOSE_BUTTONS = {
  yes: "Save",
  no: "Don't Save",
  cancel: "Cancel",
} as const;
