"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [cfg, setCfg] = useState({ model: "gemini-3.8-flash", systemPrompt: "", temperature: 0.7 });

  useEffect(() => {
    const saved = localStorage.getItem("agentkit-settings");
    if (saved) { try { setCfg((x) => ({ ...x, ...JSON.parse(saved) })); } catch {} }
    fetch("/api/settings/models").then(r => r.json()).then(d => setModels(d.models || [])).catch(() => setStatus("Could not load models")).finally(() => setLoading(false));
  }, []);

  function save() {
    localStorage.setItem("agentkit-settings", JSON.stringify(cfg));
    setStatus("Saved");
    setTimeout(() => setStatus(""), 1800);
  }

  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div><p className="text-sm text-muted-foreground">AgentKit Control Center</p><h1 className="text-3xl font-semibold">Settings</h1></div>
        <Link href="/" className="rounded-xl border px-4 py-2 text-sm hover:bg-muted">← Chat</Link>
      </div>

      <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <div><h2 className="text-lg font-medium">AI model</h2><p className="text-sm text-muted-foreground">Models available to the Gemini key stored securely on Vercel.</p></div>
        <label className="block text-sm">Gemini model
          <select className="mt-2 w-full rounded-xl border bg-background p-3" value={cfg.model} onChange={e => setCfg({...cfg, model:e.target.value})}>
            {loading && <option>Loading models…</option>}
            {!loading && models.length === 0 && <option value="gemini-3.8-flash">gemini-3.8-flash</option>}
            {models.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
          </select>
        </label>
        <label className="block text-sm">System prompt
          <textarea rows="6" className="mt-2 w-full rounded-xl border bg-background p-3" placeholder="How should your agent behave?" value={cfg.systemPrompt} onChange={e => setCfg({...cfg, systemPrompt:e.target.value})}/>
        </label>
        <label className="block text-sm">Temperature: {cfg.temperature}
          <input className="mt-2 w-full" type="range" min="0" max="1" step="0.1" value={cfg.temperature} onChange={e => setCfg({...cfg, temperature:Number(e.target.value)})}/>
        </label>
        <button onClick={save} className="rounded-xl bg-foreground px-5 py-3 text-background">Save settings</button>
        {status && <span className="ml-3 text-sm text-muted-foreground">{status}</span>}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border p-5"><h3 className="font-medium">Gemini</h3><p className="mt-1 text-sm text-muted-foreground">API key is stored server-side in Vercel and is never shown here.</p><p className="mt-3 text-sm">● Connected</p></div>
        <div className="rounded-2xl border p-5"><h3 className="font-medium">WhatsApp / A2A</h3><p className="mt-1 text-sm text-muted-foreground">Agent endpoints are exposed and ready for connector configuration.</p><p className="mt-3 text-sm">/api/a2a</p></div>
      </section>
    </div>
  </main>;
}
