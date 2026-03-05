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

export type Sale = {
  id: string;
  createdAt: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;
  customer?: string;
  note?: string;
};

export type LowStockEvent = {
  item: Vare;
  prevStock: number;
  newStock: number;
  minStock: number;
};

export type SellResult =
  | { ok: true; sale: Sale; item: Vare; lowStock?: LowStockEvent }
  | { ok: false; error: string };

const KEY_ITEMS = "sg_items_v1";
const KEY_SALES = "sg_sales_v1";
const KEY_THEME = "sg_theme_v1";
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
  partial: Omit<Vare, "createdAt" | "updatedAt"> &
    Partial<Pick<Vare, "createdAt" | "updatedAt">>
) {
  const items = getItems();
  const existingIdx = items.findIndex((i) => i.id === partial.id);

  const ts = nowIso();

  if (existingIdx >= 0) {
    const updated: Vare = {
      ...items[existingIdx],
      ...partial,
      updatedAt: ts,
      // sikkerhet: aldri negative tall
      price: Number(partial.price ?? items[existingIdx].price ?? 0),
      cost: Number(partial.cost ?? items[existingIdx].cost ?? 0),
      stock: Math.max(0, Math.trunc(Number(partial.stock ?? items[existingIdx].stock ?? 0))),
      minStock: Math.max(0, Math.trunc(Number(partial.minStock ?? items[existingIdx].minStock ?? 0))),
    } as Vare;
    items[existingIdx] = updated;
  } else {
    const created: Vare = {
      id: partial.id,
      name: String(partial.name ?? ""),
      price: Number(partial.price ?? 0),
      cost: Number(partial.cost ?? 0),
      stock: Math.max(0, Math.trunc(Number(partial.stock ?? 0))),
      minStock: Math.max(0, Math.trunc(Number(partial.minStock ?? 0))),
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
  const next = Math.max(0, Math.trunc((items[idx].stock ?? 0) + delta));
  items[idx] = { ...items[idx], stock: next, updatedAt: ts };
  setItems(items);
}

/**
 * Selg en vare:
 * - trekker fra lager (aldri under 0)
 * - oppretter salg
 * - returnerer lowStock-event når lager HAVNER på/under minimum (per vare)
 *
 * lowStock trigges når (prevStock > minStock) && (newStock <= minStock) && (minStock > 0)
 * = altså når du "krysser terskelen" (ingen spam hver gang du selger mens den allerede er lav).
 */
export function sellItem(params: {
  itemId: string;
  qty: number;
  unitPrice?: number;
  customer?: string;
  note?: string;
}): SellResult {
  const { itemId, qty, unitPrice, customer, note } = params;

  if (!itemId) return { ok: false, error: "Mangler vare (itemId)." };
  const q = Math.trunc(Number(qty));
  if (!Number.isFinite(q) || q <= 0) return { ok: false, error: "Antall må være minst 1." };

  const items = getItems();
  const idx = items.findIndex((x) => x.id === itemId);
  if (idx < 0) return { ok: false, error: "Fant ikke varen i lageret." };

  const ts = nowIso();
  const current = items[idx];

  const prevStock = Math.max(0, Math.trunc(Number(current.stock ?? 0)));
  const min = Math.max(0, Math.trunc(Number(current.minStock ?? 0)));

  const p =
    Number.isFinite(Number(unitPrice)) && Number(unitPrice) >= 0
      ? Number(unitPrice)
      : Number(current.price ?? 0);

  const newStock = Math.max(0, prevStock - q);

  const updatedItem: Vare = {
    ...current,
    stock: newStock,
    updatedAt: ts,
  };

  items[idx] = updatedItem;
  setItems(items);

  const sale = addSale({
    itemId: updatedItem.id,
    itemName: updatedItem.name,
    qty: q,
    unitPrice: round2(p),
    customer: customer?.trim() ? customer.trim() : undefined,
    note: note?.trim() ? note.trim() : undefined,
  });

  let lowStock: LowStockEvent | undefined;
  if (min > 0 && prevStock > min && newStock <= min) {
    lowStock = { item: updatedItem, prevStock, newStock, minStock: min };
  }

  return { ok: true, sale, item: updatedItem, lowStock };
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
