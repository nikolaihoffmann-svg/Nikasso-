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
  dateIso: string; // ✅ bruker dateIso (ikke createdAt)
  note?: string;
};

export type Sale = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  unitCostAtSale?: number; // for korrekt historikk
  total: number;

  customerId?: string;
  customerName?: string;

  payments: Payment[]; // ✅ delbetaling på salg
  createdAt: string;
};

export type Receivable = {
  id: string;
  title: string;
  debtorName: string;
  amount: number;
  dueDate?: string;
  note?: string;
  payments: Payment[]; // ✅ delbetaling på gjeld til deg
  createdAt: string;
  updatedAt: string;
};

/* =========================
   Helpers
========================= */

const LS_KEYS = {
  items: "sg.items.v1",
  customers: "sg.customers.v1",
  sales: "sg.sales.v1",
  receivables: "sg.receivables.v1",
  saleDraftCustomer: "sg.saleDraftCustomer.v1",
  theme: "sg.theme.v1",
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
  document.documentElement.dataset.theme = theme; // html[data-theme="dark|light"]
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
  if (i >= 0) items[i] = { ...items[i], ...item, updatedAt: nowIso() };
  else items.unshift({ ...item, createdAt: nowIso(), updatedAt: nowIso() });
  setItems(items);
}

function removeItemCore(id: string) {
  setItems(getItems().filter((x) => x.id !== id));
}

function adjustItemStockCore(id: string, delta: number) {
  const items = getItems();
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return;
  items[i] = { ...items[i], stock: (items[i].stock ?? 0) + delta, updatedAt: nowIso() };
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
  if (i >= 0) customers[i] = { ...customers[i], ...c, updatedAt: nowIso() };
  else customers.unshift({ ...c, createdAt: nowIso(), updatedAt: nowIso() });
  setCustomers(customers);
}

function removeCustomerCore(id: string) {
  setCustomers(getCustomers().filter((x) => x.id !== id));
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

function normalizePayments(raw: any): Payment[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((p: any) => ({
      id: String(p.id ?? uid("pay")),
      amount: Number(p.amount ?? 0),
      dateIso: String(p.dateIso ?? nowIso()),
      note: p.note ? String(p.note) : undefined,
    }))
    .filter((p) => Number(p.amount) > 0);
}

export function getSales(): Sale[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.sales), []);
  const normalized: Sale[] = (raw || []).map((x) => ({
    id: String(x.id ?? uid("sale")),
    itemId: String(x.itemId ?? ""),
    itemName: String(x.itemName ?? ""),
    qty: Number(x.qty ?? 0),
    unitPrice: Number(x.unitPrice ?? 0),
    unitCostAtSale: Number.isFinite(Number(x.unitCostAtSale)) ? Number(x.unitCostAtSale) : undefined,
    total: Number(x.total ?? 0),
    customerId: x.customerId ? String(x.customerId) : undefined,
    customerName: x.customerName ? String(x.customerName) : undefined,
    payments: normalizePayments(x.payments),
    createdAt: String(x.createdAt ?? nowIso()),
  }));

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setSales(next: Sale[]) {
  localStorage.setItem(LS_KEYS.sales, JSON.stringify(next));
  emitChange();
}

export function salePaidSum(s: Sale) {
  return round2((s.payments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
}

export function saleRemaining(s: Sale) {
  const paid = salePaidSum(s);
  const rem = round2((Number(s.total) || 0) - paid);
  return rem < 0 ? 0 : rem;
}

export function addSale(input: Omit<Sale, "id" | "createdAt" | "total" | "payments">) {
  const sales = getSales();
  const createdAt = nowIso();

  const qty = Math.trunc(Number(input.qty) || 0);
  const unitPrice = round2(Number(input.unitPrice) || 0);
  const total = round2(qty * unitPrice);

  // ✅ lagre kost ved salgstidspunktet (fallback hvis vare ikke finnes)
  const items = getItems();
  const it = items.find((x) => x.id === input.itemId);
  const unitCostAtSale = Number.isFinite(Number(input.unitCostAtSale))
    ? Number(input.unitCostAtSale)
    : round2(Number(it?.cost ?? 0));

  const next: Sale = {
    id: uid("sale"),
    createdAt,
    total,
    payments: [],
    unitCostAtSale,
    ...input,
    qty,
    unitPrice,
  };

  sales.unshift(next);
  setSales(sales);
}

export function addSalePayment(saleId: string, amount: number, dateIso?: string, note?: string) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;

  const amt = round2(Number(amount) || 0);
  if (amt <= 0) return;

  const p: Payment = {
    id: uid("pay"),
    amount: amt,
    dateIso: dateIso ? String(dateIso) : nowIso(),
    note: note?.trim() ? note.trim() : undefined,
  };

  sales[i] = { ...sales[i], payments: [...(sales[i].payments ?? []), p] };
  setSales(sales);
}

export function removeSalePayment(saleId: string, paymentId: string) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;
  sales[i] = { ...sales[i], payments: (sales[i].payments ?? []).filter((p) => p.id !== paymentId) };
  setSales(sales);
}

export function settleSale(saleId: string) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;
  const rem = saleRemaining(sales[i]);
  if (rem <= 0) return;
  addSalePayment(saleId, rem, nowIso(), "Oppgjør");
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
      addPayment: (saleId: string, amount: number, dateIso?: string, note?: string) =>
        addSalePayment(saleId, amount, dateIso, note),
      removePayment: (saleId: string, paymentId: string) => removeSalePayment(saleId, paymentId),
      settle: (saleId: string) => settleSale(saleId),
    }),
    [sales]
  );
}

/* =========================
   Receivables (Gjeld til deg) + delbetaling
========================= */

export function getReceivables(): Receivable[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.receivables), []);
  const normalized: Receivable[] = (raw || []).map((x) => ({
    id: String(x.id ?? uid("rec")),
    title: String(x.title ?? "Gjeld"),
    debtorName: String(x.debtorName ?? ""),
    amount: Number(x.amount ?? 0),
    dueDate: x.dueDate ? String(x.dueDate) : undefined,
    note: x.note ? String(x.note) : undefined,
    payments: normalizePayments(x.payments),
    createdAt: String(x.createdAt ?? nowIso()),
    updatedAt: String(x.updatedAt ?? nowIso()),
  }));

  normalized.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return normalized.filter((r) => r.debtorName.trim().length > 0 && (Number(r.amount) || 0) > 0);
}

export function setReceivables(next: Receivable[]) {
  localStorage.setItem(LS_KEYS.receivables, JSON.stringify(next));
  emitChange();
}

export function calcOutstanding(amount: number, payments: Payment[]) {
  const paid = (payments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const rem = round2((Number(amount) || 0) - paid);
  return rem < 0 ? 0 : rem;
}

function upsertReceivable(r: Omit<Receivable, "createdAt" | "updatedAt">) {
  const all = getReceivables();
  const i = all.findIndex((x) => x.id === r.id);
  if (i >= 0) all[i] = { ...all[i], ...r, payments: r.payments ?? [], updatedAt: nowIso() };
  else all.unshift({ ...r, payments: r.payments ?? [], createdAt: nowIso(), updatedAt: nowIso() });
  setReceivables(all);
}

function removeReceivable(id: string) {
  setReceivables(getReceivables().filter((x) => x.id !== id));
}

function addReceivablePayment(id: string, amount: number, dateIso?: string, note?: string) {
  const all = getReceivables();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return;

  const amt = round2(Number(amount) || 0);
  if (amt <= 0) return;

  const p: Payment = {
    id: uid("pay"),
    amount: amt,
    dateIso: dateIso ? String(dateIso) : nowIso(),
    note: note?.trim() ? note.trim() : undefined,
  };

  all[i] = { ...all[i], payments: [...(all[i].payments ?? []), p], updatedAt: nowIso() };
  setReceivables(all);
}

function removeReceivablePayment(id: string, paymentId: string) {
  const all = getReceivables();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], payments: (all[i].payments ?? []).filter((p) => p.id !== paymentId), updatedAt: nowIso() };
  setReceivables(all);
}

function settleReceivable(id: string, dateIso?: string) {
  const all = getReceivables();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return;
  const rem = calcOutstanding(Number(all[i].amount) || 0, all[i].payments);
  if (rem <= 0) return;
  addReceivablePayment(id, rem, dateIso ?? nowIso(), "Oppgjør");
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
      upsert: (r: Omit<Receivable, "createdAt" | "updatedAt">) => upsertReceivable({ ...r, payments: r.payments ?? [] }),
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
   Export/Import ALT (varer+kunder+salg+gjeld)
========================= */

export function exportAllData() {
  return {
    version: 1,
    exportedAt: nowIso(),
    items: getItems(),
    customers: getCustomers(),
    sales: getSales(),
    receivables: getReceivables(),
  };
}

export function importAllData(parsed: any) {
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const customers = Array.isArray(parsed?.customers) ? parsed.customers : [];
  const sales = Array.isArray(parsed?.sales) ? parsed.sales : [];
  const receivables = Array.isArray(parsed?.receivables) ? parsed.receivables : [];

  setItems(items);
  setCustomers(customers);
  setSales(sales);
  setReceivables(receivables);
  emitChange();
}
