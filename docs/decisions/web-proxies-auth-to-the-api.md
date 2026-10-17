# Web proxies auth to the api

The web app rewrites `/api/auth/*` to the api instead of calling it
cross-origin. The session cookie is then first-party on the web origin, which
also lets server components read it later, and no CORS configuration is
needed.
