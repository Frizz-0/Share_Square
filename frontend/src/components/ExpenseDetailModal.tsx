import React, { useState } from 'react';
import { Trash2, X, Image as ImageIcon, Check, Edit2, FileText, Paperclip } from 'lucide-react';
import type { Expense, CurrencyCode, SplitType, Roommate } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { recomputeExactSplit } from '../utils/finance';

const CURRENCY_SYMBOLS: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', INR: '₹', JPY: '¥'
};

const DOT_COLORS = ['bg-emerald-500', 'bg-orange-500', 'bg-sky-500', 'bg-rose-500', 'bg-purple-500', 'bg-amber-500', 'bg-teal-500', 'bg-fuchsia-500'];

// Splits a title like "🍕 Pizza Night" into its leading icon and the rest of the text
function splitLeadingIcon(title: string): { icon: string; text: string } {
    const match = title.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*(.*)$/u);
    if (match) return { icon: match[1], text: match[2] || title };
    return { icon: '💸', text: title };
}

interface Props {
    expense: Expense;
    activeMembers: Roommate[];
    currentUserName: string;
    fxRates: Record<string, number>;
    onClose: () => void;
    onUpdateExpense: (updated: Expense) => void;
    onDeleteExpense: (id: number) => void;
}

export default function ExpenseDetailModal({ expense, activeMembers, currentUserName, fxRates, onClose, onUpdateExpense, onDeleteExpense }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(false);

    const [editForm, setEditForm] = useState(() => {
        const rate = fxRates[expense.currency] || 1;
        const originalCurrencyValues: Record<string, string> = {};
        activeMembers.forEach(m => {
            const gbpShare = expense.splits[m.name] || 0;
            const nativeShare = gbpShare * rate;
            originalCurrencyValues[m.name] = nativeShare > 0 ? nativeShare.toFixed(2) : '0.00';
        });
        return {
            title: expense.title,
            amount: expense.amount.toString(),
            currency: expense.currency,
            paidBy: expense.paidBy,
            splitType: expense.splitType,
            note: expense.note || '',
            isRecurring: !!expense.isRecurring,
            recurringDay: (expense.recurringDay || 1).toString(),
            customValues: originalCurrencyValues
        };
    });
    const [editAttachedFile, setEditAttachedFile] = useState<string>(expense.attachmentName || '');
    const [editSelectiveMembers, setEditSelectiveMembers] = useState<Record<string, boolean>>(() => {
        const state: Record<string, boolean> = {};
        activeMembers.forEach(m => { state[m.name] = (expense.splits[m.name] || 0) > 0 || m.name === expense.paidBy; });
        return state;
    });
    // Tracks which members' exact-split amounts the user has manually edited this
    // session; untouched members auto-rebalance around whatever's left, Splitwise-style.
    const [touchedMembers, setTouchedMembers] = useState<Record<string, boolean>>({});

    const getEditUnallocatedPoolAmount = (): number => {
        const totalInputBill = parseFloat(editForm.amount) || 0;
        const allocatedSum = activeMembers.reduce((sum, m) => sum + (parseFloat(editForm.customValues[m.name]) || 0), 0);
        return totalInputBill - allocatedSum;
    };

    const handleEditExactValueChange = (targetMemberName: string, value: string) => {
        const nextTouched = { ...touchedMembers, [targetMemberName]: true };
        setTouchedMembers(nextTouched);
        const total = parseFloat(editForm.amount) || 0;
        const rebalanced = recomputeExactSplit(total, activeMembers, nextTouched, { ...editForm.customValues, [targetMemberName]: value });
        setEditForm({ ...editForm, customValues: rebalanced });
    };

    const handleResetSplit = () => {
        setTouchedMembers({});
        const total = parseFloat(editForm.amount) || 0;
        const rebalanced = recomputeExactSplit(total, activeMembers, {}, {});
        setEditForm({ ...editForm, customValues: rebalanced });
    };

    const submitEditUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        const rawAmt = parseFloat(editForm.amount);
        if (isNaN(rawAmt) || rawAmt <= 0) return;

        const rate = fxRates[editForm.currency] || 1;
        const amountInGBP = rawAmt / rate;
        const computedSplitsGBP: Record<string, number> = {};

        if (editForm.splitType === 'EQUAL') {
            const perPersonShareGBP = amountInGBP / activeMembers.length;
            activeMembers.forEach(m => { computedSplitsGBP[m.name] = perPersonShareGBP; });
        } else if (editForm.splitType === 'SELECTIVE') {
            const selectedList = activeMembers.filter(m => editSelectiveMembers[m.name] !== false);
            const denominator = selectedList.length > 0 ? selectedList.length : 1;
            const perPersonShareGBP = amountInGBP / denominator;
            activeMembers.forEach(m => {
                computedSplitsGBP[m.name] = editSelectiveMembers[m.name] !== false ? perPersonShareGBP : 0;
            });
        } else {
            activeMembers.forEach(m => {
                const rawShare = parseFloat(editForm.customValues[m.name]) || 0;
                computedSplitsGBP[m.name] = rawShare / rate;
            });
        }

        onUpdateExpense({
            ...expense,
            title: editForm.title.trim(),
            paidBy: editForm.paidBy,
            amount: rawAmt,
            currency: editForm.currency,
            convertedAmountGBP: amountInGBP,
            note: editForm.note.trim() || undefined,
            splitType: editForm.splitType,
            splits: computedSplitsGBP,
            isRecurring: editForm.isRecurring,
            recurringDay: editForm.isRecurring ? parseInt(editForm.recurringDay) : undefined,
            attachmentName: editAttachedFile || undefined
        });

        onClose();
    };

    if (pendingDelete) {
        return (
            <ConfirmDialog
                title="Delete this expense?"
                message="This will permanently remove the expense for everyone in the group."
                onConfirm={() => { onDeleteExpense(expense.id); onClose(); }}
                onCancel={() => setPendingDelete(false)}
            />
        );
    }

    if (isEditing) {
        return (
            <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md flex items-end justify-center z-50 p-4">
                <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 max-h-[85vh] overflow-y-auto relative border shadow-2xl animate-slide-up">
                    <button type="button" onClick={onClose} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
                    <h3 className="text-xl font-black text-stone-800 tracking-tight">Modify Expense</h3>

                    <form onSubmit={submitEditUpdate} className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Title</label>
                                <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-semibold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Currency</label>
                                <select value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value as CurrencyCode, customValues: {} })} className="w-full bg-stone-50 border rounded-2xl px-2 py-3.5 text-base font-bold focus:outline-none">
                                    <option value="GBP">GBP (£)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="INR">INR (₹)</option><option value="JPY">JPY (¥)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Paid By</label>
                                <select value={editForm.paidBy} onChange={(e) => setEditForm({ ...editForm, paidBy: e.target.value, customValues: {} })} className="w-full bg-stone-50 border rounded-2xl p-3.5 font-bold text-sm focus:outline-none">
                                    {activeMembers.map(m => <option key={m.clerkId} value={m.name}>{m.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Split Method</label>
                                <select value={editForm.splitType} onChange={(e) => setEditForm({ ...editForm, splitType: e.target.value as SplitType, customValues: {} })} className="w-full bg-stone-50 border rounded-2xl px-2 py-3.5 text-base font-bold focus:outline-none">
                                    <option value="EQUAL">Equally</option><option value="EXACT">Exact Values Assistant</option><option value="SELECTIVE">Selective (Split Between Some)</option>
                                </select>
                            </div>
                        </div>

                        {editForm.splitType === 'SELECTIVE' && (
                            <div className="p-4 bg-stone-50 rounded-2xl space-y-2.5 border border-stone-100">
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide mb-1">Select who is included in this bill:</p>
                                {activeMembers.map(m => (
                                    <div key={m.clerkId} className="flex items-center gap-3 py-1">
                                        <input
                                            type="checkbox"
                                            id={`edit-select-${m.name}`}
                                            checked={editSelectiveMembers[m.name] !== false}
                                            onChange={(e) => setEditSelectiveMembers({ ...editSelectiveMembers, [m.name]: e.target.checked })}
                                            className="rounded text-emerald-700 h-4 w-4 focus:ring-0"
                                        />
                                        <label htmlFor={`edit-select-${m.name}`} className="text-sm font-bold text-stone-700 select-none cursor-pointer">
                                            {m.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Amount</label>
                            <input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value, customValues: {} })} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-black focus:outline-none" required />
                        </div>

                        {editForm.splitType === 'EXACT' && (
                            <div className="p-4 bg-stone-50 rounded-2xl space-y-3 border border-stone-100">
                                <div className="flex justify-between items-center mb-1 gap-2">
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide">Adjust anyone's share</p>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button type="button" onClick={handleResetSplit} className="text-[10px] font-bold text-stone-500 underline underline-offset-2">Reset</button>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${getEditUnallocatedPoolAmount() === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-400'}`}>
                                            Remaining: {CURRENCY_SYMBOLS[editForm.currency]}{(getEditUnallocatedPoolAmount() || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                                {activeMembers.map(m => (
                                    <div key={m.clerkId} className="flex items-center justify-between gap-2 text-base">
                                        <span className="font-bold text-stone-700">{m.name}</span>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">{CURRENCY_SYMBOLS[editForm.currency]}</span>
                                            <input type="number" step="0.01" placeholder="0.00" value={editForm.customValues[m.name] || ''} onChange={(e) => handleEditExactValueChange(m.name, e.target.value)} className="w-28 border rounded-xl py-2 pl-6 pr-3 text-right font-black text-sm bg-white text-stone-800" required />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="block text-[11px] font-black text-stone-400 uppercase">Change Proof Attachment</label>
                            <div className="relative flex items-center justify-center border-2 border-dashed border-stone-200 bg-stone-50 hover:bg-stone-100 rounded-2xl py-4 cursor-pointer">
                                <input type="file" accept="image/*" onChange={(e) => setEditAttachedFile(e.target.files?.[0]?.name || '')} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
                                <div className="flex items-center gap-1.5 text-xs font-black text-stone-600">
                                    <ImageIcon size={16} className="text-stone-400" />
                                    <span>{editAttachedFile ? `Attached: ${editAttachedFile}` : 'Swap receipt photo'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 space-y-3">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="edit-recurring" checked={editForm.isRecurring} onChange={(e) => setEditForm({ ...editForm, isRecurring: e.target.checked })} className="rounded text-emerald-700 h-4 w-4" />
                                <label htmlFor="edit-recurring" className="text-sm font-bold text-stone-700 select-none">Set as monthly recurring bill</label>
                            </div>
                            {editForm.isRecurring && (
                                <div className="flex items-center justify-between gap-3 pt-1 border-t border-stone-200/60">
                                    <label className="text-xs font-medium text-stone-500">Deduction day:</label>
                                    <input type="number" min="1" max="31" value={editForm.recurringDay} onChange={(e) => setEditForm({ ...editForm, recurringDay: e.target.value })} className="w-16 bg-white border rounded-lg px-2 py-1 text-sm font-bold text-center" />
                                </div>
                            )}
                        </div>

                        <button type="submit" disabled={editForm.splitType === 'EXACT' && getEditUnallocatedPoolAmount() !== 0} className={`w-full font-black py-4 rounded-2xl text-base shadow-md transition-all ${editForm.splitType === 'EXACT' && getEditUnallocatedPoolAmount() !== 0 ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none' : 'bg-emerald-950 text-white'}`}><Check size={16} strokeWidth={3} className="inline mr-1" /> Update and Sync</button>
                    </form>

                    <button
                        type="button"
                        onClick={() => setPendingDelete(true)}
                        className="w-full font-bold py-3 rounded-2xl text-sm text-rose-600 bg-rose-50 border border-rose-100 flex items-center justify-center gap-1.5"
                    >
                        <Trash2 size={14} /> Delete Expense
                    </button>
                </div>
            </div>
        );
    }

    const { icon, text } = splitLeadingIcon(expense.title);
    const shares = Object.entries(expense.splits || {}).filter(([, share]) => share > 0.01);

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md flex items-end justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden max-h-[85vh] flex flex-col relative border shadow-2xl animate-slide-up">
                <div className="bg-emerald-900 text-white p-5 flex items-center justify-between shrink-0">
                    <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={18} /></button>
                    <h3 className="font-black text-base">Details</h3>
                    <div className="flex items-center gap-1">
                        {!expense.isSettlement && (
                            <button type="button" onClick={() => setIsEditing(true)} className="p-2 hover:bg-white/10 rounded-full"><Edit2 size={16} /></button>
                        )}
                        <button type="button" onClick={() => setPendingDelete(true)} className="p-2 hover:bg-white/10 rounded-full"><Trash2 size={16} /></button>
                    </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-stone-50  flex items-center justify-center text-xl shrink-0">{icon}</div>
                        <div>
                            <h4 className="text-lg font-black text-stone-800 leading-tight">{text}</h4>
                            <p className="text-2xl font-black text-stone-900 mt-0.5">{CURRENCY_SYMBOLS[expense.currency]}{expense.amount.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="text-xs text-stone-400 space-y-0.5">
                        <p>Logged on {new Date(expense.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        {expense.isRecurring && <p className="font-bold text-emerald-700">Recurring on day {expense.recurringDay ?? 1} of each month</p>}
                    </div>

                    {(expense.note || expense.attachmentName) && (
                        <div className="flex flex-wrap gap-1.5">
                            {expense.note && (
                                <div className="flex items-center gap-1 text-[11px] text-stone-500 bg-stone-50 px-2 py-1 rounded-lg border w-fit">
                                    <FileText size={11} /> <span className="italic">"{expense.note}"</span>
                                </div>
                            )}
                            {expense.attachmentName && (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/40 w-fit">
                                    <Paperclip size={11} /> {expense.attachmentName}
                                </div>
                            )}
                        </div>
                    )}

                    {!expense.isSettlement && (
                        <div className="border-t border-stone-100 pt-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                                    {expense.paidBy.slice(0, 2).toUpperCase()}
                                </div>
                                <p className="text-sm font-bold text-stone-700">
                                    {expense.paidBy === currentUserName ? 'You' : expense.paidBy} paid {CURRENCY_SYMBOLS[expense.currency]}{expense.amount.toFixed(2)}
                                </p>
                            </div>

                            <div className="ml-4 mt-2 pl-4 border-l-2 border-stone-100 space-y-2.5">
                                {shares.map(([name, share], idx) => (
                                    <div key={name} className="flex items-center gap-2.5">
                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_COLORS[idx % DOT_COLORS.length]}`} />
                                        <p className="text-sm text-stone-600">
                                            <span className="font-bold text-stone-800">{name === currentUserName ? 'You' : name}</span> {name === currentUserName ? 'owe' : 'owes'} £{share.toFixed(2)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
