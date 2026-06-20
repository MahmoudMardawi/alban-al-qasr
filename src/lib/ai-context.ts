export interface ProductSummary {
  name: string;
  units: number;
  revenue: number;
}

export interface ReturnEntry {
  product: string;
  units: number;
}

export interface ExpenseCategoryEntry {
  category: string;
  amount: number;
}

export interface ClientBalance {
  name: string;
  money_owed: number;
  replacement_debt: Array<{ product: string; units: number }>;
}

export interface ProductCatalogEntry {
  name: string;
  base_unit: string;
  base_price: number;
  base_cost: number | null;
  packages: Array<{ name: string; price: number; contains_qty: number }>;
}

export interface MonthBucket {
  month: string;                                  // "YYYY-MM"
  sales: number;
  expenses: number;
  waste_cost: number;
  payments_received: number;
  net_profit: number;
  top_products: ProductSummary[];                 // top 5 by revenue
  returns: ReturnEntry[];
  expenses_by_category: ExpenseCategoryEntry[];
}

export interface RawAiData {
  periodLabel: string;
  today: string;                                  // ISO date string YYYY-MM-DD
  yearTotals: {
    sales: number;
    expenses: number;
    waste_cost: number;
    payments_received: number;
    net_profit: number;
  };
  topProductsYear: ProductSummary[];
  topClientsYear: Array<{ name: string; revenue: number }>;
  returnsYear: ReturnEntry[];
  expensesByCategoryYear: ExpenseCategoryEntry[];
  monthlyHistory: MonthBucket[];
  clientBalances?: ClientBalance[];
  replacementDebtByProduct?: ReturnEntry[];       // aggregate across all clients
  productsCatalog?: ProductCatalogEntry[];
  activeClientsCount?: number;
}

export interface AiContext {
  period: string;
  today: string;
  year_totals: {
    sales: number;
    expenses: number;
    waste_cost: number;
    payments_received: number;
    net_profit: number;
  };
  top_products_year: ProductSummary[];
  top_clients_year: Array<{ name: string; revenue: number }>;
  returns_year: ReturnEntry[];
  expenses_by_category_year: ExpenseCategoryEntry[];
  monthly_breakdown: MonthBucket[];
  clients_with_outstanding_balance?: ClientBalance[];
  total_outstanding_money?: number;
  total_replacement_debt_by_product?: ReturnEntry[];
  products_catalog?: ProductCatalogEntry[];
  active_clients_count?: number;
}

export function shapeContextForAI(raw: RawAiData): AiContext {
  const balances = raw.clientBalances ?? [];
  const withDebt = balances.filter((b) => b.money_owed > 0 || b.replacement_debt.length > 0);
  const sortedByDebt = [...withDebt].sort((a, b) => b.money_owed - a.money_owed);
  const totalOutstanding = balances.reduce((s, b) => s + (b.money_owed > 0 ? b.money_owed : 0), 0);

  return {
    period: raw.periodLabel,
    today: raw.today,
    year_totals: raw.yearTotals,
    top_products_year: raw.topProductsYear.slice(0, 10),
    top_clients_year:  raw.topClientsYear.slice(0, 10),
    returns_year: raw.returnsYear,
    expenses_by_category_year: raw.expensesByCategoryYear,
    monthly_breakdown: raw.monthlyHistory,
    ...(balances.length > 0 ? {
      clients_with_outstanding_balance: sortedByDebt.slice(0, 15),
      total_outstanding_money: totalOutstanding,
    } : {}),
    ...(raw.replacementDebtByProduct && raw.replacementDebtByProduct.length > 0 ? {
      total_replacement_debt_by_product: raw.replacementDebtByProduct,
    } : {}),
    ...(raw.productsCatalog && raw.productsCatalog.length > 0 ? {
      products_catalog: raw.productsCatalog,
    } : {}),
    ...(typeof raw.activeClientsCount === "number" ? {
      active_clients_count: raw.activeClientsCount,
    } : {}),
  };
}
