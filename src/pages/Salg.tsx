import { useMemo, useState } from "react";
import CustomerPickerWithCreate from "../components/CustomerPickerWithCreate";
import ItemPickerWithCreate from "../components/ItemPickerWithCreate";
import {
  addPaymentToSale,
  createEmptySale,
  deleteSale,
  fmtKr,
  getSales,
  makeSaleLine,
  paymentMethodLabel,
  saveSale,
  salePaidSum,
  saleRemaining,
  updateSaleMeta,
} from "../app/storage";
import type { PaymentMethod, SaleDraft, SaleLine, SaleRecord } from "../types";

const QUICK_METHODS: PaymentMethod[] = [
  "vipps",
  "revolut",
  "kontant",
  "bytte",
  "bankoverforing",
];

export default function Salg() {
  const [draft, setDraft] = useState<SaleDraft>(createEmptySale());
  const [message, setMessage] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("vipps");
  const [manualMethodLabel, setManualMethodLabel] = useState("");

  const [historyQuery, setHistoryQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string>("");
  const [editId, setEditId] = useState<string>("");
  const [editCustomerId, setEditCustomerId] = useState<string | undefined>(undefined);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [laterPaymentAmount, setLaterPaymentAmount] = useState<Record<string, string>>({});
  const [laterPaymentNote, setLaterPaymentNote] = useState<Record<string, string>>({});
  const [laterPaymentMethod, setLaterPaymentMethod] = useState<Record<string, PaymentMethod>>({});
  const [laterManualMethodLabel, setLaterManualMethodLabel] = useState<Record<string, string>>({});

  function refreshMessage(text: string): void {
    setMessage(`${text} ${Date.now()}`);
  }

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

  const estimatedProfit = useMemo(() => {
    return draft.lines.reduce((sum, line) => {
      return sum + (Number(line.unitPrice || 0) - Number(line.unitCost || 0)) * Number(line.qty || 0);
    }, 0);
  }, [draft.lines]);

  function handleSave(): void {
    saveSale(draft, {
      paymentAmount: Number(paymentAmount || 0),
      paymentNote,
      paymentMethod,
      paymentMethodLabel: paymentMethod === "annet" ? manualMethodLabel : undefined,
    });

    setMessage("Salg lagret");
    setDraft(createEmptySale());
    setPaymentAmount("0");
    setPaymentNote("");
    setPaymentMethod("vipps");
    setManualMethodLabel("");
  }

  const sales = useMemo(() => getSales(), [message]);

  const filteredSales = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return sales;

    return sales.filter((sale) => {
      const customerHit = (sale.customerName || "").toLowerCase().includes(q);
      const noteHit = (sale.note || "").toLowerCase().includes(q);
      const lineHit = sale.lines.some((line) =>
        (line.itemName || "").toLowerCase().includes(q)
      );
      return customerHit || noteHit || lineHit;
    });
  }, [sales, historyQuery]);

  function startEdit(sale: SaleRecord): void {
    setEditId(sale.id);
    setEditCustomerId(sale.customerId);
    setEditCustomerName(sale.customerName || "");
    setEditNote(sale.note || "");
  }

  function saveEdit(): void {
    if (!editId) return;
    updateSaleMeta(editId, {
      customerId: editCustomerId,
      customerName: editCustomerName,
      note: editNote,
    });
    setEditId("");
    refreshMessage("Salg oppdatert");
  }

  function handleDeleteSale(sale: SaleRecord): void {
    if (!confirm(`Slette salget til ${sale.customerName || "Kontantsalg"}?`)) return;
    deleteSale(sale.id);
    if (expandedId === sale.id) setExpandedId("");
    if (editId === sale.id) setEditId("");
    refreshMessage("Salg slettet");
  }

  function handleRegisterPayment(saleId: string): void {
    const amount = Number(laterPaymentAmount[saleId] || 0);
    if (amount <= 0) return;

    const method = laterPaymentMethod[saleId] ?? "vipps";

    addPaymentToSale(
      saleId,
      amount,
      laterPaymentNote[saleId] || "Registrert senere",
      method,
      method === "annet" ? laterManualMethodLabel[saleId] : undefined
    );

    setLaterPaymentAmount((prev) => ({ ...prev, [saleId]: "" }));
    setLaterPaymentNote((prev) => ({ ...prev, [saleId]: "" }));
    setLaterPaymentMethod((prev) => ({ ...prev, [saleId]: "vipps" }));
    setLaterManualMethodLabel((prev) => ({ ...prev, [saleId]: "" }));
    refreshMessage("Betaling registrert");
  }

  const openSalesCount = filteredSales.filter((sale) => saleRemaining(sale) > 0).length;
  const totalOpen = filteredSales.reduce((sum, sale) => sum + saleRemaining(sale), 0);

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
              <div className="rowBetween">
                <div style={{ fontWeight: 800, fontSize: 22 }}>Linje {index + 1}</div>
                {draft.lines.length > 1 ? (
                  <button className="btn btnDanger" type="button" onClick={() => removeLine(line.id)}>
                    Fjern linje
                  </button>
                ) : null}
              </div>

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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="rowBetween" style={{ marginBottom: 14 }}>
          <h2 className="sectionTitle" style={{ marginBottom: 0 }}>Salgshistorikk</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge">{filteredSales.length} salg</span>
            <span className="badge badgeDebt">{fmtKr(totalOpen)} utestående</span>
            <span className="badge">{openSalesCount} åpne</span>
          </div>
        </div>

        <label className="label" style={{ marginBottom: 14 }}>
          <span>Søk i salg</span>
          <input
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
            placeholder="Søk kunde, vare eller notat..."
          />
        </label>

        <div className="featureList">
          {filteredSales.length === 0 ? (
            <div className="emptyText">Ingen salg funnet.</div>
          ) : (
            filteredSales.map((sale) => {
              const isExpanded = expandedId === sale.id;
              const isEditing = editId === sale.id;
              const remaining = saleRemaining(sale);

              return (
                <div key={sale.id} className="card">
                  <div className="rowBetween" style={{ marginBottom: 12 }}>
                    <div className="customerMain">
                      <div className="featureRowTitle">{sale.customerName || "Kontantsalg"}</div>
                      <div className="featureRowSub">
                        {new Date(sale.createdAt).toLocaleString("no-NO")}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800 }}>{fmtKr(sale.total)}</div>
                      <div className="featureRowSub">
                        Betalt: {fmtKr(salePaidSum(sale))} • Rest: {fmtKr(remaining)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <span className={remaining > 0 ? "badge badgeDebt" : "badge badgeSuccess"}>
                      {remaining > 0 ? "Utestående" : "Ferdig betalt"}
                    </span>
                    <span className="badge">{sale.lines.length} linjer</span>
                  </div>

                  <div className="cardActions" style={{ marginTop: 0 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? "" : sale.id)}
                      >
                        {isExpanded ? "Skjul detaljer" : "Vis detaljer"}
                      </button>

                      <button className="btn" type="button" onClick={() => startEdit(sale)}>
                        Rediger meta
                      </button>
                    </div>

                    <button className="btn btnDanger" type="button" onClick={() => handleDeleteSale(sale)}>
                      Slett salg
                    </button>
                  </div>

                  {isEditing ? (
                    <div className="card" style={{ marginTop: 12 }}>
                      <div className="grid2">
                        <label className="label">
                          <span>Kunde</span>
                          <CustomerPickerWithCreate
                            value={editCustomerId}
                            onChange={(customer) => {
                              setEditCustomerId(customer?.id);
                              setEditCustomerName(customer?.name ?? "");
                            }}
                          />
                        </label>

                        <label className="label">
                          <span>Notat</span>
                          <input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                        </label>
                      </div>

                      <div className="cardActions">
                        <button className="btn" type="button" onClick={() => setEditId("")}>
                          Avbryt
                        </button>
                        <button className="btn btnPrimary" type="button" onClick={saveEdit}>
                          Lagre endringer
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isExpanded ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="featureList">
                        {sale.lines.map((line) => (
                          <div key={line.id} className="featureRow">
                            <div className="customerMain">
                              <div className="featureRowTitle">{line.itemName || "Uten varenavn"}</div>
                              <div className="featureRowSub">
                                Antall: {line.qty} • Pris: {fmtKr(line.unitPrice)}
                              </div>
                            </div>

                            <div className="featureRowRight">
                              <div>{fmtKr(line.lineTotal)}</div>
                              <div className="featureRowSub">
                                Kost: {fmtKr(Number(line.unitCost || 0))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {sale.note ? (
                        <div className="featureRowSub" style={{ marginTop: 12 }}>
                          Notat: {sale.note}
                        </div>
                      ) : null}

                      <div style={{ marginTop: 12 }}>
                        <div className="featureRowSub" style={{ marginBottom: 8 }}>
                          Betalinger:
                        </div>

                        <div className="featureList">
                          {sale.payments.length === 0 ? (
                            <div className="emptyText">Ingen betalinger registrert enda.</div>
                          ) : (
                            sale.payments.map((payment) => (
                              <div key={payment.id} className="featureRow">
                                <div className="customerMain">
                                  <div className="featureRowTitle">{paymentMethodLabel(payment.method, payment.methodLabel)}</div>
                                  <div className="featureRowSub">
                                    {new Date(payment.createdAt).toLocaleString("no-NO")}
                                    {payment.note ? ` • ${payment.note}` : ""}
                                  </div>
                                </div>

                                <div className="featureRowRight">{fmtKr(payment.amount)}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="grid2" style={{ marginTop: 12 }}>
                        <label className="label">
                          <span>Registrer betaling senere</span>
                          <input
                            type="number"
                            value={laterPaymentAmount[sale.id] ?? ""}
                            onChange={(e) =>
                              setLaterPaymentAmount((prev) => ({ ...prev, [sale.id]: e.target.value }))
                            }
                            placeholder="Beløp"
                          />
                        </label>

                        <label className="label">
                          <span>Betalingsnotat</span>
                          <input
                            value={laterPaymentNote[sale.id] ?? ""}
                            onChange={(e) =>
                              setLaterPaymentNote((prev) => ({ ...prev, [sale.id]: e.target.value }))
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
                              className={(laterPaymentMethod[sale.id] ?? "vipps") === method ? "btn btnPrimary" : "btn"}
                              onClick={() =>
                                setLaterPaymentMethod((prev) => ({ ...prev, [sale.id]: method }))
                              }
                            >
                              {paymentMethodLabel(method)}
                            </button>
                          ))}

                          <button
                            type="button"
                            className={(laterPaymentMethod[sale.id] ?? "vipps") === "annet" ? "btn btnPrimary" : "btn"}
                            onClick={() =>
                              setLaterPaymentMethod((prev) => ({ ...prev, [sale.id]: "annet" }))
                            }
                          >
                            Annet
                          </button>
                        </div>
                      </div>

                      {(laterPaymentMethod[sale.id] ?? "vipps") === "annet" ? (
                        <label className="label" style={{ marginTop: 12 }}>
                          <span>Manuell betalingsmåte</span>
                          <input
                            value={laterManualMethodLabel[sale.id] ?? ""}
                            onChange={(e) =>
                              setLaterManualMethodLabel((prev) => ({ ...prev, [sale.id]: e.target.value }))
                            }
                            placeholder="F.eks. Stripe, PayPal..."
                          />
                        </label>
                      ) : null}

                      <div className="cardActions">
                        <div className="muted">Bruk dette kun for restbetaling etter salget.</div>
                        <button
                          className="btn btnSuccess"
                          type="button"
                          onClick={() => handleRegisterPayment(sale.id)}
                        >
                          Registrer betaling
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
