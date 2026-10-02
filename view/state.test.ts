import { describe, expect, it } from "vitest";
import {
  CLOSE_BUTTONS,
  bootstrapPath,
  closeDecision,
  documentTitle,
  shouldClaim,
} from "./state";

describe("shouldClaim", () => {
  it("claims only when untitled, clean, and not already claiming", () => {
    expect(shouldClaim(null, false, false)).toBe(true);
    expect(shouldClaim(null, true, false)).toBe(false);
    expect(shouldClaim("/a/b.md", false, false)).toBe(false);
    expect(shouldClaim(null, false, true)).toBe(false);
  });

  it("refuses a second claim while one is in flight", () => {
    // First claim in the same tick: the window is pristine, so it claims
    // and sets the in-flight flag synchronously before replying.
    const first = shouldClaim(null, false, false);
    expect(first).toBe(true);
    // Second claim arriving in the same tick sees the flag and is refused,
    // so the backend spawns a new window for that path instead.
    const second = shouldClaim(null, false, true);
    expect(second).toBe(false);
  });
});

describe("bootstrapPath", () => {
  it("prefers the claim path, then the boot pull, then the init-script path", () => {
    expect(bootstrapPath("/claimed.md", "/pulled.md", "/init.md")).toBe(
      "/claimed.md",
    );
    expect(bootstrapPath(null, "/pulled.md", "/init.md")).toBe("/pulled.md");
    expect(bootstrapPath(null, null, "/init.md")).toBe("/init.md");
    expect(bootstrapPath(null, null, null)).toBeNull();
  });
});

describe("documentTitle", () => {
  it("yields the filename for a path", () => {
    expect(documentTitle("/home/user/notes.md")).toBe("notes.md");
    expect(documentTitle("notes.md")).toBe("notes.md");
    expect(documentTitle("dir/no-extension")).toBe("no-extension");
  });

  it("yields untitled when there is no path or no basename", () => {
    expect(documentTitle(null)).toBe("untitled");
    expect(documentTitle("")).toBe("untitled");
    expect(documentTitle("/")).toBe("untitled");
  });
});

describe("closeDecision", () => {
  it("destroys clean windows directly and prompts for dirty ones", () => {
    expect(closeDecision(false)).toBe("destroy");
    expect(closeDecision(true)).toBe("prompt");
  });
});

describe("CLOSE_BUTTONS", () => {
  it("offers Save, Don't Save, and Cancel", () => {
    expect(CLOSE_BUTTONS).toEqual({
      yes: "Save",
      no: "Don't Save",
      cancel: "Cancel",
    });
  });
});
