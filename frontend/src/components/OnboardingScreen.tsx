import React, { useState } from 'react';
import { Sparkles, FolderPlus, Users } from 'lucide-react';

interface Props {
  onCreateGroup: (name: string) => Promise<void>;
  onJoinGroup: (inviteCode: string) => Promise<void>;
}

export default function OnboardingScreen({ onCreateGroup, onJoinGroup }: Props) {
  const [mode, setMode] = useState<'CHOOSE' | 'CREATE' | 'JOIN'>('CHOOSE');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      await onCreateGroup(groupName.trim());
    } catch (err) {
      setError('Could not create the group. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      await onJoinGroup(inviteCode.trim());
    } catch (err: any) {
      setError(err?.message || 'Could not join with that code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] w-full p-2 sm:p-6 flex justify-center items-center font-sans antialiased text-[#2C2A29]">
      <div className="w-full max-w-md bg-white rounded-[44px] shadow-2xl border border-stone-100 overflow-hidden p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-stone-900 flex items-center justify-center gap-1.5">
            ShareSquare <Sparkles size={20} className="text-emerald-600 fill-emerald-600" />
          </h1>
          <p className="text-sm text-stone-400 font-medium">You're not part of any space yet.</p>
        </div>

        {mode === 'CHOOSE' && (
          <div className="space-y-3">
            <button onClick={() => setMode('CREATE')} className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all">
              <FolderPlus size={16} /> Create a New Space
            </button>
            <button onClick={() => setMode('JOIN')} className="w-full bg-stone-50 border border-stone-200 text-stone-800 font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              <Users size={16} /> Join with Invite Code
            </button>
          </div>
        )}

        {mode === 'CREATE' && (
          <form onSubmit={handleCreate} className="space-y-3">
            <label className="block text-[11px] font-black text-stone-400 uppercase">Space Name</label>
            <input type="text" placeholder="e.g., Flat 4" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-semibold focus:outline-none" required autoFocus />
            {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-sm disabled:opacity-60">
              {isSubmitting ? 'Creating...' : 'Create Space'}
            </button>
            <button type="button" onClick={() => setMode('CHOOSE')} className="w-full text-stone-400 font-bold text-xs py-2">Back</button>
          </form>
        )}

        {mode === 'JOIN' && (
          <form onSubmit={handleJoin} className="space-y-3">
            <label className="block text-[11px] font-black text-stone-400 uppercase">Invite Code</label>
            <input type="text" placeholder="e.g., 7XQK2M" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-black tracking-widest text-center focus:outline-none" required autoFocus maxLength={7} />
            {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-sm disabled:opacity-60">
              {isSubmitting ? 'Joining...' : 'Join Space'}
            </button>
            <button type="button" onClick={() => setMode('CHOOSE')} className="w-full text-stone-400 font-bold text-xs py-2">Back</button>
          </form>
        )}
      </div>
    </div>
  );
}
