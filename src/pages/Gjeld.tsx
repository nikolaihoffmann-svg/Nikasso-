import { useEffect, useMemo, useState } from "react";
import CustomerPickerWithCreate from "../components/CustomerPickerWithCreate";
import {
  addPaymentToDebt,
  createEmptyDebt,
  debtPaidSum,
  debtRemaining,
  deleteDebt,
  fmtKr,
  getDebts,
  paymentMethodLabel,
  saveDebt,
  updateDebt,
} from "../app/storage";
import type { DebtDraft, DebtRecord, PaymentMethod } from "../types";

const QUICK_METHODS: PaymentMethod[] = [
  "vipps",
  "revolut",
  "kontant",
  "bytte",
  "bankoverforing",
];

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

function createInitialDebtState(): DebtDraft {
  return createEmptyDebt();
}

export default function Gjeld() {
  const [draft, setDraft] = useState<DebtDraft>(() => createInitialDebtState());
  const [message, setMessage] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("vipps");
  const [manualMethodLabel, setManualMethodLabel] = useState("");

  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCustomerId, setEditCustomerId] = useState<string | undefined>(undefined);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editNote, setEditNote] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<Record<string, PaymentMethod>>({});
  const [manualLabels, setManualLabels] = useState<Record<string, string>>({});

  function visibleMessage(text: string): string {
    return text.replace(/\s\d+$/, "");
  }

  function refresh(text?: string): void {
    setDebts(getDebts());
    if (text) setMessage(`${text} ${Date.now()}`);
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetDraft(): void {
    setDraft(createInitialDebtState());
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentMethod("vipps");
    setManualMethodLabel("");
  }

  function handleSaveDebt(): void {
    saveDebt(draft, {
      paymentAmount: parseNoNumber(paymentAmount),
      paymentNote,
      paymentMethod,
      paymentMethodLabel: paymentMethod === "annet" ? manualMethodLabel : undefined,
    });

    resetDraft();
    refresh("Gjeld lagret");
  }

  const filteredDebts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return debts;

    return debts.filter((debt) => {
      const customerHit = (debt.customerName || "").toLowerCase().includes(q);
      const titleHit = (debt.title || "").toLowerCase().includes(q);
      const noteHit = (debt.note || "").toLowerCase().includes(q);
      return customerHit || titleHit || noteHit;
    });
  }, [debts, query]);

  const totalOpen = filteredDebts.reduce((sum, debt) => sum + debtRemaining(debt), 0);
  const totalCount = filteredDebts.filter((debt) => debtRemaining(debt) > 0).length;
  const biggestOpen = filteredDebts.reduce((max, debt) => Math.max(max, debtRemaining(debt)), 0);

  function handlePay(debtId: string): void {
    const amount = parseNoNumber(amounts[debtId] || "");
    if (amount <= 0) return;

    const method = methods[debtId] ?? "vipps";

    addPaymentToDebt(
      debtId,
      amount,
      notes[debtId] || "Registrert betaling",
      method,
      method === "annet" ? manualLabels[debtId] : undefined
    );

    setAmounts((prev) => ({ ...prev, [debtId]: "" }));
    setNotes((prev) => ({ ...prev, [debtId]: "" }));
    setMethods((prev) => ({ ...prev, [debtId]: "vipps" }));
    setManualLabels((prev) => ({ ...prev, [debtId]: "" }));
    refresh("Betaling registrert");
  }

  function startEdit(debt: DebtRecord): void {
    setEditId(debt.id);
    setEditTitle(debt.title);
    setEditCustomerId(debt.customerId);
    setEditCustomerName(debt.customerName || "");
    setEditTotal(formatInputNumber(debt.total));
    setEditNote(debt.note || "");
  }

  function saveEdit(): void {
    if (!editId) return;

    updateDebt(editId, {
      title: editTitle,
      customerId: editCustomerId,
      customerName: editCustomerName,
      total: parseNoNumber(editTotal),
      note: editNote,
    });

    setEditId("");
    refresh("Gjeld oppdatert");
  }

  function handleDelete(debt: DebtRecord): void {
    if (!confirm(`Slette gjeldsposten "${debt.title}"?`)) return;

    deleteDebt(debt.id);

    if (expandedId === debt.id) setExpandedId("");
    if (editId === debt.id) setEditId("");

    refresh("Gjeld slettet");
  }

  return (
    <div>
      <h1 className="pageTitle">Gjeld</h1>
      <p className="pageLead">
        Egen gjeld og lån til gode. Dette er fraskilt fra utestående salg.
      </p>

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
            <span>Tittel</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="F.eks. lån, forskudd, privat utlegg"
            />
          </label>

          <label className="label">
            <span>Beløp</span>
            <input
              type="text"
              inputMode="decimal"
              value={formatInputNumber(draft.total)}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, total: parseNoNumber(e.target.value) }))
              }
              placeholder="F.eks. 2500"
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
          <div className="saleSummary">
            <div className="muted">Totalt gjeldsbeløp</div>
            <div className="saleSummaryValue">{fmtKr(draft.total)}</div>
          </div>

          <button className="btn btnPrimary" type="button" onClick={handleSaveDebt}>
            Lagre gjeld
          </button>
        </div>

        {message ? (
          <div style={{ marginTop: 12, color: "#86efac" }}>{visibleMessage(message)}</div>
        ) : null}
      </div>

      <div className="grid3" style={{ marginTop: 16 }}>
        <div className="statCard">
          <div className="statLabel">Totalt gjeld til gode</div>
          <div className="statValue">{fmtKr(totalOpen)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Åpne gjeldsposter</div>
          <div className="statValue">{totalCount}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Største åpne post</div>
          <div className="statValue">{fmtKr(biggestOpen)}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <label className="label">
          <span>Søk i gjeld</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk kunde, tittel eller notat..."
          />
        </label>
      </div>

      <div className="receivableList" style={{ marginTop: 16 }}>
        {filteredDebts.length === 0 ? (
          <div className="card emptyText">Ingen gjeldsposter.</div>
        ) : (
          filteredDebts.map((debt) => {
            const isExpanded = expandedId === debt.id;
            const isEditing = editId === debt.id;
            const remaining = debtRemaining(debt);

            return (
              <div key={debt.id} className="card">
                <div className="rowBetween" style={{ marginBottom: 14 }}>
                  <div className="customerMain">
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{debt.title}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {debt.customerName || "Uten kunde"} •{" "}
                      {new Date(debt.createdAt).toLocaleString("no-NO")}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{fmtKr(remaining)}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      Total: {fmtKr(debt.total)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <span className={remaining > 0 ? "badge badgeDebt" : "badge badgeSuccess"}>
                    {remaining > 0 ? "Åpen gjeld" : "Ferdig betalt"}
                  </span>
                  <span className="badge">Betalt: {fmtKr(debtPaidSum(debt))}</span>
                </div>

                <div className="cardActions" style={{ marginTop: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? "" : debt.id)}
                    >
                      {isExpanded ? "Skjul detaljer" : "Vis detaljer"}
                    </button>
                    <button className="btn" type="button" onClick={() => startEdit(debt)}>
                      Rediger gjeld
                    </button>
                  </div>

                  <button className="btn btnDanger" type="button" onClick={() => handleDelete(debt)}>
                    Slett gjeld
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
                        <span>Tittel</span>
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      </label>

                      <label className="label">
                        <span>Beløp</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editTotal}
                          onChange={(e) => setEditTotal(e.target.value)}
                          placeholder="F.eks. 2500"
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
                    {debt.note ? (
                      <div className="featureRowSub" style={{ marginBottom: 12 }}>
                        Notat: {debt.note}
                      </div>
                    ) : null}

                    <div style={{ marginBottom: 12 }}>
                      <div className="featureRowSub" style={{ marginBottom: 8 }}>
                        Betalinger:
                      </div>

                      <div className="featureList">
                        {debt.payments.length === 0 ? (
                          <div className="emptyText">Ingen betalinger registrert enda.</div>
                        ) : (
                          debt.payments.map((payment) => (
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
                          ))
                        )}
                      </div>
                    </div>

                    <div className="grid2">
                      <label className="label">
                        <span>Registrer betaling</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={amounts[debt.id] ?? ""}
                          onChange={(e) =>
                            setAmounts((prev) => ({ ...prev, [debt.id]: e.target.value }))
                          }
                          placeholder="Beløp"
                        />
                      </label>

                      <label className="label">
                        <span>Betalingsnotat</span>
                        <input
                          value={notes[debt.id] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [debt.id]: e.target.value }))
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
                              (methods[debt.id] ?? "vipps") === method ? "btn btnPrimary" : "btn"
                            }
                            onClick={() =>
                              setMethods((prev) => ({ ...prev, [debt.id]: method }))
                            }
                          >
                            {paymentMethodLabel(method)}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={
                            (methods[debt.id] ?? "vipps") === "annet"
                              ? "btn btnPrimary"
                              : "btn"
                          }
                          onClick={() =>
                            setMethods((prev) => ({ ...prev, [debt.id]: "annet" }))
                          }
                        >
                          Annet
                        </button>
                      </div>
                    </div>

                    {(methods[debt.id] ?? "vipps") === "annet" ? (
                      <label className="label" style={{ marginTop: 12 }}>
                        <span>Manuell betalingsmåte</span>
                        <input
                          value={manualLabels[debt.id] ?? ""}
                          onChange={(e) =>
                            setManualLabels((prev) => ({ ...prev, [debt.id]: e.target.value }))
                          }
                          placeholder="F.eks. Stripe, PayPal..."
                        />
                      </label>
                    ) : null}

                    <div className="cardActions">
                      <div className="muted">Bruk dette for avdrag eller full nedbetaling.</div>
                      <button className="btn btnSuccess" type="button" onClick={() => handlePay(debt.id)}>
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
  );
}
