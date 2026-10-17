# The worker sends the verification email

Better Auth's `sendVerificationEmail` publishes an
`email.verify-email` job instead of the api sending over SMTP itself: all
outgoing email keeps one mailer, layout, retry policy, and delivery log in
the worker. The cost is the api's first RabbitMQ connection, a
publish-only `JobPublisher` in `apps/api/src/messaging/` rather than a
shared package (move it to one if a third app publishes), and the worker
skipping jobs whose link expired while they waited. The publish isn't
awaited, so a sign-up succeeds even when RabbitMQ is down; the user asks
for a new link.
