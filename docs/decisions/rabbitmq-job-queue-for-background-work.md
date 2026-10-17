# RabbitMQ job queue for background work

Background jobs (first: verification emails; later e.g. scans,
possibly in Python) go through RabbitMQ to separate workers
rather than running inside the api. RabbitMQ was chosen as a polyglot job
queue: per-message acks, prefetch, dead-lettering and TTLs give retries and
parking without extra infrastructure, and every language has a mature AMQP
client. Kafka was rejected because it's a log, not a job queue (no
per-message acks or retries; partitions bound parallelism) and heavier to
run; pg-boss and BullMQ because they tie consumers to Node (or to their
Postgres/Redis schema), which rules out a plain Python worker. Queues are
quorum queues, RabbitMQ 4's recommended durable type. See
[Messaging](../messaging.md).
