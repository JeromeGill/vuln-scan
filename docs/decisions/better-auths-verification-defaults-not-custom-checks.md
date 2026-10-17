# Better Auth's verification defaults, not custom checks

Expiry, reuse, and the "check your inbox" answer to an address that
already has an account all follow what Better Auth 1.7.7 does: a used link
redirects to the callback without a new session rather than showing an
error. The link's token is a signed JWT, so there's no table of tokens to
clean up.
