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

export type Sale = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;

  customerId?: string;
  customerName?: string;

  paid: boolean;
  paidAt?: string;

  createdAt: string;
};

export type Receivable = {
  id: string;
  debtorName: string;
  amount: number;
  dueDate?: string;
  note?: string;

  paid: boolean;
  paidAt?: string;

  createdAt: string;
  updatedAt: string;
};

export type BackupAll = {
  version: 1;
  exportedAt: string;
  theme: Theme;
  items: Vare[];
  customers: Customer[];
  sales: Sale[];
  receivables: Receivable[];
};

/* =========================
   Helpers
========================= */

const LS_KEYS = {
  items: "sg.items.v1",
  customers: "sg.customers.v1",
  sales: "sg.sales.v2",
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
  document.documentElement.dataset.theme = theme;
}

/* =========================
   Items
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

export function upsertItem(item: Omit<Vare, "createdAt" | "updatedAt">) {
  const items = getItems();
  const i = items.findIndex((x) => x.id === item.id);
  if (i >= 0) items[i] = { ...items[i], ...item, updatedAt: nowIso() };
  else items.unshift({ ...item, createdAt: nowIso(), updatedAt: nowIso() });
  setItems(items);
}

export function deleteItem(id: string) {
  setItems(getItems().filter((x) => x.id !== id));
}

export function adjustStock(id: string, delta: number) {
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
      upsert: (item: Omit<Vare, "createdAt" | "updatedAt">) => upsertItem(item),
      remove: (id: string) => deleteItem(id),
      adjust: (id: string, delta: number) => adjustStock(id, delta),
      setAll: (all: Vare[]) => setItems(all),
    }),
    [items]
  );
}

/* =========================
   Customers
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

export function upsertCustomer(c: Omit<Customer, "createdAt" | "updatedAt">) {
  const customers = getCustomers();
  const i = customers.findIndex((x) => x.id === c.id);
  if (i >= 0) customers[i] = { ...customers[i], ...c, updatedAt: nowIso() };
  else customers.unshift({ ...c, createdAt: nowIso(), updatedAt: nowIso() });
  setCustomers(customers);
}

export function deleteCustomer(id: string) {
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
      upsert: (c: Omit<Customer, "createdAt" | "updatedAt">) => upsertCustomer(c),
      remove: (id: string) => deleteCustomer(id),
      setAll: (all: Customer[]) => setCustomers(all),
    }),
    [customers]
  );
}

/* =========================
   Sales
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
    paid: Boolean(x.paid ?? false),
    paidAt: x.paidAt ? String(x.paidAt) : undefined,
    createdAt: String(x.createdAt ?? nowIso()),
  }));

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setSales(next: Sale[]) {
  localStorage.setItem(LS_KEYS.sales, JSON.stringify(next));
  emitChange();
}

export function addSale(input: Omit<Sale, "id" | "createdAt" | "total" | "paidAt"> & { paid?: boolean }) {
  const sales = getSales();
  const createdAt = nowIso();
  const total = round2((Number(input.qty) || 0) * (Number(input.unitPrice) || 0));
  const paid = Boolean(input.paid ?? false);

  const next: Sale = {
    id: uid("sale"),
    createdAt,
    total,
    itemId: input.itemId,
    itemName: input.itemName,
    qty: input.qty,
    unitPrice: input.unitPrice,
    customerId: input.customerId,
    customerName: input.customerName,
    paid,
    paidAt: paid ? nowIso() : undefined,
  };

  sales.unshift(next);
  setSales(sales);
  return next;
}

export function deleteSale(id: string) {
  setSales(getSales().filter((s) => s.id !== id));
}

export function setSalePaid(id: string, paid: boolean) {
  const sales = getSales();
  const i = sales.findIndex((s) => s.id === id);
  if (i < 0) return;
  sales[i] = { ...sales[i], paid, paidAt: paid ? nowIso() : undefined };
  setSales(sales);
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
      add: addSale,
      remove: deleteSale,
      setPaid: setSalePaid,
      setAll: (all: Sale[]) => setSales(all),
    }),
    [sales]
  );
}

/* =========================
   Receivables (Gjeld til deg)
========================= */

export function getReceivables(): Receivable[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.receivables), []);
  const normalized: Receivable[] = (raw || [])
    .map((x) => ({
      id: String(x.id ?? uid("rcv")),
      debtorName: String(x.debtorName ?? "").trim(),
      amount: Number(x.amount ?? 0),
      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,
      paid: Boolean(x.paid ?? false),
      paidAt: x.paidAt ? String(x.paidAt) : undefined,
      createdAt: String(x.createdAt ?? nowIso()),
      updatedAt: String(x.updatedAt ?? nowIso()),
    }))
    .filter((x) => x.debtorName.length > 0);

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setReceivables(next: Receivable[]) {
  localStorage.setItem(LS_KEYS.receivables, JSON.stringify(next));
  emitChange();
}

export function upsertReceivable(r: Omit<Receivable, "createdAt" | "updatedAt" | "paidAt"> & { paid?: boolean }) {
  const list = getReceivables();
  const i = list.findIndex((x) => x.id === r.id);
  const ts = nowIso();
  const paid = Boolean(r.paid ?? false);

  if (i >= 0) {
    list[i] = {
      ...list[i],
      ...r,
      paid,
      paidAt: paid ? (list[i].paidAt ?? ts) : undefined,
      updatedAt: ts,
    };
  } else {
    list.unshift({
      id: r.id,
      debtorName: r.debtorName,
      amount: Number(r.amount ?? 0),
      dueDate: r.dueDate,
      note: r.note,
      paid,
      paidAt: paid ? ts : undefined,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  setReceivables(list);
}

export function deleteReceivable(id: string) {
  setReceivables(getReceivables().filter((x) => x.id !== id));
}

export function setReceivablePaid(id: string, paid: boolean) {
  const list = getReceivables();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;

  list[i] = { ...list[i], paid, paidAt: paid ? nowIso() : undefined, updatedAt: nowIso() };
  setReceivables(list);
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
      upsert: upsertReceivable,
      remove: deleteReceivable,
      setPaid: setReceivablePaid,
      setAll: (all: Receivable[]) => setReceivables(all),
    }),
    [receivables]
  );
}

/* =========================
   Sale draft customer
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
   ✅ Export / Import ALL
========================= */

function normalizeItems(input: any[]): Vare[] {
  return (input || [])
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

function normalizeCustomers(input: any[]): Customer[] {
  return (input || [])
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

function normalizeSales(input: any[]): Sale[] {
  const list: Sale[] = (input || []).map((x) => {
    const qty = Number(x.qty ?? 0);
    const unitPrice = Number(x.unitPrice ?? 0);
    const total = Number.isFinite(Number(x.total)) ? Number(x.total) : round2(qty * unitPrice);

    const paid = Boolean(x.paid ?? false);

    return {
      id: String(x.id ?? uid("sale")),
      itemId: String(x.itemId ?? ""),
      itemName: String(x.itemName ?? ""),
      qty,
      unitPrice,
      total,
      customerId: x.customerId ? String(x.customerId) : undefined,
      customerName: x.customerName ? String(x.customerName) : undefined,
      paid,
      paidAt: x.paidAt ? String(x.paidAt) : paid ? nowIso() : undefined,
      createdAt: String(x.createdAt ?? nowIso()),
    };
  });

  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list;
}

function normalizeReceivables(input: any[]): Receivable[] {
  const list: Receivable[] = (input || [])
    .map((x) => ({
      id: String(x.id ?? uid("rcv")),
      debtorName: String(x.debtorName ?? "").trim(),
      amount: Number(x.amount ?? 0),
      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,
      paid: Boolean(x.paid ?? false),
      paidAt: x.paidAt ? String(x.paidAt) : undefined,
      createdAt: String(x.createdAt ?? nowIso()),
      updatedAt: String(x.updatedAt ?? nowIso()),
    }))
    .filter((x) => x.debtorName.length > 0);

  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list;
}

export function exportAll(): BackupAll {
  return {
    version: 1,
    exportedAt: nowIso(),
    theme: getTheme(),
    items: getItems(),
    customers: getCustomers(),
    sales: getSales(),
    receivables: getReceivables(),
  };
}

export function downloadExportAll() {
  const payload = exportAll();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sg-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAllFromObject(obj: any) {
  // Godtar både {items,...} og ren array på enkeltfelt (men vi forventer helst BackupAll)
  const items = normalizeItems(Array.isArray(obj?.items) ? obj.items : []);
  const customers = normalizeCustomers(Array.isArray(obj?.customers) ? obj.customers : []);
  const sales = normalizeSales(Array.isArray(obj?.sales) ? obj.sales : []);
  const receivables = normalizeReceivables(Array.isArray(obj?.receivables) ? obj.receivables : []);

  setItems(items);
  setCustomers(customers);
  setSales(sales);
  setReceivables(receivables);

  const theme: Theme = obj?.theme === "light" ? "light" : "dark";
  setTheme(theme);
  applyThemeToDom(theme);
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
      importAllFromObject(parsed);
      alert("Import fullført ✅");
    } catch {
      alert("Kunne ikke importere (ugyldig JSON).");
    }
  };
  input.click();
}

export function clearAllData() {
  Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
  emitChange();
}
