import * as z from "zod";

export default {
  name: "google-search",
  description: "Search the live web with Google grounding. Use this whenever the user asks for current, recent, online, factual, price, news, availability, website, or other information that may have changed.",
  requiredEnvVars: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  parameters: z.object({ query: z.string().min(2).max(2000).describe("The web search question or query") }),
  async execute({ query }) {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const model = process.env.AI_MODEL || "gemini-3.8-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Google search failed (${res.status})`);
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text || "").join("").trim() || "No grounded answer returned.";
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map(c => c.web).filter(Boolean).map(w => ({ title: w.title, url: w.uri }));
    return { answer: text, sources };
  }
};
