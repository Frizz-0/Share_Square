import React, { useState } from 'react';
import { Trash2, Edit2, FileText, Paperclip, Receipt, X, Image as ImageIcon, Check } from 'lucide-react';
import type { Expense, CurrencyCode, SplitType, Roommate } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', INR: '₹', JPY: '¥'
};

interface LedgerDeckProps {
    expenses: Expense[];
    activeGroupId: string;
    activeInstanceId: string;
    activeMembers: Roommate[]; // Passed down to populate split selectors inside edit forms
    onDeleteExpense: (id: number) => void;
    onUpdateExpense: (updated: Expense) => void;
    fxRates: Record<string, number>;
}

export default function LedgerDeck({ expenses, activeGroupId, activeInstanceId, activeMembers, onDeleteExpense, onUpdateExpense, fxRates }: LedgerDeckProps) {
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    // Fully mirrored state tracking parameters matching the creation modal factory
    const [editForm, setEditForm] = useState({
        title: '',
        amount: '',
        currency: 'GBP' as CurrencyCode,
        paidBy: 'You',
        splitType: 'EQUAL' as SplitType,
        note: '',
        isRecurring: false,
        recurringDay: '1',
        customValues: {} as Record<string, string>
    });
    const [editAttachedFile, setEditAttachedFile] = useState<string>('');
    const [editSelectiveMembers, setEditSelectiveMembers] = useState<Record<string, boolean>>({});

    const scopedExpenses = expenses.filter(e => e.groupId === activeGroupId && e.instanceId === activeInstanceId);

    const groupIntoTimelineBundles = (items: Expense[]) => {
        const bundles: Record<string, Expense[]> = {};
        items.forEach(item => {
            const date = new Date(item.date);
            let label = date.toLocaleString('en-UK', { month: 'long', year: 'numeric' });
            const now = new Date();
            if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
                label = 'This Month';
            } else if (date.getMonth() === (now.getMonth() - 1 + 12) % 12 && date.getFullYear() === now.getFullYear()) {
                label = 'Last Month';
            }
            if (!bundles[label]) bundles[label] = [];
            bundles[label].push(item);
        });
        return bundles;
    };

    const getEditUnallocatedPoolAmount = (): number => {
        const totalInputBill = parseFloat(editForm.amount) || 0;
        const allocatedSum = activeMembers.reduce((sum, m) => sum + (parseFloat(editForm.customValues[m.name]) || 0), 0);
        return totalInputBill - allocatedSum;
    };

    const handleEditExactValueChange = (targetMemberName: string, value: string) => {
        const totalCost = parseFloat(editForm.amount) || 0;
        const updatedCustomValues = { ...editForm.customValues, [targetMemberName]: value };
        const configuredSum = Object.entries(updatedCustomValues)
            .filter(([name]) => name !== editForm.paidBy)
            .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);

        updatedCustomValues[editForm.paidBy] = Math.max(0, totalCost - configuredSum).toFixed(2);
        setEditForm({ ...editForm, customValues: updatedCustomValues });
    };

    const handleOpenEdit = (exp: Expense) => {
        setEditingExpense(exp);

        // Parse back normalized splits to native entry weights based on original currency factors
        const originalCurrencyValues: Record<string, string> = {};
        activeMembers.forEach(m => {
            const gbpShare = exp.splits[m.name] || 0;
            const nativeShare = gbpShare * (fxRates[exp.currency] || 1);
            originalCurrencyValues[m.name] = nativeShare > 0 ? nativeShare.toFixed(2) : '0.00';
        });

        setEditForm({
            title: exp.title,
            amount: exp.amount.toString(),
            currency: exp.currency,
            paidBy: exp.paidBy,
            splitType: exp.splitType,
            note: exp.note || '',
            isRecurring: !!exp.isRecurring,
            recurringDay: (exp.recurringDay || 1).toString(),
            customValues: originalCurrencyValues
        });
        setEditAttachedFile(exp.attachmentName || '');

        const selectiveState: Record<string, boolean> = {};
        activeMembers.forEach(m => { selectiveState[m.name] = (exp.splits[m.name] || 0) > 0 || m.name === exp.paidBy; });
        setEditSelectiveMembers(selectiveState);
    };

    const submitEditUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExpense) return;

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
            ...editingExpense,
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

        setEditingExpense(null);
    };

    const timelineBundles = groupIntoTimelineBundles(scopedExpenses);

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase flex items-center gap-1.5 px-1">
                <Receipt size={14} /> Living Expenses Timeline
            </h3>

            {scopedExpenses.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-stone-200 rounded-2xl bg-stone-50/30 text-xs text-stone-400">
                    Timeline is empty.
                </div>
            ) : (
                <div className="space-y-5">
                    {Object.entries(timelineBundles).map(([bundleLabel, groupItems]) => (
                        <div key={bundleLabel} className="space-y-2">
                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider bg-stone-100 px-2.5 py-1 rounded-md border inline-block w-fit">
                                {bundleLabel}
                            </span>

                            <div className="space-y-2">
                                {groupItems.map(exp => (
                                    <div key={exp.id} className={`p-4 rounded-2xl border flex flex-col gap-2 ${exp.isSettlement ? 'bg-stone-50/60 border-stone-200/80 shadow-inner' : 'bg-white border-stone-200/60 shadow-sm'}`}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold text-stone-800 text-base">{exp.title}</h4>
                                                <p className="text-xs text-stone-400 mt-0.5">Paid by <span className="font-semibold text-stone-600">{exp.paidBy}</span> • Native: {CURRENCY_SYMBOLS[exp.currency]}{exp.amount.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-stone-800 text-base">£{exp.convertedAmountGBP.toFixed(2)}</span>
                                                {!exp.isSettlement && (
                                                    <div className="flex items-center ml-1 bg-stone-50 border rounded-xl overflow-hidden shadow-sm">
                                                        <button type="button" onClick={() => handleOpenEdit(exp)} className="p-2 text-stone-500 hover:text-emerald-800 hover:bg-stone-100 transition-colors"><Edit2 size={13} /></button>
                                                        <button type="button" onClick={() => onDeleteExpense(exp.id)} className="p-2 text-stone-500 hover:text-rose-600 hover:bg-stone-100 transition-colors border-l"><Trash2 size={13} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {(exp.note || exp.attachmentName) && (
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {exp.note && (
                                                    <div className="flex items-center gap-1 text-[11px] text-stone-500 bg-stone-50 px-2 py-0.5 rounded-lg border w-fit">
                                                        <FileText size={10} /> <span className="italic">"{exp.note}"</span>
                                                    </div>
                                                )}
                                                {exp.attachmentName && (
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/40 w-fit">
                                                        <Paperclip size={10} /> {exp.attachmentName}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 🛠️ PARITY UPGRADE: Modify Transaction now features the exact options blueprint as creating a bill */}
            {editingExpense && (
                <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md flex items-end justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 max-h-[85vh] overflow-y-auto relative border shadow-2xl animate-slide-up">
                        <button type="button" onClick={() => setEditingExpense(null)} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
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
                                        {activeMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
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
                                        <div key={m.id} className="flex items-center gap-3 py-1">
                                            <input
                                                type="checkbox"
                                                id={`edit-select-${m.name}`}
                                                checked={editSelectiveMembers[m.name] !== false}
                                                onChange={(e) => setEditSelectiveMembers({ ...editSelectiveMembers, [m.name]: e.target.checked })}
                                                className="rounded text-emerald-700 h-4 w-4 focus:ring-0"
                                            />
                                            <label htmlFor={`edit-select-${m.name}`} className="text-sm font-bold text-stone-700 select-none cursor-pointer flex items-center gap-1.5">
                                                <span>{m.avatar}</span> <span>{m.name}</span>
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
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide">Adjust targets (Unassigned rolls to Payer)</p>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${getEditUnallocatedPoolAmount() === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-400'}`}>
                                            Remaining: {CURRENCY_SYMBOLS[editForm.currency]}{getEditUnallocatedPoolAmount().toFixed(2)}
                                        </span>
                                    </div>
                                    {activeMembers.map(m => (
                                        <div key={m.id} className="flex items-center justify-between gap-2 text-base">
                                            <span className="font-bold text-stone-700">{m.name}</span>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">{CURRENCY_SYMBOLS[editForm.currency]}</span>
                                                <input type="number" step="0.01" placeholder="0.00" disabled={m.name === editForm.paidBy} value={editForm.customValues[m.name] || ''} onChange={(e) => handleEditExactValueChange(m.name, e.target.value)} className={`w-28 border rounded-xl py-2 pl-6 pr-3 text-right font-black text-sm ${m.name === editForm.paidBy ? 'bg-stone-100 text-stone-400' : 'bg-white text-stone-800'}`} required />
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
                    </div>
                </div>
            )}
        </div>
    );
}