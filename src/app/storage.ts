// src/app/storage.ts
import { useEffect, useMemo, useState } from "react";

/* =========================
   Types
========================= */

export type Theme = "dark" | "light";

export type PurchaseKind = "varer" | "forbruk" | "utstyr";

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
  createdAt: string; // ISO
  note?: string;
};

export type SaleLine = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  unitCostAtSale?: number; // historikk
};

export type Sale = {
  id: string;

  // Ny modell (flere varer pr salg)
  lines: SaleLine[];

  // Legacy (for eldre visninger)
  itemId?: string;
  itemName?: string;
  qty?: number;
  unitPrice?: number;
  unitCostAtSale?: number;

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
  title: string; // f.eks "Gjeld", "Lån", "Faktura"
  debtorName: string; // hvem skylder DEG
  amount: number;
  dueDate?: string;
  note?: string;
  payments: Payment[];
  paid: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Leverandørgjeld: hva DU skylder andre */
export type Payable = {
  id: string;
  supplierName: string;
  title: string; // f.eks "Innkjøp", "Faktura"
  kind: PurchaseKind; // varer/forbruk/utstyr
  amount: number;
  dueDate?: string;
  note?: string;
  payments: Payment[];
  paid: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseLine = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitCost: number;
};

export type Purchase = {
  id: string;
  supplierName?: string;
  kind: PurchaseKind; // varer/forbruk/utstyr
  lines: PurchaseLine[];
  total: number;

  /** hvis ikke betalt: peker til Payable */
  payableId?: string;

  /** cost-oppdatering */
  costMode: "weighted" | "set_latest" | "keep";

  paid: boolean;
  dueDate?: string;
  note?: string;

  createdAt: string;
};

export type AddSaleInput = {
  customerId?: string;
  customerName?: string;
  lines?: SaleLine[];

  // legacy (1 vare)
  itemId?: string;
  itemName?: string;
  qty?: number;
  unitPrice?: number;
  unitCostAtSale?: number;

  paid?: boolean;
  payments?: Payment[];
  dueDate?: string;
  note?: string;
};

export type AddPurchaseInput = {
  supplierName?: string;
  kind?: PurchaseKind; // default "varer"
  lines: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    unitCost: number;
  }>;
  paid?: boolean; // default true
  dueDate?: string;
  note?: string;
  costMode?: "weighted" | "set_latest" | "keep"; // default weighted
  payableTitle?: string; // default "Innkjøp"
};

/* =========================
   Keys + Events
========================= */

const LS_KEYS = {
  items: "sg.items.v1",
  customers: "sg.customers.v1",
  sales: "sg.sales.v1",
  receivables: "sg.receivables.v1",
  payables: "sg.payables.v1",
  purchases: "sg.purchases.v1",
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

function normalizeSaleLines(raw: any): SaleLine[] {
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

function normalizePurchaseLines(raw: any): PurchaseLine[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  return arr
    .map((l) => ({
      id: str(l.id, uid("pl")),
      itemId: str(l.itemId),
      itemName: str(l.itemName),
      qty: Math.trunc(num(l.qty, 0)),
      unitCost: round2(num(l.unitCost, 0)),
    }))
    .filter((l) => l.itemId && l.itemName && l.qty !== 0);
}

function sumSaleLinesTotal(lines: SaleLine[]): number {
  return round2(lines.reduce((a, l) => a + round2(num(l.qty, 0) * num(l.unitPrice, 0)), 0));
}

function sumPurchaseLinesTotal(lines: PurchaseLine[]): number {
  return round2(lines.reduce((a, l) => a + round2(num(l.qty, 0) * num(l.unitCost, 0)), 0));
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

function enrichLegacyFieldsFromLines(s: Sale): Sale {
  if (Array.isArray(s.lines) && s.lines.length > 0) {
    const first = s.lines[0];
    return {
      ...s,
      itemId: s.itemId ?? first.itemId,
      itemName: s.itemName ?? first.itemName,
      qty: s.qty ?? first.qty,
      unitPrice: s.unitPrice ?? first.unitPrice,
      unitCostAtSale: s.unitCostAtSale ?? first.unitCostAtSale,
    };
  }
  return s;
}

function normalizeKind(k: any): PurchaseKind {
  return k === "forbruk" || k === "utstyr" ? k : "varer";
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
   Saldo
========================= */

export function getSaldo(): number {
  const v = safeJsonParse<any>(localStorage.getItem(LS_KEYS.saldo), 0);
  return round2(num(v, 0));
}

export function setSaldo(next: number): void {
  localStorage.setItem(LS_KEYS.saldo, JSON.stringify(round2(num(next, 0))));
  emitChange();
}

export function useSaldo(): [number, (n: number) => void] {
  const [saldo, setState] = useState<number>(() => getSaldo());

  useEffect(() => {
    const onChange = () => setState(getSaldo());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVT, onChange);
    };
  }, []);

  return [saldo, setSaldo];
}

/* =========================
   Items
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
  const nextStock = Math.trunc(num(items[i].stock, 0)) + Math.trunc(num(delta, 0));
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
   Customers
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
   Sales
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

export function getSales(): Sale[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.sales), []);

  const normalized: Sale[] = (raw || []).map((x) => {
    const payments = normalizePayments(x.payments);

    const lines = (() => {
      const ln = normalizeSaleLines(x.lines);
      if (ln.length) return ln;
      return saleLinesFromLegacy(x);
    })();

    const total = round2(
      num(x.total, lines.length ? sumSaleLinesTotal(lines) : round2(num(x.qty, 0) * num(x.unitPrice, 0)))
    );

    const paidSum = payments.length ? payments.reduce((a, p) => a + num(p.amount, 0), 0) : 0;
    const paidLegacy = Boolean(x.paid);
    const paid = payments.length ? round2(paidSum) >= total : paidLegacy;

    const sale: Sale = {
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

    return enrichLegacyFieldsFromLines({
      ...sale,
      itemId: x.itemId ? String(x.itemId) : undefined,
      itemName: x.itemName ? String(x.itemName) : undefined,
      qty: Number.isFinite(Number(x.qty)) ? Math.trunc(num(x.qty, 0)) : undefined,
      unitPrice: Number.isFinite(Number(x.unitPrice)) ? round2(num(x.unitPrice, 0)) : undefined,
      unitCostAtSale: Number.isFinite(Number(x.unitCostAtSale)) ? Number(x.unitCostAtSale) : undefined,
    });
  });

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setSales(next: Sale[]) {
  localStorage.setItem(LS_KEYS.sales, JSON.stringify(next));
  emitChange();
}

export function addSale(input: AddSaleInput): void {
  const sales = getSales();
  const createdAt = nowIso();

  const lines =
    input.lines && Array.isArray(input.lines) && input.lines.length > 0
      ? normalizeSaleLines(input.lines)
      : normalizeSaleLines(
          saleLinesFromLegacy({
            itemId: input.itemId,
            itemName: input.itemName,
            qty: input.qty,
            unitPrice: input.unitPrice,
            unitCostAtSale: input.unitCostAtSale,
          })
        );

  if (lines.length === 0) return;

  const total = sumSaleLinesTotal(lines);
  const payments = normalizePayments(input.payments);
  const paidFlag = input.paid === undefined ? true : Boolean(input.paid);

  const next: Sale = enrichLegacyFieldsFromLines({
    id: uid("sale"),
    createdAt,
    lines,
    total,
    customerId: input.customerId,
    customerName: input.customerName,
    payments: payments.length ? payments : [],
    paid: payments.length ? round2(payments.reduce((a, p) => a + num(p.amount, 0), 0)) >= total : paidFlag,
    dueDate: input.dueDate?.trim() ? input.dueDate.trim() : undefined,
    note: input.note?.trim() ? input.note.trim() : undefined,
  });

  sales.unshift(next);
  setSales(sales);
}

function setSalePaidCore(saleId: string, paid: boolean): void {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;
  sales[i] = { ...sales[i], paid: Boolean(paid) };
  setSales(sales);
}

function addSalePaymentCore(saleId: string, amount: number, note?: string, dateIso?: string): void {
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

  const paidNow = saleRemaining({ ...s, payments, paid: s.paid }) <= 0;
  sales[i] = { ...s, payments, paid: paidNow || s.paid };
  setSales(sales);
}

function removeSaleCore(saleId: string, restoreStock: boolean): void {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;

  const s = sales[i];

  if (restoreStock) {
    const items = getItems();
    for (const line of s.lines || []) {
      const idx = items.findIndex((it) => it.id === line.itemId);
      if (idx >= 0) {
        items[idx] = {
          ...items[idx],
          stock: Math.trunc(num(items[idx].stock, 0)) + Math.trunc(num(line.qty, 0)),
          updatedAt: nowIso(),
        };
      }
    }
    setItems(items);
  }

  sales.splice(i, 1);
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
      setPaid: (saleId: string, paid: boolean) => setSalePaidCore(saleId, paid),
      removeSale: (saleId: string, restoreStock: boolean) => removeSaleCore(saleId, restoreStock),
    }),
    [sales]
  );
}

export function setSalePaid(saleId: string, paid: boolean): void {
  setSalePaidCore(saleId, paid);
}

export function addSalePayment(saleId: string, amount: number, note?: string, dateIso?: string): void {
  addSalePaymentCore(saleId, amount, note, dateIso);
}

/* =========================
   Receivables (gjeld til deg)
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
    const payments = normalizePayments(x.payments);
    const amount = round2(num(x.amount, 0));
    const paid = payments.length ? receivableRemaining({ ...(x as any), payments, amount } as Receivable) <= 0 : Boolean(x.paid);

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

  const payments = normalizePayments((r as any).payments);
  const amount = round2(num((r as any).amount, 0));
  const paid = receivableRemaining({ ...(r as any), payments, amount } as Receivable) <= 0;

  if (i >= 0) list[i] = { ...list[i], ...r, amount, payments, paid, updatedAt: nowIso() };
  else list.unshift({ ...(r as any), amount, payments, paid, createdAt: nowIso(), updatedAt: nowIso() });

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
  const payments = [...(r.payments || [])];
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
  const payments = (r.payments || []).filter((p) => p.id !== paymentId);
  const paid = receivableRemaining({ ...r, payments }) <= 0;
  list[i] = { ...r, payments, paid, updatedAt: nowIso() };
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
      upsert: (r: Omit<Receivable, "createdAt" | "updatedAt" | "paid">) => upsertReceivableCore(r),
      remove: (id: string) => removeReceivableCore(id),
      addPayment: (id: string, amount: number, note?: string, dateIso?: string) => addReceivablePaymentCore(id, amount, note, dateIso),
      removePayment: (id: string, paymentId: string) => removeReceivablePaymentCore(id, paymentId),
      setAll: (all: Receivable[]) => setReceivables(all),
    }),
    [receivables]
  );
}

/* =========================
   Payables (DU skylder)
========================= */

export function payablePaidSum(p: Payable): number {
  if (Array.isArray(p.payments) && p.payments.length > 0) {
    return round2(p.payments.reduce((a, x) => a + num(x.amount, 0), 0));
  }
  return p.paid ? round2(num(p.amount, 0)) : 0;
}

export function payableRemaining(p: Payable): number {
  const total = round2(num(p.amount, 0));
  const paid = payablePaidSum(p);
  return round2(Math.max(0, total - paid));
}

export function getPayables(): Payable[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.payables), []);
  const normalized: Payable[] = (raw || []).map((x) => {
    const payments = normalizePayments(x.payments);
    const amount = round2(num(x.amount, 0));
    const paidSum = payments.length ? payments.reduce((a, p) => a + num(p.amount, 0), 0) : 0;
    const paidLegacy = Boolean(x.paid);
    const paid = payments.length ? round2(paidSum) >= amount : paidLegacy;

    return {
      id: str(x.id, uid("payable")),
      supplierName: str(x.supplierName, "Ukjent"),
      title: str(x.title, "Faktura"),
      kind: normalizeKind(x.kind),
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

export function setPayables(next: Payable[]) {
  localStorage.setItem(LS_KEYS.payables, JSON.stringify(next));
  emitChange();
}

function upsertPayableCore(p: Omit<Payable, "createdAt" | "updatedAt" | "paid">) {
  const list = getPayables();
  const i = list.findIndex((x) => x.id === p.id);

  const payments = normalizePayments((p as any).payments);
  const amount = round2(num((p as any).amount, 0));
  const paid = payableRemaining({ ...(p as any), payments, amount, paid: false } as Payable) <= 0;

  const next: Payable = {
    ...(p as any),
    amount,
    payments,
    paid,
    kind: normalizeKind((p as any).kind),
    createdAt: (p as any).createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  if (i >= 0) list[i] = { ...list[i], ...next };
  else list.unshift(next);

  setPayables(list);
}

function removePayableCore(id: string) {
  setPayables(getPayables().filter((x) => x.id !== id));
}

function addPayablePaymentCore(id: string, amount: number, note?: string, dateIso?: string) {
  const list = getPayables();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;

  const p = list[i];
  const payments = [...(p.payments || [])];
  payments.push({
    id: uid("pay"),
    amount: round2(num(amount, 0)),
    createdAt: dateIso && dateIso.trim() ? dateIso : nowIso(),
    note: note?.trim() ? note.trim() : undefined,
  });

  const paid = payableRemaining({ ...p, payments }) <= 0;
  list[i] = { ...p, payments, paid, updatedAt: nowIso() };
  setPayables(list);
}

export function usePayables() {
  const [payables, setState] = useState<Payable[]>(() => getPayables());

  useEffect(() => {
    const onChange = () => setState(getPayables());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVT, onChange);
    };
  }, []);

  return useMemo(
    () => ({
      payables,
      upsert: (p: Omit<Payable, "createdAt" | "updatedAt" | "paid">) => upsertPayableCore(p),
      remove: (id: string) => removePayableCore(id),
      addPayment: (id: string, amount: number, note?: string, dateIso?: string) => addPayablePaymentCore(id, amount, note, dateIso),
      setAll: (all: Payable[]) => setPayables(all),
    }),
    [payables]
  );
}

/* =========================
   Purchases (Innkjøp / penger brukt)
========================= */

export function getPurchases(): Purchase[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.purchases), []);
  const normalized: Purchase[] = (raw || []).map((x) => {
    const lines = normalizePurchaseLines(x.lines);
    const total = round2(num(x.total, lines.length ? sumPurchaseLinesTotal(lines) : 0));
    const paid = Boolean(x.paid);

    return {
      id: str(x.id, uid("pur")),
      supplierName: x.supplierName ? String(x.supplierName) : undefined,
      kind: normalizeKind(x.kind),
      lines,
      total,
      payableId: x.payableId ? String(x.payableId) : undefined,
      costMode: x.costMode === "set_latest" || x.costMode === "keep" ? x.costMode : "weighted",
      paid,
      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,
      createdAt: str(x.createdAt, nowIso()),
    };
  });

  normalized.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return normalized;
}

export function setPurchases(next: Purchase[]) {
  localStorage.setItem(LS_KEYS.purchases, JSON.stringify(next));
  emitChange();
}

/** Oppdater vare.cost ved innkjøp */
function applyCostUpdate(item: Vare, qtyBought: number, unitCost: number, mode: "weighted" | "set_latest" | "keep"): Vare {
  const q = Math.max(0, Math.trunc(num(qtyBought, 0)));
  const uc = round2(num(unitCost, 0));
  if (q <= 0 || uc <= 0) return item;

  if (mode === "keep") return item;

  if (mode === "set_latest") {
    return { ...item, cost: uc, updatedAt: nowIso() };
  }

  // weighted average: ((oldCost*oldStock) + (newCost*qty)) / (oldStock+qty)
  const oldStock = Math.max(0, Math.trunc(num(item.stock, 0)));
  const oldCost = round2(num(item.cost, 0));
  const denom = oldStock + q;
  const nextCost = denom > 0 ? round2((oldCost * oldStock + uc * q) / denom) : uc;
  return { ...item, cost: nextCost, updatedAt: nowIso() };
}

/** Registrer innkjøp + øk lager + evt opprett leverandørgjeld (payable) */
export function addPurchase(input: AddPurchaseInput): void {
  const purchases = getPurchases();

  const lines: PurchaseLine[] = (input.lines || [])
    .map((l) => ({
      id: uid("pl"),
      itemId: String(l.itemId || ""),
      itemName: String(l.itemName || ""),
      qty: Math.trunc(num(l.qty, 0)),
      unitCost: round2(num(l.unitCost, 0)),
    }))
    .filter((l) => l.itemId && l.itemName && l.qty > 0 && l.unitCost > 0);

  if (lines.length === 0) return;

  const total = sumPurchaseLinesTotal(lines);
  const paid = input.paid === undefined ? true : Boolean(input.paid);
  const costMode = input.costMode || "weighted";
  const kind = normalizeKind(input.kind);

  // 1) Oppdater varer: stock + cost (kun relevant for "varer"/"forbruk"; utstyr vil ofte ikke være lagervare,
  // men vi lar det være likt – du kan bruke "utstyr" også på varer om du vil.)
  const itemsNow = getItems();
  for (const ln of lines) {
    const idx = itemsNow.findIndex((it) => it.id === ln.itemId);
    if (idx < 0) continue;
    const it = itemsNow[idx];
    const nextStock = Math.trunc(num(it.stock, 0)) + Math.trunc(num(ln.qty, 0));
    const updatedCostItem = applyCostUpdate({ ...it, stock: nextStock }, ln.qty, ln.unitCost, costMode);
    itemsNow[idx] = { ...updatedCostItem, stock: nextStock, updatedAt: nowIso() };
  }
  setItems(itemsNow);

  // 2) Opprett payable hvis ikke betalt
  let payableId: string | undefined = undefined;
  if (!paid) {
    const payables = getPayables();
    payableId = uid("payable");
    const p: Payable = {
      id: payableId,
      supplierName: input.supplierName?.trim() ? input.supplierName.trim() : "Ukjent",
      title: input.payableTitle?.trim() ? input.payableTitle.trim() : "Innkjøp",
      kind,
      amount: total,
      dueDate: input.dueDate?.trim() ? input.dueDate.trim() : undefined,
      note: input.note?.trim() ? input.note.trim() : undefined,
      payments: [],
      paid: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    payables.unshift(p);
    setPayables(payables);
  }

  // 3) Lagre purchase
  const next: Purchase = {
    id: uid("pur"),
    supplierName: input.supplierName?.trim() ? input.supplierName.trim() : undefined,
    kind,
    lines,
    total,
    payableId,
    costMode,
    paid,
    dueDate: input.dueDate?.trim() ? input.dueDate.trim() : undefined,
    note: input.note?.trim() ? input.note.trim() : undefined,
    createdAt: nowIso(),
  };
  purchases.unshift(next);
  setPurchases(purchases);
}

export function usePurchases() {
  const [purchases, setState] = useState<Purchase[]>(() => getPurchases());

  useEffect(() => {
    const onChange = () => setState(getPurchases());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVT, onChange);
    };
  }, []);

  return useMemo(
    () => ({
      purchases,
      add: (input: AddPurchaseInput) => addPurchase(input),
      setAll: (all: Purchase[]) => setPurchases(all),
    }),
    [purchases]
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
  payables: Payable[];
  purchases: Purchase[];
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
    payables: getPayables(),
    purchases: getPurchases(),
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
          payables: Array.isArray(parsed?.payables) ? parsed.payables : [],
          purchases: Array.isArray(parsed?.purchases) ? parsed.purchases : [],
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
      const ln = normalizeSaleLines(x.lines);
      if (ln.length) return ln;
      return saleLinesFromLegacy(x);
    })();
    const total = round2(num(x.total, lines.length ? sumSaleLinesTotal(lines) : round2(num(x.qty, 0) * num(x.unitPrice, 0))));
    const paidSum = payments.length ? payments.reduce((a, p) => a + num(p.amount, 0), 0) : 0;
    const paid = payments.length ? round2(paidSum) >= total : Boolean(x.paid);

    return enrichLegacyFieldsFromLines({
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
    });
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

  const nextPayables = (Array.isArray(payload.payables) ? payload.payables : []).map((x: any) => {
    const amount = round2(num(x.amount, 0));
    const payments = normalizePayments(x.payments);
    const paid = payments.length ? round2(payments.reduce((a, p) => a + num(p.amount, 0), 0)) >= amount : Boolean(x.paid);

    return {
      id: str(x.id, uid("payable")),
      supplierName: str(x.supplierName, "Ukjent"),
      title: str(x.title, "Faktura"),
      kind: normalizeKind(x.kind),
      amount,
      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,
      payments,
      paid,
      createdAt: str(x.createdAt, nowIso()),
      updatedAt: str(x.updatedAt, nowIso()),
    } as Payable;
  });

  const nextPurchases = (Array.isArray(payload.purchases) ? payload.purchases : []).map((x: any) => {
    const lines = normalizePurchaseLines(x.lines);
    return {
      id: str(x.id, uid("pur")),
      supplierName: x.supplierName ? String(x.supplierName) : undefined,
      kind: normalizeKind(x.kind),
      lines,
      total: round2(num(x.total, lines.length ? sumPurchaseLinesTotal(lines) : 0)),
      payableId: x.payableId ? String(x.payableId) : undefined,
      costMode: x.costMode === "set_latest" || x.costMode === "keep" ? x.costMode : "weighted",
      paid: Boolean(x.paid),
      dueDate: x.dueDate ? String(x.dueDate) : undefined,
      note: x.note ? String(x.note) : undefined,
      createdAt: str(x.createdAt, nowIso()),
    } as Purchase;
  });

  if (mode === "merge") {
    const byId = <T extends { id: string }>(a: T[], b: T[]) => {
      const m = new Map<string, T>();
      for (const x of a) m.set(x.id, x);
      for (const x of b) m.set(x.id, x);
      return Array.from(m.values());
    };

    setItems(byId(getItems(), nextItems));
    setCustomers(byId(getCustomers(), nextCustomers));
    setSales(byId(getSales(), nextSales));
    setReceivables(byId(getReceivables(), nextReceivables));
    setPayables(byId(getPayables(), nextPayables));
    setPurchases(byId(getPurchases(), nextPurchases));
  } else {
    setItems(nextItems);
    setCustomers(nextCustomers);
    setSales(nextSales);
    setReceivables(nextReceivables);
    setPayables(nextPayables);
    setPurchases(nextPurchases);
  }

  setSaldo(round2(num((payload as any).saldo, 0)));

  if (payload.theme === "light" || payload.theme === "dark") {
    setTheme(payload.theme);
    applyThemeToDom(payload.theme);
  }

  emitChange();
}

export function clearAllData(): void {
  localStorage.removeItem(LS_KEYS.items);
  localStorage.removeItem(LS_KEYS.customers);
  localStorage.removeItem(LS_KEYS.sales);
  localStorage.removeItem(LS_KEYS.receivables);
  localStorage.removeItem(LS_KEYS.payables);
  localStorage.removeItem(LS_KEYS.purchases);
  localStorage.removeItem(LS_KEYS.saleDraftCustomer);
  localStorage.removeItem(LS_KEYS.saldo);
  emitChange();
}

/** File picker for import (for onClick) */
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

export type StorageSummary = {
  itemsCount: number;
  customersCount: number;
  salesCount: number;
  receivablesCount: number;
  payablesCount: number;
  purchasesCount: number;

  unpaidSales: number;
  unpaidReceivables: number;
  unpaidPayables: number;

  spentTotal: number;
  spentVarer: number;
  spentForbruk: number;
  spentUtstyr: number;

  saldo: number;
  approxBytes: number;
};

export function getStorageSummary(): StorageSummary {
  const items = getItems();
  const customers = getCustomers();
  const sales = getSales();
  const receivables = getReceivables();
  const payables = getPayables();
  const purchases = getPurchases();

  const unpaidSales = round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
  const unpaidReceivables = round2(receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0));
  const unpaidPayables = round2(payables.reduce((a, p) => a + Math.max(0, payableRemaining(p)), 0));

  const spentTotal = round2(purchases.reduce((a, p) => a + (Number(p.total) || 0), 0));
  const spentVarer = round2(purchases.filter((p) => normalizeKind(p.kind) === "varer").reduce((a, p) => a + (Number(p.total) || 0), 0));
  const spentForbruk = round2(purchases.filter((p) => normalizeKind(p.kind) === "forbruk").reduce((a, p) => a + (Number(p.total) || 0), 0));
  const spentUtstyr = round2(purchases.filter((p) => normalizeKind(p.kind) === "utstyr").reduce((a, p) => a + (Number(p.total) || 0), 0));

  const approxBytes =
    (localStorage.getItem(LS_KEYS.items)?.length || 0) +
    (localStorage.getItem(LS_KEYS.customers)?.length || 0) +
    (localStorage.getItem(LS_KEYS.sales)?.length || 0) +
    (localStorage.getItem(LS_KEYS.receivables)?.length || 0) +
    (localStorage.getItem(LS_KEYS.payables)?.length || 0) +
    (localStorage.getItem(LS_KEYS.purchases)?.length || 0) +
    (localStorage.getItem(LS_KEYS.saldo)?.length || 0);

  return {
    itemsCount: items.length,
    customersCount: customers.length,
    salesCount: sales.length,
    receivablesCount: receivables.length,
    payablesCount: payables.length,
    purchasesCount: purchases.length,
    unpaidSales,
    unpaidReceivables,
    unpaidPayables,
    spentTotal,
    spentVarer,
    spentForbruk,
    spentUtstyr,
    saldo: getSaldo(),
    approxBytes,
  };
}
