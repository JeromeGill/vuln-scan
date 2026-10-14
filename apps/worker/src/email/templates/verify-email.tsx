import type { VerifyEmailData } from "@repo/events";
import { Section, Text } from "react-email";
import type { Email } from "../../mail/mailer.service.js";
import { EmailButton, EmailLayout, renderEmail, styles } from "./layout.js";

const subject = "Verify your email for My App";

/**
 * The link that verifies the user's email address.
 */
export function VerifyEmail({ name, url }: VerifyEmailData) {
  return (
    <EmailLayout
      preview="Verify your email address to finish signing up."
      footer="You got this email because someone signed up for My App with this address. If it wasn't you, ignore it."
    >
      <Text style={styles.text}>{name ? `Hi ${name},` : "Hello,"}</Text>
      <Text style={styles.text}>
        Open this link to verify your email address and finish signing up for My
        App.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <EmailButton href={url}>Verify email</EmailButton>
      </Section>
      <Text style={styles.muted}>The link expires in an hour.</Text>
    </EmailLayout>
  );
}

export async function renderVerifyEmail(data: VerifyEmailData): Promise<Email> {
  return {
    to: data.email,
    subject,
    ...(await renderEmail(<VerifyEmail {...data} />)),
  };
}
