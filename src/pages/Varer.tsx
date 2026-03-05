// src/pages/Varer.tsx
import React, { useMemo, useState } from "react";
import { fmtKr, round2, uid, useItems, Vare } from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function Modal(props: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!props.open) return null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <p className="modalTitle">{props.title}</p>
          <button className="iconBtn" type="button" onClick={props.onClose} aria-label="Lukk">
            ✕
          </button>
        </div>
        <div className="modalBody">{props.children}</div>
      </div>
    </div>
  );
}

export function Varer() {
  const { items, upsert, remove, adjust, setAll } = useItems();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [cost, setCost] = useState("0");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("10"); // default 10

  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Vare | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((i) => i.name.toLowerCase().includes(qq));
  }, [items, q]);

  const stats = useMemo(() => {
    const count = items.length;

    const totalStock = items.reduce((a, b) => a + (b.stock || 0), 0);
    const totalCostValue = items.reduce((a, b) => a + (b.cost || 0) * (b.stock || 0), 0);
    const totalSaleValue = items.reduce((a, b) => a + (b.price || 0) * (b.stock || 0), 0);
    const totalPotentialProfit = items.reduce((a, b) => a + ((b.price || 0) - (b.cost || 0)) * (b.stock || 0), 0);

    const lowCount = items.reduce(
      (a, b) => a + ((b.stock ?? 0) <= (b.minStock ?? 0) && (b.minStock ?? 0) > 0 ? 1 : 0),
      0
    );

    return {
      count,
      totalStock,
      totalCostValue: round2(totalCostValue),
      totalSaleValue: round2(totalSaleValue),
      totalPotentialProfit: round2(totalPotentialProfit),
      lowCount,
    };
  }, [items]);

  function addItem() {
    const n = name.trim();
    if (!n) return;

    upsert({
      id: uid("item"),
      name: n,
      price: round2(toNum(price)),
      cost: round2(toNum(cost)),
      stock: Math.trunc(toNum(stock)),
      minStock: Math.trunc(toNum(minStock)),
    });

    setName("");
    setPrice("0");
    setCost("0");
    setStock("0");
    setMinStock("10");
  }

  function exportJson() {
    const payload = { version: 1, exportedAt: new Date().toISOString(), items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `varer-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        const next: Vare[] = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];

        const normalized = next
          .map((x: any) => ({
            id: String(x.id ?? uid("item")),
            name: String(x.name ?? ""),
            price: Number(x.price ?? 0),
            cost: Number(x.cost ?? 0),
            stock: Number(x.stock ?? 0),
            minStock: Number(x.minStock ?? 10),
            createdAt: String(x.createdAt ?? new Date().toISOString()),
            updatedAt: String(x.updatedAt ?? new Date().toISOString()),
          }))
          .filter((x) => x.name.trim().length > 0);

        setAll(normalized);
      } catch {
        alert("Kunne ikke importere filen (ugyldig JSON).");
      }
    };
    input.click();
  }

  function isLow(i: Vare) {
    const min = i.minStock ?? 0;
    if (min <= 0) return false;
    return (i.stock ?? 0) <= min;
  }

  function costValue(i: Vare) {
    return round2((i.cost || 0) * (i.stock || 0));
  }
  function saleValue(i: Vare) {
    return round2((i.price || 0) * (i.stock || 0));
  }
  function potentialProfit(i: Vare) {
    return round2(((i.price || 0) - (i.cost || 0)) * (i.stock || 0));
  }

  return (
    <div className="card">
      <div className="cardTitle">Varer / Lager</div>
      <div className="cardSub">
        Varer: <b>{stats.count}</b> • Lager (stk): <b>{stats.totalStock}</b> • Lagerverdi (kost):{" "}
        <b>{fmtKr(stats.totalCostValue)}</b> • Lagerverdi (salgsverdi): <b>{fmtKr(stats.totalSaleValue)}</b> • Potensiell profitt:{" "}
        <b>{fmtKr(stats.totalPotentialProfit)}</b>
        {stats.lowCount > 0 ? (
          <>
            {" "}
            • <b style={{ opacity: 0.95 }}>⚠️ Lavt lager: {stats.lowCount}</b>
          </>
        ) : null}
      </div>

      <div className="btnRow">
        <button className="btn" type="button" onClick={exportJson}>
          Eksporter varer
        </button>
        <button className="btn" type="button" onClick={importJson}>
          Importer varer
        </button>
      </div>

      <div style={{ height: 14 }} />

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Legg til vare</div>

        <div className="fieldGrid">
          <div>
            <label className="label">Navn</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn (f.eks. Bremseklosser foran)" />
          </div>

          <div className="row3">
            <div>
              <label className="label">Pris (kr)</label>
              <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label className="label">Kost (kr)</label>
              <input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div>
              <label className="label">Lager (stk)</label>
              <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Min lager (varsel)</label>
            <input className="input" inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0 = ingen varsel" />
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={addItem}>
              + Legg til
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i varer..." />
      </div>

      <div className="list">
        {filtered.map((i) => (
          <div key={i.id} className={isLow(i) ? "item low" : "item"}>
            <div className="itemTop">
              <div>
                <p className="itemTitle">{i.name}</p>

                <div className="itemMeta">
                  Lager: <b>{i.stock}</b> stk • Min: <b>{i.minStock}</b>
                </div>

                <div className="itemMeta" style={{ marginTop: 6 }}>
                  Pris: <b>{fmtKr(i.price)}</b> • Kost: <b>{fmtKr(i.cost)}</b>
                </div>

                <div className="itemMeta" style={{ marginTop: 6 }}>
                  Kostverdi: <b>{fmtKr(costValue(i))}</b> • Salgsverdi: <b>{fmtKr(saleValue(i))}</b> • Pot. profitt:{" "}
                  <b>{fmtKr(potentialProfit(i))}</b>
                </div>

                {isLow(i) ? <div className="lowTag">⚠️ Lavt lager (≤ {i.minStock})</div> : null}
              </div>

              <div className="stockBtns">
                <button className="stockBtn" type="button" onClick={() => adjust(i.id, -1)} title="Trekk 1">
                  −1
                </button>
                <button className="stockBtn" type="button" onClick={() => adjust(i.id, 1)} title="Legg til 1">
                  +1
                </button>
              </div>
            </div>

            <div className="itemActions">
              <button className="btn" type="button" onClick={() => setEdit(i)}>
                Rediger
              </button>
              <button
                className="btn btnDanger"
                type="button"
                onClick={() => {
                  if (confirm(`Slette "${i.name}"?`)) remove(i.id);
                }}
              >
                Slett
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? <div className="item">Ingen treff.</div> : null}
      </div>

      <Modal open={!!edit} title="Rediger vare" onClose={() => setEdit(null)}>
        {edit ? (
          <EditForm
            item={edit}
            onSave={(next) => {
              upsert(next);
              setEdit(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function EditForm(props: { item: Vare; onSave: (next: Omit<Vare, "createdAt" | "updatedAt">) => void }) {
  const [name, setName] = useState(props.item.name);
  const [price, setPrice] = useState(String(props.item.price ?? 0));
  const [cost, setCost] = useState(String(props.item.cost ?? 0));
  const [stock, setStock] = useState(String(props.item.stock ?? 0));
  const [minStock, setMinStock] = useState(String(props.item.minStock ?? 10));

  return (
    <div className="fieldGrid">
      <div>
        <label className="label">Navn</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="row3">
        <div>
          <label className="label">Pris (kr)</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label">Kost (kr)</label>
          <input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div>
          <label className="label">Lager (stk)</label>
          <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Min lager (varsel)</label>
        <input className="input" inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </div>

      <div className="btnRow">
        <button
          className="btn btnPrimary"
          type="button"
          onClick={() =>
            props.onSave({
              id: props.item.id,
              name: name.trim(),
              price: round2(toNum(price)),
              cost: round2(toNum(cost)),
              stock: Math.trunc(toNum(stock)),
              minStock: Math.trunc(toNum(minStock)),
            })
          }
        >
          Lagre
        </button>
      </div>
    </div>
  );
}
