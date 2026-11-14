import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Sparkles, Loader2, ShoppingBag, Plus, Camera, ChevronUp } from 'lucide-react';
import type { CurrencyCode, ExpenseItem, Roommate, SplitType } from '../../types';
import { CURRENCY_SYMBOLS, QUICK_ACTIONS_PRESETS } from '../../constants';
import { getUnallocatedPoolAmount, recomputeExactSplit } from '../../utils/finance';
import { scanVideoFrameWithGroq } from '../../utils/receiptScanner';

export interface NewExpenseForm {
  title: string;
  amount: string;
  currency: CurrencyCode;
  paidBy: string;
  note: string;
  items?: ExpenseItem[];
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
  modalAttachedFile?: string;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  convertToGBP: (amount: number, currency: CurrencyCode) => number;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export default function AddExpenseModal({
  activeMembers, newExpense, setNewExpense, selectiveMembers, setSelectiveMembers,
  convertToGBP, onSubmit, onClose
}: Props) {
  const unallocated = getUnallocatedPoolAmount(newExpense.amount, newExpense.customValues, activeMembers);
  const [touchedMembers, setTouchedMembers] = useState<Record<string, boolean>>({});
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showItemsSection, setShowItemsSection] = useState<boolean>(() => (newExpense.items?.length || 0) > 0);
  const [newItemDraft, setNewItemDraft] = useState({ name: '', qty: '1', price: '' });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const items = newExpense.items || [];

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

  useEffect(() => {
    if (newExpense.splitType !== 'EXACT') return;
    const total = parseFloat(newExpense.amount) || 0;
    const rebalanced = recomputeExactSplit(total, activeMembers, touchedMembers, newExpense.customValues);
    setNewExpense({ ...newExpense, customValues: rebalanced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newExpense.splitType, newExpense.amount, activeMembers.length]);

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
      if (hasScannedItems) setShowItemsSection(true);

      setNewExpense({
        ...newExpense,
        title: scanned.title || newExpense.title,
        amount: scanned.amount > 0 ? scanned.amount.toFixed(2) : newExpense.amount,
        currency: scanned.currency || newExpense.currency,
        note: scanned.note || newExpense.note,
        items: hasScannedItems ? scanned.items : newExpense.items,
        icon: hasScannedItems ? '🛒' : newExpense.icon,
        customValues: {}
      });
    } catch (err: any) {
      console.error('Receipt scan error:', err);
      stopCameraStream();
      setScanError(err?.message || 'Could not read receipt — please enter details manually.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleExactChange = (name: string, value: string) => {
    const nextTouched = { ...touchedMembers, [name]: true };
    setTouchedMembers(nextTouched);
    const total = parseFloat(newExpense.amount) || 0;
    const rebalanced = recomputeExactSplit(total, activeMembers, nextTouched, { ...newExpense.customValues, [name]: value });
    setNewExpense({ ...newExpense, customValues: rebalanced });
  };

  const handleResetSplit = () => {
    setTouchedMembers({});
    const total = parseFloat(newExpense.amount) || 0;
    const rebalanced = recomputeExactSplit(total, activeMembers, {}, {});
    setNewExpense({ ...newExpense, customValues: rebalanced });
  };

  const handleAddItem = () => {
    if (!newItemDraft.name.trim()) return;
    const parsedQty = parseInt(newItemDraft.qty) || 1;
    const parsedPrice = parseFloat(newItemDraft.price);

    const nextItem: ExpenseItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newItemDraft.name.trim(),
      qty: parsedQty > 1 ? parsedQty : undefined,
      price: !isNaN(parsedPrice) && parsedPrice >= 0 ? parsedPrice : undefined
    };

    setNewExpense({ ...newExpense, items: [...items, nextItem] });
    setNewItemDraft({ name: '', qty: '1', price: '' });
  };

  const handleRemoveItem = (id: string) => {
    setNewExpense({ ...newExpense, items: items.filter(it => it.id !== id) });
  };

  const handleUpdateItem = (id: string, field: 'name' | 'qty' | 'price', rawValue: string) => {
    const updated = items.map(item => {
      if (item.id !== id) return item;
      if (field === 'name') return { ...item, name: rawValue };
      if (field === 'qty') {
        const q = parseInt(rawValue);
        return { ...item, qty: !isNaN(q) && q > 1 ? q : undefined };
      }
      const p = parseFloat(rawValue);
      return { ...item, price: !isNaN(p) && p >= 0 ? p : undefined };
    });
    setNewExpense({ ...newExpense, items: updated });
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 max-h-[88dvh] overflow-y-auto overscroll-contain touch-pan-y relative border border-stone-100 shadow-2xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-xl font-black text-stone-800">Add New Expense</h3>
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
          <div className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-950 text-white flex items-center justify-center shrink-0">
                {isScanning ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              </div>
              <div>
                <p className="text-xs font-black text-emerald-950">
                  {isScanning ? 'Extracting receipt items...' : 'Scan Receipt with Camera'}
                </p>
                <p className="text-[10px] font-medium text-emerald-800/80">
                  Please be gentle
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenCamera}
              disabled={isScanning}
              className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white text-emerald-900 border border-emerald-200/60 shrink-0 flex items-center gap-1 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              <Sparkles size={10} /> Scan
            </button>
          </div>
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
                onClick={() => setNewExpense({ ...newExpense, icon: preset.icon })}
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
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-base select-none pointer-events-none">
                  {newExpense.icon || '💸'}
                </span>
                <input
                  type="text"
                  placeholder="Groceries, Rent"
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                  className="w-full bg-stone-50 border rounded-2xl pl-10 pr-4 py-3.5 text-base font-semibold focus:outline-none"
                  required
                />
              </div>
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
                <option value="EQUAL">Equally</option><option value="EXACT">Exact</option><option value="SELECTIVE">Unequally</option>
              </select>
            </div>
            {newExpense.splitType === 'SELECTIVE' && (
              <div className="col-span-2 p-4 bg-stone-50 rounded-2xl space-y-2.5 border border-stone-100">
                {activeMembers.map(m => (
                  <div key={m.clerkId} className="flex items-center gap-3 py-1">
                    <input
                      type="checkbox"
                      id={`select-${m.name}`}
                      checked={selectiveMembers[m.name] !== false}
                      onChange={(e) => setSelectiveMembers({ ...selectiveMembers, [m.name]: e.target.checked })}
                      className="rounded text-emerald-700 h-4 w-4 focus:ring-0"
                    />
                    <label htmlFor={`select-${m.name}`} className="text-sm font-bold text-stone-700 select-none cursor-pointer">
                      {m.name}
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
              <div className="flex justify-between items-center mb-1 gap-2">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide">Adjust anyone's share</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={handleResetSplit} className="text-[10px] font-bold text-stone-500 underline underline-offset-2">Reset</button>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${unallocated === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    Remaining: {CURRENCY_SYMBOLS[newExpense.currency]}{unallocated.toFixed(2)}
                  </span>
                </div>
              </div>
              {activeMembers.map(m => (
                <div key={m.clerkId} className="flex items-center justify-between gap-2 text-base">
                  <span className="font-bold text-stone-700">{m.name}</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">{CURRENCY_SYMBOLS[newExpense.currency]}</span>
                    <input type="number" step="0.01" placeholder="0.00" value={newExpense.customValues[m.name] || ''} onChange={(e) => handleExactChange(m.name, e.target.value)} className="w-28 border rounded-xl py-2 pl-6 pr-3 text-right font-black text-sm bg-white text-stone-800" required />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Description / Notes */}
          <div className="space-y-1">
            <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Add notes or receipt summary..."
              value={newExpense.note}
              onChange={(e) => setNewExpense({ ...newExpense, note: e.target.value })}
              className="w-full bg-stone-50 border rounded-2xl px-4 py-2.5 text-sm font-medium text-stone-700 focus:outline-none resize-none"
            />
          </div>

          {/* Collapsible Itemized Grocery / Receipt List */}
          {!showItemsSection ? (
            <button
              type="button"
              onClick={() => setShowItemsSection(true)}
              className="w-full py-3 px-4 rounded-2xl bg-stone-50 hover:bg-stone-100 border border-dashed border-stone-200 text-xs font-black text-stone-600 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus size={14} className="text-emerald-700" />
              <span>Add Items {items.length > 0 ? `(${items.length})` : ''}</span>
            </button>
          ) : (
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                  <ShoppingBag size={12} /> Items List ({items.length})
                </label>
                <div className="flex items-center gap-2">
                  {items.some(i => i.price !== undefined) && (
                    <span className="text-[11px] font-bold text-emerald-700">
                      Sum: {CURRENCY_SYMBOLS[newExpense.currency]}
                      {items.reduce((acc, it) => acc + (it.price || 0) * (it.qty || 1), 0).toFixed(2)}
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

              {items.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-stone-200/70">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                        placeholder="Item name"
                        className="flex-1 min-w-0 text-xs font-bold text-stone-800 bg-transparent focus:outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.qty ?? 1}
                        onChange={(e) => handleUpdateItem(item.id, 'qty', e.target.value)}
                        className="w-11 text-xs font-semibold text-stone-600 bg-stone-50 border rounded-lg px-1.5 py-1 text-center focus:outline-none"
                      />
                      <div className="relative w-20">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">
                          {CURRENCY_SYMBOLS[newExpense.currency]}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.price ?? ''}
                          onChange={(e) => handleUpdateItem(item.id, 'price', e.target.value)}
                          className="w-full text-xs font-black text-stone-800 bg-stone-50 border rounded-lg pl-5 pr-1.5 py-1 text-right focus:outline-none"
                        />
                      </div>
                      <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1 text-stone-400 hover:text-rose-500">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="Add item (e.g. Oats, Eggs)"
                  value={newItemDraft.name}
                  onChange={(e) => setNewItemDraft({ ...newItemDraft, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
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
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                  className="w-20 bg-white border rounded-xl px-2 py-2 text-xs font-bold text-right focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
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

          <div className="bg-emerald-50 text-center text-xs text-emerald-950 font-bold rounded-2xl border border-emerald-100/40 py-2">Normalized Baseline Value: ~£{newExpense.amount ? convertToGBP(parseFloat(newExpense.amount), newExpense.currency).toFixed(2) : '0.00'} GBP</div>
          <button type="submit" disabled={newExpense.splitType === 'EXACT' && unallocated !== 0} className={`w-full font-black py-4 rounded-2xl text-base shadow-md transition-all ${newExpense.splitType === 'EXACT' && unallocated !== 0 ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none' : 'bg-emerald-950 text-white'}`}><Check size={16} strokeWidth={3} className="inline mr-1" /> Commit & Divide</button>
        </form>
      </div>
    </div>
  );
}