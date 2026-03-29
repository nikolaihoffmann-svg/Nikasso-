import type {
  AppBackup,
  Customer,
  InventoryItem,
  ItemCategory,
  ItemUnit,
  Payment,
  PurchaseDraft,
  PurchaseLine,
  PurchaseRecord,
  SaleDraft,
  SaleLine,
  SaleRecord,
} from "../types";

const ITEMS_KEY = "nikasso_items_v2";
const CUSTOMERS_KEY = "nikasso_customers_v2";
const SALES_KEY = "nikasso_sales_v2";
const PURCHASES_KEY = "nikasso_purchases_v2";
const SALDO_KEY = "nikasso_saldo_v2";
const THEME_KEY = "nikasso_theme_v2";

function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function clampNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtKr(n: number): string {
  return `${round2(n).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr`;
}

export function getTheme(): "dark" | "light" {
  const theme = localStorage.getItem(THEME_KEY);
  return theme === "light" ? "light" : "dark";
}

export function setTheme(theme: "dark" | "light"): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function getSaldo(): number {
  return clampNumber(localStorage.getItem(SALDO_KEY), 0);
}

export function setSaldo(value: number): void {
  localStorage.setItem(SALDO_KEY, String(round2(value)));
}

export function getItems(): InventoryItem[] {
  return readJson<InventoryItem[]>(ITEMS_KEY, [])
    .filter((x) => x.isActive !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
}

export function getCustomers(): Customer[] {
  return readJson<Customer[]>(CUSTOMERS_KEY, []).sort((a, b) =>
    a.name.localeCompare(b.name, "no")
  );
}

export function getSales(): SaleRecord[] {
  return readJson<SaleRecord[]>(SALES_KEY, []).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export function getPurchases(): PurchaseRecord[] {
  return readJson<PurchaseRecord[]>(PURCHASES_KEY, []).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export type CreateItemInput = {
  name: string;
  sku?: string;
  category?: ItemCategory;
  unit?: ItemUnit;
  salePrice?: number;
  costPrice?: number;
  stock?: number;
  minStock?: number;
  note?: string;
};

export function createItem(input: CreateItemInput): InventoryItem {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("Varen må ha navn");
  }

  const existing = items.find(
    (x) => x.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (existing) return existing;

  const item: InventoryItem = {
    id: uid("item"),
    name: trimmedName,
    sku: input.sku?.trim() || undefined,
    category: input.category ?? "Annet",
    unit: input.unit ?? "stk",
    salePrice: round2(clampNumber(input.salePrice, 0)),
    costPrice: round2(clampNumber(input.costPrice, 0)),
    stock: clampNumber(input.stock, 0),
    minStock: clampNumber(input.minStock, 0),
    note: input.note?.trim() || undefined,
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  items.push(item);
  writeJson(ITEMS_KEY, items);
  return item;
}

export function updateItem(itemId: string, patch: Partial<InventoryItem>): InventoryItem {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);
  const index = items.findIndex((x) => x.id === itemId);
  if (index === -1) {
    throw new Error("Fant ikke varen");
  }

  const current = items[index];
  const updated: InventoryItem = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };

  items[index] = updated;
  writeJson(ITEMS_KEY, items);
  return updated;
}

export type CreateCustomerInput = {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
};

export function createCustomer(input: CreateCustomerInput): Customer {
  const customers = readJson<Customer[]>(CUSTOMERS_KEY, []);
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("Kunden må ha navn");
  }

  const existing = customers.find(
    (x) => x.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (existing) return existing;

  const customer: Customer = {
    id: uid("cust"),
    name: trimmedName,
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    note: input.note?.trim() || undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  customers.push(customer);
  writeJson(CUSTOMERS_KEY, customers);
  return customer;
}

export function createEmptySale(): SaleDraft {
  return {
    id: uid("sale"),
    customerId: undefined,
    customerName: "",
    note: "",
    lines: [makeSaleLine()],
    createdAt: nowIso(),
  };
}

export function createEmptyPurchase(): PurchaseDraft {
  return {
    id: uid("purchase"),
    supplier: "",
    status: "betalt",
    dueDate: "",
    note: "",
    updateCostMode: "weighted_average",
    lines: [makePurchaseLine()],
    createdAt: nowIso(),
  };
}

export function makeSaleLine(): SaleLine {
  return {
    id: uid("sline"),
    itemId: undefined,
    itemName: "",
    qty: 1,
    unitPrice: 0,
    unitCost: 0,
    lineTotal: 0,
  };
}

export function makePurchaseLine(): PurchaseLine {
  return {
    id: uid("pline"),
    kind: "varekjop",
    itemId: undefined,
    itemName: "",
    qty: 1,
    unitCost: 0,
    lineTotal: 0,
  };
}

function calcWeightedAverage(
  currentStock: number,
  currentCost: number,
  incomingQty: number,
  incomingUnitCost: number
): number {
  const totalQty = currentStock + incomingQty;
  if (totalQty <= 0) return round2(incomingUnitCost);
  const totalValue = currentStock * currentCost + incomingQty * incomingUnitCost;
  return round2(totalValue / totalQty);
}

export function savePurchase(draft: PurchaseDraft): PurchaseRecord {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);
  const purchases = readJson<PurchaseRecord[]>(PURCHASES_KEY, []);

  const total = round2(
    draft.lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0)
  );

  for (const line of draft.lines) {
    if (line.kind !== "varekjop") continue;
    if (!line.itemId) continue;

    const index = items.findIndex((x) => x.id === line.itemId);
    if (index === -1) continue;

    const current = items[index];
    const qty = clampNumber(line.qty, 0);
    const unitCost = round2(clampNumber(line.unitCost, 0));

    let nextCost = current.costPrice;
    if (draft.updateCostMode === "weighted_average") {
      nextCost = calcWeightedAverage(current.stock, current.costPrice, qty, unitCost);
    } else if (draft.updateCostMode === "last_price") {
      nextCost = unitCost;
    }

    items[index] = {
      ...current,
      stock: current.stock + qty,
      costPrice: draft.updateCostMode === "no_change" ? current.costPrice : nextCost,
      updatedAt: nowIso(),
    };
  }

  const record: PurchaseRecord = {
    ...draft,
    total,
  };

  writeJson(ITEMS_KEY, items);
  purchases.unshift(record);
  writeJson(PURCHASES_KEY, purchases);

  return record;
}

export function saveSale(
  draft: SaleDraft,
  options?: {
    paymentAmount?: number;
    paymentNote?: string;
  }
): SaleRecord {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);
  const sales = readJson<SaleRecord[]>(SALES_KEY, []);

  const total = round2(
    draft.lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0)
  );

  const payments: Payment[] = [];
  const paymentAmount = round2(clampNumber(options?.paymentAmount, 0));
  if (paymentAmount > 0) {
    payments.push({
      id: uid("pay"),
      amount: paymentAmount,
      createdAt: nowIso(),
      note: options?.paymentNote?.trim() || undefined,
    });
  }

  for (const line of draft.lines) {
    if (!line.itemId) continue;
    const index = items.findIndex((x) => x.id === line.itemId);
    if (index === -1) continue;

    const current = items[index];
    items[index] = {
      ...current,
      stock: Math.max(0, current.stock - clampNumber(line.qty, 0)),
      updatedAt: nowIso(),
    };
  }

  const paid = paymentAmount >= total && total > 0;

  const record: SaleRecord = {
    id: draft.id,
    customerId: draft.customerId,
    customerName: draft.customerName,
    note: draft.note,
    lines: draft.lines,
    total,
    payments,
    paid,
    createdAt: draft.createdAt,
  };

  writeJson(ITEMS_KEY, items);
  sales.unshift(record);
  writeJson(SALES_KEY, sales);

  return record;
}

export function addPaymentToSale(saleId: string, amount: number, note?: string): SaleRecord {
  const sales = readJson<SaleRecord[]>(SALES_KEY, []);
  const index = sales.findIndex((x) => x.id === saleId);
  if (index === -1) {
    throw new Error("Fant ikke salget");
  }

  const sale = sales[index];
  const payment: Payment = {
    id: uid("pay"),
    amount: round2(clampNumber(amount, 0)),
    createdAt: nowIso(),
    note: note?.trim() || undefined,
  };

  const updated: SaleRecord = {
    ...sale,
    payments: [...sale.payments, payment],
    paid: salePaidSum({
      ...sale,
      payments: [...sale.payments, payment],
    }) >= sale.total,
  };

  sales[index] = updated;
  writeJson(SALES_KEY, sales);
  return updated;
}

export function salePaidSum(sale: SaleRecord): number {
  return round2(sale.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
}

export function saleRemaining(sale: SaleRecord): number {
  return Math.max(0, round2(sale.total - salePaidSum(sale)));
}

export function saleProfit(sale: SaleRecord): number {
  const cost = sale.lines.reduce(
    (sum, line) => sum + Number(line.qty || 0) * Number(line.unitCost || 0),
    0
  );
  return round2(sale.total - cost);
}

export function lowStockItems(): InventoryItem[] {
  return getItems().filter((item) => item.stock <= item.minStock);
}

export function customerSales(customerId: string): SaleRecord[] {
  return getSales().filter((sale) => sale.customerId === customerId);
}

export function customerTotalBought(customerId: string): number {
  return round2(customerSales(customerId).reduce((sum, sale) => sum + sale.total, 0));
}

export function customerTotalRemaining(customerId: string): number {
  return round2(customerSales(customerId).reduce((sum, sale) => sum + saleRemaining(sale), 0));
}

export function exportAllData(): AppBackup {
  return {
    version: 2,
    exportedAt: nowIso(),
    theme: getTheme(),
    saldo: getSaldo(),
    items: getItems(),
    customers: getCustomers(),
    sales: getSales(),
    purchases: getPurchases(),
  };
}

export function downloadBackup(): void {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nikasso-plus-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function clearAllData(): void {
  localStorage.removeItem(ITEMS_KEY);
  localStorage.removeItem(CUSTOMERS_KEY);
  localStorage.removeItem(SALES_KEY);
  localStorage.removeItem(PURCHASES_KEY);
  localStorage.removeItem(SALDO_KEY);
}

export function importBackupObject(input: unknown): void {
  const data = input as Partial<AppBackup> & {
    items?: Array<{
      id: string;
      name: string;
      price?: number;
      salePrice?: number;
      cost?: number;
      costPrice?: number;
      stock?: number;
      minStock?: number;
      createdAt?: string;
      updatedAt?: string;
    }>;
  };

  const mappedItems: InventoryItem[] = Array.isArray(data.items)
    ? data.items.map((item) => ({
        id: item.id ?? uid("item"),
        name: item.name ?? "Uten navn",
        sku: undefined,
        category: "Annet",
        unit: "stk",
        salePrice: round2(clampNumber(item.salePrice ?? item.price, 0)),
        costPrice: round2(clampNumber(item.costPrice ?? item.cost, 0)),
        stock: clampNumber(item.stock, 0),
        minStock: clampNumber(item.minStock, 0),
        note: undefined,
        isActive: true,
        createdAt: item.createdAt ?? nowIso(),
        updatedAt: item.updatedAt ?? nowIso(),
      }))
    : [];

  const mappedCustomers: Customer[] = Array.isArray(data.customers)
    ? data.customers.map((customer: Customer) => ({
        ...customer,
        createdAt: customer.createdAt ?? nowIso(),
        updatedAt: customer.updatedAt ?? nowIso(),
      }))
    : [];

  const mappedSales: SaleRecord[] = Array.isArray(data.sales)
    ? data.sales.map((sale) => {
        const lines: SaleLine[] = Array.isArray(sale.lines)
          ? sale.lines.map((line) => ({
              id: line.id ?? uid("sline"),
              itemId: line.itemId,
              itemName: line.itemName,
              qty: clampNumber(line.qty, 0),
              unitPrice: round2(clampNumber(line.unitPrice, 0)),
              unitCost: round2(
                clampNumber((line as SaleLine & { unitCostAtSale?: number }).unitCost, 0) ||
                  clampNumber(
                    (line as SaleLine & { unitCostAtSale?: number }).unitCostAtSale,
                    0
                  )
              ),
              lineTotal: round2(
                clampNumber(line.lineTotal, 0) ||
                  clampNumber(line.qty, 0) * clampNumber(line.unitPrice, 0)
              ),
            }))
          : [];

        const total =
          round2(clampNumber(sale.total, 0)) ||
          round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));

        const payments: Payment[] = Array.isArray(sale.payments)
          ? sale.payments.map((p) => ({
              id: p.id ?? uid("pay"),
              amount: round2(clampNumber(p.amount, 0)),
              createdAt: p.createdAt ?? nowIso(),
              note: p.note,
            }))
          : [];

        return {
          id: sale.id ?? uid("sale"),
          customerId: sale.customerId,
          customerName: sale.customerName,
          note: sale.note,
          lines,
          total,
          payments,
          paid: sale.paid ?? salePaidSum({ ...sale, lines, total, payments } as SaleRecord) >= total,
          createdAt: sale.createdAt ?? nowIso(),
        };
      })
    : [];

  const mappedPurchases: PurchaseRecord[] = Array.isArray(data.purchases)
    ? data.purchases
    : [];

  writeJson(ITEMS_KEY, mappedItems);
  writeJson(CUSTOMERS_KEY, mappedCustomers);
  writeJson(SALES_KEY, mappedSales);
  writeJson(PURCHASES_KEY, mappedPurchases);
  setSaldo(clampNumber(data.saldo, 0));

  if (data.theme === "dark" || data.theme === "light") {
    setTheme(data.theme);
  }
}

export async function importBackupFile(file: File): Promise<void> {
  const raw = await file.text();
  const parsed = JSON.parse(raw);
  importBackupObject(parsed);
}

export function ensureSeedData(): void {
  if (getItems().length === 0) {
    const seedItems: InventoryItem[] = [
      {
        id: uid("item"),
        name: "Motorolje 5W-30",
        category: "Olje",
        unit: "liter",
        salePrice: 149,
        costPrice: 89,
        stock: 12,
        minStock: 4,
        note: "",
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: uid("item"),
        name: "Bremserens",
        category: "Forbruk",
        unit: "boks",
        salePrice: 79,
        costPrice: 45,
        stock: 8,
        minStock: 3,
        note: "",
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ];
    writeJson(ITEMS_KEY, seedItems);
  }

  if (!localStorage.getItem(SALDO_KEY)) {
    setSaldo(0);
  }
}
