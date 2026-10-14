import { env } from "@repo/config/api";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  // Better Auth needs the raw request body; the auth module re-adds the
  // default body parsers for non-auth routes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  await app.listen(env.PORT);
}
await bootstrap();
