import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, School } from "lucide-react";

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/classes");
    setClasses(data);
  };

  useEffect(() => {
    load().catch(() => toast.error("Unable to load classes"));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/classes", { grade, section });
      setGrade("");
      setSection("");
      await load();
      toast.success("Class created");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to create class");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="classes-page">
      <div>
        <div className="label-eyebrow">Admin</div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Classes</h1>
        <p className="mt-1 text-sm text-neutral-500">Create classes from 1 to 10 and add sections only when needed.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={create} className="card-soft p-6 space-y-4">
          <div>
            <div className="label-eyebrow">New class</div>
            <h3 className="mt-1 font-display text-xl font-semibold">Create Class</h3>
          </div>
          <label className="block text-sm font-medium">
            Class
            <input required value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="1, 2, 3 ... 10" data-testid="class-grade-input" />
          </label>
          <label className="block text-sm font-medium">
            Section
            <input value={section} onChange={(e) => setSection(e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="A, B, C (optional)" data-testid="class-section-input" />
          </label>
          <button type="submit" disabled={saving} className="w-full btn-primary text-sm py-2.5 disabled:opacity-60" data-testid="create-class-button">
            <Save className="w-4 h-4" /> {saving ? "Creating..." : "Create Class"}
          </button>
        </form>

        <div className="card-soft p-6 lg:col-span-2">
          <div className="label-eyebrow">Available classes</div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {classes.map((c) => (
              <div key={c.id} className="rounded-xl border border-black/5 p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#FBE9E3] text-[#E05236] grid place-items-center"><School className="w-4 h-4" /></div>
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-neutral-500">Class {c.grade}{c.section ? ` - Section ${c.section}` : ""}</div>
                  </div>
                </div>
              </div>
            ))}
            {classes.length === 0 && <div className="text-sm text-neutral-500">No classes created yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
