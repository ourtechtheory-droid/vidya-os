import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Calendar, Check, X, Clock, Save } from "lucide-react";

export default function Attendance() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({}); // id -> status
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/classes").then(({ data }) => {
      setClasses(data);
      if (data[0]) setClassId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    Promise.all([
      api.get(`/students?class_id=${classId}`),
      api.get(`/attendance?class_id=${classId}`),
    ]).then(([s, a]) => {
      setStudents(s.data);
      const todays = a.data.filter((r) => r.date === date);
      const map = {};
      todays.forEach((r) => { map[r.student_id] = r.status; });
      // default present
      const init = {};
      s.data.forEach((st) => { init[st.id] = map[st.id] || "present"; });
      setRecords(init);
    }).finally(() => setLoading(false));
  }, [classId, date]);

  const setStatus = (sid, status) => setRecords((r) => ({ ...r, [sid]: status }));

  const summary = useMemo(() => {
    const v = Object.values(records);
    return {
      present: v.filter((s) => s === "present").length,
      absent: v.filter((s) => s === "absent").length,
      late: v.filter((s) => s === "late").length,
    };
  }, [records]);

  const save = async () => {
    try {
      const recs = students.map((s) => ({ student_id: s.id, status: records[s.id] || "present" }));
      await api.post("/attendance/mark", { class_id: classId, date, records: recs });
      toast.success("Attendance saved");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save");
    }
  };

  return (
    <div className="space-y-6" data-testid="attendance-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Daily mark</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Attendance</h1>
          <p className="mt-1 text-sm text-neutral-500">Tap a student to update status. Saved automatically when you click save.</p>
        </div>
        <button onClick={save} className="btn-primary text-sm py-2.5" data-testid="save-attendance"><Save className="w-4 h-4" /> Save</button>
      </div>

      <div className="card-soft p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-black/10 bg-white">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm bg-transparent outline-none" data-testid="attendance-date" />
        </div>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="px-4 py-2 rounded-full bg-white border border-black/10 text-sm" data-testid="attendance-class">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-[#E5EFE8] text-[#4A7C59] font-medium">Present {summary.present}</span>
          <span className="px-2.5 py-1 rounded-full bg-[#FBE9E3] text-[#E05236] font-medium">Absent {summary.absent}</span>
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">Late {summary.late}</span>
        </div>
      </div>

      <div className="card-soft p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2">
          {loading && <div className="p-6 text-sm text-neutral-500">Loading…</div>}
          {!loading && students.length === 0 && <div className="p-6 text-sm text-neutral-500">No students in this class.</div>}
          {students.map((s) => {
            const st = records[s.id] || "present";
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-black/5 hover:bg-black/[0.02]" data-testid={`att-row-${s.roll_no}`}>
                <div className="w-9 h-9 rounded-full bg-[#0A1128] text-white grid place-items-center text-sm font-medium">{s.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-xs text-neutral-500">Roll {s.roll_no}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setStatus(s.id, "present")} className={`w-8 h-8 grid place-items-center rounded-lg border ${st === "present" ? "bg-[#4A7C59] text-white border-[#4A7C59]" : "border-black/10 text-neutral-400 hover:text-[#4A7C59]"}`} aria-label="present" data-testid={`mark-present-${s.roll_no}`}><Check className="w-4 h-4" /></button>
                  <button onClick={() => setStatus(s.id, "late")} className={`w-8 h-8 grid place-items-center rounded-lg border ${st === "late" ? "bg-amber-500 text-white border-amber-500" : "border-black/10 text-neutral-400 hover:text-amber-500"}`} aria-label="late" data-testid={`mark-late-${s.roll_no}`}><Clock className="w-4 h-4" /></button>
                  <button onClick={() => setStatus(s.id, "absent")} className={`w-8 h-8 grid place-items-center rounded-lg border ${st === "absent" ? "bg-[#E05236] text-white border-[#E05236]" : "border-black/10 text-neutral-400 hover:text-[#E05236]"}`} aria-label="absent" data-testid={`mark-absent-${s.roll_no}`}><X className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
