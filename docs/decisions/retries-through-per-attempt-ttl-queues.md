# Retries through per-attempt TTL queues

A failed job is republished by the consumer to `<queue>.retry.<n>` with a
per-message `expiration` and a `retry-count` header, then acked; the retry
queue dead-letters it back to the work queue when it expires. After the
last delay, or for a message that can't succeed (invalid, unknown type,
refused by the mail server), it goes to `<queue>.parked`. Rejected
alternatives: the delayed-message exchange plugin (not in the default
image, and its own durability caveats); `nack` into a dead-letter loop
counting `x-death` (can't add our own headers, and `x-death` is
broker-managed and differs between queue types); requeueing in place (no backoff, blocks nothing but
spins). One queue per attempt keeps every message in a queue on the same
delay, since TTLs only expire at the head. Delays come from config, not
queue arguments, so changing them doesn't break redeclaration. The work
queue's `x-delivery-limit` parks messages whose consumer keeps crashing.
