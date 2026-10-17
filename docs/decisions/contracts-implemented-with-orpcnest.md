# Contracts implemented with `@orpc/nest`

Routes are Nest controllers using `@orpc/nest`'s `@Implement`, rather than an
oRPC handler mounted outside Nest, so they sit behind the global Better Auth
guard and use Nest's DI, modules, and param decorators like any other route.
Services throw `ORPCError` directly instead of Nest HTTP exceptions, because
oRPC's interceptor (not Nest's exception filter) formats the response. Each
`@Implement` method takes an unused `@Res()`, which tells Nest the response
is handled; otherwise Nest replies again after oRPC, which fails on 204s.
Revisit if `@orpc/nest` fixes this upstream.
