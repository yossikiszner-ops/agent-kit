/**
 * bricks/tools/slack-send.js — Send Slack messages
 *
 * Two modes:
 *   Webhook mode (simpler): set SLACK_WEBHOOK_URL — posts to one fixed channel
 *   Bot mode (flexible):    set SLACK_BOT_TOKEN — post to any channel
 *
 * Webhook URL: Slack app → Incoming Webhooks → Add New Webhook
 * Bot token: Slack app → OAuth & Permissions → Bot User OAuth Token
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "slack-send",
  description:
    "Send a message to a Slack channel or user. " +
    "Use for team notifications, alerts, summaries, or automated updates. " +
    "Supports Slack markdown (bold, italic, code blocks, mentions).",

  // At least one of these must be set — checked at runtime, not startup
  requiredEnvVars: [],

  parameters: z.object({
    message: z
      .string()
      .min(1)
      .max(4_000)
      .describe(
        "Message text. Supports Slack mrkdwn: *bold*, _italic_, `code`, ```blocks```, <@U123> mentions."
      ),
    channel: z
      .string()
      .optional()
      .describe(
        "Channel name (#general) or ID (C123). Required when using SLACK_BOT_TOKEN. " +
          "Not needed when using SLACK_WEBHOOK_URL (webhook has a fixed channel)."
      ),
    username: z
      .string()
      .optional()
      .describe("Display name override for the message (webhook mode only)"),
    iconEmoji: z
      .string()
      .optional()
      .describe("Emoji icon for the message, e.g. ':robot_face:' (webhook mode only)"),
  }),

  execute: async ({ message, channel, username, iconEmoji }) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const botToken = process.env.SLACK_BOT_TOKEN;

    if (!webhookUrl && !botToken) {
      throw new Error(
        "No Slack credentials configured. " +
          "Set SLACK_WEBHOOK_URL (simple) or SLACK_BOT_TOKEN (flexible) in .env.local.\n" +
          "  Webhook: https://api.slack.com/messaging/webhooks\n" +
          "  Bot token: https://api.slack.com/authentication/token-types#bot"
      );
    }

    // Prefer webhook if set (simpler)
    if (webhookUrl) {
      const payload = { text: message };
      if (username) {
        payload.username = username;
      }
      if (iconEmoji) {
        payload.icon_emoji = iconEmoji;
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Slack webhook error ${res.status}: ${text}`);
      }

      return { success: true, mode: "webhook" };
    }

    // Bot token mode — requires a channel
    if (!channel) {
      throw new Error(
        "Provide a channel name or ID when using SLACK_BOT_TOKEN. " +
          "Example: '#general' or 'C123ABC'"
      );
    }

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel,
        text: message,
        mrkdwn: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return {
      success: true,
      mode: "bot",
      channel: data.channel,
      messageTs: data.ts,
    };
  },

  onError: (err) =>
    `Slack message failed: ${err.message}. Check SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN in .env.local.`,
};

export default brick;
