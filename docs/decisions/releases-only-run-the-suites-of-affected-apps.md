# Releases only run the suites of affected apps

A release tag runs the test suites of the apps affected since the last
release that passed, not all four (`.github/scripts/affected-apps`, see
[Deployment](../deployment.md#skipping-unaffected-suites)). "Affected" comes
from Turbo's package graph, which follows the workspace dependencies that
pnpm's strict `node_modules` forces every import to declare, rather than
from path filters that would have to repeat that graph by hand and drift
from it. What the graph can't see is added explicitly: root files every
package reads are `globalDependencies`, e2e runs whenever an app it drives
is affected, and CI changes run everything. The base is the last release
whose workflow passed, so a failed release's suites run again. Deploys
still cover all three services.
