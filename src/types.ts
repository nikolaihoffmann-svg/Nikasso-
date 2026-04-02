export type Theme = "dark" | "light";

export type ItemUnit = "stk";

export type ItemCategory =
  | "Deler"
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
  price?: number;
  cost?: number;
  stock: number;
  minStock: number;
  note?: string;
  isActive: boolean;
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

export type PaymentMethod =
  | "vipps"
  | "revolut"
  | "kontant"
  | "bytte"
  | "bankoverforing"
  | "annet";

export type Payment = {
  id: string;
  amount: number;
  createdAt: string;
  note?: string;
  method?: PaymentMethod;
  methodLabel?: string;
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

export type SaleRecord = {
  id: string;
  customerId?: string;
  customerName?: string;
  note?: string;
  lines: SaleLine[];
  total: number;
  payments: Payment[];
  paid: boolean;
  createdAt: string;
};

export type SaleDraft = {
  id: string;
  customerId?: string;
  customerName?: string;
  note?: string;
  lines: SaleLine[];
  createdAt: string;
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

export type PurchaseCostMode = "last_price" | "no_change";

export type PurchaseRecord = {
  id: string;
  supplier: string;
  status: PurchaseStatus;
  dueDate?: string;
  note?: string;
  updateCostMode: PurchaseCostMode;
  lines: PurchaseLine[];
  total: number;
  createdAt: string;
};

export type PurchaseDraft = {
  id: string;
  supplier: string;
  status: PurchaseStatus;
  dueDate?: string;
  note?: string;
  updateCostMode: PurchaseCostMode;
  lines: PurchaseLine[];
  createdAt: string;
};

export type DebtPayment = {
  id: string;
  amount: number;
  createdAt: string;
  note?: string;
  method?: PaymentMethod;
  methodLabel?: string;
};

export type DebtRecord = {
  id: string;
  customerId?: string;
  customerName?: string;
  title: string;
  note?: string;
  total: number;
  payments: DebtPayment[];
  paid: boolean;
  createdAt: string;
};

export type DebtDraft = {
  id: string;
  customerId?: string;
  customerName?: string;
  title: string;
  note?: string;
  total: number;
  createdAt: string;
};

export type PaymentMethodStat = {
  key: PaymentMethod;
  label: string;
  amount: number;
  count: number;
};

export type AppBackup = {
  version: number;
  exportedAt: string;
  theme?: Theme;
  saldo: number;
  items: InventoryItem[];
  customers: Customer[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  debts: DebtRecord[];
};
