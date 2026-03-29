import { useEffect, useMemo, useState } from "react";
import NewItemModal from "../components/NewItemModal";
import { ensureSeedData, fmtKr, getItems, lowStockItems } from "../app/storage";
import type { InventoryItem } from "../types";

export default function Varer() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [query, setQuery] = useState("");

  function refresh(): void {
    setItems(getItems());
  }

  useEffect(() => {
    ensureSeedData();
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const lowItems = useMemo(() => lowStockItems(), [items]);

  return (
    <div>
      <div className="rowBetween" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="pageTitle" style={{ marginBottom: 6 }}>Varer</h1>
          <div className="muted">Lager, priser og varsler på ett sted</div>
        </div>
        <button className="btn btnPrimary" type="button" onClick={() => setOpenNew(true)}>
          + Ny vare
        </button>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="rowBetween">
            <h2 className="sectionTitle">Lagervarsling</h2>
            <span className={lowItems.length > 0 ? "badge badgeDanger" : "badge badgeSuccess"}>
              {lowItems.length > 0 ? `${lowItems.length} varer` : "Ingen varsler"}
            </span>
          </div>

          <div className="list">
            {lowItems.length === 0 ? (
              <div className="emptyState">Ingen varer under minimum.</div>
            ) : (
              lowItems.map((item) => (
                <div key={item.id} className="itemRow">
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div className="muted">
                      Nå: {item.stock} • Min: {item.minStock}
                    </div>
                  </div>
                  <span className="badge badgeDanger">Lav lager</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Søk i varer</h2>
          <label className="label">
            <span>Filter</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk etter navn, kategori eller notat..."
            />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="sectionTitle">Vareliste</h2>

        <div className="list">
          {filtered.length === 0 ? (
            <div className="emptyState">Ingen varer funnet.</div>
          ) : (
            filtered.map((item) => {
              const margin = item.salePrice - item.costPrice;
              return (
                <div key={item.id} className="itemRow">
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{item.name}</div>
                    <div className="muted">
                      {item.category} • {item.unit}
                    </div>
                    {item.note ? <div className="muted" style={{ marginTop: 6 }}>{item.note}</div> : null}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>Lager: {item.stock}</div>
                    <div className="muted">Salg: {fmtKr(item.salePrice)}</div>
                    <div className="muted">Kost: {fmtKr(item.costPrice)}</div>
                    <div className={margin >= 0 ? "badge badgeSuccess" : "badge badgeDanger"} style={{ marginTop: 8 }}>
                      Margin: {fmtKr(margin)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <NewItemModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreated={() => refresh()}
      />
    </div>
  );
}
