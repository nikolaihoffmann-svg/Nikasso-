import type {
  AppBackup,
  Customer,
  DebtDraft,
  DebtPayment,
  DebtRecord,
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
const DEBTS_KEY = "nikasso_debts_v1";
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

function normalizeCategory(value: unknown): ItemCategory {
  const v = String(value ?? "").trim();
  if (v === "Deler" || v === "Forbruk" || v === "Utstyr" || v === "Annet") return v;
  if (v === "Olje") return "Forbruk";
  return "Annet";
}

function normalizeUnit(_value: unknown): ItemUnit {
  return "stk";
}

function normalizeItem(input: Partial<InventoryItem> & Record<string, unknown>): InventoryItem {
  return {
    id: String(input.id ?? uid("item")),
    name: String(input.name ?? "Uten navn"),
    sku: input.sku ? String(input.sku) : undefined,
    category: normalizeCategory(input.category),
    unit: normalizeUnit(input.unit),
    salePrice: round2(clampNumber(input.salePrice ?? input.price, 0)),
    costPrice: round2(clampNumber(input.costPrice ?? input.cost, 0)),
    price: undefined,
    cost: undefined,
    stock: clampNumber(input.stock, 0),
    minStock: clampNumber(input.minStock, 0),
    note: input.note ? String(input.note) : undefined,
    isActive: input.isActive !== false,
    createdAt: String(input.createdAt ?? nowIso()),
    updatedAt: String(input.updatedAt ?? nowIso()),
  };
}

function normalizeCustomer(input: Partial<Customer>): Customer {
  return {
    id: String(input.id ?? uid("cust")),
    name: String(input.name ?? "Uten navn"),
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    note: input.note?.trim() || undefined,
    createdAt: String(input.createdAt ?? nowIso()),
    updatedAt: String(input.updatedAt ?? nowIso()),
  };
}

function getAllItemsRaw(): InventoryItem[] {
  return readJson<Array<Partial<InventoryItem> & Record<string, unknown>>>(ITEMS_KEY, [])
    .map(normalizeItem)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
}

function writeItems(items: InventoryItem[]): void {
  writeJson(ITEMS_KEY, items);
}

function writeCustomers(customers: Customer[]): void {
  writeJson(CUSTOMERS_KEY, customers);
}

function writeDebts(debts: DebtRecord[]): void {
  writeJson(DEBTS_KEY, debts);
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

export function adjustSaldo(delta: number): number {
  const next = round2(getSaldo() + clampNumber(delta, 0));
  setSaldo(next);
  return next;
}

export function getItems(): InventoryItem[] {
  return getAllItemsRaw()
    .filter((x) => x.isActive !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
}

export function getCustomers(): Customer[] {
  return readJson<Partial<Customer>[]>(CUSTOMERS_KEY, [])
    .map(normalizeCustomer)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
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

export function getDebts(): DebtRecord[] {
  return readJson<DebtRecord[]>(DEBTS_KEY, []).sort((a, b) =>
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
  const items = getAllItemsRaw();
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("Varen må ha navn");
  }

  const existing = items.find(
    (x) => x.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );

  if (existing) {
    if (existing.isActive === false) {
      const revived = {
        ...existing,
        isActive: true,
        updatedAt: nowIso(),
      };
      writeItems(items.map((x) => (x.id === revived.id ? revived : x)));
      return revived;
    }
    return existing;
  }

  const item: InventoryItem = {
    id: uid("item"),
    name: trimmedName,
    sku: input.sku?.trim() || undefined,
    category: normalizeCategory(input.category),
    unit: "stk",
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
  writeItems(items);
  return item;
}

export function updateItem(itemId: string, patch: Partial<InventoryItem>): InventoryItem {
  const items = getAllItemsRaw();
  const index = items.findIndex((x) => x.id === itemId);
  if (index === -1) throw new Error("Fant ikke varen");

  const current = items[index];
  const updated: InventoryItem = {
    ...current,
    ...patch,
    category: normalizeCategory(patch.category ?? current.category),
    unit: "stk",
    salePrice: round2(clampNumber(patch.salePrice ?? current.salePrice, 0)),
    costPrice: round2(clampNumber(patch.costPrice ?? current.costPrice, 0)),
    stock: clampNumber(patch.stock ?? current.stock, 0),
    minStock: clampNumber(patch.minStock ?? current.minStock, 0),
    name: String((patch.name ?? current.name) || "").trim(),
    note: patch.note === "" ? undefined : (patch.note ?? current.note),
    updatedAt: nowIso(),
  };

  if (!updated.name) throw new Error("Varen må ha navn");

  items[index] = updated;
  writeItems(items);
  return updated;
}

export function setItemStock(itemId: string, stock: number): InventoryItem {
  return updateItem(itemId, { stock: clampNumber(stock, 0) });
}

export function adjustItemStock(itemId: string, delta: number): InventoryItem {
  const items = getAllItemsRaw();
  const index = items.findIndex((x) => x.id === itemId);
  if (index === -1) throw new Error("Fant ikke varen");

  const current = items[index];
  const updated: InventoryItem = {
    ...current,
    stock: round2(current.stock + clampNumber(delta, 0)),
    updatedAt: nowIso(),
  };

  items[index] = updated;
  writeItems(items);
  return updated;
}

export function deleteItem(itemId: string): void {
  const salesUsingItem = getSales().some((sale) =>
    sale.lines.some((line) => line.itemId === itemId)
  );

  if (salesUsingItem) {
    const items = getAllItemsRaw();
    const index = items.findIndex((x) => x.id === itemId);
    if (index === -1) return;

    items[index] = {
      ...items[index],
      isActive: false,
      updatedAt: nowIso(),
    };
    writeItems(items);
    return;
  }

  const items = getAllItemsRaw();
  writeItems(items.filter((x) => x.id !== itemId));
}

export type CreateCustomerInput = {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
};

export function createCustomer(input: CreateCustomerInput): Customer {
  const customers = getCustomers();
  const trimmedName = input.name.trim();

  if (!trimmedName) throw new Error("Kunden må ha navn");

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
  writeCustomers(customers);
  return customer;
}

export function updateCustomer(customerId: string, patch: Partial<Customer>): Customer {
  const customers = getCustomers();
  const index = customers.findIndex((x) => x.id === customerId);
  if (index === -1) throw new Error("Fant ikke kunden");

  const current = customers[index];
  const updated: Customer = {
    ...current,
    ...patch,
    name: String((patch.name ?? current.name) || "").trim(),
    phone: patch.phone === "" ? undefined : (patch.phone ?? current.phone),
    address: patch.address === "" ? undefined : (patch.address ?? current.address),
    note: patch.note === "" ? undefined : (patch.note ?? current.note),
    updatedAt: nowIso(),
  };

  if (!updated.name) throw new Error("Kunden må ha navn");

  customers[index] = updated;
  writeCustomers(customers);
  return updated;
}

export function deleteCustomer(customerId: string): void {
  const sales = getSales().filter((sale) => sale.customerId === customerId);
  const debts = getDebts().filter((debt) => debt.customerId === customerId);

  if (sales.length > 0 || debts.length > 0) {
    throw new Error("Kunden kan ikke slettes fordi den er brukt i salg eller gjeld");
  }

  const customers = getCustomers();
  writeCustomers(customers.filter((x) => x.id !== customerId));
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

export function createEmptyDebt(): DebtDraft {
  return {
    id: uid("debt"),
    customerId: undefined,
    customerName: "",
    title: "",
    note: "",
    total: 0,
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
  const items = getAllItemsRaw();
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

  writeItems(items);
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
  const items = getAllItemsRaw();
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

  writeItems(items);
  sales.unshift(record);
  writeJson(SALES_KEY, sales);

  return record;
}

export function updateSale(
  saleId: string,
  patch: {
    customerId?: string;
    customerName?: string;
    note?: string;
  }
): SaleRecord {
  const sales = getSales();
  const index = sales.findIndex((x) => x.id === saleId);
  if (index === -1) throw new Error("Fant ikke salget");

  const current = sales[index];
  const updated: SaleRecord = {
    ...current,
    customerId: patch.customerId,
    customerName: patch.customerName,
    note: patch.note,
  };

  sales[index] = updated;
  writeJson(SALES_KEY, sales);
  return updated;
}

export function deleteSale(saleId: string): void {
  const sales = getSales();
  writeJson(
    SALES_KEY,
    sales.filter((sale) => sale.id !== saleId)
  );
}

export function addPaymentToSale(saleId: string, amount: number, note?: string): SaleRecord {
  const sales = readJson<SaleRecord[]>(SALES_KEY, []);
  const index = sales.findIndex((x) => x.id === saleId);
  if (index === -1) throw new Error("Fant ikke salget");

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
    paid:
      salePaidSum({
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

export function saveDebt(
  draft: DebtDraft,
  options?: {
    paymentAmount?: number;
    paymentNote?: string;
  }
): DebtRecord {
  const debts = getDebts();
  const initialPayment = round2(clampNumber(options?.paymentAmount, 0));

  const payments: DebtPayment[] =
    initialPayment > 0
      ? [
          {
            id: uid("dpay"),
            amount: initialPayment,
            createdAt: nowIso(),
            note: options?.paymentNote?.trim() || undefined,
          },
        ]
      : [];

  const total = round2(clampNumber(draft.total, 0));

  const record: DebtRecord = {
    id: draft.id,
    customerId: draft.customerId,
    customerName: draft.customerName,
    title: draft.title.trim() || "Gjeldspost",
    note: draft.note?.trim() || undefined,
    total,
    payments,
    paid: debtPaidSum({ total, payments } as DebtRecord) >= total && total > 0,
    createdAt: draft.createdAt,
  };

  debts.unshift(record);
  writeDebts(debts);
  return record;
}

export function updateDebt(
  debtId: string,
  patch: {
    customerId?: string;
    customerName?: string;
    title?: string;
    note?: string;
    total?: number;
  }
): DebtRecord {
  const debts = getDebts();
  const index = debts.findIndex((x) => x.id === debtId);
  if (index === -1) throw new Error("Fant ikke gjeldsposten");

  const current = debts[index];
  const total = round2(clampNumber(patch.total ?? current.total, 0));

  const updated: DebtRecord = {
    ...current,
    customerId: patch.customerId,
    customerName: patch.customerName,
    title: (patch.title ?? current.title).trim() || "Gjeldspost",
    note: patch.note === "" ? undefined : (patch.note ?? current.note),
    total,
    paid: debtPaidSum({ ...current, total }) >= total && total > 0,
  };

  debts[index] = updated;
  writeDebts(debts);
  return updated;
}

export function deleteDebt(debtId: string): void {
  const debts = getDebts();
  writeDebts(debts.filter((debt) => debt.id !== debtId));
}

export function addPaymentToDebt(debtId: string, amount: number, note?: string): DebtRecord {
  const debts = getDebts();
  const index = debts.findIndex((x) => x.id === debtId);
  if (index === -1) throw new Error("Fant ikke gjeldsposten");

  const debt = debts[index];
  const payment: DebtPayment = {
    id: uid("dpay"),
    amount: round2(clampNumber(amount, 0)),
    createdAt: nowIso(),
    note: note?.trim() || undefined,
  };

  const payments = [...debt.payments, payment];
  const updated: DebtRecord = {
    ...debt,
    payments,
    paid: debtPaidSum({ ...debt, payments }) >= debt.total,
  };

  debts[index] = updated;
  writeDebts(debts);
  return updated;
}

export function debtPaidSum(debt: DebtRecord): number {
  return round2(debt.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
}

export function debtRemaining(debt: DebtRecord): number {
  return Math.max(0, round2(debt.total - debtPaidSum(debt)));
}

export function lowStockItems(): InventoryItem[] {
  return getItems().filter((item) => item.stock <= item.minStock);
}

export function customerSales(customerId: string): SaleRecord[] {
  return getSales().filter((sale) => sale.customerId === customerId);
}

export function customerDebts(customerId: string): DebtRecord[] {
  return getDebts().filter((debt) => debt.customerId === customerId);
}

export function customerTotalBought(customerId: string): number {
  return round2(customerSales(customerId).reduce((sum, sale) => sum + sale.total, 0));
}

export function customerTotalRemaining(customerId: string): number {
  return round2(customerSales(customerId).reduce((sum, sale) => sum + saleRemaining(sale), 0));
}

export function customerDebtRemaining(customerId: string): number {
  return round2(customerDebts(customerId).reduce((sum, debt) => sum + debtRemaining(debt), 0));
}

export function totalSalesOutstanding(): number {
  return round2(getSales().reduce((sum, sale) => sum + saleRemaining(sale), 0));
}

export function totalDebtOutstanding(): number {
  return round2(getDebts().reduce((sum, debt) => sum + debtRemaining(debt), 0));
}

export function totalReceivables(): number {
  return round2(totalSalesOutstanding() + totalDebtOutstanding());
}

export function inventoryValue(items: InventoryItem[] = getItems()): number {
  return round2(
    items.reduce((sum, item) => sum + Number(item.costPrice || 0) * Number(item.stock || 0), 0)
  );
}

export function projectedTotalValue(): number {
  return round2(getSaldo() + totalReceivables() + inventoryValue());
}

export function exportAllData(): AppBackup {
  return {
    version: 3,
    exportedAt: nowIso(),
    theme: getTheme(),
    saldo: getSaldo(),
    items: getItems(),
    customers: getCustomers(),
    sales: getSales(),
    purchases: getPurchases(),
    debts: getDebts(),
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
  localStorage.removeItem(DEBTS_KEY);
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
      note?: string;
      category?: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
  };

  const mappedItems: InventoryItem[] = Array.isArray(data.items)
    ? data.items.map((item) =>
        normalizeItem({
          ...item,
          category: item.category,
          note: item.note,
        })
      )
    : [];

  const mappedCustomers: Customer[] = Array.isArray(data.customers)
    ? data.customers.map((customer) => normalizeCustomer(customer))
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
          paid:
            sale.paid ??
            salePaidSum({ ...sale, lines, total, payments } as SaleRecord) >= total,
          createdAt: sale.createdAt ?? nowIso(),
        };
      })
    : [];

  const mappedPurchases: PurchaseRecord[] = Array.isArray(data.purchases)
    ? data.purchases
    : [];

  const mappedDebts: DebtRecord[] = Array.isArray(data.debts)
    ? data.debts.map((debt) => ({
        id: debt.id ?? uid("debt"),
        customerId: debt.customerId,
        customerName: debt.customerName,
        title: debt.title ?? "Gjeldspost",
        note: debt.note,
        total: round2(clampNumber(debt.total, 0)),
        payments: Array.isArray(debt.payments)
          ? debt.payments.map((p) => ({
              id: p.id ?? uid("dpay"),
              amount: round2(clampNumber(p.amount, 0)),
              createdAt: p.createdAt ?? nowIso(),
              note: p.note,
            }))
          : [],
        paid: Boolean(debt.paid),
        createdAt: debt.createdAt ?? nowIso(),
      }))
    : [];

  writeItems(mappedItems);
  writeCustomers(mappedCustomers);
  writeJson(SALES_KEY, mappedSales);
  writeJson(PURCHASES_KEY, mappedPurchases);
  writeDebts(mappedDebts);
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
  if (getAllItemsRaw().length === 0) {
    const seedItems: InventoryItem[] = [
      {
        id: uid("item"),
        name: "Bremserens",
        category: "Forbruk",
        unit: "stk",
        salePrice: 79,
        costPrice: 45,
        stock: 8,
        minStock: 3,
        note: "",
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: uid("item"),
        name: "Motorolje 5W-30",
        category: "Forbruk",
        unit: "stk",
        salePrice: 149,
        costPrice: 89,
        stock: 12,
        minStock: 4,
        note: "",
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ];
    writeItems(seedItems);
  }

  if (!localStorage.getItem(SALDO_KEY)) {
    setSaldo(0);
  }

  if (!localStorage.getItem(DEBTS_KEY)) {
    writeDebts([]);
  }
}
