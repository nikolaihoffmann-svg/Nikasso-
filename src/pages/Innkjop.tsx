import { useMemo, useState } from "react";
import ItemPickerWithCreate from "../components/ItemPickerWithCreate";
import {
  createEmptyPurchase,
  deletePurchase,
  fmtKr,
  getPurchases,
  makePurchaseLine,
  savePurchase,
} from "../app/storage";
import type { PurchaseDraft, PurchaseLine, PurchaseRecord } from "../types";

export default function Innkjop() {
  const [draft, setDraft] = useState<PurchaseDraft>(createEmptyPurchase());
  const [message, setMessage] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");

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

  function removeLine(lineId: string): void {
    setDraft((prev) => {
      if (prev.lines.length <= 1) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((line) => line.id !== lineId),
      };
    });
  }

  const total = useMemo(() => {
    return draft.lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  }, [draft.lines]);

  function handleSave(): void {
    savePurchase(draft);
    setMessage(`Innkjøp lagret ${Date.now()}`);
    setDraft(createEmptyPurchase());
  }

  const purchases = useMemo(() => getPurchases(), [message]);

  const filteredPurchases = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return purchases;

    return purchases.filter((purchase) => {
      const supplierHit = (purchase.supplier || "").toLowerCase().includes(q);
      const noteHit = (purchase.note || "").toLowerCase().includes(q);
      const statusHit = (purchase.status || "").toLowerCase().includes(q);
      const lineHit = purchase.lines.some((line) =>
        (line.itemName || "").toLowerCase().includes(q)
      );

      return supplierHit || noteHit || statusHit || lineHit;
    });
  }, [purchases, historyQuery]);

  function purchaseTitle(purchase: PurchaseRecord): string {
    if (purchase.supplier?.trim()) return purchase.supplier.trim();
    return "Innkjøp uten leverandør";
  }

  function handleDeletePurchase(purchase: PurchaseRecord): void {
    if (!confirm(`Slette innkjøpet fra "${purchaseTitle(purchase)}"? Lager trekkes tilbake.`)) {
      return;
    }

    deletePurchase(purchase.id);
    setMessage(`Innkjøp slettet ${Date.now()}`);
  }

  return (
    <div>
      <h1 className="pageTitle">Innkjøp</h1>
      <p className="pageLead">Siste pris er nå standard, siden du ikke vil blande gammel og ny varekost.</p>

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
            <option value="last_price">Siste pris (anbefalt)</option>
            <option value="no_change">Ikke endre</option>
          </select>
        </label>

        <div className="list" style={{ marginTop: 18 }}>
          {draft.lines.map((line, index) => (
            <div key={line.id} className="lineCard">
              <div className="rowBetween">
                <div style={{ fontWeight: 800, fontSize: 22 }}>Linje {index + 1}</div>
                {draft.lines.length > 1 ? (
                  <button className="btn btnDanger" type="button" onClick={() => removeLine(line.id)}>
                    Fjern linje
                  </button>
                ) : null}
              </div>

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

        <div className="cardActions">
          <button className="btn" type="button" onClick={addLine}>
            + Legg til linje
          </button>

          <div className="saleSummary">
            <div className="muted">Totalt</div>
            <div className="saleSummaryValue">{fmtKr(total)}</div>
          </div>
        </div>

        <div className="cardActions">
          <div className="muted">Ved varekjøp brukes nå siste innkjøpspris som ny kostpris.</div>
          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            Lagre innkjøp
          </button>
        </div>

        {message ? (
          <div style={{ marginTop: 12, color: "#86efac" }}>{message.replace(/\s\d+$/, "")}</div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="rowBetween" style={{ marginBottom: 14 }}>
          <h2 className="sectionTitle" style={{ marginBottom: 0 }}>Innkjøpshistorikk</h2>
          <span className="badge">{filteredPurchases.length} vises</span>
        </div>

        <label className="label" style={{ marginBottom: 14 }}>
          <span>Søk i innkjøp</span>
          <input
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
            placeholder="Søk leverandør, vare, notat eller status..."
          />
        </label>

        <div className="featureList">
          {filteredPurchases.length === 0 ? (
            <div className="emptyText">Ingen innkjøp funnet.</div>
          ) : (
            filteredPurchases.map((purchase) => (
              <div key={purchase.id} className="card">
                <div className="rowBetween" style={{ marginBottom: 12 }}>
                  <div className="customerMain">
                    <div className="featureRowTitle">{purchaseTitle(purchase)}</div>
                    <div className="featureRowSub">
                      {new Date(purchase.createdAt).toLocaleString("no-NO")}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>{fmtKr(purchase.total)}</div>
                    <div className="featureRowSub">{purchase.lines.length} linjer</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <span className={purchase.status === "betalt" ? "badge badgeSuccess" : "badge badgeDanger"}>
                    {purchase.status === "betalt" ? "Betalt" : "Ikke betalt"}
                  </span>

                  <span className="badge">
                    {purchase.updateCostMode === "last_price"
                      ? "Siste pris"
                      : "Ingen kost-endring"}
                  </span>
                </div>

                <div className="featureList">
                  {purchase.lines.map((line) => (
                    <div key={line.id} className="featureRow">
                      <div className="customerMain">
                        <div className="featureRowTitle">{line.itemName || "Uten varenavn"}</div>
                        <div className="featureRowSub">
                          {line.kind} • Antall: {line.qty}
                        </div>
                      </div>

                      <div className="featureRowRight">
                        <div>{fmtKr(line.lineTotal)}</div>
                        <div className="featureRowSub">Kost: {fmtKr(line.unitCost)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {purchase.note ? (
                  <div className="featureRowSub" style={{ marginTop: 12 }}>
                    Notat: {purchase.note}
                  </div>
                ) : null}

                <div className="cardActions">
                  <div className="muted">Ved sletting trekkes lager tilbake for varekjøp.</div>
                  <button className="btn btnDanger" type="button" onClick={() => handleDeletePurchase(purchase)}>
                    Slett innkjøp
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
