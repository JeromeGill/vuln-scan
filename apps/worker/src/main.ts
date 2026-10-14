import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module.js";

// No HTTP server: the worker only consumes the job queues (docs/messaging.md).
const app = await NestFactory.createApplicationContext(WorkerModule);
// Ctrl-C / SIGTERM: stop consuming, finish in-flight jobs, then disconnect.
app.enableShutdownHooks();
