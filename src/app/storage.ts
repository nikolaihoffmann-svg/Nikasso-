// src/app/storage.ts
import { useEffect, useMemo, useState } from "react";

/* =========================
   Types
========================= */

export type Theme = "dark" | "light";

export type Vare = {
  id: string;
  name: string;
  price: number;
  cost: number;
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
  createdAt: string; // innbetalingsdato
  amount: number;
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

  // utestående/innbetalinger (valgfritt – kan brukes på “utestående salg” senere)
  payments?: Payment[];
};

export type Receivable = {
  id: string;
  debtorName: string;
  amount: number; // opprinnelig beløp
  dueDate?: string; // yyyy-mm-dd
  note?: string;
  createdAt: string;
  updatedAt: string;

  payments?: Payment[]; // delbetalinger
};

/* =========================
   Keys + helpers
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

function normalizePayments(raw: any): Payment[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  return arr
    .map((p) => ({
      id: String(p.id ?? uid("pay")),
      createdAt: String(p.createdAt ?? nowIso()),
      amount: Number(p.amount ?? 0),
      note: p.note ? String(p.note) : undefined,
    }))
    .filter((p) => (Number(p.amount) || 0) > 0);
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
  document.documentElement.dataset.theme = theme; // CSS: :root[data-theme="light"]
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setState] = useState<Theme>(() => getTheme());
  useEffect(() => {
    const on = () => setState(getTheme());
    window.addEventListener("storage", on);
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener(EVT, on);
    };
  }, []);
  return [theme, setTheme];
}

/* =========================
   Items (Varer)
========================= */

export function getItems(): Vare[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.items), []);
  return (raw || [])
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
    const on = () => setState(getItems());
    window.addEventListener("storage", on);
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener(EVT, on);
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
  return (raw || [])
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
    const on = () => setState(getCustomers());
    window.addEventListener("storage", on);
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener(EVT, on);
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
   Sales (Salg)
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
    payments: normalizePayments(x.payments),
  }));

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setSales(next: Sale[]) {
  localStorage.setItem(LS_KEYS.sales, JSON.stringify(next));
  emitChange();
}

export function addSale(input: Omit<Sale, "id" | "createdAt" | "total">) {
  const sales = getSales();
  const createdAt = nowIso();
  const total = round2((Number(input.qty) || 0) * (Number(input.unitPrice) || 0));

  const next: Sale = {
    id: uid("sale"),
    createdAt,
    total,
    ...input,
    payments: Array.isArray((input as any).payments) ? normalizePayments((input as any).payments) : [],
  };

  sales.unshift(next);
  setSales(sales);
}

export function addSalePayment(saleId: string, amount: number, note?: string, createdAt?: string) {
  const sales = getSales();
  const i = sales.findIndex((s) => s.id === saleId);
  if (i < 0) return;

  const pay: Payment = {
    id: uid("pay"),
    createdAt: createdAt ?? nowIso(),
    amount: round2(amount),
    note: note?.trim() ? note.trim() : undefined,
  };

  const prev = Array.isArray(sales[i].payments) ? sales[i].payments! : [];
  sales[i] = { ...sales[i], payments: [pay, ...prev] };
  setSales(sales);
}

export function salePaidSum(s: Sale) {
  const pays = Array.isArray(s.payments) ? s.payments : [];
  return round2(pays.reduce((a, p) => a + (Number(p.amount) || 0), 0));
}

export function saleRemaining(s: Sale) {
  return round2((Number(s.total) || 0) - salePaidSum(s));
}

export function useSales() {
  const [sales, setState] = useState<Sale[]>(() => getSales());
  useEffect(() => {
    const on = () => setState(getSales());
    window.addEventListener("storage", on);
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener(EVT, on);
    };
  }, []);

  return useMemo(() => ({ sales }), [sales]);
}

/* =========================
   Receivables (Gjeld til meg)
========================= */

export function getReceivables(): Receivable[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.receivables), []);
  const normalized: Receivable[] = (raw || []).map((x) => ({
    id: String(x.id ?? uid("rcv")),
    debtorName: String(x.debtorName ?? "").trim(),
    amount: Number(x.amount ?? 0),
    dueDate: x.dueDate ? String(x.dueDate) : undefined,
    note: x.note ? String(x.note) : undefined,
    createdAt: String(x.createdAt ?? nowIso()),
    updatedAt: String(x.updatedAt ?? nowIso()),
    payments: normalizePayments(x.payments),
  }));

  // nyeste først
  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized.filter((r) => r.debtorName.length > 0 && (Number(r.amount) || 0) >= 0);
}

export function setReceivables(next: Receivable[]) {
  localStorage.setItem(LS_KEYS.receivables, JSON.stringify(next));
  emitChange();
}

function upsertReceivableCore(r: Omit<Receivable, "createdAt" | "updatedAt">) {
  const list = getReceivables();
  const i = list.findIndex((x) => x.id === r.id);
  const ts = nowIso();

  if (i >= 0) {
    list[i] = {
      ...list[i],
      ...r,
      payments: normalizePayments((r as any).payments ?? list[i].payments),
      updatedAt: ts,
    };
  } else {
    list.unshift({
      ...r,
      payments: normalizePayments((r as any).payments),
      createdAt: ts,
      updatedAt: ts,
    });
  }

  setReceivables(list);
}

function removeReceivableCore(id: string) {
  setReceivables(getReceivables().filter((x) => x.id !== id));
}

export function addReceivablePayment(receivableId: string, amount: number, note?: string, createdAt?: string) {
  const list = getReceivables();
  const i = list.findIndex((x) => x.id === receivableId);
  if (i < 0) return;

  const pay: Payment = {
    id: uid("pay"),
    createdAt: createdAt ?? nowIso(),
    amount: round2(amount),
    note: note?.trim() ? note.trim() : undefined,
  };

  const prev = Array.isArray(list[i].payments) ? list[i].payments! : [];
  list[i] = { ...list[i], payments: [pay, ...prev], updatedAt: nowIso() };
  setReceivables(list);
}

export function receivablePaidSum(r: Receivable) {
  const pays = Array.isArray(r.payments) ? r.payments : [];
  return round2(pays.reduce((a, p) => a + (Number(p.amount) || 0), 0));
}

export function receivableRemaining(r: Receivable) {
  return round2((Number(r.amount) || 0) - receivablePaidSum(r));
}

export function useReceivables() {
  const [receivables, setState] = useState<Receivable[]>(() => getReceivables());
  useEffect(() => {
    const on = () => setState(getReceivables());
    window.addEventListener("storage", on);
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener(EVT, on);
    };
  }, []);

  return useMemo(
    () => ({
      receivables,
      upsert: (r: Omit<Receivable, "createdAt" | "updatedAt">) => upsertReceivableCore(r),
      remove: (id: string) => removeReceivableCore(id),
      addPayment: (id: string, amount: number, note?: string, createdAt?: string) => addReceivablePayment(id, amount, note, createdAt),
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
   Export / Import ALT
========================= */

export function exportAllData() {
  return {
    version: 1,
    exportedAt: nowIso(),
    items: getItems(),
    customers: getCustomers(),
    sales: getSales(),
    receivables: getReceivables(),
    theme: getTheme(),
  };
}

export function downloadExportAll() {
  const payload = exportAllData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sg-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAll(payload: any) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const customers = Array.isArray(payload?.customers) ? payload.customers : [];
  const sales = Array.isArray(payload?.sales) ? payload.sales : [];
  const receivables = Array.isArray(payload?.receivables) ? payload.receivables : [];

  setItems(getItems().constructor === Array ? items : items); // bare for å være robust
  setCustomers(customers);
  setSales(sales);
  setReceivables(receivables);

  const t = payload?.theme === "light" ? "light" : "dark";
  setTheme(t);
  applyThemeToDom(t);
}

export function importAllFromFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      importAll(parsed);
      alert("Import fullført ✅");
    } catch {
      alert("Kunne ikke importere (ugyldig JSON).");
    }
  };
  input.click();
}

export function clearAllData() {
  localStorage.removeItem(LS_KEYS.items);
  localStorage.removeItem(LS_KEYS.customers);
  localStorage.removeItem(LS_KEYS.sales);
  localStorage.removeItem(LS_KEYS.receivables);
  localStorage.removeItem(LS_KEYS.saleDraftCustomer);
  localStorage.removeItem(LS_KEYS.theme);
  emitChange();
}
