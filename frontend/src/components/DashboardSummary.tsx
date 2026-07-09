import { Plus, CreditCard, BarChart3, ShieldAlert, ArrowRight, Users, Repeat, Megaphone } from 'lucide-react';
import type { DirectDebt, Expense } from '../types';

interface Props {
  groupName: string;
  currentYourNetGBP: number;
  minimizedDebts: DirectDebt[];
  recurringExpenses: Expense[];
  onAddBill: () => void;
  onPaidBack: () => void;
  onOpenAnalytics: () => void;
  onOpenAudit: () => void;
  onOpenNotices: () => void;
  onPayDebt: (debt: DirectDebt) => void;
}

export default function DashboardSummary({
  groupName, currentYourNetGBP, minimizedDebts, recurringExpenses,
  onAddBill, onPaidBack, onOpenAnalytics, onOpenAudit, onOpenNotices, onPayDebt
}: Props) {
  return (
    <>
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 text-white rounded-[36px] p-6 shadow-xl relative">
        <p className="text-xs font-bold text-emerald-200/80 uppercase tracking-widest">{groupName} Master Net</p>
        <h2 className="text-5xl font-black mt-1 tracking-tight">
          {currentYourNetGBP >= 0 ? `+£${currentYourNetGBP.toFixed(2)}` : `-£${Math.abs(currentYourNetGBP).toFixed(2)}`}
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button onClick={onAddBill} className="bg-white text-emerald-950 font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.96]">
            <Plus size={15} strokeWidth={3} /> Add Bill
          </button>
          <button onClick={onPaidBack} className="bg-emerald-900 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-1 transition-all active:scale-[0.96] border border-emerald-700/30 shadow-md">
            <CreditCard size={14} /> Paid Back
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <button onClick={onOpenAnalytics} className="p-3.5 bg-stone-50 border border-stone-200 text-stone-800 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm transition-all active:scale-[0.98]"><BarChart3 size={16} className="text-emerald-700" /><span className="text-[10px] font-black tracking-wider uppercase">Metrics</span></button>
        <button onClick={onOpenAudit} className="p-3.5 bg-stone-50 border border-stone-200 text-stone-800 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm transition-all active:scale-[0.98]"><ShieldAlert size={16} className="text-amber-600" /><span className="text-[10px] font-black tracking-wider uppercase">Audit</span></button>
        <button onClick={onOpenNotices} className="p-3.5 bg-stone-50 border border-stone-200 text-stone-800 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm transition-all active:scale-[0.98]"><Megaphone size={16} className="text-sky-600" /><span className="text-[10px] font-black tracking-wider uppercase">Notices</span></button>
      </div>

      <div>
        <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase mb-3 flex items-center gap-1.5">
          <Users size={14} /> Net Optimized Clearances
        </h3>
        {minimizedDebts.length === 0 ? (
          <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">All balances squared away! 🎉</div>
        ) : (
          <div className="space-y-2.5">
            {minimizedDebts.map((debt, idx) => (
              <div key={idx} className="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between text-sm shadow-sm">
                <div className="flex items-center gap-2 text-stone-700 font-bold">
                  <span>{debt.from}</span>
                  <ArrowRight size={14} className="text-stone-400" />
                  <span>{debt.to}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-emerald-700 text-base">£{debt.amount.toFixed(2)}</span>
                  {debt.from === 'You' && (
                    <button onClick={() => onPayDebt(debt)} className="bg-white border border-stone-200 text-xs font-black px-4 py-2.5 rounded-xl shadow-sm">Pay</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase mb-3 flex items-center gap-1.5">
          <Repeat size={14} /> Recurring Bills
        </h3>
        {recurringExpenses.length === 0 ? (
          <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">No recurring bills set up yet.</div>
        ) : (
          <div className="space-y-2.5">
            {recurringExpenses.map((exp) => (
              <div key={exp.id} className="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between text-sm shadow-sm">
                <div className="flex items-center gap-2 text-stone-700 font-bold">
                  <span>{exp.title}</span>
                  <span className="text-[10px] font-black text-stone-400 bg-stone-50 px-2 py-0.5 rounded-md border">Day {exp.recurringDay ?? 1}</span>
                </div>
                <span className="font-black text-stone-800 text-base">£{exp.convertedAmountGBP.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
