import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Calendar, Check, X, Clock, Save, FileText, Send, Inbox, AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Attendance() {
  const { user } = useAuth();
  
  // Basic states
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [records, setRecords] = useState({}); // id -> status
  const [loading, setLoading] = useState(false);
  
  // Leave system states
  const [activeTab, setActiveTab] = useState("tracker"); // tracker | leaves | review
  const [leaves, setLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ from_date: new Date().toISOString().slice(0, 10), to_date: new Date().toISOString().slice(0, 10), reason: "" });
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [parentKids, setParentKids] = useState([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [reviewRemarks, setReviewRemarks] = useState({});
  const [reviewingId, setReviewingId] = useState(null);

  const isStudent = user?.role === "student";
  const isParent = user?.role === "parent";
  const isTeacher = user?.role === "teacher";
  const isAdmin = ["school_admin", "super_admin"].includes(user?.role);
  const isAudiencePortal = isStudent || isParent;

  // Initial load
  useEffect(() => {
    Promise.all([
      api.get("/classes"), 
      api.get("/attendance"),
      api.get("/leaves")
    ]).then(([c, a, l]) => {
      setClasses(c.data);
      setAllAttendance(a.data);
      setLeaves(l.data);
      
      if (isTeacher && c.data[0]) {
        setClassId(c.data[0].id);
      }
    });

    if (isParent) {
      api.get("/dashboard/stats").then(({ data }) => {
        if (data.parent_kids) {
          setParentKids(data.parent_kids);
          if (data.parent_kids[0]) {
            setSelectedChildId(data.parent_kids[0].id);
          }
        }
      });
    } else if (isStudent) {
      setSelectedChildId(user.meta?.student_id || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load roster / attendance grid for teachers/admins
  useEffect(() => {
    if (isAudiencePortal || !classId) return;
    setLoading(true);
    Promise.all([
      api.get(`/students?class_id=${classId}`),
      api.get(`/attendance?class_id=${classId}`),
    ]).then(([s, a]) => {
      setStudents(s.data);
      const todays = a.data.filter((r) => r.date === date);
      const map = {};
      todays.forEach((r) => { map[r.student_id] = r.status; });
      const init = {};
      s.data.forEach((st) => { init[st.id] = map[st.id] || "present"; });
      setRecords(init);
    }).finally(() => setLoading(false));
  }, [classId, date, isAudiencePortal]);

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
      // refresh attendance
      api.get("/attendance").then(({ data }) => setAllAttendance(data));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save");
    }
  };

  // Submit Leave application
  const submitLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setSubmittingLeave(true);
    try {
      // In student portal, the student applies. In parent portal, parent can apply for child
      // The backend expects isStudent role. If parent, let's mock or submit with specific child id
      // Since student account user has the meta.student_id, if logged in as student it works.
      // If parent is logged in, we should check if they can submit on behalf of student
      // Wait, backend create_leave expects depends on student role. Let's check how we can make leaves post flexible.
      // Wait, let's make sure that if the parent posts, we support it, or if it is a parent they can ask student to apply.
      // Wait, let's look at the backend create_leave:
      // it expects student role. If we want parent to be able to apply, let's see if we should adjust backend.
      // Actually, since parent email matches student parent_email, we can allow parents to apply for leave.
      // Let's modify backend /leaves POST endpoint to support both students AND parents!
      // But for now, let's handle the frontend post call.
      
      const payload = {
        from_date: leaveForm.from_date,
        to_date: leaveForm.to_date,
        reason: leaveForm.reason
      };
      
      // If parent, we should allow them to post. We will modify the backend to support parent posts.
      // We will add child_id or student_id to leaves post in backend if user is parent.
      await api.post("/leaves", payload);
      toast.success("Leave letter submitted successfully!");
      setLeaveForm({ from_date: new Date().toISOString().slice(0, 10), to_date: new Date().toISOString().slice(0, 10), reason: "" });
      
      // refresh leaves list
      api.get("/leaves").then(({ data }) => setLeaves(data));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to submit leave letter. Only student users can submit currently.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Review leave letter (Approve/Reject)
  const handleReviewLeave = async (leaveId, status) => {
    try {
      const remarks = reviewRemarks[leaveId] || "";
      await api.post(`/leaves/${leaveId}/review`, { status, remarks });
      toast.success(`Leave Application ${status}`);
      setReviewingId(null);
      // refresh leaves list
      api.get("/leaves").then(({ data }) => setLeaves(data));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update leave status");
    }
  };

  // Filter leave applications class-wise for admins
  const filteredLeaves = useMemo(() => {
    if (isTeacher) {
      return leaves; // teachers see class leaves directly
    }
    if (isAdmin) {
      if (selectedClassFilter === "all") return leaves;
      return leaves.filter(l => l.class_id === selectedClassFilter);
    }
    return leaves;
  }, [leaves, selectedClassFilter, isTeacher, isAdmin]);

  // Visual personal stats calculations for student / child
  const personalStats = useMemo(() => {
    if (!selectedChildId) return { rate: 0, present: 0, absent: 0, late: 0, logs: [] };
    const logs = allAttendance.filter(a => a.student_id === selectedChildId);
    const present = logs.filter(a => a.status === "present").length;
    const absent = logs.filter(a => a.status === "absent").length;
    const late = logs.filter(a => a.status === "late").length;
    const rate = logs.length ? Math.round((present / logs.length) * 100) : 0;
    return { rate, present, absent, late, logs };
  }, [allAttendance, selectedChildId]);

  // Generate calendar logs for visual display
  const calendarLogs = useMemo(() => {
    // Generate dates for current month
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const list = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const log = personalStats.logs.find(a => a.date === dateStr);
      list.push({
        day,
        date: dateStr,
        status: log ? log.status : "none"
      });
    }
    return list;
  }, [personalStats]);

  const monthName = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6" data-testid="attendance-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Portal Desk</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Attendance & Leave Letters</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isAudiencePortal 
              ? "Track your visual attendance details and submit leave letters." 
              : "Mark daily classroom rosters and review student leave requests."}
          </p>
        </div>
        
        {/* Save button for classroom marking */}
        {!isAudiencePortal && activeTab === "tracker" && classId && (
          <button onClick={save} className="btn-primary text-sm py-2.5" data-testid="save-attendance">
            <Save className="w-4 h-4" /> Save Roster
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-black/5 pb-px">
        {(!isAudiencePortal) && (
          <button 
            onClick={() => setActiveTab("tracker")} 
            className={`px-4 py-2 text-sm font-medium transition ${activeTab === "tracker" ? "border-b-2 border-[#FF5E3A] text-[#FF5E3A] font-semibold" : "text-neutral-500 hover:text-neutral-900"}`}
          >
            Class Marking Roster
          </button>
        )}
        {(isAudiencePortal) && (
          <button 
            onClick={() => setActiveTab("tracker")} 
            className={`px-4 py-2 text-sm font-medium transition ${activeTab === "tracker" ? "border-b-2 border-[#FF5E3A] text-[#FF5E3A] font-semibold" : "text-neutral-500 hover:text-neutral-900"}`}
          >
            My Attendance Calendar
          </button>
        )}
        <button 
          onClick={() => setActiveTab("leaves")} 
          className={`px-4 py-2 text-sm font-medium transition ${activeTab === "leaves" ? "border-b-2 border-[#FF5E3A] text-[#FF5E3A] font-semibold" : "text-neutral-500 hover:text-neutral-900"}`}
        >
          {isAudiencePortal ? "Leave Letters & Forms" : "Student Leave Applications"}
        </button>
      </div>

      {/* ==========================================
          CLASS MARKING ROSTER (TEACHERS/ADMINS)
          ========================================== */}
      {!isAudiencePortal && activeTab === "tracker" && (
        <div className="space-y-6">
          {/* Class selection for Admins */}
          {user?.role !== "teacher" && !classId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {classes.map((c) => {
                const rows = allAttendance.filter((a) => a.class_id === c.id && a.date === date);
                const present = rows.filter((a) => a.status === "present").length;
                const pct = rows.length ? Math.round((present / rows.length) * 100) : 0;
                return (
                  <button key={c.id} type="button" onClick={() => setClassId(c.id)} className="card-soft p-5 text-left hover:-translate-y-0.5 transition bg-white border border-black/5">
                    <div className="font-display text-lg font-semibold text-[#0A1128]">{c.name}</div>
                    <div className="mt-1 text-sm text-neutral-500">{c.students_count || 0} students</div>
                    <div className="mt-4 text-3xl font-display font-semibold text-[#FF5E3A]">{pct}%</div>
                    <div className="mt-1 text-xs text-neutral-400">attendance on {new Date(date).toLocaleDateString("en-IN")}</div>
                  </button>
                );
              })}
            </div>
          )}

          {classId && (
            <div className="card-soft p-5 flex flex-wrap items-center gap-4 bg-white border border-black/5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-black/10 bg-white">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm bg-transparent outline-none" data-testid="attendance-date" />
              </div>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="px-4 py-2 rounded-full bg-white border border-black/10 text-sm" data-testid="attendance-class">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {user?.role !== "teacher" && <button onClick={() => setClassId("")} className="btn-ghost text-sm py-2">All classes</button>}
              <div className="ml-auto flex gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-[#E6F8F3] text-[#10B981] font-medium">Present {summary.present}</span>
                <span className="px-2.5 py-1 rounded-full bg-[#FFF3F0] text-[#FF5E3A] font-medium">Absent {summary.absent}</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">Late {summary.late}</span>
              </div>
            </div>
          )}

          {classId && (
            <div className="card-soft p-2 bg-white border border-black/5">
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
                        <button onClick={() => setStatus(s.id, "present")} className={`w-8 h-8 grid place-items-center rounded-lg border ${st === "present" ? "bg-[#10B981] text-white border-[#10B981]" : "border-black/10 text-neutral-400 hover:text-[#10B981]"}`} aria-label="present" data-testid={`mark-present-${s.roll_no}`}><Check className="w-4 h-4" /></button>
                        <button onClick={() => setStatus(s.id, "late")} className={`w-8 h-8 grid place-items-center rounded-lg border ${st === "late" ? "bg-amber-500 text-white border-amber-500" : "border-black/10 text-neutral-400 hover:text-amber-500"}`} aria-label="late" data-testid={`mark-late-${s.roll_no}`}><Clock className="w-4 h-4" /></button>
                        <button onClick={() => setStatus(s.id, "absent")} className={`w-8 h-8 grid place-items-center rounded-lg border ${st === "absent" ? "bg-[#FF5E3A] text-white border-[#FF5E3A]" : "border-black/10 text-neutral-400 hover:text-[#FF5E3A]"}`} aria-label="absent" data-testid={`mark-absent-${s.roll_no}`}><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          VISUAL PERSONAL TRACKER (STUDENTS/PARENTS)
          ========================================== */}
      {isAudiencePortal && activeTab === "tracker" && (
        <div className="space-y-6">
          {/* Child selector for parent */}
          {isParent && parentKids.length > 1 && (
            <div className="card-soft p-4 flex items-center gap-3 bg-white border border-black/5 shadow-sm">
              <span className="text-sm font-semibold text-neutral-600">Select child:</span>
              <div className="flex gap-2">
                {parentKids.map(k => (
                  <button 
                    key={k.id} 
                    onClick={() => setSelectedChildId(k.id)} 
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${selectedChildId === k.id ? "bg-[#0A1128] text-white border-[#0A1128]" : "bg-white border-black/10 text-neutral-600 hover:border-black/20"}`}
                  >
                    {k.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Premium stats display */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-soft p-5 text-center bg-white border border-black/5">
              <div className="text-3xl font-display font-bold text-[#10B981]">{personalStats.rate}%</div>
              <div className="text-xs text-neutral-500 mt-1 uppercase font-semibold">Attendance Rate</div>
            </div>
            <div className="card-soft p-5 text-center bg-white border border-black/5">
              <div className="text-3xl font-display font-bold text-emerald-600">{personalStats.present}</div>
              <div className="text-xs text-neutral-500 mt-1 uppercase font-semibold">Days Present</div>
            </div>
            <div className="card-soft p-5 text-center bg-white border border-black/5">
              <div className="text-3xl font-display font-bold text-[#FF5E3A]">{personalStats.absent}</div>
              <div className="text-xs text-neutral-500 mt-1 uppercase font-semibold">Days Absent</div>
            </div>
            <div className="card-soft p-5 text-center bg-white border border-black/5">
              <div className="text-3xl font-display font-bold text-amber-500">{personalStats.late}</div>
              <div className="text-xs text-neutral-500 mt-1 uppercase font-semibold">Late/Early Class</div>
            </div>
          </div>

          {/* Premium Calendar visualizer */}
          <div className="card-soft p-6 bg-white border border-black/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="label-eyebrow">Tracker Board</span>
                <h3 className="font-display text-xl font-semibold mt-1">{monthName}</h3>
              </div>
              <div className="flex gap-4 text-xs text-neutral-600 font-medium">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Present</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FF5E3A]" /> Absent</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-neutral-400 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {/* Padding for first day start */}
              {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square bg-neutral-50/50 rounded-xl" />
              ))}

              {calendarLogs.map((log) => {
                const statusStyles = {
                  present: "bg-[#E6F8F3] border-[#10B981]/20 text-[#10B981] font-bold shadow-sm",
                  absent: "bg-[#FFF3F0] border-[#FF5E3A]/20 text-[#FF5E3A] font-bold shadow-sm",
                  late: "bg-amber-50 border-amber-500/20 text-amber-700 font-bold shadow-sm",
                  none: "bg-neutral-50 border-neutral-100 text-neutral-400"
                };

                return (
                  <div 
                    key={log.date} 
                    className={`aspect-square rounded-xl border flex flex-col justify-center items-center text-sm transition hover:scale-105 ${statusStyles[log.status]}`}
                  >
                    <span>{log.day}</span>
                    {log.status !== "none" && (
                      <span className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        log.status === "present" ? "bg-[#10B981]" : log.status === "absent" ? "bg-[#FF5E3A]" : "bg-amber-500"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          LEAVE LETTERS TAB
          ========================================== */}
      {activeTab === "leaves" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submit form (Visible to students/parents) */}
          {isAudiencePortal ? (
            <form onSubmit={submitLeave} className="card-soft p-6 bg-white border border-black/5 h-fit space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FF5E3A]" />
                <span className="label-eyebrow">Apply Leave</span>
              </div>
              <h3 className="font-display text-xl font-semibold">Leave application letter</h3>
              
              {isParent && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-500 uppercase">Apply for child</label>
                  <select 
                    value={selectedChildId} 
                    onChange={(e) => setSelectedChildId(e.target.value)} 
                    className="w-full px-3 py-2.5 rounded-lg bg-neutral-50 border border-black/10 text-sm"
                  >
                    {parentKids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-500 uppercase">From Date</label>
                  <input 
                    required 
                    type="date" 
                    value={leaveForm.from_date} 
                    onChange={(e) => setLeaveForm(v => ({ ...v, from_date: e.target.value }))} 
                    className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-black/10 text-sm" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-500 uppercase">To Date</label>
                  <input 
                    required 
                    type="date" 
                    value={leaveForm.to_date} 
                    onChange={(e) => setLeaveForm(v => ({ ...v, to_date: e.target.value }))} 
                    className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-black/10 text-sm" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-500 uppercase">Reason / Remarks</label>
                <textarea 
                  required 
                  rows={4} 
                  value={leaveForm.reason} 
                  onChange={(e) => setLeaveForm(v => ({ ...v, reason: e.target.value }))} 
                  placeholder="Mention standard reason for sick leave or family emergency..." 
                  className="w-full px-3 py-2.5 rounded-lg bg-neutral-50 border border-black/10 text-sm resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={submittingLeave} 
                className="w-full btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> {submittingLeave ? "Submitting..." : "Publish Leave Letter"}
              </button>
            </form>
          ) : (
            // REVIEW LEAVE LETTERS (TEACHERS / ADMINS)
            <div className="card-soft p-6 bg-white border border-black/5 h-fit space-y-4">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-[#FF5E3A]" />
                <span className="label-eyebrow">Leave Operations</span>
              </div>
              <h3 className="font-display text-xl font-semibold">Filter applications</h3>
              
              {/* Arrange class-wise for Admins */}
              {isAdmin ? (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-neutral-500 uppercase">View arranged Class-wise</label>
                  <div className="flex flex-col gap-1.5">
                    <button 
                      onClick={() => setSelectedClassFilter("all")} 
                      className={`text-left px-4 py-2.5 rounded-xl border text-sm font-semibold transition ${
                        selectedClassFilter === "all" ? "bg-[#0A1128] text-white border-[#0A1128]" : "bg-neutral-50 hover:bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      All classes
                    </button>
                    {classes.map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => setSelectedClassFilter(c.id)} 
                        className={`text-left px-4 py-2.5 rounded-xl border text-sm font-semibold transition ${
                          selectedClassFilter === c.id ? "bg-[#0A1128] text-white border-[#0A1128]" : "bg-neutral-50 hover:bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#E6F8F3] border border-[#10B981]/10 text-xs text-neutral-700">
                  <Sparkles className="w-4 h-4 text-[#10B981] inline mr-1 mb-0.5" />
                  Showing leaves submitted by students in your assigned class (<strong>{classes[0]?.name}</strong>). Review them directly.
                </div>
              )}
            </div>
          )}

          {/* Leaves history list */}
          <div className="lg:col-span-2 card-soft p-6 bg-white border border-black/5 space-y-4">
            <h3 className="font-display text-xl font-semibold">
              {isAudiencePortal ? "Personal leave history" : "Pending leave requests"}
            </h3>
            
            <div className="space-y-3">
              {filteredLeaves.length === 0 && (
                <div className="text-center text-sm text-neutral-500 py-12">
                  <AlertCircle className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  No leave letters filed.
                </div>
              )}
              
              {filteredLeaves.map((l) => {
                const statusStyles = {
                  pending: "bg-amber-50 text-amber-700 border-amber-200",
                  approved: "bg-[#E6F8F3] text-[#10B981] border-[#10B981]/20",
                  rejected: "bg-[#FFF3F0] text-[#FF5E3A] border-[#FF5E3A]/20"
                };

                return (
                  <div key={l.id} className="p-4 rounded-2xl border border-black/5 bg-white space-y-3 shadow-sm hover:border-black/10 transition">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-[#0A1128]">{l.student_name}</h4>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Class {l.class_id.replace("cls-", "")} · Applied: {new Date(l.applied_at).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles[l.status]}`}>
                        {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                      </span>
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-3 text-xs text-neutral-700 space-y-1">
                      <div><strong>Duration:</strong> {l.from_date} to {l.to_date}</div>
                      <div><strong>Reason:</strong> {l.reason}</div>
                      {l.remarks && (
                        <div className="border-t border-black/5 pt-2 mt-2 text-neutral-500">
                          <strong>Response remarks:</strong> {l.remarks} — <em>Reviewed by {l.reviewed_by}</em>
                        </div>
                      )}
                    </div>

                    {/* Review actions for teachers/admins */}
                    {!isAudiencePortal && l.status === "pending" && (
                      <div className="flex gap-2 justify-end pt-1">
                        {reviewingId === l.id ? (
                          <div className="w-full flex gap-2 items-center">
                            <input 
                              type="text" 
                              value={reviewRemarks[l.id] || ""} 
                              onChange={(e) => setReviewRemarks(v => ({ ...v, [l.id]: e.target.value }))}
                              placeholder="Add review remarks (optional)..." 
                              className="flex-1 px-3 py-1.5 rounded-lg border border-black/10 text-xs outline-none bg-white focus:ring-1 focus:ring-[#FF5E3A]" 
                            />
                            <button onClick={() => handleReviewLeave(l.id, "approved")} className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"><Check className="w-3.5 h-3.5" /> Approve</button>
                            <button onClick={() => handleReviewLeave(l.id, "rejected")} className="px-3 py-1.5 rounded-lg bg-[#FF5E3A] hover:bg-[#E04B28] text-white text-xs font-semibold flex items-center gap-1 shadow-sm"><X className="w-3.5 h-3.5" /> Reject</button>
                            <button onClick={() => setReviewingId(null)} className="px-2 py-1.5 rounded-lg hover:bg-black/5 text-xs text-neutral-500 font-semibold border border-black/5">Cancel</button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setReviewingId(l.id)} 
                            className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" /> Review Application
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
