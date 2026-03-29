import { useMemo, useState } from "react";
import CustomerPickerWithCreate from "../components/CustomerPickerWithCreate";
import ItemPickerWithCreate from "../components/ItemPickerWithCreate";
import { createEmptySale, fmtKr, makeSaleLine, saveSale } from "../app/storage";
import type { SaleDraft, SaleLine } from "../types";

export default function Salg() {
  const [draft, setDraft] = useState<SaleDraft>(createEmptySale());
  const [message, setMessage] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentNote, setPaymentNote] = useState("");

  function updateLine(lineId: string, patch: Partial<SaleLine>): void {
    setDraft((prev) => {
      const lines = prev.lines.map((line) => {
        if (line.id !== lineId) return line;
        const next: SaleLine = { ...line, ...patch };
        next.lineTotal = Number(next.qty || 0) * Number(next.unitPrice || 0);
        return next;
      });
      return { ...prev, lines };
    });
  }

  function addLine(): void {
    setDraft((prev) => ({
      ...prev,
      lines: [...prev.lines, makeSaleLine()],
    }));
  }

  const total = useMemo(() => {
    return draft.lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  }, [draft.lines]);

  const estimatedProfit = useMemo(() => {
    return draft.lines.reduce((sum, line) => {
      return sum + (Number(line.unitPrice || 0) - Number(line.unitCost || 0)) * Number(line.qty || 0);
    }, 0);
  }, [draft.lines]);

  function handleSave(): void {
    saveSale(draft, {
      paymentAmount: Number(paymentAmount || 0),
      paymentNote,
    });

    setMessage("Salg lagret");
    setDraft(createEmptySale());
    setPaymentAmount("0");
    setPaymentNote("");
  }

  return (
    <div>
      <h1 className="pageTitle">Salg</h1>
      <p className="pageLead">Registrer salg raskt, med fortjeneste og betaling i samme flyt.</p>

      <div className="card">
        <div className="grid2">
          <label className="label">
            <span>Kunde</span>
            <CustomerPickerWithCreate
              value={draft.customerId}
              onChange={(customer) =>
                setDraft((prev) => ({
                  ...prev,
                  customerId: customer?.id,
                  customerName: customer?.name ?? "",
                }))
              }
            />
          </label>

          <label className="label">
            <span>Notat</span>
            <input
              value={draft.note ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Valgfritt notat..."
            />
          </label>
        </div>

        <div className="list" style={{ marginTop: 18 }}>
          {draft.lines.map((line, index) => (
            <div key={line.id} className="lineCard">
              <div style={{ fontWeight: 800, fontSize: 22 }}>Linje {index + 1}</div>

              <label className="label">
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
                  <span>Pris per stk</span>
                  <input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value || 0) })}
                  />
                </label>
              </div>

              <div className="rowBetween">
                <span className="badge badgeBlue">Linjesum: {fmtKr(line.lineTotal)}</span>
                <span className="badge badgeGold">
                  Fortjeneste: {fmtKr((line.unitPrice - line.unitCost) * line.qty)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="cardActions">
          <button className="btn" type="button" onClick={addLine}>
            + Legg til linje
          </button>

          <div className="saleSummary">
            <div className="muted">Estimert fortjeneste</div>
            <div className="saleSummaryValue">{fmtKr(estimatedProfit)}</div>
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 18 }}>
          <label className="label">
            <span>Betalt nå</span>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </label>

          <label className="label">
            <span>Betalingsnotat</span>
            <input
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Vipps, kontant, bank..."
            />
          </label>
        </div>

        <div className="cardActions">
          <div className="saleSummary">
            <div className="muted">Totalt</div>
            <div className="saleSummaryValue">{fmtKr(total)}</div>
          </div>

          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            Lagre salg
          </button>
        </div>

        {message ? <div style={{ marginTop: 12, color: "#86efac" }}>{message}</div> : null}
      </div>
    </div>
  );
}
