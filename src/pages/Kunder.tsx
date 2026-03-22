// src/pages/Kunder.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Customer,
  Sale,
  addSalePayment,
  fmtKr,
  salePaidSum,
  saleRemaining,
  setSaleDraftCustomer,
  uid,
  useCustomers,
  useSales,
} from "../app/storage";

/* =========================
   Small helpers
========================= */

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

function normalizeName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function shortMeta(c: Customer) {
  const bits: string[] = [];
  if (c.phone) bits.push(`Tlf: ${c.phone}`);
  if (c.address) bits.push(`Adr: ${c.address}`);
  if (c.note) bits.push(`Notat: ${c.note}`);
  return bits.join(" • ");
}

function isTruthyString(x: any): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

/* =========================
   Page
========================= */

export function Kunder() {
  const { customers, upsert, remove, setAll } = useCustomers();
  const { sales } = useSales();

  // Search-first
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Modes / modals
  const [newOpen, setNewOpen] = useState(false);
  const [sel, setSel] = useState<Customer | null>(null);

  // Filter modes
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);

  // Paging
  const [showCount, setShowCount] = useState(6); // results at a time (search/outstanding)
  const PAGE_SIZE = 6;

  // --- outstanding per customer
  const outstandingByCustomerId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      if (!isTruthyString(s.customerId)) continue;
      const rem = Math.max(0, saleRemaining(s));
      if (rem <= 0) continue;
      map.set(s.customerId, (map.get(s.customerId) ?? 0) + rem);
    }
    for (const [k, v] of map) map.set(k, Math.round(v * 100) / 100);
    return map;
  }, [sales]);

  // --- “last used” based on latest sale date per customer
  const lastUsedAtByCustomerId = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sales) {
      if (!isTruthyString(s.customerId)) continue;
      const prev = m.get(s.customerId);
      if (!prev || String(s.createdAt || "") > prev) m.set(s.customerId, String(s.createdAt || ""));
    }
    return m;
  }, [sales]);

  const customersSortedByName = useMemo(() => {
    const copy = [...customers];
    copy.sort((a, b) => (a.name || "").localeCompare(b.name || "", "nb-NO", { sensitivity: "base" }));
    return copy;
  }, [customers]);

  const customersById = useMemo(() => {
    const m = new Map<string, Customer>();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);

  const recentCustomers = useMemo(() => {
    const arr: Array<{ c: Customer; last: string }> = [];
    for (const c of customers) {
      const last = lastUsedAtByCustomerId.get(c.id);
      if (last) arr.push({ c, last });
    }
    arr.sort((a, b) => (b.last || "").localeCompare(a.last || ""));
    // fallback: if no sales yet, show last updated/created
    if (arr.length === 0) {
      const fallback = [...customers];
      fallback.sort((a, b) => (String(b.updatedAt || b.createdAt || "")).localeCompare(String(a.updatedAt || a.createdAt || "")));
      return fallback.slice(0, 5);
    }
    return arr.slice(0, 5).map((x) => x.c);
  }, [customers, lastUsedAtByCustomerId]);

  const outstandingCustomersSorted = useMemo(() => {
    const list: Array<{ c: Customer; out: number }> = [];
    for (const [id, out] of outstandingByCustomerId.entries()) {
      const c = customersById.get(id);
      if (!c) continue;
      if (out > 0) list.push({ c, out });
    }
    list.sort((a, b) => b.out - a.out || (a.c.name || "").localeCompare(b.c.name || "", "nb-NO", { sensitivity: "base" }));
    return list;
  }, [outstandingByCustomerId, customersById]);

  const searchResults = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return customersSortedByName.filter((c) => {
      const hay = `${c.name} ${c.phone ?? ""} ${c.address ?? ""} ${c.note ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [q, customersSortedByName]);

  // Reset paging when mode changes
  useEffect(() => {
    setShowCount(6);
  }, [q, onlyOutstanding]);

  // UX: when toggling “only outstanding”, clear search (optional but makes it feel clean)
  function toggleOutstanding() {
    setOnlyOutstanding((v) => {
      const next = !v;
      if (next) setQ("");
      return next;
    });
  }

  function startSaleForCustomer(c: Customer) {
    setSaleDraftCustomer(c.id);
    alert(`Klar! Gå til "Salg" fanen – kunden "${c.name}" er forhåndsvalgt.`);
  }

  function exportJson() {
    const payload = { version: 1, exportedAt: new Date().toISOString(), customers };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kunder-export-${new Date().toISOString().slice(0, 10)}.json`;
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
        const next: Customer[] = Array.isArray(parsed?.customers) ? parsed.customers : Array.isArray(parsed) ? parsed : [];

        const normalized = next
          .map((x: any) => ({
            id: String(x.id ?? uid("cust")),
            name: normalizeName(String(x.name ?? "")),
            phone: x.phone ? String(x.phone).trim() : undefined,
            address: x.address ? String(x.address).trim() : undefined,
            note: x.note ? String(x.note).trim() : undefined,
            createdAt: String(x.createdAt ?? new Date().toISOString()),
            updatedAt: String(x.updatedAt ?? new Date().toISOString()),
          }))
          .filter((x) => x.name.length > 0);

        setAll(normalized);
      } catch {
        alert("Kunne ikke importere filen (ugyldig JSON).");
      }
    };
    input.click();
  }

  // Decide what to show under the search bar
  const mode: "search" | "outstanding" | "recent" = useMemo(() => {
    if (onlyOutstanding) return "outstanding";
    if (q.trim()) return "search";
    return "recent";
  }, [q, onlyOutstanding]);

  const visibleSearch = useMemo(() => searchResults.slice(0, showCount), [searchResults, showCount]);
  const visibleOutstanding = useMemo(() => outstandingCustomersSorted.slice(0, showCount), [outstandingCustomersSorted, showCount]);

  return (
    <div className="card">
      <div className="cardTitle">Kunder</div>
      <div className="cardSub">
        Søk først. Åpne kunde for handlinger. • Antall: <b>{customers.length}</b>
      </div>

      {/* Top actions */}
      <div className="btnRow" style={{ marginTop: 10 }}>
        <button className="btn btnPrimary" type="button" onClick={() => setNewOpen(true)}>
          + Ny kunde
        </button>

        <button className={`btn ${onlyOutstanding ? "btnPrimary" : ""}`} type="button" onClick={toggleOutstanding}>
          {onlyOutstanding ? "Vis alle" : "Utestående"}
        </button>

        <button className="btn" type="button" onClick={exportJson}>
          Eksporter
        </button>
        <button className="btn" type="button" onClick={importJson}>
          Importer
        </button>
      </div>

      {/* Search */}
      <div style={{ marginTop: 12 }}>
        <input
          ref={searchRef}
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={onlyOutstanding ? "Søk i utestående..." : "Søk i kunder..."}
        />
      </div>

      {/* Content */}
      {mode === "recent" ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="cardTitle" style={{ fontSize: 18 }}>
            Sist brukt
          </div>
          <div className="cardSub" style={{ marginBottom: 0 }}>
            Trykk en kunde for detaljer / nytt salg.
          </div>

          <div className="list" style={{ marginTop: 10 }}>
            {recentCustomers.length === 0 ? (
              <div className="item">Ingen kunder enda. Trykk “+ Ny kunde”.</div>
            ) : (
              recentCustomers.map((c) => {
                const out = outstandingByCustomerId.get(c.id) ?? 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={out > 0 ? "item low" : "item"}
                    style={{ textAlign: "left", cursor: "pointer" }}
                    onClick={() => setSel(c)}
                  >
                    <div className="itemTop">
                      <div>
                        <p className="itemTitle" style={{ marginBottom: 2 }}>
                          {c.name}
                        </p>
                        <div className="itemMeta">
                          {out > 0 ? (
                            <>
                              Utestående: <b>{fmtKr(out)}</b>
                            </>
                          ) : (
                            <span style={{ opacity: 0.85 }}>Ingen utestående</span>
                          )}
                          {shortMeta(c) ? <> • {shortMeta(c)}</> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {mode === "search" ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="cardTitle" style={{ fontSize: 18 }}>
            Treff
          </div>
          <div className="cardSub" style={{ marginBottom: 0 }}>
            Viser <b>{Math.min(showCount, searchResults.length)}</b> av <b>{searchResults.length}</b>
          </div>

          <div className="list" style={{ marginTop: 10 }}>
            {visibleSearch.length === 0 ? (
              <div className="item">Ingen treff.</div>
            ) : (
              visibleSearch.map((c) => {
                const out = outstandingByCustomerId.get(c.id) ?? 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={out > 0 ? "item low" : "item"}
                    style={{ textAlign: "left", cursor: "pointer" }}
                    onClick={() => setSel(c)}
                  >
                    <div className="itemTop">
                      <div>
                        <p className="itemTitle" style={{ marginBottom: 2 }}>
                          {c.name}
                        </p>
                        <div className="itemMeta">
                          {out > 0 ? (
                            <>
                              Utestående: <b>{fmtKr(out)}</b>
                            </>
                          ) : (
                            <span style={{ opacity: 0.85 }}>Ingen utestående</span>
                          )}
                          {shortMeta(c) ? <> • {shortMeta(c)}</> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {searchResults.length > visibleSearch.length ? (
            <div className="btnRow" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => setShowCount((n) => n + PAGE_SIZE)}>
                Vis {PAGE_SIZE} til
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "outstanding" ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="cardTitle" style={{ fontSize: 18 }}>
            Utestående
          </div>
          <div className="cardSub" style={{ marginBottom: 0 }}>
            Kun kunder med utestående. Sortert etter høyest beløp.
          </div>

          <div className="list" style={{ marginTop: 10 }}>
            {visibleOutstanding.length === 0 ? (
              <div className="item">Ingen utestående akkurat nå 🎉</div>
            ) : (
              visibleOutstanding.map(({ c, out }) => (
                <button
                  key={c.id}
                  type="button"
                  className="item low"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => setSel(c)}
                >
                  <div className="itemTop">
                    <div>
                      <p className="itemTitle" style={{ marginBottom: 2 }}>
                        {c.name}
                      </p>
                      <div className="itemMeta">
                        Utestående: <b>{fmtKr(out)}</b>
                        {shortMeta(c) ? <> • {shortMeta(c)}</> : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {outstandingCustomersSorted.length > visibleOutstanding.length ? (
            <div className="btnRow" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => setShowCount((n) => n + PAGE_SIZE)}>
                Vis {PAGE_SIZE} til
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* New customer modal */}
      <Modal open={newOpen} title="Ny kunde" onClose={() => setNewOpen(false)}>
        <CustomerUpsertForm
          mode="new"
          initial={{ name: "", phone: "", address: "", note: "" }}
          onSave={(draft) => {
            const n = normalizeName(draft.name);
            if (!n) return alert("Kundenavn kan ikke være tomt.");

            const exists = customers.some((c) => normalizeName(c.name).toLowerCase() === n.toLowerCase());
            if (exists) {
              if (!confirm(`"${n}" finnes allerede. Legge til likevel?`)) return;
            }

            upsert({
              id: uid("cust"),
              name: n,
              phone: draft.phone.trim() || undefined,
              address: draft.address.trim() || undefined,
              note: draft.note.trim() || undefined,
            });

            setNewOpen(false);
            // nice flow: focus search after closing
            setTimeout(() => searchRef.current?.focus(), 100);
          }}
        />
      </Modal>

      {/* Customer details modal */}
      <Modal open={!!sel} title={sel ? sel.name : "Kunde"} onClose={() => setSel(null)}>
        {sel ? (
          <CustomerQuickPanel
            customer={sel}
            sales={sales}
            outstanding={(outstandingByCustomerId.get(sel.id) ?? 0) as number}
            onStartSale={() => startSaleForCustomer(sel)}
            onDelete={() => {
              if (confirm(`Slette "${sel.name}"?`)) {
                remove(sel.id);
                setSel(null);
              }
            }}
            onUpdate={(next) => {
              upsert(next);
              // keep modal open but update local selected customer object for immediate UI consistency
              const updated: Customer = {
                ...sel,
                ...next,
                updatedAt: new Date().toISOString(),
              };
              setSel(updated);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

/* =========================
   Reusable: upsert form
========================= */

function CustomerUpsertForm(props: {
  mode: "new" | "edit";
  initial: { name: string; phone: string; address: string; note: string };
  onSave: (draft: { name: string; phone: string; address: string; note: string }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(props.initial.name);
  const [phone, setPhone] = useState(props.initial.phone);
  const [address, setAddress] = useState(props.initial.address);
  const [note, setNote] = useState(props.initial.note);

  return (
    <div className="fieldGrid" style={{ marginTop: 0 }}>
      <div>
        <label className="label">Navn</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn (f.eks. Ola Nordmann)" />
      </div>

      <div className="row3">
        <div>
          <label className="label">Telefon</label>
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Valgfritt" />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Valgfritt" />
        </div>
        <div>
          <label className="label">Notat</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfritt" />
        </div>
      </div>

      <div className="btnRow" style={{ justifyContent: "flex-end" }}>
        {props.onCancel ? (
          <button className="btn" type="button" onClick={props.onCancel}>
            Avbryt
          </button>
        ) : null}

        <button className="btn btnPrimary" type="button" onClick={() => props.onSave({ name, phone, address, note })}>
          Lagre
        </button>
      </div>
    </div>
  );
}

/* =========================
   Customer modal panel
========================= */

function CustomerQuickPanel(props: {
  customer: Customer;
  sales: Sale[];
  outstanding: number;

  onStartSale: () => void;
  onDelete: () => void;
  onUpdate: (next: Omit<Customer, "createdAt" | "updatedAt">) => void;
}) {
  const [editMode, setEditMode] = useState(false);

  // Sales list paging inside modal
  const [salesShow, setSalesShow] = useState(5);
  const SALES_PAGE = 5;

  // Payment modal per sale
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  const customerSales = useMemo(() => {
    // newest first
    return props.sales
      .filter((s) => s.customerId === props.customer.id)
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [props.sales, props.customer.id]);

  const totalSpent = useMemo(() => customerSales.reduce((a, b) => a + (Number(b.total) || 0), 0), [customerSales]);

  const outstanding = useMemo(() => {
    return Math.round(customerSales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0) * 100) / 100;
  }, [customerSales]);

  const visibleSales = useMemo(() => customerSales.slice(0, salesShow), [customerSales, salesShow]);

  function openPayment(s: Sale) {
    setPaySale(s);
    setPayAmount(String(Math.max(0, saleRemaining(s)) || 0));
    setPayNote("");
    setPayDate(new Date().toISOString().slice(0, 10));
  }

  function savePayment() {
    if (!paySale) return;
    const a = toNum(payAmount);
    if (a <= 0) return alert("Innbetaling må være over 0.");
    const iso = payDate ? new Date(`${payDate}T12:00:00`).toISOString() : undefined;
    addSalePayment(paySale.id, a, payNote.trim() || undefined, iso);
    setPaySale(null);
  }

  return (
    <div className="fieldGrid" style={{ marginTop: 0 }}>
      {/* Top summary */}
      <div className="item" style={{ marginTop: 0 }}>
        <div className="itemTop">
          <div>
            <p className="itemTitle" style={{ marginBottom: 2 }}>
              {props.customer.name}
            </p>
            <div className="itemMeta">
              {shortMeta(props.customer) ? shortMeta(props.customer) : <span style={{ opacity: 0.9 }}>Ingen kontaktinfo</span>}
            </div>
            <div className="itemMeta" style={{ marginTop: 6 }}>
              Utestående salg: <b>{fmtKr(props.outstanding)}</b> • Totalt solgt: <b>{fmtKr(totalSpent)}</b>
            </div>
          </div>
        </div>

        <div className="btnRow" style={{ marginTop: 10 }}>
          <button className="btn btnPrimary" type="button" onClick={props.onStartSale}>
            Nytt salg
          </button>
          <button className="btn" type="button" onClick={() => setEditMode((v) => !v)}>
            {editMode ? "Lukk redigering" : "Rediger"}
          </button>
          <button className="btn btnDanger" type="button" onClick={props.onDelete}>
            Slett
          </button>
        </div>
      </div>

      {/* Edit */}
      {editMode ? (
        <div className="card" style={{ marginTop: 0 }}>
          <div className="cardTitle" style={{ fontSize: 18 }}>
            Rediger kunde
          </div>
          <CustomerUpsertForm
            mode="edit"
            initial={{
              name: props.customer.name,
              phone: props.customer.phone ?? "",
              address: props.customer.address ?? "",
              note: props.customer.note ?? "",
            }}
            onSave={(draft) => {
              const n = normalizeName(draft.name);
              if (!n) return alert("Kundenavn kan ikke være tomt.");
              props.onUpdate({
                id: props.customer.id,
                name: n,
                phone: draft.phone.trim() || undefined,
                address: draft.address.trim() || undefined,
                note: draft.note.trim() || undefined,
              });
              setEditMode(false);
            }}
            onCancel={() => setEditMode(false)}
          />
        </div>
      ) : null}

      {/* Sales */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle" style={{ fontSize: 18 }}>
          Salg
        </div>
        <div className="cardSub" style={{ marginBottom: 0 }}>
          Viser {Math.min(salesShow, customerSales.length)} av {customerSales.length} • Utestående: <b>{fmtKr(outstanding)}</b>
        </div>

        <div className="list" style={{ marginTop: 10 }}>
          {visibleSales.length === 0 ? <div className="item">Ingen salg registrert på denne kunden enda.</div> : null}

          {visibleSales.map((s) => {
            const paid = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));

            // Show “pent” what they bought (handles multi-line or legacy)
            const lines: any[] = Array.isArray((s as any).lines) ? ((s as any).lines as any[]) : [];
            const boughtText =
              lines.length > 0
                ? lines
                    .slice(0, 3)
                    .map((l) => `${Number(l.qty) || 0}× ${String(l.itemName || "")}`)
                    .filter(Boolean)
                    .join(", ")
                : s.itemName
                ? `${s.qty ?? ""}× ${s.itemName}`
                : "—";

            return (
              <div key={s.id} className={rem > 0 ? "item low" : "item"}>
                <div className="itemTop">
                  <div>
                    <p className="itemTitle" style={{ marginBottom: 2 }}>
                      {fmtKr(s.total)}
                    </p>
                    <div className="itemMeta">
                      Kjøpt: <b>{boughtText}</b>
                      <br />
                      Innbetalt: <b>{fmtKr(paid)}</b> • Utestående: <b>{fmtKr(rem)}</b> • {new Date(s.createdAt).toLocaleString("nb-NO")}
                    </div>
                  </div>
                </div>

                <div className="itemActions">
                  {rem > 0 ? (
                    <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                      Registrer innbetaling
                    </button>
                  ) : (
                    <button className="btn" type="button" disabled>
                      Betalt
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {customerSales.length > visibleSales.length ? (
          <div className="btnRow" style={{ justifyContent: "center" }}>
            <button className="btn" type="button" onClick={() => setSalesShow((n) => n + SALES_PAGE)}>
              Vis {SALES_PAGE} til
            </button>
          </div>
        ) : null}
      </div>

      {/* Payment modal */}
      <Modal open={!!paySale} title="Registrer innbetaling" onClose={() => setPaySale(null)}>
        {paySale ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="itemMeta" style={{ marginTop: 0 }}>
              Utestående: <b>{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
            </div>

            <div className="row3">
              <div>
                <label className="label">Dato</label>
                <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Beløp (kr)</label>
                <input className="input" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Notat</label>
                <input className="input" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Valgfritt" />
              </div>
            </div>

            <div className="btnRow" style={{ justifyContent: "flex-end" }}>
              <button className="btn" type="button" onClick={() => setPaySale(null)}>
                Avbryt
              </button>
              <button className="btn btnPrimary" type="button" onClick={savePayment}>
                Lagre
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
