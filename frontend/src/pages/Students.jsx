import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Search, Save, UserPlus } from "lucide-react";

const emptyStudent = {
  name: "",
  roll_no: "",
  class_id: "",
  section: "",
  gender: "M",
  dob: "",
  parent_email: "",
  parent_phone: "",
  address: "",
  house: "",
  category: "",
};

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyStudent);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canCreate = ["super_admin", "school_admin", "teacher"].includes(user?.role);
  const assignedClassId = user?.role === "teacher" ? user?.meta?.assigned_class_id : null;

  const load = async () => {
    setLoading(true);
    const [s, c] = await Promise.all([api.get("/students"), api.get("/classes")]);
    setStudents(s.data);
    setClasses(c.data);
    const firstClass = assignedClassId || c.data[0]?.id || "";
    setForm((v) => ({ ...v, class_id: v.class_id || firstClass }));
    if (assignedClassId) setClassFilter(assignedClassId);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => {
      setLoading(false);
      toast.error("Unable to load students");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedClassId]);

  const classOptions = useMemo(() => {
    if (!assignedClassId) return classes;
    return classes.filter((c) => c.id === assignedClassId);
  }, [assignedClassId, classes]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const okQ = !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.roll_no || "").includes(q);
      const okC = classFilter === "all" || s.class_id === classFilter;
      return okQ && okC;
    });
  }, [students, q, classFilter]);

  const update = (key, value) => setForm((v) => ({ ...v, [key]: value }));

  const createStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const required = new Set(["name", "roll_no", "class_id", "gender"]);
      const payload = Object.fromEntries(
        Object.entries(form)
          .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
          .filter(([key, value]) => required.has(key) || value)
      );
      await api.post("/students", payload);
      const nextClass = assignedClassId || form.class_id;
      setForm({ ...emptyStudent, class_id: nextClass, gender: "M" });
      await load();
      toast.success("Student profile created");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to create student");
    } finally {
      setSaving(false);
    }
  };

  const className = (id) => (classes.find((c) => c.id === id) || {}).name || id;

  return (
    <div className="space-y-6" data-testid="students-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Roster</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-neutral-500">{filtered.length} of {students.length} students</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-black/10 w-72">
            <Search className="w-4 h-4 text-neutral-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or roll no" className="bg-transparent text-sm w-full outline-none" data-testid="students-search" />
          </div>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="px-4 py-2.5 rounded-full bg-white border border-black/10 text-sm" data-testid="students-class-filter">
            {!assignedClassId && <option value="all">All classes</option>}
            {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {canCreate && (
        <form onSubmit={createStudent} className="card-soft p-6 space-y-4" data-testid="student-create-form">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E5EFE8] text-[#4A7C59] grid place-items-center"><UserPlus className="w-5 h-5" /></div>
            <div>
              <div className="label-eyebrow">New profile</div>
              <h3 className="font-display text-xl font-semibold">Create Student</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <label className="block text-sm font-medium">
              Name
              <input required value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Student name" />
            </label>
            <label className="block text-sm font-medium">
              Roll no
              <input required value={form.roll_no} onChange={(e) => update("roll_no", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="01" />
            </label>
            <label className="block text-sm font-medium">
              Class
              <select required value={form.class_id} onChange={(e) => update("class_id", e.target.value)} disabled={!!assignedClassId} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm disabled:opacity-70">
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Section
              <input value={form.section} onChange={(e) => update("section", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Optional" />
            </label>
            <label className="block text-sm font-medium">
              Gender
              <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              DOB
              <input type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" />
            </label>
            <label className="block text-sm font-medium">
              Parent email
              <input type="email" value={form.parent_email} onChange={(e) => update("parent_email", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="parent@example.com" />
            </label>
            <label className="block text-sm font-medium">
              Parent phone
              <input value={form.parent_phone} onChange={(e) => update("parent_phone", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="+91..." />
            </label>
            <label className="block text-sm font-medium xl:col-span-2">
              Address
              <input value={form.address} onChange={(e) => update("address", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Home address" />
            </label>
            <label className="block text-sm font-medium">
              House
              <input value={form.house} onChange={(e) => update("house", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Eagle" />
            </label>
            <label className="block text-sm font-medium">
              Category
              <input value={form.category} onChange={(e) => update("category", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="GEN" />
            </label>
          </div>

          <button type="submit" disabled={saving || !form.class_id} className="btn-primary text-sm py-2.5 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Creating..." : "Create Student Profile"}
          </button>
        </form>
      )}

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="students-table">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Student</th>
                <th className="px-6 py-4 font-semibold">Class</th>
                <th className="px-6 py-4 font-semibold">Roll</th>
                <th className="px-6 py-4 font-semibold">House</th>
                <th className="px-6 py-4 font-semibold">Parent</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading && <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">Loading...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">No students found.</td></tr>}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-black/[0.02]" data-testid={`student-row-${s.roll_no}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#0A1128] text-white grid place-items-center font-medium text-sm">{s.name.charAt(0)}</div>
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-neutral-500">{s.gender === "F" ? "Female" : s.gender === "M" ? "Male" : "Other"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{className(s.class_id)}</td>
                  <td className="px-6 py-4 font-mono text-xs">{s.roll_no}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-[#FBE9E3] text-[#E05236] text-xs font-medium">{s.house || "-"}</span>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{s.parent_email || "-"}</td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/app/students/${s.id}`} className="text-xs text-[#E05236] font-medium" data-testid={`view-student-${s.roll_no}`}>View profile</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
