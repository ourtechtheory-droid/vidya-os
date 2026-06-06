import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Inbox,
  LifeBuoy,
  Send,
  ShieldCheck,
} from "lucide-react";

const MODULE_OPTIONS = [
  "Dashboard",
  "Teachers",
  "Classes",
  "Students",
  "Attendance",
  "Exams & Marks",
  "Fees",
  "Circulars",
  "Timetable",
  "Communication",
  "Certificates",
  "AI Teacher Copilot",
  "AI Saathi",
  "AI Insights",
  "Login / Account",
  "Other",
];

const CATEGORY_OPTIONS = [
  { value: "mistake", label: "Mistake" },
  { value: "website_change", label: "Website change" },
  { value: "bug", label: "Bug" },
  { value: "access", label: "Access issue" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_STYLES = {
  open: "bg-[#FFF3F0] text-[#FF5E3A] border-[#FF5E3A]/20",
  in_progress: "bg-[#FFF8E7] text-[#B7791F] border-[#F59E0B]/20",
  resolved: "bg-[#E6F8F3] text-[#047857] border-[#10B981]/20",
  closed: "bg-neutral-100 text-neutral-600 border-black/10",
};

const PRIORITY_STYLES = {
  low: "bg-neutral-100 text-neutral-600",
  medium: "bg-[#EEF2FF] text-[#3730A3]",
  high: "bg-[#FFF3F0] text-[#C2410C]",
};

const roleLabel = (role = "") => role.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const statusLabel = (status = "") => STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
const categoryLabel = (category = "") => CATEGORY_OPTIONS.find((c) => c.value === category)?.label || category;

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="card-soft p-5 bg-white border border-black/5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-400 font-bold">{label}</div>
          <div className="mt-2 font-display text-3xl font-semibold text-[#0A1128]">{value}</div>
        </div>
        <div className="w-11 h-11 rounded-lg bg-[#0A1128] text-white grid place-items-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function IssueCard({ issue, canReview, draft, onDraft, onUpdate }) {
  const reviewable = canReview && issue.assigned_to_role === issue.current_user_role && issue.created_by !== issue.current_user_id;
  const created = issue.created_at ? new Date(issue.created_at).toLocaleString("en-IN") : "";

  return (
    <div className="card-soft p-5 bg-white border border-black/5" data-testid={`help-issue-${issue.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border font-semibold ${STATUS_STYLES[issue.status] || STATUS_STYLES.open}`}>
              {statusLabel(issue.status)}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-semibold ${PRIORITY_STYLES[issue.priority] || PRIORITY_STYLES.medium}`}>
              {issue.priority} priority
            </span>
            <span className="text-neutral-400">{created}</span>
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-[#0A1128] break-words">{issue.title}</h3>
          <div className="mt-1 text-sm text-neutral-500">
            {issue.module} - {categoryLabel(issue.category)} - Raised by {issue.created_by_name} ({roleLabel(issue.created_by_role)})
          </div>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <div>Goes to</div>
          <div className="font-semibold text-[#0A1128]">{roleLabel(issue.assigned_to_role)}</div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap break-words">{issue.description}</p>

      {issue.response && (
        <div className="mt-4 rounded-lg border border-[#10B981]/20 bg-[#E6F8F3] p-4 text-sm text-[#0A1128]">
          <div className="font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#047857]" />
            Response from {issue.responded_by_name || "admin"}
          </div>
          <p className="mt-2 text-neutral-700 whitespace-pre-wrap break-words">{issue.response}</p>
        </div>
      )}

      {reviewable && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[180px_1fr_auto] gap-3 items-start">
          <select
            value={draft.status}
            onChange={(e) => onDraft(issue.id, { ...draft, status: e.target.value })}
            className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
            data-testid={`help-status-${issue.id}`}
          >
            {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <textarea
            value={draft.response}
            onChange={(e) => onDraft(issue.id, { ...draft, response: e.target.value })}
            rows={2}
            placeholder="Reply or internal update"
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm resize-none"
            data-testid={`help-response-${issue.id}`}
          />
          <button
            type="button"
            onClick={() => onUpdate(issue)}
            className="btn-primary text-sm py-2.5 justify-center"
            data-testid={`help-update-${issue.id}`}
          >
            <CheckCircle2 className="w-4 h-4" /> Update
          </button>
        </div>
      )}
    </div>
  );
}

export default function HelpMe() {
  const { user } = useAuth();
  const canReview = ["school_admin", "super_admin"].includes(user?.role);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [form, setForm] = useState({
    module: "Dashboard",
    category: "mistake",
    priority: "medium",
    title: "",
    description: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/help-issues");
      setIssues(data);
      const nextDrafts = {};
      data.forEach((issue) => {
        nextDrafts[issue.id] = {
          status: issue.status || "open",
          response: issue.response || "",
        };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to load help issues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleIssues = useMemo(
    () => issues.map((issue) => ({
      ...issue,
      current_user_id: user?.id,
      current_user_role: user?.role,
    })),
    [issues, user?.id, user?.role]
  );

  const incomingIssues = useMemo(
    () => visibleIssues.filter((issue) => canReview && issue.assigned_to_role === user?.role && issue.created_by !== user?.id),
    [visibleIssues, canReview, user?.id, user?.role]
  );
  const myIssues = useMemo(
    () => visibleIssues.filter((issue) => issue.created_by === user?.id),
    [visibleIssues, user?.id]
  );
  const otherVisibleIssues = useMemo(
    () => visibleIssues.filter((issue) => !incomingIssues.some((i) => i.id === issue.id) && !myIssues.some((i) => i.id === issue.id)),
    [visibleIssues, incomingIssues, myIssues]
  );

  const stats = useMemo(() => ({
    open: visibleIssues.filter((i) => i.status === "open").length,
    active: visibleIssues.filter((i) => ["open", "in_progress"].includes(i.status)).length,
    resolved: visibleIssues.filter((i) => ["resolved", "closed"].includes(i.status)).length,
  }), [visibleIssues]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Issue title is required"); return; }
    if (!form.description.trim()) { toast.error("Issue details are required"); return; }
    setSubmitting(true);
    try {
      await api.post("/help-issues", {
        ...form,
        page_url: window.location.href,
      });
      setForm({ module: "Dashboard", category: "mistake", priority: "medium", title: "", description: "" });
      toast.success(user?.role === "school_admin" ? "Issue sent to super admin" : "Issue sent");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to send issue");
    } finally {
      setSubmitting(false);
    }
  };

  const updateIssue = async (issue) => {
    const draft = drafts[issue.id] || { status: issue.status, response: "" };
    try {
      await api.patch(`/help-issues/${issue.id}`, draft);
      toast.success("Issue updated");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to update issue");
    }
  };

  const renderSection = (title, subtitle, list, emptyText) => (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[#0A1128]">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
      </div>
      {loading ? (
        <div className="card-soft p-8 text-sm text-neutral-500">Loading issues...</div>
      ) : list.length === 0 ? (
        <div className="card-soft p-8 text-sm text-neutral-500">{emptyText}</div>
      ) : (
        <div className="space-y-4">
          {list.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              canReview={canReview}
              draft={drafts[issue.id] || { status: issue.status, response: "" }}
              onDraft={(id, next) => setDrafts((current) => ({ ...current, [id]: next }))}
              onUpdate={updateIssue}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6" data-testid="help-me-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Support</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Help Me</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {user?.role === "school_admin"
              ? "Raise admin issues to super admin and review school user issues."
              : canReview
                ? "Review escalated issues and keep fixes moving."
                : "Raise website changes, mistakes, bugs, or access issues."}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[#0A1128] text-white text-sm font-medium">
          <LifeBuoy className="w-4 h-4" /> {roleLabel(user?.role)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Open" value={stats.open} icon={AlertCircle} />
        <Stat label="Active" value={stats.active} icon={Clock3} />
        <Stat label="Resolved" value={stats.resolved} icon={CheckCircle2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-start">
        <form onSubmit={submit} className="card-soft p-6 space-y-4 bg-white border border-black/5" data-testid="help-issue-form">
          <div>
            <div className="label-eyebrow">New issue</div>
            <h2 className="mt-1 font-display text-2xl font-semibold text-[#0A1128]">Tell us what changed</h2>
          </div>

          <label className="block text-sm font-medium text-[#0A1128]">
            Module
            <select
              value={form.module}
              onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
              className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
              data-testid="help-module"
            >
              {MODULE_OPTIONS.map((module) => <option key={module} value={module}>{module}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#0A1128]">
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
                data-testid="help-category"
              >
                {CATEGORY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-[#0A1128]">
              Priority
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
                data-testid="help-priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-[#0A1128]">
            Title
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Example: Attendance save button is not working"
              className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
              data-testid="help-title"
            />
          </label>

          <label className="block text-sm font-medium text-[#0A1128]">
            Details
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={5}
              placeholder="Mention the page, what you expected, and what happened."
              className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm resize-none"
              data-testid="help-description"
            />
          </label>

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center text-sm py-3" data-testid="submit-help-issue">
            <Send className="w-4 h-4" /> {submitting ? "Sending..." : "Send issue"}
          </button>
        </form>

        <div className="space-y-8">
          {canReview && renderSection(
            user?.role === "super_admin" ? "Super admin queue" : "Admin queue",
            user?.role === "super_admin" ? "Issues raised by school admins appear here." : "Issues raised by parents, students, and teachers appear here.",
            incomingIssues,
            "No incoming issues right now."
          )}

          {renderSection(
            "My issues",
            user?.role === "school_admin" ? "Issues you raised will appear in the super admin queue." : "Your submitted issues and admin replies.",
            myIssues,
            "No issues submitted yet."
          )}

          {user?.role === "super_admin" && otherVisibleIssues.length > 0 && renderSection(
            "School issue visibility",
            "All other school issues visible to super admin.",
            otherVisibleIssues,
            "No other issues."
          )}

          {!canReview && issues.length > 0 && (
            <div className="card-soft p-4 bg-[#E6F8F3] border-[#10B981]/20 text-sm text-[#0A1128] flex items-center gap-3">
              <Inbox className="w-5 h-5 text-[#047857]" />
              Your issues go directly to the school admin team.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
