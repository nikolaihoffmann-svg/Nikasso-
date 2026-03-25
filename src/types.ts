export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  minStock: number;
};

export type PurchaseLine = {
  id: string;
  itemId?: string;
  itemName?: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
};

export type SaleLine = {
  id: string;
  itemId?: string;
  itemName?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};
