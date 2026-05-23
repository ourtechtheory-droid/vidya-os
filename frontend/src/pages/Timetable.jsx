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

  const newBlankEntries = () =>
    days.flatMap((day) =>
      Array.from({ length: periods }, (_, i) => {
        const period = i + 1;
        return {
          id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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

  const moveEntry = (fromId, toId) => {
    const table = timetables.find((t) => t.class_id === classId);
    if (!table) return;
    const from = table.entries.find((e) => e.id === fromId);
    const to = table.entries.find((e) => e.id === toId);
    if (!from || !to || from.type === "break") return;
    updateEntry(from.id, { day: to.day, period: to.period });
    updateEntry(to.id, { day: from.day, period: from.period });
  };

  const cell = (day, period) => active?.entries?.find((e) => e.day === day && e.period === period);

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
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="px-4 py-2.5 rounded-full bg-white border border-black/10 text-sm">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex rounded-full bg-black/[0.04] p-1">
          {["class", "teacher"].map((mode) => <button key={mode} onClick={() => setView(mode)} className={`px-4 py-1.5 rounded-full text-sm capitalize ${view === mode ? "bg-white shadow-sm" : "text-neutral-500"}`}>{mode}-wise</button>)}
        </div>
        {view === "teacher" && <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="px-4 py-2.5 rounded-full bg-white border border-black/10 text-sm">
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
                return (
                  <div key={`${day}-${period}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => moveEntry(e.dataTransfer.getData("entry"), entry?.id)} className="p-2 border-t border-l border-black/5 min-h-24">
                    {entry ? (
                      <div draggable={entry.type !== "break"} onDragStart={(e) => e.dataTransfer.setData("entry", entry.id)} className={`h-full rounded-xl p-3 ${entry.type === "break" ? "bg-neutral-100 text-neutral-500" : entry.type === "lab" ? "bg-[#E6F8F3] text-[#2F5D3A]" : "bg-[#FFF3F0] text-[#0A1128]"}`}>
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 shrink-0 opacity-50" />
                          <div className="min-w-0 flex-1">
                            <input value={entry.title} onChange={(e) => updateEntry(entry.id, { title: e.target.value, subject: e.target.value })} disabled={entry.type === "break"} className="w-full bg-transparent font-semibold text-sm outline-none" />
                            <select value={entry.teacher_id} onChange={(e) => {
                              const teacher = teachers.find((t) => t.user_id === e.target.value);
                              updateEntry(entry.id, { teacher_id: e.target.value, teacher_name: teacher?.name || "Unassigned" });
                            }} disabled={entry.type === "break"} className="mt-1 w-full bg-transparent text-xs outline-none">
                              <option value="">Unassigned</option>
                              {teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
                            </select>
                            <div className="mt-1 text-[11px] opacity-70">{entry.room}</div>
                          </div>
                        </div>
                      </div>
                    ) : <div className="h-full rounded-xl border border-dashed border-black/10" />}
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
