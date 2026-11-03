import { describe, expect, it } from "vitest";
import { hasNewAppAssets } from "./app-update-notification";

describe("hasNewAppAssets", () => {
  it("detects changed JavaScript or stylesheet hashes", () => {
    const currentDocument = new DOMParser().parseFromString(
      '<script type="module" src="/assets/app-a.js"></script><link rel="stylesheet" href="/assets/app-a.css">',
      "text/html",
    );

    expect(hasNewAppAssets(
      currentDocument,
      '<script type="module" src="/assets/app-b.js"></script><link rel="stylesheet" href="/assets/app-a.css">',
      "https://example.test/",
    )).toBe(true);
  });

  it("does not report an update when the loaded assets are unchanged", () => {
    const html = '<script type="module" src="/assets/app-a.js"></script><link rel="stylesheet" href="/assets/app-a.css">';
    const currentDocument = new DOMParser().parseFromString(html, "text/html");

    expect(hasNewAppAssets(currentDocument, html, "https://example.test/")).toBe(false);
  });
});
