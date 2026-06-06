import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Edit3, GraduationCap, KeyRound, Save, Search, Trash2, X } from "lucide-react";

const emptyForm = {
  name: "",
  phone_number: "",
  gender: "M",
  assigned_class_id: "",
  core_subject: "",
  profile_image: "",
};

const RequiredMark = () => <span className="ml-1 text-[#FF5E3A]" aria-hidden="true">*</span>;

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [t, c, free] = await Promise.all([api.get("/teachers"), api.get("/classes"), api.get("/classes?unassigned_only=true")]);
    setTeachers(t.data);
    setClasses(c.data);
    setAvailableClasses(free.data);
    setForm((v) => ({ ...v, assigned_class_id: free.data.some((klass) => klass.id === v.assigned_class_id) ? v.assigned_class_id : "" }));
  };

  useEffect(() => {
    load().catch(() => toast.error("Unable to load teachers"));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return teachers;
    return teachers.filter((t) =>
      t.name?.toLowerCase().includes(term) ||
      t.core_subject?.toLowerCase().includes(term) ||
      t.assigned_class?.name?.toLowerCase().includes(term)
    );
  }, [q, teachers]);

  const update = (key, value) => setForm((v) => ({ ...v, [key]: value }));
  const updateEditing = (key, value) => setEditing((v) => ({ ...v, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setCredentials(null);
    try {
      const payload = { ...form, profile_image: form.profile_image || null };
      const { data } = await api.post("/teachers", payload);
      setCredentials(data.credentials);
      setForm(emptyForm);
      await load();
      toast.success("Teacher registered");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to register teacher");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (teacher) => {
    setEditing({
      id: teacher.id,
      name: teacher.name || "",
      phone_number: teacher.phone_number || "",
      gender: teacher.gender || "M",
      assigned_class_id: teacher.assigned_class_id || "",
      core_subject: teacher.core_subject || "",
      profile_image: teacher.profile_image || "",
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const payload = { ...editing, profile_image: editing.profile_image || null };
      delete payload.id;
      await api.put(`/teachers/${editing.id}`, payload);
      setEditing(null);
      await load();
      toast.success("Teacher updated");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to update teacher");
    } finally {
      setSaving(false);
    }
  };

  const deleteTeacher = async (teacher) => {
    if (!window.confirm(`Delete ${teacher.name}'s teacher account?`)) return;
    setSaving(true);
    try {
      await api.delete(`/teachers/${teacher.id}`);
      await load();
      toast.success("Teacher deleted");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to delete teacher");
    } finally {
      setSaving(false);
    }
  };

  const editClassOptions = useMemo(() => {
    if (!editing) return [];
    const current = classes.find((c) => c.id === editing.assigned_class_id);
    const merged = current ? [current, ...availableClasses.filter((c) => c.id !== current.id)] : availableClasses;
    return merged;
  }, [availableClasses, classes, editing]);

  return (
    <div className="space-y-6" data-testid="teachers-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Admin</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Teachers</h1>
          <p className="mt-1 text-sm text-neutral-500">Register teachers, assign classes, and review class attendance.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-black/10 w-72">
          <Search className="w-4 h-4 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teachers" className="bg-transparent text-sm w-full outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card-soft p-6 space-y-4 xl:col-span-1" data-testid="teacher-register-form">
          <div>
            <div className="label-eyebrow">New teacher</div>
            <h3 className="mt-1 font-display text-xl font-semibold">Register Teacher</h3>
          </div>
          <div className="text-xs text-neutral-500"><RequiredMark /> Required fields</div>

          <label className="block text-sm font-medium">
            Name<RequiredMark />
            <input required value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Teacher name" />
          </label>

          <label className="block text-sm font-medium">
            Phone number<RequiredMark />
            <input required value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="+91..." />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Gender<RequiredMark />
              <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Core subject<RequiredMark />
              <input required value={form.core_subject} onChange={(e) => update("core_subject", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Mathematics" />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Assigned class
            <select value={form.assigned_class_id} onChange={(e) => update("assigned_class_id", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
              <option value="">No class assigned</option>
              {availableClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {availableClasses.length === 0 && <div className="mt-2 text-xs text-neutral-500">All classes already have assigned teachers. You can still register this teacher without a class.</div>}
          </label>

          <label className="block text-sm font-medium">
            Profile image URL
            <input value={form.profile_image} onChange={(e) => update("profile_image", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="https://..." />
          </label>

          <button type="submit" disabled={saving} className="w-full btn-primary text-sm py-2.5 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Registering..." : "Register Teacher"}
          </button>

          {credentials && (
            <div className="rounded-xl border border-[#10B981]/20 bg-[#E6F8F3] p-4 text-sm" data-testid="teacher-credentials">
              <div className="flex items-center gap-2 font-semibold text-[#10B981]"><KeyRound className="w-4 h-4" /> Login credentials</div>
              <div className="mt-2 font-mono text-xs">Email: {credentials.email}</div>
              <div className="mt-1 font-mono text-xs">Password: {credentials.password}</div>
            </div>
          )}
        </form>

        <div className="card-soft overflow-hidden xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="teachers-table">
              <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-6 py-4">Teacher</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Students</th>
                  <th className="px-6 py-4">Attendance</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">No teachers found.</td></tr>}
                {filtered.map((t) => (
                  <tr key={t.id || t.user_id} className="hover:bg-black/[0.02]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {t.profile_image ? (
                          <img src={t.profile_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#0A1128] text-white grid place-items-center"><GraduationCap className="w-5 h-5" /></div>
                        )}
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-neutral-500">{t.phone_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{t.assigned_class?.name || t.assigned_class_id || <span className="text-neutral-400">No class assigned</span>}</td>
                    <td className="px-6 py-4">{t.core_subject}</td>
                    <td className="px-6 py-4">{t.students_count || 0}</td>
                    <td className="px-6 py-4">{t.attendance_pct || 0}%</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(t)} className="p-2 rounded-lg hover:bg-black/5" aria-label={`edit ${t.name}`}><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => deleteTeacher(t)} className="p-2 rounded-lg text-neutral-400 hover:text-[#FF5E3A] hover:bg-[#FFF3F0]" aria-label={`delete ${t.name}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <form onSubmit={saveEdit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-eyebrow">Edit teacher</div>
                <h3 className="font-display text-2xl font-semibold mt-1">{editing.name}</h3>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-black/5" aria-label="close"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-xs text-neutral-500"><RequiredMark /> Required fields</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input required value={editing.name} onChange={(e) => updateEditing("name", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Teacher name *" />
              <input required value={editing.phone_number} onChange={(e) => updateEditing("phone_number", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Phone number *" />
              <select value={editing.gender} onChange={(e) => updateEditing("gender", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
                <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
              </select>
              <input required value={editing.core_subject} onChange={(e) => updateEditing("core_subject", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Core subject *" />
              <select value={editing.assigned_class_id} onChange={(e) => updateEditing("assigned_class_id", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
                <option value="">No class assigned</option>
                {editClassOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input value={editing.profile_image} onChange={(e) => updateEditing("profile_image", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Profile image URL" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost text-sm py-2.5">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary text-sm py-2.5 disabled:opacity-60"><Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
