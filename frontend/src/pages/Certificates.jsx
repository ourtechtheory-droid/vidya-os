import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Award, Download, Grip, Layers, Save } from "lucide-react";

const defaultDesign = {
  title: "Certificate of Achievement",
  recipient: "Student Name",
  body: "For outstanding performance and dedication during the academic year.",
  accent: "#E05236",
  border: "double",
  font: "Outfit",
  logo: "Vi",
  signature: "Principal",
};

export default function Certificates() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ name: "Annual Achievement", type: "achievement", design: defaultDesign });

  const load = async () => {
    const { data } = await api.get("/certificate-templates");
    setTemplates(data);
  };
  useEffect(() => { load().catch(() => toast.error("Unable to load certificate templates")); }, []);

  const updateDesign = (key, value) => setForm((v) => ({ ...v, design: { ...v.design, [key]: value } }));

  const save = async (e) => {
    e.preventDefault();
    const { data } = await api.post("/certificate-templates", form);
    setTemplates((items) => [data, ...items]);
    toast.success("Certificate template saved");
  };

  const applyTemplate = (template) => setForm({ name: template.name, type: template.type, design: { ...defaultDesign, ...template.design } });

  return (
    <div className="space-y-6" data-testid="certificates-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Document studio</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Certificate Generator</h1>
          <p className="mt-1 text-sm text-neutral-500">Design reusable templates, preview live, bulk generate, and export print-ready PDFs.</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary text-sm py-2.5"><Download className="w-4 h-4" /> Export PDF</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form onSubmit={save} className="card-soft p-6 space-y-4">
          <div className="flex items-center gap-2"><Award className="w-5 h-5 text-[#E05236]" /><div className="label-eyebrow">Editor</div></div>
          <input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Template name" />
          <select value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
            <option value="achievement">Achievement</option><option value="participation">Participation</option><option value="sports">Sports</option><option value="completion">Completion</option><option value="other">Other</option>
          </select>
          {["title", "recipient", "body", "logo", "signature"].map((key) => (
            <label key={key} className="block text-sm font-medium capitalize">
              {key}
              {key === "body" ? (
                <textarea value={form.design[key]} onChange={(e) => updateDesign(key, e.target.value)} rows={3} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm resize-none" />
              ) : (
                <input value={form.design[key]} onChange={(e) => updateDesign(key, e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" />
              )}
            </label>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">Accent<input type="color" value={form.design.accent} onChange={(e) => updateDesign("accent", e.target.value)} className="mt-2 w-full h-11 rounded-lg border border-black/10" /></label>
            <label className="block text-sm font-medium">Border<select value={form.design.border} onChange={(e) => updateDesign("border", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"><option>double</option><option>solid</option><option>dashed</option></select></label>
          </div>
          <button className="w-full btn-primary text-sm py-2.5"><Save className="w-4 h-4" /> Save Template</button>
        </form>

        <div className="xl:col-span-2 space-y-6">
          <div className="card-soft p-6">
            <div className="label-eyebrow">Live preview</div>
            <div className="mt-4 bg-white rounded-xl p-6 border border-black/10">
              <div className="aspect-[1.414/1] p-8 grid place-items-center" style={{ border: `8px ${form.design.border} ${form.design.accent}` }}>
                <div className="text-center max-w-2xl">
                  <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center text-white font-display font-bold" style={{ background: form.design.accent }}>{form.design.logo}</div>
                  <div className="mt-8 text-4xl font-display font-semibold" style={{ color: form.design.accent }}>{form.design.title}</div>
                  <div className="mt-8 text-sm uppercase tracking-[0.3em] text-neutral-500">Presented to</div>
                  <div draggable className="mt-3 text-3xl font-display font-semibold inline-flex items-center gap-2"><Grip className="w-4 h-4 text-neutral-300" />{form.design.recipient}</div>
                  <p className="mt-6 text-neutral-600">{form.design.body}</p>
                  <div className="mt-10 inline-block border-t border-black px-10 pt-2 text-sm">{form.design.signature}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="card-soft p-6">
            <div className="flex items-center gap-2 mb-4"><Layers className="w-5 h-5 text-[#E05236]" /><div className="label-eyebrow">Reusable templates</div></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map((template) => <button key={template.id} onClick={() => applyTemplate(template)} className="rounded-xl border border-black/5 bg-white p-4 text-left hover:bg-black/[0.02]"><div className="font-medium">{template.name}</div><div className="text-xs text-neutral-500 capitalize mt-1">{template.type}</div></button>)}
              {templates.length === 0 && <div className="text-sm text-neutral-500">No saved templates yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
