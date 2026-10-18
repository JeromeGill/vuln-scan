# Web app

`apps/web` is a Next.js 16 (App Router) app built with
[shadcn/ui](https://ui.shadcn.com/) on Tailwind CSS v4,
[TanStack Table](https://tanstack.com/table) v9,
[TanStack Form](https://tanstack.com/form), and
[TanStack Query](https://tanstack.com/query) through the oRPC client. So
far it has the account pages (sign-up, login, email verification), the
dashboard listing the user's projects (`/dashboard`, with the create
dialog), and the project page (`/projects/<id>`) with its upload tokens,
where the project is renamed or deleted (typing its name to confirm).

## Layout

```
apps/web/
├── app/
│   ├── layout.tsx            fonts, metadata (Apple tags), <Providers>
│   ├── providers.tsx         theme, QueryClient, toasts, ThemeColor, ServiceWorker
│   ├── page.tsx              / → /dashboard or /login (the installed app's start URL)
│   ├── manifest.ts           /manifest.webmanifest
│   ├── icon.tsx, apple-icon.tsx, icons/[icon]/route.tsx   generated PNG icons
│   ├── offline/page.tsx      static "You're offline" page (service worker fallback)
│   ├── (auth)/               /login, /sign-up, /check-inbox (redirect to /dashboard if signed in)
│   ├── (app)/                signed-in area: layout checks the session
│   │   ├── dashboard/page.tsx
│   │   └── projects/[id]/page.tsx
│   └── verify-email/         public: where verification links land (→ /dashboard, or a new link)
├── containers/               feature UI: one folder per feature
│   ├── dashboard/            the dashboard: the projects table and the create dialog
│   ├── projects/             projects table, columns, name form, create and rename dialogs, delete dialog (type the name), project page
│   ├── upload-tokens/        the project page's Tokens section: table, columns, form, create dialog (shows the token once), expiry helpers
│   └── offline/              retry-button
├── components/
│   ├── ui/                   shadcn components (generated; see below)
│   └── *.tsx                 app-wide pieces: header, data-table, form-field, page-header, confirm-dialog, logo, service-worker, …
├── lib/
│   ├── orpc.ts               typed api client + TanStack Query utils
│   ├── session.ts            getSession() for server components
│   ├── auth-client.ts        Better Auth React client
│   ├── brand.ts, app-icon.tsx  name, colours, and the icon renderer
│   ├── build.ts              build-time constants (NODE_ENV, service worker version)
│   ├── format.ts             dates in the user's locale
│   └── utils.ts
├── public/sw.js              the service worker
└── test/                     component tests (Vitest, Testing Library, MSW); see Testing
```

Pages stay thin server components (they export `metadata`) and render a
container. **Containers** own a feature: they fetch, hold UI state (dialogs,
filters, pagination), and compose `components/`. A resource typically gets
a page with a table container (`<resource>-table.tsx`, `columns.tsx`), a
form and a form dialog for adding and editing, and `queries.ts` for shared
query options.

## Talking to the api

`next.config.ts` rewrites `/api/auth/*` to the api's Better Auth handler and
every other `/api/*` to the api root (`/api/account` → `/account`), so the browser
stays on the web origin and sends the session cookie.

`lib/orpc.ts` builds a client from `@repo/contracts` with oRPC's
`OpenAPILink` (pointing at `/api`) and wraps it with
`createTanstackQueryUtils`:

```ts
useQuery(orpc.account.get.queryOptions());
useMutation(orpc.widgets.create.mutationOptions());
queryClient.invalidateQueries({ queryKey: orpc.widgets.key() });
```

Inputs and outputs are typed from the contracts. `ResponseValidationPlugin`
parses every response with the contract's output schema, which is how JSON
date strings become `Date`s again (the schemas use `z.coerce.date()`).
Shared query options live in `containers/<resource>/queries.ts`.

Browser code only: the client uses `window.location.origin`. Server
components that need the session use `getSession()` from `lib/session.ts`,
which forwards the request cookie to the api's `/api/auth/get-session`. The
`(app)` layout redirects to `/login` without one.

## Tables (TanStack Table v9)

v9's API differs from v8 and from most examples online:

- `useTable({ features, columns, data, … })`, where `features` comes from
  `tableFeatures({ … })` and registers each feature and row model you use
  (`rowSortingFeature`, `sortedRowModel: createSortedRowModel()`, sort and
  filter functions by name, `rowPaginationFeature`, …).
- Columns come from `createColumnHelper<typeof features, Row>()`. Define
  them in `containers/<resource>/columns.tsx` as a function of the row
  actions, and memoize the call in the container: oxlint's
  `react/no-unstable-nested-components` rejects `header`/`cell` renderers
  defined inside a component.
- Render with `<table.FlexRender header={…} />` / `cell={…}`.
  `components/data-table.tsx` does this for every table (skeleton rows while
  loading, an `empty` slot, per-column classes for responsive hiding).
- Controlled state works as in v8: `state: { sorting }` plus
  `onSortingChange: setSorting`.

A small list can load in one request and be sorted and searched in the
browser; a long one is paginated, filtered, and ordered by the api
(`manualPagination: true` with `rowCount`). Put filters a page should be
linkable by in the URL (`useSearchParams`, changed with
`history.replaceState`).

## Forms (TanStack Form)

Forms validate with the contract's own zod schemas
(`validators: { onChange: createWidgetSchema }`), so the browser and the
api apply the same rules and messages. When a form's values differ from the
body (an empty number is `null` in the form, a date instead of a
timestamp), build the form schema from the contract's fields
(`createWidgetSchema.extend({ … })`) rather than writing new rules.
`components/form-field.tsx` renders the label, control, and errors for a
field, showing errors once it's touched (submitting touches every field).
Errors from the api are shown in the form: on the field they're about when
there is one (a `CONFLICT` for a taken name goes on the name field with
`formApi.setFieldMeta`, as an `onSubmit` error, which the field's next valid
change clears; see `containers/projects/project-form.tsx`), otherwise at the
bottom of the form. Success shows a toast (sonner) and invalidates the
affected queries. The
auth forms (`app/(auth)/`) follow the same pattern with Better Auth's
client instead of oRPC.

## Tests

Component tests live in `test/`, grouped by feature, and run with
`pnpm --filter web test`. They render containers in jsdom, act through
roles and labels like a user, and answer the api calls with MSW, so the
real oRPC and Better Auth clients run. Setup and conventions:
[Testing → Web](testing.md#web).

## shadcn/ui

`components.json` configures shadcn (style `radix-nova`, Radix primitives,
neutral base colour, lucide icons). Theme tokens are CSS variables in
`app/globals.css`, with a `.dark` variant toggled by next-themes (the header
has a toggle, in the account menu on phones; the default follows the system).

```sh
cd apps/web
pnpm dlx shadcn@latest add <component>   # writes components/ui/<component>.tsx
pnpm format
```

Components in `components/ui/` are generated code: prefer regenerating to
editing. Exceptions, to redo if you regenerate them: `field.tsx` carries
an `oxlint-disable-next-line` comment for `jsx-a11y/prefer-tag-over-role`,
which config overrides can't turn off; `sonner.tsx` narrows the theme and
declares CSS variables on React's `CSSProperties` instead of shadcn's casts.
They import `cn` from the `cn` package (shadcn's own class merger). `@/` is
the `apps/web` root (`paths` in `tsconfig.json`).

The shadcn components live in the web app rather than a shared package:
there is one web app, and shadcn's monorepo setup would add aliasing and
Tailwind source scanning across packages for no benefit. If a second app
needs them, move them into a package then.

## Phones and touch

Every signed-in page and dialog fits a 360 px wide screen without
horizontal scrolling. The conventions that keep it that way:

- **Tables:** `DataTable` wraps cell text below the `sm` breakpoint and
  uses tighter padding. Hide less important columns on phones with
  `columnClassNames` (`hidden sm:table-cell`) and, if the value still
  matters, show it in a visible cell with `sm:hidden` (e.g. a secondary
  value under the row's name). Keep the row menu column visible:
  it's how phones reach every action.
- **Header:** below `sm` the nav links are 44 px icons (with an
  `aria-label`), the logo's name is for screen readers only, and the theme
  toggle moves into the account menu, so the header fits 360 px with
  several links.
- **Dialogs** holding a table add
  `grid-cols-[minmax(0,1fr)]` to `DialogContent`. Its grid column otherwise
  grows to the table's minimum width and the dialog runs off screen.
- **Tap targets:** on touch screens (the `pointer-coarse:` variant) the
  shadcn components in `components/ui/` grow to 44 px: `Button`'s default
  and `lg` sizes (minimum height) and its `icon`, `icon-sm`, and `icon-lg`
  sizes (square), `Input`, the default `SelectTrigger`, and select and menu
  items. The compact `xs`/`sm` buttons (e.g. sort headers) and third-party
  widgets keep their sizes, and desktop keeps the dense sizes. Links that
  act as controls (the header nav) add `pointer-coarse:min-h-11` themselves.
- **Sorting on phones:** hidden columns take their sort headers with them,
  so a table with sortable hidden columns shows `SortMenu`
  (`components/data-table.tsx`) on phones, listing every sortable column
  (next to the table's search, if it has one).

## PWA

The web app is an installable progressive web app (why not a native app:
[Decisions](decisions/a-pwa-not-a-native-app.md)): browsers offer to install it,
and it opens standalone at `/`, which redirects to `/dashboard` or `/login`.

- **Manifest:** `app/manifest.ts` (served at `/manifest.webmanifest`):
  name, `display: standalone`, start URL and scope `/`, colours from
  `lib/brand.ts`, and the icons. Manifests have no dark variant, so the
  splash screen is white.
- **Icons** are generated at build time with `ImageResponse`
  (`lib/app-icon.tsx`, the header's `ShieldCheck` tile): `app/icon.tsx` (32 px
  tab icon, next to `favicon.ico`), `app/apple-icon.tsx` (180 px, full
  square because iOS masks it), and `app/icons/[icon]/route.tsx` for the
  manifest's `/icons/192.png`, `/icons/512.png`, and
  `/icons/maskable-512.png` (icon inside the 80% safe zone). lucide-react's
  components can't be rendered by `ImageResponse`, so the paths are copied
  into `app-icon.tsx`.
- **Theme colour:** `components/theme-color.tsx` renders the `theme-color` meta
  tags (React hoists them into `<head>`): a light/dark pair following
  `prefers-color-scheme` on the server and in "system" mode, and a single tag
  for the theme picked with the header toggle otherwise. `appleWebApp` sets the
  iOS title and an opaque (`default`) status bar, so the page needs no safe-area
  padding at the top; `formatDetection` stops iOS turning numbers into phone
  links.
- **Service worker:** `public/sw.js`, hand-written (why: see
  [Decisions](decisions/hand-written-service-worker.md)), registered by
  `components/service-worker.tsx` in production builds only:
  - Other origins are left alone, notably signed object storage URLs
    (uploads and downloads go straight to the bucket).
  - `/api/*` (data and Better Auth) is never cached, so no response with
    user data is stored. Navigations to it (e.g. a link from an email)
    still answer with the navigation preload, so the request isn't sent
    twice.
  - Page navigations always go to the network (with navigation preload).
    If that fails, it answers with the `/offline` page, cached at install
    with the scripts, styles, and fonts its HTML references (an asset that
    fails to load is skipped; only the page is required). No other page is
    cached.
  - `/_next/static/*` (content-hashed) is cache-first; icons are served
    from the cache and refreshed in the background. Cache writes happen in
    the background, so a full cache never fails a response. This cache
    (`vulnscan-static`) isn't versioned, since a hashed URL never changes
    content: a new worker reuses what the old one cached, and trims it to
    the newest 300 entries when it activates.
  - **Updates:** it's registered as `/sw.js?v=<version>`, a random value
    that `next.config.ts` picks per build and `lib/build.ts` hands to
    client code. Each build means a new URL, so the browser installs the
    new worker in the background. It doesn't `skipWaiting`: it takes over
    once every app window is closed (the next launch of the installed
    app), then drops the previous build's offline page
    (`vulnscan-offline-<v>`). Pages come from the network, so a new build is
    visible on the next page load either way.
  - Registration uses `updateViaCache: "none"`, so the browser always
    checks `/sw.js` itself for updates rather than its HTTP cache.
  - In `next dev` nothing registers, and the component unregisters any
    worker (and deletes every cache) a production build left on the same
    origin, since cached assets would break hot reloading.
- **Offline page:** `app/offline/page.tsx` is static and lives outside the
  route groups, so it can be cached without user
  data. The worker serves it in place of the page asked for, so the address
  bar keeps that URL; **Try again** (and the browser's `online` event)
  reloads it. Opened directly, it goes to `/`.

### Testing it locally

Service workers only run on HTTPS or `localhost`, and only production
builds register one. See
[Development guide → Test the PWA](development.md#test-the-pwa-locally).
