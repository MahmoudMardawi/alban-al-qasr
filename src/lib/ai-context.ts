export interface RawAiData {
  periodLabel: string;
  sales: number;
  expenses: number;
  netProfit: number;
  salesByProduct: Array<{ name: string; units: number; revenue: number }>;
  topClients:     Array<{ name: string; revenue: number }>;
  returns:        Array<{ product: string; units: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
}

export interface AiContext {
  period: string;
  totals: { sales: number; expenses: number; net_profit: number };
  top_products: Array<{ name: string; units: number; revenue: number }>;
  top_clients:  Array<{ name: string; revenue: number }>;
  returns:      Array<{ product: string; units: number }>;
  expenses_by_category: Array<{ category: string; amount: number }>;
}

export function shapeContextForAI(raw: RawAiData): AiContext {
  return {
    period:      raw.periodLabel,
    totals:      { sales: raw.sales, expenses: raw.expenses, net_profit: raw.netProfit },
    top_products: raw.salesByProduct.slice(0, 5),
    top_clients:  raw.topClients.slice(0, 5),
    returns:      raw.returns,
    expenses_by_category: raw.expensesByCategory,
  };
}
