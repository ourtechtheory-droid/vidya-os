import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Trophy, FileSpreadsheet, Save } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useAuth } from "@/context/AuthContext";

export default function Exams() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [marks, setMarks] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeExam, setActiveExam] = useState(null);
  const [entry, setEntry] = useState({ student_id: "", subject: "", marks: "", max_marks: 100 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([api.get("/exams"), api.get("/marks"), api.get("/students")]).then(([e, m, s]) => {
      setExams(e.data);
      setMarks(m.data);
      setStudents(s.data);
      if (e.data[0]) setActiveExam(e.data[0].id);
    });
  }, []);

  const exam = exams.find((e) => e.id === activeExam);
  const examMarks = marks.filter((m) => m.exam_id === activeExam);
  const canEnterMarks = ["teacher", "school_admin", "super_admin"].includes(user?.role);

  const entryStudents = useMemo(() => {
    if (!exam?.class_id) return students;
    return students.filter((s) => s.class_id === exam.class_id);
  }, [exam?.class_id, students]);

  useEffect(() => {
    if (!canEnterMarks || !exam) return;
    setEntry((prev) => ({
      ...prev,
      student_id: entryStudents[0]?.id || "",
      subject: exam.subjects?.[0] || "",
      marks: "",
      max_marks: 100,
    }));
    setMessage("");
  }, [activeExam, canEnterMarks, entryStudents, exam]);

  useEffect(() => {
    if (!canEnterMarks || !activeExam || !entry.student_id || !entry.subject) return;
    const existing = marks.find((m) =>
      m.exam_id === activeExam && m.student_id === entry.student_id && m.subject === entry.subject
    );
    setEntry((prev) => ({
      ...prev,
      marks: existing ? String(existing.marks) : "",
      max_marks: existing?.max_marks || prev.max_marks || 100,
    }));
  }, [activeExam, canEnterMarks, entry.student_id, entry.subject, marks]);

  const saveResult = async (e) => {
    e.preventDefault();
    setMessage("");
    const scored = Number(entry.marks);
    const maximum = Number(entry.max_marks);

    if (!activeExam || !entry.student_id || !entry.subject || Number.isNaN(scored) || Number.isNaN(maximum)) {
      setMessage("Please select exam, student, subject and enter valid marks.");
      return;
    }
    if (maximum <= 0 || scored < 0 || scored > maximum) {
      setMessage("Marks must be between 0 and the maximum marks.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/marks", {
        exam_id: activeExam,
        student_id: entry.student_id,
        subject: entry.subject,
        marks: scored,
        max_marks: maximum,
      });
      const { data } = await api.get("/marks");
      setMarks(data);
      setMessage("Result saved successfully.");
    } catch (err) {
      setMessage(err?.response?.data?.detail || "Unable to save result. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const ranks = useMemo(() => {
    const byStudent = {};
    examMarks.forEach((m) => {
      byStudent[m.student_id] = byStudent[m.student_id] || { total: 0, max: 0, subjects: {} };
      byStudent[m.student_id].total += m.marks;
      byStudent[m.student_id].max += m.max_marks;
      byStudent[m.student_id].subjects[m.subject] = m.marks;
    });
    return Object.entries(byStudent)
      .map(([sid, v]) => {
        const st = students.find((s) => s.id === sid);
        const pct = v.max ? (v.total / v.max) * 100 : 0;
        return {
          id: sid,
          name: st?.name || "-",
          roll: st?.roll_no || "",
          class_id: st?.class_id || "",
          total: v.total,
          max: v.max,
          pct: Math.round(pct * 10) / 10,
          grade: pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "E",
        };
      })
      .sort((a, b) => b.pct - a.pct)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [examMarks, students]);

  const myId = user?.role === "student" ? user?.meta?.student_id : null;
  const myKidIds = useMemo(() => {
    if (user?.role !== "parent") return [];
    return students.filter((s) => s.parent_email === user.email).map((s) => s.id);
  }, [students, user?.email, user?.role]);
  const visibleRanks = useMemo(() => {
    if (myId) return ranks.filter((r) => r.id === myId);
    if (myKidIds.length) return ranks.filter((r) => myKidIds.includes(r.id));
    if (canEnterMarks) return ranks;
    return ranks.slice(0, 10);
  }, [ranks, myId, myKidIds, canEnterMarks]);

  const subjAvg = useMemo(() => {
    const acc = {};
    examMarks.forEach((m) => {
      acc[m.subject] = acc[m.subject] || { total: 0, n: 0 };
      acc[m.subject].total += (m.marks / m.max_marks) * 100;
      acc[m.subject].n += 1;
    });
    return Object.entries(acc).map(([subject, v]) => ({ subject, avg: Math.round(v.total / v.n) }));
  }, [examMarks]);

  return (
    <div className="space-y-6" data-testid="exams-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Performance</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Exams & Report Cards</h1>
        </div>
        <select
          value={activeExam || ""}
          onChange={(e) => setActiveExam(e.target.value)}
          className="px-4 py-2.5 rounded-full bg-white border border-black/10 text-sm"
          data-testid="exam-select"
        >
          {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {exam && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-soft p-6 lg:col-span-2">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-[#E05236]" />
              <h3 className="font-display text-xl font-semibold">{exam.name}</h3>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              {exam.type.replace("_", " ")} - {exam.start_date} to {exam.end_date}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {(exam.subjects || []).map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full bg-black/[0.04] text-neutral-700 font-medium">{s}</span>
              ))}
            </div>
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

          {canEnterMarks ? (
            <form onSubmit={saveResult} className="card-soft p-6 space-y-4" data-testid="marks-entry-form">
              <div>
                <div className="label-eyebrow">Result entry</div>
                <h3 className="mt-1 font-display text-xl font-semibold">Enter Student Marks</h3>
              </div>

              <label className="block text-sm font-medium">
                Student
                <select
                  value={entry.student_id}
                  onChange={(e) => setEntry((v) => ({ ...v, student_id: e.target.value }))}
                  className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
                  data-testid="marks-student-select"
                >
                  {entryStudents.map((s) => <option key={s.id} value={s.id}>{s.name} - Roll {s.roll_no}</option>)}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Subject
                <select
                  value={entry.subject}
                  onChange={(e) => setEntry((v) => ({ ...v, subject: e.target.value }))}
                  className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
                  data-testid="marks-subject-select"
                >
                  {(exam.subjects || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Marks
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={entry.marks}
                    onChange={(e) => setEntry((v) => ({ ...v, marks: e.target.value }))}
                    className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
                    placeholder="0"
                    data-testid="marks-input"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Max
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={entry.max_marks}
                    onChange={(e) => setEntry((v) => ({ ...v, max_marks: e.target.value }))}
                    className="mt-2 w-full px-3 py-2.5 rounded-lg bg-white border border-black/10 text-sm"
                    data-testid="max-marks-input"
                  />
                </label>
              </div>

              {message && (
                <div className={`text-sm ${message.includes("success") ? "text-[#4A7C59]" : "text-[#E05236]"}`} data-testid="marks-entry-message">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !entryStudents.length}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A1128] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#111B3D] disabled:opacity-60"
                data-testid="save-marks-button"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Result"}
              </button>
            </form>
          ) : (
            <div className="card-soft p-6 !bg-[#FBE9E3]">
              <div className="flex items-center gap-2 text-[#E05236]">
                <Trophy className="w-5 h-5" />
                <div className="label-eyebrow text-[#E05236]/80">Top performers</div>
              </div>
              <div className="mt-3 space-y-2">
                {ranks.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-white/70 rounded-xl px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-[#0A1128] text-white text-xs grid place-items-center font-semibold">{r.rank}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      <div className="text-xs text-neutral-500">Roll {r.roll}</div>
                    </div>
                    <div className="text-sm font-semibold">{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
              {visibleRanks.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-neutral-500">No marks yet.</td></tr>
              )}
              {visibleRanks.map((r) => (
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
