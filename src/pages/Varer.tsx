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
          <h1 className="pageTitle">Varer</h1>
          <p className="pageLead" style={{ marginBottom: 0 }}>
            Lager, priser og varsler samlet på ett sted.
          </p>
        </div>

        <button className="btn btnPrimary" type="button" onClick={() => setOpenNew(true)}>
          + Ny vare
        </button>
      </div>

      <div className="varerTopGrid">
        <div className="card">
          <div className="rowBetween" style={{ marginBottom: 14 }}>
            <h2 className="sectionTitle" style={{ marginBottom: 0 }}>Lagervarsling</h2>
            <span className={lowItems.length > 0 ? "badge badgeDanger" : "badge badgeSuccess"}>
              {lowItems.length > 0 ? `${lowItems.length} varer` : "Ingen varsler"}
            </span>
          </div>

          <div className="featureList">
            {lowItems.length === 0 ? (
              <div className="emptyState">Ingen varer under minimum.</div>
            ) : (
              lowItems.map((item) => (
                <div key={item.id} className="featureRow">
                  <div className="customerMain">
                    <div className="featureRowTitle">{item.name}</div>
                    <div className="featureRowSub">
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

        <div className="varerList">
          {filtered.length === 0 ? (
            <div className="emptyState">Ingen varer funnet.</div>
          ) : (
            filtered.map((item) => {
              const margin = item.salePrice - item.costPrice;

              return (
                <div key={item.id} className="vareRow">
                  <div className="vareMain">
                    <div className="vareName">{item.name}</div>
                    <div className="vareMeta">
                      {item.category} • {item.unit}
                    </div>
                    {item.note ? <div className="vareNote">{item.note}</div> : null}
                  </div>

                  <div className="vareRight">
                    <div className="vareRightTop">Lager: {item.stock}</div>
                    <div className="vareRightMeta">Salg: {fmtKr(item.salePrice)}</div>
                    <div className="vareRightMeta">Kost: {fmtKr(item.costPrice)}</div>
                    <div style={{ marginTop: 8 }}>
                      <span className={margin >= 0 ? "badge badgeSuccess" : "badge badgeDanger"}>
                        Margin: {fmtKr(margin)}
                      </span>
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
