import { useState } from "react";
import type { PurchaseDraft } from "../types";
import { createEmptyPurchase, makePurchaseLine, savePurchase } from "../app/storage";
import ItemPickerWithCreate from "../components/ItemPickerWithCreate";

export default function Innkjop() {
  const [draft, setDraft] = useState<PurchaseDraft>(createEmptyPurchase());
  const [message, setMessage] = useState("");

  function updateLine(lineId: string, patch: Partial<PurchaseDraft["lines"][number]>) {
    setDraft((prev) => {
      const lines = prev.lines.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        next.lineTotal = Number(next.qty || 0) * Number(next.unitCost || 0);
        return next;
      });
      return { ...prev, lines };
    });
  }

  function addLine() {
    setDraft((prev) => ({ ...prev, lines: [...prev.lines, makePurchaseLine()] }));
  }

  function handleSave() {
    savePurchase(draft);
    setMessage("Innkjøp lagret");
    setDraft(createEmptyPurchase());
  }

  return (
    <div style={pageStyle}>
      <h1>Innkjøp</h1>

      <div style={cardStyle}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={fieldStyle}>
            <span>Leverandør</span>
            <input
              value={draft.supplier}
              onChange={(e) => setDraft((prev) => ({ ...prev, supplier: e.target.value }))}
              placeholder="F.eks. Biltema / Mekonomen"
            />
          </label>

          <label style={fieldStyle}>
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

          <label style={fieldStyle}>
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

          {draft.lines.map((line, index) => (
            <div key={line.id} style={lineCardStyle}>
              <div style={{ fontWeight: 700 }}>Linje {index + 1}</div>

              <label style={fieldStyle}>
                <span>Type</span>
                <select
                  value={line.kind}
                  onChange={(e) =>
                    updateLine(line.id, {
                      kind: e.target.value as typeof line.kind,
                    })
                  }
                >
                  <option value="varekjop">Varekjøp (lager)</option>
                  <option value="forbruk">Forbruk</option>
                  <option value="utstyr">Utstyr</option>
                </select>
              </label>

              <label style={fieldStyle}>
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

              <div style={twoColStyle}>
                <label style={fieldStyle}>
                  <span>Antall</span>
                  <input
                    type="number"
                    value={line.qty}
                    onChange={(e) => updateLine(line.id, { qty: Number(e.target.value || 0) })}
                  />
                </label>

                <label style={fieldStyle}>
                  <span>Kostpris</span>
                  <input
                    type="number"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.id, { unitCost: Number(e.target.value || 0) })}
                  />
                </label>
              </div>

              <div style={{ opacity: 0.8 }}>Linjesum: {line.lineTotal.toFixed(2)} kr</div>
            </div>
          ))}

          <button style={secondaryButtonStyle} onClick={addLine}>
            + Legg til linje
          </button>

          <button style={primaryButtonStyle} onClick={handleSave}>
            Lagre innkjøp
          </button>

          {message ? <div>{message}</div> : null}
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 16,
  color: "#fff",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 16,
};

const lineCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  borderRadius: 16,
  padding: 14,
  display: "grid",
  gap: 12,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const twoColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: 0,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
};
