// Close-request orchestration. Tauri-free by dependency injection, so the
// branching can be unit-tested with mocked dialog/window APIs.

export interface CloseDeps {
  /** Close the window for good (bypasses the close-request path). */
  destroy: () => Promise<void>;
  /** Show the native Save / Don't Save / Cancel prompt. */
  promptSave: () => Promise<"yes" | "no" | "cancel">;
  /**
   * Save the current document. Resolves true iff the document was written,
   * which is what permits the window to close; a cancelled save dialog or a
   * failed write resolves false and keeps the window open.
   */
  save: () => Promise<boolean>;
}

/**
 * Close flow: clean windows destroy immediately; dirty windows prompt
 * Save / Don't Save / Cancel. Cancel keeps the window; Don't Save destroys;
 * Save destroys only when the save actually succeeded.
 */
export async function runCloseFlow(
  dirty: boolean,
  deps: CloseDeps,
): Promise<void> {
  if (!dirty) {
    await deps.destroy();
    return;
  }
  const choice = await deps.promptSave();
  if (choice === "cancel") return;
  if (choice === "yes") {
    const saved = await deps.save();
    if (!saved) return;
  }
  await deps.destroy();
}
