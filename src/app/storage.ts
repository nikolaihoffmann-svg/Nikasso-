import type {
  InventoryItem,
  ItemCategory,
  ItemUnit,
  PurchaseDraft,
  PurchaseLine,
  SaleDraft,
  SaleLine,
} from "../types";

const ITEMS_KEY = "nikasso_items_v1";
const PURCHASES_KEY = "nikasso_purchases_v1";
const SALES_KEY = "nikasso_sales_v1";

function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function clampNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtKr(n: number): string {
  return `${round2(n).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr`;
}

export type CreateItemInput = {
  name: string;
  sku?: string;
  category?: ItemCategory;
  unit?: ItemUnit;
  salePrice?: number;
  costPrice?: number;
  stock?: number;
  minStock?: number;
  isActive?: boolean;
};

export type UpdateItemInput = Partial<CreateItemInput>;

export function getItems(): InventoryItem[] {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);
  return items
    .filter((x) => x.isActive !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
}

export function getItemById(itemId: string): InventoryItem | undefined {
  return getItems().find((x) => x.id === itemId);
}

export function searchItems(query: string): InventoryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return getItems();

  return getItems().filter((item) => {
    return (
      item.name.toLowerCase().includes(q) ||
      (item.sku ?? "").toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });
}

export function createItem(input: CreateItemInput): InventoryItem {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Varen må ha navn");
  }

  const existing = items.find(
    (x) => x.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (existing) {
    return existing;
  }

  const item: InventoryItem = {
    id: uid("item"),
    name: trimmedName,
    sku: input.sku?.trim() || undefined,
    category: input.category ?? "Annet",
    unit: input.unit ?? "stk",
    salePrice: round2(clampNumber(input.salePrice, 0)),
    costPrice: round2(clampNumber(input.costPrice, 0)),
    stock: clampNumber(input.stock, 0),
    minStock: clampNumber(input.minStock, 0),
    isActive: input.isActive ?? true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  items.push(item);
  writeJson(ITEMS_KEY, items);
  return item;
}

export function updateItem(itemId: string, input: UpdateItemInput): InventoryItem {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);
  const index = items.findIndex((x) => x.id === itemId);

  if (index === -1) {
    throw new Error("Fant ikke varen");
  }

  const current = items[index];
  const updated: InventoryItem = {
    ...current,
    ...input,
    name: input.name !== undefined ? input.name.trim() : current.name,
    sku: input.sku !== undefined ? input.sku.trim() || undefined : current.sku,
    salePrice:
      input.salePrice !== undefined ? round2(clampNumber(input.salePrice, 0)) : current.salePrice,
    costPrice:
      input.costPrice !== undefined ? round2(clampNumber(input.costPrice, 0)) : current.costPrice,
    stock: input.stock !== undefined ? clampNumber(input.stock, 0) : current.stock,
    minStock: input.minStock !== undefined ? clampNumber(input.minStock, 0) : current.minStock,
    updatedAt: nowIso(),
  };

  items[index] = updated;
  writeJson(ITEMS_KEY, items);
  return updated;
}

export function deleteItem(itemId: string): void {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);
  const index = items.findIndex((x) => x.id === itemId);
  if (index === -1) return;

  items[index] = {
    ...items[index],
    isActive: false,
    updatedAt: nowIso(),
  };

  writeJson(ITEMS_KEY, items);
}

export function ensureSeedItems(): void {
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);
  if (items.length > 0) return;

  const seed: InventoryItem[] = [
    {
      id: uid("item"),
      name: "Motorolje 5W-30",
      category: "Olje",
      unit: "liter",
      salePrice: 149,
      costPrice: 89,
      stock: 12,
      minStock: 4,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: uid("item"),
      name: "Bremserens",
      category: "Forbruk",
      unit: "boks",
      salePrice: 79,
      costPrice: 45,
      stock: 8,
      minStock: 3,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  writeJson(ITEMS_KEY, seed);
}

export function getPurchases(): PurchaseDraft[] {
  return readJson<PurchaseDraft[]>(PURCHASES_KEY, []);
}

export function getSales(): SaleDraft[] {
  return readJson<SaleDraft[]>(SALES_KEY, []);
}

export function createEmptyPurchase(): PurchaseDraft {
  return {
    id: uid("purchase"),
    supplier: "",
    status: "betalt",
    dueDate: "",
    note: "",
    updateCostMode: "weighted_average",
    lines: [
      {
        id: uid("pline"),
        kind: "varekjop",
        itemId: undefined,
        itemName: "",
        qty: 1,
        unitCost: 0,
        lineTotal: 0,
      },
    ],
    createdAt: nowIso(),
  };
}

export function createEmptySale(): SaleDraft {
  return {
    id: uid("sale"),
    customer: "",
    note: "",
    lines: [
      {
        id: uid("sline"),
        itemId: undefined,
        itemName: "",
        qty: 1,
        unitPrice: 0,
        unitCost: 0,
        lineTotal: 0,
      },
    ],
    createdAt: nowIso(),
  };
}

function calcWeightedAverage(
  currentStock: number,
  currentCost: number,
  incomingQty: number,
  incomingUnitCost: number
): number {
  const totalQty = currentStock + incomingQty;
  if (totalQty <= 0) return round2(incomingUnitCost);

  const totalValue = currentStock * currentCost + incomingQty * incomingUnitCost;
  return round2(totalValue / totalQty);
}

export function savePurchase(draft: PurchaseDraft): void {
  const purchases = readJson<PurchaseDraft[]>(PURCHASES_KEY, []);
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);

  for (const line of draft.lines) {
    if (line.kind !== "varekjop") continue;
    if (!line.itemId) continue;

    const index = items.findIndex((x) => x.id === line.itemId);
    if (index === -1) continue;

    const current = items[index];
    const qty = clampNumber(line.qty, 0);
    const unitCost = round2(clampNumber(line.unitCost, 0));

    let nextCost = current.costPrice;

    if (draft.updateCostMode === "weighted_average") {
      nextCost = calcWeightedAverage(current.stock, current.costPrice, qty, unitCost);
    } else if (draft.updateCostMode === "last_price") {
      nextCost = unitCost;
    }

    items[index] = {
      ...current,
      stock: clampNumber(current.stock + qty, current.stock),
      costPrice: draft.updateCostMode === "no_change" ? current.costPrice : nextCost,
      updatedAt: nowIso(),
    };
  }

  writeJson(ITEMS_KEY, items);
  purchases.unshift(draft);
  writeJson(PURCHASES_KEY, purchases);
}

export function saveSale(draft: SaleDraft): void {
  const sales = readJson<SaleDraft[]>(SALES_KEY, []);
  const items = readJson<InventoryItem[]>(ITEMS_KEY, []);

  for (const line of draft.lines) {
    if (!line.itemId) continue;

    const index = items.findIndex((x) => x.id === line.itemId);
    if (index === -1) continue;

    const current = items[index];
    const qty = clampNumber(line.qty, 0);

    items[index] = {
      ...current,
      stock: Math.max(0, clampNumber(current.stock - qty, current.stock)),
      updatedAt: nowIso(),
    };
  }

  writeJson(ITEMS_KEY, items);
  sales.unshift(draft);
  writeJson(SALES_KEY, sales);
}

export function makePurchaseLine(): PurchaseLine {
  return {
    id: uid("pline"),
    kind: "varekjop",
    itemId: undefined,
    itemName: "",
    qty: 1,
    unitCost: 0,
    lineTotal: 0,
  };
}

export function makeSaleLine(): SaleLine {
  return {
    id: uid("sline"),
    itemId: undefined,
    itemName: "",
    qty: 1,
    unitPrice: 0,
    unitCost: 0,
    lineTotal: 0,
  };
}
