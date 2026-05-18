import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Send, MessageSquareText, Loader2, Sparkles } from "lucide-react";

const SUGGESTED = [
  "What's my child's attendance this month?",
  "Are there any pending fees?",
  "How did my child do in the last exam?",
  "Show me the next exam schedule",
];

export default function AIParent() {
  const [sessionId] = useState(() => "p-" + Math.random().toString(36).slice(2, 10));
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Namaste! I'm AI Saathi. Ask me anything about your child's school life — attendance, fees, marks, schedules. How can I help?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput(""); setLoading(true);
    try {
      const { data } = await api.post("/ai/parent-chat", { session_id: sessionId, message: msg });
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "AI failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" data-testid="ai-parent-page">
      <div>
        <div className="label-eyebrow">Conversational AI</div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">AI Saathi</h1>
        <p className="mt-1 text-sm text-neutral-500">Your child's personal school concierge. Ask in any language.</p>
      </div>

      <div className="card-soft flex flex-col h-[70vh] overflow-hidden">
        <div ref={ref} className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="chat-thread">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="w-9 h-9 rounded-xl bg-[#E05236] grid place-items-center text-white shrink-0"><Sparkles className="w-4 h-4" /></div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-[#0A1128] text-white rounded-br-md" : "bg-black/[0.04] text-[#0A1128] rounded-bl-md"
              }`}>{m.text}</div>
              {m.role === "user" && (
                <div className="w-9 h-9 rounded-xl bg-[#0A1128] grid place-items-center text-white shrink-0 text-sm font-medium">Y</div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E05236] grid place-items-center text-white"><Loader2 className="w-4 h-4 animate-spin" /></div>
              <div className="bg-black/[0.04] rounded-2xl px-4 py-3 text-sm">Thinking…</div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full border border-black/10 hover:border-[#E05236] hover:text-[#E05236] bg-white" data-testid={`suggested-${s.slice(0,10)}`}>{s}</button>
            ))}
          </div>
        )}

        <div className="border-t border-black/5 p-4 flex items-center gap-2">
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask anything…"
            className="flex-1 px-4 py-3 rounded-full bg-black/[0.04] outline-none text-sm focus:ring-2 focus:ring-[#E05236]/30"
            data-testid="chat-input"
          />
          <button onClick={() => send()} disabled={loading} className="w-11 h-11 rounded-full bg-[#E05236] grid place-items-center text-white hover:bg-[#C8432A] disabled:opacity-60" aria-label="send" data-testid="chat-send"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
