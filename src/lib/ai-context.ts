export interface ClientBalance {
  name: string;
  money_owed: number;
  replacement_debt: Array<{ product: string; units: number }>;
}

export interface RawAiData {
  periodLabel: string;
  sales: number;
  expenses: number;
  netProfit: number;
  salesByProduct: Array<{ name: string; units: number; revenue: number }>;
  topClients:     Array<{ name: string; revenue: number }>;
  returns:        Array<{ product: string; units: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  clientBalances?: ClientBalance[];
}

export interface AiContext {
  period: string;
  totals: { sales: number; expenses: number; net_profit: number };
  top_products: Array<{ name: string; units: number; revenue: number }>;
  top_clients:  Array<{ name: string; revenue: number }>;
  returns:      Array<{ product: string; units: number }>;
  expenses_by_category: Array<{ category: string; amount: number }>;
  clients_with_outstanding_balance?: ClientBalance[];
  total_outstanding_money?: number;
}

export function shapeContextForAI(raw: RawAiData): AiContext {
  const balances = raw.clientBalances ?? [];
  const withDebt = balances.filter((b) => b.money_owed > 0 || b.replacement_debt.length > 0);
  const sortedByDebt = [...withDebt].sort((a, b) => b.money_owed - a.money_owed);
  const totalOutstanding = balances.reduce((s, b) => s + (b.money_owed > 0 ? b.money_owed : 0), 0);

  return {
    period:      raw.periodLabel,
    totals:      { sales: raw.sales, expenses: raw.expenses, net_profit: raw.netProfit },
    top_products: raw.salesByProduct.slice(0, 5),
    top_clients:  raw.topClients.slice(0, 5),
    returns:      raw.returns,
    expenses_by_category: raw.expensesByCategory,
    ...(balances.length > 0 ? {
      clients_with_outstanding_balance: sortedByDebt.slice(0, 10),
      total_outstanding_money: totalOutstanding,
    } : {}),
  };
}
