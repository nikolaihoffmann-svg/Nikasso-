import { useState } from "react";
import type { SaleDraft, SaleLine } from "../types";
import { createEmptySale, makeSaleLine, saveSale } from "../app/storage";
import ItemPickerWithCreate from "../components/ItemPickerWithCreate";

export default function Salg() {
  const [draft, setDraft] = useState<SaleDraft>(createEmptySale());
  const [message, setMessage] = useState("");

  function updateLine(lineId: string, patch: Partial<SaleLine>): void {
    setDraft((prev: SaleDraft) => {
      const lines = prev.lines.map((line: SaleLine) => {
        if (line.id !== lineId) return line;
        const next: SaleLine = { ...line, ...patch };
        next.lineTotal = Number(next.qty || 0) * Number(next.unitPrice || 0);
        return next;
      });
      return { ...prev, lines };
    });
  }

  function addLine(): void {
    setDraft((prev: SaleDraft) => ({ ...prev, lines: [...prev.lines, makeSaleLine()] }));
  }

  function handleSave(): void {
    saveSale(draft);
    setMessage("Salg lagret");
    setDraft(createEmptySale());
  }

  return (
    <div style={pageStyle}>
      <h1>Salg</h1>

      <div style={cardStyle}>
        <div style={{ display: "grid", gap: 16 }}>
          {draft.lines.map((line: SaleLine, index: number) => (
            <div key={line.id} style={lineCardStyle}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Linje {index + 1}</div>

              <label style={fieldStyle}>
                <span>Vare</span>
                <ItemPickerWithCreate
                  value={line.itemId}
                  onChange={(item) => {
                    updateLine(line.id, {
                      itemId: item?.id,
                      itemName: item?.name ?? "",
                      unitPrice: item?.salePrice ?? 0,
                      unitCost: item?.costPrice ?? 0,
                      lineTotal: (item?.salePrice ?? 0) * (line.qty || 0),
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
                  <span>Pris per stk</span>
                  <input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) =>
                      updateLine(line.id, { unitPrice: Number(e.target.value || 0) })
                    }
                  />
                </label>
              </div>

              <div style={{ opacity: 0.8 }}>Linjesum: {line.lineTotal.toFixed(2)} kr</div>
            </div>
          ))}

          <button style={secondaryButtonStyle} onClick={addLine} type="button">
            + Legg til linje
          </button>

          <button style={primaryButtonStyle} onClick={handleSave} type="button">
            Lagre salg
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
