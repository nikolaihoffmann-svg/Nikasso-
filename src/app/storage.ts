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
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;

  /** Kost per stk på salgstidspunktet (for historisk korrekt profitt). Valgfri for gamle salg. */
  unitCostAtSale?: number;
};

export type Sale = {
  id: string;

  /** Flere varer per salg */
  lines: SaleLine[];

  /** Total = sum(lines.total) */
  total: number;

  customerId?: string;
  customerName?: string;

  /** Delbetalinger (kan være tom). */
  payments: Payment[];

  /** Enkel status (vi holder den i sync med payments/total) */
  paid: boolean;

  /** Valgfri forfallsdato/notat på salg */
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
      const total = round2(num(l.total, qty * unitPrice));
      return {
        id: str(l.id, uid("line")),
        itemId: str(l.itemId),
        itemName: str(l.itemName).trim(),
        qty,
        unitPrice,
        total,
        unitCostAtSale: Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : undefined,
      } as SaleLine;
    })
    .filter((l) => l.itemId && l.itemName && l.qty > 0);

  return lines;
}

export function salePaidSum(s: Sale) {
  if (Array.isArray(s.payments) && s.payments.length > 0) {
    return round2(s.payments.reduce((a, p) => a + num(p.amount, 0), 0));
  }
  // fallback for gamle “paid”-salg uten payments
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
  document.documentElement.dataset.theme = theme; // CSS: :root[data-theme="light"]
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
  const n = Number(v);
  return Number.isFinite(n) ? round2(n) : 0;
}

export function setSaldo(amount: number) {
  localStorage.setItem(LS_KEYS.saldo, JSON.stringify(round2(num(amount, 0))));
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
   Items (Varer)
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
   Customers (Kunder)
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
   Sales (Salg)
========================= */

export function getSales(): Sale[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.sales), []);

  const normalized: Sale[] = (raw || []).map((x) => {
    // ✅ Migrering: hvis gammel modell (itemId/qty/unitPrice), lag en line[]
    const legacyHasSingle =
      (x.itemId && x.itemName && (x.qty !== undefined || x.unitPrice !== undefined)) && !Array.isArray(x.lines);

    const lines: SaleLine[] = Array.isArray(x.lines)
      ? normalizeSaleLines(x.lines)
      : legacyHasSingle
      ? [
          {
            id: uid("line"),
            itemId: str(x.itemId),
            itemName: str(x.itemName),
            qty: Math.trunc(num(x.qty, 0)),
            unitPrice: round2(num(x.unitPrice, 0)),
            total: round2(num(x.total, round2(num(x.qty, 0) * num(x.unitPrice, 0)))),
            unitCostAtSale: Number.isFinite(Number(x.unitCostAtSale)) ? Number(x.unitCostAtSale) : undefined,
          },
        ]
      : [];

    const totalFromLines = round2(lines.reduce((a, l) => a + num(l.total, 0), 0));
    const total = round2(num(x.total, totalFromLines));

    const payments = normalizePayments(x.payments);
    const paidSum = payments.length ? payments.reduce((a, p) => a + num(p.amount, 0), 0) : 0;

    // fallback for eldre data
    const paidLegacy = Boolean(x.paid);
    const paid = payments.length ? round2(paidSum) >= total : paidLegacy;

    return {
      id: str(x.id, uid("sale")),
      lines,
      total,

      customerId: x.customerId ? String(x.customerId) : undefined,
      customerName: x.customerName ? String(x.customerName) : undefined,

      payments: payments.length ? payments : [],
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

export type AddSaleInput = {
  lines: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    unitPrice: number;
    unitCostAtSale?: number;
  }>;
  customerId?: string;
  customerName?: string;
  dueDate?: string;
  note?: string;

  /** Default = true */
  paid?: boolean;

  /** Valgfri: om du vil legge inn betalinger eksplisitt */
  payments?: Payment[];
};

export function addSale(input: AddSaleInput) {
  const sales = getSales();
  const createdAt = nowIso();

  const lines: SaleLine[] = (input.lines || [])
    .map((l) => {
      const qty = Math.trunc(num(l.qty, 0));
      const unitPrice = round2(num(l.unitPrice, 0));
      const total = round2(qty * unitPrice);
      return {
        id: uid("line"),
        itemId: str(l.itemId),
        itemName: str(l.itemName),
        qty,
        unitPrice,
        total,
        unitCostAtSale: Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : undefined,
      };
    })
    .filter((l) => l.itemId && l.itemName && l.qty > 0);

  const total = round2(lines.reduce((a, l) => a + l.total, 0));
  const payments = normalizePayments(input.payments);

  // Default: betalt
  const paid = input.paid === false ? false : true;

  const next: Sale = {
    id: uid("sale"),
    createdAt,
    lines,
    total,
    payments: payments.length ? payments : [],
    paid: payments.length ? saleRemaining({ id: "tmp", createdAt, lines, total, payments, paid } as any) <= 0 : paid,
    customerId: input.customerId,
    customerName: input.customerName,
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
    // Vi lar payments stå som de er (kan være tom), men markerer paid=true
    sales[i] = { ...s, paid: true };
  } else {
    // Når du setter ubetalt: vi beholder payments (historikk), men paid=false
    sales[i] = { ...s, paid: false };
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

  const paid = saleRemaining({ ...s, payments }) <= 0;
  sales[i] = { ...s, payments, paid };
  setSales(sales);
}

function removeSalePaymentCore(saleId: string, paymentId: string) {
  const sales = getSales();
  const i = sales.findIndex((x) => x.id === saleId);
  if (i < 0) return;

  const s = sales[i];
  const payments = (Array.isArray(s.payments) ? s.payments : []).filter((p) => p.id !== paymentId);
  const paid = saleRemaining({ ...s, payments }) <= 0 ? true : s.paid; // hvis fortsatt fullt betalt
  sales[i] = { ...s, payments, paid };
  setSales(sales);
}

function removeSaleCore(saleId: string, restoreStock: boolean) {
  const sales = getSales();
  const s = sales.find((x) => x.id === saleId);
  if (!s) return;

  if (restoreStock) {
    const items = getItems();
    const map = new Map(items.map((it) => [it.id, it] as const));

    for (const line of s.lines || []) {
      const it = map.get(line.itemId);
      if (!it) continue;
      it.stock = Math.trunc(num(it.stock, 0) + Math.trunc(num(line.qty, 0)));
      it.updatedAt = nowIso();
    }

    setItems(Array.from(map.values()));
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
      removeSale: (saleId: string, restoreStock = true) => removeSaleCore(saleId, restoreStock),
      setAll: (all: Sale[]) => setSales(all),
    }),
    [sales]
  );
}

/** Ekstra exports (så pages kan importere uten å bruke hook direkte) */
export const setSalePaid = setSalePaidCore;
export const addSalePayment = addSalePaymentCore;
export const removeSalePayment = removeSalePaymentCore;
export const removeSale = removeSaleCore;

/* =========================
   Receivables (Gjeld til deg)
========================= */

export function getReceivables(): Receivable[] {
  const raw = safeJsonParse<any[]>(localStorage.getItem(LS_KEYS.receivables), []);

  const normalized: Receivable[] = (raw || []).map((x) => {
    const amount = round2(num(x.amount, 0));
    const payments = normalizePayments(x.payments);
    const paid = payments.length ? receivableRemaining({ ...x, payments, amount } as any) <= 0 : Boolean(x.paid);

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
  const paid = receivableRemaining({ ...(r as any), payments, amount: round2(num((r as any).amount, 0)) } as Receivable) <= 0;

  if (i >= 0) {
    list[i] = {
      ...list[i],
      ...r,
      amount: round2(num((r as any).amount, 0)),
      payments,
      paid,
      updatedAt: nowIso(),
    };
  } else {
    list.unshift({
      ...r,
      amount: round2(num((r as any).amount, 0)),
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

function setReceivablePaidCore(id: string, paid: boolean) {
  const list = getReceivables();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;

  const r = list[i];
  if (paid) {
    const rem = receivableRemaining(r);
    const payments = [...(r.payments || [])];
    if (rem > 0) payments.push({ id: uid("pay"), amount: rem, createdAt: nowIso() });
    list[i] = { ...r, payments, paid: true, updatedAt: nowIso() };
  } else {
    list[i] = { ...r, payments: [], paid: false, updatedAt: nowIso() };
  }
  setReceivables(list);
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
      setPaid: (id: string, paid: boolean) => setReceivablePaidCore(id, paid),
      addPayment: (id: string, amount: number, note?: string, dateIso?: string) => addReceivablePaymentCore(id, amount, note, dateIso),
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

export function downloadExportAll(filename?: string) {
  const payload = makeExportAllPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `salg-gjeld-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Alias pga feilmeldingen din */
export const downloadAllDataJson = downloadExportAll;

export async function importAllFromFile(file: File, mode: "replace" | "merge" = "replace") {
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

  const nextSaldo = round2(num((payload as any).saldo, getSaldo()));

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

    // lines eller legacy:
    const legacyHasSingle =
      (x.itemId && x.itemName && (x.qty !== undefined || x.unitPrice !== undefined)) && !Array.isArray(x.lines);

    const lines: SaleLine[] = Array.isArray(x.lines)
      ? normalizeSaleLines(x.lines)
      : legacyHasSingle
      ? [
          {
            id: uid("line"),
            itemId: str(x.itemId),
            itemName: str(x.itemName),
            qty: Math.trunc(num(x.qty, 0)),
            unitPrice: round2(num(x.unitPrice, 0)),
            total: round2(num(x.total, round2(num(x.qty, 0) * num(x.unitPrice, 0)))),
            unitCostAtSale: Number.isFinite(Number(x.unitCostAtSale)) ? Number(x.unitCostAtSale) : undefined,
          },
        ]
      : [];

    const totalFromLines = round2(lines.reduce((a, l) => a + num(l.total, 0), 0));
    const total = round2(num(x.total, totalFromLines));

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
    } as Receivable;
  });

  if (mode === "merge") {
    const byId = <T extends { id: string }>(a: T[], b: T[]) => {
      const m = new Map<string, T>();
      for (const x of a) m.set(x.id, x);
      for (const x of b) m.set(x.id, x);
      return Array.from(m.values());
    };

    setSaldo(nextSaldo);
    setItems(byId(getItems(), nextItems));
    setCustomers(byId(getCustomers(), nextCustomers));
    setSales(byId(getSales(), nextSales));
    setReceivables(byId(getReceivables(), nextReceivables));
  } else {
    setSaldo(nextSaldo);
    setItems(nextItems);
    setCustomers(nextCustomers);
    setSales(nextSales);
    setReceivables(nextReceivables);
  }

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
  // theme lar vi stå
  emitChange();
}

/* =========================
   File picker helper (for App/Backup buttons)
========================= */

export async function pickImportAllFile(mode: "replace" | "merge" = "replace") {
  return new Promise<void>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve();
        await importAllFromFile(file, mode);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
