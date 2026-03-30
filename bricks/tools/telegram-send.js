/**
 * bricks/tools/telegram-send.js — Send Telegram messages
 *
 * Requires: TELEGRAM_BOT_TOKEN in .env.local
 * Create a bot via @BotFather on Telegram — it's free.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "telegram-send",
  description:
    "Send a message or file to a Telegram chat. " +
    "Use for notifications, alerts, reports, or any outbound Telegram communication. " +
    "Requires knowing the target chat ID.",

  requiredEnvVars: ["TELEGRAM_BOT_TOKEN"],

  parameters: z.object({
    chatId: z
      .union([z.string(), z.number()])
      .describe(
        "The Telegram chat ID to send to. " +
          "Users can find their chat ID by messaging @userinfobot on Telegram."
      ),
    message: z
      .string()
      .min(1)
      .max(4_096)
      .describe("The message text. Supports Telegram Markdown (bold, italic, links)."),
    parseMode: z
      .enum(["Markdown", "MarkdownV2", "HTML", "None"])
      .optional()
      .default("Markdown")
      .describe("Text formatting mode"),
    disablePreview: z
      .boolean()
      .optional()
      .default(false)
      .describe("Disable link previews in the message"),
  }),

  execute: async ({ chatId, message, parseMode = "Markdown", disablePreview = false }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const body = {
      chat_id: chatId,
      text: message,
      disable_web_page_preview: disablePreview,
    };
    if (parseMode !== "None") {
      body.parse_mode = parseMode;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.ok) {
      throw new Error(
        `Telegram API error ${data.error_code}: ${data.description}`
      );
    }

    return {
      success: true,
      messageId: data.result?.message_id,
      chatId,
      sentAt: new Date().toISOString(),
    };
  },

  onError: (err) =>
    `Telegram send failed: ${err.message}. Verify TELEGRAM_BOT_TOKEN and the chat ID.`,
};

export default brick;
