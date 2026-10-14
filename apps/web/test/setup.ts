import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";
import { afterAll, afterEach } from "vitest";
import { server } from "./server";

// Started here rather than in `beforeAll`: setup files run before the test
// file's imports, and `lib/orpc.ts` keeps a reference to `fetch` when it is
// imported, so MSW must have patched it by then. A request without a
// handler fails the test.
server.listen({ onUnhandledFrame: "error" });
afterEach(() => {
  // Sonner keeps toasts in module state and replays the active ones to the
  // next test's toaster.
  toast.dismiss();
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

// jsdom has no matchMedia; sonner's toaster reads the colour scheme with it.
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

// jsdom has no pointer capture or scrollIntoView; Radix's Select and
// DropdownMenu call them when opened.
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

// jsdom has no ResizeObserver; Radix's Switch measures itself inside a form.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
