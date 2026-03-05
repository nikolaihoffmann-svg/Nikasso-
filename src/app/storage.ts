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

  // Kunde er valgfritt
  customerId?: string;
  customerName?: string;

  note?: string;
};

/** Når man trykker "Nytt salg" på en kunde, forhåndsvelger vi den kunden i Salg-siden */
export type SaleDraftCustomer = {
  customerId: string;
};

/* =========================
   Storage keys + event
========================= */

const KEY_ITEMS = "sg_items_v1";
const KEY_SALES = "sg_sales_v1";
const KEY_CUSTOMERS = "sg_customers_v1";
const KEY_THEME = "sg_theme_v1";
const KEY_SALE_DRAFT_CUSTOMER = "sg_sale_draft_customer_v1";

const EVT = "sg_storage_changed";

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

function normalizeItem(x: any): Vare | null {
  const name = String(x?.name ?? "").trim();
  if (!name) return null;

  const ts = nowIso();
  return {
    id: String(x?.id ?? uid("item")),
    name,
    price: Number(x?.price ?? 0) || 0,
    cost: Number(x?.cost ?? 0) || 0,
    stock: Number.isFinite(Number(x?.stock)) ? Number(x.stock) : 0,
    // default minStock = 10 hvis mangler/ugyldig
    minStock: Number.isFinite(Number(x?.minStock)) ? Number(x.minStock) : 10,
    createdAt: String(x?.createdAt ?? ts),
    updatedAt: String(x?.updatedAt ?? ts),
  };
}

export function getItems(): Vare[] {
  const raw = safeParse<any[]>(localStorage.getItem(KEY_ITEMS), []);
  const normalized = raw
    .map((x) => normalizeItem(x))
    .filter(Boolean) as Vare[];
  return normalized;
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
      // fallbacks
      name: String(partial.name ?? items[existingIdx].name ?? "").trim(),
      price: Number(partial.price ?? items[existingIdx].price ?? 0) || 0,
      cost: Number(partial.cost ?? items[existingIdx].cost ?? 0) || 0,
      stock: Number.isFinite(Number(partial.stock)) ? Number(partial.stock) : (items[existingIdx].stock ?? 0),
      minStock: Number.isFinite(Number(partial.minStock))
        ? Number(partial.minStock)
        : (items[existingIdx].minStock ?? 10),
      updatedAt: ts,
    };
    items[existingIdx] = updated;
  } else {
    const created: Vare = {
      id: String(partial.id),
      name: String(partial.name ?? "").trim(),
      price: Number(partial.price ?? 0) || 0,
      cost: Number(partial.cost ?? 0) || 0,
      stock: Number.isFinite(Number(partial.stock)) ? Number(partial.stock) : 0,
      minStock: Number.isFinite(Number(partial.minStock)) ? Number(partial.minStock) : 10,
      createdAt: partial.createdAt ?? ts,
      updatedAt: partial.updatedAt ?? ts,
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

/* =========================
   Customers
========================= */

function normalizeCustomer(x: any): Customer | null {
  const name = String(x?.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) return null;

  const ts = nowIso();
  const phone = x?.phone ? String(x.phone).trim() : undefined;
  const address = x?.address ? String(x.address).trim() : undefined;
  const note = x?.note ? String(x.note).trim() : undefined;

  return {
    id: String(x?.id ?? uid("cust")),
    name,
    phone: phone || undefined,
    address: address || undefined,
    note: note || undefined,
    createdAt: String(x?.createdAt ?? ts),
    updatedAt: String(x?.updatedAt ?? ts),
  };
}

export function getCustomers(): Customer[] {
  const raw = safeParse<any[]>(localStorage.getItem(KEY_CUSTOMERS), []);
  const normalized = raw
    .map((x) => normalizeCustomer(x))
    .filter(Boolean) as Customer[];
  return normalized;
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

  const name = String(partial.name ?? "").trim().replace(/\s+/g, " ");

  if (existingIdx >= 0) {
    customers[existingIdx] = {
      ...customers[existingIdx],
      ...partial,
      name: name || customers[existingIdx].name,
      phone: partial.phone ? String(partial.phone).trim() : partial.phone,
      address: partial.address ? String(partial.address).trim() : partial.address,
      note: partial.note ? String(partial.note).trim() : partial.note,
      updatedAt: ts,
    };
  } else {
    customers.unshift({
      id: String(partial.id),
      name,
      phone: partial.phone ? String(partial.phone).trim() : undefined,
      address: partial.address ? String(partial.address).trim() : undefined,
      note: partial.note ? String(partial.note).trim() : undefined,
      createdAt: partial.createdAt ?? ts,
      updatedAt: partial.updatedAt ?? ts,
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

function normalizeSale(x: any): Sale | null {
  const itemId = String(x?.itemId ?? "").trim();
  const itemName = String(x?.itemName ?? "").trim();
  if (!itemId || !itemName) return null;

  const ts = nowIso();

  // gammel schema-støtte:
  // - customer: "Per" -> blir customerName
  const legacyCustomerName = x?.customer ? String(x.customer).trim() : undefined;

  const qty = Number(x?.qty ?? 0);
  const unitPrice = Number(x?.unitPrice ?? 0);
  const total = Number.isFinite(Number(x?.total))
    ? Number(x.total)
    : round2((Number(unitPrice) || 0) * (Number(qty) || 0));

  return {
    id: String(x?.id ?? uid("sale")),
    createdAt: String(x?.createdAt ?? ts),
    itemId,
    itemName,
    qty: Number.isFinite(qty) ? qty : 0,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
    total: Number.isFinite(total) ? total : 0,
    customerId: x?.customerId ? String(x.customerId) : undefined,
    customerName: x?.customerName ? String(x.customerName).trim() : legacyCustomerName,
    note: x?.note ? String(x.note) : undefined,
  };
}

export function getSales(): Sale[] {
  const raw = safeParse<any[]>(localStorage.getItem(KEY_SALES), []);
  const normalized = raw
    .map((x) => normalizeSale(x))
    .filter(Boolean) as Sale[];
  return normalized;
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
    // hygiene
    customerId: s.customerId ? String(s.customerId) : undefined,
    customerName: s.customerName ? String(s.customerName).trim() : undefined,
  };

  sales.unshift(sale);
  setSales(sales);
  return sale;
}

/* =========================
   Sale draft (customer preselect)
========================= */

export function setSaleDraftCustomer(customerId: string) {
  const payload: SaleDraftCustomer = { customerId };
  localStorage.setItem(KEY_SALE_DRAFT_CUSTOMER, JSON.stringify(payload));
  notify();
}

export function getSaleDraftCustomer(): SaleDraftCustomer | null {
  const parsed = safeParse<SaleDraftCustomer | null>(localStorage.getItem(KEY_SALE_DRAFT_CUSTOMER), null);
  if (!parsed?.customerId) return null;
  return { customerId: String(parsed.customerId) };
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
