import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, Loader2, Brain, Activity } from "lucide-react";

export default function AIInsights() {
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true); setOut("");
    try {
      const { data } = await api.post("/ai/insights", {});
      setOut(data.insights);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6" data-testid="ai-insights-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Principal's brief</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">AI Intelligence Brief</h1>
          <p className="mt-1 text-sm text-neutral-500">5 bullets + 1 risk flag, generated from live school data.</p>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary text-sm py-2.5 disabled:opacity-60" data-testid="generate-insights">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate brief</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-soft p-6 lg:col-span-2 min-h-[300px]">
          <div className="flex items-center gap-2 text-[#FF5E3A]"><Brain className="w-5 h-5" /><div className="font-display text-lg font-semibold text-[#0A1128]">Today's brief</div></div>
          <div className="mt-4">
            {!out && !loading && <div className="text-sm text-neutral-500">Click generate to receive your daily AI-curated executive summary.</div>}
            {loading && <div className="space-y-2"><div className="h-3 bg-black/5 rounded animate-pulse" /><div className="h-3 bg-black/5 rounded w-5/6 animate-pulse" /><div className="h-3 bg-black/5 rounded w-3/4 animate-pulse" /><div className="h-3 bg-black/5 rounded w-2/3 animate-pulse" /></div>}
            {out && <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans" data-testid="insights-output">{out}</pre>}
          </div>
        </div>

        <div className="card-soft p-6 !bg-[#0A1128] text-white relative overflow-hidden">
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-[#FF5E3A]/30 rounded-full blur-3xl" />
          <div className="relative">
            <div className="label-eyebrow text-white/60 flex items-center gap-2"><Activity className="w-3 h-3" /> Pulse</div>
            <h3 className="font-display text-lg font-semibold mt-1">What the AI is watching</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#FF5E3A] mt-2" /> Attendance dips in Class 9-A</li>
              <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#FF5E3A] mt-2" /> Pending fees concentration</li>
              <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#FF5E3A] mt-2" /> Subject weakness clusters</li>
              <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-[#FF5E3A] mt-2" /> Teacher workload anomalies</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
