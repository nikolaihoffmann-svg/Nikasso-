import React, { useEffect, useMemo, useState } from "react";

type Vare = {
  id: string;
  name: string;
  price: number; // salgspris
  cost: number; // innkjøpspris / kost
  stock: number; // lager
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "salg-gjeld.varer.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uid() {
  // iOS/Safari kan støtte crypto.randomUUID, men vi har fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  // hold det enkelt: 2 desimaler
  return Math.round(n * 100) / 100;
}

function formatMoney(n: number) {
  // enkel visning (NOK-ish)
  return `${clampMoney(n).toLocaleString("nb-NO")} kr`;
}

export function Varer() {
  const [varer, setVarer] = useState<Vare[]>(() =>
    safeParse<Vare[]>(localStorage.getItem(STORAGE_KEY), [])
  );

  // Ny vare (skjema)
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [cost, setCost] = useState<string>("");
  const [stock, setStock] = useState<string>("");

  // Redigering
  const [editId, setEditId] = useState<string | null>(null);
  const editVare = useMemo(
    () => varer.find((v) => v.id === editId) ?? null,
    [editId, varer]
  );
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editCost, setEditCost] = useState<string>("");
  const [editStock, setEditStock] = useState<string>("");

  // Søk
  const [q, setQ] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(varer));
  }, [varer]);

  useEffect(() => {
    if (!editVare) return;
    setEditName(editVare.name);
    setEditPrice(String(editVare.price));
    setEditCost(String(editVare.cost));
    setEditStock(String(editVare.stock));
  }, [editVare]);

  const filtrert = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return varer;
    return varer.filter((v) => v.name.toLowerCase().includes(query));
  }, [q, varer]);

  const totals = useMemo(() => {
    const antall = varer.length;
    const lagerSum = varer.reduce((sum, v) => sum + (v.stock || 0), 0);
    const lagerVerdiKost = varer.reduce(
      (sum, v) => sum + (v.stock || 0) * (v.cost || 0),
      0
    );
    const lagerVerdiSalg = varer.reduce(
      (sum, v) => sum + (v.stock || 0) * (v.price || 0),
      0
    );
    return { antall, lagerSum, lagerVerdiKost, lagerVerdiSalg };
  }, [varer]);

  function addVare() {
    const n = name.trim();
    if (!n) return alert("Skriv navn på vare.");

    const p = clampMoney(Number(price.replace(",", ".")));
    const c = clampMoney(Number(cost.replace(",", ".")));
    const s = clampInt(Number(stock.replace(",", ".")));

    const now = Date.now();
    const ny: Vare = {
      id: uid(),
      name: n,
      price: Number.isFinite(p) ? p : 0,
      cost: Number.isFinite(c) ? c : 0,
      stock: Number.isFinite(s) ? s : 0,
      createdAt: now,
      updatedAt: now,
    };

    setVarer((prev) => [ny, ...prev]);
    setName("");
    setPrice("");
    setCost("");
    setStock("");
  }

  function startEdit(id: string) {
    setEditId(id);
  }

  function cancelEdit() {
    setEditId(null);
  }

  function saveEdit() {
    if (!editVare) return;

    const n = editName.trim();
    if (!n) return alert("Navn kan ikke være tomt.");

    const p = clampMoney(Number(editPrice.replace(",", ".")));
    const c = clampMoney(Number(editCost.replace(",", ".")));
    const s = clampInt(Number(editStock.replace(",", ".")));

    const now = Date.now();
    setVarer((prev) =>
      prev.map((v) =>
        v.id === editVare.id
          ? {
              ...v,
              name: n,
              price: Number.isFinite(p) ? p : 0,
              cost: Number.isFinite(c) ? c : 0,
              stock: Number.isFinite(s) ? s : 0,
              updatedAt: now,
            }
          : v
      )
    );
    setEditId(null);
  }

  function delVare(id: string) {
    const v = varer.find((x) => x.id === id);
    if (!v) return;
    const ok = confirm(`Slette "${v.name}"?`);
    if (!ok) return;
    setVarer((prev) => prev.filter((x) => x.id !== id));
  }

  function adjustStock(id: string, delta: number) {
    setVarer((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, stock: clampInt((v.stock || 0) + delta), updatedAt: Date.now() }
          : v
      )
    );
  }

  function exportJSON() {
    const data = JSON.stringify(varer, null, 2);
    // Kopier til utklippstavle (best effort)
    navigator.clipboard
      ?.writeText(data)
      .then(() => alert("Eksport kopiert til utklippstavlen ✅"))
      .catch(() => alert("Kunne ikke kopiere. Marker og kopier manuelt:\n\n" + data));
  }

  function importJSON() {
    const raw = prompt("Lim inn JSON (varer) her. Dette vil ERSTATTE listen din:");
    if (!raw) return;

    const parsed = safeParse<Vare[]>(raw, []);
    if (!Array.isArray(parsed)) return alert("Ugyldig JSON.");

    // Litt enkel validering + normalisering
    const now = Date.now();
    const cleaned: Vare[] = parsed
      .filter((x) => x && typeof x === "object")
      .map((x: any) => ({
        id: typeof x.id === "string" ? x.id : uid(),
        name: typeof x.name === "string" ? x.name : "Uten navn",
        price: clampMoney(Number(x.price)),
        cost: clampMoney(Number(x.cost)),
        stock: clampInt(Number(x.stock)),
        createdAt: Number.isFinite(Number(x.createdAt)) ? Number(x.createdAt) : now,
        updatedAt: Number.isFinite(Number(x.updatedAt)) ? Number(x.updatedAt) : now,
      }));

    const ok = confirm(`Importere ${cleaned.length} varer og erstatte dagens liste?`);
    if (!ok) return;
    setVarer(cleaned);
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Varer / Lager</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              Antall varer: <b>{totals.antall}</b> • Lager totalt: <b>{totals.lagerSum}</b>
              <br />
              Lagerverdi (kost): <b>{formatMoney(totals.lagerVerdiKost)}</b> • (salgsverdi):{" "}
              <b>{formatMoney(totals.lagerVerdiSalg)}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <button className="tab" type="button" onClick={exportJSON}>
              Eksporter
            </button>
            <button className="tab" type="button" onClick={importJSON}>
              Importer
            </button>
          </div>
        </div>

        {/* Legg til vare */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>Legg til vare</div>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Navn (f.eks. Bremseklosser foran)"
              style={inputStyle}
            />

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Pris (kr)"
                inputMode="decimal"
                style={inputStyle}
              />
              <input
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Kost (kr)"
                inputMode="decimal"
                style={inputStyle}
              />
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="Lager (stk)"
                inputMode="numeric"
                style={inputStyle}
              />
            </div>

            <button className="tab active" type="button" onClick={addVare} style={{ width: "fit-content" }}>
              + Legg til
            </button>
          </div>
        </div>

        {/* Søk */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk i varer…"
          style={inputStyle}
        />

        {/* Liste */}
        <div style={{ display: "grid", gap: 10 }}>
          {filtrert.length === 0 ? (
            <div style={{ opacity: 0.8 }}>Ingen varer enda.</div>
          ) : (
            filtrert.map((v) => (
              <div
                key={v.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{v.name}</div>
                    <div style={{ opacity: 0.85, fontSize: 13 }}>
                      Pris: <b>{formatMoney(v.price)}</b> • Kost: <b>{formatMoney(v.cost)}</b> • Lager:{" "}
                      <b>{v.stock}</b>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="tab" type="button" onClick={() => adjustStock(v.id, -1)}>
                      −1
                    </button>
                    <button className="tab" type="button" onClick={() => adjustStock(v.id, +1)}>
                      +1
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="tab" type="button" onClick={() => startEdit(v.id)}>
                    Rediger
                  </button>
                  <button className="tab" type="button" onClick={() => delVare(v.id)}>
                    Slett
                  </button>
                </div>

                {/* Redigeringsfelt */}
                {editId === v.id && (
                  <div
                    style={{
                      marginTop: 4,
                      paddingTop: 10,
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Rediger</div>

                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />

                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
                      <input
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        inputMode="decimal"
                        placeholder="Pris"
                        style={inputStyle}
                      />
                      <input
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                        inputMode="decimal"
                        placeholder="Kost"
                        style={inputStyle}
                      />
                      <input
                        value={editStock}
                        onChange={(e) => setEditStock(e.target.value)}
                        inputMode="numeric"
                        placeholder="Lager"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="tab active" type="button" onClick={saveEdit}>
                        Lagre
                      </button>
                      <button className="tab" type="button" onClick={cancelEdit}>
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  outline: "none",
};
