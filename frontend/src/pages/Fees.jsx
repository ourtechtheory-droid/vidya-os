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
  const [paying, setPaying] = useState(null);
  const [method, setMethod] = useState("upi");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/fees"), api.get("/students")]).then(([f, s]) => {
      setFees(f.data); setStudents(s.data);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const totals = useMemo(() => {
    return {
      pending: fees.filter((f) => f.status === "pending").reduce((a, b) => a + b.amount, 0),
      paid: fees.filter((f) => f.status === "paid").reduce((a, b) => a + b.amount, 0),
    };
  }, [fees]);

  const studentName = (id) => students.find((s) => s.id === id)?.name || "—";

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
        <div className="card-soft p-6 !bg-[#FBE9E3]">
          <div className="label-eyebrow text-[#E05236]/80">Outstanding</div>
          <div className="mt-2 text-4xl font-display font-semibold text-[#E05236]">{fmtINR(totals.pending)}</div>
        </div>
        <div className="card-soft p-6">
          <div className="label-eyebrow">Receipts</div>
          <div className="mt-2 text-4xl font-display font-semibold">{fees.filter((f) => f.status === "paid").length}</div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
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
              {!loading && fees.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">No fee records.</td></tr>}
              {fees.map((f) => (
                <tr key={f.id} className="hover:bg-black/[0.02]" data-testid={`fee-row-${f.id}`}>
                  <td className="px-6 py-4">{studentName(f.student_id)}</td>
                  <td className="px-6 py-4">{f.term} <span className="text-xs text-neutral-400">({f.type})</span></td>
                  <td className="px-6 py-4 font-semibold">{fmtINR(f.amount)}</td>
                  <td className="px-6 py-4 text-neutral-600">{f.due_date}</td>
                  <td className="px-6 py-4">
                    {f.status === "paid"
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E5EFE8] text-[#4A7C59] text-xs font-semibold"><CheckCircle2 className="w-3 h-3" /> Paid · {f.receipt_no}</span>
                      : <span className="px-2.5 py-1 rounded-full bg-[#FBE9E3] text-[#E05236] text-xs font-semibold">Pending</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {f.status === "pending" && (
                      <button onClick={() => setPaying(f)} className="px-3 py-1.5 rounded-full bg-[#E05236] text-white text-xs font-medium hover:bg-[#C8432A]" data-testid={`pay-fee-${f.id}`}>Pay now</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                <button key={v} onClick={() => setMethod(v)} className={`rounded-xl border p-4 flex items-center gap-3 transition ${method === v ? "border-[#E05236] bg-[#FBE9E3]" : "border-black/10 hover:border-black/30"}`} data-testid={`pay-method-${v}`}>
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
