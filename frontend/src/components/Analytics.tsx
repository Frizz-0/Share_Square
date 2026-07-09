import { useState } from 'react';
import { ArrowLeft, ChevronDown, BarChart3, Calendar } from 'lucide-react';
import type { Roommate, Expense, AnalyticsTimeframe } from '../types';

// const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
//     GBP: '£', USD: '$', EUR: '€', INR: '₹', JPY: '¥'
// };

interface AnalyticsProps {
    activeGroupId: string;
    activeInstanceId: string;
    activeMembers: Roommate[];
    expenses: Expense[];
    fxRates: Record<string, number>;
    onBack: () => void;
}

export default function Analytics({
    activeGroupId,
    activeInstanceId: _activeInstanceId, // 💡 Prefixed with underscore to pass strict check
    activeMembers,
    expenses,
    fxRates: _fxRates,                   // 💡 Prefixed with underscore to pass strict check
    onBack
}: AnalyticsProps) {
    const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('MONTH');
    const [selectedHistoricalMonth, setSelectedHistoricalMonth] = useState<number>(new Date().getMonth());

    const filteredAnalyticsExpenses = expenses.filter(e => {
        if (e.groupId !== activeGroupId || e.isSettlement) return false;
        const expDate = new Date(e.date);
        const now = new Date();

        if (timeframe === 'WEEK') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return expDate >= oneWeekAgo;
        }
        if (timeframe === 'MONTH') {
            return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
        }
        if (timeframe === 'SELECT_MONTH') {
            return expDate.getMonth() === selectedHistoricalMonth && expDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    const totalAnalyticsSpendingGBP = filteredAnalyticsExpenses.reduce((sum, e) => sum + e.convertedAmountGBP, 0);

    const analyticsMemberSharesMap = (() => {
        const shares: Record<string, number> = {};
        activeMembers.forEach(m => { shares[m.name] = 0; });
        filteredAnalyticsExpenses.forEach(exp => {
            activeMembers.forEach(m => { shares[m.name] += (exp.splits[m.name] || 0); });
        });
        return shares;
    })();

    return (
        <div className="flex flex-col flex-1 bg-[#FBF9F6] min-h-[85vh]">
            <header className="p-6 flex items-center justify-between bg-white border-b border-stone-100">
                <button onClick={onBack} className="p-3 bg-stone-50 rounded-2xl text-stone-700 hover:bg-stone-100 border border-stone-200 shadow-sm flex items-center justify-center">
                    <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-black text-stone-900 tracking-tight">Ecosystem Metrics</h2>
                <div className="w-10"></div>
            </header>

            <main className="p-6 space-y-6 overflow-y-auto">
                <div className="bg-stone-200/60 p-1 rounded-xl grid grid-cols-3 gap-1">
                    <button onClick={() => setTimeframe('WEEK')} className={`py-2 text-xs font-bold rounded-lg transition-all ${timeframe === 'WEEK' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>7 Days</button>
                    <button onClick={() => setTimeframe('MONTH')} className={`py-2 text-xs font-bold rounded-lg transition-all ${timeframe === 'MONTH' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>This Month</button>
                    <button onClick={() => setTimeframe('SELECT_MONTH')} className={`py-2 text-xs font-bold rounded-lg transition-all ${timeframe === 'SELECT_MONTH' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>History</button>
                </div>

                {timeframe === 'SELECT_MONTH' && (
                    <div className="bg-white border border-stone-200 p-3 rounded-xl flex items-center justify-between shadow-sm">
                        <span className="text-xs font-bold text-stone-500">Pick Target Month:</span>
                        <div className="relative flex items-center">
                            <select
                                value={selectedHistoricalMonth}
                                onChange={(e) => setSelectedHistoricalMonth(parseInt(e.target.value))}
                                className="appearance-none bg-stone-50 border font-extrabold text-xs px-4 py-2 pr-8 rounded-xl text-stone-800"
                            >
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                                    <option key={idx} value={idx}>{m}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 text-stone-500 pointer-events-none" />
                        </div>
                    </div>
                )}

                <div className="bg-stone-900 text-white rounded-[32px] p-6 shadow-xl space-y-5">
                    <div className="flex justify-between items-center border-b border-stone-800 pb-4">
                        <span className="text-xs font-black tracking-wider text-stone-400 uppercase flex items-center gap-1.5">
                            <BarChart3 size={14} className="text-stone-300" /> Aggregated Outlays
                        </span>
                        <span className="text-xl font-black text-stone-200">£{totalAnalyticsSpendingGBP.toFixed(2)}</span>
                    </div>

                    {totalAnalyticsSpendingGBP === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-6">No historical records registered inside selected parameters.</p>
                    ) : (
                        <div className="space-y-4">
                            {activeMembers.map(m => {
                                const shareValue = analyticsMemberSharesMap[m.name] || 0;
                                const percentage = totalAnalyticsSpendingGBP > 0 ? (shareValue / totalAnalyticsSpendingGBP) * 100 : 0;
                                return (
                                    <div key={m.clerkId} className="space-y-1.5">
                                        <div className="flex justify-between text-xs font-black">
                                            <span className="text-stone-300">{m.name}</span>
                                            <span className="text-stone-200">£{shareValue.toFixed(2)} <span className="text-[10px] text-stone-500">({percentage.toFixed(0)}%)</span></span>
                                        </div>
                                        <div className="w-full bg-stone-800 h-2.5 rounded-full overflow-hidden shadow-inner">
                                            <div className="bg-stone-400 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="space-y-2.5">
                    <h4 className="text-xs font-black text-stone-400 uppercase tracking-wider flex items-center gap-1"><Calendar size={12} /> Filtered Scope Items ({filteredAnalyticsExpenses.length})</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                        {filteredAnalyticsExpenses.map(exp => (
                            <div key={exp.id} className="p-4 bg-white border border-stone-200 rounded-2xl flex justify-between items-center text-xs shadow-sm">
                                <div>
                                    <h5 className="font-bold text-stone-800 text-base">{exp.title}</h5>
                                    <p className="text-[10px] text-stone-400 mt-0.5">Paid by {exp.paidBy} • {new Date(exp.date).toLocaleDateString([], { day: '2-digit', month: 'short' })}</p>
                                </div>
                                <span className="font-black text-stone-700">£{exp.convertedAmountGBP.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}