import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import SMTPTransport from "nodemailer/lib/smtp-transport";

describe("SMTP_URL", () => {
  it("a Resend URL means implicit TLS on 2465, with the API key as password", () => {
    // How the production SMTP_URL is written (docs/deployment.md#email): a
    // key with reserved characters is URL-encoded, and nodemailer decodes it.
    const { options } = new SMTPTransport({
      url: "smtps://resend:re_ab%2Fc%40d_XYZ@smtp.resend.com:2465",
    });
    expect(options).toMatchObject({
      secure: true,
      host: "smtp.resend.com",
      port: 2465,
      auth: { user: "resend", pass: "re_ab/c@d_XYZ" },
    });
  });
});

describe("worker config", () => {
  const configModule = createRequire(import.meta.url).resolve(
    "@repo/config/worker",
  );

  /**
   * Imports `@repo/config/worker` in a child process with only these
   * variables: run outside the repo, so no `.env` file fills the gaps.
   */
  function loadConfig(vars: Record<string, string>) {
    return promisify(execFile)(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(configModule)})`,
      ],
      {
        cwd: tmpdir(),
        env: {
          DB_USER: "vulnscan",
          DB_PASSWORD: "vulnscan",
          DB_NAME: "vulnscan",
          ...vars,
        },
      },
    );
  }

  const valid = {
    SMTP_URL: "smtps://resend:re_key@smtp.resend.com:2465",
    MAIL_FROM: "vulnscan <no-reply@mail.example.com>",
  };

  it("accepts a provider's SMTP URL and a named From address", async () => {
    await expect(loadConfig(valid)).resolves.toBeDefined();
    await expect(
      loadConfig({ ...valid, MAIL_FROM: "no-reply@mail.example.com" }),
    ).resolves.toBeDefined();
  });

  it.each([
    ["SMTP_URL is missing", { MAIL_FROM: valid.MAIL_FROM }, "SMTP_URL"],
    ["SMTP_URL is empty", { ...valid, SMTP_URL: "" }, "SMTP_URL"],
    [
      "SMTP_URL isn't SMTP",
      { ...valid, SMTP_URL: "https://smtp.resend.com" },
      "SMTP_URL",
    ],
    ["MAIL_FROM is missing", { SMTP_URL: valid.SMTP_URL }, "MAIL_FROM"],
    [
      "MAIL_FROM has no address",
      { ...valid, MAIL_FROM: "vulnscan" },
      "MAIL_FROM",
    ],
  ])("refuses to start when %s", async (_case, vars, variable) => {
    await expect(loadConfig(vars)).rejects.toThrow(variable);
  });
});
