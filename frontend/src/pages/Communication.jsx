import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, CheckCheck, Clock, MessageCircle, Search, Send, Smartphone } from "lucide-react";

const channels = [
  ["whatsapp", "WhatsApp"],
  ["sms", "SMS"],
  ["zoho", "Zoho Message"],
];

export default function Communication() {
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [classes, setClasses] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ audience: "parents", channel: "whatsapp", title: "", body: "", class_id: "", scheduled_at: "", category: "general" });

  const load = async () => {
    const [m, t, c] = await Promise.all([api.get("/communications"), api.get("/communication-templates"), api.get("/classes")]);
    setMessages(m.data);
    setTemplates(t.data);
    setClasses(c.data);
    setForm((v) => ({ ...v, class_id: v.class_id || c.data[0]?.id || "" }));
  };

  useEffect(() => { load().catch(() => toast.error("Unable to load communication portal")); }, []);

  const filtered = useMemo(() => messages.filter((m) => {
    const text = `${m.title} ${m.body} ${m.channel} ${m.audience}`.toLowerCase();
    return text.includes(q.toLowerCase());
  }), [messages, q]);

  const send = async (e) => {
    e.preventDefault();
    const payload = { ...form, scheduled_at: form.scheduled_at || null };
    const { data } = await api.post("/communications", payload);
    setMessages((items) => [data, ...items]);
    setForm((v) => ({ ...v, title: "", body: "", scheduled_at: "" }));
    toast.success(form.scheduled_at ? "Message scheduled" : "Bulk message sent");
  };

  const applyTemplate = (template) => setForm((v) => ({ ...v, title: template.title, body: template.body, category: template.category }));

  const stats = {
    sent: messages.length,
    delivered: messages.filter((m) => ["delivered", "read"].includes(m.delivery_status)).length,
    read: messages.filter((m) => m.read_status === "partial" || m.delivery_status === "read").length,
    scheduled: messages.filter((m) => m.scheduled_at).length,
  };

  return (
    <div className="space-y-6" data-testid="communication-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Messaging command center</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Communication Portal</h1>
          <p className="mt-1 text-sm text-neutral-500">Send WhatsApp, SMS, and Zoho messages with history, templates, and delivery tracking.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-black/10 w-72">
          <Search className="w-4 h-4 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" className="bg-transparent text-sm w-full outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Sent", stats.sent, MessageCircle, "bg-[#0A1128] text-white"],
          ["Delivered", stats.delivered, CheckCheck, "bg-[#E5EFE8] text-[#4A7C59]"],
          ["Read", stats.read, Smartphone, "bg-[#FBE9E3] text-[#E05236]"],
          ["Scheduled", stats.scheduled, Clock, "bg-white text-[#0A1128]"],
        ].map(([label, value, Icon, cls]) => (
          <div key={label} className="card-soft p-5">
            <div className={`w-10 h-10 rounded-xl grid place-items-center ${cls}`}><Icon className="w-5 h-5" /></div>
            <div className="mt-4 text-3xl font-display font-semibold">{value}</div>
            <div className="text-sm text-neutral-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form onSubmit={send} className="card-soft p-6 space-y-4">
          <div>
            <div className="label-eyebrow">Compose</div>
            <h3 className="font-display text-xl font-semibold mt-1">Bulk Message</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.audience} onChange={(e) => setForm((v) => ({ ...v, audience: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
              <option value="parents">Parents</option><option value="teachers">Teachers</option><option value="students">Students</option><option value="class">Class</option><option value="all">Everyone</option>
            </select>
            <select value={form.channel} onChange={(e) => setForm((v) => ({ ...v, channel: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
              {channels.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          {form.audience === "class" && <select value={form.class_id} onChange={(e) => setForm((v) => ({ ...v, class_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>}
          <select value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
            <option value="general">General</option><option value="emergency">Emergency</option><option value="attendance">Attendance alert</option><option value="fees">Fee reminder</option><option value="exam">Exam notification</option>
          </select>
          <input required value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Message title" />
          <textarea required value={form.body} onChange={(e) => setForm((v) => ({ ...v, body: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm resize-none" rows={5} placeholder="Write your announcement..." />
          <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((v) => ({ ...v, scheduled_at: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" />
          <button className="w-full btn-primary text-sm py-2.5"><Send className="w-4 h-4" /> {form.scheduled_at ? "Schedule Message" : "Send Message"}</button>
        </form>

        <div className="card-soft p-6 space-y-3">
          <div className="label-eyebrow">Templates</div>
          {templates.map((template) => (
            <button key={template.title} onClick={() => applyTemplate(template)} className="w-full text-left rounded-xl border border-black/5 p-4 hover:bg-black/[0.02]">
              <div className="font-medium">{template.title}</div>
              <div className="mt-1 text-sm text-neutral-500 line-clamp-2">{template.body}</div>
            </button>
          ))}
          <div className="rounded-xl bg-[#FBE9E3] p-4 text-sm text-[#E05236] flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> Emergency templates are highlighted in delivery dashboards.</div>
        </div>

        <div className="card-soft overflow-hidden">
          <div className="p-5 border-b border-black/5">
            <div className="label-eyebrow">History</div>
            <h3 className="font-display text-xl font-semibold mt-1">Message Stream</h3>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-4 space-y-3">
            {filtered.map((m) => (
              <div key={m.id} className="rounded-2xl bg-[#E5EFE8] p-4 ml-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{m.title}</div>
                  <span className="text-[11px] uppercase tracking-wider text-[#4A7C59]">{m.channel}</span>
                </div>
                <div className="mt-1 text-sm text-neutral-700">{m.body}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                  <span>{m.recipient_count} recipients</span><span>{m.delivery_status}</span><span>{m.read_status}</span><span>{new Date(m.created_at).toLocaleString("en-IN")}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-sm text-neutral-500 p-6 text-center">No messages yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
