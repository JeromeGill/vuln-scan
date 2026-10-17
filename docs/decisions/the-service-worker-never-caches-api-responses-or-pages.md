# The service worker never caches api responses or pages

`/api/*` is passed straight through, and page navigations are network-only
with a static `/offline` fallback. Responses carry one user's data and the
Better Auth session, and a cache on a shared phone (or
after signing out) would show them to the next person; it also can't go
stale. The cost is that the app needs a connection to show any data;
offline reading or writing would be a separate, deliberate design.
