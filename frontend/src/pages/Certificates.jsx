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
      className="bg-white rounded-xl aspect-[1.414/1] p-6 relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300"
      style={{ border: `6px ${design.border || "double"} ${design.accent || "#0A1128"}` }}
    >
      {/* Import Google Fonts dynamically */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Great+Vibes&display=swap');
        .cert-title-font { font-family: 'Playfair Display', Georgia, serif; }
        .cert-cursive-font { font-family: 'Great Vibes', cursive; font-weight: 400; }
      `}} />

      <div className="absolute inset-2 pointer-events-none rounded border" style={{ borderColor: `${design.accent || "#0A1128"}33` }} />
      
      {/* Top Branding Section */}
      <div className="relative flex items-start justify-between gap-3">
        {design.logoImage ? (
          <img src={design.logoImage} alt="" className="w-12 h-12 rounded object-cover shadow-sm border border-black/5" />
        ) : (
          <div
            className="w-12 h-12 rounded-xl grid place-items-center text-white font-display font-extrabold text-base shadow-sm"
            style={{ background: design.accent || "#0A1128" }}
          >
            {design.logo || "Vi"}
          </div>
        )}
        
        <div className="text-center flex-1 min-w-0">
          <div
            className="font-display font-bold text-lg leading-tight truncate tracking-tight uppercase"
            style={{ color: design.accent || "#0A1128" }}
          >
            {design.schoolName || "Vidya Public School"}
          </div>
          {design.schoolNameLocal && (
            <div className="text-[11px] font-semibold text-neutral-500 truncate mt-0.5">
              {design.schoolNameLocal}
            </div>
          )}
          {design.tagline && (
            <div className="text-[10px] italic text-neutral-400 truncate mt-0.5">
              {design.tagline}
            </div>
          )}
        </div>

        {/* Premium Gold Seal Visual Mockup */}
        {design.schoolSeal ? (
          <div className="relative shrink-0 group/seal">
            <img src={design.schoolSeal} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/20 to-yellow-300/30 mix-blend-overlay pointer-events-none" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full border border-amber-300 bg-amber-50/10 flex items-center justify-center shrink-0">
            <div className="w-10 h-10 rounded-full border border-amber-400/40 bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 flex items-center justify-center text-[8px] font-bold text-amber-600">SEAL</div>
          </div>
        )}
      </div>

      {/* Main Award Content */}
      <div className="relative text-center my-auto px-6">
        <div 
          className="cert-title-font font-bold text-2xl md:text-3xl tracking-wide uppercase italic" 
          style={{ color: design.accent || "#0A1128" }}
        >
          {design.title || "Certificate of Achievement"}
        </div>
        
        <div className="text-xs italic text-neutral-400 font-medium mt-1">
          is hereby proudly awarded to
        </div>
        
        <div 
          className="cert-cursive-font text-4xl md:text-5xl mt-1 leading-none py-1" 
          style={{ color: design.accent || "#0A1128" }}
        >
          {vars.recipient}
        </div>
        
        <div className="h-[2px] bg-gradient-to-r from-transparent via-neutral-300 to-transparent mx-16 mt-1" />
        
        <p className="text-xs text-neutral-600 mt-2.5 max-w-xl mx-auto leading-relaxed font-medium">
          {body}
        </p>
        
        {eventParts.length > 0 && (
          <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 mt-2">
            {eventParts.join("  ·  ")}
          </div>
        )}
      </div>

      {/* Bottom Signatures section */}
      <div className="relative flex items-end justify-between gap-4 px-4 pt-4 border-t border-neutral-100">
        {(design.signatures || []).slice(0, 3).map((sig, i) => (
          <div key={i} className="text-center text-[10px] min-w-[80px]">
            {sig.signatureImage && (
              <img src={sig.signatureImage} alt="" className="h-7 mx-auto object-contain mb-1" />
            )}
            <div className="border-t border-neutral-300 pt-1 font-bold text-neutral-800">
              {sig.name || "—"}
            </div>
            <div className="text-neutral-400 italic text-[9px]">{sig.role || "Signee"}</div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-2 left-3 text-[9px] font-semibold text-neutral-400/70 tracking-wider font-mono">
        Cert No: {vars.cert_no}
      </div>
      
      {issuance?.status === "revoked" && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none bg-white/40 backdrop-blur-[1px]">
          <div
            className="text-5xl font-display font-black opacity-30 rotate-[-15deg] border-4 border-rose-600 px-6 py-2 rounded-xl text-rose-600"
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
  const [activeSec, setActiveSec] = useState("style"); // style | text | brand | signatures
  
  const setDesign = (key, v) =>
    onChange({ ...value, design: { ...value.design, [key]: v } });

  const tabClass = (id) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
      activeSec === id
        ? "bg-[#0A1128] text-white shadow-sm"
        : "text-neutral-500 hover:bg-neutral-100 hover:text-[#0A1128]"
    }`;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Accordion sub-tabs */}
      <div className="flex flex-wrap gap-1 border-b border-black/5 pb-2">
        <button type="button" onClick={() => setActiveSec("style")} className={tabClass("style")}>🎨 Style</button>
        <button type="button" onClick={() => setActiveSec("text")} className={tabClass("text")}>✍️ Text</button>
        <button type="button" onClick={() => setActiveSec("brand")} className={tabClass("brand")}>🏫 Brand</button>
        <button type="button" onClick={() => setActiveSec("signatures")} className={tabClass("signatures")}>🖋️ Signatures</button>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pr-1 scrollbar-thin">
        {activeSec === "style" && (
          <div className="space-y-4 anim-pop">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Template Name</label>
              <input
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
                placeholder="Template name (e.g. Annual Achievement)"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Certificate Type</label>
              <select
                value={value.type}
                onChange={(e) => onChange({ ...value, type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none cursor-pointer"
              >
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Theme Accent Color</label>
                <div className="flex gap-2 items-center mt-1">
                  <input
                    type="color"
                    value={value.design.accent || "#0A1128"}
                    onChange={(e) => setDesign("accent", e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer border border-black/10"
                  />
                  <input
                    type="text"
                    value={value.design.accent || "#0A1128"}
                    onChange={(e) => setDesign("accent", e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-black/10 text-xs font-mono uppercase focus:ring-brand outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Border Style</label>
                <select
                  value={value.design.border || "double"}
                  onChange={(e) => setDesign("border", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-black/10 text-sm focus:ring-brand outline-none cursor-pointer"
                >
                  <option value="double">Double</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSec === "text" && (
          <div className="space-y-4 anim-pop">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Main Header Title</label>
              <input
                value={value.design.title}
                onChange={(e) => setDesign("title", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
                placeholder="Certificate title (e.g. Certificate of Achievement)"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Certificate Body Copy</label>
              <textarea
                value={value.design.body}
                onChange={(e) => setDesign("body", e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm resize-none focus:ring-brand outline-none leading-relaxed font-sans"
                placeholder="Body — use placeholders {recipient}, {event}, {date}, {position}, {category}, {score}"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-500">Variables Chips (Click to insert)</label>
              <div className="flex flex-wrap gap-1">
                {["{recipient}", "{event}", "{date}", "{position}", "{category}", "{score}", "{school}", "{cert_no}"].map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setDesign("body", (value.design.body || "") + " " + p)}
                    className="text-[10px] px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 border border-black/5 active:scale-95 transition rounded text-neutral-600 font-mono"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1 italic">
                These merge labels are automatically populated with recipient and event details during bulk issuance.
              </div>
            </div>
          </div>
        )}

        {activeSec === "brand" && (
          <div className="space-y-4 anim-pop">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">School Name (English)</label>
              <input
                value={value.design.schoolName}
                onChange={(e) => setDesign("schoolName", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
                placeholder="School name (English)"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">School Name (Regional Language - optional)</label>
              <input
                value={value.design.schoolNameLocal}
                onChange={(e) => setDesign("schoolNameLocal", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
                placeholder="School name (regional language)"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Tagline / Motto</label>
              <input
                value={value.design.tagline}
                onChange={(e) => setDesign("tagline", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none"
                placeholder="Tagline (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">School Logo</label>
                <ImageUpload
                  value={value.design.logoImage}
                  onChange={(v) => setDesign("logoImage", v)}
                  label="Upload logo"
                />
                <input
                  value={value.design.logo || "Vi"}
                  onChange={(e) => setDesign("logo", e.target.value)}
                  className="mt-2 w-full px-2 py-1.5 rounded bg-white border border-black/10 text-[11px] focus:ring-brand outline-none"
                  placeholder="Monogram fallback (e.g. VPS)"
                  maxLength={3}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">School Seal</label>
                <ImageUpload
                  value={value.design.schoolSeal}
                  onChange={(v) => setDesign("schoolSeal", v)}
                  label="Upload seal"
                />
              </div>
            </div>
          </div>
        )}

        {activeSec === "signatures" && (
          <div className="space-y-4 anim-pop">
            <SignatureEditor
              signatures={value.design.signatures || []}
              onChange={(s) => setDesign("signatures", s)}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-black/5 pt-3 mt-auto">
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

  // Recipient entry modes (roster vs adhoc text entry)
  const [recipientMode, setRecipientMode] = useState("roster"); // roster | adhoc
  const [adhocNames, setAdhocNames] = useState("");

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
    let recipientName = "";
    if (recipientMode === "adhoc") {
      const names = adhocNames.split(",").map((n) => n.trim()).filter(Boolean);
      recipientName = names[0] || "[recipient name]";
    } else {
      const firstId = issueForm.recipient_ids[0];
      const firstRecipient =
        availableRecipients.find((r) => (r.id || r.user_id) === firstId) ||
        availableRecipients[0] ||
        {};
      recipientName = firstRecipient.name || "[recipient name]";
    }
    return {
      recipient: recipientName,
      event: issueForm.event_name,
      event_date: issueForm.event_date,
      position: issueForm.position,
      category: issueForm.category,
      score: issueForm.score,
      body_override: issueForm.body_override,
    };
  }, [issueForm, availableRecipients, recipientMode, adhocNames]);

  const issue = async () => {
    if (!issueForm.template_id) return toast.error("Pick a template");

    if (recipientMode === "adhoc") {
      const names = adhocNames.split(",").map((n) => n.trim()).filter(Boolean);
      if (names.length === 0) return toast.error("Enter at least one name");

      const id = toast.loading("Generating certificates…");
      try {
        const mockItems = names.map((name, idx) => {
          const timestamp = Date.now();
          const mockId = `adhoc-${timestamp}-${idx}-${Math.floor(Math.random() * 1000)}`;
          const cert_no = `ADHOC-${new Date().getFullYear()}-${String(idx + 1).padStart(4, "0")}`;
          return {
            id: mockId,
            cert_no,
            recipient_name: name,
            event_name: issueForm.event_name || undefined,
            event_date: issueForm.event_date || undefined,
            category: issueForm.category || undefined,
            position: issueForm.position || undefined,
            score: issueForm.score || undefined,
            body_override: issueForm.body_override || undefined,
            issued_at: new Date().toISOString(),
          };
        });

        const designOverride = {
          ...(currentTemplate?.design || {}),
        };

        await generateBulkCertificatePDF({
          issuances: mockItems,
          design: designOverride,
          filename: `certificates-adhoc-${Date.now()}.pdf`,
          onProgress: (msg) => toast.loading(msg, { id }),
        });

        toast.success(`Generated ${names.length} ad-hoc certificates`, { id });
        setAdhocNames("");
      } catch (err) {
        toast.error(err?.message || "Generation failed", { id });
      }
      return;
    }

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

            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Recipient Mode</label>
              <div className="grid grid-cols-2 gap-1 bg-black/[0.03] p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRecipientMode("roster")}
                  className={`py-1.5 px-3 rounded-md text-xs font-medium transition ${
                    recipientMode === "roster"
                      ? "bg-white text-[#0A1128] shadow-sm font-semibold"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  Select from Roster
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode("adhoc")}
                  className={`py-1.5 px-3 rounded-md text-xs font-medium transition ${
                    recipientMode === "adhoc"
                      ? "bg-white text-[#0A1128] shadow-sm font-semibold"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  Ad-hoc Custom Names
                </button>
              </div>
            </div>

            {recipientMode === "adhoc" ? (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neutral-500 mb-1">
                  Recipient Names (separated by commas)
                </label>
                <textarea
                  value={adhocNames}
                  onChange={(e) => setAdhocNames(e.target.value)}
                  rows={4}
                  placeholder="Enter names, e.g. Aarav Verma, Maya Patel, Rohan Sharma"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-sm focus:ring-brand outline-none resize-none"
                />
                <p className="text-[10px] text-neutral-400">
                  Type one or more names separated by commas. Each name will get a separate high-fidelity certificate generated in bulk.
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}

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
                !issueForm.template_id ||
                (recipientMode === "roster" && issueForm.recipient_ids.length === 0) ||
                (recipientMode === "adhoc" && !adhocNames.trim())
              }
              className="w-full btn-primary text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Award className="w-4 h-4" />
              {recipientMode === "adhoc"
                ? `Generate ${adhocNames.split(",").map((n) => n.trim()).filter(Boolean).length || ""} Ad-hoc Certificate${adhocNames.split(",").map((n) => n.trim()).filter(Boolean).length === 1 ? "" : "s"}`
                : `Issue ${issueForm.recipient_ids.length || ""} Certificate${issueForm.recipient_ids.length === 1 ? "" : "s"} & Download`
              }
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
        editingTemplate ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 anim-pop">
            {/* Left Controls sidebar taking 4 columns */}
            <div className="lg:col-span-5 card-soft p-5 flex flex-col h-[75vh] shadow-sm border-black/[0.04] bg-white">
              <div className="label-eyebrow mb-2">Canva Studio Controls</div>
              <TemplateEditor
                value={editingTemplate}
                onChange={setEditingTemplate}
                onSave={saveTemplate}
                onCancel={() => setEditingTemplate(null)}
              />
            </div>
            
            {/* Right dark canvas artboard taking 7 columns */}
            <div className="lg:col-span-7 h-[75vh] rounded-2xl bg-[#141416] border border-black/20 relative overflow-hidden flex flex-col shadow-2xl">
              {/* Artboard Toolbar */}
              <div className="bg-[#1C1C1E] text-neutral-300 px-4 py-2.5 flex items-center justify-between text-xs font-semibold select-none border-b border-black/30">
                <span className="flex items-center gap-2"><Award className="w-4 h-4 text-[#FF5E3A]" /> Certificate Artboard (Landscape)</span>
                <div className="flex gap-2">
                  <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded text-[10px]">1.414:1 Ratio</span>
                  <span className="bg-neutral-800 text-emerald-400 px-2 py-0.5 rounded text-[10px]">Verifiable QR Ready</span>
                </div>
              </div>
              
              {/* Artboard Canvas Viewport */}
              <div 
                className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[#0F0F10] relative"
                style={{ 
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1.2px, transparent 1.2px)', 
                  backgroundSize: '16px 16px' 
                }}
              >
                <div className="w-full max-w-lg transition-all duration-300 hover:scale-[1.01] drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
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
            </div>
          </div>
        ) : (
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
                    className="rounded-lg border border-black/5 p-3 hover:bg-neutral-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate text-neutral-800">{t.name}</div>
                        <div className="text-xs text-neutral-400 capitalize mt-0.5">
                          {t.type}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingTemplate(t)}
                          className="p-1 text-neutral-400 hover:text-neutral-800"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          className="p-1 text-neutral-400 hover:text-[#a93a3a]"
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

            <div className="xl:col-span-2 card-soft p-6 flex items-center justify-center bg-neutral-50/50">
              <div className="text-sm text-neutral-500 p-8 text-center space-y-3">
                <Award className="w-12 h-12 text-neutral-300 mx-auto" />
                <div className="font-semibold text-base text-neutral-700">Certificate Template Manager</div>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">Select a template on the left or create a brand new custom template with the Canva Studio builder.</p>
                <button
                  onClick={() => setEditingTemplate(emptyTemplateForm())}
                  className="btn-primary text-xs py-2 px-4 mt-2 inline-flex"
                >
                  <Plus className="w-4 h-4" /> Create template
                </button>
              </div>
            </div>
          </div>
        )
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
