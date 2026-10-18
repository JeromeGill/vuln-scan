import { renderVerifyEmail } from "./verify-email.js";

const data = {
  userId: "user-1",
  email: "ada@example.com",
  name: "Ada <Lovelace>",
  url: "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fverify-email",
  expiresAt: "2026-10-12T10:00:00.000Z",
};

const email = await renderVerifyEmail(data);

describe("renderVerifyEmail", () => {
  it("is addressed to the user, with the link", () => {
    expect(email.to).toBe("ada@example.com");
    expect(email.subject).toBe("Verify your email for vulnscan");
    expect(email.text).toContain(`Verify email ${data.url}`);
    expect(email.html).toContain(`href="${data.url.replaceAll("&", "&amp;")}"`);
  });

  it("escapes the name in the HTML", () => {
    expect(email.html).toContain("Hi Ada &lt;Lovelace&gt;,");
    expect(email.text).toContain("Hi Ada <Lovelace>,");
  });
});
