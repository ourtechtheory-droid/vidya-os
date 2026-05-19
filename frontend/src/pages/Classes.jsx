import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, School, Trash2, X } from "lucide-react";

const CONFIRM_SENTENCES = [
  "I understand this class will be deleted from VidyaOS.",
  "Delete this class after checking all linked school records.",
  "I confirm this class deletion is intentional.",
  "This class is no longer needed in the school records.",
  "Proceed with deleting this class from the admin panel.",
];

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const requiredSentence = useMemo(() => {
    if (!deleteTarget) return "";
    const index = Math.floor(Math.random() * CONFIRM_SENTENCES.length);
    return CONFIRM_SENTENCES[index];
  }, [deleteTarget]);

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

  const requestDelete = (klass) => {
    setDeleteTarget(klass);
    setTyped("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || typed !== requiredSentence) return;
    setDeleting(true);
    try {
      await api.delete(`/classes/${deleteTarget.id}`, { data: { confirmation_sentence: typed } });
      setDeleteTarget(null);
      setTyped("");
      await load();
      toast.success("Class deleted");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to delete class");
    } finally {
      setDeleting(false);
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
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#FBE9E3] text-[#E05236] grid place-items-center"><School className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-neutral-500">Class {c.grade}{c.section ? ` - Section ${c.section}` : ""}</div>
                    <div className="mt-2 text-xs text-neutral-600">
                      Class teacher: <span className="font-medium text-[#0A1128]">{c.class_teacher?.name || "Not assigned"}</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      Students: <span className="font-medium text-[#0A1128]">{c.students_count || 0}/20</span>
                    </div>
                  </div>
                  <button onClick={() => requestDelete(c)} className="p-2 rounded-lg text-neutral-400 hover:text-[#E05236] hover:bg-[#FBE9E3]" aria-label={`delete ${c.name}`} data-testid={`delete-class-${c.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {classes.length === 0 && <div className="text-sm text-neutral-500">No classes created yet.</div>}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-eyebrow text-[#E05236]">Danger zone</div>
                <h3 className="font-display text-2xl font-semibold mt-1">Delete {deleteTarget.name}?</h3>
                <p className="mt-2 text-sm text-neutral-600">This action is intentionally hard to reach. Type the exact sentence below to confirm.</p>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="p-2 rounded-lg hover:bg-black/5" aria-label="close"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-5 rounded-xl bg-[#FBE9E3] text-[#0A1128] p-4 text-sm font-medium">
              {requiredSentence}
            </div>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-4 w-full px-4 py-3 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-[#E05236]/30" placeholder="Type the sentence exactly" data-testid="class-delete-confirm-input" />
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost text-sm py-2.5">Cancel</button>
              <button onClick={confirmDelete} disabled={typed !== requiredSentence || deleting} className="inline-flex items-center gap-2 rounded-lg bg-[#E05236] text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50" data-testid="confirm-delete-class">
                <Trash2 className="w-4 h-4" /> {deleting ? "Deleting..." : "Delete Class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
