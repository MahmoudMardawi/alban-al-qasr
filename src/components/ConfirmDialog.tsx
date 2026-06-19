"use client";

interface Props {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel = "تأكيد", destructive, onConfirm, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-cairo font-bold text-ink text-base">{title}</h3>
        {body && <p className="font-cairo text-sm text-muted mt-2">{body}</p>}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onClose}
            className="rounded-xl border border-border bg-white text-ink font-cairo font-semibold py-2.5">
            إلغاء
          </button>
          <button onClick={() => { onConfirm(); onClose(); }}
            className={`rounded-xl font-cairo font-bold py-2.5 ${destructive ? "bg-danger text-white" : "bg-primary text-white"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
