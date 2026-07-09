import React, { useState } from 'react';
import { Trash2, Receipt, X, Image as ImageIcon, Check, ChevronDown, ChevronRight, Edit2, FileText, Paperclip } from 'lucide-react';
import type { Expense, CurrencyCode, SplitType, Roommate } from '../types';
import ConfirmDialog from './ConfirmDialog';

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

interface LedgerDeckProps {
    expenses: Expense[];
    activeGroupId: string;
    activeInstanceId: string;
    activeMembers: Roommate[]; // Passed down to populate split selectors inside edit forms
    currentUserName: string;
    onDeleteExpense: (id: number) => void;
    onUpdateExpense: (updated: Expense) => void;
    fxRates: Record<string, number>;
}

export default function LedgerDeck({ expenses, activeGroupId, activeInstanceId, activeMembers, currentUserName, onDeleteExpense, onUpdateExpense, fxRates }: LedgerDeckProps) {
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);

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
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [expandedBundles, setExpandedBundles] = useState<Record<string, boolean>>({ 'This Month': true });

    const scopedExpenses = [...expenses]
        .filter(e => e.groupId === activeGroupId && e.instanceId === activeInstanceId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

    const toggleBundle = (label: string) => {
        setExpandedBundles(prev => ({ ...prev, [label]: !(prev[label] ?? false) }));
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
                    {Object.entries(timelineBundles).map(([bundleLabel, groupItems]) => {
                        const isExpanded = expandedBundles[bundleLabel] ?? false;
                        return (
                            <div key={bundleLabel} className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => toggleBundle(bundleLabel)}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-stone-500 uppercase tracking-wider bg-stone-100 px-2.5 py-1 rounded-md border w-fit"
                                >
                                    {bundleLabel}
                                    <span className="text-stone-400">({groupItems.length})</span>
                                    <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                {isExpanded && (
                                    <div className="space-y-1">
                                        {groupItems.map(exp => {
                                            const { icon, text } = splitLeadingIcon(exp.title);
                                            const d = new Date(exp.date);
                                            const selfShare = exp.splits?.[currentUserName] || 0;
                                            const iPaid = exp.paidBy === currentUserName;
                                            const netForMe = iPaid ? (exp.convertedAmountGBP || exp.amount || 0) - selfShare : -selfShare;
                                            const isInvolved = iPaid || selfShare > 0.01;

                                            return (
                                                <button
                                                    key={exp.id}
                                                    type="button"
                                                    onClick={() => setViewingExpense(exp)}
                                                    className={`w-full p-3 rounded-2xl border flex items-center gap-3 text-left transition-colors ${exp.isSettlement ? 'bg-stone-50/60 border-stone-200/80' : 'bg-white border-stone-200/60 hover:bg-stone-50/60'}`}
                                                >
                                                    <div className="flex flex-col items-center justify-center w-7 shrink-0 text-stone-400">
                                                        <span className="text-[9px] font-black uppercase">{d.toLocaleDateString([], { month: 'short' })}</span>
                                                        <span className="text-lg font-black text-stone-700 leading-none">{d.getDate()}</span>
                                                    </div>

                                                    <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center text-base shrink-0">{icon}</div>

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-stone-800 text-sm truncate">{text}</h4>
                                                        <p className="text-xs text-stone-400 truncate">
                                                            {iPaid ? 'You' : exp.paidBy} paid {CURRENCY_SYMBOLS[exp.currency]}{(exp.amount || 0).toFixed(2)}
                                                        </p>
                                                    </div>

                                                    {!exp.isSettlement && isInvolved && (
                                                        <div className="text-right shrink-0">
                                                            <p className={`text-[10px] font-black uppercase ${netForMe >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                {netForMe >= 0 ? 'you lent' : 'you owe'}
                                                            </p>
                                                            <p className={`text-sm font-black ${netForMe >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                £{Math.abs(netForMe).toFixed(2)}
                                                            </p>
                                                        </div>
                                                    )}

                                                    <ChevronRight size={16} className="text-stone-300 shrink-0" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {pendingDeleteId !== null && (
                <ConfirmDialog
                    title="Delete this expense?"
                    message="This will permanently remove the expense for everyone in the group."
                    onConfirm={() => { onDeleteExpense(pendingDeleteId); setPendingDeleteId(null); }}
                    onCancel={() => setPendingDeleteId(null)}
                />
            )}

            {viewingExpense && (() => {
                const { icon, text } = splitLeadingIcon(viewingExpense.title);
                const shares = Object.entries(viewingExpense.splits || {}).filter(([, share]) => share > 0.01);
                return (
                    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md flex items-end justify-center z-50 p-4">
                        <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden max-h-[85vh] flex flex-col relative border shadow-2xl animate-slide-up">
                            <div className="bg-emerald-900 text-white p-5 flex items-center justify-between shrink-0">
                                <button type="button" onClick={() => setViewingExpense(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={18} /></button>
                                <h3 className="font-black text-base">Details</h3>
                                <div className="flex items-center gap-1">
                                    {!viewingExpense.isSettlement && (
                                        <button type="button" onClick={() => { handleOpenEdit(viewingExpense); setViewingExpense(null); }} className="p-2 hover:bg-white/10 rounded-full"><Edit2 size={16} /></button>
                                    )}
                                    <button type="button" onClick={() => { setPendingDeleteId(viewingExpense.id); setViewingExpense(null); }} className="p-2 hover:bg-white/10 rounded-full"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <div className="p-6 space-y-5 overflow-y-auto">
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-stone-50 border flex items-center justify-center text-xl shrink-0">{icon}</div>
                                    <div>
                                        <h4 className="text-lg font-black text-stone-800 leading-tight">{text}</h4>
                                        <p className="text-2xl font-black text-stone-900 mt-0.5">{CURRENCY_SYMBOLS[viewingExpense.currency]}{viewingExpense.amount.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="text-xs text-stone-400 space-y-0.5">
                                    <p>Logged on {new Date(viewingExpense.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                    {viewingExpense.isRecurring && <p className="font-bold text-emerald-700">Recurring on day {viewingExpense.recurringDay ?? 1} of each month</p>}
                                </div>

                                {(viewingExpense.note || viewingExpense.attachmentName) && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {viewingExpense.note && (
                                            <div className="flex items-center gap-1 text-[11px] text-stone-500 bg-stone-50 px-2 py-1 rounded-lg border w-fit">
                                                <FileText size={11} /> <span className="italic">"{viewingExpense.note}"</span>
                                            </div>
                                        )}
                                        {viewingExpense.attachmentName && (
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/40 w-fit">
                                                <Paperclip size={11} /> {viewingExpense.attachmentName}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!viewingExpense.isSettlement && (
                                    <div className="border-t border-stone-100 pt-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                                                {viewingExpense.paidBy.slice(0, 2).toUpperCase()}
                                            </div>
                                            <p className="text-sm font-bold text-stone-700">
                                                {viewingExpense.paidBy === currentUserName ? 'You' : viewingExpense.paidBy} paid {CURRENCY_SYMBOLS[viewingExpense.currency]}{viewingExpense.amount.toFixed(2)}
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
            })()}

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
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide">Adjust targets (Unassigned rolls to Payer)</p>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${getEditUnallocatedPoolAmount() === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-400'}`}>
                                            Remaining: {CURRENCY_SYMBOLS[editForm.currency]}{(getEditUnallocatedPoolAmount() || 0).toFixed(2)}
                                        </span>
                                    </div>
                                    {activeMembers.map(m => (
                                        <div key={m.clerkId} className="flex items-center justify-between gap-2 text-base">
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

                        <button
                            type="button"
                            onClick={() => { setPendingDeleteId(editingExpense.id); setEditingExpense(null); }}
                            className="w-full font-bold py-3 rounded-2xl text-sm text-rose-600 bg-rose-50 border border-rose-100 flex items-center justify-center gap-1.5"
                        >
                            <Trash2 size={14} /> Delete Expense
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}