/**
 * Console messages, uncaught errors, and failed requests that don't fail a
 * test (fixtures.ts). `pattern` is matched against the reported problem,
 * `test` (when given) against the test's title. Each entry says why it's
 * expected; keep both as narrow as possible.
 */
export const allowlist: { pattern: RegExp; test?: RegExp; reason: string }[] = [
  {
    pattern: /^request failed: GET \S+[?&]_rsc=\S+: net::ERR_ABORTED$/,
    reason:
      "Next.js cancels a pending server component fetch when a newer navigation replaces it, e.g. signing out's router.push() then router.refresh(). Cancelled, not failed.",
  },
  {
    test: /^logs in, after a wrong password shows an error$/,
    pattern: /status of 401 \(Unauthorized\)/,
    reason:
      "The test submits a wrong password on purpose; Chrome logs the api's 401.",
  },
  {
    test: /^logging in before verifying says to verify first$/,
    pattern: /status of 403 \(Forbidden\)/,
    reason:
      "The test logs in before verifying the email on purpose; Chrome logs the api's 403 EMAIL_NOT_VERIFIED.",
  },
];
