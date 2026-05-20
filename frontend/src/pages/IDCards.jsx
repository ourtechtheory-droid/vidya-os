import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Download, Grip, IdCard, QrCode, Save } from "lucide-react";

const defaultDesign = { accent: "#0A1128", logo: "Vi", tagline: "VidyaOS Smart Campus", showQr: true, cardSide: "front" };

export default function IDCards() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState({ target_type: "students", class_id: "", role: "", design: defaultDesign });

  const load = async () => {
    const [c, s, t, b] = await Promise.all([api.get("/classes"), api.get("/students"), api.get("/teachers"), api.get("/id-card-batches")]);
    setClasses(c.data); setStudents(s.data); setTeachers(t.data); setBatches(b.data);
    setForm((v) => ({ ...v, class_id: v.class_id || c.data[0]?.id || "" }));
  };
  useEffect(() => { load().catch(() => toast.error("Unable to load ID card studio")); }, []);

  const records = useMemo(() => {
    if (form.target_type === "teachers") return teachers;
    return students.filter((s) => !form.class_id || s.class_id === form.class_id);
  }, [form.class_id, form.target_type, students, teachers]);
  const sample = records[0] || { name: "Student Name", roll_no: "01", class_id: form.class_id, core_subject: "Mathematics", profile_image: "" };

  const updateDesign = (key, value) => setForm((v) => ({ ...v, design: { ...v.design, [key]: value } }));

  const createBatch = async () => {
    const { data } = await api.post("/id-card-batches", form);
    setBatches((items) => [data, ...items]);
    toast.success(`${data.record_count} ID cards prepared`);
  };

  return (
    <div className="space-y-6" data-testid="id-cards-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Print studio</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">ID Card Generator</h1>
          <p className="mt-1 text-sm text-neutral-500">Bulk generate student, teacher, and staff ID cards with QR codes and print-ready sheets.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={createBatch} className="btn-primary text-sm py-2.5"><Save className="w-4 h-4" /> Generate Batch</button>
          <button onClick={() => window.print()} className="btn-ghost text-sm py-2.5"><Download className="w-4 h-4" /> Export Sheet</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card-soft p-6 space-y-4">
          <div className="flex items-center gap-2"><IdCard className="w-5 h-5 text-[#E05236]" /><div className="label-eyebrow">Bulk setup</div></div>
          <select value={form.target_type} onChange={(e) => setForm((v) => ({ ...v, target_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
            <option value="students">Students</option><option value="teachers">Teachers</option><option value="staff">Staff</option>
          </select>
          {form.target_type === "students" && <select value={form.class_id} onChange={(e) => setForm((v) => ({ ...v, class_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">Brand color<input type="color" value={form.design.accent} onChange={(e) => updateDesign("accent", e.target.value)} className="mt-2 w-full h-11 rounded-lg border border-black/10" /></label>
            <label className="block text-sm font-medium">Side<select value={form.design.cardSide} onChange={(e) => updateDesign("cardSide", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"><option value="front">Front</option><option value="back">Back</option></select></label>
          </div>
          <input value={form.design.logo} onChange={(e) => updateDesign("logo", e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Logo text" />
          <input value={form.design.tagline} onChange={(e) => updateDesign("tagline", e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="School tagline" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.design.showQr} onChange={(e) => updateDesign("showQr", e.target.checked)} /> QR code enabled</label>
          <div className="rounded-xl bg-[#E5EFE8] p-4 text-sm text-[#4A7C59]">{records.length} records ready for this batch.</div>
        </div>

        <div className="card-soft p-6 xl:col-span-2">
          <div className="label-eyebrow">Live preview</div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl p-5 text-white aspect-[1.58/1] relative overflow-hidden" style={{ background: form.design.accent }}>
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,white,transparent_30%)]" />
              <div className="relative flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-white/15 grid place-items-center font-display font-bold">{form.design.logo}</div>
                {form.design.showQr && <div className="w-14 h-14 rounded-lg bg-white text-[#0A1128] grid place-items-center"><QrCode className="w-9 h-9" /></div>}
              </div>
              <div draggable className="relative mt-6 flex items-center gap-4"><Grip className="w-4 h-4 opacity-60" /><div className="w-16 h-16 rounded-xl bg-white/20 grid place-items-center text-2xl font-display">{sample.name?.charAt(0)}</div><div><div className="text-2xl font-display font-semibold">{sample.name}</div><div className="text-white/70 text-sm">{sample.roll_no ? `Roll ${sample.roll_no}` : sample.core_subject}</div></div></div>
              <div className="relative mt-5 text-sm text-white/75">{form.design.tagline}</div>
            </div>
            <div className="rounded-2xl border border-black/10 p-5 aspect-[1.58/1] bg-white">
              <div className="label-eyebrow">Back side</div>
              <div className="mt-5 text-sm text-neutral-600 space-y-2">
                <div>Emergency contact: +91-9000000000</div>
                <div>Blood group: O+</div>
                <div>Valid for academic year 2026-27</div>
              </div>
              <div className="mt-8 h-16 rounded-xl bg-black/[0.04] grid place-items-center text-xs text-neutral-500">Terms, address, barcode area</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {records.slice(0, 8).map((r) => <div key={r.id || r.user_id} className="rounded-xl border border-black/5 p-3 text-sm"><div className="font-medium truncate">{r.name}</div><div className="text-xs text-neutral-500">{r.roll_no || r.core_subject || "Staff"}</div></div>)}
          </div>
        </div>
      </div>

      <div className="card-soft p-6">
        <div className="label-eyebrow">Recent batches</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {batches.map((b) => <div key={b.id} className="rounded-xl border border-black/5 bg-white p-4"><div className="font-medium capitalize">{b.target_type}</div><div className="text-sm text-neutral-500 mt-1">{b.record_count} cards</div><div className="text-xs text-neutral-400 mt-2">{new Date(b.created_at).toLocaleString("en-IN")}</div></div>)}
          {batches.length === 0 && <div className="text-sm text-neutral-500">No generated batches yet.</div>}
        </div>
      </div>
    </div>
  );
}
