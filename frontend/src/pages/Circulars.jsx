import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Megaphone, Plus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Circulars() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const canPost = ["super_admin", "school_admin", "teacher"].includes(user?.role);

  const load = () => api.get("/circulars").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    try {
      await api.post("/circulars", { title, body, audience });
      setTitle(""); setBody(""); setAudience("all"); setOpen(false);
      toast.success("Circular published");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="circulars-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Communication</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Circulars</h1>
          <p className="mt-1 text-sm text-neutral-500">{list.length} announcements</p>
        </div>
        {canPost && (
          <button onClick={() => setOpen(true)} className="btn-primary text-sm py-2.5" data-testid="new-circular">
            <Plus className="w-4 h-4" /> New circular
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.length === 0 && <div className="card-soft p-8 text-sm text-neutral-500">No announcements yet.</div>}
        {list.map((c) => (
          <div key={c.id} className="card-soft p-6" data-testid={`circular-card-${c.id}`}>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FBE9E3] text-[#E05236] font-semibold uppercase tracking-wider"><Megaphone className="w-3 h-3" /> {c.audience}</span>
              <span className="text-neutral-400">{new Date(c.created_at).toLocaleString("en-IN")}</span>
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold">{c.title}</h3>
            <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{c.body}</p>
            <div className="mt-4 text-xs text-neutral-500">— {c.author} ({c.author_role.replace("_", " ")})</div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="label-eyebrow">New circular</div>
                <h3 className="font-display text-2xl font-semibold mt-1">Make an announcement</h3>
              </div>
              <button onClick={() => setOpen(false)} aria-label="close" data-testid="close-circular-modal" className="p-2 rounded-lg hover:bg-black/5"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-5 space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-[#E05236]/30 focus:border-[#E05236]" data-testid="circular-title" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Body / details" className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-[#E05236]/30 focus:border-[#E05236] resize-none" data-testid="circular-body" />
              <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-[#E05236]/30" data-testid="circular-audience">
                <option value="all">Everyone</option>
                <option value="parents">Parents only</option>
                <option value="teachers">Teachers only</option>
                <option value="students">Students only</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-ghost text-sm py-2.5">Cancel</button>
              <button onClick={post} className="btn-primary text-sm py-2.5" data-testid="publish-circular">Publish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
