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
};

/* =========================
   Utils
========================= */

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtKr(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `${x.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} kr`;
}

export function uid(prefix = "id") {
  // crypto.randomUUID finnes i moderne nettlesere
  const r =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? // @ts-expect-error randomUUID exists in modern browsers
        crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${r}`;
}

/* =========================
   Storage keys
========================= */

const KEY_THEME = "app_theme";
const KEY_ITEMS = "app_items";
const KEY_CUSTOMERS = "app_customers";
const KEY_SALES = "app_sales";
const KEY_SALE_DRAFT_CUSTOMER = "app_sale_draft_customer";

/* =========================
   Low-level storage helpers
========================= */

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  // Egen event for samme tab (storage-event trigges ikke alltid i samme tab)
  window.dispatchEvent(new CustomEvent("app-storage"));
}

function nowIso() {
  return new Date().toISOString();
}

/* =========================
   Theme
========================= */

export function getTheme(): Theme {
  const t = localStorage.getItem(KEY_THEME);
  return t === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY_THEME, theme);
  window.dispatchEvent(new CustomEvent("app-storage"));
}

/* =========================
   Items
========================= */

export function getItems(): Vare[] {
  const arr = safeParse<any[]>(localStorage.getItem(KEY_ITEMS), []);
  // Normaliser litt så appen tåler gamle data
  return (arr || [])
    .map((x) => ({
      id: String(x.id ?? uid("item")),
      name: String(x.name ?? ""),
      price: Number(x.price ?? 0),
      cost: Number(x.cost ?? 0),
      stock: Number(x.stock ?? 0),
      minStock: Number(x.minStock ?? 10),
      createdAt: String(x.createdAt ?? nowIso()),
      updatedAt: String(x.updatedAt ?? nowIso()),
    }))
    .filter((x) => x.name.trim().length > 0);
}

export function setItems(items: Vare[]) {
  save(KEY_ITEMS, items);
}

/* =========================
   Customers
========================= */

export function getCustomers(): Customer[] {
  const arr = safeParse<any[]>(localStorage.getItem(KEY_CUSTOMERS), []);
  return (arr || [])
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

export function setCustomers(customers: Customer[]) {
  save(KEY_CUSTOMERS, customers);
}

/* =========================
   Sales
========================= */

export function getSales(): Sale[] {
  const arr = safeParse<any[]>(localStorage.getItem(KEY_SALES), []);
  return (arr || []).map((x) => ({
    id: String(x.id ?? uid("sale")),
    itemId: String(x.itemId ?? ""),
    itemName: String(x.itemName ?? ""),
    qty: Number(x.qty ?? 0),
    unitPrice: Number(x.unitPrice ?? 0),
    total: Number(x.total ?? round2(Number(x.qty ?? 0) * Number(x.unitPrice ?? 0))),
    customerId: x.customerId ? String(x.customerId) : undefined,
    customerName: x.customerName ? String(x.customerName) : undefined,
    createdAt: String(x.createdAt ?? nowIso()),
  }));
}

export function setSales(sales: Sale[]) {
  save(KEY_SALES, sales);
}

export function addSale(input: Omit<Sale, "id" | "createdAt" | "total">) {
  const sales = getSales();
  const s: Sale = {
    id: uid("sale"),
    createdAt: nowIso(),
    itemId: input.itemId,
    itemName: input.itemName,
    qty: Number(input.qty ?? 0),
    unitPrice: round2(Number(input.unitPrice ?? 0)),
    total: round2(Number(input.qty ?? 0) * Number(input.unitPrice ?? 0)),
    customerId: input.customerId,
    customerName: input.customerName,
  };
  // nyeste først
  sales.unshift(s);
  setSales(sales);
}

/* =========================
   Sale draft customer (forhåndsvalg fra Kunder -> Salg)
========================= */

type SaleDraftCustomer = { customerId: string; setAt: string };

export function setSaleDraftCustomer(customerId: string) {
  const payload: SaleDraftCustomer = { customerId, setAt: nowIso() };
  save(KEY_SALE_DRAFT_CUSTOMER, payload);
}

export function getSaleDraftCustomer(): SaleDraftCustomer | null {
  const payload = safeParse<SaleDraftCustomer | null>(localStorage.getItem(KEY_SALE_DRAFT_CUSTOMER), null);
  if (!payload?.customerId) return null;
  return payload;
}

export function clearSaleDraftCustomer() {
  localStorage.removeItem(KEY_SALE_DRAFT_CUSTOMER);
  window.dispatchEvent(new CustomEvent("app-storage"));
}

/* =========================
   React hooks (sync med localStorage)
========================= */

function useStorageSync() {
  const [, bump] = useState(0);
  useEffect(() => {
    const onAny = () => bump((x) => x + 1);
    window.addEventListener("app-storage", onAny);
    window.addEventListener("storage", onAny);
    return () => {
      window.removeEventListener("app-storage", onAny);
      window.removeEventListener("storage", onAny);
    };
  }, []);
}

export function useItems() {
  useStorageSync();
  const [items, setItemsState] = useState<Vare[]>(() => getItems());

  useEffect(() => setItemsState(getItems()), []);

  // oppdater på sync-event
  useEffect(() => {
    const onAny = () => setItemsState(getItems());
    window.addEventListener("app-storage", onAny);
    window.addEventListener("storage", onAny);
    return () => {
      window.removeEventListener("app-storage", onAny);
      window.removeEventListener("storage", onAny);
    };
  }, []);

  function upsert(next: Omit<Vare, "createdAt" | "updatedAt">) {
    const arr = getItems();
    const idx = arr.findIndex((x) => x.id === next.id);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...next, updatedAt: nowIso() };
    } else {
      arr.unshift({ ...next, createdAt: nowIso(), updatedAt: nowIso() });
    }
    setItems(arr);
  }

  function remove(id: string) {
    const arr = getItems().filter((x) => x.id !== id);
    setItems(arr);
  }

  function adjust(id: string, delta: number) {
    const arr = getItems();
    const idx = arr.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const cur = arr[idx];
    arr[idx] = { ...cur, stock: (cur.stock ?? 0) + delta, updatedAt: nowIso() };
    setItems(arr);
  }

  function setAll(next: Vare[]) {
    setItems(next);
  }

  return { items, upsert, remove, adjust, setAll };
}

export function useCustomers() {
  useStorageSync();
  const [customers, setCustomersState] = useState<Customer[]>(() => getCustomers());

  useEffect(() => setCustomersState(getCustomers()), []);

  useEffect(() => {
    const onAny = () => setCustomersState(getCustomers());
    window.addEventListener("app-storage", onAny);
    window.addEventListener("storage", onAny);
    return () => {
      window.removeEventListener("app-storage", onAny);
      window.removeEventListener("storage", onAny);
    };
  }, []);

  function upsert(next: Omit<Customer, "createdAt" | "updatedAt">) {
    const arr = getCustomers();
    const idx = arr.findIndex((x) => x.id === next.id);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...next, updatedAt: nowIso() };
    } else {
      arr.unshift({ ...next, createdAt: nowIso(), updatedAt: nowIso() });
    }
    setCustomers(arr);
  }

  function remove(id: string) {
    const arr = getCustomers().filter((x) => x.id !== id);
    setCustomers(arr);
  }

  function setAll(next: Customer[]) {
    setCustomers(next);
  }

  return { customers, upsert, remove, setAll };
}

export function useSales() {
  useStorageSync();
  const [sales, setSalesState] = useState<Sale[]>(() => getSales());

  useEffect(() => setSalesState(getSales()), []);

  useEffect(() => {
    const onAny = () => setSalesState(getSales());
    window.addEventListener("app-storage", onAny);
    window.addEventListener("storage", onAny);
    return () => {
      window.removeEventListener("app-storage", onAny);
      window.removeEventListener("storage", onAny);
    };
  }, []);

  const sumTotal = useMemo(() => sales.reduce((a, b) => a + (Number(b.total) || 0), 0), [sales]);

  function clearAll() {
    setSales([]);
  }

  return { sales, sumTotal, clearAll };
}
