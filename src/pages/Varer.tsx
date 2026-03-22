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

export function Varer() {
  const { items, upsert, remove, adjust, setAll } = useItems();

  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(10);

  // modaler
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Vare | null>(null);
  const [details, setDetails] = useState<Vare | null>(null);

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
    const lowCount = items.reduce((a, b) => a + ((b.stock ?? 0) <= (b.minStock ?? 0) && (b.minStock ?? 0) > 0 ? 1 : 0), 0);

    return {
      count,
      totalStock,
      totalCostValue: round2(totalCostValue),
      totalSaleValue: round2(totalSaleValue),
      totalPotentialProfit: round2(totalPotentialProfit),
      lowCount,
    };
  }, [items]);

  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

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

  return (
    <div className="card">
      <div className="cardTitle">Varer</div>
      <div className="cardSub">
        Varer <b>{stats.count}</b> • Lager <b>{stats.totalStock}</b> stk • Kostverdi <b>{fmtKr(stats.totalCostValue)}</b> • Salgsverdi{" "}
        <b>{fmtKr(stats.totalSaleValue)}</b> • Pot. profitt <b>{fmtKr(stats.totalPotentialProfit)}</b>
        {stats.lowCount > 0 ? (
          <>
            {" "}
            • <b>⚠️ Lavt lager: {stats.lowCount}</b>
          </>
        ) : null}
      </div>

      {/* Top actions (kompakt) */}
      <div className="btnRow">
        <button className="btn btnPrimary" type="button" onClick={() => setAddOpen(true)}>
          + Ny vare
        </button>
        <button className="btn" type="button" onClick={exportJson}>
          Eksporter
        </button>
        <button className="btn" type="button" onClick={importJson}>
          Importer
        </button>
      </div>

      <div style={{ height: 10 }} />

      {/* Søk */}
      <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setLimit(10); }} placeholder="Søk i varer..." />

      <div className="card" style={{ marginTop: 10 }}>
        <div className="cardTitle" style={{ marginBottom: 4 }}>Liste</div>
        <div className="cardSub" style={{ marginBottom: 0 }}>
          Viser <b>{Math.min(limit, filtered.length)}</b> av <b>{filtered.length}</b>
          {filtered.length > limit ? (
            <>
              {" "}
              • <button className="btn" type="button" onClick={() => setLimit((n) => n + 10)} style={{ padding: "7px 10px", minHeight: 30 }}>
                Vis 10 til
              </button>
            </>
          ) : null}
        </div>

        <div className="list" style={{ marginTop: 10 }}>
          {visible.map((i) => (
            <div key={i.id} className={isLow(i) ? "item low" : "item"}>
              <div className="itemTop">
                <div>
                  <div className="itemTitle" style={{ marginBottom: 2 }}>
                    {i.name}
                  </div>

                  {/* Kompakt 2-linjers meta */}
                  <div className="itemMeta">
                    Lager <b>{i.stock}</b> • Min <b>{i.minStock}</b>
                    {isLow(i) ? <> • <b>⚠️ Lav</b></> : null}
                  </div>
                  <div className="itemMeta" style={{ marginTop: 4 }}>
                    Pris <b>{fmtKr(i.price)}</b> • Kost <b>{fmtKr(i.cost)}</b>
                  </div>
                </div>

                {/* Pen stepper */}
                <div className="stockStepper">
                  <button className="stepBtn" type="button" onClick={() => adjust(i.id, -1)} title="Trekk 1">
                    −
                  </button>
                  <div className="stepVal">{i.stock}</div>
                  <button className="stepBtn" type="button" onClick={() => adjust(i.id, 1)} title="Legg til 1">
                    +
                  </button>
                </div>
              </div>

              {/* Actions (kompakt) */}
              <div className="itemActions">
                <button className="btn" type="button" onClick={() => setDetails(i)}>
                  Detaljer
                </button>
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
      </div>

      {/* Modal: Ny vare */}
      <Modal open={addOpen} title="Ny vare" onClose={() => setAddOpen(false)}>
        <ItemForm
          mode="add"
          onCancel={() => setAddOpen(false)}
          onSave={(next) => {
            upsert(next);
            setAddOpen(false);
          }}
        />
      </Modal>

      {/* Modal: Rediger */}
      <Modal open={!!edit} title="Rediger vare" onClose={() => setEdit(null)}>
        {edit ? (
          <ItemForm
            mode="edit"
            item={edit}
            onCancel={() => setEdit(null)}
            onSave={(next) => {
              upsert(next);
              setEdit(null);
            }}
          />
        ) : null}
      </Modal>

      {/* Modal: Detaljer */}
      <Modal open={!!details} title="Varedetaljer" onClose={() => setDetails(null)}>
        {details ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="item">
              <div className="itemTitle">{details.name}</div>
              <div className="itemMeta" style={{ marginTop: 6 }}>
                Lager <b>{details.stock}</b> • Min <b>{details.minStock}</b>
                {isLow(details) ? <> • <b>⚠️ Lavt lager</b></> : null}
              </div>
              <div className="itemMeta" style={{ marginTop: 6 }}>
                Pris <b>{fmtKr(details.price)}</b> • Kost <b>{fmtKr(details.cost)}</b>
              </div>
              <div className="itemMeta" style={{ marginTop: 6 }}>
                Kostverdi <b>{fmtKr(costValue(details))}</b> • Salgsverdi <b>{fmtKr(saleValue(details))}</b> • Pot. profitt{" "}
                <b>{fmtKr(potentialProfit(details))}</b>
              </div>
            </div>

            <div className="btnRow" style={{ marginTop: 0 }}>
              <button className="btn" type="button" onClick={() => adjust(details.id, -1)}>
                −1
              </button>
              <button className="btn" type="button" onClick={() => adjust(details.id, 1)}>
                +1
              </button>
              <button className="btn" type="button" onClick={() => { setEdit(details); setDetails(null); }}>
                Rediger
              </button>
              <button className="btn btnDanger" type="button" onClick={() => { if (confirm(`Slette "${details.name}"?`)) { remove(details.id); setDetails(null); } }}>
                Slett
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function ItemForm(props: {
  mode: "add" | "edit";
  item?: Vare;
  onSave: (next: Omit<Vare, "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}) {
  const it = props.item;

  const [name, setName] = useState(it?.name ?? "");
  const [price, setPrice] = useState(String(it?.price ?? 0));
  const [cost, setCost] = useState(String(it?.cost ?? 0));
  const [stock, setStock] = useState(String(it?.stock ?? 0));
  const [minStock, setMinStock] = useState(String(it?.minStock ?? 10));

  const canSave = name.trim().length > 0;

  return (
    <div className="fieldGrid" style={{ marginTop: 0 }}>
      <div>
        <label className="label">Navn</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Bremseklosser foran" />
      </div>

      <div className="row3">
        <div>
          <label className="label">Pris</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label">Kost</label>
          <input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div>
          <label className="label">Lager</label>
          <input className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Min lager (varsel)</label>
        <input className="input" inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0 = ingen varsel" />
      </div>

      <div className="btnRow" style={{ marginTop: 0 }}>
        <button
          className="btn btnPrimary"
          type="button"
          disabled={!canSave}
          onClick={() =>
            props.onSave({
              id: props.mode === "edit" && it ? it.id : uid("item"),
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
        <button className="btn" type="button" onClick={props.onCancel}>
          Avbryt
        </button>
      </div>
    </div>
  );
}
