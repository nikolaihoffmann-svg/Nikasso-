import { useEffect, useMemo, useState } from "react";
import NewItemModal from "../components/NewItemModal";
import {
  adjustItemStock,
  deleteItem,
  ensureSeedData,
  fmtKr,
  getItems,
  lowStockItems,
  setItemStock,
} from "../app/storage";
import type { InventoryItem } from "../types";

function parseNoNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatInputNumber(value: number | undefined): string {
  if (value === undefined || value === null) return "";
  if (value === 0) return "";
  return String(value).replace(".", ",");
}

export default function Varer() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [query, setQuery] = useState("");
  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [quickAdjust, setQuickAdjust] = useState<Record<string, string>>({});

  function refresh(): void {
    const all = getItems();
    setItems(all);

    setStockEdits((prev) => {
      const next: Record<string, string> = {};
      for (const item of all) {
        next[item.id] = prev[item.id] ?? formatInputNumber(item.stock);
      }
      return next;
    });
  }

  useEffect(() => {
    ensureSeedData();
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      if (!showOutOfStock && item.stock <= 0) return false;
      if (!q) return true;

      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, showOutOfStock]);

  const lowItems = useMemo(() => lowStockItems(), [items]);

  function handleSaveAbsoluteStock(item: InventoryItem): void {
    const raw = stockEdits[item.id] ?? "";
    const value = parseNoNumber(raw);
    setItemStock(item.id, value);
    refresh();
  }

  function handleQuickAdjust(item: InventoryItem): void {
    const raw = quickAdjust[item.id] ?? "";
    const value = parseNoNumber(raw);
    if (value === 0) return;

    adjustItemStock(item.id, value);
    setQuickAdjust((prev) => ({ ...prev, [item.id]: "" }));
    refresh();
  }

  function handleDelete(item: InventoryItem): void {
    const ok = confirm(`Slette varen "${item.name}"?`);
    if (!ok) return;
    deleteItem(item.id);
    refresh();
  }

  return (
    <div>
      <div className="rowBetween" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="pageTitle">Varer</h1>
          <p className="pageLead" style={{ marginBottom: 0 }}>
            Lager, priser, justering og varsler samlet på ett sted.
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
          <h2 className="sectionTitle">Søk og filter</h2>

          <label className="label">
            <span>Søk</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk etter navn, kategori eller notat..."
            />
          </label>

          <div style={{ marginTop: 14 }}>
            <button
              className={showOutOfStock ? "btn" : "btn btnPrimary"}
              type="button"
              onClick={() => setShowOutOfStock((prev) => !prev)}
            >
              {showOutOfStock ? "Skjul utsolgte" : "Vis utsolgte"}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="rowBetween" style={{ marginBottom: 14 }}>
          <h2 className="sectionTitle" style={{ marginBottom: 0 }}>Vareliste</h2>
          <span className="badge">{filtered.length} vises</span>
        </div>

        <div className="varerList">
          {filtered.length === 0 ? (
            <div className="emptyState">Ingen varer funnet.</div>
          ) : (
            filtered.map((item) => {
              const margin = item.salePrice - item.costPrice;

              return (
                <div key={item.id} className="card">
                  <div className="rowBetween" style={{ marginBottom: 12 }}>
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

                  <div className="grid2">
                    <label className="label">
                      <span>Sett lager direkte</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={stockEdits[item.id] ?? ""}
                        onChange={(e) =>
                          setStockEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="F.eks. 12"
                      />
                    </label>

                    <label className="label">
                      <span>Juster lager (+ / -)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="f.eks. 5 eller -3"
                        value={quickAdjust[item.id] ?? ""}
                        onChange={(e) =>
                          setQuickAdjust((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <div className="cardActions">
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn" type="button" onClick={() => setEditingItem(item)}>
                        Rediger vare
                      </button>

                      <button
                        className="btn"
                        type="button"
                        onClick={() => handleSaveAbsoluteStock(item)}
                      >
                        Lagre lager
                      </button>

                      <button className="btn" type="button" onClick={() => handleQuickAdjust(item)}>
                        Juster lager
                      </button>
                    </div>

                    <button className="btn btnDanger" type="button" onClick={() => handleDelete(item)}>
                      Slett vare
                    </button>
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

      <NewItemModal
        open={Boolean(editingItem)}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onCreated={() => {
          setEditingItem(null);
          refresh();
        }}
      />
    </div>
  );
}
