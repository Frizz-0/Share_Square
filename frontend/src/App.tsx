import React, { useState, useEffect } from 'react';
import { Plus, Check, Users, Sparkles, CreditCard, Layers, FolderPlus, X, Trash2, ShieldAlert, BarChart3, Settings, Paperclip, ArrowRight, User } from 'lucide-react';
import type { Roommate, Group, Expense, SplitType, CurrencyCode, DirectDebt, GroupInstance, AuditLog } from './types';
import Analytics from './components/Analytics';
import LedgerDeck from './components/LedgerDeck';
import { UserButton, useUser } from '@clerk/clerk-react';

const AWS_API_GATEWAY_URL = import.meta.env.VITE_AWS_API_GATEWAY_URL;

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  GBP: '£', USD: '$', EUR: '€', INR: '₹', JPY: '¥'
};

export default function App() {
  const { user } = useUser();

  const adminEmails = [
    "bharathfrizz@gmail.com",
    "roommate1@example.com",
    "roommate2@example.com"
  ];

  // 🛡️ ADMIN CONFIGURATION MATRIX: Dynamically grants admin access to your account
  // const isAdmin = user?.primaryEmailAddress?.emailAddress === "bharathreddy.m@outlook.com";

  const isAdmin = user?.primaryEmailAddress?.emailAddress ? adminEmails.includes(user.primaryEmailAddress.emailAddress) : false;

  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'ANALYTICS'>('DASHBOARD');
  const [activeGroupId, setActiveGroupId] = useState<string>('20-malone');
  const [activeInstanceId, setActiveInstanceId] = useState<string>('inst-default');
  const [fxRates, setFxRates] = useState<Record<string, number>>({ GBP: 1, USD: 1.28, EUR: 1.18, INR: 107.0, JPY: 202.0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectiveMembers, setSelectiveMembers] = useState<Record<string, boolean>>({});

  // Core Arrays populated dynamically from cloud engines
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [roommates, setRoommates] = useState<Roommate[]>([]);

  const [groups, setGroups] = useState<Group[]>([
    { id: '20-malone', name: '20 Malone', icon: '🏠', memberIds: [1], instances: [{ id: 'inst-default', name: 'General Bills' }] },
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const cached = localStorage.getItem('sharesquare_v9_audit');
    return cached ? JSON.parse(cached) : [
      { id: 1, groupId: '20-malone', timestamp: 'Initial Startup', action: 'SYSTEM', details: 'Environment running clean.' }
    ];
  });

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [isCustomSettleOpen, setIsCustomSettleOpen] = useState<boolean>(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState<boolean>(false);

  const [settleTarget, setSettleTarget] = useState<DirectDebt | null>(null);

  // Form Captures
  const [newGroupName, setNewGroupName] = useState('');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [groupSettingsMemberName, setGroupSettingsMemberName] = useState('');

  const [customSettlePayer, setCustomSettlePayer] = useState('You');
  const [customSettleReceiver, setCustomSettlePayerReceiver] = useState('Alex');
  const [customSettleAmt, setCustomSettleAmt] = useState('');
  const [modalAttachedFile, setModalAttachedFile] = useState<string>('');

  // Username Onboarding State
  const [usernameInput, setUsernameInput] = useState('');
  const [isSubmittingUsername, setIsSubmittingUsername] = useState(false);

  const [newExpense, setNewExpense] = useState({
    title: '', amount: '', currency: 'GBP' as CurrencyCode, paidBy: 'You',
    note: '', splitType: 'EQUAL' as SplitType, isRecurring: false, recurringDay: '1', customValues: {} as Record<string, string>
  });

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  const activeMembers = roommates.filter(r => activeGroup.memberIds.includes(r.id));

  // const userGroupId = user?.publicMetadata?.groupId as string || "20-malone";

  // Check if username is missing to trigger setup wall overlay
  const needsUsernameOnboarding = user && !user.username;

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/GBP')
      .then(res => res.json())
      .then(data => { if (data && data.rates) setFxRates(data.rates); })
      .catch(err => console.error("FX synchronization latency:", err));
  }, []);

  useEffect(() => {
    localStorage.setItem('sharesquare_v9_roommates', JSON.stringify(roommates));
    localStorage.setItem('sharesquare_v9_groups', JSON.stringify(groups));
    localStorage.setItem('sharesquare_v9_audit', JSON.stringify(auditLogs));
  }, [roommates, groups, auditLogs]);

  const userGroupId = user?.publicMetadata?.groupId as string || "20-malone";

  // ☁️ UNIFIED CLOUD HYDRATION
  // ☁️ UNIFIED CLOUD HYDRATION
  useEffect(() => {
    const fetchCloudData = async () => {
      setIsLoading(true);
      const targetGroup = user?.publicMetadata?.groupId as string || activeGroupId;

      // 💡 SAFETY TRIGGER: Ensure AWS_API_GATEWAY_URL exists before making the network call
      if (!AWS_API_GATEWAY_URL || AWS_API_GATEWAY_URL.includes("undefined")) {
        console.error("Endpoint configuration missing string assignment properties.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${AWS_API_GATEWAY_URL}/expenses?groupId=${targetGroup}`);

        // 💡 CHECK RESPONSE FORMAT BEFORE PARSING
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new TypeError("Backend infrastructure returned HTML page error structure instead of pure API JSON datasets.");
        }

        const payloadData = await response.json();

        if (payloadData.roommates && Array.isArray(payloadData.roommates)) {
          setRoommates(payloadData.roommates);
        }

        if (payloadData.expenses && Array.isArray(payloadData.expenses)) {
          const sanitized: Expense[] = payloadData.expenses.map((item: any) => ({
            id: item.expenseId || item.id,
            groupId: item.groupId,
            instanceId: item.instanceId,
            title: item.title,
            paidBy: item.paidBy,
            amount: item.amount,
            currency: item.currency,
            convertedAmountGBP: item.convertedAmountGBP,
            date: item.date,
            splitType: item.splitType,
            splits: item.splits,
            attachmentName: item.attachmentName || undefined
          }));
          setExpenses(sanitized);
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Cloud database hydration failed:", err);
        setIsLoading(false);
      }
    };

    if (user) {
      fetchCloudData();
    }
  }, [user, activeGroupId]);

  const handleUsernameOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !user) return;

    setIsSubmittingUsername(true);
    try {
      // 👤 Sync profile string update straight into Clerk core registry infrastructure
      await user.update({
        username: usernameInput.trim().toLowerCase()
      });
      pushLog('USER_ONBOARDED', `Claimed account username identity handle: @${usernameInput.trim().toLowerCase()}`);
    } catch (err: any) {
      alert(err.errors?.[0]?.message || "Username selection collision. Try a different format.");
    } finally {
      setIsSubmittingUsername(false);
    }
  };

  const convertToGBP = (amount: number, fromCurrency: CurrencyCode): number => {
    const rate = fxRates[fromCurrency] || 1;
    return amount / rate;
  };

  const pushLog = (action: string, details: string, targetedGroupId: string = activeGroupId) => {
    const newLog: AuditLog = {
      id: Date.now(), groupId: targetedGroupId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action, details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const getMinimizedDebts = (): DirectDebt[] => {
    const netBalances: Record<string, number> = {};
    activeMembers.forEach(m => { netBalances[m.name] = 0; });

    const targetedExpenses = expenses.filter(e => e.groupId === activeGroupId && e.instanceId === activeInstanceId);

    targetedExpenses.forEach(exp => {
      activeMembers.forEach(m => {
        const share = exp.splits[m.name] || 0;
        if (exp.paidBy === m.name) netBalances[m.name] += (exp.convertedAmountGBP - share);
        else netBalances[m.name] -= share;
      });
    });

    const debtors = activeMembers.map(m => ({ name: m.name, bal: netBalances[m.name] })).filter(x => x.bal < -0.01).sort((a, b) => a.bal - b.bal);
    const creditors = activeMembers.map(m => ({ name: m.name, bal: netBalances[m.name] })).filter(x => x.bal > 0.01).sort((a, b) => b.bal - a.bal);

    const optimizedDebts: DirectDebt[] = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amountToSettle = Math.min(Math.abs(debtor.bal), creditor.bal);

      optimizedDebts.push({ from: debtor.name, to: creditor.name, amount: amountToSettle });
      debtor.bal += amountToSettle;
      creditor.bal -= amountToSettle;

      if (Math.abs(debtor.bal) < 0.01) i++;
      if (creditor.bal < 0.01) j++;
    }
    return optimizedDebts;
  };

  const currentYourNetGBP = (() => {
    let balanceGBP = 0;
    expenses.filter(e => e.groupId === activeGroupId && e.instanceId === activeInstanceId).forEach(exp => {
      const share = exp.splits['You'] || 0;
      if (exp.paidBy === 'You') balanceGBP += (exp.convertedAmountGBP - share);
      else balanceGBP -= share;
    });
    return balanceGBP;
  })();

  const getUnallocatedPoolAmount = (): number => {
    const totalInputBill = parseFloat(newExpense.amount) || 0;
    const allocatedSum = activeMembers.reduce((sum, m) => sum + (parseFloat(newExpense.customValues[m.name]) || 0), 0);
    return totalInputBill - allocatedSum;
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const idFriendly = newGroupName.trim().toLowerCase().replace(/\s+/g, '-');
    const newGroup: Group = {
      id: `${idFriendly}-${Date.now()}`, name: newGroupName.trim(), icon: '🏠', memberIds: [1, 2, 3],
      instances: [{ id: `inst-${Date.now()}`, name: 'General Bills' }]
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id);
    setActiveInstanceId(newGroup.instances[0].id);
    setIsGroupModalOpen(false);
    pushLog('GROUP_CREATED', `Created space container: "${newGroup.name}"`, newGroup.id);
    setNewGroupName('');
  };

  const handleCreateInstance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) return;
    const newInst: GroupInstance = { id: `inst-${Date.now()}`, name: newInstanceName.trim() };
    setGroups(groups.map(g => g.id === activeGroupId ? { ...g, instances: [...g.instances, newInst] } : g));
    setActiveInstanceId(newInst.id);
    setIsInstanceModalOpen(false);
    pushLog('EVENT_CREATED', `Created sub-ledger event: "${newInstanceName}"`);
    setNewInstanceName('');
  };

  const handleUpdateGroupName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupName.trim()) return;
    setGroups(groups.map(g => g.id === activeGroupId ? { ...g, name: editGroupName.trim() } : g));
    pushLog('GROUP_MODIFIED', `Renamed group workspace profile to: "${editGroupName.trim()}"`);
    setEditGroupName('');
  };

  const handleGroupSettingsAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupSettingsMemberName.trim()) return;
    const nextId = roommates.length + 1;
    const newRoomie: Roommate = { id: nextId, name: groupSettingsMemberName.trim(), avatar: '👤' };
    setRoommates([...roommates, newRoomie]);
    setGroups(groups.map(g => g.id === activeGroupId ? { ...g, memberIds: [...g.memberIds, nextId] } : g));
    pushLog('MEMBER_LINKED', `Linked roommate profile token "${newRoomie.name}".`);
    setGroupSettingsMemberName('');
  };

  const handleEvictMemberFromGroup = (memberIdToEvict: number, memberName: string) => {
    if (memberIdToEvict === 1) return;
    setGroups(groups.map(g => g.id === activeGroupId ? { ...g, memberIds: g.memberIds.filter(id => id !== memberIdToEvict) } : g));
    pushLog('MEMBER_EVICTED', `Removed profile link: "${memberName}"`);
  };

  const handleDeleteActiveGroup = () => {
    if (groups.length <= 1) return;
    const targetGroupToDelete = activeGroup.name;
    const nextRemainingGroup = groups.find(g => g.id !== activeGroupId)!;
    setGroups(groups.filter(g => g.id !== activeGroupId));
    setExpenses(expenses.filter(e => e.groupId !== activeGroupId));
    setActiveGroupId(nextRemainingGroup.id);
    setActiveInstanceId(nextRemainingGroup.instances[0]?.id || '');
    setIsGroupSettingsOpen(false);
    pushLog('GROUP_PURGED', `Purged workspace entry records: "${targetGroupToDelete}"`, nextRemainingGroup.id);
  };

  const handleExecuteCustomManualSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    const settleAmtVal = parseFloat(customSettleAmt);
    if (isNaN(settleAmtVal) || settleAmtVal <= 0 || customSettlePayer === customSettleReceiver) return;

    const computedSplitsGBP: Record<string, number> = {};
    computedSplitsGBP[customSettlePayer] = settleAmtVal;
    computedSplitsGBP[customSettleReceiver] = 0;

    const payload = {
      groupId: userGroupId,
      instanceId: activeInstanceId,
      title: `🤝 Settlement: ${customSettlePayer} paid ${customSettleReceiver}`,
      paidBy: customSettlePayer,
      amount: settleAmtVal,
      currency: 'GBP' as CurrencyCode,
      convertedAmountGBP: settleAmtVal,
      splitType: 'EXACT' as SplitType,
      splits: computedSplitsGBP,
      isSettlement: true
    };

    try {
      const response = await fetch(`${AWS_API_GATEWAY_URL}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const savedItem = await response.json();

      const guaranteedId = savedItem.expenseId || savedItem.id || `EXP#${Date.now()}`;
      const sanitizedFrontendItem: Expense = {
        ...payload,
        id: guaranteedId,
        date: savedItem.date || new Date().toISOString()
      };

      setExpenses(prev => [sanitizedFrontendItem, ...prev]);
      setIsCustomSettleOpen(false);
      pushLog('DEBT_SETTLED', `Manual record processed: ${customSettlePayer} cleared £${settleAmtVal.toFixed(2)} to ${customSettleReceiver}`);
      setCustomSettleAmt('');
    } catch (err) {
      alert("Network synchronization failed. Check backend gateway status routes.");
    }
  };

  const handleExactValueChange = (targetMemberName: string, value: string) => {
    const totalCost = parseFloat(newExpense.amount) || 0;
    const updatedCustomValues = { ...newExpense.customValues, [targetMemberName]: value };
    const configuredSum = Object.entries(updatedCustomValues).filter(([name]) => name !== newExpense.paidBy).reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);
    updatedCustomValues[newExpense.paidBy] = Math.max(0, totalCost - configuredSum).toFixed(2);
    setNewExpense({ ...newExpense, customValues: updatedCustomValues });
  };

  const handleModalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setModalAttachedFile(e.target.files[0].name);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rawAmt = parseFloat(newExpense.amount);
    if (!newExpense.title || isNaN(rawAmt) || rawAmt <= 0) return;

    const amountInGBP = convertToGBP(rawAmt, newExpense.currency);
    const computedSplitsGBP: Record<string, number> = {};

    if (newExpense.splitType === 'EQUAL') {
      const perPersonShareGBP = amountInGBP / activeMembers.length;
      activeMembers.forEach(m => { computedSplitsGBP[m.name] = perPersonShareGBP; });
    } else if (newExpense.splitType === 'SELECTIVE') {
      // 💡 Filter down to ONLY the roommates whose checkboxes are set to true
      const selectedList = activeMembers.filter(m => selectiveMembers[m.name] !== false);
      const denominator = selectedList.length > 0 ? selectedList.length : 1;
      const perPersonShareGBP = amountInGBP / denominator;

      activeMembers.forEach(m => {
        computedSplitsGBP[m.name] = selectiveMembers[m.name] !== false ? perPersonShareGBP : 0;
      });
    } else {
      activeMembers.forEach(m => {
        computedSplitsGBP[m.name] = convertToGBP(parseFloat(newExpense.customValues[m.name]) || 0, newExpense.currency);
      });
    }

    const createdExpensePayload = {
      groupId: userGroupId,
      instanceId: activeInstanceId,
      title: newExpense.title,
      paidBy: newExpense.paidBy,
      amount: rawAmt,
      currency: newExpense.currency,
      convertedAmountGBP: amountInGBP,
      splitType: newExpense.splitType,
      splits: computedSplitsGBP,
      attachmentName: modalAttachedFile || null
    };

    try {
      const response = await fetch(`${AWS_API_GATEWAY_URL}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createdExpensePayload)
      });

      const savedItem = await response.json();

      const sanitizedFrontendItem: Expense = {
        id: savedItem.expenseId || savedItem.id || `EXP#${Date.now()}`,
        groupId: savedItem.groupId || userGroupId,
        instanceId: savedItem.instanceId || activeInstanceId,
        title: savedItem.title || newExpense.title,
        paidBy: savedItem.paidBy || newExpense.paidBy,
        amount: savedItem.amount || rawAmt,
        currency: (savedItem.currency as CurrencyCode) || newExpense.currency,
        convertedAmountGBP: savedItem.convertedAmountGBP || amountInGBP,
        date: savedItem.date || new Date().toISOString(),
        splitType: (savedItem.splitType as SplitType) || newExpense.splitType,
        splits: savedItem.splits || computedSplitsGBP,
        attachmentName: savedItem.attachmentName || undefined
      };

      setExpenses(prev => [sanitizedFrontendItem, ...prev]);
      setIsExpenseModalOpen(false);
      pushLog('EXPENSE_CREATED', `Logged bill: "${sanitizedFrontendItem.title}" paid by ${sanitizedFrontendItem.paidBy} worth £${sanitizedFrontendItem.convertedAmountGBP.toFixed(2)}`);

      setNewExpense({ title: '', amount: '', currency: 'GBP', paidBy: 'You', note: '', splitType: 'EQUAL', isRecurring: false, recurringDay: '1', customValues: {} });
      setModalAttachedFile('');
    } catch (err) {
      alert("Network synchronization failed. Check backend gateway status routes.");
    }
  };

  const triggerSettleTransaction = async () => {
    if (!settleTarget) return;
    const computedSplitsGBP: Record<string, number> = {};
    computedSplitsGBP[settleTarget.from] = settleTarget.amount;
    computedSplitsGBP[settleTarget.to] = 0;

    const payload = {
      groupId: userGroupId,
      instanceId: activeInstanceId,
      title: `🤝 Cleared: ${settleTarget.from} paid ${settleTarget.to}`,
      paidBy: settleTarget.from,
      amount: settleTarget.amount,
      currency: 'GBP' as CurrencyCode,
      convertedAmountGBP: settleTarget.amount,
      splitType: 'EXACT' as SplitType,
      splits: computedSplitsGBP,
      isSettlement: true
    };

    try {
      const response = await fetch(`${AWS_API_GATEWAY_URL}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const savedItem = await response.json();

      // 💡 FIX: Create an explicit, safely typed object matching the Expense interface layout
      const sanitizedSettleItem: Expense = {
        id: savedItem.expenseId || savedItem.id || `EXP#${Date.now()}`,
        groupId: savedItem.groupId || userGroupId,
        instanceId: savedItem.instanceId || activeInstanceId,
        title: savedItem.title || payload.title,
        paidBy: savedItem.paidBy || payload.paidBy,
        amount: savedItem.amount || payload.amount,
        currency: (savedItem.currency as CurrencyCode) || payload.currency,
        convertedAmountGBP: savedItem.convertedAmountGBP || payload.convertedAmountGBP,
        date: savedItem.date || new Date().toISOString(),
        splitType: (savedItem.splitType as SplitType) || payload.splitType,
        splits: savedItem.splits || computedSplitsGBP,
        isSettlement: true
      };

      // Append directly into the local state array for an immediate zero-latency dashboard update
      setExpenses(prev => [sanitizedSettleItem, ...prev]);
      setIsSettleModalOpen(false);
      pushLog('DEBT_SETTLED', `Cleared debt routing path node: ${settleTarget.from} paid ${settleTarget.to} £${settleTarget.amount.toFixed(2)}`);
      setSettleTarget(null);
    } catch (err) {
      alert("Synchronization failure clearing optimization link.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] w-full p-2 sm:p-6 flex justify-center items-start font-sans antialiased text-[#2C2A29]">

      {/* 🔐 ONBOARDING OVERLAY WALL: Interrupts multi-user pipeline to force username claim tags
      {needsUsernameOnboarding && (
        <div className="fixed inset-0 bg-[#FAF9F6] z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-[36px] p-8 border border-stone-100 shadow-2xl space-y-6 text-center animate-fade-in">
            <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-800 shadow-sm"><User size={28} /></div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-stone-900">Claim Your Handle</h2>
              <p className="text-xs text-stone-400 mt-1">Set a recognizable handle for bill routing assignments.</p>
            </div>
            <form onSubmit={handleUsernameOnboardingSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-stone-400 uppercase tracking-wide">Unique Handle Name</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-stone-400 text-sm">@</span>
                  <input type="text" placeholder="username" minLength={3} maxLength={15} pattern="^[a-zA-Z0-9_]+$" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="w-full bg-stone-50 border rounded-2xl pl-8 pr-4 py-3.5 text-sm font-bold focus:outline-none focus:border-emerald-700/40 transition-colors" required disabled={isSubmittingUsername} />
                </div>
              </div>
              <button type="submit" disabled={isSubmittingUsername} className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-md flex items-center justify-center gap-2">
                {isSubmittingUsername ? 'Reserving Link...' : 'Claim Handle & Continue'}
              </button>
            </form>
          </div>
        </div>
      )} */}

      <div className="w-full max-w-md bg-white rounded-[44px] shadow-2xl border border-stone-100 overflow-hidden flex flex-col min-h-[88vh] relative">

        {isLoading && <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center font-bold text-xs text-stone-500 z-50">Syncing with AWS Cloud...</div>}

        {viewMode === 'DASHBOARD' ? (
          <>
            <header className="p-6 pb-4 flex justify-between items-center bg-white border-b border-stone-50">
              <h1 className="text-2xl font-black tracking-tight text-stone-900 flex items-center gap-1.5">
                ShareSquare <Sparkles size={20} className="text-emerald-600 fill-emerald-600" />
              </h1>
              <div className="flex gap-2 items-center">
                <button onClick={() => setIsGroupModalOpen(true)} className="p-3.5 bg-stone-50 text-stone-700 rounded-2xl border border-stone-100 shadow-sm flex items-center justify-center"><FolderPlus size={18} /></button>

                {/* 🏠 OPEN ACCESS: Settings gear icon is now un-wrapped and fully visible to all group members */}
                <button onClick={() => setIsGroupSettingsOpen(true)} className="p-3.5 bg-stone-50 text-stone-700 rounded-2xl border border-stone-100 shadow-sm flex items-center justify-center"><Settings size={18} /></button>

                <div className="ml-1 flex items-center justify-center scale-110">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
            </header>

            <div className="px-6 py-4 bg-stone-50/70 border-b border-stone-100 overflow-x-auto flex gap-3 scrollbar-none">
              {groups.map(g => (
                <button key={g.id} onClick={() => { setActiveGroupId(g.id); setActiveInstanceId(g.instances[0]?.id || ''); }} className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black tracking-tight transition-all shadow-sm shrink-0 ${g.id === activeGroupId ? 'bg-emerald-950 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>
                  <span className="text-xl">{g.icon}</span><span>{g.name}</span>
                </button>
              ))}
            </div>

            <div className="px-6 py-3 bg-white border-b border-stone-100 flex items-center gap-2">
              <Layers size={14} className="text-stone-400 shrink-0" />
              <div className="flex gap-2 overflow-x-auto scrollbar-none items-center">
                {activeGroup.instances?.map(inst => (
                  <button key={inst.id} onClick={() => setActiveInstanceId(inst.id)} className={`text-xs font-black px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all ${inst.id === activeInstanceId ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-stone-50/60 border-stone-100 text-stone-500'}`}>
                    {inst.name}
                  </button>
                ))}
                <button onClick={() => setIsInstanceModalOpen(true)} className="text-xs font-black text-emerald-700 px-2 py-1 whitespace-nowrap">+ New Event</button>
              </div>
            </div>

            <main className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 text-white rounded-[36px] p-6 shadow-xl relative">
                <p className="text-xs font-bold text-emerald-200/80 uppercase tracking-widest">{activeGroup.name} Master Net</p>
                <h2 className="text-5xl font-black mt-1 tracking-tight">
                  {currentYourNetGBP >= 0 ? `+£${currentYourNetGBP.toFixed(2)}` : `-£${Math.abs(currentYourNetGBP).toFixed(2)}`}
                </h2>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <button onClick={() => setIsExpenseModalOpen(true)} className="bg-white text-emerald-950 font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.96]">
                    <Plus size={15} strokeWidth={3} /> Add Bill
                  </button>
                  <button onClick={() => setIsCustomSettleOpen(true)} className="bg-emerald-900 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-1 transition-all active:scale-[0.96] border border-emerald-700/30 shadow-md">
                    <CreditCard size={14} /> Paid Back
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setViewMode('ANALYTICS')} className="p-4 bg-stone-50 border border-stone-200 text-stone-800 rounded-2xl flex items-center justify-between shadow-sm transition-all active:scale-[0.98]"><span className="text-xs font-black tracking-wider uppercase flex items-center gap-2"><BarChart3 size={16} className="text-emerald-700" /> Metrics Center</span><ArrowRight size={14} className="text-stone-400" /></button>
                <button onClick={() => setIsAuditModalOpen(true)} className="p-4 bg-stone-50 border border-stone-200 text-stone-800 rounded-2xl flex items-center justify-between shadow-sm transition-all active:scale-[0.98]"><span className="text-xs font-black tracking-wider uppercase flex items-center gap-2"><ShieldAlert size={16} className="text-amber-600" /> Audit Trail</span><ArrowRight size={14} className="text-stone-400" /></button>
              </div>

              <div>
                <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase mb-3 flex items-center gap-1.5">
                  <Users size={14} /> Net Optimized Clearances
                </h3>
                {getMinimizedDebts().length === 0 ? (
                  <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">All balances squared away! 🎉</div>
                ) : (
                  <div className="space-y-2.5">
                    {getMinimizedDebts().map((debt, idx) => (
                      <div key={idx} className="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between text-sm shadow-sm">
                        <div className="flex items-center gap-2 text-stone-700 font-bold">
                          <span>{debt.from}</span>
                          <ArrowRight size={14} className="text-stone-400" />
                          <span>{debt.to}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-emerald-700 text-base">£{debt.amount.toFixed(2)}</span>
                          {debt.from === 'You' && (
                            <button onClick={() => { setSettleTarget(debt); setIsSettleModalOpen(true); }} className="bg-white border border-stone-200 text-xs font-black px-4 py-2.5 rounded-xl shadow-sm">Pay</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <LedgerDeck
                expenses={expenses}
                activeGroupId={activeGroupId}
                activeInstanceId={activeInstanceId}
                activeMembers={activeMembers}
                fxRates={fxRates}
                onDeleteExpense={async (id) => {
                  try {
                    setExpenses(prev => prev.filter(e => e.id !== id));
                    await fetch(`${AWS_API_GATEWAY_URL}/expenses`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ groupId: activeGroupId, expenseId: id })
                    });
                    pushLog('EXPENSE_DELETED', `Removed transaction token ${id}`);
                  } catch (err) {
                    console.error("Cloud delete failed:", err);
                  }
                }}
                onUpdateExpense={async (updated) => {
                  try {
                    setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
                    await fetch(`${AWS_API_GATEWAY_URL}/expenses`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...updated,
                        groupId: activeGroupId,
                        expenseId: updated.id
                      })
                    });
                    pushLog('EXPENSE_MODIFIED', `Updated details for: "${updated.title}"`);
                  } catch (err) {
                    console.error("Cloud edit failed:", err);
                  }
                }}
              />
            </main>
          </>
        ) : (
          <Analytics activeGroupId={activeGroupId} activeInstanceId={activeInstanceId} activeMembers={activeMembers} expenses={expenses} fxRates={fxRates} onBack={() => setViewMode('DASHBOARD')} />
        )}

        {/* MODAL WINDOW INTERFACES */}
        {isCustomSettleOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
            <form onSubmit={handleExecuteCustomManualSettle} className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 relative border border-stone-100 shadow-2xl">
              <button type="button" onClick={() => setIsCustomSettleOpen(false)} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
              <h3 className="text-lg font-black text-stone-800">Record Direct Pay-Back</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Who Paid?</label>
                  <select value={customSettlePayer} onChange={(e) => setCustomSettlePayer(e.target.value)} className="w-full bg-stone-50 border rounded-xl p-3.5 font-bold text-sm focus:outline-none">
                    {activeMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Who Received?</label>
                  <select value={customSettleReceiver} onChange={(e) => setCustomSettlePayerReceiver(e.target.value)} className="w-full bg-stone-50 border rounded-xl p-3.5 font-bold text-sm focus:outline-none">
                    {activeMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
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
        )}

        {isGroupSettingsOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-5 max-h-[85vh] overflow-y-auto relative border border-stone-100 shadow-2xl">
              <button type="button" onClick={() => setIsGroupSettingsOpen(false)} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
              <div><h3 className="text-xl font-black text-stone-800">Group Control Center</h3><p className="text-xs text-stone-400 mt-0.5">Configure space parameters</p></div>

              {/* Everyone can modify the group name space */}
              <form onSubmit={handleUpdateGroupName} className="space-y-2 pt-1"><label className="block text-[11px] font-black text-stone-400 uppercase">Change Space Name</label><div className="flex gap-2"><input type="text" placeholder={activeGroup.name} value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} className="flex-1 bg-stone-50 border rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none" /><button type="submit" className="bg-stone-900 text-white font-bold px-4 rounded-xl text-xs">Update</button></div></form>

              {/* Everyone can provision new roommate links */}
              <form onSubmit={handleGroupSettingsAddMember} className="space-y-2 border-t border-stone-100 pt-3"><label className="block text-[11px] font-black text-stone-400 uppercase">Link Roommate to Space</label><div className="flex gap-2"><input type="text" placeholder="e.g., Sarah" value={groupSettingsMemberName} onChange={(e) => setGroupSettingsMemberName(e.target.value)} className="flex-1 bg-stone-50 border rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none" /><button type="submit" className="bg-emerald-950 text-white font-black px-4 rounded-xl text-xs flex items-center justify-center gap-1"><Plus size={14} /> Add</button></div></form>

              {/* Member Registry Directory List View */}
              <div className="space-y-2 border-t border-stone-100 pt-3">
                <label className="block text-[11px] font-black text-stone-400 uppercase flex items-center gap-1"><Users size={12} /> Member Registry Directory</label>
                <div className="space-y-2">
                  {activeMembers.map(m => (
                    <div key={m.id} className="p-3 bg-stone-50 rounded-2xl border flex items-center justify-between text-xs font-bold text-stone-700">
                      <div className="flex items-center gap-2"><span>{m.avatar}</span><span>{m.name}</span></div>

                      {/* 🛡️ SYSTEM RULE: Evict button is only visible to verified account admins */}
                      {m.id !== 1 && isAdmin && (
                        <button type="button" onClick={() => handleEvictMemberFromGroup(m.id, m.name)} className="text-stone-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 🛡️ SYSTEM RULE: Purge entire workspace button is completely restricted to you */}
              {isAdmin && (
                <div className="border-t border-stone-100 pt-3">
                  <button type="button" onClick={handleDeleteActiveGroup} className="w-full bg-rose-50 border border-rose-100 text-rose-700 font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-1"><Trash2 size={14} /> Purge Entire Group Workspace</button>
                </div>
              )}
            </div>
          </div>
        )}

        {isAuditModalOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 max-h-[85vh] overflow-y-auto relative border border-stone-100 shadow-2xl">
              <button type="button" onClick={() => setIsAuditModalOpen(false)} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
              <div><h3 className="text-lg font-black text-stone-800">System Audit Trails</h3><p className="text-xs text-stone-400 mt-0.5">Chronological trace logs</p></div>
              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-2 font-mono text-[11px] text-stone-300 shadow-inner max-h-[40vh] overflow-y-auto">{auditLogs.filter(log => log.groupId === activeGroupId).map(log => (<div key={log.id} className="border-b border-stone-800 pb-2 last:border-0 last:pb-0 leading-relaxed"><span className="text-purple-400 font-bold">[{log.timestamp}]</span> <span className="text-emerald-400 uppercase font-black">{log.action}:</span> {log.details}</div>))}</div>
            </div>
          </div>
        )}

        {isGroupModalOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
            <form onSubmit={handleCreateGroup} className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 relative border border-stone-100 shadow-2xl">
              <button type="button" onClick={() => setIsGroupModalOpen(false)} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
              <h3 className="text-lg font-black text-stone-800">New Group Space</h3>
              <input type="text" placeholder="e.g., Flat 4" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-semibold focus:outline-none" required />
              <button type="submit" className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-sm">Create Space</button>
            </form>
          </div>
        )}

        {isInstanceModalOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
            <form onSubmit={handleCreateInstance} className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 relative border border-stone-100 shadow-2xl">
              <button type="button" onClick={() => setIsInstanceModalOpen(false)} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
              <h3 className="text-lg font-black text-stone-800">Create Event Sub-Ledger</h3>
              <input type="text" placeholder="e.g., Roadtrip Gas" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-semibold focus:outline-none" required />
              <button type="submit" className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-sm">Instantiate Event</button>
            </form>
          </div>
        )}

        {isSettleModalOpen && settleTarget && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-5 relative border-t border-stone-100 shadow-2xl">
              <button type="button" onClick={() => setIsSettleModalOpen(false)} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
              <h3 className="text-center text-lg font-black text-stone-800">Confirm Payment</h3>
              <div className="bg-stone-50 rounded-2xl p-4 text-center border font-black text-xl text-emerald-800">£{settleTarget.amount.toFixed(2)} GBP</div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsSettleModalOpen(false)} className="flex-1 bg-stone-100 text-stone-600 font-bold py-3.5 rounded-2xl text-sm">Cancel</button>
                <button type="button" onClick={triggerSettleTransaction} className="flex-1 bg-emerald-950 text-white font-black py-3.5 rounded-2xl text-sm">Clear Debt</button>
              </div>
            </div>
          </div>
        )}

        {isExpenseModalOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 max-h-[85vh] overflow-y-auto relative border border-stone-100 shadow-2xl">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xl font-black text-stone-800">Add New Expense</h3>
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
              </div>
              <form onSubmit={handleCreateExpense} className="space-y-4">
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
                      {activeMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-stone-400 uppercase mb-1">Split Method</label>
                    <select value={newExpense.splitType} onChange={(e) => setNewExpense({ ...newExpense, splitType: e.target.value as SplitType, customValues: {} })} className="w-full bg-stone-50 border rounded-2xl px-2 py-3.5 text-base font-bold focus:outline-none">
                      <option value="EQUAL">Equally</option><option value="EXACT">Exact Values Assistant</option><option value="SELECTIVE">Unequally</option>
                    </select>
                  </div>
                  {/* 2. Insert this conditional container right beneath the Split Method dropdown section rows */}
                  {newExpense.splitType === 'SELECTIVE' && (
                    <div className="p-4 bg-stone-50 rounded-2xl space-y-2.5 border border-stone-100">
                      {/* <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide mb-1">Select who is included in this bill:</p> */}
                      {activeMembers.map(m => (
                        <div key={m.id} className="flex items-center gap-3 py-1">
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
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${getUnallocatedPoolAmount() === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        Remaining: {CURRENCY_SYMBOLS[newExpense.currency]}{getUnallocatedPoolAmount().toFixed(2)}
                      </span>
                    </div>
                    {activeMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-2 text-base">
                        <span className="font-bold text-stone-700">{m.name}</span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">{CURRENCY_SYMBOLS[newExpense.currency]}</span>
                          <input type="number" step="0.01" placeholder="0.00" disabled={m.name === newExpense.paidBy} value={newExpense.customValues[m.name] || ''} onChange={(e) => handleExactValueChange(m.name, e.target.value)} className={`w-28 border rounded-xl py-2 pl-6 pr-3 text-right font-black text-sm ${m.name === newExpense.paidBy ? 'bg-stone-100 text-stone-400' : 'bg-white text-stone-800'}`} required />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-stone-400 uppercase">Proof Image Attachment</label>
                  <div className="relative flex items-center justify-center border-2 border-dashed border-stone-200 bg-stone-50 hover:bg-stone-100 rounded-2xl py-4 transition-colors cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleModalFileChange} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
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
                <button type="submit" disabled={newExpense.splitType === 'EXACT' && getUnallocatedPoolAmount() !== 0} className={`w-full font-black py-4 rounded-2xl text-base shadow-md transition-all ${newExpense.splitType === 'EXACT' && getUnallocatedPoolAmount() !== 0 ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none' : 'bg-emerald-950 text-white'}`}><Check size={16} strokeWidth={3} className="inline mr-1" /> Commit & Divide</button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}