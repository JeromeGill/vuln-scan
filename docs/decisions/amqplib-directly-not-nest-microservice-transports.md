# amqplib directly, not Nest microservice transports

`@nestjs/microservices` wraps every message in its own
`{ pattern, data }` envelope and request/reply conventions, which a Python
consumer would have to imitate. The worker uses `amqplib` behind a small
Nest module (`apps/worker/src/messaging/`) and sends plain JSON bodies.
`@golevelup/nestjs-rabbitmq` (9.1, peer `@nestjs/core ^11 || ^12`) was
considered: it sends plain JSON, but pins the older `amqplib` 0.10 plus
`amqp-connection-manager` and lodash, and its error handling would have to
be bent to our retry topology. amqplib 2.x has connection recovery built in
(`recovery.setup` reruns topology and consumers after a reconnect), so the
remaining code is short and the retry rules are explicit.
