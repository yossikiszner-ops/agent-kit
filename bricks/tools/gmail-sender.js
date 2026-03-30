/**
 * bricks/tools/gmail-sender.js — Send emails via Gmail
 *
 * Requires: GOOGLE_ACCESS_TOKEN (from Google OAuth flow)
 * Scopes needed: https://www.googleapis.com/auth/gmail.send
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "gmail-sender",
  description:
    "Compose and send emails from the user's Gmail account. " +
    "Use for: sending replies, follow-ups, or new emails on behalf of the user. " +
    "Always confirm the content and recipient with the user before sending.",

  requiredEnvVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],

  parameters: z.object({
    to: z
      .union([z.string().email(), z.array(z.string().email())])
      .describe("Recipient email address or array of addresses"),
    subject: z
      .string()
      .min(1)
      .max(200)
      .describe("Email subject line"),
    body: z
      .string()
      .min(1)
      .max(50_000)
      .describe("Email body — plain text or HTML"),
    isHtml: z
      .boolean()
      .optional()
      .default(false)
      .describe("Set true if body is HTML"),
    cc: z
      .union([z.string().email(), z.array(z.string().email())])
      .optional()
      .describe("CC recipients"),
    replyToMessageId: z
      .string()
      .optional()
      .describe("Gmail message ID to reply to (makes the email a thread reply)"),
  }),

  execute: async ({ to, subject, body, isHtml = false, cc, replyToMessageId }) => {
    const token = await getAccessToken();

    const recipients = Array.isArray(to) ? to.join(", ") : to;
    const ccList = cc
      ? Array.isArray(cc)
        ? cc.join(", ")
        : cc
      : null;

    // Build RFC 2822 email
    const lines = [
      `To: ${recipients}`,
      ccList ? `Cc: ${ccList}` : null,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      isHtml
        ? `Content-Type: text/html; charset=UTF-8`
        : `Content-Type: text/plain; charset=UTF-8`,
      "",
      body,
    ]
      .filter((l) => l !== null)
      .join("\r\n");

    // Base64url encode
    const encoded = Buffer.from(lines)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const payload = { raw: encoded };
    if (replyToMessageId) {
      payload.threadId = replyToMessageId;
    }

    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12_000),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message ?? `Gmail send API HTTP ${res.status}`
      );
    }

    const data = await res.json();
    return {
      success: true,
      messageId: data.id,
      threadId: data.threadId,
      to: recipients,
      subject,
    };
  },

  onError: (err) =>
    `Gmail send failed: ${err.message}. Ensure the Gmail API is enabled and OAuth is configured.`,
};

async function getAccessToken() {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "No Google OAuth token. Complete the Google OAuth flow to enable Gmail sending."
    );
  }
  return token;
}

export default brick;
