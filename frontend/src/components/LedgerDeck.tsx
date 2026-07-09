import { useState } from 'react';
import { Receipt, ChevronDown, ChevronRight } from 'lucide-react';
import type { Expense, Roommate } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', INR: '₹', JPY: '¥'
};

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
    activeMembers: Roommate[];
    currentUserName: string;
    onSelectExpense: (exp: Expense) => void;
}

export default function LedgerDeck({ expenses, activeGroupId, activeInstanceId, currentUserName, onSelectExpense }: LedgerDeckProps) {
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
                                                    onClick={() => onSelectExpense(exp)}
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
        </div>
    );
}
