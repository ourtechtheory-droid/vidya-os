import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { Search, Filter } from "lucide-react";

export default function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/students"), api.get("/classes")])
      .then(([s, c]) => { setStudents(s.data); setClasses(c.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const okQ = !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.roll_no || "").includes(q);
      const okC = classFilter === "all" || s.class_id === classFilter;
      return okQ && okC;
    });
  }, [students, q, classFilter]);

  return (
    <div className="space-y-6" data-testid="students-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Roster</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-neutral-500">{filtered.length} of {students.length} students</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-black/10 w-72">
            <Search className="w-4 h-4 text-neutral-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or roll no" className="bg-transparent text-sm w-full outline-none" data-testid="students-search" />
          </div>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="px-4 py-2.5 rounded-full bg-white border border-black/10 text-sm" data-testid="students-class-filter">
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

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
              {loading && <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">Loading…</td></tr>}
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
                  <td className="px-6 py-4">{(classes.find((c) => c.id === s.class_id) || {}).name || s.class_id}</td>
                  <td className="px-6 py-4 font-mono text-xs">{s.roll_no}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-[#FBE9E3] text-[#E05236] text-xs font-medium">{s.house || "—"}</span>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{s.parent_email || "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/app/students/${s.id}`} className="text-xs text-[#E05236] font-medium" data-testid={`view-student-${s.roll_no}`}>View profile →</Link>
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
