# Email templates in React Email

Emails (so far the verification link) are React Email
components (`react-email`, rendered by `@react-email/render`) in
`apps/worker/src/email/templates/`, sharing `EmailLayout` and
`EmailButton` from `layout.tsx`. `renderEmail` renders each one twice: the
HTML, and the plain-text part converted from it, so the two can't drift
apart. This replaced hand-built HTML strings and plain text joined line by
line, which were hard to read and to change. React escapes values, and the
components produce the table markup mail clients need. Plain-text headings
come out in upper case (html-to-text's default). The worker compiles
`.tsx` with `"jsx": "react-jsx"`. `react-email` also ships a preview CLI;
its `esbuild` dependency's build script is turned off in
`pnpm-workspace.yaml`, since the worker doesn't run it.
