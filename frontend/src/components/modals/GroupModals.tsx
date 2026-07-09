import React, { useState } from 'react';
import { X, Trash2, Users, Copy, Check } from 'lucide-react';
import type { AuditLog, Group, Roommate } from '../../types';

// ── Create or Join a Group ────────────────────────────────────

interface CreateGroupModalProps {
  newGroupName: string;
  setNewGroupName: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onJoin: (inviteCode: string) => Promise<void>;
  onClose: () => void;
}

export function CreateGroupModal({ newGroupName, setNewGroupName, onSubmit, onJoin, onClose }: CreateGroupModalProps) {
  const [tab, setTab] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setJoinError('');
    try {
      await onJoin(inviteCode.trim());
    } catch (err: any) {
      setJoinError(err?.message || 'Could not join with that code.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 relative border border-stone-100 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
        <h3 className="text-lg font-black text-stone-800">Add a Space</h3>

        <div className="flex gap-2 bg-stone-50 p-1 rounded-2xl border border-stone-100">
          <button type="button" onClick={() => setTab('CREATE')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${tab === 'CREATE' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}>Create New</button>
          <button type="button" onClick={() => setTab('JOIN')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${tab === 'JOIN' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}>Join Existing</button>
        </div>

        {tab === 'CREATE' ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <input type="text" placeholder="e.g., Flat 4" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-semibold focus:outline-none" required />
            <button type="submit" className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-sm">Create Space</button>
          </form>
        ) : (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <input type="text" placeholder="e.g., 7XQK2M" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-black tracking-widest text-center focus:outline-none" required maxLength={6} />
            {joinError && <p className="text-xs text-rose-600 font-semibold">{joinError}</p>}
            <button type="submit" disabled={isJoining} className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-sm disabled:opacity-60">
              {isJoining ? 'Joining...' : 'Join Space'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Create Instance ───────────────────────────────────────────

interface CreateInstanceModalProps {
  newInstanceName: string;
  setNewInstanceName: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function CreateInstanceModal({ newInstanceName, setNewInstanceName, onSubmit, onClose }: CreateInstanceModalProps) {
  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <form onSubmit={onSubmit} className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 relative border border-stone-100 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
        <h3 className="text-lg font-black text-stone-800">Create Event Sub-Ledger</h3>
        <input type="text" placeholder="e.g., Roadtrip Gas" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} className="w-full bg-stone-50 border rounded-2xl px-4 py-3.5 text-base font-semibold focus:outline-none" required />
        <button type="submit" className="w-full bg-emerald-950 text-white font-black py-4 rounded-2xl text-sm shadow-sm">Instantiate Event</button>
      </form>
    </div>
  );
}

// ── Group Settings ────────────────────────────────────────────

interface GroupSettingsModalProps {
  activeGroup: Group;
  roommates: Roommate[];
  editGroupName: string;
  setEditGroupName: (v: string) => void;
  onUpdateGroupName: (e: React.FormEvent) => void;
  onEvictMember: (clerkId: string, name: string) => void;
  isAdmin: boolean;
  currentUserId: string | undefined;
  onDeleteGroup: () => void;
  onClose: () => void;
}

export function GroupSettingsModal({
  activeGroup, roommates, editGroupName, setEditGroupName, onUpdateGroupName,
  onEvictMember, isAdmin, currentUserId, onDeleteGroup, onClose
}: GroupSettingsModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = () => {
    if (!activeGroup.inviteCode) return;
    navigator.clipboard.writeText(activeGroup.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-5 max-h-[85vh] overflow-y-auto relative border border-stone-100 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
        <div><h3 className="text-xl font-black text-stone-800">Group Control Center</h3><p className="text-xs text-stone-400 mt-0.5">Configure space parameters</p></div>

        <form onSubmit={onUpdateGroupName} className="space-y-2 pt-1">
          <label className="block text-[11px] font-black text-stone-400 uppercase">Change Space Name</label>
          <div className="flex gap-2">
            <input type="text" placeholder={activeGroup.name} value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} className="flex-1 bg-stone-50 border rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none" />
            <button type="submit" className="bg-stone-900 text-white font-bold px-4 rounded-xl text-xs">Update</button>
          </div>
        </form>

        <div className="space-y-2 border-t border-stone-100 pt-3">
          <label className="block text-[11px] font-black text-stone-400 uppercase">Invite Code</label>
          <div className="flex items-center justify-between bg-stone-50 border rounded-2xl px-4 py-3.5">
            <span className="font-black tracking-widest text-lg text-stone-800">{activeGroup.inviteCode || '——————'}</span>
            <button type="button" onClick={handleCopyInvite} className="text-stone-500 hover:text-emerald-700 p-2 rounded-xl hover:bg-emerald-50 transition-colors">
              {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-stone-400">Share this code so roommates can join this space themselves.</p>
        </div>

        <div className="space-y-2 border-t border-stone-100 pt-3">
          <label className="block text-[11px] font-black text-stone-400 uppercase flex items-center gap-1">
            <Users size={12} /> Current Space Members
          </label>
          <div className="space-y-2">
            {roommates.map(m => (
              <div key={m.clerkId} className="p-3 bg-stone-50 rounded-2xl border flex items-center justify-between text-xs font-bold text-stone-700">
                <div className="flex items-center gap-2">
                  <span>{m.avatar || '👤'}</span>
                  <span>{m.name}</span>
                  {m.clerkId === currentUserId && <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md font-black uppercase">You</span>}
                </div>
                {m.clerkId !== currentUserId && isAdmin && (
                  <button
                    type="button"
                    onClick={() => onEvictMember(m.clerkId!, m.name)}
                    className="text-stone-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="border-t border-stone-100 pt-3">
            <button type="button" onClick={onDeleteGroup} className="w-full bg-rose-50 border border-rose-100 text-rose-700 font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-1"><Trash2 size={14} /> Purge Entire Group Workspace</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Audit Trail ───────────────────────────────────────────────

interface AuditModalProps {
  auditLogs: AuditLog[];
  activeGroupId: string;
  onClose: () => void;
}

export function AuditModal({ auditLogs, activeGroupId, onClose }: AuditModalProps) {
  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] p-6 space-y-4 max-h-[85vh] overflow-y-auto relative border border-stone-100 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
        <div><h3 className="text-lg font-black text-stone-800">System Audit Trails</h3><p className="text-xs text-stone-400 mt-0.5">Chronological trace logs</p></div>
        <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-2 font-mono text-[11px] text-stone-300 shadow-inner max-h-[40vh] overflow-y-auto">
          {auditLogs.filter(log => log.groupId === activeGroupId).map(log => (
            <div key={log.id} className="border-b border-stone-800 pb-2 last:border-0 last:pb-0 leading-relaxed">
              <span className="text-purple-400 font-bold">[{log.timestamp}]</span> <span className="text-emerald-400 uppercase font-black">{log.action}:</span> {log.details}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
