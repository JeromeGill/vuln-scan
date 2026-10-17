# Releases deploy from CI on a tag, not on pushes

The dev deployment on Railway updates only when a `v*` tag is pushed, and
only after every test suite passes in GitHub Actions
(`.github/workflows/release.yml`, see [Deployment](../deployment.md)), rather
than Railway deploying each push to `main` itself. A release is then a
deliberate step, and a commit whose tests fail never reaches Railway.
Railway's own "wait for CI" option works per branch push, not per tag, so CI
deploys with `railway up` instead. The three services are always deployed
together: deploying only the apps a release changed would need per-app
change detection between tags, which isn't worth it yet.

The Railway project's settings and variables live in `.railway/railway.ts`
(Railway's Infrastructure as Code), applied by the release workflow before it
deploys, rather than in the dashboard: they're reviewed in PRs and can't
drift unnoticed. Railway's older Config as Code (`railway.json` per service)
is deprecated and new services can't opt in. The file owns the whole
environment, so the workflow applies without `--confirm-destructive`: a
change that would delete a service, volume, or variable fails the release
and has to be applied by hand after reviewing the plan. Secrets stay in the
dashboard as `preserve()`.
