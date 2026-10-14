/**
 * A successful request to one endpoint and what it responds with, typed with
 * the contract's request and response types. An endpoint's cases are run by
 * its api integration spec.
 */
export interface ApiCase<Request, Response> {
  /** Test name; start with `S-NNNN ACn:` when it covers a criterion. */
  label: string;
  /** The body or query; path parameters come from the spec's setup. */
  request: Request;
  /**
   * Compared with `toMatchObject` once the body is parsed with the response
   * schema (so dates are `Date`s): leave out generated fields.
   */
  response: Partial<Response>;
}
