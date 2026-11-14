import React, { useEffect, useRef, useState } from 'react';
import { Trash2, X, Check, Edit2, FileText, ShoppingBag, Plus, Camera, Sparkles, Loader2, ChevronUp } from 'lucide-react';
import type { Expense, ExpenseItem, CurrencyCode, SplitType, Roommate } from '../types';
import { QUICK_ACTIONS_PRESETS } from '../constants';
import ConfirmDialog from './ConfirmDialog';
import { recomputeExactSplit } from '../utils/finance';
import { scanVideoFrameWithGroq } from '../utils/receiptScanner';

const CURRENCY_SYMBOLS: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', INR: '₹', JPY: '¥'
};

const DOT_COLORS = ['bg-emerald-500', 'bg-orange-500', 'bg-sky-500', 'bg-rose-500', 'bg-purple-500', 'bg-amber-500', 'bg-teal-500', 'bg-fuchsia-500'];

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
        const parsed = splitLeadingIcon(expense.title);
        return {
            icon: parsed.icon,
            title: parsed.text,
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

    const [editItems, setEditItems] = useState<ExpenseItem[]>(() => expense.items ? [...expense.items] : []);
    const [showItemsSection, setShowItemsSection] = useState<boolean>(() => (expense.items?.length || 0) > 0);
    const [newItemDraft, setNewItemDraft] = useState({ name: '', qty: '1', price: '' });

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [editSelectiveMembers, setEditSelectiveMembers] = useState<Record<string, boolean>>(() => {
        const state: Record<string, boolean> = {};
        activeMembers.forEach(m => { state[m.name] = (expense.splits[m.name] || 0) > 0 || m.name === expense.paidBy; });
        return state;
    });
    const [touchedMembers, setTouchedMembers] = useState<Record<string, boolean>>({});

    const stopCameraStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    useEffect(() => {
        return () => stopCameraStream();
    }, []);

    const handleOpenCamera = async () => {
        setScanError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 1920 }
                },
                audio: false
            });
            streamRef.current = stream;
            setIsCameraOpen(true);

            requestAnimationFrame(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => { });
                }
            });
        } catch (err) {
            console.error('Camera access error:', err);
            setScanError('Camera access denied or unavailable on this browser.');
        }
    };

    const handleCaptureAndScan = async () => {
        if (!videoRef.current) return;
        setIsScanning(true);
        setScanError(null);

        try {
            const scanned = await scanVideoFrameWithGroq(videoRef.current);
            stopCameraStream();

            const hasScannedItems = scanned.items.length > 0;
            if (hasScannedItems) {
                setEditItems(scanned.items);
                setShowItemsSection(true);
            }

            setEditForm(prev => ({
                ...prev,
                title: scanned.title || prev.title,
                amount: scanned.amount > 0 ? scanned.amount.toFixed(2) : prev.amount,
                currency: scanned.currency || prev.currency,
                note: scanned.note || prev.note,
                icon: hasScannedItems ? '🛒' : prev.icon,
                customValues: {}
            }));
        } catch (err: any) {
            console.error('Receipt scan error:', err);
            stopCameraStream();
            setScanError(err?.message || 'Could not read receipt — please edit details manually.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleAddItemRow = () => {
        if (!newItemDraft.name.trim()) return;
        const parsedQty = parseInt(newItemDraft.qty) || 1;
        const parsedPrice = parseFloat(newItemDraft.price);

        const nextItem: ExpenseItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: newItemDraft.name.trim(),
            qty: parsedQty > 1 ? parsedQty : undefined,
            price: !isNaN(parsedPrice) && parsedPrice >= 0 ? parsedPrice : undefined
        };

        setEditItems(prev => [...prev, nextItem]);
        setNewItemDraft({ name: '', qty: '1', price: '' });
    };

    const handleRemoveItemRow = (id: string) => {
        setEditItems(prev => prev.filter(item => item.id !== id));
    };

    const handleUpdateItemField = (id: string, field: 'name' | 'qty' | 'price', rawValue: string) => {
        setEditItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            if (field === 'name') return { ...item, name: rawValue };
            if (field === 'qty') {
                const q = parseInt(rawValue);
                return { ...item, qty: !isNaN(q) && q > 1 ? q : undefined };
            }
            const p = parseFloat(rawValue);
            return { ...item, price: !isNaN(p) && p >= 0 ? p : undefined };
        }));
    };

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

        const cleanedItems = editItems
            .map(it => ({ ...it, name: it.name.trim() }))
            .filter(it => it.name.length > 0);

        const cleanTextTitle = editForm.title.trim();
        const finalTitle = editForm.icon ? `${editForm.icon} ${cleanTextTitle}` : cleanTextTitle;

        onUpdateExpense({
            ...expense,
            title: finalTitle,
            paidBy: editForm.paidBy,
            amount: rawAmt,
            currency: editForm.currency,
            convertedAmountGBP: amountInGBP,
            note: editForm.note.trim() || undefined,
            items: cleanedItems.length > 0 ? cleanedItems : undefined,
            splitType: editForm.splitType,
            splits: computedSplitsGBP,
            isRecurring: editForm.isRecurring,
            recurringDay: editForm.isRecurring ? parseInt(editForm.recurringDay) : undefined
        });

        stopCameraStream();
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
            <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
                <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 max-h-[88dvh] overflow-y-auto overscroll-contain touch-pan-y relative border shadow-2xl animate-slide-up">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-xl font-black text-stone-800 tracking-tight">Modify Expense</h3>
                        <button
                            type="button"
                            onClick={() => { stopCameraStream(); onClose(); }}
                            className="p-2 bg-stone-50 rounded-full text-stone-400"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* In-App Live Receipt Scanner */}
                    {!isCameraOpen ? (
                        <button
                            type="button"
                            onClick={handleOpenCamera}
                            disabled={isScanning}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 hover:bg-emerald-50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-950 text-white flex items-center justify-center shrink-0">
                                    {isScanning ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-emerald-950">
                                        {isScanning ? 'Extracting receipt items...' : 'Re-Scan Receipt with Camera'}
                                    </p>
                                    <p className="text-[10px] font-medium text-emerald-800/80">
                                        Auto-updates total, summary & items
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white text-emerald-900 border border-emerald-200/60 shrink-0 flex items-center gap-1">
                                <Sparkles size={10} /> Scan
                            </span>
                        </button>
                    ) : (
                        <div className="relative rounded-2xl overflow-hidden bg-stone-950 border border-stone-200 shadow-inner">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-64 object-cover"
                            />
                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={stopCameraStream}
                                    disabled={isScanning}
                                    className="px-3.5 py-2 rounded-xl bg-white/20 backdrop-blur-md text-white text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCaptureAndScan}
                                    disabled={isScanning}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg"
                                >
                                    {isScanning ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" /> Scanning Receipt...
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={14} /> Capture & Extract
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {scanError && (
                        <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                            {scanError}
                        </p>
                    )}

                    {/* Quick Icon Selector (Updates icon ONLY, preserves expense title) */}
                    <div className="space-y-1.5">
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                            {QUICK_ACTIONS_PRESETS.map((preset, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setEditForm({ ...editForm, icon: preset.icon })}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-[0.97] whitespace-nowrap shadow-sm ${editForm.icon === preset.icon
                                        ? 'bg-emerald-950 text-white border-emerald-950'
                                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={submitEditUpdate} className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Title</label>
                                <div className="relative flex items-center">
                                    <span className="absolute left-3.5 text-base select-none pointer-events-none">
                                        {editForm.icon || '💸'}
                                    </span>
                                    <input
                                        type="text"
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                        className="w-full bg-stone-50 border rounded-2xl pl-10 pr-4 py-3.5 text-base font-semibold focus:outline-none"
                                        required
                                    />
                                </div>
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

                        {/* Description Field */}
                        <div className="space-y-1">
                            <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Description (Optional)</label>
                            <textarea
                                rows={2}
                                placeholder="Add notes or receipt summary..."
                                value={editForm.note}
                                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                                className="w-full bg-stone-50 border rounded-2xl px-4 py-2.5 text-sm font-medium text-stone-700 focus:outline-none resize-none"
                            />
                        </div>

                        {/* Collapsible Grocery / Itemized List Builder */}
                        {!showItemsSection ? (
                            <button
                                type="button"
                                onClick={() => setShowItemsSection(true)}
                                className="w-full py-3 px-4 rounded-2xl bg-stone-50 hover:bg-stone-100 border border-dashed border-stone-200 text-xs font-black text-stone-600 flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <Plus size={14} className="text-emerald-700" />
                                <span>Add Items {editItems.length > 0 ? `(${editItems.length})` : ''}</span>
                            </button>
                        ) : (
                            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                                        <ShoppingBag size={12} /> Items List ({editItems.length})
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {editItems.some(i => i.price !== undefined) && (
                                            <span className="text-[11px] font-bold text-emerald-700">
                                                Sum: {CURRENCY_SYMBOLS[editForm.currency]}
                                                {editItems.reduce((acc, it) => acc + (it.price || 0) * (it.qty || 1), 0).toFixed(2)}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setShowItemsSection(false)}
                                            className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
                                            title="Collapse items"
                                        >
                                            <ChevronUp size={14} />
                                        </button>
                                    </div>
                                </div>

                                {editItems.length > 0 && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {editItems.map((item) => (
                                            <div key={item.id} className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-stone-200/70">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => handleUpdateItemField(item.id, 'name', e.target.value)}
                                                    placeholder="Item name"
                                                    className="flex-1 min-w-0 text-xs font-bold text-stone-800 bg-transparent focus:outline-none"
                                                />
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.qty ?? 1}
                                                    onChange={(e) => handleUpdateItemField(item.id, 'qty', e.target.value)}
                                                    title="Quantity"
                                                    className="w-11 text-xs font-semibold text-stone-600 bg-stone-50 border rounded-lg px-1.5 py-1 text-center focus:outline-none"
                                                />
                                                <div className="relative w-20">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">
                                                        {CURRENCY_SYMBOLS[editForm.currency]}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        value={item.price ?? ''}
                                                        onChange={(e) => handleUpdateItemField(item.id, 'price', e.target.value)}
                                                        className="w-full text-xs font-black text-stone-800 bg-stone-50 border rounded-lg pl-5 pr-1.5 py-1 text-right focus:outline-none"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItemRow(item.id)}
                                                    className="p-1 text-stone-400 hover:text-rose-500"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 pt-1">
                                    <input
                                        type="text"
                                        placeholder="e.g. Milk, Chicken..."
                                        value={newItemDraft.name}
                                        onChange={(e) => setNewItemDraft({ ...newItemDraft, name: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItemRow(); } }}
                                        className="flex-1 min-w-0 bg-white border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Qty"
                                        value={newItemDraft.qty}
                                        onChange={(e) => setNewItemDraft({ ...newItemDraft, qty: e.target.value })}
                                        className="w-12 bg-white border rounded-xl px-1.5 py-2 text-xs font-bold text-center focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Price"
                                        value={newItemDraft.price}
                                        onChange={(e) => setNewItemDraft({ ...newItemDraft, price: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItemRow(); } }}
                                        className="w-20 bg-white border rounded-xl px-2 py-2 text-xs font-bold text-right focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddItemRow}
                                        className="p-2 bg-emerald-950 text-white rounded-xl shrink-0 hover:bg-emerald-900"
                                        title="Add item"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

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
    const hasItems = Array.isArray(expense.items) && expense.items.length > 0;
    const itemsSubtotal = hasItems
        ? expense.items!.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0)
        : 0;

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden max-h-[88dvh] flex flex-col relative border shadow-2xl animate-slide-up">
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

                <div className="p-6 space-y-5 overflow-y-auto overscroll-contain touch-pan-y">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-stone-50 flex items-center justify-center text-xl shrink-0">{icon}</div>
                        <div>
                            <h4 className="text-lg font-black text-stone-800 leading-tight">{text}</h4>
                            <p className="text-2xl font-black text-stone-900 mt-0.5">{CURRENCY_SYMBOLS[expense.currency]}{expense.amount.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="text-xs text-stone-400 space-y-0.5">
                        <p>Logged on {new Date(expense.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        {expense.isRecurring && <p className="font-bold text-emerald-700">Recurring on day {expense.recurringDay ?? 1} of each month</p>}
                    </div>

                    {/* Description Card (shown if present) */}
                    {expense.note && (
                        <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-100 space-y-1">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider flex items-center gap-1">
                                <FileText size={11} /> Description
                            </p>
                            <p className="text-xs text-stone-700 font-medium leading-relaxed">{expense.note}</p>
                        </div>
                    )}

                    {/* Itemized Receipt / Grocery List (shown if items exist) */}
                    {hasItems && (
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <ShoppingBag size={12} className="text-emerald-700" /> Items Purchased ({expense.items!.length})
                                </p>
                                {itemsSubtotal > 0 && (
                                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                        Subtotal: {CURRENCY_SYMBOLS[expense.currency]}{itemsSubtotal.toFixed(2)}
                                    </span>
                                )}
                            </div>
                            <div className="divide-y divide-stone-200/60">
                                {expense.items!.map((item, idx) => (
                                    <div key={item.id || idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                            <span className="font-bold text-stone-700 truncate">{item.name}</span>
                                            {item.qty && item.qty > 1 && (
                                                <span className="text-[10px] font-black text-stone-500 bg-white px-1.5 py-0.5 rounded-md border border-stone-200/80 shrink-0">
                                                    ×{item.qty}
                                                </span>
                                            )}
                                        </div>
                                        {item.price !== undefined && (
                                            <span className="font-mono font-bold text-stone-800 shrink-0">
                                                {CURRENCY_SYMBOLS[expense.currency]}{(item.price * (item.qty || 1)).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
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