import { describe, expect, it, vi } from "vitest";
import { runCloseFlow, type CloseDeps } from "./closeFlow";

function deps(overrides: Partial<CloseDeps> = {}) {
  return {
    destroy: vi.fn(async () => {}),
    promptSave: vi.fn(async () => "cancel" as const),
    save: vi.fn(async () => true),
    ...overrides,
  };
}

describe("runCloseFlow", () => {
  it("destroys a clean window immediately, with no prompt and no save", async () => {
    const d = deps();
    await runCloseFlow(false, d);
    expect(d.destroy).toHaveBeenCalledOnce();
    expect(d.promptSave).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });

  it("keeps a dirty window open on Cancel", async () => {
    const d = deps({ promptSave: vi.fn(async () => "cancel" as const) });
    await runCloseFlow(true, d);
    expect(d.promptSave).toHaveBeenCalledOnce();
    expect(d.destroy).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });

  it("destroys without saving on Don't Save", async () => {
    const d = deps({ promptSave: vi.fn(async () => "no" as const) });
    await runCloseFlow(true, d);
    expect(d.save).not.toHaveBeenCalled();
    expect(d.destroy).toHaveBeenCalledOnce();
  });

  it("saves then destroys on Save when the save succeeds", async () => {
    const d = deps({
      promptSave: vi.fn(async () => "yes" as const),
      save: vi.fn(async () => true),
    });
    await runCloseFlow(true, d);
    expect(d.save).toHaveBeenCalledOnce();
    expect(d.destroy).toHaveBeenCalledOnce();
  });

  it("keeps the window open when Save is chosen but the save fails", async () => {
    const d = deps({
      promptSave: vi.fn(async () => "yes" as const),
      save: vi.fn(async () => false), // failed write
    });
    await runCloseFlow(true, d);
    expect(d.save).toHaveBeenCalledOnce();
    expect(d.destroy).not.toHaveBeenCalled();
  });

  it("keeps the window open when Save is chosen but the save dialog is cancelled", async () => {
    const d = deps({
      promptSave: vi.fn(async () => "yes" as const),
      save: vi.fn(async () => false), // cancelled save dialog
    });
    await runCloseFlow(true, d);
    expect(d.destroy).not.toHaveBeenCalled();
  });
});
