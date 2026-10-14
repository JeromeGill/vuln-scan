import { render } from "@react-email/render";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "react-email";

/** Inline styles: many mail clients drop `<style>` blocks. */
export const styles = {
  text: { margin: "0 0 8px", fontSize: "14px", lineHeight: "20px" },
  muted: {
    margin: "0",
    fontSize: "14px",
    lineHeight: "20px",
    color: "#71717a",
  },
  button: {
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: "6px",
    background: "#18181b",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
  },
  footerLink: { color: "#71717a" },
} satisfies Record<string, CSSProperties>;

/** The page every email shares: a white card on grey, and a small footer. */
export function EmailLayout({
  preview,
  footer,
  children,
}: {
  /** The inbox preview line. */
  preview: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "24px 12px",
          background: "#f4f4f5",
          color: "#18181b",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            padding: "24px",
            background: "#ffffff",
            borderRadius: "8px",
          }}
        >
          {children}
        </Container>
        <Container style={{ maxWidth: "560px" }}>
          <Text
            style={{
              margin: "16px 0 0",
              fontSize: "12px",
              lineHeight: "18px",
              color: "#71717a",
            }}
          >
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** A link styled as a button. */
export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button href={href} style={styles.button}>
      {children}
    </Button>
  );
}

/** Renders an email's HTML and its plain-text alternative. */
export async function renderEmail(
  email: ReactElement,
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(email),
    render(email, { plainText: true }),
  ]);
  return { html, text };
}
