"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Edit3, Trash2 } from "lucide-react";
import { approveClient, deleteClient } from "@/app/(admin)/clients/actions";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  id: string;
  name: string;
  type: string | null;
  phone: string | null;
  added_by_name: string | null;
}

export function ClientApprovalCard({ id, name, type, phone, added_by_name }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveClient(id);
      if (res.error) setError(res.error);
    });
  }

  function del() {
    setError(null);
    startTransition(async () => {
      const res = await deleteClient(id);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="bg-yellow-50/50 border border-yellow-200 rounded-xl p-3 mb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-cairo font-semibold text-ink text-sm truncate">{name}</h4>
          <p className="text-[10px] text-muted font-cairo mt-0.5">
            {type ?? "—"} · {phone ?? "بدون هاتف"} · أضافه: {added_by_name ?? "?"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2.5">
        <button onClick={approve} disabled={pending}
          className="flex-1 flex items-center justify-center gap-1 bg-primary text-white text-xs font-cairo font-semibold py-1.5 rounded-lg disabled:opacity-60">
          <Check size={12} /> موافقة
        </button>
        <Link href={`/clients/${id}`}
          className="flex items-center justify-center gap-1 bg-white border border-border text-ink text-xs font-cairo font-semibold py-1.5 px-3 rounded-lg">
          <Edit3 size={12} /> تعديل
        </Link>
        <button onClick={() => setConfirmDelete(true)} disabled={pending}
          className="flex items-center justify-center gap-1 bg-white border border-red-200 text-danger text-xs font-cairo font-semibold py-1.5 px-3 rounded-lg disabled:opacity-60">
          <Trash2 size={12} /> حذف
        </button>
      </div>
      {error && <p className="text-danger text-[11px] mt-1.5 font-cairo">{error}</p>}
      <ConfirmDialog
        open={confirmDelete}
        title={`حذف ${name}؟`}
        body="هذا الإجراء نهائي. إذا كان للزبون زيارات سابقة لن يُحذف."
        destructive confirmLabel="حذف"
        onConfirm={del} onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
