// src/pages/Kunder.tsx
import React, { useMemo, useState } from "react";
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
  SaleLine,
} from "../app/storage";

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

function saleLinesSafe(s: Sale): SaleLine[] {
  const lines = Array.isArray((s as any).lines) ? ((s as any).lines as SaleLine[]) : [];
  if (lines.length > 0) return lines;

  const itemName = (s as any).itemName;
  const itemId = (s as any).itemId;
  const qty = (s as any).qty;
  const unitPrice = (s as any).unitPrice;
  if (itemName && itemId && Number(qty)) {
    return [
      {
        id: "legacy",
        itemId: String(itemId),
        itemName: String(itemName),
        qty: Number(qty) || 0,
        unitPrice: Number(unitPrice) || 0,
        unitCostAtSale: (s as any).unitCostAtSale,
      } as any,
    ];
  }
  return [];
}

function saleCompactText(s: Sale) {
  const lines = saleLinesSafe(s);
  const first = lines.slice(0, 2).map((l) => `${l.qty}× ${l.itemName}`).join(", ");
  const more = lines.length > 2 ? ` +${lines.length - 2}` : "";
  return (first ? `${first}${more}` : "Salg");
}

export function Kunder() {
  const { customers, upsert, remove, setAll } = useCustomers();
  const { sales } = useSales();

  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const [edit, setEdit] = useState<Customer | null>(null);

  const sorted = useMemo(() => {
    const copy = [...customers];
    copy.sort((a, b) => (a.name || "").localeCompare(b.name || "", "nb-NO", { sensitivity: "base" }));
    return copy;
  }, [customers]);

  const outstandingByCustomerId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      if (!s.customerId) continue;
      const rem = Math.max(0, saleRemaining(s));
      if (rem <= 0) continue;
      map.set(s.customerId, (map.get(s.customerId) ?? 0) + rem);
    }
    for (const [k, v] of map) map.set(k, Math.round(v * 100) / 100);
    return map;
  }, [sales]);

  const lastUsedCustomers = useMemo(() => {
    // “sist brukt”: ta siste salg pr kunde
    const lastById = new Map<string, string>(); // customerId -> createdAt
    for (const s of sales) {
      if (!s.customerId) continue;
      const prev = lastById.get(s.customerId);
      if (!prev || (s.createdAt || "").localeCompare(prev) > 0) lastById.set(s.customerId, s.createdAt);
    }

    const arr = sorted
      .filter((c) => lastById.has(c.id))
      .map((c) => ({ c, last: lastById.get(c.id)! }))
      .sort((a, b) => (b.last || "").localeCompare(a.last || ""))
      .slice(0, 6)
      .map((x) => x.c);

    return arr;
  }, [sales, sorted]);

  const outstandingCustomers = useMemo(() => {
    const arr = sorted
      .map((c) => ({ c, out: outstandingByCustomerId.get(c.id) ?? 0 }))
      .filter((x) => x.out > 0)
      .sort((a, b) => b.out - a.out)
      .slice(0, 8);
    return arr;
  }, [sorted, outstandingByCustomerId]);

  const filteredAll = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let base = sorted;

    if (onlyOutstanding) {
      base = base.filter((c) => (outstandingByCustomerId.get(c.id) ?? 0) > 0);
    }

    if (!qq) return base;

    return base.filter((c) => {
      const hay = `${c.name} ${c.phone ?? ""} ${c.address ?? ""} ${c.note ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [sorted, q, onlyOutstanding, outstandingByCustomerId]);

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

  function startSaleForCustomer(c: Customer) {
    setSaleDraftCustomer(c.id);
    alert(`Klar! Gå til "Salg" fanen – kunden "${c.name}" er forhåndsvalgt.`);
  }

  function addCustomer() {
    const n = normalizeName(name);
    if (!n) return alert("Kundenavn kan ikke være tomt.");

    upsert({
      id: uid("cust"),
      name: n,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      note: note.trim() || undefined,
    });

    setName("");
    setPhone("");
    setAddress("");
    setNote("");
    setNewOpen(false);
  }

  // Default: IKKE vis hele kundelista uten søk / “vis alle”
  const shouldShowAllList = showAll || q.trim().length > 0 || onlyOutstanding;

  return (
    <div className="card">
      <div className="cardTitle">Kunder</div>
      <div className="cardSub">Søk først. Åpne kunde for handlinger. • Antall: <b>{customers.length}</b></div>

      <div className="btnRow">
        <button className="btn btnPrimary" type="button" onClick={() => setNewOpen(true)}>+ Ny kunde</button>
        <button className="btn" type="button" onClick={() => setOnlyOutstanding((v) => !v)}>
          {onlyOutstanding ? "Vis alle" : "Utestående"}
        </button>
        <button className="btn" type="button" onClick={exportJson}>Eksporter</button>
        <button className="btn" type="button" onClick={importJson}>Importer</button>
      </div>

      <div style={{ height: 10 }} />

      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i kunder..." />

      {/* Utestående */}
      {outstandingCustomers.length > 0 ? (
        <div className="card">
          <div className="cardTitle">Utestående</div>
          <div className="cardSub">Kunder med penger utestående.</div>

          <div className="list">
            {outstandingCustomers.map(({ c, out }) => (
              <div
                key={c.id}
                className="rowItem"
                onClick={() => setEdit(c)}
                role="button"
                tabIndex={0}
              >
                <div>
                  <p className="rowItemTitle">{c.name}</p>
                  <div className="rowItemSub">
                    Utestående: <b className="dangerText">{fmtKr(out)}</b>
                    {c.address ? <> • Adr: <b>{c.address}</b></> : null}
                  </div>
                </div>
                <span className="badge danger">Ubetalt</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Sist brukt */}
      {lastUsedCustomers.length > 0 ? (
        <div className="card">
          <div className="cardTitle">Sist brukt</div>
          <div className="cardSub">Trykk en kunde for detaljer / nytt salg.</div>

          <div className="list">
            {lastUsedCustomers.map((c) => {
              const out = outstandingByCustomerId.get(c.id) ?? 0;
              return (
                <div
                  key={c.id}
                  className="rowItem"
                  onClick={() => setEdit(c)}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <p className="rowItemTitle">{c.name}</p>
                    <div className="rowItemSub">
                      {out > 0 ? (
                        <>Utestående: <b className="dangerText">{fmtKr(out)}</b></>
                      ) : (
                        <span className="successText">Ingen utestående</span>
                      )}
                    </div>
                  </div>
                  {out > 0 ? <span className="badge danger">Utestående</span> : <span className="badge success">OK</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* “Alle kunder” (kun når relevant) */}
      <div className="card">
        <div className="cardTitle">Alle kunder</div>
        <div className="cardSub">
          {shouldShowAllList
            ? `Viser ${filteredAll.length} treff.`
            : "Skjult for å unngå scrolling. Søk eller trykk “Vis alle”."
          }
        </div>

        {!shouldShowAllList ? (
          <div className="btnRow">
            <button className="btn" type="button" onClick={() => setShowAll(true)}>Vis alle</button>
          </div>
        ) : (
          <div className="list">
            {filteredAll.slice(0, 30).map((c) => {
              const out = outstandingByCustomerId.get(c.id) ?? 0;
              return (
                <div key={c.id} className="rowItem" onClick={() => setEdit(c)} role="button" tabIndex={0}>
                  <div>
                    <p className="rowItemTitle">{c.name}</p>
                    <div className="rowItemSub">
                      {out > 0 ? (
                        <>Utestående: <b className="dangerText">{fmtKr(out)}</b></>
                      ) : (
                        <span className="successText">Ingen utestående</span>
                      )}
                    </div>
                  </div>
                  {out > 0 ? <span className="badge danger">Ubetalt</span> : <span className="badge success">Betalt</span>}
                </div>
              );
            })}

            {filteredAll.length > 30 ? (
              <div className="item">
                Viser 30 av {filteredAll.length}. (Søk for å snevre inn)
              </div>
            ) : null}

            {filteredAll.length === 0 ? <div className="item">Ingen treff.</div> : null}
          </div>
        )}
      </div>

      {/* NEW CUSTOMER MODAL */}
      <Modal open={newOpen} title="Ny kunde" onClose={() => setNewOpen(false)}>
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

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={addCustomer}>Lagre</button>
            <button className="btn" type="button" onClick={() => setNewOpen(false)}>Avbryt</button>
          </div>
        </div>
      </Modal>

      {/* CUSTOMER DETAILS MODAL (SCROLLS INSIDE) */}
      <Modal open={!!edit} title={edit ? edit.name : "Kunde"} onClose={() => setEdit(null)}>
        {edit ? (
          <CustomerDetails
            customer={edit}
            onClose={() => setEdit(null)}
            onSave={(next) => { upsert(next); }}
            onStartSale={() => startSaleForCustomer(edit)}
            onDelete={() => { if (confirm(`Slette "${edit.name}"?`)) { remove(edit.id); setEdit(null); } }}
            sales={sales}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function CustomerDetails(props: {
  customer: Customer;
  onClose: () => void;
  onSave: (next: Omit<Customer, "createdAt" | "updatedAt">) => void;
  onStartSale: () => void;
  onDelete: () => void;
  sales: Sale[];
}) {
  const [name, setName] = useState(props.customer.name);
  const [phone, setPhone] = useState(props.customer.phone ?? "");
  const [address, setAddress] = useState(props.customer.address ?? "");
  const [note, setNote] = useState(props.customer.note ?? "");

  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  const customerSales = useMemo(() => {
    return props.sales
      .filter((s) => s.customerId === props.customer.id)
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [props.sales, props.customer.id]);

  const totalSpent = useMemo(() => customerSales.reduce((a, b) => a + (Number(b.total) || 0), 0), [customerSales]);
  const outstanding = useMemo(
    () => Math.round(customerSales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0) * 100) / 100,
    [customerSales]
  );

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
      <div className="miniRow">
        <span>Sum solgt: <b>{fmtKr(totalSpent)}</b></span>
        <span>Utestående: <b className={outstanding > 0 ? "dangerText" : "successText"}>{fmtKr(outstanding)}</b></span>
      </div>

      <div className="row3">
        <div>
          <label className="label">Navn</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Telefon</label>
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Notat</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="btnRow">
        <button
          className="btn btnPrimary"
          type="button"
          onClick={() => {
            const n = normalizeName(name);
            if (!n) return alert("Kundenavn kan ikke være tomt.");
            props.onSave({
              id: props.customer.id,
              name: n,
              phone: phone.trim() || undefined,
              address: address.trim() || undefined,
              note: note.trim() || undefined,
            });
          }}
        >
          Lagre
        </button>

        <button className="btn" type="button" onClick={props.onStartSale}>Nytt salg</button>
        <button className="btn btnDanger" type="button" onClick={props.onDelete}>Slett kunde</button>
        <button className="btn" type="button" onClick={props.onClose}>Lukk</button>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="cardTitle">Salg</div>
        <div className="cardSub">Trykk “Registrer innbetaling” på utestående salg.</div>

        <div className="list">
          {customerSales.map((s) => {
            const paid = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));
            const paidOk = rem <= 0 || s.paid;

            return (
              <div key={s.id} className="item">
                <div className="itemTop">
                  <div>
                    <p className="itemTitle">{fmtKr(s.total)}</p>
                    <div className="itemMeta">
                      Kjøpt: <b>{saleCompactText(s)}</b>
                    </div>
                    <div className="itemMeta" style={{ marginTop: 6 }}>
                      Innbetalt: <b className={paidOk ? "successText" : ""}>{fmtKr(paid)}</b> •{" "}
                      Utestående: <b className={rem > 0 ? "dangerText" : "successText"}>{fmtKr(rem)}</b> •{" "}
                      {new Date(s.createdAt).toLocaleString("nb-NO")}
                    </div>
                  </div>

                  {paidOk ? <span className="badge success">Betalt</span> : <span className="badge danger">Ubetalt</span>}
                </div>

                <div className="itemActions">
                  {rem > 0 ? (
                    <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                      Registrer innbetaling
                    </button>
                  ) : (
                    <button className="btn" type="button" disabled>OK</button>
                  )}
                </div>
              </div>
            );
          })}

          {customerSales.length === 0 ? <div className="item">Ingen salg på denne kunden enda.</div> : null}
        </div>
      </div>

      <Modal open={!!paySale} title="Registrer innbetaling" onClose={() => setPaySale(null)}>
        {paySale ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="itemMeta" style={{ marginTop: 0 }}>
              Utestående nå: <b className="dangerText">{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
            </div>

            <div className="row3">
              <div>
                <label className="label">Dato</label>
                <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Beløp</label>
                <input className="input" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Notat</label>
                <input className="input" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Valgfritt" />
              </div>
            </div>

            <div className="btnRow">
              <button className="btn btnPrimary" type="button" onClick={savePayment}>Lagre</button>
              <button className="btn" type="button" onClick={() => setPaySale(null)}>Avbryt</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
