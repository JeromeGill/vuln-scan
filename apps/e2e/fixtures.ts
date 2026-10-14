import { test as base, expect } from "@playwright/test";
import { allowlist } from "./console-allowlist.ts";

/**
 * Playwright's `test`, whose `page` fails the test after it runs if the page
 * logged a console error or warning, threw an uncaught error, or had a
 * failed request, unless it's in the allowlist.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const problems: string[] = [];
    const allowed = allowlist.filter(
      (entry) => entry.test?.test(testInfo.title) ?? true,
    );
    const report = (problem: string) => {
      if (!allowed.some(({ pattern }) => pattern.test(problem))) {
        problems.push(problem);
      }
    };
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        report(
          `console.${message.type()} at ${message.location().url}: ${message.text()}`,
        );
      }
    });
    page.on("pageerror", (error) => report(`uncaught ${error.stack ?? error}`));
    page.on("requestfailed", (request) =>
      report(
        `request failed: ${request.method()} ${request.url()}: ${request.failure()?.errorText}`,
      ),
    );

    await use(page);

    expect(problems, "the page reported problems").toEqual([]);
  },
});

export { expect };
