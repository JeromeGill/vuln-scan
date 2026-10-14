/** fake-gcs-server from docker-compose.yml. */
const EMULATOR_URL = "http://localhost:4443";

/** Fails fast with a hint when the emulator isn't running. */
export default async function setup() {
  try {
    await fetch(`${EMULATOR_URL}/storage/v1/b`);
  } catch {
    throw new Error(
      `The GCS emulator isn't reachable at ${EMULATOR_URL}. Start it with ` +
        "`docker compose up -d --wait fake-gcs` (script/test does).",
    );
  }
}
