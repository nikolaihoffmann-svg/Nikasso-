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
  minStock: number; // minimum (varsling)
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
  createdAt: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;

  // Ny løsning (brukes av Salg.tsx / Kunder.tsx)
  customerId?: string;
  customerName?: string;

  // Legacy (for gamle lagrede salg)
  customer?: string;

  note?: string;
};

type SaleDraftCustomer = { customerId: string; setAt: string };

/* =========================
   Storage keys / events
   ========================= */

const KEY_ITEMS = "sg_items_v1";
const KEY_SALES = "sg_sales_v1";
const KEY_CUSTOMERS = "sg_customers_v1";
const KEY_THEME = "sg_theme_v1";
const KEY_SALE_DRAFT_CUSTOMER = "sg_sale_draft_customer_v1";
const EVT = "sg_storage_changed";

/* =========================
   Helpers
   ========================= */

function nowIso() {
  return new Date().toISOString();
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function notify() {
  window.dispatchEvent(new Event(EVT));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/* =========================
   Theme
   ========================= */

export function getTheme(): Theme {
  const t = safeParse<Theme>(localStorage.getItem(KEY_THEME), "dark");
  return t === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY_THEME, JSON.stringify(theme));
  notify();
}

export function applyThemeToDom(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/* =========================
   Items
   ========================= */

function normalizeItems(raw: any[]): Vare[] {
  const ts = nowIso();
  return (raw ?? [])
    .map((x: any) => {
      const createdAt = String(x?.createdAt ?? ts);
      const updatedAt = String(x?.updatedAt ?? ts);
      const minStock = Number.isFinite(Number(x?.minStock)) ? Number(x.minStock) : 10; // default 10
      return {
        id: String(x?.id ?? uid("item")),
        name: String(x?.name ?? ""),
        price: Number(x?.price ?? 0),
        cost: Number(x?.cost ?? 0),
        stock: Number(x?.stock ?? 0),
        minStock,
        createdAt,
        updatedAt,
      } as Vare;
    })
    .filter((v) => v.name.trim().length > 0);
}

export function getItems(): Vare[] {
  const parsed = safeParse<any[]>(localStorage.getItem(KEY_ITEMS), []);
  return normalizeItems(Array.isArray(parsed) ? parsed : []);
}

export function setItems(items: Vare[]) {
  localStorage.setItem(KEY_ITEMS, JSON.stringify(items));
  notify();
}

export function upsertItem(
  partial: Omit<Vare, "createdAt" | "updatedAt"> & Partial<Pick<Vare, "createdAt" | "updatedAt">>
) {
  const items = getItems();
  const existingIdx = items.findIndex((i) => i.id === partial.id);

  const ts = nowIso();

  if (existingIdx >= 0) {
    const updated: Vare = {
      ...items[existingIdx],
      ...partial,
      // sikker default
      minStock:
        Number.isFinite(Number((partial as any).minStock)) ? Number((partial as any).minStock) : items[existingIdx].minStock ?? 10,
      updatedAt: ts,
    } as Vare;
    items[existingIdx] = updated;
  } else {
    const created: Vare = {
      id: partial.id,
      name: partial.name ?? "",
      price: partial.price ?? 0,
      cost: partial.cost ?? 0,
      stock: partial.stock ?? 0,
      minStock: Number.isFinite(Number((partial as any).minStock)) ? Number((partial as any).minStock) : 10, // default 10
      createdAt: ts,
      updatedAt: ts,
    };
    items.unshift(created);
  }

  setItems(items);
}

export function deleteItem(id: string) {
  const items = getItems().filter((i) => i.id !== id);
  setItems(items);
}

export function adjustStock(id: string, delta: number) {
  const items = getItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;

  const ts = nowIso();
  items[idx] = {
    ...items[idx],
    stock: (items[idx].stock ?? 0) + delta,
    updatedAt: ts,
  };
  setItems(items);
}

/* =========================
   Customers
   ========================= */

function normalizeCustomers(raw: any[]): Customer[] {
  const ts = nowIso();
  return (raw ?? [])
    .map((x: any) => ({
      id: String(x?.id ?? uid("cust")),
      name: String(x?.name ?? "").trim(),
      phone: x?.phone ? String(x.phone).trim() : undefined,
      address: x?.address ? String(x.address).trim() : undefined,
      note: x?.note ? String(x.note).trim() : undefined,
      createdAt: String(x?.createdAt ?? ts),
      updatedAt: String(x?.updatedAt ?? ts),
    }))
    .filter((c) => c.name.length > 0);
}

export function getCustomers(): Customer[] {
  const parsed = safeParse<any[]>(localStorage.getItem(KEY_CUSTOMERS), []);
  return normalizeCustomers(Array.isArray(parsed) ? parsed : []);
}

export function setCustomers(customers: Customer[]) {
  localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(customers));
  notify();
}

export function upsertCustomer(
  partial: Omit<Customer, "createdAt" | "updatedAt"> & Partial<Pick<Customer, "createdAt" | "updatedAt">>
) {
  const customers = getCustomers();
  const idx = customers.findIndex((c) => c.id === partial.id);
  const ts = nowIso();

  if (idx >= 0) {
    customers[idx] = {
      ...customers[idx],
      ...partial,
      updatedAt: ts,
    } as Customer;
  } else {
    customers.unshift({
      id: partial.id,
      name: (partial.name ?? "").trim(),
      phone: partial.phone?.trim() || undefined,
      address: partial.address?.trim() || undefined,
      note: partial.note?.trim() || undefined,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  setCustomers(customers);
}

export function deleteCustomer(id: string) {
  const customers = getCustomers().filter((c) => c.id !== id);
  setCustomers(customers);
}

/* =========================
   Sales
   ========================= */

function normalizeSales(raw: any[]): Sale[] {
  const ts = nowIso();
  return (raw ?? [])
    .map((x: any) => {
      const createdAt = String(x?.createdAt ?? ts);
      const qty = Number(x?.qty ?? 0);
      const unitPrice = Number(x?.unitPrice ?? 0);
      const total =
        Number.isFinite(Number(x?.total)) ? Number(x.total) : round2((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0));

      // Legacy støtte:
      const legacyCustomer = typeof x?.customer === "string" ? x.customer : undefined;
      const customerName = typeof x?.customerName === "string" ? x.customerName : legacyCustomer;

      return {
        id: String(x?.id ?? uid("sale")),
        createdAt,
        itemId: String(x?.itemId ?? ""),
        itemName: String(x?.itemName ?? ""),
        qty: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        total: Number.isFinite(total) ? total : 0,

        customerId: typeof x?.customerId === "string" && x.customerId.length ? x.customerId : undefined,
        customerName: customerName && customerName.length ? customerName : undefined,

        customer: legacyCustomer,
        note: typeof x?.note === "string" ? x.note : undefined,
      } as Sale;
    })
    .filter((s) => s.itemId.length > 0 && s.itemName.trim().length > 0);
}

export function getSales(): Sale[] {
  const parsed = safeParse<any[]>(localStorage.getItem(KEY_SALES), []);
  return normalizeSales(Array.isArray(parsed) ? parsed : []);
}

export function setSales(sales: Sale[]) {
  localStorage.setItem(KEY_SALES, JSON.stringify(sales));
  notify();
}

export function addSale(s: Omit<Sale, "id" | "createdAt" | "total">) {
  const sales = getSales();
  const createdAt = nowIso();
  const total = round2((s.unitPrice ?? 0) * (s.qty ?? 0));

  const sale: Sale = {
    id: uid("sale"),
    createdAt,
    total,
    ...s,
  };

  sales.unshift(sale);
  setSales(sales);
  return sale;
}

/* =========================
   Sale draft customer (forhåndsvalg)
   ========================= */

export function setSaleDraftCustomer(customerId: string) {
  const payload: SaleDraftCustomer = { customerId, setAt: nowIso() };
  localStorage.setItem(KEY_SALE_DRAFT_CUSTOMER, JSON.stringify(payload));
  notify();
}

export function getSaleDraftCustomer(): SaleDraftCustomer | null {
  const parsed = safeParse<SaleDraftCustomer | null>(localStorage.getItem(KEY_SALE_DRAFT_CUSTOMER), null);
  if (!parsed?.customerId) return null;
  return parsed;
}

export function clearSaleDraftCustomer() {
  localStorage.removeItem(KEY_SALE_DRAFT_CUSTOMER);
  notify();
}

/* =========================
   Hooks
   ========================= */

export function useItems() {
  const [items, setItemsState] = useState<Vare[]>(() => getItems());

  useEffect(() => {
    const on = () => setItemsState(getItems());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const api = useMemo(
    () => ({
      setAll: (next: Vare[]) => setItems(next),
      upsert: upsertItem,
      remove: deleteItem,
      adjust: adjustStock,
    }),
    []
  );

  return { items, ...api };
}

export function useCustomers() {
  const [customers, setCustomersState] = useState<Customer[]>(() => getCustomers());

  useEffect(() => {
    const on = () => setCustomersState(getCustomers());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const api = useMemo(
    () => ({
      setAll: (next: Customer[]) => setCustomers(next),
      upsert: upsertCustomer,
      remove: deleteCustomer,
    }),
    []
  );

  return { customers, ...api };
}

export function useSales() {
  const [sales, setSalesState] = useState<Sale[]>(() => getSales());

  useEffect(() => {
    const on = () => setSalesState(getSales());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const api = useMemo(
    () => ({
      setAll: (next: Sale[]) => setSales(next),
      add: addSale,
    }),
    []
  );

  return { sales, ...api };
}

/* =========================
   Utils
   ========================= */

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtKr(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} kr`;
}
