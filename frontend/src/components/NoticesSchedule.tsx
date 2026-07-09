import { useEffect, useState } from 'react';
import { ArrowLeft, Megaphone, Repeat, CalendarClock, Send, Trash2, Plus } from 'lucide-react';
import type { Expense } from '../types';
import { fetchNotices, postNotice, deleteNotice, type Notice } from '../api/notices';
import { fetchSchedules, createSchedule, deleteSchedule, type Schedule } from '../api/schedules';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  groupId: string;
  userId: string;
  isAdmin: boolean;
  recurringExpenses: Expense[];
  onBack: () => void;
}

export default function NoticesSchedule({ groupId, userId, isAdmin, recurringExpenses, onBack }: Props) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(true);
  const [draft, setDraft] = useState('');
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

  useEffect(() => {
    let cancelled = false;
    setIsLoadingNotices(true);
    fetchNotices(groupId, userId)
      .then(data => { if (!cancelled) setNotices(data); })
      .catch(err => console.error("Failed to load notices:", err))
      .finally(() => { if (!cancelled) setIsLoadingNotices(false); });
    return () => { cancelled = true; };
  }, [groupId, userId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingSchedules(true);
    fetchSchedules(groupId, userId)
      .then(data => { if (!cancelled) setSchedules(data); })
      .catch(err => console.error("Failed to load schedules:", err))
      .finally(() => { if (!cancelled) setIsLoadingSchedules(false); });
    return () => { cancelled = true; };
  }, [groupId, userId]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setIsPosting(true);
    try {
      const created = await postNotice(groupId, userId, draft.trim());
      setNotices(prev => [created, ...prev]);
      setDraft('');
    } catch (err) {
      alert("Failed to post notice.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteNotice = async (expenseId: string) => {
    try {
      setNotices(prev => prev.filter(n => n.expenseId !== expenseId));
      await deleteNotice(groupId, expenseId, userId);
    } catch (err) {
      console.error("Failed to delete notice:", err);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;
    const isoDate = new Date(`${eventDate}T${eventTime || '00:00'}`).toISOString();
    try {
      const created = await createSchedule(groupId, userId, eventTitle.trim(), isoDate, eventNote.trim() || undefined);
      setSchedules(prev => [...prev, created].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()));
      setEventTitle('');
      setEventDate('');
      setEventTime('');
      setEventNote('');
      setIsAddingEvent(false);
    } catch (err) {
      alert("Failed to create schedule.");
    }
  };

  const handleDeleteSchedule = async (expenseId: string) => {
    try {
      setSchedules(prev => prev.filter(s => s.expenseId !== expenseId));
      await deleteSchedule(groupId, expenseId, userId);
    } catch (err) {
      console.error("Failed to delete schedule:", err);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[88vh]">
      <header className="p-6 flex items-center justify-between bg-white border-b border-stone-100">
        <button onClick={onBack} className="p-3 bg-stone-50 rounded-2xl text-stone-700 hover:bg-stone-100 border border-stone-200 shadow-sm flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-lg font-black text-stone-800">Notices & Schedules</h2>
        <div className="w-11" />
      </header>

      <main className="p-6 space-y-6 overflow-y-auto flex-1">
        <div>
          <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase mb-3 flex items-center gap-1.5">
            <Repeat size={14} /> Recurring Bills
          </h3>
          {recurringExpenses.length === 0 ? (
            <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">No recurring bills set up yet.</div>
          ) : (
            <div className="space-y-2.5">
              {[...recurringExpenses].sort((a, b) => (a.recurringDay ?? 1) - (b.recurringDay ?? 1)).map(exp => (
                <div key={exp.id} className="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between text-sm shadow-sm">
                  <div className="flex items-center gap-2 text-stone-700 font-bold">
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">Day {exp.recurringDay ?? 1}</span>
                    <span>{exp.title}</span>
                  </div>
                  <span className="font-black text-stone-800 text-base">£{exp.convertedAmountGBP.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase flex items-center gap-1.5">
              <CalendarClock size={14} /> Upcoming Events
            </h3>
            <button onClick={() => setIsAddingEvent(v => !v)} className="text-[10px] font-black text-emerald-700 flex items-center gap-1">
              <Plus size={12} /> Add
            </button>
          </div>

          {isAddingEvent && (
            <form onSubmit={handleAddEvent} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-2.5 mb-3">
              <input type="text" placeholder="e.g., House Party, Deep Clean, Picnic" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none" required autoFocus />
              <div className="flex gap-2">
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="flex-1 bg-white border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none" required />
                <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-32 bg-white border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none" />
              </div>
              <input type="text" placeholder="Notes (optional)" value={eventNote} onChange={(e) => setEventNote(e.target.value)} className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none" />
              <button type="submit" className="w-full bg-emerald-950 text-white font-black py-2.5 rounded-xl text-xs">Add to Schedule</button>
            </form>
          )}

          {isLoadingSchedules ? (
            <div className="p-4 text-center text-xs text-stone-400 font-bold">Loading...</div>
          ) : schedules.length === 0 ? (
            <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">No upcoming events yet.</div>
          ) : (
            <div className="space-y-2.5">
              {schedules.map(s => {
                const d = new Date(s.eventDate);
                return (
                  <div key={s.expenseId} className="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between text-sm shadow-sm">
                    <div className="flex items-center gap-2 text-stone-700 font-bold">
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 whitespace-nowrap">
                        {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}{d.getHours() || d.getMinutes() ? ` · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                      <div>
                        <div>{s.title}</div>
                        {s.note && <div className="text-[10px] text-stone-400 font-medium">{s.note}</div>}
                      </div>
                    </div>
                    <button onClick={() => setPendingDeleteSchedule(s.expenseId)} className="text-stone-300 hover:text-rose-600 transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-black tracking-wider text-stone-400 uppercase mb-3 flex items-center gap-1.5">
            <Megaphone size={14} /> Group Notices
          </h3>

          <form onSubmit={handlePost} className="space-y-2 mb-3">
            <textarea
              placeholder="Post a notice to the group..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full bg-stone-50 border rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none resize-none"
            />
            <button type="submit" disabled={isPosting} className="w-full bg-emerald-950 text-white font-black py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-60">
              <Send size={14} /> {isPosting ? 'Posting...' : 'Post Notice'}
            </button>
          </form>

          {isLoadingNotices ? (
            <div className="p-4 text-center text-xs text-stone-400 font-bold">Loading notices...</div>
          ) : notices.length === 0 ? (
            <div className="p-4 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-2xl text-sm text-stone-400 font-medium">No notices yet. Be the first to post one!</div>
          ) : (
            <div className="space-y-2.5">
              {notices.map(notice => (
                <div key={notice.expenseId} className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-stone-700">
                      {notice.postedByName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-stone-400 font-semibold">{new Date(notice.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {(notice.postedBy === userId || isAdmin) && (
                        <button onClick={() => setPendingDeleteNotice(notice.expenseId)} className="text-stone-300 hover:text-rose-600 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-stone-700 font-medium leading-relaxed whitespace-pre-wrap">{notice.text}</p>
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
