import { useMemo, useState } from "react";
import ItemPickerWithCreate from "../components/ItemPickerWithCreate";
import {
  createEmptyPurchase,
  fmtKr,
  makePurchaseLine,
  savePurchase,
} from "../app/storage";
import type { PurchaseDraft, PurchaseLine } from "../types";

export default function Innkjop() {
  const [draft, setDraft] = useState<PurchaseDraft>(createEmptyPurchase());
  const [message, setMessage] = useState("");

  function updateLine(lineId: string, patch: Partial<PurchaseLine>): void {
    setDraft((prev) => {
      const lines = prev.lines.map((line) => {
        if (line.id !== lineId) return line;
        const next: PurchaseLine = { ...line, ...patch };
        next.lineTotal = Number(next.qty || 0) * Number(next.unitCost || 0);
        return next;
      });
      return { ...prev, lines };
    });
  }

  function addLine(): void {
    setDraft((prev) => ({
      ...prev,
      lines: [...prev.lines, makePurchaseLine()],
    }));
  }

  const total = useMemo(() => {
    return draft.lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  }, [draft.lines]);

  function handleSave(): void {
    savePurchase(draft);
    setMessage("Innkjøp lagret");
    setDraft(createEmptyPurchase());
  }

  return (
    <div>
      <h1 className="pageTitle">Innkjøp</h1>

      <div className="card">
        <div className="grid2">
          <label className="label">
            <span>Leverandør</span>
            <input
              value={draft.supplier}
              onChange={(e) => setDraft((prev) => ({ ...prev, supplier: e.target.value }))}
              placeholder="F.eks. Biltema / Mekonomen"
            />
          </label>

          <label className="label">
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  status: e.target.value as PurchaseDraft["status"],
                }))
              }
            >
              <option value="betalt">Betalt</option>
              <option value="ikke_betalt">Ikke betalt</option>
            </select>
          </label>
        </div>

        <label className="label" style={{ marginTop: 14 }}>
          <span>Oppdater vare-kost</span>
          <select
            value={draft.updateCostMode}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                updateCostMode: e.target.value as PurchaseDraft["updateCostMode"],
              }))
            }
          >
            <option value="weighted_average">Vektet snitt (anbefalt)</option>
            <option value="last_price">Sett til siste pris</option>
            <option value="no_change">Ikke endre</option>
          </select>
        </label>

        <div className="list" style={{ marginTop: 16 }}>
          {draft.lines.map((line, index) => (
            <div key={line.id} className="lineCard">
              <div style={{ fontWeight: 800, fontSize: 22 }}>Linje {index + 1}</div>

              <label className="label">
                <span>Type</span>
                <select
                  value={line.kind}
                  onChange={(e) =>
                    updateLine(line.id, {
                      kind: e.target.value as PurchaseLine["kind"],
                    })
                  }
                >
                  <option value="varekjop">Varekjøp (lager)</option>
                  <option value="forbruk">Forbruk</option>
                  <option value="utstyr">Utstyr</option>
                </select>
              </label>

              <label className="label">
                <span>Vare</span>
                <ItemPickerWithCreate
                  value={line.itemId}
                  onChange={(item) => {
                    updateLine(line.id, {
                      itemId: item?.id,
                      itemName: item?.name ?? "",
                      unitCost: item?.costPrice ?? 0,
                      lineTotal: (item?.costPrice ?? 0) * (line.qty || 0),
                    });
                  }}
                />
              </label>

              <div className="grid2">
                <label className="label">
                  <span>Antall</span>
                  <input
                    type="number"
                    value={line.qty}
                    onChange={(e) => updateLine(line.id, { qty: Number(e.target.value || 0) })}
                  />
                </label>

                <label className="label">
                  <span>Kostpris</span>
                  <input
                    type="number"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.id, { unitCost: Number(e.target.value || 0) })}
                  />
                </label>
              </div>

              <span className="badge badgeBlue">Linjesum: {fmtKr(line.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="rowBetween" style={{ marginTop: 16 }}>
          <button className="btn" type="button" onClick={addLine}>
            + Legg til linje
          </button>

          <div style={{ textAlign: "right" }}>
            <div className="muted">Totalt</div>
            <div style={{ fontSize: 32, fontWeight: 900 }}>{fmtKr(total)}</div>
          </div>
        </div>

        <div className="rowBetween" style={{ marginTop: 18 }}>
          <div className="muted">Lagrer lagerøkning og oppdaterer kostpris.</div>
          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            Lagre innkjøp
          </button>
        </div>

        {message ? <div style={{ marginTop: 12, color: "#86efac" }}>{message}</div> : null}
      </div>
    </div>
  );
}
