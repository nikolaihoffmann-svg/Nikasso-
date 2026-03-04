import React, { useEffect, useMemo, useState } from "react";

type Vare = {
  id: string;
  name: string;
  price: number; // salgspris
  cost: number; // kost
  stock: number; // lager
  minStock: number; // minimum før varsel
  createdAt: number;
};

const LS_KEY = "salg_gjeld_varer_v1";

function n(v: string): number {
  const x = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(x) ? x : 0;
}

function formatKr(value: number): string {
  // enkel NOK-format
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " kr";
}

function uid(): string {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function load(): Vare[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Vare[];
  } catch {
    return [];
  }
}

function save(items: Vare[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export function Varer() {
  const [items, setItems] = useState<Vare[]>([]);
  const [q, setQ] = useState("");

  // add form
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("1");

  // edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingItem = useMemo(() => items.find((x) => x.id === editingId) ?? null, [items, editingId]);

  useEffect(() => {
    setItems(load());
  }, []);

  useEffect(() => {
    save(items);
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => x.name.toLowerCase().includes(s));
  }, [items, q]);

  const totals = useMemo(() => {
    const count = items.length;
    const stockTotal = items.reduce((a, b) => a + (b.stock || 0), 0);
    const costValue = items.reduce((a, b) => a + (b.cost || 0) * (b.stock || 0), 0);
    const sellValue = items.reduce((a, b) => a + (b.price || 0) * (b.stock || 0), 0);
    const lowCount = items.reduce((a, b) => a + ((b.stock ?? 0) <= (b.minStock ?? 0) ? 1 : 0), 0);
    return { count, stockTotal, costValue, sellValue, lowCount };
  }, [items]);

  function resetAddForm() {
    setName("");
    setPrice("");
    setCost("");
    setStock("");
    setMinStock("1");
  }

  function addItem() {
    const nm = name.trim();
    if (!nm) return;

    const item: Vare = {
      id: uid(),
      name: nm,
      price: n(price),
      cost: n(cost),
      stock: Math.max(0, Math.floor(n(stock))),
      minStock: Math.max(0, Math.floor(n(minStock))),
      createdAt: Date.now(),
    };

    setItems((prev) => [item, ...prev]);
    resetAddForm();
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function adjustStock(id: string, delta: number) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, stock: Math.max(0, (x.stock || 0) + delta) } : x))
    );
  }

  function startEdit(id: string) {
    setEditingId(id);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(next: Partial<Vare>) {
    if (!editingId) return;
    setItems((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...next } : x)));
    setEditingId(null);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `varer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(parsed)) return;

        const cleaned: Vare[] = parsed
          .map((x: any) => ({
            id: String(x.id || uid()),
            name: String(x.name || "").trim(),
            price: Number(x.price) || 0,
            cost: Number(x.cost) || 0,
            stock: Math.max(0, Math.floor(Number(x.stock) || 0)),
            minStock: Math.max(0, Math.floor(Number(x.minStock) || 0)),
            createdAt: Number(x.createdAt) || Date.now(),
          }))
          .filter((x) => x.name.length > 0);

        setItems(cleaned);
      } catch {
        // ignore
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="grid">
      {/* TOPP */}
      <div className="card">
        <div className="row between wrap gap">
          <div>
            <div className="h2">Varer / Lager</div>
            <div className="muted">
              Antall varer: <b>{totals.count}</b> • Lager totalt: <b>{totals.stockTotal}</b>
              <span className="dot">•</span>
              Lagerverdi (kost): <b>{formatKr(totals.costValue)}</b>
              <span className="dot">•</span>
              (salgsverdi): <b>{formatKr(totals.sellValue)}</b>
            </div>

            {totals.lowCount > 0 && (
              <div className="lowBanner">
                ⚠️ <b>{totals.lowCount}</b> vare(r) er på eller under min-lager.
              </div>
            )}
          </div>

          <div className="row gap">
            <button className="btn" onClick={exportJson} type="button">
              Eksporter
            </button>

            <label className="btn ghost" style={{ cursor: "pointer" }}>
              Importer
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* LEGG TIL */}
      <div className="card">
        <div className="h2">Legg til vare</div>

        <div className="formGrid">
          <div className="field span-2">
            <label>Navn</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Navn (f.eks. Bremseklosser foran)"
              inputMode="text"
            />
          </div>

          <div className="field">
            <label>Pris (kr)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" inputMode="decimal" />
          </div>

          <div className="field">
            <label>Kost (kr)</label>
            <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" inputMode="decimal" />
          </div>

          <div className="field">
            <label>Lager (stk)</label>
            <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" inputMode="numeric" />
          </div>

          <div className="field">
            <label>Min lager (varsel)</label>
            <input
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="1"
              inputMode="numeric"
            />
          </div>

          <div className="row gap span-2">
            <button className="btn primary" onClick={addItem} type="button">
              + Legg til
            </button>

            <button className="btn ghost" onClick={resetAddForm} type="button">
              Nullstill
            </button>
          </div>
        </div>
      </div>

      {/* LISTE */}
      <div className="card">
        <div className="row between wrap gap">
          <div className="h2">Vareliste</div>

          <div className="field" style={{ minWidth: 240 }}>
            <label>Søk</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i varer…" />
          </div>
        </div>

        <div className="list">
          {filtered.length === 0 ? (
            <div className="empty">Ingen varer enda.</div>
          ) : (
            filtered.map((x) => {
              const low = (x.stock ?? 0) <= (x.minStock ?? 0);
              const margin = (x.price || 0) - (x.cost || 0);

              return (
                <div key={x.id} className={low ? "item low" : "item"}>
                  <div className="itemMain">
                    <div className="row between gap">
                      <div className="itemTitle">
                        {x.name} {low && <span className="badge bad">Lav</span>}
                      </div>

                      <div className="row gap">
                        <button className="btn small" onClick={() => adjustStock(x.id, -1)} type="button">
                          −1
                        </button>
                        <button className="btn small" onClick={() => adjustStock(x.id, +1)} type="button">
                          +1
                        </button>
                      </div>
                    </div>

                    <div className="muted">
                      Pris: <b>{formatKr(x.price)}</b> <span className="dot">•</span> Kost: <b>{formatKr(x.cost)}</b>{" "}
                      <span className="dot">•</span> Margin pr stk: <b>{formatKr(margin)}</b>
                      <span className="dot">•</span> Lager: <b>{x.stock}</b> <span className="dot">•</span> Min:{" "}
                      <b>{x.minStock}</b>
                    </div>

                    <div className="row gap" style={{ marginTop: 10 }}>
                      <button className="btn ghost" onClick={() => startEdit(x.id)} type="button">
                        Rediger
                      </button>
                      <button className="btn danger" onClick={() => removeItem(x.id)} type="button">
                        Slett
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="modalBackdrop" onClick={cancelEdit} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="h2">Rediger vare</div>

            <div className="formGrid" style={{ marginTop: 10 }}>
              <div className="field span-2">
                <label>Navn</label>
                <input
                  defaultValue={editingItem.name}
                  onChange={(e) => saveEdit({ name: e.target.value })}
                  style={{ display: "none" }}
                />
                {/* Vi bruker controlled under, men holder det enkelt: */}
                <input
                  value={editingItem.name}
                  onChange={(e) => setItems((prev) => prev.map((v) => (v.id === editingItem.id ? { ...v, name: e.target.value } : v)))}
                />
              </div>

              <div className="field">
                <label>Pris (kr)</label>
                <input
                  value={String(editingItem.price)}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((v) => (v.id === editingItem.id ? { ...v, price: n(e.target.value) } : v))
                    )
                  }
                  inputMode="decimal"
                />
              </div>

              <div className="field">
                <label>Kost (kr)</label>
                <input
                  value={String(editingItem.cost)}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((v) => (v.id === editingItem.id ? { ...v, cost: n(e.target.value) } : v))
                    )
                  }
                  inputMode="decimal"
                />
              </div>

              <div className="field">
                <label>Lager (stk)</label>
                <input
                  value={String(editingItem.stock)}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((v) =>
                        v.id === editingItem.id ? { ...v, stock: Math.max(0, Math.floor(n(e.target.value))) } : v
                      )
                    )
                  }
                  inputMode="numeric"
                />
              </div>

              <div className="field">
                <label>Min lager (varsel)</label>
                <input
                  value={String(editingItem.minStock)}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((v) =>
                        v.id === editingItem.id ? { ...v, minStock: Math.max(0, Math.floor(n(e.target.value))) } : v
                      )
                    )
                  }
                  inputMode="numeric"
                />
              </div>

              <div className="row gap span-2" style={{ marginTop: 10 }}>
                <button className="btn primary" onClick={() => setEditingId(null)} type="button">
                  Lagre
                </button>
                <button className="btn ghost" onClick={cancelEdit} type="button">
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
