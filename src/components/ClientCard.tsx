import Link from "next/link";
import { BalanceBadges, type BalanceData } from "./BalanceBadges";

export interface ClientCardData {
  id: string;
  name: string;
  type: "supermarket" | "market" | "individual" | null;
  balance: BalanceData;
  is_approved: boolean;
}

export function ClientCard({ client }: { client: ClientCardData }) {
  const initial = (client.name?.[0] ?? "؟").trim();
  return (
    <Link
      href={`/client/${client.id}`}
      className="flex items-center gap-3 bg-white border border-border rounded-2xl p-3 mb-2 shadow-sm hover:bg-info-bg/40 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-info-bg text-primary-dk flex items-center justify-center font-cairo font-bold text-base shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-cairo font-semibold text-ink text-sm truncate">{client.name}</h3>
          {!client.is_approved && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200 font-cairo">
              بانتظار الموافقة
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <BalanceBadges data={client.balance} />
        </div>
      </div>
    </Link>
  );
}
