import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Award,
  CheckCircle2,
  Download,
  Edit,
  ImagePlus,
  Layers,
  Plus,
  Save,
  Stamp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  generateBulkCertificatePDF,
  generateCertificatePDF,
} from "@/lib/certificatePdf";

const TEMPLATE_TYPES = [
  { id: "achievement", name: "Achievement" },
  { id: "participation", name: "Participation" },
  { id: "sports", name: "Sports" },
  { id: "completion", name: "Completion" },
  { id: "other", name: "Other" },
];

const defaultDesign = {
  title: "Certificate of Achievement",
  body:
    "This certificate is proudly presented to {recipient} for outstanding performance and dedication during {event}.",
  accent: "#0A1128",
  border: "double",
  logo: "Vi",
  logoImage: "",
  schoolName: "Vidya Public School",
  schoolNameLocal: "",
  tagline: "Excellence in Education",
  signatures: [{ name: "Principal", role: "Principal", signatureImage: "" }],
  schoolSeal: "",
};

const emptyTemplateForm = () => ({
  name: "",
  type: "achievement",
  design: { ...defaultDesign, signatures: [...defaultDesign.signatures] },
});

function applyPlaceholders(text, vars) {
  if (!text) return "";
  return text
    .replace(/\{recipient\}/gi, vars.recipient || "[recipient]")
    .replace(/\{event\}/gi, vars.event || "[event]")
    .replace(/\{date\}/gi, vars.date || "[date]")
    .replace(/\{position\}/gi, vars.position || "[position]")
    .replace(/\{category\}/gi, vars.category || "[category]")
    .replace(/\{score\}/gi, vars.score || "[score]")
    .replace(/\{cert_no\}/gi, vars.cert_no || "[cert#]")
    .replace(/\{school\}/gi, vars.school || "[school]");
}

function readFileAsDataUrl(file, max = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file"));
    if (file.size > max) return reject(new Error("File too large (max 1 MB)"));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function CertificatePreview({ design, sample, issuance }) {
  const vars = {
    recipient: sample.recipient || issuance?.recipient_name || "[recipient]",
    event: sample.event || issuance?.event_name || "[event]",
    date: sample.event_date || issuance?.event_date || "[date]",
    position: sample.position || issuance?.position || "[position]",
    category: sample.category || issuance?.category || "[category]",
    score: sample.score || issuance?.score || "[score]",
    cert_no: issuance?.cert_no || "[cert#]",
    school: design.schoolName,
  };
  const body = applyPlaceholders(sample.body_override || design.body, vars);
  const eventParts = [];
  if (vars.event !== "[event]") eventParts.push(vars.event);
  if (vars.position !== "[position]") eventParts.push(`Position: ${vars.position}`);
  if (vars.category !== "[category]") eventParts.push(vars.category);
  if (vars.date !== "[date]") eventParts.push(vars.date);

  return (
    <div
      className="bg-white rounded-xl aspect-[1.414/1] p-6 relative overflow-hidden"
      style={{ border: `4px ${design.border} ${design.accent}` }}
    >
      <div className="absolute inset-2 pointer-events-none rounded-md" style={{ border: `1px solid ${design.accent}33` }} />
      <div className="relative flex items-start justify-between gap-2">
        {design.logoImage ? (
          <img src={design.logoImage} alt="" className="w-10 h-10 rounded object-cover" />
        ) : (
          <div
            className="w-10 h-10 rounded grid place-items-center text-white font-display font-bold text-sm"
            style={{ background: design.accent }}
          >
            {design.logo}
          </div>
        )}
        <div className="text-center flex-1">
          <div
            className="font-display font-semibold text-base leading-tight truncate"
            style={{ color: design.accent }}
          >
            {design.schoolName}
          </div>
          {design.schoolNameLocal && (
            <div className="text-[10px] text-neutral-500 truncate">
              {design.schoolNameLocal}
            </div>
          )}
          {design.tagline && (
            <div className="text-[9px] italic text-neutral-400 truncate">
              {design.tagline}
            </div>
          )}
        </div>
        {design.schoolSeal ? (
          <img src={design.schoolSeal} alt="" className="w-10 h-10 rounded-full object-cover opacity-80" />
        ) : (
          <div className="w-10 h-10" />
        )}
      </div>

      <div className="relative mt-3 text-center">
        <div className="font-display font-bold text-2xl" style={{ color: design.accent }}>
          {design.title}
        </div>
        <div className="text-[11px] italic text-neutral-500 mt-2">
          is hereby awarded to
        </div>
        <div className="font-display font-bold text-3xl mt-1" style={{ color: design.accent }}>
          {vars.recipient}
        </div>
        <div className="h-px bg-neutral-300 mx-12 mt-1" />
        <p className="text-xs text-neutral-700 mt-3 max-w-xl mx-auto leading-relaxed">
          {body}
        </p>
        {eventParts.length > 0 && (
          <div className="text-[10px] italic text-neutral-500 mt-1">
            {eventParts.join("  ·  ")}
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-0 right-0 px-6 flex items-end justify-between gap-3">
        {(design.signatures || []).slice(0, 3).map((sig, i) => (
          <div key={i} className="text-center text-[10px]">
            {sig.signatureImage && (
              <img src={sig.signatureImage} alt="" className="h-6 mx-auto object-contain" />
            )}
            <div className="border-t border-neutral-400 mt-1 pt-0.5 font-semibold">
              {sig.name || "—"}
            </div>
            <div className="text-neutral-500 italic">{sig.role || ""}</div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-2 left-2 text-[8px] text-neutral-400">
        Cert No. {vars.cert_no}
      </div>
      {issuance?.status === "revoked" && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="text-5xl font-display font-bold opacity-30 rotate-[-20deg]"
            style={{ color: "#a93a3a" }}
          >
            REVOKED
          </div>
        </div>
      )}
    </div>
  );
}

function ImageUpload({ value, onChange, label }) {
  const ref = useRef(null);
  return (
    <div>
      <div className="flex items-center gap-2">
        {value ? (
          <img
            src={value}
            alt=""
            className="w-10 h-10 rounded object-cover border border-black/10"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-black/[0.05] grid place-items-center text-neutral-400">
            <ImagePlus className="w-4 h-4" />
          </div>
        )}
        <button
          onClick={() => ref.current?.click()}
          className="btn-ghost text-xs py-1.5 flex-1"
          type="button"
        >
          {value ? "Replace" : label || "Upload"}
        </button>
        {value && (
          <button
            onClick={() => onChange("")}
            className="btn-ghost text-xs py-1.5 px-2"
            type="button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const dataUrl = await readFileAsDataUrl(file);
              onChange(dataUrl);
            } catch (err) {
              toast.error(err.message);
            }
          }}
        />
      </div>
    </div>
  );
}

function SignatureEditor({ signatures, onChange }) {
  const update = (i, key, value) => {
    const next = signatures.map((s, idx) =>
      idx === i ? { ...s, [key]: value } : s
    );
    onChange(next);
  };
  const add = () => {
    if (signatures.length >= 3) return;
    onChange([...signatures, { name: "", role: "", signatureImage: "" }]);
  };
  const remove = (i) => {
    onChange(signatures.filter((_, idx) => idx !== i));
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Signatures ({signatures.length}/3)
        </div>
        {signatures.length < 3 && (
          <button
            type="button"
            onClick={add}
            className="text-xs text-[#FF5E3A] hover:underline"
          >
            + Add
          </button>
        )}
      </div>
      {signatures.map((sig, i) => (
        <div key={i} className="rounded-lg border border-black/5 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={sig.name}
              onChange={(e) => update(i, "name", e.target.value)}
              placeholder="Name"
              className="px-2 py-1.5 rounded border border-black/10 text-xs"
            />
            <input
              value={sig.role}
              onChange={(e) => update(i, "role", e.target.value)}
              placeholder="Role (Principal, etc.)"
              className="px-2 py-1.5 rounded border border-black/10 text-xs"
            />
          </div>
          <ImageUpload
            value={sig.signatureImage}
            onChange={(v) => update(i, "signatureImage", v)}
            label="Upload signature image"
          />
          {signatures.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs text-[#a93a3a] hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function TemplateEditor({ value, onChange, onSave, onCancel }) {
  const setDesign = (key, v) =>
    onChange({ ...value, design: { ...value.design, [key]: v } });
  return (
    <div className="space-y-3">
      <input
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
        placeholder="Template name (e.g. Annual Achievement)"
      />
      <select
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
      >
        {TEMPLATE_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        value={value.design.title}
        onChange={(e) => setDesign("title", e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
        placeholder="Certificate title (e.g. Certificate of Achievement)"
      />
      <textarea
        value={value.design.body}
        onChange={(e) => setDesign("body", e.target.value)}
        rows={3}
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm resize-none"
        placeholder="Body — use placeholders {recipient}, {event}, {date}, {position}, {category}, {score}"
      />
      <div className="text-[10px] text-neutral-500">
        Placeholders supported: {"{recipient} {event} {date} {position} {category} {score} {school} {cert_no}"}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          Accent
          <input
            type="color"
            value={value.design.accent}
            onChange={(e) => setDesign("accent", e.target.value)}
            className="mt-1 w-full h-9 rounded border border-black/10"
          />
        </label>
        <label className="block text-xs">
          Border
          <select
            value={value.design.border}
            onChange={(e) => setDesign("border", e.target.value)}
            className="mt-1 w-full px-2 py-2 rounded border border-black/10 text-xs"
          >
            <option value="double">Double</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
          </select>
        </label>
      </div>
      <input
        value={value.design.schoolName}
        onChange={(e) => setDesign("schoolName", e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
        placeholder="School name (English)"
      />
      <input
        value={value.design.schoolNameLocal}
        onChange={(e) => setDesign("schoolNameLocal", e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
        placeholder="School name (regional language, optional)"
      />
      <input
        value={value.design.tagline}
        onChange={(e) => setDesign("tagline", e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
        placeholder="Tagline (optional)"
      />
      <div>
        <div className="text-sm font-medium mb-1">School logo</div>
        <ImageUpload
          value={value.design.logoImage}
          onChange={(v) => setDesign("logoImage", v)}
          label="Upload logo"
        />
        <input
          value={value.design.logo}
          onChange={(e) => setDesign("logo", e.target.value)}
          className="mt-2 w-full px-3 py-1.5 rounded bg-white border border-black/10 text-xs"
          placeholder="Or 1–3 letter monogram (fallback)"
          maxLength={3}
        />
      </div>
      <div>
        <div className="text-sm font-medium mb-1 flex items-center gap-1">
          <Stamp className="w-3.5 h-3.5" /> School seal
        </div>
        <ImageUpload
          value={value.design.schoolSeal}
          onChange={(v) => setDesign("schoolSeal", v)}
          label="Upload seal"
        />
      </div>
      <SignatureEditor
        signatures={value.design.signatures || []}
        onChange={(s) => setDesign("signatures", s)}
      />
      <div className="flex gap-2 pt-2">
        <button onClick={onSave} className="btn-primary text-sm py-2 flex-1">
          <Save className="w-4 h-4" /> Save template
        </button>
        {onCancel && (
          <button onClick={onCancel} className="btn-ghost text-sm py-2">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function Certificates() {
  const [tab, setTab] = useState("issue"); // issue | templates | ledger
  const [templates, setTemplates] = useState([]);
  const [issuances, setIssuances] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Template editor state (used in Templates tab)
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Issuance form state (Issue tab)
  const [issueForm, setIssueForm] = useState({
    template_id: "",
    recipient_type: "student",
    class_id: "",
    recipient_ids: [],
    event_name: "",
    event_date: "",
    position: "",
    category: "",
    score: "",
    body_override: "",
  });

  const load = async () => {
    const [tpl, iss, c, s, t] = await Promise.all([
      api.get("/certificate-templates"),
      api.get("/certificate-issuances"),
      api.get("/classes"),
      api.get("/students"),
      api.get("/teachers"),
    ]);
    setTemplates(tpl.data);
    setIssuances(iss.data);
    setClasses(c.data);
    setStudents(s.data);
    setTeachers(t.data);
    setIssueForm((f) => ({
      ...f,
      template_id: f.template_id || tpl.data[0]?.id || "",
      class_id: f.class_id || c.data[0]?.id || "",
    }));
  };

  useEffect(() => {
    load().catch(() => toast.error("Unable to load certificate studio"));
  }, []);

  const currentTemplate = useMemo(
    () => templates.find((t) => t.id === issueForm.template_id),
    [templates, issueForm.template_id]
  );

  const availableRecipients = useMemo(() => {
    if (issueForm.recipient_type === "teacher") return teachers;
    return students.filter(
      (s) => !issueForm.class_id || s.class_id === issueForm.class_id
    );
  }, [issueForm.recipient_type, issueForm.class_id, students, teachers]);

  const toggleRecipient = (id) =>
    setIssueForm((f) => ({
      ...f,
      recipient_ids: f.recipient_ids.includes(id)
        ? f.recipient_ids.filter((x) => x !== id)
        : [...f.recipient_ids, id],
    }));

  const toggleAllRecipients = () => {
    const allIds = availableRecipients.map((r) => r.id || r.user_id);
    const allSelected = allIds.every((id) =>
      issueForm.recipient_ids.includes(id)
    );
    setIssueForm((f) => ({
      ...f,
      recipient_ids: allSelected ? [] : allIds,
    }));
  };

  const sampleVars = useMemo(() => {
    const firstId = issueForm.recipient_ids[0];
    const firstRecipient =
      availableRecipients.find((r) => (r.id || r.user_id) === firstId) ||
      availableRecipients[0] ||
      {};
    return {
      recipient: firstRecipient.name,
      event: issueForm.event_name,
      event_date: issueForm.event_date,
      position: issueForm.position,
      category: issueForm.category,
      score: issueForm.score,
      body_override: issueForm.body_override,
    };
  }, [issueForm, availableRecipients]);

  const issue = async () => {
    if (!issueForm.template_id) return toast.error("Pick a template");
    if (issueForm.recipient_ids.length === 0)
      return toast.error("Pick at least one recipient");

    const id = toast.loading("Issuing certificates…");
    try {
      const payload = {
        template_id: issueForm.template_id,
        recipient_type: issueForm.recipient_type,
        recipient_ids: issueForm.recipient_ids,
        event_name: issueForm.event_name || undefined,
        event_date: issueForm.event_date || undefined,
        category: issueForm.category || undefined,
        position: issueForm.position || undefined,
        score: issueForm.score || undefined,
        body_override: issueForm.body_override || undefined,
      };
      const { data } = await api.post("/certificate-issuances/bulk", payload);
      setIssuances((items) => [...data.items, ...items]);
      toast.loading("Generating PDF…", { id });
      const designOverride = {
        ...(currentTemplate?.design || {}),
      };
      const itemsWithOverrides = data.items.map((it) => ({
        ...it,
        body_override: issueForm.body_override || it.body_override,
        score: issueForm.score || it.score,
      }));
      await generateBulkCertificatePDF({
        issuances: itemsWithOverrides,
        design: designOverride,
        filename: `certificates-${Date.now()}.pdf`,
        onProgress: (msg) => toast.loading(msg, { id }),
      });
      toast.success(`Issued ${data.issued} certificates`, { id });
      setIssueForm((f) => ({ ...f, recipient_ids: [] }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Issue failed", {
        id,
      });
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate?.name) return toast.error("Give the template a name");
    try {
      const isUpdate = !!editingTemplate.id;
      const { data } = await api[isUpdate ? "patch" : "post"](
        isUpdate ? `/certificate-templates/${editingTemplate.id}` : "/certificate-templates",
        editingTemplate
      );
      setTemplates((items) => [data, ...items.filter((t) => t.id !== data.id)]);
      setEditingTemplate(null);
      toast.success(isUpdate ? "Template updated" : "Template saved");
    } catch (err) {
      toast.error("Failed to save template");
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await api.delete(`/certificate-templates/${templateId}`);
      setTemplates((items) => items.filter((t) => t.id !== templateId));
      toast.success("Template deleted");
    } catch (err) {
      toast.error("Could not delete (template may be in use)");
    }
  };

  const downloadIssuance = async (issuance) => {
    const id = toast.loading("Generating PDF…");
    try {
      await generateCertificatePDF({
        issuance,
        design: issuance.design_snapshot,
        filename: `certificate-${issuance.cert_no}.pdf`,
        onProgress: (msg) => toast.loading(msg, { id }),
      });
      toast.success("Downloaded", { id });
    } catch (err) {
      toast.error(err?.message || "Failed", { id });
    }
  };

  const revokeIssuance = async (issuance) => {
    const reason = window.prompt(
      `Reason for revoking ${issuance.cert_no}?`,
      "Issued in error"
    );
    if (!reason) return;
    try {
      const { data } = await api.post(
        `/certificate-issuances/${issuance.id}/revoke`,
        { reason }
      );
      setIssuances((items) =>
        items.map((x) => (x.id === issuance.id ? data : x))
      );
      toast.success("Certificate revoked");
    } catch (err) {
      toast.error("Could not revoke");
    }
  };

  const tabBtn = (id, label, Icon) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
        tab === id
          ? "bg-[#0A1128] text-white"
          : "text-neutral-600 hover:bg-black/[0.04]"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6" data-testid="certificates-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Document studio</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Certificates
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Issue verifiable certificates to students and teachers — single or
            bulk, with QR-based verification.
          </p>
        </div>
        <div className="flex gap-2">
          {tabBtn("issue", "Issue", Award)}
          {tabBtn("templates", "Templates", Layers)}
          {tabBtn("ledger", "Ledger", Users)}
        </div>
      </div>

      {tab === "issue" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card-soft p-6 space-y-4">
            <div className="label-eyebrow">Issue certificate</div>
            <select
              value={issueForm.template_id}
              onChange={(e) =>
                setIssueForm((f) => ({ ...f, template_id: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
            >
              {templates.length === 0 && <option>No templates — create one in Templates tab</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type})
                </option>
              ))}
            </select>
            <select
              value={issueForm.recipient_type}
              onChange={(e) =>
                setIssueForm((f) => ({
                  ...f,
                  recipient_type: e.target.value,
                  recipient_ids: [],
                }))
              }
              className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
            >
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
            </select>
            {issueForm.recipient_type === "student" && (
              <select
                value={issueForm.class_id}
                onChange={(e) =>
                  setIssueForm((f) => ({
                    ...f,
                    class_id: e.target.value,
                    recipient_ids: [],
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium">
                  Recipients ({issueForm.recipient_ids.length} selected)
                </div>
                <button
                  onClick={toggleAllRecipients}
                  className="text-xs text-[#FF5E3A] hover:underline"
                >
                  {issueForm.recipient_ids.length === availableRecipients.length
                    ? "Clear all"
                    : "Select all"}
                </button>
              </div>
              <div className="max-h-48 overflow-auto rounded-lg border border-black/5 divide-y divide-black/5">
                {availableRecipients.map((r) => {
                  const rid = r.id || r.user_id;
                  const checked = issueForm.recipient_ids.includes(rid);
                  return (
                    <label
                      key={rid}
                      className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-black/[0.02]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecipient(rid)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{r.name}</div>
                        <div className="text-xs text-neutral-500 truncate">
                          {r.roll_no
                            ? `Roll ${r.roll_no} · ${r.class_id || ""}`
                            : r.core_subject || "Staff"}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {availableRecipients.length === 0 && (
                  <div className="px-3 py-4 text-sm text-neutral-500">
                    No recipients match.
                  </div>
                )}
              </div>
            </div>

            <input
              value={issueForm.event_name}
              onChange={(e) =>
                setIssueForm((f) => ({ ...f, event_name: e.target.value }))
              }
              placeholder="Event / occasion (e.g. Sports Day 2026)"
              className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={issueForm.event_date}
                onChange={(e) =>
                  setIssueForm((f) => ({ ...f, event_date: e.target.value }))
                }
                className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
              />
              <input
                value={issueForm.position}
                onChange={(e) =>
                  setIssueForm((f) => ({ ...f, position: e.target.value }))
                }
                placeholder="Position (1st / 2nd / Participation)"
                className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={issueForm.category}
                onChange={(e) =>
                  setIssueForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="Category (Boys U-14, etc.)"
                className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
              />
              <input
                value={issueForm.score}
                onChange={(e) =>
                  setIssueForm((f) => ({ ...f, score: e.target.value }))
                }
                placeholder="Score (optional)"
                className="px-3 py-2 rounded-lg bg-white border border-black/10 text-sm"
              />
            </div>
            <textarea
              value={issueForm.body_override}
              onChange={(e) =>
                setIssueForm((f) => ({ ...f, body_override: e.target.value }))
              }
              rows={2}
              placeholder="Body override (optional; otherwise uses template)"
              className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm resize-none"
            />

            <button
              onClick={issue}
              disabled={
                issueForm.recipient_ids.length === 0 || !issueForm.template_id
              }
              className="w-full btn-primary text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Award className="w-4 h-4" />
              Issue {issueForm.recipient_ids.length || ""} certificate
              {issueForm.recipient_ids.length === 1 ? "" : "s"} & download
            </button>
          </div>

          <div className="xl:col-span-2 card-soft p-6">
            <div className="label-eyebrow">Live preview</div>
            <div className="text-xs text-neutral-500 mt-1">
              Showing first selected recipient. Each certificate gets a unique
              cert no. when issued.
            </div>
            <div className="mt-4">
              {currentTemplate ? (
                <CertificatePreview
                  design={currentTemplate.design || {}}
                  sample={sampleVars}
                />
              ) : (
                <div className="text-sm text-neutral-500 p-8 rounded-lg border border-dashed border-black/10 text-center">
                  <div>Pick a template from the dropdown to preview.</div>
                  {templates.length === 0 && (
                    <button
                      onClick={() => {
                        setEditingTemplate(emptyTemplateForm());
                        setTab("templates");
                      }}
                      className="btn-primary text-sm py-2 mt-4 inline-flex"
                    >
                      <Plus className="w-4 h-4" /> Create template
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card-soft p-6">
            <div className="flex items-center justify-between">
              <div className="label-eyebrow">Templates</div>
              <button
                onClick={() => setEditingTemplate(emptyTemplateForm())}
                className="btn-ghost text-xs py-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-black/5 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-neutral-500 capitalize">
                        {t.type}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingTemplate(t)}
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
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-sm text-neutral-500">
                  No templates yet — click "New" to create one.
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-2 card-soft p-6">
            {editingTemplate ? (
              <>
                <div className="label-eyebrow mb-4">
                  {editingTemplate.id ? "Edit template" : "New template"}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TemplateEditor
                    value={editingTemplate}
                    onChange={setEditingTemplate}
                    onSave={saveTemplate}
                    onCancel={() => setEditingTemplate(null)}
                  />
                  <div>
                    <div className="label-eyebrow mb-2">Preview</div>
                    <CertificatePreview
                      design={editingTemplate.design}
                      sample={{
                        recipient: "Aarav Verma",
                        event: "Annual Day 2026",
                        event_date: "2026-04-15",
                        position: "1st",
                        category: "Junior",
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-neutral-500 p-8 text-center">
                Pick a template on the left or create a new one.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "ledger" && (
        <div className="card-soft p-6">
          <div className="label-eyebrow">Issued certificates ({issuances.length})</div>
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-black/5">
                  <th className="py-2 pr-3">Cert No.</th>
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3">Template</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Issued</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {issuances.map((iss) => (
                  <tr key={iss.id} className="border-b border-black/5">
                    <td className="py-2 pr-3 font-mono text-xs">
                      {iss.cert_no}
                    </td>
                    <td className="py-2 pr-3">{iss.recipient_name}</td>
                    <td className="py-2 pr-3 text-neutral-500">
                      {iss.template_name}
                    </td>
                    <td className="py-2 pr-3 text-neutral-500 text-xs">
                      {iss.event_name || "—"}
                      {iss.position && ` · ${iss.position}`}
                    </td>
                    <td className="py-2 pr-3 text-neutral-500 text-xs">
                      {new Date(iss.issued_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-2 pr-3">
                      {iss.status === "revoked" ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FCE4E4] text-[#a93a3a]">
                          Revoked
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#E6F8F3] text-[#3a6a4a]">
                          <CheckCircle2 className="inline w-3 h-3 mr-0.5 -mt-0.5" />
                          Issued
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        onClick={() => downloadIssuance(iss)}
                        className="text-xs text-neutral-600 hover:text-[#FF5E3A] inline-flex items-center gap-1 mr-2"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </button>
                      {iss.status !== "revoked" && (
                        <button
                          onClick={() => revokeIssuance(iss)}
                          className="text-xs text-[#a93a3a] hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {issuances.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">
                      No certificates issued yet. Switch to the Issue tab to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
