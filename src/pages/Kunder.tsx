// src/pages/Kunder.tsx
import React, { useMemo, useState } from "react";
import { Customer, uid, useCustomers } from "../app/storage";

function Modal(props: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
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

export function Kunder() {
  const { customers, upsert, remove, setAll } = useCustomers();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Customer | null>(null);

  const sorted = useMemo(() => {
    const copy = [...customers];
    copy.sort((a, b) => (a.name || "").localeCompare(b.name || "", "nb-NO", { sensitivity: "base" }));
    return copy;
  }, [customers]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return sorted;

    return sorted.filter((c) => {
      const hay = `${c.name} ${c.phone ?? ""} ${c.address ?? ""} ${c.note ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [sorted, q]);

  function addCustomer() {
    const n = normalizeName(name);
    if (!n) {
      alert("Kundenavn kan ikke være tomt.");
      return;
    }

    const exists = customers.some((c) => normalizeName(c.name).toLowerCase() === n.toLowerCase());
    if (exists) {
      if (!confirm(`"${n}" finnes allerede. Legge til likevel?`)) return;
    }

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

        // "Erstatt alt"
        setAll(normalized);
      } catch {
        alert("Kunne ikke importere filen (ugyldig JSON).");
      }
    };
    input.click();
  }

  return (
    <div className="card">
      <div className="cardTitle">Kunder</div>
      <div className="cardSub">
        Antall kunder: <b>{customers.length}</b> • Lokal lagring
      </div>

      <div className="btnRow">
        <button className="btn" type="button" onClick={exportJson}>
          Eksporter
        </button>
        <button className="btn" type="button" onClick={importJson}>
          Importer
        </button>
      </div>

      <div style={{ height: 14 }} />

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Legg til kunde</div>

        <div className="fieldGrid">
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
            <button className="btn btnPrimary" type="button" onClick={addCustomer}>
              + Legg til
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i kunder..." />
      </div>

      <div className="list">
        {filtered.map((c) => (
          <div key={c.id} className="item">
            <div className="itemTop">
              <div>
                <p className="itemTitle">{c.name}</p>

                <div className="itemMeta">
                  {c.phone ? (
                    <>
                      Tlf: <b>{c.phone}</b>
                    </>
                  ) : null}

                  {c.address ? (
                    <>
                      {c.phone ? " • " : ""}
                      Adr: <b>{c.address}</b>
                    </>
                  ) : null}

                  {c.note ? (
                    <>
                      {(c.phone || c.address) ? " • " : ""}
                      Notat: <b>{c.note}</b>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="itemActions">
              <button className="btn" type="button" onClick={() => setEdit(c)}>
                Rediger
              </button>
              <button
                className="btn btnDanger"
                type="button"
                onClick={() => {
                  if (confirm(`Slette "${c.name}"?`)) remove(c.id);
                }}
              >
                Slett
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? <div className="item">Ingen treff.</div> : null}
      </div>

      <Modal open={!!edit} title="Rediger kunde" onClose={() => setEdit(null)}>
        {edit ? (
          <EditCustomerForm
            customer={edit}
            onSave={(next) => {
              upsert(next);
              setEdit(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function EditCustomerForm(props: {
  customer: Customer;
  onSave: (next: Omit<Customer, "createdAt" | "updatedAt">) => void;
}) {
  const [name, setName] = useState(props.customer.name);
  const [phone, setPhone] = useState(props.customer.phone ?? "");
  const [address, setAddress] = useState(props.customer.address ?? "");
  const [note, setNote] = useState(props.customer.note ?? "");

  return (
    <div className="fieldGrid">
      <div>
        <label className="label">Navn</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="row3">
        <div>
          <label className="label">Telefon</label>
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="label">Notat</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
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
      </div>
    </div>
  );
}
