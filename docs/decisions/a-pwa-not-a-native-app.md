# A PWA, not a native app

The mobile app is `apps/web` made installable, not a second app.
A PWA covers installing to the home screen, the camera
(`<input capture>` on iOS and Android), and Web Push (Android, and iOS
16.4+ once installed). It's one
codebase, and every improvement helps desktop too. React Native (Expo, as
`apps/mobile`) would mean a second UI to build and test for every feature,
Better Auth's Expo plugin instead of the cookie, app store accounts and
review, and Metro configuration that could change pnpm's `node-linker` for
the whole repo; `@repo/contracts` and the oRPC client would carry over, the
UI wouldn't. Capacitor needs a static or client-only web app, which
conflicts with the server components and server-side session checks.
Revisit if app store presence becomes a requirement, or the PWA falls short
on something that matters on real phones: uploads, push on iOS, or offline
writes.
