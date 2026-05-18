import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Bot, BookOpen, FileText, MessageSquare, Sparkles, Loader2, Copy } from "lucide-react";

const TASKS = [
  { id: "lesson_plan", label: "Lesson plan", icon: BookOpen, desc: "40-min plan with Bloom & assessment ideas" },
  { id: "question_paper", label: "Question paper", icon: FileText, desc: "CBSE/ICSE-pattern with answer key" },
  { id: "assignment", label: "Assignment", icon: FileText, desc: "Mixed-difficulty homework" },
  { id: "report_comment", label: "Report card comments", icon: MessageSquare, desc: "5 personalized comments" },
];

export default function AITeacher() {
  const [task, setTask] = useState("lesson_plan");
  const [subject, setSubject] = useState("Mathematics");
  const [grade, setGrade] = useState("9");
  const [topic, setTopic] = useState("Quadratic Equations");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const generate = async () => {
    setLoading(true); setOutput("");
    try {
      const { data } = await api.post("/ai/teacher", { task, subject, grade, topic, extra });
      setOutput(data.output);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "AI failed");
    } finally { setLoading(false); }
  };

  const copy = () => { navigator.clipboard.writeText(output); toast.success("Copied"); };

  return (
    <div className="space-y-6" data-testid="ai-teacher-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">AI Copilot</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Teacher Copilot</h1>
          <p className="mt-1 text-sm text-neutral-500">Lesson plans, papers, comments — drafted in seconds.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#0A1128] text-white text-xs"><Sparkles className="w-3 h-3" /> Powered by GPT-5.2</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {TASKS.map((t) => (
          <button key={t.id} onClick={() => setTask(t.id)} className={`text-left card-soft p-5 transition ${task === t.id ? "ring-2 ring-[#E05236] !bg-[#FBE9E3]" : "hover:-translate-y-0.5"}`} data-testid={`task-${t.id}`}>
            <t.icon className={`w-6 h-6 ${task === t.id ? "text-[#E05236]" : "text-[#0A1128]"}`} strokeWidth={1.5} />
            <div className="mt-3 font-display font-semibold">{t.label}</div>
            <div className="text-xs text-neutral-500 mt-1">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="card-soft p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-neutral-600">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-[#E05236]/30 focus:border-[#E05236]" data-testid="ai-subject" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600">Grade</label>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-[#E05236]/30 focus:border-[#E05236]" data-testid="ai-grade" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600">Topic</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-[#E05236]/30 focus:border-[#E05236]" data-testid="ai-topic" />
          </div>
        </div>
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="Any extra context (optional)" className="mt-3 w-full px-4 py-3 rounded-xl border border-black/10 bg-white outline-none resize-none focus:ring-2 focus:ring-[#E05236]/30" data-testid="ai-extra" />
        <div className="mt-4 flex justify-end">
          <button onClick={generate} disabled={loading} className="btn-primary text-sm py-2.5 disabled:opacity-60" data-testid="generate-ai">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate</>}
          </button>
        </div>
      </div>

      <div className="card-soft p-6 min-h-[280px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Bot className="w-5 h-5 text-[#E05236]" /><div className="font-display text-lg font-semibold">Output</div></div>
          {output && <button onClick={copy} className="text-xs inline-flex items-center gap-1 text-neutral-600 hover:text-[#0A1128]" data-testid="copy-ai-output"><Copy className="w-3.5 h-3.5" /> Copy</button>}
        </div>
        <div className="mt-4">
          {!output && !loading && <div className="text-sm text-neutral-500">Pick a task and hit generate. Output will appear here.</div>}
          {loading && <div className="space-y-2"><div className="h-3 bg-black/5 rounded animate-pulse" /><div className="h-3 bg-black/5 rounded w-5/6 animate-pulse" /><div className="h-3 bg-black/5 rounded w-2/3 animate-pulse" /></div>}
          {output && <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-[#0A1128]" data-testid="ai-output">{output}</pre>}
        </div>
      </div>
    </div>
  );
}
