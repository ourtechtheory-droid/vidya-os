import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  IdCard,
  ImagePlus,
  RefreshCw,
  Save,
  Trash2,
  User,
  X,
} from "lucide-react";
import { generateIDCardPDF } from "@/lib/idCardPdf";
import { generateVendorZip } from "@/lib/vendorExport";

const TEMPLATES = [
  { id: "classic", name: "Classic Dark", blurb: "Dark accent, photo + QR" },
  { id: "modern", name: "Modern Light", blurb: "Light bg, color stripe" },
  { id: "academy", name: "Academy", blurb: "Formal, centred crest" },
];

const defaultDesign = {
  template: "classic",
  accent: "#0A1128",
  logo: "Vi",
  logoImage: "",
  schoolName: "Vidya Public School",
  schoolNameLocal: "",
  tagline: "VidyaOS Smart Campus",
  showQr: true,
  cardSide: "front",
  validityYear: "2026-27",
  costPerCard: 18,
};

const GST_RATE = 0.18;

// Tiered rate per card (₹). Used when the user-set rate equals the default —
// otherwise we honour their custom override.
function suggestedRatePerCard(count) {
  if (count >= 500) return 14;
  if (count >= 100) return 18;
  return 25;
}

function estimateCost(count, ratePerCard) {
  const rate = Number.isFinite(ratePerCard) ? ratePerCard : suggestedRatePerCard(count);
  const subtotal = count * rate;
  const gst = subtotal * GST_RATE;
  return {
    rate,
    subtotal,
    gst,
    total: subtotal + gst,
  };
}

function rupee(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

const qrPayload = (targetType, record) => {
  const id = record?.id || record?.user_id || "";
  const kind = targetType === "teachers" ? "teacher" : "student";
  return `https://vidya-os.app/v/${kind}/${id}`;
};

function LogoBadge({ design, size = 48, light = true }) {
  if (design.logoImage) {
    return (
      <img
        src={design.logoImage}
        alt="School logo"
        style={{ width: size, height: size }}
        className="rounded-lg object-cover bg-white/15"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-lg grid place-items-center font-display font-bold ${
        light ? "bg-white/15 text-white" : "bg-black/[0.06] text-neutral-800"
      }`}
    >
      {design.logo || "V"}
    </div>
  );
}

function PhotoBlock({ record, size = 64, light = true }) {
  if (record?.profile_image) {
    return (
      <img
        src={record.profile_image}
        alt={record.name}
        style={{ width: size, height: size }}
        className="rounded-xl object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-xl grid place-items-center text-xl font-display font-semibold ${
        light ? "bg-white/20 text-white" : "bg-black/[0.05] text-neutral-700"
      }`}
    >
      {initials(record?.name)}
    </div>
  );
}

function FrontClassic({ record, design, targetType }) {
  const isTeacher = targetType === "teachers";
  return (
    <div
      className="rounded-2xl p-5 text-white aspect-[1.58/1] relative overflow-hidden"
      style={{ background: design.accent }}
    >
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,white,transparent_30%)]" />
      <div className="relative flex items-start justify-between">
        <LogoBadge design={design} size={48} light />
        {design.showQr && (
          <div className="w-24 h-24 rounded-lg bg-white p-1.5 grid place-items-center shadow-sm">
            <QRCodeSVG
              value={qrPayload(targetType, record)}
              size={84}
              bgColor="#ffffff"
              fgColor={design.accent}
              level="H"
            />
          </div>
        )}
      </div>
      <div className="relative mt-4 flex items-center gap-4">
        <PhotoBlock record={record} size={64} light />
        <div className="min-w-0">
          <div className="text-xl font-display font-semibold leading-tight truncate">
            {record?.name || "—"}
          </div>
          <div className="text-white/70 text-sm">
            {isTeacher
              ? record?.core_subject || "Faculty"
              : `Roll ${record?.roll_no || "—"} · ${record?.class_id || ""}`}
          </div>
        </div>
      </div>
      <div className="relative mt-3 text-xs text-white/80 leading-tight">
        <div className="font-medium truncate">{design.schoolName}</div>
        {design.schoolNameLocal && (
          <div className="truncate">{design.schoolNameLocal}</div>
        )}
        <div className="text-white/60 truncate">{design.tagline}</div>
      </div>
    </div>
  );
}

function FrontModern({ record, design, targetType }) {
  const isTeacher = targetType === "teachers";
  return (
    <div className="rounded-2xl bg-white aspect-[1.58/1] relative overflow-hidden border border-black/5 flex">
      <div className="w-3" style={{ background: design.accent }} />
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <LogoBadge design={design} size={40} light={false} />
            <div className="text-sm leading-tight">
              <div className="font-semibold text-neutral-800 truncate max-w-[120px]">
                {design.schoolName}
              </div>
              {design.schoolNameLocal && (
                <div className="text-neutral-500 text-xs truncate max-w-[120px]">
                  {design.schoolNameLocal}
                </div>
              )}
            </div>
          </div>
          {design.showQr && (
            <div className="w-20 h-20 grid place-items-center">
              <QRCodeSVG
                value={qrPayload(targetType, record)}
                size={72}
                bgColor="#ffffff"
                fgColor={design.accent}
                level="H"
              />
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <PhotoBlock record={record} size={52} light={false} />
          <div className="min-w-0">
            <div
              className="text-lg font-display font-semibold leading-tight truncate"
              style={{ color: design.accent }}
            >
              {record?.name || "—"}
            </div>
            <div className="text-neutral-600 text-xs">
              {isTeacher
                ? record?.core_subject || "Faculty"
                : `Roll ${record?.roll_no || "—"} · ${record?.class_id || ""}`}
            </div>
          </div>
        </div>
        <div className="mt-auto pt-2 text-[10px] text-neutral-500 truncate">
          {design.tagline}
        </div>
      </div>
    </div>
  );
}

function FrontAcademy({ record, design, targetType }) {
  const isTeacher = targetType === "teachers";
  return (
    <div
      className="rounded-2xl aspect-[1.58/1] relative overflow-hidden text-center px-5 py-4"
      style={{ background: `linear-gradient(180deg, ${design.accent} 0%, ${design.accent}dd 100%)`, color: "white" }}
    >
      <div className="flex flex-col items-center">
        <LogoBadge design={design} size={40} light />
        <div className="mt-1 text-sm font-display font-semibold tracking-wide truncate w-full">
          {design.schoolName}
        </div>
        {design.schoolNameLocal && (
          <div className="text-xs text-white/70 truncate w-full">
            {design.schoolNameLocal}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        <PhotoBlock record={record} size={48} light />
        <div className="text-left min-w-0">
          <div className="text-base font-semibold leading-tight truncate">
            {record?.name || "—"}
          </div>
          <div className="text-white/75 text-xs">
            {isTeacher
              ? record?.core_subject || "Faculty"
              : `Roll ${record?.roll_no || "—"} · ${record?.class_id || ""}`}
          </div>
        </div>
        {design.showQr && (
          <div className="w-16 h-16 bg-white rounded-md p-1 grid place-items-center">
            <QRCodeSVG
              value={qrPayload(targetType, record)}
              size={56}
              bgColor="#ffffff"
              fgColor={design.accent}
              level="H"
            />
          </div>
        )}
      </div>
      <div className="absolute bottom-2 left-0 right-0 text-[10px] text-white/70 truncate">
        {design.tagline}
      </div>
    </div>
  );
}

function CardFront({ record, design, targetType }) {
  switch (design.template) {
    case "modern":
      return <FrontModern record={record} design={design} targetType={targetType} />;
    case "academy":
      return <FrontAcademy record={record} design={design} targetType={targetType} />;
    case "classic":
    default:
      return <FrontClassic record={record} design={design} targetType={targetType} />;
  }
}

function CardBack({ record, design, targetType }) {
  const isTeacher = targetType === "teachers";
  return (
    <div className="rounded-2xl border border-black/10 p-5 aspect-[1.58/1] bg-white text-sm">
      <div className="flex items-center justify-between">
        <div className="label-eyebrow">Back of card</div>
        <div className="text-xs font-medium" style={{ color: design.accent }}>
          {design.schoolName}
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-neutral-700">
        {isTeacher ? (
          <>
            <div>Phone: {record?.phone_number || "—"}</div>
            <div>Subject: {record?.core_subject || "—"}</div>
            <div>
              Assigned class:{" "}
              {record?.assigned_class?.name || record?.assigned_class_id || "—"}
            </div>
            <div>Gender: {record?.gender || "—"}</div>
          </>
        ) : (
          <>
            <div>Emergency contact: {record?.parent_phone || "—"}</div>
            <div>Blood group: {record?.blood_group || "Not on file"}</div>
            <div>House: {record?.house || "—"}</div>
            <div>Date of birth: {record?.dob || "—"}</div>
            <div>Address: {record?.address || "—"}</div>
          </>
        )}
        <div className="pt-2 text-neutral-500">
          Valid for academic year {design.validityYear || "—"}
        </div>
      </div>
      <div className="mt-4 text-xs text-neutral-500">
        If found, please return to the school office. Misuse is a punishable offence.
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = status || "pending_approval";
  const styles = {
    approved: "bg-[#E5EFE8] text-[#3a6a4a]",
    pending_approval: "bg-[#FFF1D6] text-[#8a5a00]",
    rejected: "bg-[#FCE4E4] text-[#a93a3a]",
  };
  const labels = {
    approved: "Approved",
    pending_approval: "Pending approval",
    rejected: "Rejected",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[s] || styles.pending_approval}`}>
      {labels[s] || s}
    </span>
  );
}

export default function IDCards() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [reissues, setReissues] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [activeRecordId, setActiveRecordId] = useState(null);
  const [form, setForm] = useState({
    target_type: "students",
    class_id: "",
    role: "",
    design: defaultDesign,
  });
  const logoInputRef = useRef(null);

  const load = async () => {
    const [c, s, t, b, ri] = await Promise.all([
      api.get("/classes"),
      api.get("/students"),
      api.get("/teachers"),
      api.get("/id-card-batches"),
      api.get("/id-card-reissues"),
    ]);
    setClasses(c.data);
    setStudents(s.data);
    setTeachers(t.data);
    setBatches(b.data);
    setReissues(ri.data);
    setForm((v) => ({ ...v, class_id: v.class_id || c.data[0]?.id || "" }));
  };

  const openBatch = async (batchId) => {
    try {
      const { data } = await api.get(`/id-card-batches/${batchId}`);
      setSelectedBatch(data);
    } catch (err) {
      toast.error("Could not open batch");
    }
  };

  const approveBatch = async (batchId) => {
    try {
      const { data } = await api.patch(`/id-card-batches/${batchId}/approve`);
      setBatches((items) => items.map((b) => (b.id === batchId ? data : b)));
      setSelectedBatch(data);
      toast.success("Batch approved");
    } catch (err) {
      toast.error("Failed to approve batch");
    }
  };

  const deleteBatch = async (batchId) => {
    if (!window.confirm("Delete this batch? This cannot be undone.")) return;
    try {
      await api.delete(`/id-card-batches/${batchId}`);
      setBatches((items) => items.filter((b) => b.id !== batchId));
      setSelectedBatch(null);
      toast.success("Batch deleted");
    } catch (err) {
      toast.error("Failed to delete batch");
    }
  };

  const requestReissue = async (record, targetType) => {
    const recordId = record.id || record.user_id;
    const reason = window.prompt(
      `Reason for reissuing ${record.name}'s card?`,
      "Lost card"
    );
    if (reason === null) return;
    try {
      const { data } = await api.post("/id-card-reissues", {
        target_type: targetType === "teachers" ? "teacher" : "student",
        record_id: recordId,
        reason: reason || "Lost card",
      });
      setReissues((items) => [data, ...items]);
      toast.success(`Reissue queued for ${record.name}`);
    } catch (err) {
      toast.error("Failed to queue reissue");
    }
  };

  const markReissuePrinted = async (reissueId) => {
    try {
      const { data } = await api.patch(
        `/id-card-reissues/${reissueId}/mark-printed`
      );
      setReissues((items) =>
        items.map((r) => (r.id === reissueId ? data : r))
      );
      toast.success("Marked as printed");
    } catch (err) {
      toast.error("Failed to mark printed");
    }
  };

  const downloadFromBatch = async (batch) => {
    if (batch.status !== "approved") {
      toast.error("Batch must be approved before download");
      return;
    }
    const id = toast.loading("Generating PDF…");
    try {
      await generateIDCardPDF({
        records: batch.records || [],
        design: batch.design || {},
        targetType: batch.target_type,
        filename: `vidya-batch-${batch.id.slice(0, 8)}.pdf`,
        includeBacks: true,
        onProgress: (msg) => toast.loading(msg, { id }),
      });
      toast.success(`Downloaded ${batch.record_count} cards`, { id });
    } catch (err) {
      toast.error(err?.message || "Failed to generate PDF", { id });
    }
  };

  const downloadVendorZip = async (
    targetRecords,
    design,
    targetType,
    label
  ) => {
    if (!targetRecords || targetRecords.length === 0) {
      toast.error("No records to export");
      return;
    }
    const id = toast.loading("Building vendor pack…");
    try {
      await generateVendorZip({
        records: targetRecords,
        design,
        targetType,
        filename: `vidya-vendor-pack-${label}.zip`,
        onProgress: (msg) => toast.loading(msg, { id }),
      });
      toast.success(`Vendor pack downloaded (${targetRecords.length} records)`, {
        id,
      });
    } catch (err) {
      toast.error(err?.message || "Failed to build vendor pack", { id });
    }
  };

  useEffect(() => {
    load().catch(() => toast.error("Unable to load ID card studio"));
  }, []);

  const records = useMemo(() => {
    if (form.target_type === "teachers") return teachers;
    return students.filter((s) => !form.class_id || s.class_id === form.class_id);
  }, [form.class_id, form.target_type, students, teachers]);

  const activeRecord = useMemo(() => {
    if (records.length === 0) {
      return {
        name: "Sample Student",
        roll_no: "01",
        class_id: form.class_id,
        core_subject: "Mathematics",
        profile_image: "",
      };
    }
    return (
      records.find((r) => (r.id || r.user_id) === activeRecordId) || records[0]
    );
  }, [records, activeRecordId, form.class_id]);

  const updateDesign = (key, value) =>
    setForm((v) => ({ ...v, design: { ...v.design, [key]: value } }));

  const onLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("Logo must be under 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateDesign("logoImage", reader.result);
    reader.readAsDataURL(file);
  };

  const createBatch = async () => {
    try {
      const { data } = await api.post("/id-card-batches", form);
      setBatches((items) => [data, ...items]);
      toast.success(`${data.record_count} cards queued`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to queue batch");
    }
  };

  const downloadPDF = async () => {
    if (records.length === 0) {
      toast.error("No records selected for printing");
      return;
    }
    const id = toast.loading("Generating PDF…");
    try {
      await generateIDCardPDF({
        records,
        design: form.design,
        targetType: form.target_type,
        filename: `vidya-id-cards-${form.target_type}-${Date.now()}.pdf`,
        includeBacks: true,
        onProgress: (msg) => toast.loading(msg, { id }),
      });
      toast.success(`Downloaded ${records.length} cards as PDF`, { id });
    } catch (err) {
      toast.error(err?.message || "Failed to generate PDF", { id });
    }
  };

  return (
    <div className="space-y-6" data-testid="id-cards-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Print studio</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            ID Card Generator
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bulk generate student and teacher ID cards with QR codes and print-ready sheets.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={createBatch} className="btn-primary text-sm py-2.5">
            <Save className="w-4 h-4" /> Queue Batch
          </button>
          <button onClick={downloadPDF} className="btn-ghost text-sm py-2.5">
            <Download className="w-4 h-4" /> Download A4 PDF
          </button>
          <button
            onClick={() =>
              downloadVendorZip(records, form.design, form.target_type, "current")
            }
            className="btn-ghost text-sm py-2.5"
            title="Export CSV + photos + print spec as a ZIP for an outsourced printer"
          >
            <FileArchive className="w-4 h-4" /> Vendor ZIP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card-soft p-6 space-y-4">
          <div className="flex items-center gap-2">
            <IdCard className="w-5 h-5 text-[#E05236]" />
            <div className="label-eyebrow">Bulk setup</div>
          </div>
          <select
            value={form.target_type}
            onChange={(e) =>
              setForm((v) => ({ ...v, target_type: e.target.value }))
            }
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
          >
            <option value="students">Students</option>
            <option value="teachers">Teachers</option>
          </select>
          {form.target_type === "students" && (
            <select
              value={form.class_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, class_id: e.target.value }))
              }
              className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div>
            <div className="text-sm font-medium mb-2">Template</div>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((tpl) => {
                const active = form.design.template === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => updateDesign("template", tpl.id)}
                    className={`text-left p-2 rounded-lg border text-xs transition ${
                      active
                        ? "border-[#E05236] bg-[#FFF4F0]"
                        : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    <div className="font-semibold">{tpl.name}</div>
                    <div className="text-neutral-500 mt-0.5">{tpl.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Brand color
              <input
                type="color"
                value={form.design.accent}
                onChange={(e) => updateDesign("accent", e.target.value)}
                className="mt-2 w-full h-11 rounded-lg border border-black/10"
              />
            </label>
            <label className="block text-sm font-medium">
              Preview side
              <select
                value={form.design.cardSide}
                onChange={(e) => updateDesign("cardSide", e.target.value)}
                className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">School logo</div>
            <div className="flex items-center gap-3">
              <LogoBadge design={form.design} size={44} light={false} />
              <div className="flex-1 flex gap-2">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex-1 btn-ghost text-xs py-2"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  {form.design.logoImage ? "Replace" : "Upload image"}
                </button>
                {form.design.logoImage && (
                  <button
                    onClick={() => updateDesign("logoImage", "")}
                    className="btn-ghost text-xs py-2 px-2"
                    title="Remove uploaded logo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoFile}
              />
            </div>
            <input
              value={form.design.logo}
              onChange={(e) => updateDesign("logo", e.target.value)}
              className="mt-2 w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-xs"
              placeholder="Or 1–3 letter monogram (used when no image)"
              maxLength={3}
            />
          </div>

          <input
            value={form.design.schoolName}
            onChange={(e) => updateDesign("schoolName", e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
            placeholder="School name (English)"
          />
          <input
            value={form.design.schoolNameLocal}
            onChange={(e) => updateDesign("schoolNameLocal", e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
            placeholder="School name (regional language, optional)"
          />
          <input
            value={form.design.tagline}
            onChange={(e) => updateDesign("tagline", e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
            placeholder="School tagline"
          />
          <input
            value={form.design.validityYear}
            onChange={(e) => updateDesign("validityYear", e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
            placeholder="Academic year (e.g. 2026-27)"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.design.showQr}
              onChange={(e) => updateDesign("showQr", e.target.checked)}
            />{" "}
            QR code enabled
          </label>
          <div className="rounded-xl bg-[#E5EFE8] p-4 text-sm text-[#4A7C59]">
            {records.length} records ready for this batch.
          </div>
          {(() => {
            const cost = estimateCost(records.length, form.design.costPerCard);
            return (
              <div className="rounded-xl border border-black/5 bg-white p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Estimated cost</div>
                  <div className="text-lg font-display font-semibold">
                    {rupee(cost.total)}
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  {records.length} cards × {rupee(cost.rate)} ={" "}
                  {rupee(cost.subtotal)} · GST 18% {rupee(cost.gst)}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-xs text-neutral-500">
                    Rate / card (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.design.costPerCard}
                    onChange={(e) =>
                      updateDesign(
                        "costPerCard",
                        Math.max(1, Number(e.target.value) || 1)
                      )
                    }
                    className="w-20 px-2 py-1 rounded border border-black/10 text-xs"
                  />
                  <button
                    onClick={() =>
                      updateDesign(
                        "costPerCard",
                        suggestedRatePerCard(records.length)
                      )
                    }
                    className="text-xs text-[#E05236] hover:underline"
                    title="Reset to volume-tier suggested rate"
                  >
                    Use suggested
                  </button>
                </div>
              </div>
            );
          })()}
          {form.design.schoolNameLocal && (
            <div className="text-xs text-neutral-500">
              Note: regional language renders in the live preview, but the PDF
              currently uses Helvetica — non-Latin scripts may not appear in the
              exported file.
            </div>
          )}
        </div>

        <div className="card-soft p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="label-eyebrow">Live preview</div>
            <div className="text-xs text-neutral-500">
              Showing:{" "}
              <span className="font-medium text-neutral-700">
                {activeRecord?.name}
              </span>
            </div>
          </div>
          <div
            className={`mt-5 grid grid-cols-1 ${
              form.design.cardSide === "both" ? "md:grid-cols-2" : "max-w-md"
            } gap-6`}
          >
            {form.design.cardSide !== "back" && (
              <CardFront
                record={activeRecord}
                design={form.design}
                targetType={form.target_type}
              />
            )}
            {form.design.cardSide !== "front" && (
              <CardBack
                record={activeRecord}
                design={form.design}
                targetType={form.target_type}
              />
            )}
          </div>
          <div className="mt-6">
            <div className="text-xs text-neutral-500 mb-2">
              Click a record to preview its card:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {records.slice(0, 12).map((r) => {
                const rid = r.id || r.user_id;
                const isActive =
                  rid === (activeRecord?.id || activeRecord?.user_id);
                return (
                  <button
                    key={rid}
                    onClick={() => setActiveRecordId(rid)}
                    className={`text-left rounded-xl border p-3 text-sm transition ${
                      isActive
                        ? "border-[#E05236] bg-[#FFF4F0]"
                        : "border-black/5 hover:border-black/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {r.profile_image ? (
                        <img
                          src={r.profile_image}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-black/[0.06] grid place-items-center">
                          <User className="w-3.5 h-3.5 text-neutral-500" />
                        </div>
                      )}
                      <div className="font-medium truncate">{r.name}</div>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {r.roll_no
                        ? `Roll ${r.roll_no}`
                        : r.core_subject || "Staff"}
                    </div>
                  </button>
                );
              })}
              {records.length === 0 && (
                <div className="col-span-full text-sm text-neutral-500">
                  No records match this filter.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card-soft p-6">
        <div className="flex items-center justify-between">
          <div className="label-eyebrow">Recent batches</div>
          <div className="text-xs text-neutral-500">
            Click a batch to review records, approve and download.
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {batches.map((b) => (
            <button
              key={b.id}
              onClick={() => openBatch(b.id)}
              className="text-left rounded-xl border border-black/5 bg-white p-4 hover:border-[#E05236]/50 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div className="font-medium capitalize">{b.target_type}</div>
                <StatusBadge status={b.status} />
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                {b.record_count} cards
              </div>
              <div className="text-xs text-neutral-400 mt-2">
                {new Date(b.created_at).toLocaleString("en-IN")}
              </div>
              {b.created_by_name && (
                <div className="text-xs text-neutral-400">
                  by {b.created_by_name}
                </div>
              )}
            </button>
          ))}
          {batches.length === 0 && (
            <div className="text-sm text-neutral-500">
              No generated batches yet.
            </div>
          )}
        </div>
      </div>

      <div className="card-soft p-6">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#E05236]" />
          <div className="label-eyebrow">Reissue queue</div>
        </div>
        <div className="mt-3 text-xs text-neutral-500">
          Cards reported lost or damaged. Mark as printed once the replacement
          has been issued.
        </div>
        <div className="mt-4 space-y-2">
          {reissues.length === 0 && (
            <div className="text-sm text-neutral-500">No reissue requests.</div>
          )}
          {reissues.map((r) => {
            const subject =
              r.target_type === "teacher"
                ? teachers.find((t) => (t.user_id || t.id) === r.record_id)
                : students.find((s) => s.id === r.record_id);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {subject?.name || r.record_id}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    {r.reason} · requested by {r.requested_by_name} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-IN")}
                  </div>
                </div>
                {r.status === "pending" ? (
                  <button
                    onClick={() => markReissuePrinted(r.id)}
                    className="btn-ghost text-xs py-1.5 px-2.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark printed
                  </button>
                ) : (
                  <span className="text-xs text-[#3a6a4a] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Printed
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedBatch && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => setSelectedBatch(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-black/5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-display font-semibold capitalize">
                    {selectedBatch.target_type} batch
                  </h2>
                  <StatusBadge status={selectedBatch.status} />
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  {selectedBatch.record_count} cards · created{" "}
                  {new Date(selectedBatch.created_at).toLocaleString("en-IN")}
                  {selectedBatch.created_by_name &&
                    ` by ${selectedBatch.created_by_name}`}
                </div>
                {selectedBatch.approved_by_name && (
                  <div className="text-sm text-[#3a6a4a]">
                    Approved by {selectedBatch.approved_by_name} on{" "}
                    {new Date(selectedBatch.approved_at).toLocaleString("en-IN")}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="text-neutral-500 hover:text-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {selectedBatch.status !== "approved" && (
                  <button
                    onClick={() => approveBatch(selectedBatch.id)}
                    className="btn-primary text-sm py-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve for printing
                  </button>
                )}
                <button
                  onClick={() => downloadFromBatch(selectedBatch)}
                  disabled={selectedBatch.status !== "approved"}
                  title={
                    selectedBatch.status !== "approved"
                      ? "Approve the batch first"
                      : "Download A4 PDF with front + back pages"
                  }
                  className={`btn-ghost text-sm py-2 ${
                    selectedBatch.status !== "approved"
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button
                  onClick={() =>
                    downloadVendorZip(
                      selectedBatch.records || [],
                      selectedBatch.design || {},
                      selectedBatch.target_type,
                      selectedBatch.id.slice(0, 8)
                    )
                  }
                  className="btn-ghost text-sm py-2"
                  title="Export CSV + photos + print spec as a ZIP"
                >
                  <FileArchive className="w-4 h-4" /> Vendor ZIP
                </button>
                <button
                  onClick={() => deleteBatch(selectedBatch.id)}
                  className="btn-ghost text-sm py-2 text-[#a93a3a]"
                >
                  <Trash2 className="w-4 h-4" /> Delete batch
                </button>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
                <span className="font-medium">Design:</span>{" "}
                {selectedBatch.design?.template || "classic"} ·{" "}
                {selectedBatch.design?.schoolName || "—"} · accent{" "}
                <span
                  className="inline-block w-3 h-3 rounded-full align-middle"
                  style={{ background: selectedBatch.design?.accent || "#000" }}
                />{" "}
                · valid {selectedBatch.design?.validityYear || "—"}
              </div>

              {(() => {
                const cost = estimateCost(
                  selectedBatch.record_count || 0,
                  selectedBatch.design?.costPerCard
                );
                return (
                  <div className="rounded-xl border border-black/5 p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">
                        Estimated cost
                      </div>
                      <div className="text-neutral-500 mt-0.5">
                        {selectedBatch.record_count} cards × {rupee(cost.rate)}{" "}
                        + GST
                      </div>
                    </div>
                    <div className="text-lg font-display font-semibold">
                      {rupee(cost.total)}
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="text-sm font-medium mb-2">
                  Records ({(selectedBatch.records || []).length})
                </div>
                <div className="max-h-72 overflow-auto rounded-lg border border-black/5">
                  {(selectedBatch.records || []).map((r) => {
                    const rid = r.id || r.user_id;
                    const pendingReissue = reissues.find(
                      (x) =>
                        x.record_id === rid && x.status === "pending"
                    );
                    return (
                      <div
                        key={rid}
                        className="flex items-center justify-between gap-3 px-3 py-2 border-b border-black/5 last:border-b-0 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-black/[0.06] grid place-items-center">
                            <User className="w-3.5 h-3.5 text-neutral-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {r.name}
                            </div>
                            <div className="text-xs text-neutral-500 truncate">
                              {r.roll_no
                                ? `Roll ${r.roll_no} · ${r.class_id || ""}`
                                : r.core_subject || "Staff"}
                            </div>
                          </div>
                        </div>
                        {pendingReissue ? (
                          <span className="text-xs text-[#8a5a00] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Reissue pending
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              requestReissue(r, selectedBatch.target_type)
                            }
                            className="text-xs text-neutral-600 hover:text-[#E05236]"
                          >
                            Mark for reissue
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
