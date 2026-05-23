import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Wallet, CreditCard, Smartphone, Building, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const fmtINR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default function Fees() {
  const { user } = useAuth();
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [paying, setPaying] = useState(null);
  const [method, setMethod] = useState("upi");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/fees"), api.get("/students"), api.get("/classes")]).then(([f, s, c]) => {
      setFees(f.data); setStudents(s.data); setClasses(c.data);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const totals = useMemo(() => {
    return {
      pending: fees.filter((f) => f.status === "pending").reduce((a, b) => a + b.amount, 0),
      paid: fees.filter((f) => f.status === "paid").reduce((a, b) => a + b.amount, 0),
    };
  }, [fees]);

  const studentName = (id) => students.find((s) => s.id === id)?.name || "-";
  const visibleStudentIds = useMemo(() => {
    if (!selectedClassId || ["parent", "student"].includes(user?.role)) return new Set(students.map((s) => s.id));
    return new Set(students.filter((s) => s.class_id === selectedClassId).map((s) => s.id));
  }, [selectedClassId, students, user?.role]);
  const visibleFees = useMemo(() => fees.filter((f) => visibleStudentIds.has(f.student_id)), [fees, visibleStudentIds]);

  const pay = async () => {
    if (!paying) return;
    try {
      const { data } = await api.post("/fees/pay", { fee_id: paying.id, method });
      toast.success(`Paid · receipt ${data.receipt_no}`);
      setPaying(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Payment failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="fees-page">
      <div>
        <div className="label-eyebrow">Finance</div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Fees</h1>
        <p className="mt-1 text-sm text-neutral-500">{user?.role === "parent" ? "Your family ledger" : "Collections, dues, scholarships"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-soft p-6 !bg-[#0A1128] text-white">
          <div className="label-eyebrow text-white/60">Total collected</div>
          <div className="mt-2 text-4xl font-display font-semibold">{fmtINR(totals.paid)}</div>
        </div>
        <div className="card-soft p-6 !bg-[#FFF3F0]">
          <div className="label-eyebrow text-[#FF5E3A]/80">Outstanding</div>
          <div className="mt-2 text-4xl font-display font-semibold text-[#FF5E3A]">{fmtINR(totals.pending)}</div>
        </div>
        <div className="card-soft p-6">
          <div className="label-eyebrow">Receipts</div>
          <div className="mt-2 text-4xl font-display font-semibold">{fees.filter((f) => f.status === "paid").length}</div>
        </div>
      </div>

      {!["parent", "student"].includes(user?.role) && !selectedClassId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {classes.map((c) => {
            const ids = new Set(students.filter((s) => s.class_id === c.id).map((s) => s.id));
            const classFees = fees.filter((f) => ids.has(f.student_id));
            const pending = classFees.filter((f) => f.status === "pending").reduce((sum, f) => sum + f.amount, 0);
            return (
              <button key={c.id} type="button" onClick={() => setSelectedClassId(c.id)} className="card-soft p-5 text-left hover:-translate-y-0.5 transition">
                <div className="font-display text-lg font-semibold">{c.name}</div>
                <div className="mt-1 text-sm text-neutral-500">{ids.size} students</div>
                <div className="mt-3 text-2xl font-display font-semibold text-[#FF5E3A]">{fmtINR(pending)}</div>
                <div className="mt-1 text-xs text-neutral-500">pending dues</div>
              </button>
            );
          })}
        </div>
      )}

      {selectedClassId && <button onClick={() => setSelectedClassId("")} className="btn-ghost text-sm py-2.5">All classes</button>}

      {(["parent", "student"].includes(user?.role) || selectedClassId) && <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="fees-table">
            <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Term</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Due</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading && <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">Loading…</td></tr>}
              {!loading && visibleFees.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">No fee records.</td></tr>}
              {visibleFees.map((f) => (
                <tr key={f.id} className="hover:bg-black/[0.02]" data-testid={`fee-row-${f.id}`}>
                  <td className="px-6 py-4">{studentName(f.student_id)}</td>
                  <td className="px-6 py-4">{f.term} <span className="text-xs text-neutral-400">({f.type})</span></td>
                  <td className="px-6 py-4 font-semibold">{fmtINR(f.amount)}</td>
                  <td className="px-6 py-4 text-neutral-600">{f.due_date}</td>
                  <td className="px-6 py-4">
                    {f.status === "paid"
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E6F8F3] text-[#10B981] text-xs font-semibold"><CheckCircle2 className="w-3 h-3" /> Paid · {f.receipt_no}</span>
                      : <span className="px-2.5 py-1 rounded-full bg-[#FFF3F0] text-[#FF5E3A] text-xs font-semibold">Pending</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {f.status === "pending" && (
                      <button onClick={() => setPaying(f)} className="px-3 py-1.5 rounded-full bg-[#FF5E3A] text-white text-xs font-medium hover:bg-[#E04B28]" data-testid={`pay-fee-${f.id}`}>Pay now</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Pay modal */}
      {paying && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setPaying(null)} data-testid="pay-modal">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <div className="label-eyebrow">Mock payment</div>
            <h3 className="font-display text-2xl font-semibold mt-1">Pay {fmtINR(paying.amount)}</h3>
            <p className="text-sm text-neutral-500 mt-1">{studentName(paying.student_id)} · {paying.term}</p>

            <div className="mt-6 grid grid-cols-2 gap-2">
              {[
                ["upi", "UPI", Smartphone],
                ["card", "Card", CreditCard],
                ["netbanking", "Netbanking", Building],
                ["cash", "Cash", Wallet],
              ].map(([v, l, Ic]) => (
                <button key={v} onClick={() => setMethod(v)} className={`rounded-xl border p-4 flex items-center gap-3 transition ${method === v ? "border-[#FF5E3A] bg-[#FFF3F0]" : "border-black/10 hover:border-black/30"}`} data-testid={`pay-method-${v}`}>
                  <Ic className="w-5 h-5" />
                  <div className="text-sm font-medium">{l}</div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setPaying(null)} className="btn-ghost text-sm py-2.5" data-testid="cancel-pay">Cancel</button>
              <button onClick={pay} className="btn-primary text-sm py-2.5" data-testid="confirm-pay">Confirm payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
