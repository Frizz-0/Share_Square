import React from 'react';
import { X } from 'lucide-react';
import type { DirectDebt, Roommate } from '../../types';

// ── Confirm Payment (from the optimized-debts list) ──────────

interface SettleModalProps {
  settleTarget: DirectDebt;
  onConfirm: () => void;
  onClose: () => void;
}

export function SettleModal({ settleTarget, onConfirm, onClose }: SettleModalProps) {
  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-5 relative border-t border-stone-100 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
        <h3 className="text-center text-lg font-black text-stone-800">Confirm Payment</h3>
        <div className="bg-stone-50 rounded-2xl p-4 text-center border font-black text-xl text-emerald-800">£{settleTarget.amount.toFixed(2)} GBP</div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 bg-stone-100 text-stone-600 font-bold py-3.5 rounded-2xl text-sm">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex-1 bg-emerald-950 text-white font-black py-3.5 rounded-2xl text-sm">Clear Debt</button>
        </div>
      </div>
    </div>
  );
}

// ── Record a manual direct pay-back ───────────────────────────

interface CustomSettleModalProps {
  activeMembers: Roommate[];
  customSettlePayer: string;
  setCustomSettlePayer: (v: string) => void;
  customSettleReceiver: string;
  setCustomSettleReceiver: (v: string) => void;
  customSettleAmt: string;
  setCustomSettleAmt: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function CustomSettleModal({
  activeMembers, customSettlePayer, setCustomSettlePayer,
  customSettleReceiver, setCustomSettleReceiver,
  customSettleAmt, setCustomSettleAmt, onSubmit, onClose
}: CustomSettleModalProps) {
  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <form onSubmit={onSubmit} className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 relative border border-stone-100 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
        <h3 className="text-lg font-black text-stone-800">Record Direct Pay-Back</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Who Paid?</label>
            <select value={customSettlePayer} onChange={(e) => setCustomSettlePayer(e.target.value)} className="w-full bg-stone-50 border rounded-xl p-3.5 font-bold text-sm focus:outline-none">
              {activeMembers.map(m => <option key={m.clerkId} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Who Received?</label>
            <select value={customSettleReceiver} onChange={(e) => setCustomSettleReceiver(e.target.value)} className="w-full bg-stone-50 border rounded-xl p-3.5 font-bold text-sm focus:outline-none">
              {activeMembers.map(m => <option key={m.clerkId} value={m.name}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Amount Transferred (£)</label>
          <input type="number" step="0.01" placeholder="0.00" value={customSettleAmt} onChange={(e) => setCustomSettleAmt(e.target.value)} className="w-full bg-stone-50 border rounded-xl px-4 py-3.5 text-base font-black focus:outline-none" required />
        </div>
        <button type="submit" className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-md">Save Settlement Log</button>
      </form>
    </div>
  );
}
