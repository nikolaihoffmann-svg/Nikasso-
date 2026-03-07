// src/app/storage.ts
import { useEffect, useSyncExternalStore } from "react";

/**
 * Lokal lagring i nettleseren (localStorage) + små hooks.
 * Designet for å være robust når du bytter kodeversjoner:
 * - Gamle salg uten `lines/paid` blir "migrert" ved lesing.
 */

export type Theme = "dark" | "light";

export type Vare = {
  id: string;
  name: string;
  price: number; // salgspris pr stk
  cost: number; // kostpris pr stk
  stock: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  amount: number;
  note?: string;
  createdAt: string; // ISO
};

export type SaleLine = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  unitCostAtSale: number; // for profitt-statistikk
};

export type Sale = {
  id: string;
  customerId?: string;
  customerName?: string;
  lines: SaleLine[];
  total: number;

  // Hvis true: regnes som betalt (remaining=0) selv om payments ikke matcher 1:1.
  paid: boolean;

  payments: Payment[];
  createdAt: string;
  updatedAt: string;
};

export type ReceivablePayment = {
  id: string;
  amount: number;
  note?: string;
  createdAt: string; // ISO
};

export type Receivable = {
  id: string;
  customerId?: string;
  customerName?: string;
  title: string;
  amount: number;
  paid: boolean;
  payments: ReceivablePayment[];
  createdAt: string;
  updatedAt: string;
};

export type AddSaleInput = {
  customerId?: string;
  customerName?: string;
  lines: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    unitPrice: number;
    unitCostAtSale?: number;
  }>;
  paid: boolean; // REQUIRED
};

const LS_THEME = "nikasso.theme";
const LS_ITEMS = "nikasso.items";
const LS_CUSTOMERS = "nikasso.customers";
const LS_SALES = "nikasso.sales";
const LS_RECEIVABLES = "nikasso.receivables";
const LS_SALDO = "nikasso.saldo";
const LS_SALE_DRAFT_CUSTOMER = "nikasso.saleDraftCustomer";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtKr(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("nb-NO", { style: "currency", currency: "NOK" });
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  emit(key);
}

function load<T>(key: string, fallback: T): T {
  return safeParse<T>(localStorage.getItem(key), fallback);
}

/** Simple pub/sub pr nøkkel */
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of set) fn();
}

function subscribeKey(key: string, cb: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  return () => set?.delete(cb);
}

function useKey<T>(key: string, getter: () => T): T {
  return useSyncExternalStore(
    (cb) => {
      const off = subscribeKey(key, cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        off();
        window.removeEventListener("storage", onStorage);
      };
    },
    getter,
    getter
  );
}

/** THEME */
export function getTheme(): Theme {
  const t = localStorage.getItem(LS_THEME);
  return t === "light" || t === "dark" ? t : "dark";
}
export function setTheme(theme: Theme) {
  localStorage.setItem(LS_THEME, theme);
  emit(LS_THEME);
}
export function applyThemeToDom(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** SALDO */
export function getSaldo(): number {
  const v = Number(load<number>(LS_SALDO, 0));
  return Number.isFinite(v) ? v : 0;
}
export function setSaldo(v: number) {
  save<number>(LS_SALDO, round2(v));
}
export function useSaldo(): [number] {
  const saldo = useKey<number>(LS_SALDO, () => getSaldo());
  return [saldo];
}

/** ITEMS */
export function getItems(): Vare[] {
  const items = load<Vare[]>(LS_ITEMS, []);
  return Array.isArray(items) ? items : [];
}
export function setItems(items: Vare[]) {
  save<Vare[]>(LS_ITEMS, items);
}
export function useItems() {
  const items = useKey<Vare[]>(LS_ITEMS, () => getItems());
  return { items };
}

/** CUSTOMERS */
export function getCustomers(): Customer[] {
  const customers = load<Customer[]>(LS_CUSTOMERS, []);
  return Array.isArray(customers) ? customers : [];
}
export function setCustomers(customers: Customer[]) {
  save<Customer[]>(LS_CUSTOMERS, customers);
}
export function useCustomers() {
  const customers = useKey<Customer[]>(LS_CUSTOMERS, () => getCustomers());
  return { customers };
}

/** SALES (med kompatibilitet for gamle salg) */
function normalizeSale(anySale: any): Sale {
  const now = new Date().toISOString();

  // Ny modell (har lines)
  if (anySale && Array.isArray(anySale.lines)) {
    const paid = typeof anySale.paid === "boolean" ? anySale.paid : false;
    const payments = Array.isArray(anySale.payments) ? anySale.payments : [];
    const lines: SaleLine[] = anySale.lines.map((l: any) => ({
      id: String(l.id || uid("line")),
      itemId: String(l.itemId || ""),
      itemName: String(l.itemName || ""),
      qty: Math.trunc(Number(l.qty || 0)),
      unitPrice: Number(l.unitPrice || 0),
      unitCostAtSale: Number(l.unitCostAtSale || 0),
    }));

    const total = round2(
      typeof anySale.total === "number"
        ? anySale.total
        : lines.reduce((a, l) => a + l.qty * l.unitPrice, 0)
    );

    return {
      id: String(anySale.id || uid("sale")),
      customerId: anySale.customerId ? String(anySale.customerId) : undefined,
      customerName: anySale.customerName ? String(anySale.customerName) : undefined,
      lines,
      total,
      paid,
      payments: payments.map((p: any) => ({
        id: String(p.id || uid("pay")),
        amount: Number(p.amount || 0),
        note: p.note ? String(p.note) : undefined,
        createdAt: String(p.createdAt || now),
      })),
      createdAt: String(anySale.createdAt || now),
      updatedAt: String(anySale.updatedAt || anySale.createdAt || now),
    };
  }

  // Gammel modell (itemId/itemName/qty/unitPrice)
  const itemId = String(anySale?.itemId || "");
  const itemName = String(anySale?.itemName || "");
  const qty = Math.trunc(Number(anySale?.qty || 0));
  const unitPrice = Number(anySale?.unitPrice || 0);

  const lines: SaleLine[] = [
    {
      id: uid("line"),
      itemId,
      itemName,
      qty,
      unitPrice,
      unitCostAtSale: Number(anySale?.unitCostAtSale || 0),
    },
  ];

  const total = round2(Number(anySale?.total) || qty * unitPrice);

  return {
    id: String(anySale?.id || uid("sale")),
    customerId: anySale?.customerId ? String(anySale.customerId) : undefined,
    customerName: anySale?.customerName ? String(anySale.customerName) : undefined,
    lines,
    total,
    paid: typeof anySale?.paid === "boolean" ? anySale.paid : false,
    payments: Array.isArray(anySale?.payments)
      ? anySale.payments.map((p: any) => ({
          id: String(p.id || uid("pay")),
          amount: Number(p.amount || 0),
          note: p.note ? String(p.note) : undefined,
          createdAt: String(p.createdAt || now),
        }))
      : [],
    createdAt: String(anySale?.createdAt || now),
    updatedAt: String(anySale?.updatedAt || anySale?.createdAt || now),
  };
}

export function getSales(): Sale[] {
  const raw = load<any[]>(LS_SALES, []);
  const list = Array.isArray(raw) ? raw.map(normalizeSale) : [];
  // nyeste først
  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list;
}

export function setSales(sales: Sale[]) {
  save<Sale[]>(LS_SALES, sales);
}

export function salePaidSum(s: Sale) {
  return round2((s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0));
}

export function saleRemaining(s: Sale) {
  if (s.paid) return 0;
  const rem = round2(Number(s.total || 0) - salePaidSum(s));
  return rem < 0 ? 0 : rem;
}

export function addSale(input: AddSaleInput) {
  const now = new Date().toISOString();

  const itemsNow = getItems();
  const itemCostById = new Map(itemsNow.map((i) => [i.id, Number(i.cost || 0)]));

  const lines: SaleLine[] = input.lines.map((l) => ({
    id: uid("line"),
    itemId: l.itemId,
    itemName: l.itemName,
    qty: Math.trunc(Number(l.qty || 0)),
    unitPrice: round2(Number(l.unitPrice || 0)),
    unitCostAtSale: round2(
      Number.isFinite(Number(l.unitCostAtSale))
        ? Number(l.unitCostAtSale)
        : itemCostById.get(l.itemId) ?? 0
    ),
  }));

  const total = round2(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));

  const sale: Sale = {
    id: uid("sale"),
    customerId: input.customerId,
    customerName: input.customerName,
    lines,
    total,
    paid: !!input.paid,
    payments: [],
    createdAt: now,
    updatedAt: now,
  };

  const sales = getSales();
  sales.unshift(sale);
  setSales(sales);
}

export function addSalePayment(saleId: string, amount: number, note?: string, dateIso?: string) {
  const sales = getSales();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx < 0) return;

  const now = dateIso || new Date().toISOString();
  const s = sales[idx];
  const payments = Array.isArray(s.payments) ? s.payments.slice() : [];

  payments.unshift({
    id: uid("pay"),
    amount: round2(amount),
    note,
    createdAt: now,
  });

  const next: Sale = { ...s, payments, updatedAt: new Date().toISOString() };

  // auto-merk betalt hvis dekket
  if (saleRemaining({ ...next, paid: false }) <= 0.00001) {
    next.paid = true;
  }

  sales[idx] = next;
  setSales(sales);
}

export function setSalePaid(saleId: string, paid: boolean) {
  const sales = getSales();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx < 0) return;

  sales[idx] = { ...sales[idx], paid: !!paid, updatedAt: new Date().toISOString() };
  setSales(sales);
}

export function removeSalePayment(saleId: string, paymentId: string) {
  const sales = getSales();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx < 0) return;

  const s = sales[idx];
  const payments = (s.payments || []).filter((p) => p.id !== paymentId);
  const next: Sale = { ...s, payments, updatedAt: new Date().toISOString() };

  // hvis den ikke lenger er dekket, merk ubetalt
  if (saleRemaining({ ...next, paid: false }) > 0.00001) {
    next.paid = false;
  }

  sales[idx] = next;
  setSales(sales);
}

/**
 * Slett salg.
 * restoreStock=true  => legg tilbake varene på lager
 * restoreStock=false => ikke rør lager
 */
export function removeSale(saleId: string, restoreStock: boolean) {
  const sales = getSales();
  const s = sales.find((x) => x.id === saleId);
  if (!s) return;

  if (restoreStock) {
    const items = getItems();
    const byId = new Map(items.map((i) => [i.id, i]));
    const now = new Date().toISOString();

    for (const line of s.lines || []) {
      const it = byId.get(line.itemId);
      if (!it) continue;
      const nextStock = Number(it.stock || 0) + Math.trunc(Number(line.qty || 0));
      byId.set(line.itemId, { ...it, stock: nextStock, updatedAt: now });
    }

    setItems(Array.from(byId.values()));
  }

  setSales(sales.filter((x) => x.id !== saleId));
}

export function useSales() {
  const sales = useKey<Sale[]>(LS_SALES, () => getSales());
  return {
    sales,
    addSale,
    addSalePayment,
    setSalePaid,
    removeSalePayment,
    removeSale,
  };
}

/** RECEIVABLES */
export function getReceivables(): Receivable[] {
  const raw = load<any[]>(LS_RECEIVABLES, []);
  const now = new Date().toISOString();
  const list: Receivable[] = (Array.isArray(raw) ? raw : []).map((r) => ({
    id: String(r.id || uid("rec")),
    customerId: r.customerId ? String(r.customerId) : undefined,
    customerName: r.customerName ? String(r.customerName) : undefined,
    title: String(r.title || "Gjeld"),
    amount: round2(Number(r.amount || 0)),
    paid: typeof r.paid === "boolean" ? r.paid : false,
    payments: Array.isArray(r.payments)
      ? r.payments.map((p: any) => ({
          id: String(p.id || uid("rpay")),
          amount: round2(Number(p.amount || 0)),
          note: p.note ? String(p.note) : undefined,
          createdAt: String(p.createdAt || now),
        }))
      : [],
    createdAt: String(r.createdAt || now),
    updatedAt: String(r.updatedAt || r.createdAt || now),
  }));

  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list;
}

export function setReceivables(list: Receivable[]) {
  save<Receivable[]>(LS_RECEIVABLES, list);
}

export function receivablePaidSum(r: Receivable) {
  return round2((r.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0));
}

export function receivableRemaining(r: Receivable) {
  if (r.paid) return 0;
  const rem = round2(Number(r.amount || 0) - receivablePaidSum(r));
  return rem < 0 ? 0 : rem;
}

export function addReceivable(input: { customerId?: string; customerName?: string; title: string; amount: number; paid?: boolean }) {
  const now = new Date().toISOString();
  const list = getReceivables();
  list.unshift({
    id: uid("rec"),
    customerId: input.customerId,
    customerName: input.customerName,
    title: input.title || "Gjeld",
    amount: round2(input.amount),
    paid: !!input.paid,
    payments: [],
    createdAt: now,
    updatedAt: now,
  });
  setReceivables(list);
}

export function addReceivablePayment(receivableId: string, amount: number, note?: string, dateIso?: string) {
  const list = getReceivables();
  const idx = list.findIndex((r) => r.id === receivableId);
  if (idx < 0) return;

  const now = dateIso || new Date().toISOString();
  const r = list[idx];
  const payments = (r.payments || []).slice();
  payments.unshift({ id: uid("rpay"), amount: round2(amount), note, createdAt: now });

  const next: Receivable = { ...r, payments, updatedAt: new Date().toISOString() };
  if (receivableRemaining({ ...next, paid: false }) <= 0.00001) next.paid = true;

  list[idx] = next;
  setReceivables(list);
}

export function setReceivablePaid(receivableId: string, paid: boolean) {
  const list = getReceivables();
  const idx = list.findIndex((r) => r.id === receivableId);
  if (idx < 0) return;
  list[idx] = { ...list[idx], paid: !!paid, updatedAt: new Date().toISOString() };
  setReceivables(list);
}

export function removeReceivable(receivableId: string) {
  const list = getReceivables();
  setReceivables(list.filter((r) => r.id !== receivableId));
}

export function useReceivables() {
  const receivables = useKey<Receivable[]>(LS_RECEIVABLES, () => getReceivables());
  return { receivables, addReceivable, addReceivablePayment, setReceivablePaid, removeReceivable };
}

/** DRAFT: velg kunde fra Kunder -> Salg */
export function setSaleDraftCustomer(customerId: string) {
  localStorage.setItem(LS_SALE_DRAFT_CUSTOMER, customerId);
  emit(LS_SALE_DRAFT_CUSTOMER);
}
export function getSaleDraftCustomer() {
  return localStorage.getItem(LS_SALE_DRAFT_CUSTOMER) || "";
}
export function clearSaleDraftCustomer() {
  localStorage.removeItem(LS_SALE_DRAFT_CUSTOMER);
  emit(LS_SALE_DRAFT_CUSTOMER);
}

/** EXPORT/IMPORT */
export function downloadExportAll() {
  const payload = {
    v: 1,
    exportedAt: new Date().toISOString(),
    theme: getTheme(),
    saldo: getSaldo(),
    items: getItems(),
    customers: getCustomers(),
    sales: getSales(),
    receivables: getReceivables(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `nikasso-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function pickImportAllFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const f = input.files && input.files[0] ? input.files[0] : null;
      resolve(f);
    };
    input.click();
  });
}

export async function importAllFromFile() {
  const file = await pickImportAllFile();
  if (!file) return;

  const text = await file.text();
  const data = safeParse<any>(text, null);
  if (!data) return alert("Kunne ikke lese backup-filen.");

  // Viktig: lagre bare det som finnes
  if (data.theme === "dark" || data.theme === "light") setTheme(data.theme);
  if (typeof data.saldo === "number") setSaldo(data.saldo);
  if (Array.isArray(data.items)) setItems(data.items);
  if (Array.isArray(data.customers)) setCustomers(data.customers);
  if (Array.isArray(data.sales)) setSales(data.sales.map(normalizeSale));
  if (Array.isArray(data.receivables)) setReceivables(data.receivables);

  alert("Import ferdig ✅");
}

export function clearAllData() {
  localStorage.removeItem(LS_ITEMS);
  localStorage.removeItem(LS_CUSTOMERS);
  localStorage.removeItem(LS_SALES);
  localStorage.removeItem(LS_RECEIVABLES);
  localStorage.removeItem(LS_SALDO);
  emit(LS_ITEMS);
  emit(LS_CUSTOMERS);
  emit(LS_SALES);
  emit(LS_RECEIVABLES);
  emit(LS_SALDO);
}

/** Små helpers for "Data"-knapp/side osv */
export function getStorageSummary() {
  return {
    items: getItems().length,
    customers: getCustomers().length,
    sales: getSales().length,
    receivables: getReceivables().length,
    saldo: getSaldo(),
  };
}

/**
 * (valgfritt) hvis du vil reagere på theme-endring i appen uten refresh
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useKey<Theme>(LS_THEME, () => getTheme());
  useEffect(() => applyThemeToDom(theme), [theme]);
  return [theme, setTheme];
}
