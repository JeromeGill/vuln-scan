# Email delivery is claimed before sending

Queues deliver at least once, so the worker inserts a row keyed by the
message id into `email_delivery` before sending and marks it sent after;
a duplicate finds the row and is skipped (AC4 at the delivery layer). A
failed send deletes the claim so the retry can send. If a claim is stuck in
`sending` for longer than any send can take (10 minutes), the earlier
attempt died mid-send and the email may or may not have gone out; the
message is parked (`unknown-outcome`) rather than risking a duplicate.
