# Email settings have no defaults

`SMTP_URL` and `MAIL_FROM` are required (`packages/config/src/worker.ts`),
where most variables have a local default. With a default (Mailpit on
`localhost:1025`), a deployed worker without its provider settings would
still start and then fail every send, parking every email, so mail would
be lost quietly. Without defaults it stops at startup instead and says
which variable is missing. Locally the values come from `.env`
(`.env.example` has Mailpit's). On startup the worker also checks the SMTP
login and logs the result (`SmtpMailerService`), but doesn't stop on a
failure, so a provider outage only delays email.
