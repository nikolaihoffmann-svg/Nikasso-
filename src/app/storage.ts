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
  /** ISO-tidspunkt for innbetaling */
  createdAt: string;
  note?: string;
};

export type SaleLine = {
  id: string; // ✅ trengs for UI (line.id)
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  /** kost per stk på salgstidspunktet (for korrekt historikk) */
  unitCostAtSale?: number;
};

export type Sale = {
  id: string;

  /** Ny modell: flere varer pr salg */
  lines: SaleLine[];

  total: number;

  customerId?: string;
  customerName?: string;

  payments: Payment[];
  paid: boolean;

  dueDate?: string;
  note?: string;

  createdAt: string;
};

export type Receivable = {
  id: string;

  /** Kort tittel (f.eks "Lån", "Faktura", "Diverse") */
  title: string;

  /** Hvem skylder deg */
  debtorName: string;

  /** Totalbeløp som skal inn */
  amount: number;

  dueDate?: string;
  note?: string;

  payments: Payment[];
  paid: boolean;

  createdAt: string;
  updatedAt: string;
};

export type AddSaleInput = {
  customerId?: string;
  customerName?: string;

  /** Ny måte */
  lines?: SaleLine[];

  /** status/innbetaling */
  paid?: boolean; // default: true
  payments?: Payment[];

  dueDate?: string;
  note?: string;
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
  saldo: "sg.saldo.v1",
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

function num(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: any, fallback = ""): string {
  const s = String(v ?? "");
  return s.length ? s : fallback;
}

function normalizePayments(raw: any): Payment[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  return arr
    .map((p) => ({
      id: str(p.id, uid("pay")),
      amount: round2(num(p.amount, 0)),
      createdAt: str(p.createdAt ?? p.date ?? p.dateIso ?? nowIso(), nowIso()),
      note: p.note ? String(p.note) : undefined,
    }))
    .filter((p) => p.amount !== 0);
}

function normalizeLines(raw: any): SaleLine[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  return arr
    .map((l) => ({
      id: str(l.id, uid("line")),
      itemId: str(l.itemId),
      itemName: str(l.itemName),
      qty: Math.trunc(num(l.qty, 0)),
      unitPrice: round2(num(l.unitPrice, 0)),
      unitCostAtSale: Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : undefined,
    }))
    .filter((l) => l.itemId && l.itemName && l.qty !== 0);
}

function sumLineTotal(lines: SaleLine[]): number {
  return round2(lines.reduce((a, l) => a + round2(num(l.qty, 0) * num(l.unitPrice, 0)), 0));
}

function listenToStorage<T>(get: () => T, set: (v: T) => void) {
  const onChange = () => set(get());
  window.addEventListener("storage", onChange);
  window.addEventListener(EVT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVT, onChange);
  };
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
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  document.documentElement.classList.toggle("theme-light", theme === "light");
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setState] = useState<Theme>(() => getTheme());

  useEffect(() => listenToStorage(getTheme, setState), []);
  return [theme, setTheme];
}

/* =========================
   Saldo (manuell)
========================= */

export function getSaldo(): number {
  const v = safeJsonParse<any>(localStorage.getItem(LS_KEYS.saldo), 0);
  return round2(num(v, 0));
}

export function setSaldo(next: number) {
  localStorage.setItem(LS_KEYS.saldo, JSON.stringify(round2(num(next, 0))));
  emitChange();
}

export function useSaldo(): [number, (n: number) => void] {
  const [saldo, setState] = useState<number>(() => getSaldo());

  useEffect(() => listenToStorage(getSaldo, setState), []);
  return [saldo, setSaldo];
}

/* =========================
   Items (Varer)
========================= */

export function getItems(): Vare[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.items), []);
  return (raw || [])
    .map((x) => ({
      id: str(x.id, uid("item")),
      name: str(x.name).trim(),
      price: round2(num(x.price, 0)),
      cost: round2(num(x.cost, 0)),
      stock: Math.trunc(num(x.stock, 0)),
      minStock: Math.trunc(num(x.minStock, 10)),
      createdAt: str(x.createdAt, nowIso()),
      updatedAt: str(x.updatedAt, nowIso()),
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
  const nextStock = (items[i].stock ?? 0) + delta;
  items[i] = { ...items[i], stock: nextStock, updatedAt: nowIso() };
  setItems(items);
}

export function useItems() {
  const [items, setState] = useState<Vare[]>(() => getItems());
  useEffect(() => listenToStorage(getItems, setState), []);

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
      id: str(x.id, uid("cust")),
      name: str(x.name).trim(),
      phone: x.phone ? String(x.phone).trim() : undefined,
      address: x.address ? String(x.address).trim() : undefined,
      note: x.note ? String(x.note).trim() : undefined,
      createdAt: str(x.createdAt, nowIso()),
      updatedAt: str(x.updatedAt, nowIso()),
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
  useEffect(() => listenToStorage(getCustomers, setState), []);

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

export function salePaidSum(s: Sale): number {
  if (Array.isArray(s.payments) && s.payments.length > 0) {
    return round2(s.payments.reduce((a, p) => a + num(p.amount, 0), 0));
  }
  return s.paid ? round2(num(s.total, 0)) : 0;
}

export function saleRemaining(s: Sale): number {
  const total = round2(num(s.total, 0));
  const paid = salePaidSum(s);
  return round2(Math.max(0, total - paid));
}

function saleLinesFromLegacy(x: any): SaleLine[] {
  const itemId = str(x.itemId);
  const itemName = str(x.itemName);
  const qty = Math.trunc(num(x.qty, 0));
  const unitPrice = round2(num(x.unitPrice, 0));
  if (!itemId || !itemName || qty === 0) return [];
  return [
    {
      id: uid("line"),
      itemId,
      itemName,
      qty,
      unitPrice,
      unitCostAtSale: Number.isFinite(Number(x.unitCostAtSale)) ? Number(x.unitCostAtSale) : undefined,
    },
  ];
}

export function getSales(): Sale[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.sales), []);
  const normalized: Sale[] = (raw || []).map((x) => {
    const payments = normalizePayments(x.payments);

    const lines = (() => {
      const ln = normalizeLines(x.lines);
      if (ln.length) return ln;
      return saleLinesFromLegacy(x);
    })();

    const total = round2(
      num(
        x.total,
        lines.length ? sumLineTotal(lines) : round2(num(x.qty, 0) * num(x.unitPrice, 0))
      )
    );

    const paidSum = payments.length ? payments.reduce((a, p) => a + num(p.amount, 0), 0) : 0;
    const paidLegacy = Boolean(x.paid);
    const paid = payments.length ? round2(paidSum) >= total : paidLegacy;

    return {
      id: str(x.id, uid("sale")),
      lines,
      total,

      customerId: x.customerId ? String(x.customerId) : undefined,
      customerName: x.customerName ? String(x.customerName) : undefined,

      payments,
      paid,

      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,

      createdAt: str(x.createdAt, nowIso()),
    };
  });

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setSales(next: Sale[]) {
  localStorage.setItem(LS_KEYS.sales, JSON.stringify(next));
  emitChange();
}

export function addSale(input: AddSaleInput) {
  const sales = getSales();
  const createdAt = nowIso();

  const lines = (() => {
    const ln = Array.isArray(input.lines) ? input.lines : [];
    const normalized = normalizeLines(ln);
    if (normalized.length) return normalized;
    return [];
  })();

  if (!lines.length) {
    throw new Error("addSale: lines mangler");
  }

  const total = sumLineTotal(lines);

  const incomingPayments = normalizePayments(input.payments);
  const paidDefault = input.paid ?? true;

  const payments =
    incomingPayments.length > 0
      ? incomingPayments
      : paidDefault
        ? [{ id: uid("pay"), amount: total, createdAt }]
        : [];

  const paid = round2(payments.reduce((a, p) => a + num(p.amount, 0), 0)) >= total;

  const next: Sale = {
    id: uid("sale"),
    createdAt,
    lines,
    total,
    customerId: input.customerId,
    customerName: input.customerName,
    payments,
    paid,
    dueDate: input.dueDate,
    note: input.note,
  };

  sales.unshift(next);
  setSales(sales);
}

export function addSalePayment(saleId: string, amount: number, note?: string, dateIso?: string) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;

  const s = sales[i];
  const payments = Array.isArray(s.payments) ? [...s.payments] : [];
  payments.push({
    id: uid("pay"),
    amount: round2(num(amount, 0)),
    createdAt: dateIso && dateIso.trim() ? dateIso : nowIso(),
    note: note?.trim() ? note.trim() : undefined,
  });

  const paid = saleRemaining({ ...s, payments }) <= 0;
  sales[i] = { ...s, payments, paid };
  setSales(sales);
}

export function removeSalePayment(saleId: string, paymentId: string) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;

  const s = sales[i];
  const payments = (Array.isArray(s.payments) ? s.payments : []).filter((p) => p.id !== paymentId);
  const paid = saleRemaining({ ...s, payments }) <= 0;
  sales[i] = { ...s, payments, paid };
  setSales(sales);
}

export function setSalePaid(saleId: string, paid: boolean) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;

  const s = sales[i];

  if (paid) {
    const rem = saleRemaining(s);
    const payments = Array.isArray(s.payments) ? [...s.payments] : [];
    if (rem > 0) payments.push({ id: uid("pay"), amount: rem, createdAt: nowIso() });
    sales[i] = { ...s, payments, paid: true };
  } else {
    sales[i] = { ...s, payments: [], paid: false };
  }

  setSales(sales);
}

export function removeSale(saleId: string, restoreStock: boolean) {
  const sales = getSales();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx < 0) return;

  const sale = sales[idx];

  if (restoreStock) {
    const items = getItems();
    const map = new Map(items.map((it) => [it.id, it] as const));

    for (const line of sale.lines || []) {
      const it = map.get(line.itemId);
      if (!it) continue;
      it.stock = Math.trunc(num(it.stock, 0) + num(line.qty, 0));
      it.updatedAt = nowIso();
    }
    setItems(Array.from(map.values()));
  }

  sales.splice(idx, 1);
  setSales(sales);
}

export function useSales() {
  const [sales, setState] = useState<Sale[]>(() => getSales());
  useEffect(() => listenToStorage(getSales, setState), []);

  return useMemo(
    () => ({
      sales,
      addPayment: (saleId: string, amount: number, note?: string, dateIso?: string) =>
        addSalePayment(saleId, amount, note, dateIso),
      removePayment: (saleId: string, paymentId: string) => removeSalePayment(saleId, paymentId),
      setPaid: (saleId: string, paid: boolean) => setSalePaid(saleId, paid),
      removeSale: (saleId: string, restoreStock: boolean) => removeSale(saleId, restoreStock),
      setAll: (all: Sale[]) => setSales(all),
    }),
    [sales]
  );
}

/* =========================
   Receivables (Gjeld til deg)
========================= */

export function receivablePaidSum(r: Receivable): number {
  if (Array.isArray(r.payments) && r.payments.length > 0) {
    return round2(r.payments.reduce((a, p) => a + num(p.amount, 0), 0));
  }
  return r.paid ? round2(num(r.amount, 0)) : 0;
}

export function receivableRemaining(r: Receivable): number {
  const total = round2(num(r.amount, 0));
  const paid = receivablePaidSum(r);
  return round2(Math.max(0, total - paid));
}

export function getReceivables(): Receivable[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.receivables), []);

  const normalized: Receivable[] = (raw || []).map((x) => {
    const amount = round2(num(x.amount, 0));
    const payments = normalizePayments(x.payments);
    const paid = payments.length ? round2(payments.reduce((a, p) => a + num(p.amount, 0), 0)) >= amount : Boolean(x.paid);

    return {
      id: str(x.id, uid("rcv")),
      title: str(x.title, "Gjeld"),
      debtorName: str(x.debtorName, "Ukjent"),
      amount,
      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,
      payments,
      paid,
      createdAt: str(x.createdAt, nowIso()),
      updatedAt: str(x.updatedAt, nowIso()),
    };
  });

  normalized.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return normalized;
}

export function setReceivables(next: Receivable[]) {
  localStorage.setItem(LS_KEYS.receivables, JSON.stringify(next));
  emitChange();
}

function upsertReceivableCore(r: Omit<Receivable, "createdAt" | "updatedAt" | "paid">) {
  const list = getReceivables();
  const i = list.findIndex((x) => x.id === r.id);

  const amount = round2(num((r as any).amount, 0));
  const payments = normalizePayments((r as any).payments);
  const paid = round2(payments.reduce((a, p) => a + num(p.amount, 0), 0)) >= amount;

  if (i >= 0) {
    list[i] = { ...list[i], ...r, amount, payments, paid, updatedAt: nowIso() };
  } else {
    list.unshift({
      ...(r as any),
      amount,
      payments,
      paid,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as Receivable);
  }

  setReceivables(list);
}

function removeReceivableCore(id: string) {
  setReceivables(getReceivables().filter((x) => x.id !== id));
}

function addReceivablePaymentCore(id: string, amount: number, note?: string, dateIso?: string) {
  const list = getReceivables();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;

  const r = list[i];
  const payments = Array.isArray(r.payments) ? [...r.payments] : [];
  payments.push({
    id: uid("pay"),
    amount: round2(num(amount, 0)),
    createdAt: dateIso && dateIso.trim() ? dateIso : nowIso(),
    note: note?.trim() ? note.trim() : undefined,
  });

  const paid = receivableRemaining({ ...r, payments }) <= 0;
  list[i] = { ...r, payments, paid, updatedAt: nowIso() };
  setReceivables(list);
}

function removeReceivablePaymentCore(id: string, paymentId: string) {
  const list = getReceivables();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;

  const r = list[i];
  const payments = (Array.isArray(r.payments) ? r.payments : []).filter((p) => p.id !== paymentId);
  const paid = receivableRemaining({ ...r, payments }) <= 0;
  list[i] = { ...r, payments, paid, updatedAt: nowIso() };
  setReceivables(list);
}

export function useReceivables() {
  const [receivables, setState] = useState<Receivable[]>(() => getReceivables());
  useEffect(() => listenToStorage(getReceivables, setState), []);

  return useMemo(
    () => ({
      receivables,
      upsert: (r: Omit<Receivable, "createdAt" | "updatedAt" | "paid">) => upsertReceivableCore(r),
      remove: (id: string) => removeReceivableCore(id),
      addPayment: (id: string, amount: number, note?: string, dateIso?: string) =>
        addReceivablePaymentCore(id, amount, note, dateIso),
      removePayment: (id: string, paymentId: string) => removeReceivablePaymentCore(id, paymentId),
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
   Export / Import ALL
========================= */

export type ExportAllPayloadV1 = {
  version: 1;
  exportedAt: string;
  theme: Theme;
  saldo: number;
  items: Vare[];
  customers: Customer[];
  sales: Sale[];
  receivables: Receivable[];
};

export function makeExportAllPayload(): ExportAllPayloadV1 {
  return {
    version: 1,
    exportedAt: nowIso(),
    theme: getTheme(),
    saldo: getSaldo(),
    items: getItems(),
    customers: getCustomers(),
    sales: getSales(),
    receivables: getReceivables(),
  };
}

export function downloadExportAll(filename?: string): void {
  const payload = makeExportAllPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `nikasso-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAllFromFile(file: File, mode: "replace" | "merge" = "replace"): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text);

  const payload: ExportAllPayloadV1 =
    parsed && typeof parsed === "object" && parsed.version === 1
      ? parsed
      : {
          version: 1,
          exportedAt: nowIso(),
          theme: getTheme(),
          saldo: getSaldo(),
          items: Array.isArray(parsed?.items) ? parsed.items : [],
          customers: Array.isArray(parsed?.customers) ? parsed.customers : [],
          sales: Array.isArray(parsed?.sales) ? parsed.sales : [],
          receivables: Array.isArray(parsed?.receivables) ? parsed.receivables : [],
        };

  const nextItems = (Array.isArray(payload.items) ? payload.items : []).map((x: any) => ({
    id: str(x.id, uid("item")),
    name: str(x.name).trim(),
    price: round2(num(x.price, 0)),
    cost: round2(num(x.cost, 0)),
    stock: Math.trunc(num(x.stock, 0)),
    minStock: Math.trunc(num(x.minStock, 10)),
    createdAt: str(x.createdAt, nowIso()),
    updatedAt: str(x.updatedAt, nowIso()),
  })) as Vare[];

  const nextCustomers = (Array.isArray(payload.customers) ? payload.customers : []).map((x: any) => ({
    id: str(x.id, uid("cust")),
    name: str(x.name).trim(),
    phone: x.phone ? String(x.phone).trim() : undefined,
    address: x.address ? String(x.address).trim() : undefined,
    note: x.note ? String(x.note).trim() : undefined,
    createdAt: str(x.createdAt, nowIso()),
    updatedAt: str(x.updatedAt, nowIso()),
  })) as Customer[];

  const nextSales = (Array.isArray(payload.sales) ? payload.sales : []).map((x: any) => {
    const payments = normalizePayments(x.payments);
    const lines = (() => {
      const ln = normalizeLines(x.lines);
      if (ln.length) return ln;
      return saleLinesFromLegacy(x);
    })();

    const total = round2(num(x.total, lines.length ? sumLineTotal(lines) : 0));
    const paid = payments.length ? round2(payments.reduce((a, p) => a + num(p.amount, 0), 0)) >= total : Boolean(x.paid);

    return {
      id: str(x.id, uid("sale")),
      lines,
      total,
      customerId: x.customerId ? String(x.customerId) : undefined,
      customerName: x.customerName ? String(x.customerName) : undefined,
      payments,
      paid,
      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,
      createdAt: str(x.createdAt, nowIso()),
    } as Sale;
  });

  const nextReceivables = (Array.isArray(payload.receivables) ? payload.receivables : []).map((x: any) => {
    const amount = round2(num(x.amount, 0));
    const payments = normalizePayments(x.payments);
    const paid = payments.length ? round2(payments.reduce((a, p) => a + num(p.amount, 0), 0)) >= amount : Boolean(x.paid);

    return {
      id: str(x.id, uid("rcv")),
      title: str(x.title, "Gjeld"),
      debtorName: str(x.debtorName, "Ukjent"),
      amount,
      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,
      payments,
      paid,
      createdAt: str(x.createdAt, nowIso()),
      updatedAt: str(x.updatedAt, nowIso()),
    } as Receivable;
  });

  const mergeById = <T extends { id: string }>(a: T[], b: T[]) => {
    const m = new Map<string, T>();
    for (const x of a) m.set(x.id, x);
    for (const x of b) m.set(x.id, x);
    return Array.from(m.values());
  };

  if (mode === "merge") {
    setItems(mergeById(getItems(), nextItems));
    setCustomers(mergeById(getCustomers(), nextCustomers));
    setSales(mergeById(getSales(), nextSales));
    setReceivables(mergeById(getReceivables(), nextReceivables));
  } else {
    setItems(nextItems);
    setCustomers(nextCustomers);
    setSales(nextSales);
    setReceivables(nextReceivables);
  }

  setSaldo(round2(num(payload.saldo, getSaldo())));

  if (payload.theme === "light" || payload.theme === "dark") {
    setTheme(payload.theme);
    applyThemeToDom(payload.theme);
  }

  emitChange();
}

export function pickImportAllFile(mode: "replace" | "merge" = "replace"): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    await importAllFromFile(file, mode);
  };
  input.click();
}

export function clearAllData(): void {
  localStorage.removeItem(LS_KEYS.items);
  localStorage.removeItem(LS_KEYS.customers);
  localStorage.removeItem(LS_KEYS.sales);
  localStorage.removeItem(LS_KEYS.receivables);
  localStorage.removeItem(LS_KEYS.saleDraftCustomer);
  localStorage.removeItem(LS_KEYS.saldo);
  // theme lar vi stå
  emitChange();
}

/* =========================
   Backup summary (for Backup.tsx)
========================= */

export function getStorageSummary() {
  const items = getItems();
  const customers = getCustomers();
  const sales = getSales();
  const receivables = getReceivables();
  const saldo = getSaldo();

  const unpaidSales = round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
  const unpaidReceivables = round2(receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0));

  const approxBytes =
    (localStorage.getItem(LS_KEYS.items)?.length || 0) +
    (localStorage.getItem(LS_KEYS.customers)?.length || 0) +
    (localStorage.getItem(LS_KEYS.sales)?.length || 0) +
    (localStorage.getItem(LS_KEYS.receivables)?.length || 0) +
    (localStorage.getItem(LS_KEYS.saldo)?.length || 0) +
    (localStorage.getItem(LS_KEYS.theme)?.length || 0);

  return {
    itemsCount: items.length,
    customersCount: customers.length,
    salesCount: sales.length,
    receivablesCount: receivables.length,
    unpaidSales,
    unpaidReceivables,
    saldo,
    approxBytes,
    items,
    customers,
    sales,
    receivables,
  };
}
