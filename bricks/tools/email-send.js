/**
 * bricks/tools/email-send.js — Send emails via Resend
 *
 * Requires: RESEND_API_KEY, EMAIL_FROM in .env.local
 * Free tier: 3000 emails/month → https://resend.com
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "email-send",
  description:
    "Send an email to one or more recipients. " +
    "Use for sending reports, notifications, summaries, or any email communication. " +
    "Supports plain text and basic HTML. Always confirm with the user before sending.",

  requiredEnvVars: ["RESEND_API_KEY", "EMAIL_FROM"],

  parameters: z.object({
    to: z
      .union([z.string().email(), z.array(z.string().email()).min(1)])
      .describe("Recipient email address or array of addresses"),
    subject: z.string().min(1).max(200).describe("Email subject line"),
    body: z
      .string()
      .min(1)
      .max(50_000)
      .describe(
        "Email body. Plain text or basic HTML. Markdown will be converted to plain text."
      ),
    isHtml: z
      .boolean()
      .optional()
      .default(false)
      .describe("Set true if body contains HTML"),
    replyTo: z
      .string()
      .email()
      .optional()
      .describe("Reply-to address (optional)"),
  }),

  execute: async ({ to, subject, body, isHtml = false, replyTo }) => {
    const from = process.env.EMAIL_FROM;
    const recipients = Array.isArray(to) ? to : [to];

    const payload = {
      from,
      to: recipients,
      subject,
      ...(isHtml ? { html: body } : { text: body }),
      ...(replyTo ? { reply_to: replyTo } : {}),
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(
        `Resend API error ${res.status}: ${err.message ?? JSON.stringify(err)}`
      );
    }

    const data = await res.json();
    return {
      success: true,
      id: data.id,
      from,
      to: recipients,
      subject,
    };
  },

  onError: (err) =>
    `Failed to send email: ${err.message}. Check RESEND_API_KEY and EMAIL_FROM in .env.local.`,
};

export default brick;
