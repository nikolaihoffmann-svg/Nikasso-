// src/app/storage.ts
import { useEffect, useMemo, useState } from "react";

/* =========================
   Types
========================= */

export type Theme = "dark" | "light";

export type Vare = {
  id: string;
  name: string;
  price: number; // salg
  cost: number; // kost
  stock: number; // lager
  minStock: number; // minimum (varsel)
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
  dateIso: string; // innbetalingsdato
  note?: string;
};

export type Sale = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;

  customerId?: string;
  customerName?: string;

  createdAt: string;

  // ✅ for korrekt historikk av profitt
  unitCostAtSale?: number;

  // ✅ delbetalinger + dato
  payments?: Payment[];
};

export type Receivable = {
  id: string;
  title: string; // f.eks. "Utlån", "Privat", "Faktura"
  debtorName: string; // hvem som skylder deg penger
  amount: number; // totalsum som skal betales
  dueDate?: string; // valgfritt
  note?: string;

  createdAt: string;
  updatedAt: string;

  // ✅ delbetalinger + dato
  payments?: Payment[];
};

/* =========================
   Helpers
========================= */

const LS_KEYS = {
  items: "sg.items.v1",
  customers: "sg.customers.v1",
  sales: "sg.sales.v1",
  saleDraftCustomer: "sg.saleDraftCustomer.v1",
  theme: "sg.theme.v1",
  receivables: "sg.receivables.v1",
} as const;

const EVT = "sg:storage-changed";

function emitChange() {
  window.dispatchEvent(new Event(EVT));
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtKr(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" }).format(v);
}

function sumPayments(payments?: Payment[]) {
  return (payments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
}

export function calcOutstanding(total: number, payments?: Payment[]) {
  const t = Number(total) || 0;
  const paid = sumPayments(payments);
  return Math.max(0, round2(t - paid));
}

export function calcPaid(payments?: Payment[]) {
  return round2(sumPayments(payments));
}

/* =========================
   Theme
========================= */

export function getTheme(): Theme {
  const v = localStorage.getItem(LS_KEYS.theme);
  return v === "light" ? "light" : "dark";
}

export function setTheme(t: Theme) {
  localStorage.setItem(LS_KEYS.theme, t);
  emitChange();
}

export function applyThemeToDom(theme: Theme) {
  document.documentElement.dataset.theme = theme; // for CSS: :root[data-theme="dark"]
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  document.documentElement.classList.toggle("theme-light", theme === "light");
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const onChange = () => setState(getTheme());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVT, onChange);
    };
  }, []);

  return [theme, setTheme];
}

/* =========================
   Items (Varer)
========================= */

export function getItems(): Vare[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.items), []);
  const normalized: Vare[] = (raw || [])
    .map((x) => ({
      id: String(x.id ?? uid("item")),
      name: String(x.name ?? "").trim(),
      price: Number(x.price ?? 0),
      cost: Number(x.cost ?? 0),
      stock: Number(x.stock ?? 0),
      minStock: Number(x.minStock ?? 10),
      createdAt: String(x.createdAt ?? nowIso()),
      updatedAt: String(x.updatedAt ?? nowIso()),
    }))
    .filter((x) => x.name.length > 0);

  return normalized;
}

export function setItems(next: Vare[]) {
  localStorage.setItem(LS_KEYS.items, JSON.stringify(next));
  emitChange();
}

function upsertItemCore(item: Omit<Vare, "createdAt" | "updatedAt">) {
  const items = getItems();
  const i = items.findIndex((x) => x.id === item.id);
  if (i >= 0) {
    items[i] = { ...items[i], ...item, updatedAt: nowIso() };
  } else {
    items.unshift({ ...item, createdAt: nowIso(), updatedAt: nowIso() });
  }
  setItems(items);
}

function removeItemCore(id: string) {
  const items = getItems().filter((x) => x.id !== id);
  setItems(items);
}

function adjustItemStockCore(id: string, delta: number) {
  const items = getItems();
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return;
  const nextStock = (items[i].stock ?? 0) + delta;
  items[i] = { ...items[i], stock: nextStock, updatedAt: nowIso() };
  setItems(items);
}

export function useItems() {
  const [items, setState] = useState<Vare[]>(() => getItems());

  useEffect(() => {
    const onChange = () => setState(getItems());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVT, onChange);
    };
  }, []);

  return useMemo(
    () => ({
      items,
      upsert: (item: Omit<Vare, "createdAt" | "updatedAt">) => upsertItemCore(item),
      remove: (id: string) => removeItemCore(id),
      adjust: (id: string, delta: number) => adjustItemStockCore(id, delta),
      setAll: (all: Vare[]) => setItems(all),
    }),
    [items]
  );
}

/* =========================
   Customers (Kunder)
========================= */

export function getCustomers(): Customer[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.customers), []);
  const normalized: Customer[] = (raw || [])
    .map((x) => ({
      id: String(x.id ?? uid("cust")),
      name: String(x.name ?? "").trim(),
      phone: x.phone ? String(x.phone).trim() : undefined,
      address: x.address ? String(x.address).trim() : undefined,
      note: x.note ? String(x.note).trim() : undefined,
      createdAt: String(x.createdAt ?? nowIso()),
      updatedAt: String(x.updatedAt ?? nowIso()),
    }))
    .filter((x) => x.name.length > 0);

  return normalized;
}

export function setCustomers(next: Customer[]) {
  localStorage.setItem(LS_KEYS.customers, JSON.stringify(next));
  emitChange();
}

function upsertCustomerCore(c: Omit<Customer, "createdAt" | "updatedAt">) {
  const customers = getCustomers();
  const i = customers.findIndex((x) => x.id === c.id);
  if (i >= 0) {
    customers[i] = { ...customers[i], ...c, updatedAt: nowIso() };
  } else {
    customers.unshift({ ...c, createdAt: nowIso(), updatedAt: nowIso() });
  }
  setCustomers(customers);
}

function removeCustomerCore(id: string) {
  const customers = getCustomers().filter((x) => x.id !== id);
  setCustomers(customers);
}

export function useCustomers() {
  const [customers, setState] = useState<Customer[]>(() => getCustomers());

  useEffect(() => {
    const onChange = () => setState(getCustomers());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVT, onChange);
    };
  }, []);

  return useMemo(
    () => ({
      customers,
      upsert: (c: Omit<Customer, "createdAt" | "updatedAt">) => upsertCustomerCore(c),
      remove: (id: string) => removeCustomerCore(id),
      setAll: (all: Customer[]) => setCustomers(all),
    }),
    [customers]
  );
}

/* =========================
   Sales (Salg) + delbetaling
========================= */

export function getSales(): Sale[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.sales), []);
  const normalized: Sale[] = (raw || []).map((x) => ({
    id: String(x.id ?? uid("sale")),
    itemId: String(x.itemId ?? ""),
    itemName: String(x.itemName ?? ""),
    qty: Number(x.qty ?? 0),
    unitPrice: Number(x.unitPrice ?? 0),
    total: Number(x.total ?? 0),
    customerId: x.customerId ? String(x.customerId) : undefined,
    customerName: x.customerName ? String(x.customerName) : undefined,
    createdAt: String(x.createdAt ?? nowIso()),
    unitCostAtSale: Number.isFinite(Number(x.unitCostAtSale)) ? Number(x.unitCostAtSale) : undefined,
    payments: Array.isArray(x.payments)
      ? x.payments.map((p: any) => ({
          id: String(p.id ?? uid("pay")),
          amount: Number(p.amount ?? 0),
          dateIso: String(p.dateIso ?? nowIso()),
          note: p.note ? String(p.note) : undefined,
        }))
      : undefined,
  }));

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setSales(next: Sale[]) {
  localStorage.setItem(LS_KEYS.sales, JSON.stringify(next));
  emitChange();
}

export function addSale(input: Omit<Sale, "id" | "createdAt" | "total" | "payments" | "unitCostAtSale">) {
  const sales = getSales();
  const createdAt = nowIso();
  const total = round2((Number(input.qty) || 0) * (Number(input.unitPrice) || 0));

  // ✅ ta vare-cost ved salgstidspunktet for korrekt profitt-historikk
  const item = getItems().find((i) => i.id === input.itemId);
  const unitCostAtSale = item ? Number(item.cost ?? 0) : undefined;

  const next: Sale = {
    id: uid("sale"),
    createdAt,
    total,
    payments: [],
    unitCostAtSale,
    ...input,
  };

  sales.unshift(next);
  setSales(sales);
}

function updateSaleCore(id: string, updater: (s: Sale) => Sale) {
  const all = getSales();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return;
  all[i] = updater(all[i]);
  setSales(all);
}

export function addSalePayment(saleId: string, amount: number, dateIso = nowIso(), note?: string) {
  const a = round2(Number(amount) || 0);
  if (a <= 0) return;

  updateSaleCore(saleId, (s) => ({
    ...s,
    payments: [...(s.payments ?? []), { id: uid("pay"), amount: a, dateIso, note }],
  }));
}

export function removeSalePayment(saleId: string, paymentId: string) {
  updateSaleCore(saleId, (s) => ({
    ...s,
    payments: (s.payments ?? []).filter((p) => p.id !== paymentId),
  }));
}

// ✅ "sett betalt" = legg inn en betaling som dekker restbeløpet
export function settleSale(saleId: string, dateIso = nowIso()) {
  const s = getSales().find((x) => x.id === saleId);
  if (!s) return;
  const rest = calcOutstanding(s.total, s.payments);
  if (rest <= 0) return;
  addSalePayment(saleId, rest, dateIso, "Oppgjort");
}

export function useSales() {
  const [sales, setState] = useState<Sale[]>(() => getSales());

  useEffect(() => {
    const onChange = () => setState(getSales());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVT, onChange);
    };
  }, []);

  return useMemo(
    () => ({
      sales,
      addPayment: (saleId: string, amount: number, dateIso?: string, note?: string) => addSalePayment(saleId, amount, dateIso, note),
      removePayment: (saleId: string, paymentId: string) => removeSalePayment(saleId, paymentId),
      settle: (saleId: string, dateIso?: string) => settleSale(saleId, dateIso),
      setAll: (all: Sale[]) => setSales(all),
    }),
    [sales]
  );
}

/* =========================
   Sale draft customer (forhåndsvalg)
========================= */

export function setSaleDraftCustomer(customerId: string) {
  localStorage.setItem(LS_KEYS.saleDraftCustomer, JSON.stringify(customerId));
  emitChange();
}

export function getSaleDraftCustomer(): string | null {
  const v = safeJsonParse<any>(localStorage.getItem(LS_KEYS.saleDraftCustomer), null);
  if (typeof v === "string" && v.trim()) return v;
  return null;
}

export function clearSaleDraftCustomer() {
  localStorage.removeItem(LS_KEYS.saleDraftCustomer);
  emitChange();
}

/* =========================
   Receivables (Gjeld til deg) + delbetaling
========================= */

export function getReceivables(): Receivable[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.receivables), []);
  const normalized: Receivable[] = (raw || []).map((x) => ({
    id: String(x.id ?? uid("rec")),
    title: String(x.title ?? "Gjeld").trim() || "Gjeld",
    debtorName: String(x.debtorName ?? "").trim() || "Ukjent",
    amount: Number(x.amount ?? 0),
    dueDate: x.dueDate ? String(x.dueDate) : undefined,
    note: x.note ? String(x.note) : undefined,
    createdAt: String(x.createdAt ?? nowIso()),
    updatedAt: String(x.updatedAt ?? nowIso()),
    payments: Array.isArray(x.payments)
      ? x.payments.map((p: any) => ({
          id: String(p.id ?? uid("pay")),
          amount: Number(p.amount ?? 0),
          dateIso: String(p.dateIso ?? nowIso()),
          note: p.note ? String(p.note) : undefined,
        }))
      : undefined,
  }));

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setReceivables(next: Receivable[]) {
  localStorage.setItem(LS_KEYS.receivables, JSON.stringify(next));
  emitChange();
}

function updateReceivableCore(id: string, updater: (r: Receivable) => Receivable) {
  const all = getReceivables();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return;
  all[i] = updater(all[i]);
  setReceivables(all);
}

export function upsertReceivable(input: Omit<Receivable, "createdAt" | "updatedAt" | "payments"> & { payments?: Payment[] }) {
  const all = getReceivables();
  const i = all.findIndex((x) => x.id === input.id);
  if (i >= 0) {
    all[i] = { ...all[i], ...input, updatedAt: nowIso() };
  } else {
    all.unshift({ ...input, payments: input.payments ?? [], createdAt: nowIso(), updatedAt: nowIso() });
  }
  setReceivables(all);
}

export function removeReceivable(id: string) {
  setReceivables(getReceivables().filter((r) => r.id !== id));
}

export function addReceivablePayment(receivableId: string, amount: number, dateIso = nowIso(), note?: string) {
  const a = round2(Number(amount) || 0);
  if (a <= 0) return;

  updateReceivableCore(receivableId, (r) => ({
    ...r,
    payments: [...(r.payments ?? []), { id: uid("pay"), amount: a, dateIso, note }],
    updatedAt: nowIso(),
  }));
}

export function removeReceivablePayment(receivableId: string, paymentId: string) {
  updateReceivableCore(receivableId, (r) => ({
    ...r,
    payments: (r.payments ?? []).filter((p) => p.id !== paymentId),
    updatedAt: nowIso(),
  }));
}

export function settleReceivable(receivableId: string, dateIso = nowIso()) {
  const r = getReceivables().find((x) => x.id === receivableId);
  if (!r) return;
  const rest = calcOutstanding(r.amount, r.payments);
  if (rest <= 0) return;
  addReceivablePayment(receivableId, rest, dateIso, "Oppgjort");
}

export function useReceivables() {
  const [receivables, setState] = useState<Receivable[]>(() => getReceivables());

  useEffect(() => {
    const onChange = () => setState(getReceivables());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVT, onChange);
    };
  }, []);

  return useMemo(
    () => ({
      receivables,
      upsert: (r: Omit<Receivable, "createdAt" | "updatedAt">) =>
        upsertReceivable({ ...r, payments: r.payments ?? [] } as any),
      remove: (id: string) => removeReceivable(id),
      addPayment: (id: string, amount: number, dateIso?: string, note?: string) => addReceivablePayment(id, amount, dateIso, note),
      removePayment: (id: string, paymentId: string) => removeReceivablePayment(id, paymentId),
      settle: (id: string, dateIso?: string) => settleReceivable(id, dateIso),
      setAll: (all: Receivable[]) => setReceivables(all),
    }),
    [receivables]
  );
}

/* =========================
   Export / Import ALT
========================= */

export type ExportAllPayload = {
  version: 1;
  exportedAt: string;
  items: Vare[];
  customers: Customer[];
  sales: Sale[];
  receivables: Receivable[];
};

export function exportAllData(): ExportAllPayload {
  return {
    version: 1,
    exportedAt: nowIso(),
    items: getItems(),
    customers: getCustomers(),
    sales: getSales(),
    receivables: getReceivables(),
  };
}

export function downloadAllDataJson(filenamePrefix = "sg-export") {
  const payload = exportAllData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAllDataFromJsonText(text: string) {
  const parsed = JSON.parse(text);

  const items: Vare[] = Array.isArray(parsed?.items) ? parsed.items : [];
  const customers: Customer[] = Array.isArray(parsed?.customers) ? parsed.customers : [];
  const sales: Sale[] = Array.isArray(parsed?.sales) ? parsed.sales : [];
  const receivables: Receivable[] = Array.isArray(parsed?.receivables) ? parsed.receivables : [];

  setItems(items);
  setCustomers(customers);
  setSales(sales);
  setReceivables(receivables);
}
