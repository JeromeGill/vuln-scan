# Web tests mock the network with MSW, in jsdom

`apps/web` component tests answer api calls with MSW (`setupServer`)
instead of mocking `lib/orpc.ts`, `lib/auth-client.ts`, or TanStack Query
with `vi.mock`. The code under test then runs as in the browser: the oRPC
client builds the request from the contract, `ResponseValidationPlugin`
parses the response (dates and all), errors decode into `ORPCError`s, and
Better Auth's client makes its real calls, so a test breaks when that
wiring does and not when a component is refactored. Handlers are
plain URL + JSON, and their bodies are typed from `@repo/contracts`.
Module mocks are kept for what doesn't exist outside Next.js
(`next/navigation`'s router).

jsdom rather than happy-dom: it's the environment Testing Library and
Radix are exercised against most, and its gaps are known and few (one
`matchMedia` stub so far). happy-dom is faster but less complete, and the
suite is small enough that speed doesn't matter yet. JSX is compiled by
Vite's own oxc transform (`oxc.jsx` in `vitest.config.ts`) rather than
`@vitejs/plugin-react`, since the tests need no Fast Refresh or Babel.
