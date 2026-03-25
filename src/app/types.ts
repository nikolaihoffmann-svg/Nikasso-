export type ItemUnit = "stk" | "liter" | "sett" | "pakke" | "tube" | "boks";

export type ItemCategory =
  | "Deler"
  | "Olje"
  | "Forbruk"
  | "Utstyr"
  | "Annet";

export type InventoryItem = {
  id: string;
  name: string;
  sku?: string;
  category: ItemCategory;
  unit: ItemUnit;
  salePrice: number;
  costPrice: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseLineKind = "varekjop" | "forbruk" | "utstyr";

export type PurchaseLine = {
  id: string;
  kind: PurchaseLineKind;
  itemId?: string;
  itemName?: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
};

export type PurchaseStatus = "betalt" | "ikke_betalt";

export type PurchaseDraft = {
  id: string;
  supplier: string;
  status: PurchaseStatus;
  dueDate?: string;
  note?: string;
  updateCostMode: "weighted_average" | "last_price" | "no_change";
  lines: PurchaseLine[];
  createdAt: string;
};

export type SaleLine = {
  id: string;
  itemId?: string;
  itemName?: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
};

export type SaleDraft = {
  id: string;
  customer?: string;
  note?: string;
  lines: SaleLine[];
  createdAt: string;
};
