const config = {
  model: { provider: "gemini", model: "gemini-3.8-flash", temperature: 0.7, maxTokens: 4096 },
  memory: { shortTerm: true, longTerm: false, knowledgeBase: false },
  bricks: [
    "calculator",
    "date-time",
    "text-utils",
    "google-search"
  ],
  workflows: [],
  ui: {
    theme: "system",
    showToolCalls: true,
    showThinking: true,
    branding: true,
    suggestedPrompts: [
      "Search the web for today's biggest AI news",
      "What tools can you actually use right now?",
      "Research something for me online"
    ]
  },
  systemPrompt: `You are a capable tool-using AI agent, not merely a chatbot. Use your available tools proactively. For anything current, recent, online, time-sensitive, news-related, pricing-related, availability-related, or when the user explicitly asks you to search/check online, use google-search rather than relying on memory. Never claim to have a capability that is not actually available. When asked what you can do, describe the tools and capabilities you truly have in this deployment. Be concise unless the user asks for detail.`,
  persona: "assistant"
};
export default config;
