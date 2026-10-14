import { readdirSync } from "node:fs";

// Stories live in docs/stories/NNNN-slug.md (see docs/stories/README.md).
const storiesDir = new URL("docs/stories/", import.meta.url);
const trailer = /^Story:[ \t]*S-(\d{4})[ \t]*$/gm;

/**
 * `feat` and `fix` commits must name the story they implement with one or
 * more `Story: S-NNNN` trailers, each matching a file in docs/stories/.
 */
function storyTrailer({ type, raw }, _when, types = []) {
  if (!type || !types.includes(type)) return [true];

  const numbers = [...(raw ?? "").matchAll(trailer)].map(
    ([, number]) => number,
  );
  if (numbers.length === 0) {
    return [
      false,
      `${type} commits need a "Story: S-NNNN" trailer naming a story in docs/stories/`,
    ];
  }

  const files = readdirSync(storiesDir);
  const missing = numbers.filter(
    (number) => !files.some((file) => file.startsWith(`${number}-`)),
  );
  return [
    missing.length === 0,
    `no story file in docs/stories/ for ${missing.map((n) => `S-${n}`).join(", ")}`,
  ];
}

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [{ rules: { "story-trailer": storyTrailer } }],
  rules: {
    "story-trailer": [2, "always", ["feat", "fix"]],
  },
};
