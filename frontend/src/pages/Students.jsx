import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ChevronDown, Edit3, Search, Save, Trash2, UserPlus, X } from "lucide-react";

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
  profile_image: "",
  student_email: "",
  password: "",
  create_login: true,
};

const RequiredMark = () => <span className="ml-1 text-[#FF5E3A]" aria-hidden="true">*</span>;

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyStudent);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const canManageStudents = ["super_admin", "school_admin"].includes(user?.role);
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
  const updateEditing = (key, value) => setEditing((v) => ({ ...v, [key]: value }));

  const createStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const required = new Set(["name", "roll_no", "class_id", "gender", "parent_email", "create_login"]);
      const payload = Object.fromEntries(
        Object.entries(form)
          .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
          .filter(([key, value]) => required.has(key) || value)
      );
      const { data } = await api.post("/students", payload);
      const nextClass = assignedClassId || form.class_id;
      setForm({ ...emptyStudent, class_id: nextClass, gender: "M" });
      setQ("");
      setClassFilter(assignedClassId || "all");
      setCreateOpen(false);
      await load();
      toast.success(data?.parent_login_created
        ? `Student created and parent login linked: ${data.parent_email} / Pass@1234`
        : "Student created and linked to the parent dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to create student");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (student) => {
    setEditing({
      ...emptyStudent,
      ...student,
      parent_email: student.parent_email || "",
      parent_phone: student.parent_phone || "",
      address: student.address || "",
      house: student.house || "",
      category: student.category || "",
      profile_image: student.profile_image || "",
      student_email: student.student_email || "",
      password: student.password_hint || "",
      create_login: true,
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const required = new Set(["name", "roll_no", "class_id", "gender", "parent_email", "create_login"]);
      const payload = Object.fromEntries(
        Object.entries(editing)
          .filter(([key]) => key !== "id")
          .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
          .filter(([key, value]) => required.has(key) || value)
      );
      await api.put(`/students/${editing.id}`, payload);
      setEditing(null);
      await load();
      toast.success("Student profile and login credentials updated!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to update student");
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async (student) => {
    if (!window.confirm(`Delete ${student.name}'s profile and linked records?`)) return;
    setDeletingId(student.id);
    try {
      await api.delete(`/students/${student.id}`);
      await load();
      toast.success("Student deleted");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to delete student");
    } finally {
      setDeletingId("");
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

      {canManageStudents && (
        <div className="card-soft overflow-hidden" data-testid="student-create-form">
          <button type="button" onClick={() => setCreateOpen((v) => !v)} className="w-full p-6 flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E6F8F3] text-[#10B981] grid place-items-center"><UserPlus className="w-5 h-5" /></div>
              <div>
                <div className="label-eyebrow">New profile</div>
                <h3 className="font-display text-xl font-semibold">Create Student</h3>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 transition ${createOpen ? "rotate-180" : ""}`} />
          </button>
          {createOpen && <form onSubmit={createStudent} className="px-6 pb-6 space-y-4">
            <div className="text-xs text-neutral-500"><RequiredMark /> Required fields</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <label className="block text-sm font-medium">
              Name<RequiredMark />
              <input required value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Student name" />
            </label>
            <label className="block text-sm font-medium">
              Roll no<RequiredMark />
              <input required value={form.roll_no} onChange={(e) => update("roll_no", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="01" />
            </label>
            <label className="block text-sm font-medium">
              Class<RequiredMark />
              <select required value={form.class_id} onChange={(e) => update("class_id", e.target.value)} disabled={!!assignedClassId} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm disabled:opacity-70">
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Section
              <input value={form.section} onChange={(e) => update("section", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Optional" />
            </label>
            <label className="block text-sm font-medium">
              Gender<RequiredMark />
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
              Parent email<RequiredMark />
              <input required type="email" value={form.parent_email} onChange={(e) => update("parent_email", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="parent@example.com" />
              <span className="mt-1 block text-[11px] text-neutral-400">Use the same parent email for siblings so they appear under one parent login.</span>
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
            <label className="block text-sm font-medium xl:col-span-2">
              Profile image URL
              <input value={form.profile_image} onChange={(e) => update("profile_image", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="https://..." />
            </label>
            
            <div className="border-t border-black/[0.06] pt-4 xl:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="xl:col-span-2">
                <h4 className="text-sm font-semibold text-[#0A1128]">Generate Student Login Credentials</h4>
                <p className="text-xs text-neutral-400 mt-0.5">An active login account will be automatically generated and linked to this profile.</p>
              </div>
              <label className="block text-sm font-medium">
                Student Email (Optional)
                <input type="email" value={form.student_email} onChange={(e) => update("student_email", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Leave blank to auto-generate" />
              </label>
              <label className="block text-sm font-medium">
                Login Password (Optional)
                <input type="text" value={form.password} onChange={(e) => update("password", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Default is Pass@1234" />
              </label>
            </div>
            </div>

            <button type="submit" disabled={saving || !form.class_id} className="btn-primary text-sm py-2.5 disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? "Creating..." : "Create Student Profile"}
            </button>
          </form>}
        </div>
      )}

      {!assignedClassId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {classes.map((c) => {
            const count = students.filter((s) => s.class_id === c.id).length;
            const active = classFilter === c.id;
            return (
              <button key={c.id} type="button" onClick={() => setClassFilter(c.id)} className={`card-soft p-4 text-left transition ${active ? "ring-2 ring-[#FF5E3A]" : "hover:-translate-y-0.5"}`}>
                <div className="font-display text-lg font-semibold">{c.name}</div>
                <div className="mt-1 text-sm text-neutral-500">{count} students</div>
                <div className="mt-2 text-xs text-neutral-500 truncate">{(c.subjects || []).join(", ") || "No subjects set"}</div>
              </button>
            );
          })}
        </div>
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
                      {s.profile_image ? (
                        <img src={s.profile_image} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#0A1128] text-white grid place-items-center font-medium text-sm">{s.name.charAt(0)}</div>
                      )}
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-neutral-500">{s.gender === "F" ? "Female" : s.gender === "M" ? "Male" : "Other"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{className(s.class_id)}</td>
                  <td className="px-6 py-4 font-mono text-xs">{s.roll_no}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-[#FFF3F0] text-[#FF5E3A] text-xs font-medium">{s.house || "-"}</span>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {s.parent_email ? (
                      s.parent_email
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-[#FFF3F0] text-[#FF5E3A] text-xs font-semibold">Not linked</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/app/students/${s.id}`} className="text-xs text-[#FF5E3A] font-medium self-center" data-testid={`view-student-${s.roll_no}`}>View</Link>
                      {canManageStudents && (
                        <>
                          <button onClick={() => startEdit(s)} className="p-2 rounded-lg hover:bg-black/5" aria-label={`edit ${s.name}`}><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => deleteStudent(s)} disabled={deletingId === s.id} className="p-2 rounded-lg text-neutral-400 hover:text-[#FF5E3A] hover:bg-[#FFF3F0] disabled:opacity-50" aria-label={`delete ${s.name}`}><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <form onSubmit={saveEdit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-5xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-eyebrow">Edit profile</div>
                <h3 className="font-display text-2xl font-semibold mt-1">{editing.name}</h3>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-black/5" aria-label="close"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-xs text-neutral-500"><RequiredMark /> Required fields</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <input required value={editing.name} onChange={(e) => updateEditing("name", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Student name *" />
              <input required value={editing.roll_no} onChange={(e) => updateEditing("roll_no", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Roll no *" />
              <select required value={editing.class_id} onChange={(e) => updateEditing("class_id", e.target.value)} disabled={!!assignedClassId} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm disabled:opacity-70">
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input value={editing.section} onChange={(e) => updateEditing("section", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Section" />
              <select value={editing.gender} onChange={(e) => updateEditing("gender", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
                <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
              </select>
              <input type="date" value={editing.dob || ""} onChange={(e) => updateEditing("dob", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" />
              <input required type="email" value={editing.parent_email} onChange={(e) => updateEditing("parent_email", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Parent email *" />
              <input value={editing.parent_phone} onChange={(e) => updateEditing("parent_phone", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Parent phone" />
              <input value={editing.address} onChange={(e) => updateEditing("address", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm xl:col-span-2" placeholder="Address" />
              <input value={editing.house} onChange={(e) => updateEditing("house", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="House" />
              <input value={editing.category} onChange={(e) => updateEditing("category", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Category" />
              <input value={editing.profile_image} onChange={(e) => updateEditing("profile_image", e.target.value)} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm xl:col-span-2" placeholder="Profile image URL" />
            </div>
            
            <div className="border-t border-black/[0.06] pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <h4 className="text-sm font-semibold text-[#0A1128]">Student Login Credentials</h4>
                <p className="text-xs text-neutral-400 mt-0.5">Update login credentials below. Changes will be synced directly to their login account.</p>
              </div>
              <label className="block text-sm font-medium">
                Student Email
                <input type="email" value={editing.student_email} onChange={(e) => updateEditing("student_email", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Leave blank to auto-generate" />
              </label>
              <label className="block text-sm font-medium">
                Login Password (Optional)
                <input type="text" value={editing.password} onChange={(e) => updateEditing("password", e.target.value)} className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Pass@1234" />
              </label>
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
