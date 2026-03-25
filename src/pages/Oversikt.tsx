import { useEffect, useMemo, useState } from "react";
import { ensureSeedItems, fmtKr, getItems, getPurchases, getSales } from "../app/storage";
import type { InventoryItem, PurchaseDraft, SaleDraft } from "../types";

export default function Oversikt() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleDraft[]>([]);
  const [purchases, setPurchases] = useState<PurchaseDraft[]>([]);

  useEffect(() => {
    ensureSeedItems();
    setItems(getItems());
    setSales(getSales());
    setPurchases(getPurchases());
  }, []);

  const stockValue = useMemo(() => {
    return items.reduce((sum, item) => sum + item.stock * item.costPrice, 0);
  }, [items]);

  const saleValue = useMemo(() => {
    return sales.reduce((sum, sale) => {
      return (
        sum +
        sale.lines.reduce((lineSum, line) => lineSum + Number(line.lineTotal || 0), 0)
      );
    }, 0);
  }, [sales]);

  const purchaseValue = useMemo(() => {
    return purchases.reduce((sum, purchase) => {
      return (
        sum +
        purchase.lines.reduce((lineSum, line) => lineSum + Number(line.lineTotal || 0), 0)
      );
    }, 0);
  }, [purchases]);

  return (
    <div style={pageStyle}>
      <h1>Oversikt</h1>

      <div style={gridStyle}>
        <div style={cardStyle}>
          <div style={labelStyle}>Antall varer</div>
          <div style={valueStyle}>{items.length}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Lagerverdi</div>
          <div style={valueStyle}>{fmtKr(stockValue)}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Salg totalt</div>
          <div style={valueStyle}>{fmtKr(saleValue)}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Innkjøp totalt</div>
          <div style={valueStyle}>{fmtKr(purchaseValue)}</div>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 16,
  color: "#fff",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 16,
};

const labelStyle: React.CSSProperties = {
  opacity: 0.75,
  marginBottom: 8,
};

const valueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
};
