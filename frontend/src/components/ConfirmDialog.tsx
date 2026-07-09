import { AlertTriangle, X } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white w-full max-w-sm rounded-[28px] p-6 space-y-4 relative border border-stone-100 shadow-2xl">
        <button type="button" onClick={onCancel} className="absolute right-5 top-5 p-2 bg-stone-50 rounded-full text-stone-400"><X size={16} /></button>
        <div className="w-11 h-11 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="text-lg font-black text-stone-800">{title}</h3>
          <p className="text-sm text-stone-500 mt-1 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 bg-stone-100 text-stone-600 font-bold py-3 rounded-2xl text-sm">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex-1 bg-rose-600 text-white font-black py-3 rounded-2xl text-sm shadow-sm">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
