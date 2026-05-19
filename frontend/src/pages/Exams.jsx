import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, FileSpreadsheet, Plus, Save, Trophy } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useAuth } from "@/context/AuthContext";

const emptyExam = {
  name: "",
  class_id: "",
  subject: "",
  syllabus: "",
  exam_date: "",
  time: "",
};

const STATUS_LABEL = {
  scheduled: "Scheduled",
  under_correction: "Under correction",
  results_out: "Results are out",
};

const STATUS_STYLE = {
  scheduled: "bg-[#FBE9E3] text-[#E05236]",
  under_correction: "bg-amber-50 text-amber-700",
  results_out: "bg-[#E5EFE8] text-[#4A7C59]",
};

export default function Exams() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [marks, setMarks] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeExam, setActiveExam] = useState("");
  const [examForm, setExamForm] = useState(emptyExam);
  const [bulkMarks, setBulkMarks] = useState({});
  const [savingExam, setSavingExam] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);

  const canManage = ["teacher", "school_admin", "super_admin"].includes(user?.role);

  const load = async () => {
    const [e, m, s, c] = await Promise.all([api.get("/exams"), api.get("/marks"), api.get("/students"), api.get("/classes")]);
    setExams(e.data);
    setMarks(m.data);
    setStudents(s.data);
    setClasses(c.data);
    setActiveExam((current) => current || e.data[0]?.id || "");
    setExamForm((v) => ({ ...v, class_id: v.class_id || c.data[0]?.id || "" }));
  };

  useEffect(() => {
    load().catch(() => toast.error("Unable to load exams"));
  }, []);

  const exam = exams.find((e) => e.id === activeExam);
  const examStudents = useMemo(() => {
    if (!exam?.class_id) return [];
    return students.filter((s) => s.class_id === exam.class_id);
  }, [exam?.class_id, students]);
  const examMarks = useMemo(() => marks.filter((m) => m.exam_id === activeExam), [marks, activeExam]);
  const canShowResults = canManage || exam?.status === "results_out";
  const chartMarks = useMemo(() => canShowResults ? examMarks : [], [canShowResults, examMarks]);

  useEffect(() => {
    if (!exam || !canManage) return;
    const next = {};
    examStudents.forEach((student) => {
      const existing = marks.find((m) => m.exam_id === exam.id && m.student_id === student.id && m.subject === exam.subject);
      next[student.id] = existing ? String(existing.marks) : "";
    });
    setBulkMarks(next);
  }, [exam, examStudents, marks, canManage]);

  const ranks = useMemo(() => {
    const byStudent = {};
    chartMarks.forEach((m) => {
      byStudent[m.student_id] = byStudent[m.student_id] || { total: 0, max: 0 };
      byStudent[m.student_id].total += m.marks;
      byStudent[m.student_id].max += m.max_marks;
    });
    return Object.entries(byStudent)
      .map(([sid, v]) => {
        const st = students.find((s) => s.id === sid);
        const pct = v.max ? (v.total / v.max) * 100 : 0;
        return {
          id: sid,
          name: st?.name || "-",
          roll: st?.roll_no || "",
          total: v.total,
          max: v.max,
          pct: Math.round(pct * 10) / 10,
          grade: pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "E",
        };
      })
      .sort((a, b) => b.pct - a.pct)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [chartMarks, students]);

  const subjAvg = useMemo(() => {
    const acc = {};
    chartMarks.forEach((m) => {
      acc[m.subject] = acc[m.subject] || { total: 0, n: 0 };
      acc[m.subject].total += (m.marks / m.max_marks) * 100;
      acc[m.subject].n += 1;
    });
    return Object.entries(acc).map(([subject, v]) => ({ subject, avg: Math.round(v.total / v.n) }));
  }, [chartMarks]);

  const createExam = async (e) => {
    e.preventDefault();
    setSavingExam(true);
    try {
      const payload = {
        ...examForm,
        subjects: [examForm.subject],
        start_date: examForm.exam_date,
        end_date: examForm.exam_date,
      };
      const { data } = await api.post("/exams", payload);
      setExamForm({ ...emptyExam, class_id: classes[0]?.id || "" });
      await load();
      setActiveExam(data.id);
      toast.success("Exam post created");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to create exam");
    } finally {
      setSavingExam(false);
    }
  };

  const updateStatus = async (status) => {
    if (!exam) return;
    try {
      const { data } = await api.patch(`/exams/${exam.id}/status`, { status });
      setExams((items) => items.map((item) => item.id === data.id ? data : item));
      toast.success(STATUS_LABEL[status]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to update exam");
    }
  };

  const publishMarks = async (e) => {
    e.preventDefault();
    if (!exam) return;
    setSavingMarks(true);
    try {
      const entries = Object.entries(bulkMarks).filter(([, value]) => value !== "");
      if (!entries.length) {
        toast.error("Enter marks for at least one student");
        return;
      }
      await Promise.all(entries.map(([student_id, value]) => api.post("/marks", {
        exam_id: exam.id,
        student_id,
        subject: exam.subject,
        marks: Number(value),
        max_marks: 100,
      })));
      await api.patch(`/exams/${exam.id}/status`, { status: "results_out" });
      await load();
      toast.success("Marks submitted. Results are out.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to submit marks");
    } finally {
      setSavingMarks(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="exams-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Performance</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Exams & Report Cards</h1>
          <p className="mt-1 text-sm text-neutral-500">Create exam posts, correct papers, and publish results.</p>
        </div>
        <select value={activeExam || ""} onChange={(e) => setActiveExam(e.target.value)} className="px-4 py-2.5 rounded-full bg-white border border-black/10 text-sm" data-testid="exam-select">
          {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {canManage && (
        <form onSubmit={createExam} className="card-soft p-6 space-y-4" data-testid="exam-create-form">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FBE9E3] text-[#E05236] grid place-items-center"><Plus className="w-5 h-5" /></div>
            <div>
              <div className="label-eyebrow">New exam post</div>
              <h3 className="font-display text-xl font-semibold">Create Exam</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <input required value={examForm.name} onChange={(e) => setExamForm((v) => ({ ...v, name: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm xl:col-span-2" placeholder="Exam name" />
            <select required value={examForm.class_id} onChange={(e) => setExamForm((v) => ({ ...v, class_id: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input required value={examForm.subject} onChange={(e) => setExamForm((v) => ({ ...v, subject: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Subject" />
            <input required type="date" value={examForm.exam_date} onChange={(e) => setExamForm((v) => ({ ...v, exam_date: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" />
            <input required value={examForm.time} onChange={(e) => setExamForm((v) => ({ ...v, time: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm" placeholder="Time" />
            <textarea value={examForm.syllabus} onChange={(e) => setExamForm((v) => ({ ...v, syllabus: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm md:col-span-2 xl:col-span-6 resize-none" rows={2} placeholder="Syllabus / portions" />
          </div>
          <button type="submit" disabled={savingExam} className="btn-primary text-sm py-2.5 disabled:opacity-60"><Save className="w-4 h-4" /> {savingExam ? "Creating..." : "Create Exam Post"}</button>
        </form>
      )}

      {exam ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-soft p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-[#E05236]" />
                  <h3 className="font-display text-xl font-semibold">{exam.name}</h3>
                </div>
                <p className="text-sm text-neutral-500 mt-1">{exam.subject} - {exam.exam_date || exam.start_date} - {exam.time || "Time TBA"}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[exam.status || "scheduled"]}`}>{STATUS_LABEL[exam.status || "scheduled"]}</span>
            </div>
            {exam.syllabus && <p className="mt-4 text-sm text-neutral-700 leading-relaxed">{exam.syllabus}</p>}
            {canManage && (
              <div className="mt-5 flex flex-wrap gap-2">
                {(exam.status || "scheduled") === "scheduled" && (
                  <button onClick={() => updateStatus("under_correction")} className="btn-primary text-sm py-2.5" data-testid="mark-exam-complete"><CheckCircle2 className="w-4 h-4" /> Mark exam completed</button>
                )}
                {exam.status === "under_correction" && (
                  <button onClick={() => updateStatus("scheduled")} className="btn-ghost text-sm py-2.5">Move back to scheduled</button>
                )}
              </div>
            )}
            <div className="h-56 mt-6">
              <ResponsiveContainer>
                <BarChart data={subjAvg}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="subject" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
                  <Bar dataKey="avg" fill="#0A1128" radius={[8, 8, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {canManage && exam.status === "under_correction" ? (
            <form onSubmit={publishMarks} className="card-soft p-6 space-y-3" data-testid="bulk-marks-form">
              <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-[#E05236]" /><div className="label-eyebrow">Marks entry</div></div>
              <h3 className="font-display text-xl font-semibold">Corrected Scripts</h3>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {examStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 rounded-lg border border-black/5 p-2">
                    <span className="flex-1 min-w-0 text-sm truncate">{s.name} <span className="text-xs text-neutral-500">Roll {s.roll_no}</span></span>
                    <input type="number" min="0" max="100" step="0.5" value={bulkMarks[s.id] || ""} onChange={(e) => setBulkMarks((v) => ({ ...v, [s.id]: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg border border-black/10 text-sm" placeholder="/100" />
                  </label>
                ))}
              </div>
              <button type="submit" disabled={savingMarks} className="w-full btn-primary text-sm py-2.5 disabled:opacity-60" data-testid="publish-results"><Save className="w-4 h-4" /> {savingMarks ? "Submitting..." : "Submit Marks & Publish Results"}</button>
            </form>
          ) : (
            <div className="card-soft p-6 !bg-[#FBE9E3]">
              <div className="flex items-center gap-2 text-[#E05236]"><Trophy className="w-5 h-5" /><div className="label-eyebrow text-[#E05236]/80">Status</div></div>
              <h3 className="mt-3 font-display text-xl font-semibold">{STATUS_LABEL[exam.status || "scheduled"]}</h3>
              <p className="mt-2 text-sm text-neutral-700">
                {(exam.status || "scheduled") === "scheduled" && "Exam post is visible to students and parents."}
                {exam.status === "under_correction" && "Exam is completed and answer scripts are under correction."}
                {exam.status === "results_out" && "Marks have been published for students and parents."}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="card-soft p-8 text-sm text-neutral-500">No exam posts yet.</div>
      )}

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="ranks-table">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-6 py-4">Rank</th>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Percent</th>
                <th className="px-6 py-4">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {!canShowResults && <tr><td colSpan={5} className="px-6 py-12 text-center text-neutral-500">Results are not published yet.</td></tr>}
              {canShowResults && ranks.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-neutral-500">No marks yet.</td></tr>}
              {canShowResults && ranks.map((r) => (
                <tr key={r.id} className="hover:bg-black/[0.02]" data-testid={`rank-row-${r.roll}`}>
                  <td className="px-6 py-4 font-semibold">#{r.rank}</td>
                  <td className="px-6 py-4">{r.name} <span className="text-xs text-neutral-500">(Roll {r.roll})</span></td>
                  <td className="px-6 py-4 font-mono">{r.total}/{r.max}</td>
                  <td className="px-6 py-4">{r.pct}%</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded-full bg-[#E5EFE8] text-[#4A7C59] text-xs font-semibold">{r.grade}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
