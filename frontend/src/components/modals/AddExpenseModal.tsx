import React from 'react';
import { X, Paperclip, Check } from 'lucide-react';
import type { CurrencyCode, Roommate, SplitType } from '../../types';
import { CURRENCY_SYMBOLS, QUICK_ACTIONS_PRESETS } from '../../constants';
import { getUnallocatedPoolAmount } from '../../utils/finance';

export interface NewExpenseForm {
  title: string;
  amount: string;
  currency: CurrencyCode;
  paidBy: string;
  note: string;
  splitType: SplitType;
  isRecurring: boolean;
  recurringDay: string;
  customValues: Record<string, string>;
  icon: string;
}

interface Props {
  activeMembers: Roommate[];
  newExpense: NewExpenseForm;
  setNewExpense: (v: NewExpenseForm) => void;
  selectiveMembers: Record<string, boolean>;
  setSelectiveMembers: (v: Record<string, boolean>) => void;
  modalAttachedFile: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExactValueChange: (name: string, value: string) => void;
  convertToGBP: (amount: number, currency: CurrencyCode) => number;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export default function AddExpenseModal({
  activeMembers, newExpense, setNewExpense, selectiveMembers, setSelectiveMembers,
  modalAttachedFile, onFileChange, onExactValueChange, convertToGBP, onSubmit, onClose
}: Props) {
  const unallocated = getUnallocatedPoolAmount(newExpense.amount, newExpense.customValues, activeMembers);

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 max-h-[85vh] overflow-y-auto relative border border-stone-100 shadow-2xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-xl font-black text-stone-800">Add New Expense</h3>
          <button type="button" onClick={onClose} className="p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">⚡ Select Category Style</label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_ACTIONS_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setNewExpense({ ...newExpense, title: preset.title, icon: preset.icon })}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-[0.97] whitespace-nowrap shadow-sm ${newExpense.icon === preset.icon
                  ? 'bg-emerald-950 text-white border-emerald-950'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Title</label>
              <input type="text" placeholder="Groceries, Rent" value={newExpense.title} onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-semibold focus:outline-none" required />
            </div>
            <div>
              <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Currency</label>
              <select value={newExpense.currency} onChange={(e) => setNewExpense({ ...newExpense, currency: e.target.value as CurrencyCode })} className="w-full bg-stone-50 border rounded-2xl px-2 py-3.5 text-base font-bold focus:outline-none">
                <option value="GBP">GBP (£)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="INR">INR (₹)</option><option value="JPY">JPY (¥)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Paid By</label>
              <select value={newExpense.paidBy} onChange={(e) => setNewExpense({ ...newExpense, paidBy: e.target.value, customValues: {} })} className="w-full bg-stone-50 border rounded-2xl p-3.5 font-bold text-sm focus:outline-none">
                {activeMembers.map(m => <option key={m.clerkId} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Split Method</label>
              <select value={newExpense.splitType} onChange={(e) => setNewExpense({ ...newExpense, splitType: e.target.value as SplitType, customValues: {} })} className="w-full bg-stone-50 border rounded-2xl px-2 py-3.5 text-base font-bold focus:outline-none">
                <option value="EQUAL">Equally</option><option value="EXACT">Exact Values Assistant</option><option value="SELECTIVE">Unequally</option>
              </select>
            </div>
            {newExpense.splitType === 'SELECTIVE' && (
              <div className="p-4 bg-stone-50 rounded-2xl space-y-2.5 border border-stone-100">
                {activeMembers.map(m => (
                  <div key={m.clerkId} className="flex items-center gap-3 py-1">
                    <input
                      type="checkbox"
                      id={`select-${m.name}`}
                      checked={selectiveMembers[m.name] !== false}
                      onChange={(e) => setSelectiveMembers({ ...selectiveMembers, [m.name]: e.target.checked })}
                      className="rounded text-emerald-700 h-4 w-4 focus:ring-0"
                    />
                    <label htmlFor={`select-${m.name}`} className="text-sm font-bold text-stone-700 select-none cursor-pointer flex items-center gap-1.5">
                      <span>{m.avatar}</span> <span>{m.name}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Amount</label>
            <input type="number" step="0.01" placeholder="0.00" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value, customValues: {} })} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-black focus:outline-none" required />
          </div>

          {newExpense.splitType === 'EXACT' && (
            <div className="p-4 bg-stone-50 rounded-2xl space-y-3 border border-stone-100">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide">Assign targets</p>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${unallocated === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  Remaining: {CURRENCY_SYMBOLS[newExpense.currency]}{unallocated.toFixed(2)}
                </span>
              </div>
              {activeMembers.map(m => (
                <div key={m.clerkId} className="flex items-center justify-between gap-2 text-base">
                  <span className="font-bold text-stone-700">{m.name}</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">{CURRENCY_SYMBOLS[newExpense.currency]}</span>
                    <input type="number" step="0.01" placeholder="0.00" disabled={m.name === newExpense.paidBy} value={newExpense.customValues[m.name] || ''} onChange={(e) => onExactValueChange(m.name, e.target.value)} className={`w-28 border rounded-xl py-2 pl-6 pr-3 text-right font-black text-sm ${m.name === newExpense.paidBy ? 'bg-stone-100 text-stone-400' : 'bg-white text-stone-800'}`} required />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] font-black text-stone-400 uppercase">Proof Image Attachment</label>
            <div className="relative flex items-center justify-center border-2 border-dashed border-stone-200 bg-stone-50 hover:bg-stone-100 rounded-2xl py-4 transition-colors cursor-pointer">
              <input type="file" accept="image/*" onChange={onFileChange} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
              <div className="flex items-center gap-1.5 text-xs font-black text-stone-600">
                <Paperclip size={16} className="text-stone-400" />
                <span>{modalAttachedFile ? `Attached: ${modalAttachedFile}` : 'Upload receipt photo'}</span>
              </div>
            </div>
          </div>

          <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 space-y-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recurring" checked={newExpense.isRecurring} onChange={(e) => setNewExpense({ ...newExpense, isRecurring: e.target.checked })} className="rounded text-emerald-700 h-4 w-4" />
              <label htmlFor="recurring" className="text-sm font-bold text-stone-700 select-none">Set as monthly recurring bill</label>
            </div>
            {newExpense.isRecurring && (
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-stone-200/60">
                <label className="text-xs font-medium text-stone-500">Deduction day:</label>
                <input type="number" min="1" max="31" value={newExpense.recurringDay} onChange={(e) => setNewExpense({ ...newExpense, recurringDay: e.target.value })} className="w-16 bg-white border rounded-lg px-2 py-1 text-sm font-bold text-center" />
              </div>
            )}
          </div>

          <div className="p-3 bg-emerald-50 text-center text-xs text-emerald-950 font-bold rounded-2xl border border-emerald-100/40">Normalized Baseline Value: ~£{newExpense.amount ? convertToGBP(parseFloat(newExpense.amount), newExpense.currency).toFixed(2) : '0.00'} GBP</div>
          <button type="submit" disabled={newExpense.splitType === 'EXACT' && unallocated !== 0} className={`w-full font-black py-4 rounded-2xl text-base shadow-md transition-all ${newExpense.splitType === 'EXACT' && unallocated !== 0 ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none' : 'bg-emerald-950 text-white'}`}><Check size={16} strokeWidth={3} className="inline mr-1" /> Commit & Divide</button>
        </form>
      </div>
    </div>
  );
}
