// src/app/storage.ts
import { useEffect, useMemo, useState } from "react";

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

  // valgfri kunde-kobling
  customerId?: string;
  customerName?: string;

  note?: string;
};

export type LowStockEvent = {
  item: Vare;
  newStock: number;
  minStock: number;
};

const KEY_ITEMS = "sg_items_v1";
const KEY_SALES = "sg_sales_v1";
const KEY_CUSTOMERS = "sg_customers_v1";
const KEY_THEME = "sg_theme_v1";

const EVT = "sg_storage_changed";
const EVT_LOW = "sg_low_stock";

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

/* ---------- Theme ---------- */

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

/* ---------- Items ---------- */

export function getItems(): Vare[] {
  return safeParse<Vare[]>(localStorage.getItem(KEY_ITEMS), []);
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
      minStock: partial.minStock ?? 10, // ← autosett standard min-lager til 10
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
  items[idx] = { ...items[idx], stock: (items[idx].stock ?? 0) + delta, updatedAt: ts };
  setItems(items);
}

/* ---------- Customers ---------- */

export function getCustomers(): Customer[] {
  return safeParse<Customer[]>(localStorage.getItem(KEY_CUSTOMERS), []);
}

export function setCustomers(customers: Customer[]) {
  localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(customers));
  notify();
}

export function upsertCustomer(
  partial: Omit<Customer, "createdAt" | "updatedAt"> & Partial<Pick<Customer, "createdAt" | "updatedAt">>
) {
  const customers = getCustomers();
  const existingIdx = customers.findIndex((c) => c.id === partial.id);

  const ts = nowIso();

  if (existingIdx >= 0) {
    const updated: Customer = {
      ...customers[existingIdx],
      ...partial,
      updatedAt: ts,
    } as Customer;
    customers[existingIdx] = updated;
  } else {
    const created: Customer = {
      id: partial.id,
      name: partial.name ?? "",
      phone: partial.phone,
      address: partial.address,
      note: partial.note,
      createdAt: ts,
      updatedAt: ts,
    };
    customers.unshift(created);
  }

  setCustomers(customers);
}

export function deleteCustomer(id: string) {
  const customers = getCustomers().filter((c) => c.id !== id);
  setCustomers(customers);

  // rydde opp salg som peker på slettet kunde
  const sales = getSales().map((s) => {
    if (s.customerId === id) {
      const { customerId, customerName, ...rest } = s;
      return rest as Sale;
    }
    return s;
  });
  setSales(sales);
}

/* ---------- Sales ---------- */

export function getSales(): Sale[] {
  return safeParse<Sale[]>(localStorage.getItem(KEY_SALES), []);
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

/* ---------- Low stock event helper ---------- */

export function emitLowStock(evt: LowStockEvent) {
  window.dispatchEvent(new CustomEvent<LowStockEvent>(EVT_LOW, { detail: evt }));
}

export function onLowStock(handler: (evt: LowStockEvent) => void) {
  const fn = (e: Event) => {
    const ce = e as CustomEvent<LowStockEvent>;
    if (ce?.detail) handler(ce.detail);
  };
  window.addEventListener(EVT_LOW, fn as any);
  return () => window.removeEventListener(EVT_LOW, fn as any);
}

/* ---------- Hooks ---------- */

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

/* ---------- Utils ---------- */

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtKr(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} kr`;
}
