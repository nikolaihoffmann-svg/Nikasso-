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
  createdAt: string; // ISO
  note?: string;
};

/** ✅ Ny: flere varer pr salg */
export type SaleLine = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  unitCostAtSale?: number;
};

export type Sale = {
  id: string;

  /** Legacy (holderes for kompatibilitet / enkel visning) */
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;

  /** ✅ Ny: linjer (kan være tom på gamle salg, men normaliseres i getSales()) */
  lines: SaleLine[];

  total: number;

  customerId?: string;
  customerName?: string;

  /** Legacy / fallback profitt (for gamle salg) */
  unitCostAtSale?: number;

  payments: Payment[];
  paid: boolean;

  dueDate?: string;
  note?: string;

  createdAt: string;
};

export type Receivable = {
  id: string;
  title: string;
  debtorName: string;
  amount: number;
  dueDate?: string;
  note?: string;
  payments: Payment[];
  paid: boolean;
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

function num(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function str(s: any, fallback = "") {
  const v = String(s ?? "");
  return v.length ? v : fallback;
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
  const lines = arr
    .map((l) => {
      const qty = Math.trunc(num(l.qty, 0));
      const unitPrice = round2(num(l.unitPrice, 0));
      const lineTotal = round2(num(l.lineTotal, qty * unitPrice));

      return {
        id: str(l.id, uid("line")),
        itemId: str(l.itemId, ""),
        itemName: str(l.itemName, ""),
        qty,
        unitPrice,
        lineTotal,
        unitCostAtSale: Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : undefined,
      } as SaleLine;
    })
    .filter((l) => l.itemId.trim().length > 0 && l.qty !== 0);

  return lines;
}

function makeLegacyLineFromSale(x: any): SaleLine | null {
  const itemId = str(x.itemId, "").trim();
  const itemName = str(x.itemName, "").trim();
  const qty = Math.trunc(num(x.qty, 0));
  const unitPrice = round2(num(x.unitPrice, 0));
  const lineTotal = round2(num(x.total, qty * unitPrice));
  if (!itemId || !itemName || qty === 0) return null;

  return {
    id: uid("line"),
    itemId,
    itemName,
    qty,
    unitPrice,
    lineTotal,
    unitCostAtSale: Number.isFinite(Number(x.unitCostAtSale)) ? Number(x.unitCostAtSale) : undefined,
  };
}

/* =========================
   Paid helpers
========================= */

export function salePaidSum(s: Sale) {
  if (Array.isArray(s.payments) && s.payments.length > 0) {
    return round2(s.payments.reduce((a, p) => a + num(p.amount, 0), 0));
  }
  return s.paid ? round2(num(s.total, 0)) : 0;
}

export function saleRemaining(s: Sale) {
  const total = round2(num(s.total, 0));
  const paid = salePaidSum(s);
  return round2(Math.max(0, total - paid));
}

export function receivablePaidSum(r: Receivable) {
  if (Array.isArray(r.payments) && r.payments.length > 0) {
    return round2(r.payments.reduce((a, p) => a + num(p.amount, 0), 0));
  }
  return r.paid ? round2(num(r.amount, 0)) : 0;
}

export function receivableRemaining(r: Receivable) {
  const total = round2(num(r.amount, 0));
  const paid = receivablePaidSum(r);
  return round2(Math.max(0, total - paid));
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

export function setSaldo(n: number) {
  localStorage.setItem(LS_KEYS.saldo, JSON.stringify(round2(num(n, 0))));
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
  const normalized: Vare[] = (raw || [])
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
   Customers
========================= */

export function getCustomers(): Customer[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.customers), []);
  const normalized: Customer[] = (raw || [])
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
   Sales
========================= */

export function getSales(): Sale[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.sales), []);

  const normalized: Sale[] = (raw || []).map((x) => {
    const payments = normalizePayments(x.payments);

    // lines (ny) eller fallback (gammel)
    let lines = normalizeSaleLines(x.lines);
    if (!lines.length) {
      const legacy = makeLegacyLineFromSale(x);
      lines = legacy ? [legacy] : [];
    }

    // total = sum lines hvis finnes, ellers fallback
    const totalFromLines = round2(lines.reduce((a, l) => a + num(l.lineTotal, 0), 0));
    const fallbackTotal = round2(num(x.total, round2(num(x.qty, 0) * num(x.unitPrice, 0))));
    const total = lines.length ? totalFromLines : fallbackTotal;

    // paid = payments sum >= total, ellers legacy bool
    const paidSum = payments.length ? payments.reduce((a, p) => a + num(p.amount, 0), 0) : 0;
    const paidLegacy = Boolean(x.paid);
    const paid = payments.length ? round2(paidSum) >= total : paidLegacy;

    // legacy display fields (for enkel listetekst)
    const legacyItemId = str(x.itemId, lines[0]?.itemId ?? "");
    const legacyItemName =
      str(x.itemName, "") ||
      (lines.length > 1 ? `Flere varer (${lines.length})` : (lines[0]?.itemName ?? "Salg"));
    const legacyQty = Math.trunc(num(x.qty, lines.reduce((a, l) => a + num(l.qty, 0), 0)));
    const legacyUnitPrice = round2(num(x.unitPrice, lines.length === 1 ? lines[0]?.unitPrice ?? 0 : 0));

    return {
      id: str(x.id, uid("sale")),
      itemId: legacyItemId,
      itemName: legacyItemName,
      qty: legacyQty,
      unitPrice: legacyUnitPrice,
      lines,
      total,

      customerId: x.customerId ? String(x.customerId) : undefined,
      customerName: x.customerName ? String(x.customerName) : undefined,

      unitCostAtSale: Number.isFinite(Number(x.unitCostAtSale)) ? Number(x.unitCostAtSale) : undefined,

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

type AddSaleInput = Omit<Sale, "id" | "createdAt" | "total" | "lines"> & {
  lines?: Omit<SaleLine, "id" | "lineTotal">[]; // vi fyller id/lineTotal
  payments?: Payment[];
  paid?: boolean;
};

export function addSale(input: AddSaleInput) {
  const sales = getSales();
  const createdAt = nowIso();

  const incomingLines = Array.isArray(input.lines) ? input.lines : [];
  const lines: SaleLine[] = incomingLines.length
    ? incomingLines
        .map((l) => {
          const qty = Math.trunc(num(l.qty, 0));
          const unitPrice = round2(num(l.unitPrice, 0));
          return {
            id: uid("line"),
            itemId: str(l.itemId, ""),
            itemName: str(l.itemName, ""),
            qty,
            unitPrice,
            lineTotal: round2(qty * unitPrice),
            unitCostAtSale: Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : undefined,
          } as SaleLine;
        })
        .filter((l) => l.itemId.trim().length > 0 && l.qty !== 0)
    : [];

  const total = lines.length
    ? round2(lines.reduce((a, l) => a + num(l.lineTotal, 0), 0))
    : round2(num(input.qty, 0) * num(input.unitPrice, 0));

  const payments = normalizePayments(input.payments);

  // ✅ Default paid = true (hvis ikke spesifisert)
  const paidFlag = input.paid === undefined ? true : Boolean(input.paid);

  const paid =
    payments.length > 0 ? round2(payments.reduce((a, p) => a + num(p.amount, 0), 0)) >= total : paidFlag;

  // legacy “summary” fields
  const summaryName = lines.length > 1 ? `Flere varer (${lines.length})` : (lines[0]?.itemName ?? input.itemName ?? "Salg");
  const summaryItemId = lines[0]?.itemId ?? input.itemId ?? "";
  const summaryQty = lines.length ? lines.reduce((a, l) => a + Math.trunc(num(l.qty, 0)), 0) : Math.trunc(num(input.qty, 0));
  const summaryUnitPrice = lines.length === 1 ? round2(num(lines[0]?.unitPrice, 0)) : round2(num(input.unitPrice, 0));

  const next: Sale = {
    id: uid("sale"),
    createdAt,
    total,

    itemId: summaryItemId,
    itemName: summaryName,
    qty: summaryQty,
    unitPrice: summaryUnitPrice,

    lines,

    customerId: input.customerId,
    customerName: input.customerName,

    unitCostAtSale: Number.isFinite(Number(input.unitCostAtSale)) ? Number(input.unitCostAtSale) : undefined,

    payments,
    paid,

    dueDate: input.dueDate,
    note: input.note,
  };

  sales.unshift(next);
  setSales(sales);
}

function setSalePaidCore(saleId: string, paid: boolean) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;

  const s = sales[i];
  if (paid) {
    // betalt = bare flagg true (payments kan være tomt)
    sales[i] = { ...s, paid: true };
  } else {
    // ubetalt = tøm payments og flagg false
    sales[i] = { ...s, payments: [], paid: false };
  }
  setSales(sales);
}

function addSalePaymentCore(saleId: string, amount: number, note?: string, dateIso?: string) {
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

  const paid = saleRemaining({ ...s, payments, paid: s.paid }) <= 0;
  sales[i] = { ...s, payments, paid };
  setSales(sales);
}

/** ✅ Brukes av UI (note før dateIso) */
export function addSalePayment(saleId: string, amount: number, note?: string, dateIso?: string) {
  addSalePaymentCore(saleId, amount, note, dateIso);
}

function removeSalePaymentCore(saleId: string, paymentId: string) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;

  const s = sales[i];
  const payments = (Array.isArray(s.payments) ? s.payments : []).filter((p) => p.id !== paymentId);
  const paid = saleRemaining({ ...s, payments, paid: s.paid }) <= 0;
  sales[i] = { ...s, payments, paid };
  setSales(sales);
}

function removeSaleCore(saleId: string, restoreStock: boolean) {
  const sales = getSales();
  const s = sales.find((x) => x.id === saleId);
  if (!s) return;

  if (restoreStock) {
    const items = getItems();
    const byId = new Map(items.map((it) => [it.id, it] as const));

    const lines = Array.isArray(s.lines) && s.lines.length ? s.lines : (makeLegacyLineFromSale(s) ? [makeLegacyLineFromSale(s)!] : []);
    for (const l of lines) {
      const it = byId.get(l.itemId);
      if (!it) continue;
      it.stock = Math.trunc(num(it.stock, 0)) + Math.trunc(num(l.qty, 0));
      it.updatedAt = nowIso();
    }

    setItems(Array.from(byId.values()));
  }

  setSales(sales.filter((x) => x.id !== saleId));
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
      addPayment: (saleId: string, amount: number, note?: string, dateIso?: string) =>
        addSalePaymentCore(saleId, amount, note, dateIso),
      removePayment: (saleId: string, paymentId: string) => removeSalePaymentCore(saleId, paymentId),
      removeSale: (saleId: string, restoreStock: boolean) => removeSaleCore(saleId, restoreStock),
      setAll: (all: Sale[]) => setSales(all),
    }),
    [sales]
  );
}

/* =========================
   Receivables
========================= */

export function getReceivables(): Receivable[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.receivables), []);

  const normalized: Receivable[] = (raw || []).map((x) => {
    const amount = round2(num(x.amount, 0));
    const payments = normalizePayments(x.payments);
    const paid = payments.length ? receivableRemaining({ ...(x as any), payments, amount } as any) <= 0 : Boolean(x.paid);

    return {
      id: str(x.id, uid("rec")),
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

  if (i >= 0) {
    list[i] = { ...list[i], ...r, amount, payments, paid, updatedAt: nowIso() };
  } else {
    list.unshift({ ...(r as any), amount, payments, paid, createdAt: nowIso(), updatedAt: nowIso() } as Receivable);
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

export function downloadExportAll(filename?: string) {
  const payload = makeExportAllPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `nikasso-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAllFromFile(file: File) {
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

  setItems((Array.isArray(payload.items) ? payload.items : []) as Vare[]);
  setCustomers((Array.isArray(payload.customers) ? payload.customers : []) as Customer[]);
  setSales((Array.isArray(payload.sales) ? payload.sales : []) as Sale[]);
  setReceivables((Array.isArray(payload.receivables) ? payload.receivables : []) as Receivable[]);

  if (typeof payload.saldo === "number") setSaldo(payload.saldo);

  if (payload.theme === "light" || payload.theme === "dark") {
    setTheme(payload.theme);
    applyThemeToDom(payload.theme);
  }

  emitChange();
}

export function clearAllData() {
  localStorage.removeItem(LS_KEYS.items);
  localStorage.removeItem(LS_KEYS.customers);
  localStorage.removeItem(LS_KEYS.sales);
  localStorage.removeItem(LS_KEYS.receivables);
  localStorage.removeItem(LS_KEYS.saleDraftCustomer);
  localStorage.removeItem(LS_KEYS.saldo);
  emitChange();
}
