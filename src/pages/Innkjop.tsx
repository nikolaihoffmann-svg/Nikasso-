import { useMemo, useState } from "react";
import ItemPickerWithCreate from "../components/ItemPickerWithCreate";
import {
  addPaymentToPurchase,
  createEmptyPurchase,
  deletePurchase,
  fmtKr,
  getPurchases,
  makePurchaseLine,
  paymentMethodLabel,
  purchasePaidSum,
  purchaseRemaining,
  savePurchase,
} from "../app/storage";
import type {
  PaymentMethod,
  PurchaseDraft,
  PurchaseLine,
  PurchaseRecord,
} from "../types";

const QUICK_METHODS: PaymentMethod[] = [
  "vipps",
  "revolut",
  "kontant",
  "bytte",
  "bankoverforing",
];

type DraftLineInput = {
  qty: string;
  unitCost: string;
};

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

function createInitialPurchaseState(): {
  draft: PurchaseDraft;
  lineInputs: Record<string, DraftLineInput>;
} {
  const draft = createEmptyPurchase();
  const firstLine = draft.lines[0];

  return {
    draft,
    lineInputs: {
      [firstLine.id]: {
        qty: firstLine.qty ? formatInputNumber(firstLine.qty) || "1" : "1",
        unitCost: "",
      },
    },
  };
}

export default function Innkjop() {
  const initial = useMemo(() => createInitialPurchaseState(), []);
  const [draft, setDraft] = useState<PurchaseDraft>(initial.draft);
  const [lineInputs, setLineInputs] = useState<Record<string, DraftLineInput>>(initial.lineInputs);

  const [message, setMessage] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("vipps");
  const [manualMethodLabel, setManualMethodLabel] = useState("");

  const [laterPaymentAmount, setLaterPaymentAmount] = useState<Record<string, string>>({});
  const [laterPaymentNote, setLaterPaymentNote] = useState<Record<string, string>>({});
  const [laterPaymentMethod, setLaterPaymentMethod] = useState<Record<string, PaymentMethod>>({});
  const [laterManualMethodLabel, setLaterManualMethodLabel] = useState<Record<string, string>>({});

  function refreshMessage(text: string): void {
    setMessage(`${text} ${Date.now()}`);
  }

  function visibleMessage(text: string): string {
    return text.replace(/\s\d+$/, "");
  }

  function ensureLineInput(line: PurchaseLine): DraftLineInput {
    return (
      lineInputs[line.id] ?? {
        qty: formatInputNumber(line.qty) || "1",
        unitCost: formatInputNumber(line.unitCost),
      }
    );
  }

  function recalcLine(next: PurchaseLine): PurchaseLine {
    return {
      ...next,
      lineTotal: parseNoNumber(String(next.qty)) * parseNoNumber(String(next.unitCost)),
    };
  }

  function updateLine(lineId: string, patch: Partial<PurchaseLine>): void {
    setDraft((prev) => {
      const lines = prev.lines.map((line) => {
        if (line.id !== lineId) return line;
        return recalcLine({ ...line, ...patch });
      });

      return { ...prev, lines };
    });
  }

  function updateLineInput(
    lineId: string,
    key: keyof DraftLineInput,
    value: string,
    apply: (raw: string) => Partial<PurchaseLine>
  ): void {
    setLineInputs((prev) => ({
      ...prev,
      [lineId]: {
        qty: prev[lineId]?.qty ?? "",
        unitCost: prev[lineId]?.unitCost ?? "",
        [key]: value,
      },
    }));

    updateLine(lineId, apply(value));
  }

  function addLine(): void {
    const line = makePurchaseLine();

    setDraft((prev) => ({
      ...prev,
      lines: [...prev.lines, line],
    }));

    setLineInputs((prev) => ({
      ...prev,
      [line.id]: {
        qty: "1",
        unitCost: "",
      },
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

    setLineInputs((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  function resetDraft(): void {
    const next = createInitialPurchaseState();
    setDraft(next.draft);
    setLineInputs(next.lineInputs);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentMethod("vipps");
    setManualMethodLabel("");
  }

  const total = useMemo(() => {
    return draft.lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  }, [draft.lines]);

  function handleSave(): void {
    savePurchase(draft, {
      paymentAmount: parseNoNumber(paymentAmount),
      paymentNote,
      paymentMethod,
      paymentMethodLabel: paymentMethod === "annet" ? manualMethodLabel : undefined,
    });

    resetDraft();
    refreshMessage("Innkjøp lagret");
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
    refreshMessage("Innkjøp slettet");
  }

  function handleRegisterPayment(purchaseId: string): void {
    const amount = parseNoNumber(laterPaymentAmount[purchaseId] || "");
    if (amount <= 0) return;

    const method = laterPaymentMethod[purchaseId] ?? "vipps";

    addPaymentToPurchase(
      purchaseId,
      amount,
      laterPaymentNote[purchaseId] || "Registrert senere",
      method,
      method === "annet" ? laterManualMethodLabel[purchaseId] : undefined
    );

    setLaterPaymentAmount((prev) => ({ ...prev, [purchaseId]: "" }));
    setLaterPaymentNote((prev) => ({ ...prev, [purchaseId]: "" }));
    setLaterPaymentMethod((prev) => ({ ...prev, [purchaseId]: "vipps" }));
    setLaterManualMethodLabel((prev) => ({ ...prev, [purchaseId]: "" }));
    refreshMessage("Betaling registrert");
  }

  return (
    <div>
      <h1 className="pageTitle">Innkjøp</h1>
      <p className="pageLead">
        Siste pris er nå standard, siden du ikke vil blande gammel og ny varekost.
      </p>

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
          {draft.lines.map((line, index) => {
            const input = ensureLineInput(line);

            return (
              <div key={line.id} className="lineCard">
                <div className="rowBetween">
                  <div style={{ fontWeight: 800, fontSize: 22 }}>Linje {index + 1}</div>
                  {draft.lines.length > 1 ? (
                    <button
                      className="btn btnDanger"
                      type="button"
                      onClick={() => removeLine(line.id)}
                    >
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
                      const qty = parseNoNumber(input.qty || "1") || 1;
                      const unitCost = item?.costPrice ?? 0;

                      updateLine(line.id, {
                        itemId: item?.id,
                        itemName: item?.name ?? "",
                        unitCost,
                        qty,
                        lineTotal: qty * unitCost,
                      });

                      setLineInputs((prev) => ({
                        ...prev,
                        [line.id]: {
                          qty: prev[line.id]?.qty || "1",
                          unitCost: unitCost ? formatInputNumber(unitCost) : "",
                        },
                      }));
                    }}
                  />
                </label>

                <div className="grid2">
                  <label className="label">
                    <span>Antall</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={input.qty}
                      onChange={(e) =>
                        updateLineInput(line.id, "qty", e.target.value, (raw) => {
                          const qty = parseNoNumber(raw);
                          const unitCost = parseNoNumber(input.unitCost || "");

                          return {
                            qty,
                            lineTotal: qty * unitCost,
                          };
                        })
                      }
                      placeholder="F.eks. 3"
                    />
                  </label>

                  <label className="label">
                    <span>Kostpris</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={input.unitCost}
                      onChange={(e) =>
                        updateLineInput(line.id, "unitCost", e.target.value, (raw) => {
                          const unitCost = parseNoNumber(raw);
                          const qty = parseNoNumber(input.qty || "");

                          return {
                            unitCost,
                            lineTotal: qty * unitCost,
                          };
                        })
                      }
                      placeholder="F.eks. 133,33"
                    />
                  </label>
                </div>

                <span className="badge badgeBlue">Linjesum: {fmtKr(line.lineTotal)}</span>
              </div>
            );
          })}
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

        <div className="grid2" style={{ marginTop: 18 }}>
          <label className="label">
            <span>Betalt nå</span>
            <input
              type="text"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="F.eks. 500"
            />
          </label>

          <label className="label">
            <span>Betalingsnotat</span>
            <input
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Valgfritt notat..."
            />
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="muted" style={{ marginBottom: 8 }}>Hurtigvalg betalingsmåte</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {QUICK_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                className={paymentMethod === method ? "btn btnPrimary" : "btn"}
                onClick={() => setPaymentMethod(method)}
              >
                {paymentMethodLabel(method)}
              </button>
            ))}
            <button
              type="button"
              className={paymentMethod === "annet" ? "btn btnPrimary" : "btn"}
              onClick={() => setPaymentMethod("annet")}
            >
              Annet
            </button>
          </div>
        </div>

        {paymentMethod === "annet" ? (
          <label className="label" style={{ marginTop: 14 }}>
            <span>Manuell betalingsmåte</span>
            <input
              value={manualMethodLabel}
              onChange={(e) => setManualMethodLabel(e.target.value)}
              placeholder="F.eks. Stripe, PayPal..."
            />
          </label>
        ) : null}

        <div className="cardActions">
          <div className="muted">Ved varekjøp brukes nå siste innkjøpspris som ny kostpris.</div>
          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            Lagre innkjøp
          </button>
        </div>

        {message ? (
          <div style={{ marginTop: 12, color: "#86efac" }}>{visibleMessage(message)}</div>
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
            filteredPurchases.map((purchase) => {
              const remaining = purchaseRemaining(purchase);
              const paid = purchasePaidSum(purchase);

              return (
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
                      <div className="featureRowSub">
                        Betalt: {fmtKr(paid)} • Rest: {fmtKr(remaining)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <span
                      className={
                        remaining > 0 ? "badge badgeDanger" : "badge badgeSuccess"
                      }
                    >
                      {remaining > 0 ? "Ikke betalt" : "Betalt"}
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

                  {(purchase.payments ?? []).length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="featureRowSub" style={{ marginBottom: 8 }}>
                        Betalinger:
                      </div>

                      <div className="featureList">
                        {(purchase.payments ?? []).map((payment) => (
                          <div key={payment.id} className="featureRow">
                            <div className="customerMain">
                              <div className="featureRowTitle">
                                {paymentMethodLabel(payment.method, payment.methodLabel)}
                              </div>
                              <div className="featureRowSub">
                                {new Date(payment.createdAt).toLocaleString("no-NO")}
                                {payment.note ? ` • ${payment.note}` : ""}
                              </div>
                            </div>

                            <div className="featureRowRight">{fmtKr(payment.amount)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {remaining > 0 ? (
                    <>
                      <div className="grid2" style={{ marginTop: 12 }}>
                        <label className="label">
                          <span>Registrer betaling</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={laterPaymentAmount[purchase.id] ?? ""}
                            onChange={(e) =>
                              setLaterPaymentAmount((prev) => ({
                                ...prev,
                                [purchase.id]: e.target.value,
                              }))
                            }
                            placeholder="Beløp"
                          />
                        </label>

                        <label className="label">
                          <span>Betalingsnotat</span>
                          <input
                            value={laterPaymentNote[purchase.id] ?? ""}
                            onChange={(e) =>
                              setLaterPaymentNote((prev) => ({
                                ...prev,
                                [purchase.id]: e.target.value,
                              }))
                            }
                            placeholder="Valgfritt notat..."
                          />
                        </label>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <div className="muted" style={{ marginBottom: 8 }}>Betalingsmåte</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {QUICK_METHODS.map((method) => (
                            <button
                              key={method}
                              type="button"
                              className={
                                (laterPaymentMethod[purchase.id] ?? "vipps") === method
                                  ? "btn btnPrimary"
                                  : "btn"
                              }
                              onClick={() =>
                                setLaterPaymentMethod((prev) => ({
                                  ...prev,
                                  [purchase.id]: method,
                                }))
                              }
                            >
                              {paymentMethodLabel(method)}
                            </button>
                          ))}

                          <button
                            type="button"
                            className={
                              (laterPaymentMethod[purchase.id] ?? "vipps") === "annet"
                                ? "btn btnPrimary"
                                : "btn"
                            }
                            onClick={() =>
                              setLaterPaymentMethod((prev) => ({
                                ...prev,
                                [purchase.id]: "annet",
                              }))
                            }
                          >
                            Annet
                          </button>
                        </div>
                      </div>

                      {(laterPaymentMethod[purchase.id] ?? "vipps") === "annet" ? (
                        <label className="label" style={{ marginTop: 12 }}>
                          <span>Manuell betalingsmåte</span>
                          <input
                            value={laterManualMethodLabel[purchase.id] ?? ""}
                            onChange={(e) =>
                              setLaterManualMethodLabel((prev) => ({
                                ...prev,
                                [purchase.id]: e.target.value,
                              }))
                            }
                            placeholder="F.eks. Stripe, PayPal..."
                          />
                        </label>
                      ) : null}

                      <div className="cardActions">
                        <div className="muted">Bruk dette når innkjøpet blir betalt senere.</div>
                        <button
                          className="btn btnSuccess"
                          type="button"
                          onClick={() => handleRegisterPayment(purchase.id)}
                        >
                          Registrer betaling
                        </button>
                      </div>
                    </>
                  ) : null}

                  <div className="cardActions">
                    <div className="muted">Ved sletting trekkes lager tilbake for varekjøp.</div>
                    <button
                      className="btn btnDanger"
                      type="button"
                      onClick={() => handleDeletePurchase(purchase)}
                    >
                      Slett innkjøp
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
