import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Clock,
  Edit,
  FileText,
  History,
  Inbox,
  Mail,
  MessageCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

const CHANNELS = [
  { id: "whatsapp", name: "WhatsApp", provider: "Gupshup", Icon: MessageCircle },
  { id: "sms", name: "SMS", provider: "MSG91", Icon: MessageSquare },
  { id: "email", name: "Email", provider: "AWS SES", Icon: Mail },
];

const CATEGORIES = ["general", "emergency", "attendance", "fees", "exam", "ptm"];

const STATUS_STYLES = {
  queued: "bg-neutral-100 text-neutral-700",
  sending: "bg-[#FFF1D6] text-[#8a5a00]",
  scheduled: "bg-[#E6F8F3] text-[#3a6a4a]",
  sent: "bg-[#E0E7FF] text-[#3a4ea0]",
  delivered: "bg-[#E6F8F3] text-[#3a6a4a]",
  read: "bg-[#D6F0EA] text-[#005a4a]",
  failed: "bg-[#FCE4E4] text-[#a93a3a]",
  opted_out: "bg-neutral-200 text-neutral-700",
  cancelled: "bg-neutral-200 text-neutral-700",
};

function StatusPill({ status }) {
  const cls = STATUS_STYLES[status] || "bg-neutral-100 text-neutral-700";
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {String(status || "").replace("_", " ")}
    </span>
  );
}

function ChannelChip({ channel }) {
  const def = CHANNELS.find((c) => c.id === channel);
  if (!def) return <span>{channel}</span>;
  const Icon = def.Icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-500">
      <Icon className="w-3 h-3" /> {def.name}
    </span>
  );
}

function rupee(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

const PLACEHOLDER_HINTS = [
  "{student_name}",
  "{parent_name}",
  "{class}",
  "{roll_no}",
  "{date}",
  "{school}",
];

function MessageDetailModal({ message, onClose, onRetried }) {
  const [deliveries, setDeliveries] = useState([]);
  const [filter, setFilter] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get(`/messages/${message.id}/deliveries`);
      setDeliveries(data);
    } catch (_) {
      toast.error("Could not load deliveries");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  const filtered = useMemo(() => {
    if (!filter) return deliveries;
    return deliveries.filter((d) => d.status === filter);
  }, [deliveries, filter]);

  const counts = useMemo(() => {
    const c = { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, opted_out: 0 };
    deliveries.forEach((d) => {
      c[d.status] = (c[d.status] || 0) + 1;
    });
    return c;
  }, [deliveries]);

  const retry = async () => {
    try {
      const { data } = await api.post(`/messages/${message.id}/retry-failed`);
      toast.success(`Retrying ${data.retried} failed deliveries`);
      onRetried?.();
      load();
    } catch (_) {
      toast.error("Retry failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-black/5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ChannelChip channel={message.channel} />
              <StatusPill status={message.status} />
              {message.category !== "general" && (
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                  {message.category}
                </span>
              )}
            </div>
            <h2 className="mt-1 text-lg font-display font-semibold">
              {message.title}
            </h2>
            <div className="text-xs text-neutral-500 mt-0.5">
              {new Date(message.created_at).toLocaleString("en-IN")}
              {message.created_by_name && ` · by ${message.created_by_name}`}
            </div>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-neutral-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
            {message.body}
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              ["queued", counts.queued, "neutral"],
              ["sent", counts.sent, "neutral"],
              ["delivered", counts.delivered, "green"],
              ["read", counts.read, "green"],
              ["failed", counts.failed, "red"],
              ["opted_out", counts.opted_out, "neutral"],
            ].map(([label, n]) => (
              <button
                key={label}
                onClick={() => setFilter(filter === label ? "" : label)}
                className={`text-center p-2 rounded-lg border text-xs transition ${
                  filter === label
                    ? "border-[#FF5E3A] bg-[#FFF3F0]"
                    : "border-black/5 hover:border-black/20"
                }`}
              >
                <div className="text-lg font-display font-semibold">{n}</div>
                <div className="capitalize text-[10px] text-neutral-500">
                  {label.replace("_", " ")}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              {filter ? (
                <>
                  Showing <span className="font-medium">{filtered.length}</span>{" "}
                  <span className="capitalize">{filter.replace("_", " ")}</span>{" "}
                  <button
                    onClick={() => setFilter("")}
                    className="text-xs text-[#FF5E3A] hover:underline ml-1"
                  >
                    clear
                  </button>
                </>
              ) : (
                <>{deliveries.length} deliveries</>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                disabled={refreshing}
                className="btn-ghost text-xs py-1.5"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
              {counts.failed > 0 && (
                <button onClick={retry} className="btn-ghost text-xs py-1.5">
                  Retry failed ({counts.failed})
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border border-black/5">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-neutral-500">
                No deliveries to show.
              </div>
            )}
            {filtered.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 px-3 py-2 border-b border-black/5 last:border-b-0 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">
                      {d.recipient_name}{" "}
                      {d.is_test && (
                        <span className="text-[10px] text-[#FF5E3A] font-medium">
                          (TEST)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {d.contact || "no contact"}
                    </div>
                  </div>
                  {d.failure_reason && (
                    <div className="text-[11px] text-[#a93a3a] mt-0.5">
                      {d.failure_reason}
                    </div>
                  )}
                </div>
                <StatusPill status={d.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({ value, onChange, onSave, onCancel }) {
  return (
    <div className="space-y-3">
      <input
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="Template name"
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={value.channel}
          onChange={(e) => onChange({ ...value, channel: e.target.value })}
          className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
        >
          {CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value })}
          className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={value.body}
        onChange={(e) => onChange({ ...value, body: e.target.value })}
        rows={5}
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm resize-none"
        placeholder="Body with placeholders. Click a chip below to insert."
      />
      <div className="flex flex-wrap gap-1.5">
        {PLACEHOLDER_HINTS.map((p) => (
          <button
            type="button"
            key={p}
            onClick={() =>
              onChange({
                ...value,
                body: (value.body || "") + p,
              })
            }
            className="text-[11px] px-2 py-0.5 bg-black/[0.04] hover:bg-black/[0.08] rounded text-neutral-700 font-mono"
          >
            {p}
          </button>
        ))}
      </div>
      {value.channel === "sms" && (
        <input
          value={value.dlt_id || ""}
          onChange={(e) => onChange({ ...value, dlt_id: e.target.value })}
          placeholder="DLT template ID (TRAI registration)"
          className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-xs font-mono"
        />
      )}
      {value.channel === "whatsapp" && (
        <input
          value={value.waba_id || ""}
          onChange={(e) => onChange({ ...value, waba_id: e.target.value })}
          placeholder="WhatsApp Business template name"
          className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-xs font-mono"
        />
      )}
      <div className="flex gap-2">
        <button onClick={onSave} className="btn-primary text-sm py-2 flex-1">
          <Save className="w-4 h-4" /> Save
        </button>
        {onCancel && (
          <button onClick={onCancel} className="btn-ghost text-sm py-2">
            Cancel
          </button>
        )}
      </div>
      <div className="text-[11px] text-neutral-500">
        New templates start in <span className="font-medium">pending approval</span>{" "}
        — they can be edited but not sent until approved by an admin.
      </div>
    </div>
  );
}

// Visual Phone & Desktop Client preview tool for premium user experience
function LiveDeviceMockup({ channel, title, body }) {
  const getProcessedBody = () => {
    if (!body) return <span className="text-neutral-400 italic">Start typing your message to see a live preview...</span>;
    const parts = body.split(/(\{student_name\}|\{parent_name\}|\{class\}|\{roll_no\}|\{date\}|\{school\})/g);
    return parts.map((part, index) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return (
          <span key={index} className="px-1 py-0.5 rounded bg-orange-100 text-orange-800 font-mono text-[9px] font-bold border border-orange-200/50">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (channel === "email") {
    return (
      <div className="w-full max-w-[280px] h-[390px] rounded-2xl border border-black/10 bg-slate-50 flex flex-col shadow-lg overflow-hidden anim-pop">
        <div className="bg-[#0A1128] text-white p-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-semibold">Email Preview</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <div className="bg-white border-b border-black/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-neutral-400 w-8">To:</span>
            <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 truncate max-w-[180px]">parent@aischool.io</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-neutral-400 w-8">Subject:</span>
            <span className="text-neutral-800 font-bold truncate max-w-[180px]">{title || "(No Subject)"}</span>
          </div>
        </div>
        <div className="p-3 bg-white flex-1 overflow-auto text-[10.5px] text-neutral-800 leading-relaxed font-sans">
          <div className="border-b border-neutral-100 pb-1.5 mb-2 text-[9px] text-neutral-400 flex items-center justify-between">
            <span>From: VidyaOS Mailer</span>
            <span>Just now</span>
          </div>
          <div className="whitespace-pre-wrap">{getProcessedBody()}</div>
        </div>
      </div>
    );
  }

  const isWhatsApp = channel === "whatsapp";
  return (
    <div className="relative mx-auto w-[240px] h-[390px] rounded-[32px] border-[6px] border-neutral-800 bg-neutral-900 shadow-xl overflow-hidden flex flex-col anim-pop">
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-neutral-800 rounded-full z-20 flex items-center justify-center">
        <div className="w-8 h-0.5 bg-neutral-900 rounded-full" />
      </div>
      <div className="flex-1 bg-[#efeae2] pt-6 flex flex-col justify-between overflow-hidden relative font-sans">
        {isWhatsApp ? (
          <>
            <div className="bg-[#075e54] text-white p-2 flex items-center gap-1 z-10 shadow-sm">
              <div className="w-5 h-5 rounded-full bg-[#FF5E3A] text-white grid place-items-center text-[9px] font-bold">Vi</div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold leading-tight truncate">VidyaOS Broadcast</div>
                <div className="text-[7.5px] text-emerald-200">Online</div>
              </div>
            </div>
            <div className="flex-1 p-2 overflow-y-auto space-y-1.5 flex flex-col justify-start">
              <div className="mx-auto bg-[#e1f3fc] text-[#4a4a4a] text-[8px] px-2 py-0.5 rounded shadow-sm text-center font-medium max-w-[90%]">
                🔒 Private & secure broadcast
              </div>
              <div className="self-start bg-white rounded-lg p-2 shadow-sm max-w-[85%] relative text-[10px] text-neutral-800 leading-normal">
                {title && <div className="font-bold text-[#075e54] border-b border-neutral-100 pb-1 mb-1 text-[9px]">{title}</div>}
                <div className="whitespace-pre-wrap">{getProcessedBody()}</div>
                <div className="text-right text-[7px] text-neutral-400 mt-1">Just now</div>
              </div>
            </div>
            <div className="bg-[#f0f0f0] p-1 flex items-center gap-1 border-t border-neutral-200">
              <div className="flex-1 bg-white rounded-full h-5 px-2 flex items-center text-[9px] text-neutral-400">Message...</div>
              <div className="w-5 h-5 rounded-full bg-[#075e54] grid place-items-center text-white text-[9px]">💬</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-neutral-100 text-neutral-800 p-1.5 text-center border-b border-neutral-200 z-10 font-medium text-[9px]">
              <div>Sender: <span className="font-bold">VD-VIDYAOS</span></div>
            </div>
            <div className="flex-1 p-2 overflow-y-auto space-y-1.5 flex flex-col justify-start bg-neutral-50">
              <div className="self-start bg-neutral-200 text-neutral-800 rounded-xl px-2.5 py-1.5 text-[9.5px] max-w-[85%] leading-normal">
                <div className="whitespace-pre-wrap">{getProcessedBody()}</div>
              </div>
              <div className="text-left text-[7px] text-neutral-400 pl-1.5">Just now · SMS</div>
            </div>
            <div className="bg-neutral-100 p-1 flex items-center gap-1 border-t border-neutral-200">
              <div className="flex-1 bg-white border border-neutral-300 rounded-full h-5 px-2 flex items-center text-[9px] text-neutral-400">Text Message</div>
              <div className="w-4.5 h-4.5 rounded-full bg-[#FF5E3A] grid place-items-center text-white text-[8px]">↑</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Communication() {
  const [tab, setTab] = useState("compose"); // compose | templates | history
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [classes, setClasses] = useState([]);
  const [optOuts, setOptOuts] = useState([]);
  const [q, setQ] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [cost, setCost] = useState(null);
  const [costLoading, setCostLoading] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showTestSend, setShowTestSend] = useState(false);
  const [testContact, setTestContact] = useState("");
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState({
    audience: "parents",
    channel: "whatsapp",
    title: "",
    body: "",
    class_id: "",
    section: "",
    scheduled_at: "",
    category: "general",
    template_id: "",
  });

  const load = async () => {
    const [m, t, c, oo] = await Promise.all([
      api.get("/messages"),
      api.get("/message-templates"),
      api.get("/classes"),
      api.get("/opt-outs").catch(() => ({ data: [] })),
    ]);
    setMessages(m.data);
    setTemplates(t.data);
    setClasses(c.data);
    setOptOuts(oo.data);
    setForm((v) => ({ ...v, class_id: v.class_id || c.data[0]?.id || "" }));
  };

  useEffect(() => {
    load().catch(() => toast.error("Unable to load communication portal"));
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  // Cost preview debounced
  useEffect(() => {
    if (!form.title && !form.body) {
      setCost(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCostLoading(true);
      try {
        const { data } = await api.post("/messages/cost-preview", buildPayload());
        setCost(data);
      } catch (_) {
        setCost(null);
      } finally {
        setCostLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.audience, form.channel, form.class_id, form.section, form.title, form.body]);

  const applyTemplate = (tpl) => {
    setForm((v) => ({
      ...v,
      title: tpl.name,
      body: tpl.body,
      channel: tpl.channel,
      category: tpl.category,
      template_id: tpl.id,
    }));
    setTab("compose");
    toast.success(`Loaded "${tpl.name}"`);
  };

  const filteredMessages = useMemo(() => {
    if (!q) return messages;
    const needle = q.toLowerCase();
    return messages.filter((m) =>
      `${m.title} ${m.body} ${m.channel} ${m.audience} ${m.category}`
        .toLowerCase()
        .includes(needle)
    );
  }, [messages, q]);

  const buildPayload = () => ({
    ...form,
    class_id: ["teachers", "all"].includes(form.audience) ? null : form.class_id || null,
    section: form.audience === "section" ? form.section || null : null,
    scheduled_at: form.scheduled_at || null,
  });

  // KPI tiles computed from real deliveries
  const stats = useMemo(() => {
    let delivered = 0,
      read = 0,
      failed = 0,
      scheduled = 0,
      sent = 0;
    messages.forEach((m) => {
      const c = m.delivery_counts || {};
      delivered += c.delivered || 0;
      read += c.read || 0;
      failed += c.failed || 0;
      sent += m.recipient_count || 0;
      if (m.status === "scheduled") scheduled += 1;
    });
    return { sent, delivered, read, failed, scheduled };
  }, [messages]);

  const doSend = async () => {
    setSending(true);
    try {
      const payload = buildPayload();
      const { data } = await api.post("/messages", payload);
      setMessages((items) => [data, ...items]);
      toast.success(
        form.scheduled_at
          ? `Scheduled for ${new Date(form.scheduled_at).toLocaleString("en-IN")}`
          : `Sending to ${cost?.deliverable ?? "—"} recipients`
      );
      setForm((v) => ({ ...v, title: "", body: "", scheduled_at: "", template_id: "" }));
      setShowSendConfirm(false);
      setTab("history");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const sendTest = async () => {
    if (!testContact) {
      toast.error("Enter a phone or email");
      return;
    }
    try {
      const payload = { ...buildPayload(), scheduled_at: null };
      const { data: draft } = await api.post("/messages", payload);
      await api.post(`/messages/${draft.id}/send-test`, {
        to: testContact,
        name: "Test recipient",
      });
      toast.success(`Test sent to ${testContact}`);
      setMessages((items) => [draft, ...items]);
      setShowTestSend(false);
      setTestContact("");
    } catch (err) {
      toast.error("Test send failed");
    }
  };

  const cancelScheduled = async (msg) => {
    if (!window.confirm(`Cancel scheduled message "${msg.title}"?`)) return;
    try {
      const { data } = await api.post(`/messages/${msg.id}/cancel`);
      setMessages((items) => items.map((m) => (m.id === msg.id ? data : m)));
      toast.success("Cancelled");
    } catch (_) {
      toast.error("Could not cancel");
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate?.name || !editingTemplate?.body) {
      toast.error("Name and body are required");
      return;
    }
    try {
      const isUpdate = !!editingTemplate.id;
      const url = isUpdate
        ? `/message-templates/${editingTemplate.id}`
        : "/message-templates";
      const method = isUpdate ? "patch" : "post";
      const { data } = await api[method](url, editingTemplate);
      setTemplates((items) => {
        const filtered = items.filter((t) => t.id !== data.id);
        return [data, ...filtered];
      });
      setEditingTemplate(null);
      toast.success(isUpdate ? "Template updated" : "Template saved");
    } catch (_) {
      toast.error("Save failed");
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await api.delete(`/message-templates/${id}`);
      setTemplates((items) => items.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (_) {
      toast.error("Delete failed");
    }
  };

  const approveTemplate = async (tpl) => {
    try {
      const { data } = await api.patch(`/message-templates/${tpl.id}`, {
        approval_status: "approved",
      });
      setTemplates((items) => items.map((t) => (t.id === tpl.id ? data : t)));
      toast.success("Template approved");
    } catch (_) {
      toast.error("Approval failed");
    }
  };

  const tabBtn = (id, label, Icon) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
        tab === id
          ? "bg-[#0A1128] text-white shadow-sm"
          : "text-neutral-600 hover:bg-black/[0.04]"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  const channelDef = CHANNELS.find((c) => c.id === form.channel);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="communication-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Messaging command center</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Communication Portal
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bulk WhatsApp, SMS, and Email with personalisation, scheduling, and
            per-recipient delivery tracking.
          </p>
        </div>
        <div className="flex gap-2">
          {tabBtn("compose", "Compose", Send)}
          {tabBtn("templates", "Templates", FileText)}
          {tabBtn("history", "History", History)}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Recipients", stats.sent, MessageCircle, "bg-[#0A1128] text-white"],
          ["Delivered", stats.delivered, CheckCheck, "bg-emerald-500 text-white"],
          ["Read", stats.read, CheckCircle2, "bg-indigo-500 text-white"],
          ["Failed", stats.failed, XCircle, "bg-rose-500 text-white"],
          ["Scheduled", stats.scheduled, Clock, "bg-amber-500 text-white"],
        ].map(([label, value, Icon, cls]) => (
          <div key={label} className="card-soft p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className={`w-9 h-9 rounded-lg grid place-items-center ${cls}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="mt-3 text-2xl font-display font-semibold">{value}</div>
            <div className="text-xs text-neutral-500">{label}</div>
          </div>
        ))}
      </div>

      {tab === "compose" && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="card-soft p-6 xl:col-span-2 space-y-4 shadow-sm border-black/[0.04]">
            <div className="label-eyebrow">Compose Message</div>

            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((c) => {
                const Icon = c.Icon;
                const active = form.channel === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setForm((v) => ({ ...v, channel: c.id }))}
                    className={`p-2 rounded-lg border text-left transition-all duration-200 ${
                      active
                        ? "border-[#FF5E3A] bg-[#FFF3F0] ring-1 ring-[#FF5E3A] text-[#0A1128]"
                        : "border-black/10 hover:border-black/30 text-neutral-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="w-4 h-4 shrink-0" /> {c.name}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      via {c.provider}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.audience}
                onChange={(e) =>
                  setForm((v) => ({ ...v, audience: e.target.value, section: "" }))
                }
                className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
              >
                <option value="parents">Parents</option>
                <option value="teachers">Teachers</option>
                <option value="students">Students</option>
                <option value="class">Class parents</option>
                <option value="section">Section parents</option>
                <option value="all">Everyone</option>
              </select>
              <select
                value={form.class_id}
                onChange={(e) =>
                  setForm((v) => ({ ...v, class_id: e.target.value }))
                }
                disabled={["teachers", "all"].includes(form.audience)}
                className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm disabled:opacity-50 focus:ring-brand outline-none"
              >
                <option value="">— all classes —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {form.audience === "section" && (
              <input
                value={form.section}
                onChange={(e) =>
                  setForm((v) => ({ ...v, section: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
                placeholder="Section, e.g. A"
              />
            )}

            <select
              value={form.category}
              onChange={(e) =>
                setForm((v) => ({ ...v, category: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm capitalize focus:ring-brand outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>

            <input
              value={form.title}
              onChange={(e) =>
                setForm((v) => ({ ...v, title: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
              placeholder="Message title (internal tracking)"
            />
            <textarea
              value={form.body}
              onChange={(e) =>
                setForm((v) => ({ ...v, body: e.target.value }))
              }
              rows={5}
              className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm resize-none focus:ring-brand outline-none font-sans leading-relaxed"
              placeholder="Body — use placeholders for personalisation. Click chips below to insert."
            />
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDER_HINTS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() =>
                    setForm((v) => ({ ...v, body: (v.body || "") + p }))
                  }
                  className="text-[11px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 active:scale-95 transition rounded text-neutral-700 font-mono border border-black/5"
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-neutral-500 font-medium">Schedule Broadcast (Optional)</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) =>
                  setForm((v) => ({ ...v, scheduled_at: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
              />
            </div>


            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowSendConfirm(true)}
                disabled={!form.title || !form.body || !cost?.deliverable}
                className="btn-primary text-sm py-2.5 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {form.scheduled_at ? "Schedule" : "Send"}
                {cost?.deliverable ? ` to ${cost.deliverable}` : ""}
              </button>
              <button
                onClick={() => setShowTestSend(true)}
                disabled={!form.title || !form.body}
                className="btn-ghost text-sm py-2.5"
              >
                <Inbox className="w-4 h-4" /> Send test
              </button>
            </div>
          </div>

          {/* Dynamic Interactive device/client live preview panel */}
          <div className="card-soft p-5 flex flex-col items-center justify-start bg-neutral-50/50 border border-black/5 shadow-sm">
            <div className="label-eyebrow mb-4 self-start">Interactive Preview</div>
            <div className="flex-1 w-full flex items-center justify-center py-2">
              <LiveDeviceMockup channel={form.channel} title={form.title} body={form.body} />
            </div>
            <div className="mt-4 text-center text-[11px] text-neutral-400 italic">
              Values in <span className="font-semibold text-[#FF5E3A]">{"{brackets}"}</span> will merge with personal profile details at send time.
            </div>
          </div>

          <div className="space-y-4">
            <div className="card-soft p-5">
              <div className="label-eyebrow">Cost preview</div>
              {costLoading && (
                <div className="text-xs text-neutral-500 mt-2">Calculating…</div>
              )}
              {!costLoading && cost && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-neutral-500">
                        via {cost.provider}
                      </div>
                      <div className="text-2xl font-display font-semibold">
                        {rupee(cost.total)}
                      </div>
                    </div>
                    {channelDef && (
                      <channelDef.Icon className="w-8 h-8 text-neutral-300" />
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {cost.deliverable} × {rupee(cost.rate_per_message)} ={" "}
                    {rupee(cost.subtotal)} · GST 18% {rupee(cost.gst)}
                  </div>
                  {cost.missing_contact > 0 && (
                    <div className="rounded-lg bg-[#FFF1D6] text-[#8a5a00] text-xs p-2 flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {cost.missing_contact} of {cost.total_audience} recipients
                      don't have a {channelDef?.name.toLowerCase()} contact on
                      file and will be marked failed.
                    </div>
                  )}
                </div>
              )}
              {!costLoading && !cost && (
                <div className="text-xs text-neutral-500 mt-2">
                  Add a title and body to preview cost.
                </div>
              )}
            </div>

            {form.category === "emergency" && (
              <div className="card-soft p-5 bg-[#FFF3F0]">
                <div className="flex items-start gap-2 text-sm text-[#a93a3a]">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">Emergency category</div>
                    <div className="text-xs mt-1">
                      Emergency messages bypass quiet-hours and DND for SMS in
                      production. They're flagged in the delivery ledger so
                      admins can audit usage.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card-soft p-5">
              <div className="label-eyebrow">Quick templates</div>
              <div className="mt-3 space-y-2 max-h-80 overflow-auto">
                {templates
                  .filter((t) => t.approval_status === "approved")
                  .filter((t) => t.channel === form.channel)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left rounded-lg border border-black/5 p-3 hover:bg-black/[0.02]"
                    >
                      <div className="text-sm font-medium truncate">{t.name}</div>
                      <div className="text-xs text-neutral-500 capitalize">
                        {t.category}
                      </div>
                    </button>
                  ))}
                {templates.filter((t) => t.channel === form.channel && t.approval_status === "approved").length === 0 && (
                  <div className="text-xs text-neutral-500">
                    No approved templates for {channelDef?.name} yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card-soft p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="label-eyebrow">Templates</div>
              <button
                onClick={() =>
                  setEditingTemplate({
                    name: "",
                    channel: "whatsapp",
                    category: "general",
                    body: "",
                  })
                }
                className="btn-ghost text-xs py-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-black/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate text-sm">{t.name}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <ChannelChip channel={t.channel} />
                      <span className="text-[10px] text-neutral-400">·</span>
                      <span className="text-[10px] capitalize text-neutral-500">
                        {t.category}
                      </span>
                    </div>
                    <div className="mt-1">
                      <StatusPill status={t.approval_status} />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingTemplate({ ...t })}
                      className="p-1 text-neutral-500 hover:text-neutral-800"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="p-1 text-neutral-500 hover:text-[#a93a3a]"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {t.approval_status === "pending_approval" && (
                  <button
                    onClick={() => approveTemplate(t)}
                    className="mt-2 text-xs text-[#FF5E3A] hover:underline"
                  >
                    Approve
                  </button>
                )}
              </div>
            ))}
            {templates.length === 0 && (
              <div className="text-sm text-neutral-500">
                No templates yet — click New.
              </div>
            )}
          </div>

          <div className="card-soft p-6 xl:col-span-2">
            {editingTemplate ? (
              <>
                <div className="label-eyebrow mb-4">
                  {editingTemplate.id ? "Edit template" : "New template"}
                </div>
                <TemplateEditor
                  value={editingTemplate}
                  onChange={setEditingTemplate}
                  onSave={saveTemplate}
                  onCancel={() => setEditingTemplate(null)}
                />
              </>
            ) : (
              <div className="text-sm text-neutral-500 p-8 text-center">
                Pick a template on the left or create a new one.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="card-soft overflow-hidden">
          <div className="p-5 border-b border-black/5 flex items-center justify-between gap-3">
            <div>
              <div className="label-eyebrow">History</div>
              <div className="text-sm text-neutral-500 mt-1">
                Click any message to see per-recipient delivery status.
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-black/10 w-64">
              <Search className="w-4 h-4 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages"
                className="bg-transparent text-sm w-full outline-none"
              />
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-black/5">
            {filteredMessages.map((m) => {
              const c = m.delivery_counts || {};
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMessage(m)}
                  className="w-full text-left p-4 hover:bg-black/[0.02] transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ChannelChip channel={m.channel} />
                        <StatusPill status={m.status} />
                        {m.category !== "general" && (
                          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                            {m.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-medium">{m.title}</div>
                      <div className="text-sm text-neutral-600 mt-0.5 line-clamp-2">
                        {m.body}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-500">
                        <span>{m.recipient_count || 0} recipients</span>
                        {c.delivered > 0 && (
                          <span className="text-[#3a6a4a]">
                            <CheckCheck className="inline w-3 h-3" /> {c.delivered}{" "}
                            delivered
                          </span>
                        )}
                        {c.read > 0 && (
                          <span className="text-[#005a4a]">
                            <CheckCircle2 className="inline w-3 h-3" /> {c.read} read
                          </span>
                        )}
                        {c.failed > 0 && (
                          <span className="text-[#a93a3a]">
                            <XCircle className="inline w-3 h-3" /> {c.failed} failed
                          </span>
                        )}
                        <span>
                          {new Date(m.created_at).toLocaleString("en-IN")}
                        </span>
                        {m.created_by_name && <span>by {m.created_by_name}</span>}
                      </div>
                    </div>
                    {m.status === "scheduled" && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelScheduled(m);
                        }}
                        className="text-xs text-[#a93a3a] hover:underline cursor-pointer"
                      >
                        Cancel
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {filteredMessages.length === 0 && (
              <div className="text-sm text-neutral-500 p-6 text-center">
                No messages match.
              </div>
            )}
          </div>
        </div>
      )}

      {selectedMessage && (
        <MessageDetailModal
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onRetried={load}
        />
      )}

      {showSendConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => setShowSendConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[#FF5E3A]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-display text-lg font-semibold">
                Confirm send
              </h3>
            </div>
            <div className="mt-3 text-sm text-neutral-700">
              You're about to {form.scheduled_at ? "schedule" : "send"} a
              <span className="font-semibold"> {channelDef?.name}</span> message
              to <span className="font-semibold">{cost?.deliverable || 0}</span>{" "}
              recipients.
            </div>
            {cost && (
              <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs">
                Cost: <span className="font-semibold">{rupee(cost.total)}</span> (
                {cost.deliverable} × {rupee(cost.rate_per_message)} + GST)
              </div>
            )}
            {cost?.missing_contact > 0 && (
              <div className="mt-2 text-xs text-[#8a5a00]">
                {cost.missing_contact} recipients have no contact on file.
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowSendConfirm(false)}
                className="btn-ghost text-sm py-2 flex-1"
              >
                Cancel
              </button>
              <button
                onClick={doSend}
                disabled={sending}
                className="btn-primary text-sm py-2 flex-1 disabled:opacity-50"
              >
                {sending ? "Sending…" : form.scheduled_at ? "Schedule" : "Send now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTestSend && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => setShowTestSend(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Send test</h3>
            <div className="mt-2 text-sm text-neutral-500">
              Sends a single test delivery (no charge to the rest of the audience)
              to verify formatting before a bulk send.
            </div>
            <input
              value={testContact}
              onChange={(e) => setTestContact(e.target.value)}
              placeholder={
                form.channel === "email" ? "test@example.com" : "+919876543210"
              }
              className="mt-3 w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowTestSend(false)}
                className="btn-ghost text-sm py-2 flex-1"
              >
                Cancel
              </button>
              <button
                onClick={sendTest}
                className="btn-primary text-sm py-2 flex-1"
              >
                Send test
              </button>
            </div>
          </div>
        </div>
      )}

      {optOuts.length > 0 && (
        <div className="card-soft p-4 text-xs text-neutral-500 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" />
          {optOuts.length} contacts have opted out. They're automatically
          excluded from every send.
        </div>
      )}
    </div>
  );
}
