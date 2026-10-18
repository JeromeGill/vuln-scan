import type { Locator, Page } from "@playwright/test";
import { expect } from "../fixtures.ts";

/** Neither the page nor a table on it scrolls sideways. */
export async function expectToFit(page: Page) {
  const overflowing = await page.evaluate(() =>
    [
      document.documentElement,
      ...document.querySelectorAll("[data-slot=table-container]"),
    ]
      .filter((element) => element.scrollWidth > element.clientWidth)
      .map((element) => element.tagName),
  );
  expect(overflowing).toEqual([]);
}

/** `dialog` lies within a screen `width` px wide. */
export async function expectWithin(dialog: Locator, width: number) {
  const box = await dialog.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
}
