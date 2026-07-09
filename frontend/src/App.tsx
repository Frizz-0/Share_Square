import React, { useState, useEffect } from 'react';
import type { Roommate, Group, Expense, SplitType, CurrencyCode, DirectDebt, GroupInstance } from './types';
import Analytics from './components/Analytics';
import LedgerDeck from './components/LedgerDeck';
import DashboardHeader from './components/DashboardHeader';
import DashboardSummary from './components/DashboardSummary';
import OnboardingScreen from './components/OnboardingScreen';
import NoticesSchedule from './components/NoticesSchedule';
import ConfirmDialog from './components/ConfirmDialog';
import { CreateGroupModal, CreateInstanceModal, GroupSettingsModal, AuditModal } from './components/modals/GroupModals';
import { SettleModal, CustomSettleModal } from './components/modals/SettleModals';
import AddExpenseModal, { type NewExpenseForm } from './components/modals/AddExpenseModal';
import { useUser } from '@clerk/clerk-react';
import { fetchGroupData, postExpense, putExpense, deleteExpense as deleteExpenseApi } from './api/expenses';
import { fetchUserGroups, createGroup as createGroupApi, joinGroupByCode, leaveGroup } from './api/groups';
import { postAuditLog } from './api/audit';
import { convertToGBP as convertToGBPRate, computeSplits, getMinimizedDebts, computeUserNetGBP } from './utils/finance';

const INSTANCE_CACHE_KEY = 'sharesquare_v11_instances';

function loadCachedInstances(): Record<string, GroupInstance[]> {
  try {
    return JSON.parse(localStorage.getItem(INSTANCE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}


export default function App() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const userDisplayName = user?.firstName || 'You';

  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'ANALYTICS' | 'NOTICES'>('DASHBOARD');
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [activeInstanceId, setActiveInstanceId] = useState<string>('inst-default');
  const [fxRates, setFxRates] = useState<Record<string, number>>({ GBP: 1, USD: 1.28, EUR: 1.18, INR: 107.0, JPY: 202.0 });
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [selectiveMembers, setSelectiveMembers] = useState<Record<string, boolean>>({});
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [roommates, setRoommates] = useState<Roommate[]>([]);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [isCustomSettleOpen, setIsCustomSettleOpen] = useState<boolean>(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState<boolean>(false);

  const [settleTarget, setSettleTarget] = useState<DirectDebt | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [editGroupName, setEditGroupName] = useState('');

  const [customSettlePayer, setCustomSettlePayer] = useState('You');
  const [customSettleReceiver, setCustomSettleReceiver] = useState('Alex');
  const [customSettleAmt, setCustomSettleAmt] = useState('');
  const [modalAttachedFile, setModalAttachedFile] = useState<string>('');

  const [newExpense, setNewExpense] = useState<NewExpenseForm>({
    title: '', amount: '', currency: 'GBP', paidBy: 'You',
    note: '', splitType: 'EQUAL', isRecurring: false, recurringDay: '1',
    customValues: {}, icon: '💸'
  });

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  const isAdmin = activeGroup?.memberIds[0] === user?.id;
  const activeMembers = roommates;
  const selfName = activeMembers.find(m => m.clerkId === user?.id)?.name || userDisplayName;

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/GBP')
      .then(res => res.json())
      .then(data => { if (data && data.rates) setFxRates(data.rates); })
      .catch(err => console.error("FX sync delay:", err));
  }, []);

  // 💡 The "Paid By" / settle pickers used to default to the literal placeholder
  // strings 'You'/'Alex', which never matched a real member's name once real
  // group members loaded — silently breaking every debt calculation. Keep
  // them pointed at real members as soon as the roster is known.
  useEffect(() => {
    if (activeMembers.length === 0) return;
    const selfName = activeMembers.find(m => m.clerkId === user?.id)?.name || activeMembers[0].name;

    setNewExpense(prev => activeMembers.some(m => m.name === prev.paidBy) ? prev : { ...prev, paidBy: selfName });

    setCustomSettlePayer(prev => activeMembers.some(m => m.name === prev) ? prev : selfName);
    setCustomSettleReceiver(prev => {
      if (activeMembers.some(m => m.name === prev) && prev !== selfName) return prev;
      return activeMembers.find(m => m.name !== selfName)?.name || selfName;
    });
  }, [activeMembers, user]);

  // ☁️ Load the groups this signed-in user actually belongs to
  useEffect(() => {
    if (!isUserLoaded) return;
    if (!user) { setIsLoadingGroups(false); return; }

    const loadGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const fetchedGroups = await fetchUserGroups(user.id);
        const instanceCache = loadCachedInstances();
        const hydratedGroups: Group[] = fetchedGroups.map(g => ({
          ...g,
          instances: instanceCache[g.id] || [{ id: 'inst-default', name: 'General Bills' }]
        }));
        setGroups(hydratedGroups);

        const lastActive = localStorage.getItem('sharesquare_v11_active_group');
        const stillValid = hydratedGroups.find(g => g.id === lastActive);
        const nextActive = stillValid || hydratedGroups[0];
        if (nextActive) {
          setActiveGroupId(nextActive.id);
          setActiveInstanceId(nextActive.instances[0]?.id || 'inst-default');
        }
      } catch (err) {
        console.error("Failed to load user groups:", err);
      } finally {
        setIsLoadingGroups(false);
      }
    };

    loadGroups();
  }, [isUserLoaded, user]);

  useEffect(() => {
    if (activeGroupId) localStorage.setItem('sharesquare_v11_active_group', activeGroupId);
  }, [activeGroupId]);

  // ☁️ Hydrate expenses + members for the active group (server enforces membership)
  useEffect(() => {
    if (!user || !activeGroupId) return;

    const hydrate = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true);
      try {
        const payloadData = await fetchGroupData(activeGroupId, user.id);

        if (payloadData.roommates && Array.isArray(payloadData.roommates)) {
          setRoommates(payloadData.roommates);
        }

        if (payloadData.group) {
          setGroups(prev => prev.map(g => g.id === activeGroupId
            ? { ...g, name: payloadData.group.name, icon: payloadData.group.icon, inviteCode: payloadData.group.inviteCode, memberIds: payloadData.group.memberIds }
            : g));
        }

        if (payloadData.expenses && Array.isArray(payloadData.expenses)) {
          // const sanitized: Expense[] = payloadData.expenses.map((item: any) => ({
          const sanitized: Expense[] = payloadData.expenses
            .filter((item: any) => item.title && item.amount !== undefined)
            .map((item: any) => ({
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
              attachmentName: item.attachmentName || undefined,
              isSettlement: item.isSettlement || undefined,
              isRecurring: item.isRecurring || undefined,
              recurringDay: item.recurringDay || undefined
            }));
          setExpenses(sanitized);
        }
      } catch (err) {
        console.error("Cloud database hydration failed:", err);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    };

    hydrate(true);
    const pollId = setInterval(() => hydrate(false), 6000);
    return () => clearInterval(pollId);
  }, [user, activeGroupId]);

  const convertToGBP = (amount: number, fromCurrency: CurrencyCode): number => convertToGBPRate(amount, fromCurrency, fxRates);

  const pushLog = (action: string, details: string, targetedGroupId: string = activeGroupId) => {
    if (!user) return;
    postAuditLog(targetedGroupId, user.id, action, details).catch(err => console.error("Failed to record audit log:", err));
  };

  const persistInstances = (nextGroups: Group[]) => {
    const cache: Record<string, GroupInstance[]> = {};
    nextGroups.forEach(g => { cache[g.id] = g.instances; });
    localStorage.setItem(INSTANCE_CACHE_KEY, JSON.stringify(cache));
  };

  const minimizedDebts = activeGroup ? getMinimizedDebts(expenses, activeMembers, activeGroupId, activeInstanceId) : [];
  const currentYourNetGBP = activeGroup ? computeUserNetGBP(expenses, activeGroupId, activeInstanceId, selfName) : 0;
  const recurringExpenses = expenses.filter(e => e.isRecurring && e.groupId === activeGroupId);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;
    try {
      const created = await createGroupApi(newGroupName.trim(), '🏠', user.id);
      const newGroup: Group = {
        id: created.id, name: created.name, icon: created.icon, inviteCode: created.inviteCode,
        memberIds: created.memberIds, instances: [{ id: 'inst-default', name: 'General Bills' }]
      };
      const nextGroups = [...groups, newGroup];
      setGroups(nextGroups);
      persistInstances(nextGroups);
      setActiveGroupId(newGroup.id);
      setActiveInstanceId('inst-default');
      setIsGroupModalOpen(false);
      pushLog('GROUP_CREATED', `Created space: "${newGroup.name}"`, newGroup.id);
      setNewGroupName('');
    } catch (err) {
      alert("Failed to create group. Try again.");
    }
  };

  const handleOnboardingCreateGroup = async (name: string) => {
    if (!user) return;
    const created = await createGroupApi(name, '🏠', user.id);
    const newGroup: Group = {
      id: created.id, name: created.name, icon: created.icon, inviteCode: created.inviteCode,
      memberIds: created.memberIds, instances: [{ id: 'inst-default', name: 'General Bills' }]
    };
    const nextGroups = [...groups, newGroup];
    setGroups(nextGroups);
    persistInstances(nextGroups);
    setActiveGroupId(newGroup.id);
    setActiveInstanceId('inst-default');
    pushLog('GROUP_CREATED', `Created space: "${newGroup.name}"`, newGroup.id);
  };

  const joinGroupFlow = async (inviteCode: string) => {
    if (!user) return;
    const joined = await joinGroupByCode(inviteCode, user.id);
    const newGroup: Group = {
      id: joined.id, name: joined.name, icon: joined.icon, inviteCode: joined.inviteCode,
      memberIds: joined.memberIds, instances: [{ id: 'inst-default', name: 'General Bills' }]
    };
    const nextGroups = groups.find(g => g.id === newGroup.id) ? groups : [...groups, newGroup];
    setGroups(nextGroups);
    persistInstances(nextGroups);
    setActiveGroupId(newGroup.id);
    setActiveInstanceId('inst-default');
    pushLog('GROUP_JOINED', `Joined space: "${newGroup.name}"`, newGroup.id);
  };

  const handleCreateInstance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) return;
    const newInst: GroupInstance = { id: `inst-${Date.now()}`, name: newInstanceName.trim() };
    const nextGroups = groups.map(g => g.id === activeGroupId ? { ...g, instances: [...g.instances, newInst] } : g);
    setGroups(nextGroups);
    persistInstances(nextGroups);
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

  const confirmDeleteActiveGroup = async () => {
    if (!user || groups.length <= 1) return;
    try {
      await leaveGroup(activeGroupId, user.id, user.id);
      const targetGroupToDelete = activeGroup.name;
      const nextRemainingGroup = groups.find(g => g.id !== activeGroupId)!;
      const nextGroups = groups.filter(g => g.id !== activeGroupId);
      setGroups(nextGroups);
      persistInstances(nextGroups);
      setActiveGroupId(nextRemainingGroup.id);
      setActiveInstanceId(nextRemainingGroup.instances[0]?.id || '');
      setIsGroupSettingsOpen(false);
      pushLog('GROUP_LEFT', `Left workspace: "${targetGroupToDelete}"`, nextRemainingGroup.id);
    } catch (err) {
      alert("Failed to leave the group.");
    }
  };

  const handleDeleteActiveGroup = () => {
    if (!user || groups.length <= 1) return;
    setConfirmDialog({
      title: 'Leave this space?',
      message: `Leave "${activeGroup.name}"? This removes you from the space.`,
      onConfirm: confirmDeleteActiveGroup
    });
  };

  const confirmEvictMember = async (clerkId: string, name: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      await leaveGroup(activeGroupId, clerkId, user.id);
      setRoommates(prev => prev.filter(r => r.clerkId !== clerkId));
      pushLog('MEMBER_REMOVED', `Removed "${name}" from the space.`);
    } catch (err) {
      alert("Failed to remove member.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvictMember = (clerkId: string, name: string) => {
    if (!user) return;
    setConfirmDialog({
      title: 'Remove this member?',
      message: `Are you sure you want to remove ${name} from the space?`,
      onConfirm: () => confirmEvictMember(clerkId, name)
    });
  };

  const handleExecuteCustomManualSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const settleAmtVal = parseFloat(customSettleAmt);
    if (isNaN(settleAmtVal) || settleAmtVal <= 0 || customSettlePayer === customSettleReceiver) return;

    const computedSplitsGBP: Record<string, number> = { [customSettlePayer]: settleAmtVal, [customSettleReceiver]: 0 };

    const payload = {
      groupId: activeGroupId,
      userId: user.id,
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
      const savedItem = await postExpense(payload);
      const sanitizedFrontendItem: Expense = {
        ...payload,
        id: savedItem.expenseId || savedItem.id || `EXP#${Date.now()}`,
        date: savedItem.date || new Date().toISOString()
      };

      setExpenses(prev => [sanitizedFrontendItem, ...prev]);
      setIsCustomSettleOpen(false);
      pushLog('DEBT_SETTLED', `Manual record processed: ${customSettlePayer} cleared £${settleAmtVal.toFixed(2)} to ${customSettleReceiver}`);
      setCustomSettleAmt('');
    } catch (err) {
      alert("Network synchronization failed.");
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
    if (e.target.files && e.target.files[0]) setModalAttachedFile(e.target.files[0].name);
  };

  const handleCreateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const rawAmt = parseFloat(newExpense.amount);
    if (!newExpense.title || isNaN(rawAmt) || rawAmt <= 0) return;

    const amountInGBP = convertToGBP(rawAmt, newExpense.currency);
    const computedSplitsGBP = computeSplits(newExpense.splitType, amountInGBP, activeMembers, {
      selectiveMembers, customValues: newExpense.customValues, currency: newExpense.currency, fxRates
    });

    const createdExpensePayload = {
      groupId: activeGroupId,
      userId: user.id,
      instanceId: activeInstanceId,
      title: `${newExpense.icon} ${newExpense.title}`,
      paidBy: newExpense.paidBy,
      amount: rawAmt,
      currency: newExpense.currency,
      convertedAmountGBP: amountInGBP,
      splitType: newExpense.splitType,
      splits: computedSplitsGBP,
      attachmentName: modalAttachedFile || null,
      isRecurring: newExpense.isRecurring,
      recurringDay: newExpense.isRecurring ? parseInt(newExpense.recurringDay) : undefined
    };

    try {
      const savedItem = await postExpense(createdExpensePayload);
      const sanitizedFrontendItem: Expense = {
        id: savedItem.expenseId || savedItem.id || `EXP#${Date.now()}`,
        groupId: savedItem.groupId || activeGroupId,
        instanceId: savedItem.instanceId || activeInstanceId,
        title: savedItem.title || newExpense.title,
        paidBy: savedItem.paidBy || newExpense.paidBy,
        amount: savedItem.amount || rawAmt,
        currency: (savedItem.currency as CurrencyCode) || newExpense.currency,
        convertedAmountGBP: savedItem.convertedAmountGBP || amountInGBP,
        date: savedItem.date || new Date().toISOString(),
        splitType: (savedItem.splitType as SplitType) || newExpense.splitType,
        splits: savedItem.splits || computedSplitsGBP,
        attachmentName: savedItem.attachmentName || undefined,
        isRecurring: savedItem.isRecurring || undefined,
        recurringDay: savedItem.recurringDay || undefined
      };

      setExpenses(prev => [sanitizedFrontendItem, ...prev]);
      setIsExpenseModalOpen(false);
      pushLog('EXPENSE_CREATED', `Logged bill: "${sanitizedFrontendItem.title}" paid by ${sanitizedFrontendItem.paidBy} worth £${sanitizedFrontendItem.convertedAmountGBP.toFixed(2)}`);
      setNewExpense({ title: '', amount: '', currency: 'GBP', paidBy: newExpense.paidBy, note: '', splitType: 'EQUAL', isRecurring: false, recurringDay: '1', customValues: {}, icon: '💸' });
      setModalAttachedFile('');
    } catch (err) {
      alert("Network synchronization failed.");
    }
  };

  const triggerSettleTransaction = async () => {
    if (!settleTarget || !user) return;
    const computedSplitsGBP: Record<string, number> = { [settleTarget.from]: settleTarget.amount, [settleTarget.to]: 0 };

    const payload = {
      groupId: activeGroupId,
      userId: user.id,
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
      const savedItem = await postExpense(payload);
      const sanitizedSettleItem: Expense = {
        id: savedItem.expenseId || savedItem.id || `EXP#${Date.now()}`,
        groupId: savedItem.groupId || activeGroupId,
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

      setExpenses(prev => [sanitizedSettleItem, ...prev]);
      setIsSettleModalOpen(false);
      pushLog('DEBT_SETTLED', `Cleared debt link: ${settleTarget.from} paid ${settleTarget.to} £${settleTarget.amount.toFixed(2)}`);
      setSettleTarget(null);
    } catch (err) {
      alert("Synchronization failure.");
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!user) return;

    const targetExpense = expenses.find(e => e.id === id);
    if (!targetExpense) return;

    try {
      setExpenses(prev => prev.filter(e => e.id !== id));
      // await deleteExpenseApi(activeGroupId, id, user.id);
      await deleteExpenseApi(targetExpense.groupId, targetExpense.id, user.id);
      pushLog('EXPENSE_DELETED', `Removed transaction token ${id}`);
    } catch (err) {
      console.error("Cloud delete failed:", err);
    }
  };

  const handleUpdateExpense = async (updated: Expense) => {
    if (!user) return;
    try {
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
      await putExpense({ ...updated, groupId: activeGroupId, expenseId: updated.id, userId: user.id });
      pushLog('EXPENSE_MODIFIED', `Updated details for: "${updated.title}"`);
    } catch (err) {
      console.error("Cloud edit failed:", err);
    }
  };

  if (!isUserLoaded || isLoadingGroups) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-stone-500 bg-white border border-stone-200 px-4 py-2.5 rounded-full shadow-md animate-pulse">
          <span className="h-2 w-2 bg-emerald-600 rounded-full animate-ping" />
          Loading your spaces...
        </div>
      </div>
    );
  }

  if (!activeGroup) {
    return <OnboardingScreen onCreateGroup={handleOnboardingCreateGroup} onJoinGroup={joinGroupFlow} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] w-full p-2 sm:p-6 flex justify-center items-start font-sans antialiased text-[#2C2A29]">
      <div className="w-full max-w-md bg-white rounded-[44px] shadow-2xl border border-stone-100 overflow-hidden flex flex-col min-h-[88vh] relative">

        {viewMode === 'DASHBOARD' ? (
          <>
            <DashboardHeader
              groups={groups}
              activeGroupId={activeGroupId}
              activeGroup={activeGroup}
              activeInstanceId={activeInstanceId}
              onSelectGroup={(groupId, firstInstanceId) => { setActiveGroupId(groupId); setActiveInstanceId(firstInstanceId); }}
              onSelectInstance={setActiveInstanceId}
              onOpenGroupModal={() => setIsGroupModalOpen(true)}
              onOpenGroupSettings={() => setIsGroupSettingsOpen(true)}
              onOpenInstanceModal={() => setIsInstanceModalOpen(true)}
            />

            <main className="p-6 space-y-6 flex-1 overflow-y-auto relative">
              {isLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-30 flex items-center justify-center rounded-3xl min-h-[250px]">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-500 bg-white border border-stone-200 px-4 py-2.5 rounded-full shadow-md animate-pulse">
                    <span className="h-2 w-2 bg-emerald-600 rounded-full animate-ping" />
                    Loading
                  </div>
                </div>
              )}

              <DashboardSummary
                groupName={activeGroup.name}
                currentYourNetGBP={currentYourNetGBP}
                minimizedDebts={minimizedDebts}
                recurringExpenses={recurringExpenses}
                onAddBill={() => setIsExpenseModalOpen(true)}
                onPaidBack={() => setIsCustomSettleOpen(true)}
                onOpenAnalytics={() => setViewMode('ANALYTICS')}
                onOpenAudit={() => setIsAuditModalOpen(true)}
                onOpenNotices={() => setViewMode('NOTICES')}
                onPayDebt={(debt) => { setSettleTarget(debt); setIsSettleModalOpen(true); }}
              />

              <LedgerDeck
                expenses={expenses}
                activeGroupId={activeGroupId}
                activeInstanceId={activeInstanceId}
                activeMembers={activeMembers}
                currentUserName={selfName}
                fxRates={fxRates}
                onDeleteExpense={handleDeleteExpense}
                onUpdateExpense={handleUpdateExpense}
              />
            </main>
          </>
        ) : viewMode === 'ANALYTICS' ? (
          <Analytics activeGroupId={activeGroupId} activeInstanceId={activeInstanceId} activeMembers={activeMembers} expenses={expenses} fxRates={fxRates} onBack={() => setViewMode('DASHBOARD')} />
        ) : (
          <NoticesSchedule
            groupId={activeGroupId}
            userId={user?.id || ''}
            isAdmin={isAdmin}
            recurringExpenses={recurringExpenses}
            onBack={() => setViewMode('DASHBOARD')}
          />
        )}

        {isCustomSettleOpen && (
          <CustomSettleModal
            activeMembers={activeMembers}
            customSettlePayer={customSettlePayer}
            setCustomSettlePayer={setCustomSettlePayer}
            customSettleReceiver={customSettleReceiver}
            setCustomSettleReceiver={setCustomSettleReceiver}
            customSettleAmt={customSettleAmt}
            setCustomSettleAmt={setCustomSettleAmt}
            onSubmit={handleExecuteCustomManualSettle}
            onClose={() => setIsCustomSettleOpen(false)}
          />
        )}

        {isGroupSettingsOpen && (
          <GroupSettingsModal
            activeGroup={activeGroup}
            roommates={roommates}
            editGroupName={editGroupName}
            setEditGroupName={setEditGroupName}
            onUpdateGroupName={handleUpdateGroupName}
            onEvictMember={handleEvictMember}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            onDeleteGroup={handleDeleteActiveGroup}
            onClose={() => setIsGroupSettingsOpen(false)}
          />
        )}

        {isAuditModalOpen && (
          <AuditModal groupId={activeGroupId} userId={user?.id || ''} onClose={() => setIsAuditModalOpen(false)} />
        )}

        {isGroupModalOpen && (
          <CreateGroupModal newGroupName={newGroupName} setNewGroupName={setNewGroupName} onSubmit={handleCreateGroup} onJoin={joinGroupFlow} onClose={() => setIsGroupModalOpen(false)} />
        )}

        {isInstanceModalOpen && (
          <CreateInstanceModal newInstanceName={newInstanceName} setNewInstanceName={setNewInstanceName} onSubmit={handleCreateInstance} onClose={() => setIsInstanceModalOpen(false)} />
        )}

        {isSettleModalOpen && settleTarget && (
          <SettleModal settleTarget={settleTarget} onConfirm={triggerSettleTransaction} onClose={() => setIsSettleModalOpen(false)} />
        )}

        {isExpenseModalOpen && (
          <AddExpenseModal
            activeMembers={activeMembers}
            newExpense={newExpense}
            setNewExpense={setNewExpense}
            selectiveMembers={selectiveMembers}
            setSelectiveMembers={setSelectiveMembers}
            modalAttachedFile={modalAttachedFile}
            onFileChange={handleModalFileChange}
            onExactValueChange={handleExactValueChange}
            convertToGBP={convertToGBP}
            onSubmit={handleCreateExpense}
            onClose={() => setIsExpenseModalOpen(false)}
          />
        )}

        {confirmDialog && (
          <ConfirmDialog
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
            onCancel={() => setConfirmDialog(null)}
          />
        )}

      </div>
    </div>
  );
}
