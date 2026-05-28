import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { CalendarDays, Download, GripVertical, Plus, RefreshCw, Save, Users } from "lucide-react";

const periodTime = (p) => `${8 + p}:00`;

export default function Timetable() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [classId, setClassId] = useState("");
  const [view, setView] = useState("class");
  const [teacherId, setTeacherId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [c, t, tt] = await Promise.all([api.get("/classes"), api.get("/teachers"), api.get("/timetable")]);
    setClasses(c.data);
    setTeachers(t.data);
    setTimetables(tt.data);
    setClassId((v) => v || c.data[0]?.id || "");
    setTeacherId((v) => v || t.data[0]?.user_id || "");
  };

  useEffect(() => { load().catch(() => toast.error("Unable to load timetable")); }, []);

  const active = useMemo(() => {
    const base = timetables.find((t) => t.class_id === classId);
    if (view === "teacher" && teacherId && base) {
      return { ...base, entries: base.entries.filter((e) => e.teacher_id === teacherId) };
    }
    return base;
  }, [classId, teacherId, timetables, view]);

  const days = active?.days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const periods = active?.periods_per_day || classes.find((c) => c.id === classId)?.periods_per_day || 8;
  const selectedClass = classes.find((c) => c.id === classId);

  // Safe fallback UUID generator
  const generateUUID = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "uuid-" + Math.random().toString(36).substring(2, 15) + "-" + Math.random().toString(36).substring(2, 15);
  };

  const newBlankEntries = () =>
    days.flatMap((day) =>
      Array.from({ length: periods }, (_, i) => {
        const period = i + 1;
        return {
          id: generateUUID(),
          day,
          period,
          type: period === 4 ? "break" : "class",
          title: period === 4 ? "Break" : "",
          subject: "",
          teacher_id: "",
          teacher_name: "",
          room: period === 4 ? "Campus" : selectedClass?.name || "Classroom",
        };
      })
    );

  const createBlank = () => {
    if (!classId) return;
    const table = {
      id: generateUUID(),
      class_id: classId,
      class_name: selectedClass?.name || "Class",
      days,
      periods_per_day: periods,
      entries: newBlankEntries(),
    };
    setTimetables((items) => [table, ...items.filter((item) => item.class_id !== classId)]);
    toast.success("Blank timetable ready to edit");
  };

  const generate = async () => {
    setSaving(true);
    try {
      const { data } = await api.post("/timetable/generate", { class_id: classId, periods_per_day: periods });
      setTimetables((items) => [data, ...items.filter((item) => item.class_id !== data.class_id)]);
      toast.success("Smart timetable generated");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Unable to generate timetable");
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = (entryId, patch) => {
    setTimetables((items) => items.map((table) => table.class_id !== classId ? table : {
      ...table,
      entries: table.entries.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry),
    }));
  };

  const save = async () => {
    const table = timetables.find((t) => t.class_id === classId);
    if (!table) return toast.error("Create or generate a timetable first");
    const { data } = await api.put(`/timetable/${classId}`, {
      entries: table.entries,
      days: table.days || days,
      periods_per_day: table.periods_per_day || periods,
    });
    setTimetables((items) => [data, ...items.filter((item) => item.class_id !== data.class_id)]);
    toast.success("Timetable saved");
  };

  const moveEntryToSlot = (fromId, targetDay, targetPeriod) => {
    const table = timetables.find((t) => t.class_id === classId);
    if (!table) return;
    const from = table.entries.find((e) => e.id === fromId);
    if (!from || from.type === "break") return;

    const to = table.entries.find((e) => e.day === targetDay && e.period === targetPeriod);
    if (to) {
      if (to.type === "break") return;
      const fromDay = from.day;
      const fromPeriod = from.period;
      updateEntry(from.id, { day: targetDay, period: targetPeriod });
      updateEntry(to.id, { day: fromDay, period: fromPeriod });
      toast.success(`Swapped slots successfully`);
    } else {
      updateEntry(from.id, { day: targetDay, period: targetPeriod });
      toast.success(`Moved subject to slot successfully`);
    }
  };

  const cell = (day, period) => active?.entries?.find((e) => e.day === day && e.period === period);

  // Subject options computing (uses class subjects or premium standard list fallback)
  const subjectOptions = useMemo(() => {
    if (selectedClass?.subjects && selectedClass.subjects.length > 0) {
      return selectedClass.subjects;
    }
    return ["Maths", "Science", "Social Science", "English", "Hindi", "Telugu", "Art", "Physical Education", "Computer Science"];
  }, [selectedClass]);

  // Premium HSL-aligned color tag based on subject content
  const getSubjectStyle = (entry) => {
    if (entry.type === "break") return "bg-neutral-100 text-neutral-500 border border-neutral-200/60";
    if (entry.type === "lab") return "bg-[#E6F8F3] text-[#2F5D3A] border border-[#2F5D3A]/20 shadow-sm";

    const sub = (entry.subject || entry.title || "").toLowerCase();
    if (sub.includes("math")) return "bg-blue-50 text-blue-800 border border-blue-200/50 shadow-sm";
    if (sub.includes("scien") || sub.includes("phy") || sub.includes("chem") || sub.includes("bio")) return "bg-emerald-50 text-emerald-800 border border-emerald-200/50 shadow-sm";
    if (sub.includes("soc") || sub.includes("hist") || sub.includes("geo")) return "bg-amber-50 text-amber-800 border border-amber-200/50 shadow-sm";
    if (sub.includes("eng")) return "bg-indigo-50 text-indigo-800 border border-indigo-200/50 shadow-sm";
    if (sub.includes("hin") || sub.includes("tel") || sub.includes("lang")) return "bg-purple-50 text-purple-800 border border-purple-200/50 shadow-sm";
    if (sub.includes("art") || sub.includes("music") || sub.includes("phys")) return "bg-pink-50 text-pink-800 border border-pink-200/50 shadow-sm";
    if (sub.includes("comp")) return "bg-cyan-50 text-cyan-800 border border-cyan-200/50 shadow-sm";

    return "bg-[#FFF3F0] text-[#0A1128] border border-orange-200/40 shadow-sm";
  };

  return (
    <div className="space-y-6" data-testid="timetable-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Smart scheduler</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Timetable Generator</h1>
          <p className="mt-1 text-sm text-neutral-500">Generate a timetable or start blank, then edit, save, and print.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={createBlank} disabled={!classId} className="btn-ghost text-sm py-2.5 disabled:opacity-60"><Plus className="w-4 h-4" /> Blank</button>
          <button onClick={generate} disabled={!classId || saving} className="btn-primary text-sm py-2.5 disabled:opacity-60"><RefreshCw className="w-4 h-4" /> {saving ? "Generating..." : "Generate"}</button>
          <button onClick={save} className="btn-ghost text-sm py-2.5"><Save className="w-4 h-4" /> Save</button>
          <button onClick={() => window.print()} className="btn-ghost text-sm py-2.5"><Download className="w-4 h-4" /> Print PDF</button>
        </div>
      </div>

      <div className="card-soft p-5 flex flex-wrap items-center gap-3">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="px-4 py-2.5 rounded-full bg-white border border-black/10 text-sm focus:ring-brand outline-none">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex rounded-full bg-black/[0.04] p-1">
          {["class", "teacher"].map((mode) => <button key={mode} onClick={() => setView(mode)} className={`px-4 py-1.5 rounded-full text-sm capitalize ${view === mode ? "bg-white shadow-sm" : "text-neutral-500"}`}>{mode}-wise</button>)}
        </div>
        {view === "teacher" && <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="px-4 py-2.5 rounded-full bg-white border border-black/10 text-sm focus:ring-brand outline-none">
          {teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
        </select>}
        <div className="ml-auto flex items-center gap-2 text-xs text-[#10B981] font-medium"><Users className="w-4 h-4" /> Conflict checks enabled</div>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="grid min-w-[920px]" style={{ gridTemplateColumns: `90px repeat(${days.length}, minmax(130px, 1fr))` }}>
          <div className="p-4 bg-black/[0.02] text-xs font-semibold text-neutral-500">Period</div>
          {days.map((day) => <div key={day} className="p-4 bg-black/[0.02] text-xs font-semibold text-neutral-500">{day}</div>)}
          {Array.from({ length: periods }, (_, i) => i + 1).map((period) => (
            <div key={`row-${period}`} className="contents">
              <div key={`p-${period}`} className="p-3 border-t border-black/5 text-xs text-neutral-500">P{period}<div>{periodTime(period)}</div></div>
              {days.map((day) => {
                const entry = cell(day, period);
                const isDraggable = entry && entry.type !== "break";
                return (
                  <div 
                    key={`${day}-${period}`} 
                    onDragOver={(e) => e.preventDefault()} 
                    onDrop={(e) => moveEntryToSlot(e.dataTransfer.getData("entry"), day, period)} 
                    className="p-2 border-t border-l border-black/5 min-h-28 transition-colors duration-200 hover:bg-neutral-50/40 relative group"
                  >
                    {entry ? (
                      <div 
                        draggable={isDraggable} 
                        onDragStart={(e) => e.dataTransfer.setData("entry", entry.id)} 
                        className={`h-full rounded-xl p-3 flex flex-col justify-between transition-all duration-200 ${isDraggable ? "hover:scale-[1.02] active:scale-[0.98] cursor-grab active:cursor-grabbing" : ""} ${getSubjectStyle(entry)}`}
                      >
                        <div className="flex items-start gap-1">
                          {isDraggable && <GripVertical className="w-3.5 h-3.5 shrink-0 opacity-40 mt-1 cursor-grab" />}
                          <div className="min-w-0 flex-1">
                            {entry.type === "break" ? (
                              <div className="font-bold text-sm tracking-wide text-neutral-500 uppercase">{entry.title || "Break"}</div>
                            ) : (
                              <select 
                                value={entry.subject || entry.title || ""} 
                                onChange={(e) => updateEntry(entry.id, { title: e.target.value, subject: e.target.value })} 
                                className="w-full bg-transparent font-bold text-sm outline-none cursor-pointer text-inherit hover:underline"
                              >
                                <option value="" className="text-[#0A1128]">-- Choose --</option>
                                {subjectOptions.map((sub) => (
                                  <option key={sub} value={sub} className="text-[#0A1128] font-medium">{sub}</option>
                                ))}
                              </select>
                            )}

                            {entry.type !== "break" && (
                              <select 
                                value={entry.teacher_id || ""} 
                                onChange={(e) => {
                                  const teacher = teachers.find((t) => t.user_id === e.target.value);
                                  updateEntry(entry.id, { teacher_id: e.target.value, teacher_name: teacher?.name || "Unassigned" });
                                }} 
                                className="mt-1.5 w-full bg-transparent text-[11px] outline-none cursor-pointer text-inherit/80 font-medium"
                              >
                                <option value="" className="text-[#0A1128]">Unassigned</option>
                                {teachers.map((t) => <option key={t.user_id} value={t.user_id} className="text-[#0A1128]">{t.name}</option>)}
                              </select>
                            )}
                            
                            <div className="mt-2 text-[10px] uppercase tracking-wider opacity-75 font-semibold">{entry.room}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full rounded-xl border-2 border-dashed border-neutral-200 group-hover:border-neutral-300 group-hover:bg-neutral-50 transition-all duration-200 min-h-[80px]" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {!active && (
          <div className="p-8 text-center text-sm text-neutral-500 border-t border-black/5">
            No timetable yet for this class. Use Blank to enter it manually or Generate to auto-fill it.
          </div>
        )}
      </div>
    </div>
  );
}
