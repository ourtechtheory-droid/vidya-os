import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { GraduationCap, KeyRound, Save, Search } from "lucide-react";

const emptyForm = {
  name: "",
  phone_number: "",
  gender: "M",
  assigned_class_id: "",
  core_subject: "",
  profile_image: "",
};

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [t, c] = await Promise.all([api.get("/teachers"), api.get("/classes")]);
    setTeachers(t.data);
    setClasses(c.data);
    setForm((v) => ({ ...v, assigned_class_id: v.assigned_class_id || c.data[0]?.id || "" }));
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

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setCredentials(null);
    try {
      const payload = { ...form, profile_image: form.profile_image || null };
      const { data } = await api.post("/teachers", payload);
      setCredentials(data.credentials);
      setForm({ ...emptyForm, assigned_class_id: classes[0]?.id || "" });
      await load();
      toast.success("Teacher registered");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to register teacher");
    } finally {
      setSaving(false);
    }
  };

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

          <label className="block text-sm font-medium">
            Name
            <input required value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Teacher name" />
          </label>

          <label className="block text-sm font-medium">
            Phone number
            <input required value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="+91..." />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Gender
              <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Core subject
              <input required value={form.core_subject} onChange={(e) => update("core_subject", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Mathematics" />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Assigned class
            <select required value={form.assigned_class_id} onChange={(e) => update("assigned_class_id", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Profile image URL
            <input value={form.profile_image} onChange={(e) => update("profile_image", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="https://..." />
          </label>

          <button type="submit" disabled={saving || !classes.length} className="w-full btn-primary text-sm py-2.5 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Registering..." : "Register Teacher"}
          </button>

          {credentials && (
            <div className="rounded-xl border border-[#4A7C59]/20 bg-[#E5EFE8] p-4 text-sm" data-testid="teacher-credentials">
              <div className="flex items-center gap-2 font-semibold text-[#4A7C59]"><KeyRound className="w-4 h-4" /> Login credentials</div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-neutral-500">No teachers found.</td></tr>}
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
                    <td className="px-6 py-4">{t.assigned_class?.name || t.assigned_class_id || "-"}</td>
                    <td className="px-6 py-4">{t.core_subject}</td>
                    <td className="px-6 py-4">{t.students_count || 0}</td>
                    <td className="px-6 py-4">{t.attendance_pct || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
