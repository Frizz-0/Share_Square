import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Megaphone,
  Repeat,
  CalendarClock,
  Send,
  Trash2,
  Plus,
  Bell,
  BellRing,
  ThumbsUp,
  Hand,
  AlertTriangle,
  Clock
} from 'lucide-react';
import type { Expense } from '../types';
import {
  fetchNotices,
  postNotice,
  deleteNotice,
  toggleNoticeAck,
  type Notice,
  type NoticeCategory
} from '../api/notices';
import { fetchSchedules, createSchedule, deleteSchedule, type Schedule } from '../api/schedules';
import { formatEventCountdown } from '../utils/countdown';
import { subscribeDeviceToHousePush } from '../utils/pushNotifications';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  groupId: string;
  userId: string;
  currentUserName?: string;
  isAdmin: boolean;
  recurringExpenses: Expense[];
  onBack: () => void;
}

const CATEGORY_META: Record<NoticeCategory, { label: string; emoji: string; badgeClass: string }> = {
  ANNOUNCEMENT: {
    label: 'Announcement',
    emoji: '📢',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200'
  },
  TASK: {
    label: 'Quick Task',
    emoji: '🛒',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  URGENT: {
    label: 'Urgent',
    emoji: '🚨',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
  }
};

export default function NoticesSchedule({
  groupId,
  userId,
  currentUserName = 'You',
  isAdmin,
  recurringExpenses,
  onBack
}: Props) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(true);
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('ANNOUNCEMENT');
  const [isPosting, setIsPosting] = useState(false);
  const [pendingDeleteNotice, setPendingDeleteNotice] = useState<string | null>(null);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [pendingDeleteSchedule, setPendingDeleteSchedule] = useState<string | null>(null);

  // Live 1-second clock for event countdown timers
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Browser push notification state & diagnostic feedback
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const handleEnableNotifications = async () => {
    setPushStatus('Registering device for house alerts...');
    const result = await subscribeDeviceToHousePush(groupId, userId);
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    setPushStatus(result.reason);
  };

  // Mark notices as read whenever this tab is opened or updated
  const markNoticesRead = () => {
    try {
      localStorage.setItem(`sharesquare_notices_seen_${groupId}`, new Date().toISOString());
    } catch {
      // ignore storage quota errors
    }
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoadingNotices(true);
    fetchNotices(groupId, userId)
      .then(data => {
        if (!cancelled) {
          setNotices(data);
          markNoticesRead();
        }
      })
      .catch(err => console.error('Failed to load notices:', err))
      .finally(() => {
        if (!cancelled) setIsLoadingNotices(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, userId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingSchedules(true);
    fetchSchedules(groupId, userId)
      .then(data => {
        if (!cancelled) setSchedules(data);
      })
      .catch(err => console.error('Failed to load schedules:', err))
      .finally(() => {
        if (!cancelled) setIsLoadingSchedules(false);
      });
    return () => { cancelled = true; };
  }, [groupId, userId]);

  // Pin URGENT notices to top while preserving chronological order
  const sortedNotices = useMemo(() => {
    return [...notices].sort((a, b) => {
      const aUrgent = a.category === 'URGENT' ? 1 : 0;
      const bUrgent = b.category === 'URGENT' ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [notices]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setIsPosting(true);
    try {
      const created = await postNotice(groupId, userId, draft.trim(), category);
      setNotices(prev => [created, ...prev]);
      setDraft('');
      setCategory('ANNOUNCEMENT');
      markNoticesRead();

      if (notifPermission === 'granted' && category === 'URGENT') {
        new Notification('🚨 Urgent House Notice Posted', {
          body: `${created.postedByName}: ${created.text}`
        });
      }
    } catch {
      alert('Failed to post notice.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleToggleAck = async (notice: Notice) => {
    const actor = currentUserName || 'You';
    const currentAcks = notice.acks || [];
    const optimisticAcks = currentAcks.includes(actor)
      ? currentAcks.filter(a => a !== actor)
      : [...currentAcks, actor];

    setNotices(prev =>
      prev.map(n => (n.expenseId === notice.expenseId ? { ...n, acks: optimisticAcks } : n))
    );

    try {
      const updated = await toggleNoticeAck(groupId, notice.expenseId, userId, actor);
      setNotices(prev =>
        prev.map(n => (n.expenseId === notice.expenseId ? updated : n))
      );
    } catch (err) {
      console.error('Failed to toggle acknowledgement:', err);
    }
  };

  const handleDeleteNotice = async (expenseId: string) => {
    try {
      setNotices(prev => prev.filter(n => n.expenseId !== expenseId));
      await deleteNotice(groupId, expenseId, userId);
    } catch (err) {
      console.error('Failed to delete notice:', err);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;
    const isoDate = new Date(`${eventDate}T${eventTime || '00:00'}`).toISOString();
    try {
      const created = await createSchedule(groupId, userId, eventTitle.trim(), isoDate, eventNote.trim() || undefined);
      setSchedules(prev =>
        [...prev, created].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      );
      setEventTitle('');
      setEventDate('');
      setEventTime('');
      setEventNote('');
      setIsAddingEvent(false);

      if (notifPermission === 'granted') {
        new Notification('📅 New House Event Scheduled', {
          body: `${created.title} — ${new Date(created.eventDate).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}`
        });
      }
    } catch {
      alert('Failed to create schedule.');
    }
  };

  const handleDeleteSchedule = async (expenseId: string) => {
    try {
      setSchedules(prev => prev.filter(s => s.expenseId !== expenseId));
      await deleteSchedule(groupId, expenseId, userId);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[88vh]">
      <header className="p-6 flex items-center justify-between bg-white border-b border-stone-100">
        <button
          onClick={onBack}
          className="p-3 bg-stone-50 rounded-2xl text-stone-700 hover:bg-stone-100 border border-stone-200 shadow-sm flex items-center justify-center"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-lg font-black text-stone-800">House Hub</h2>

        {notifPermission !== 'unsupported' ? (
          <button
            type="button"
            onClick={handleEnableNotifications}
            title={notifPermission === 'granted' ? 'Alerts active — tap to sync device' : 'Enable house alerts'}
            className={`p-3 rounded-2xl border shadow-sm flex items-center justify-center transition-colors ${notifPermission === 'granted'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
          >
            {notifPermission === 'granted' ? <BellRing size={17} /> : <Bell size={17} />}
          </button>
        ) : (
          <div className="w-11" />
        )}
      </header>

      <main className="p-6 space-y-6 overflow-y-auto flex-1">
        {pushStatus && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
            {pushStatus}
          </div>
        )}

        {/* 1. Group Communication & Quick Tasks */}
        <div>
          <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase mb-3 flex items-center gap-1.5">
            <Megaphone size={14} /> House Feed & Pings
          </h3>

          <form onSubmit={handlePost} className="p-3.5 bg-stone-50 border border-stone-200/70 rounded-2xl space-y-2.5 mb-3">
            {/* Category Selector Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {(Object.keys(CATEGORY_META) as NoticeCategory[]).map(cat => {
                const meta = CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all whitespace-nowrap flex items-center gap-1 ${active
                      ? 'bg-emerald-950 text-white border-emerald-950 shadow-sm'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              placeholder={
                category === 'TASK'
                  ? 'e.g., Out of bin bags & dish soap — anyone heading to Tesco?'
                  : category === 'URGENT'
                    ? 'e.g., Boiler maintenance tomorrow at 9 AM!'
                    : 'Share an update with your flatmates...'
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="w-full bg-white border border-stone-200/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none resize-none"
            />
            <button
              type="submit"
              disabled={isPosting || !draft.trim()}
              className="w-full bg-emerald-950 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Send size={13} /> {isPosting ? 'Sending...' : `Send ${CATEGORY_META[category].label}`}
            </button>
          </form>

          {isLoadingNotices ? (
            <div className="p-4 text-center text-xs text-stone-400 font-bold">Loading messages...</div>
          ) : sortedNotices.length === 0 ? (
            <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">
              No messages yet. Post an update or quick task!
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedNotices.map(notice => {
                const cat: NoticeCategory = notice.category || 'ANNOUNCEMENT';
                const meta = CATEGORY_META[cat];
                const acks = notice.acks || [];
                const hasAcked = acks.includes(currentUserName);

                return (
                  <div
                    key={notice.expenseId}
                    className={`p-4 bg-white border rounded-2xl shadow-sm space-y-2.5 ${cat === 'URGENT' ? 'border-rose-300 ring-1 ring-rose-100' : 'border-stone-200'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0 flex items-center gap-1 ${meta.badgeClass}`}>
                          {cat === 'URGENT' && <AlertTriangle size={10} />}
                          {meta.emoji} {meta.label}
                        </span>
                        <span className="text-xs font-black text-stone-700 truncate">{notice.postedByName}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-stone-400 font-semibold">
                          {new Date(notice.date).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {(notice.postedBy === userId || isAdmin) && (
                          <button
                            onClick={() => setPendingDeleteNotice(notice.expenseId)}
                            className="text-stone-300 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-stone-800 font-medium leading-relaxed whitespace-pre-wrap">
                      {notice.text}
                    </p>

                    {/* 1-Tap Acknowledgement / Task Claim Footer */}
                    <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAck(notice)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-black border flex items-center gap-1.5 transition-all active:scale-95 ${hasAcked
                          ? 'bg-emerald-950 text-white border-emerald-950'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                      >
                        {cat === 'TASK' ? <Hand size={11} /> : <ThumbsUp size={11} />}
                        <span>{cat === 'TASK' ? (hasAcked ? 'Claimed' : "I'll grab it") : 'Got it'}</span>
                      </button>

                      {acks.length > 0 && (
                        <span className="text-[10px] font-semibold text-stone-400 truncate">
                          {cat === 'TASK' ? 'On it: ' : 'Seen by '}
                          <strong className="text-stone-600">{acks.join(', ')}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Upcoming Events with Live Countdown Timers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase flex items-center gap-1.5">
              <CalendarClock size={14} /> Upcoming Events & Countdowns
            </h3>
            <button onClick={() => setIsAddingEvent(v => !v)} className="text-[10px] font-black text-emerald-700 flex items-center gap-1">
              <Plus size={12} /> Add Event
            </button>
          </div>

          {isAddingEvent && (
            <form onSubmit={handleAddEvent} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-2.5 mb-3">
              <input
                type="text"
                placeholder="e.g., House Dinner, Landlord Visit, Bin Day"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none"
                required
                autoFocus
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="flex-1 bg-white border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none"
                  required
                />
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-32 bg-white border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none"
                />
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={eventNote}
                onChange={(e) => setEventNote(e.target.value)}
                className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none"
              />
              <button type="submit" className="w-full bg-emerald-950 text-white font-black py-2.5 rounded-xl text-xs">
                Start Event Countdown
              </button>
            </form>
          )}

          {isLoadingSchedules ? (
            <div className="p-4 text-center text-xs text-stone-400 font-bold">Loading...</div>
          ) : schedules.length === 0 ? (
            <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">
              No upcoming events yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {schedules.map(s => {
                const d = new Date(s.eventDate);
                const countdown = formatEventCountdown(s.eventDate, nowMs);

                const timerBadgeStyle =
                  countdown.urgency === 'LIVE'
                    ? 'bg-emerald-600 text-white border-emerald-600 animate-pulse'
                    : countdown.urgency === 'SOON'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : countdown.urgency === 'PAST'
                        ? 'bg-stone-100 text-stone-400 border-stone-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200';

                return (
                  <div key={s.expenseId} className="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between gap-3 text-sm shadow-sm">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black text-stone-600 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200 whitespace-nowrap">
                          {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          {d.getHours() || d.getMinutes() ? ` · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                        {countdown.label && (
                          <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-lg border whitespace-nowrap flex items-center gap-1 ${timerBadgeStyle}`}>
                            <Clock size={10} /> {countdown.label}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-stone-800 truncate">{s.title}</div>
                      {s.note && <div className="text-[11px] text-stone-400 font-medium">{s.note}</div>}
                    </div>
                    <button
                      onClick={() => setPendingDeleteSchedule(s.expenseId)}
                      className="text-stone-300 hover:text-rose-600 transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Recurring Bills */}
        <div>
          <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase mb-3 flex items-center gap-1.5">
            <Repeat size={14} /> Recurring Bills
          </h3>
          {recurringExpenses.length === 0 ? (
            <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">
              No recurring bills set up yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {[...recurringExpenses]
                .sort((a, b) => (a.recurringDay ?? 1) - (b.recurringDay ?? 1))
                .map(exp => (
                  <div key={exp.id} className="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between text-sm shadow-sm">
                    <div className="flex items-center gap-2 text-stone-700 font-bold">
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                        Day {exp.recurringDay ?? 1}
                      </span>
                      <span>{exp.title}</span>
                    </div>
                    <span className="font-black text-stone-800 text-base">£{exp.convertedAmountGBP.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </main>

      {pendingDeleteNotice && (
        <ConfirmDialog
          title="Delete this notice?"
          message="This will remove the notice for everyone in the group."
          onConfirm={() => { handleDeleteNotice(pendingDeleteNotice); setPendingDeleteNotice(null); }}
          onCancel={() => setPendingDeleteNotice(null)}
        />
      )}

      {pendingDeleteSchedule && (
        <ConfirmDialog
          title="Delete this event?"
          message="This will remove the scheduled event for everyone in the group."
          onConfirm={() => { handleDeleteSchedule(pendingDeleteSchedule); setPendingDeleteSchedule(null); }}
          onCancel={() => setPendingDeleteSchedule(null)}
        />
      )}
    </div>
  );
}