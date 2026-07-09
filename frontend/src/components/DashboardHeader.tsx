import { Sparkles, FolderPlus, Settings, Layers } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import type { Group } from '../types';

interface Props {
  groups: Group[];
  activeGroupId: string;
  activeGroup: Group;
  activeInstanceId: string;
  onSelectGroup: (groupId: string, firstInstanceId: string) => void;
  onSelectInstance: (instanceId: string) => void;
  onOpenGroupModal: () => void;
  onOpenGroupSettings: () => void;
  onOpenInstanceModal: () => void;
}

export default function DashboardHeader({
  groups, activeGroupId, activeGroup, activeInstanceId,
  onSelectGroup, onSelectInstance, onOpenGroupModal, onOpenGroupSettings, onOpenInstanceModal
}: Props) {
  return (
    <>
      <header className="p-6 pb-4 flex justify-between items-center bg-white border-b border-stone-50">
        <h1 className="text-2xl font-black tracking-tight text-stone-900 flex items-center gap-1.5">
          ShareSquare <Sparkles size={20} className="text-emerald-600 fill-emerald-600" />
        </h1>
        <div className="flex gap-2 items-center">
          <button onClick={onOpenGroupModal} className="p-3.5 bg-stone-50 text-stone-700 rounded-2xl border border-stone-100 shadow-sm flex items-center justify-center"><FolderPlus size={18} /></button>
          <button onClick={onOpenGroupSettings} className="p-3.5 bg-stone-50 text-stone-700 rounded-2xl border border-stone-100 shadow-sm flex items-center justify-center"><Settings size={18} /></button>
          <div className="ml-1 flex items-center justify-center scale-110">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <div className="px-6 py-4 bg-stone-50/70 border-b border-stone-100 overflow-x-auto flex gap-3 scrollbar-none">
        {groups.map(g => (
          <button key={g.id} onClick={() => onSelectGroup(g.id, g.instances[0]?.id || '')} className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black tracking-tight transition-all shadow-sm shrink-0 ${g.id === activeGroupId ? 'bg-emerald-950 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>
            <span className="text-xl">{g.icon}</span><span>{g.name}</span>
          </button>
        ))}
      </div>

      <div className="px-6 py-3 bg-white border-b border-stone-100 flex items-center gap-2">
        <Layers size={14} className="text-stone-400 shrink-0" />
        <div className="flex gap-2 overflow-x-auto scrollbar-none items-center">
          {activeGroup.instances?.map(inst => (
            <button key={inst.id} onClick={() => onSelectInstance(inst.id)} className={`text-xs font-black px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all ${inst.id === activeInstanceId ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-stone-50/60 border-stone-100 text-stone-500'}`}>
              {inst.name}
            </button>
          ))}
          <button onClick={onOpenInstanceModal} className="text-xs font-black text-emerald-700 px-2 py-1 whitespace-nowrap">+ New Event</button>
        </div>
      </div>
    </>
  );
}
