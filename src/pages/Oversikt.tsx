// src/pages/Oversikt.tsx
import React, { useMemo, useState } from "react";
import {
  fmtKr,
  getItems,
  receivableRemaining,
  saleRemaining,
  setSaldo,
  useCustomers,
  useReceivables,
  useSales,
  useSaldo,
  Sale,
} from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

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

function isAfter(dateIso: string, from: Date) {
  const d = new Date(dateIso);
  return Number.isFinite(d.getTime()) && d.getTime() >= from.getTime();
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function Oversikt() {
  const { sales } = useSales();
  const { customers } = useCustomers();
  const { receivables } = useReceivables();
  const [saldo] = useSaldo();

  const [saldoOpen, setSaldoOpen] = useState(false);
  const [saldoInput, setSaldoInput] = useState(String(saldo));

  const itemMap = useMemo(() => {
    const items = getItems();
    const m = new Map<string, { cost: number; name: string }>();
    for (const it of items) m.set(it.id, { cost: Number(it.cost ?? 0), name: it.name });
    return m;
  }, []);

  const from7 = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const from30 = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), []);
  const fromMonth = useMemo(() => startOfMonth(new Date()), []);

  function calcProfitForSale(s: Sale) {
    // ✅ per linje hvis linjer finnes
    if (Array.isArray(s.lines) && s.lines.length > 0) {
      return s.lines.reduce((a, l) => {
        const unitCost = Number.isFinite(Number(l.unitCostAtSale))
          ? Number(l.unitCostAtSale)
          : itemMap.get(l.itemId)?.cost ?? 0;
        const qty = Number(l.qty ?? 0);
        const unitPrice = Number(l.unitPrice ?? 0);
        return a + (unitPrice - unitCost) * qty;
      }, 0);
    }

    // fallback gammel
    const unitCost = Number.isFinite(Number(s.unitCostAtSale)) ? Number(s.unitCostAtSale) : itemMap.get(s.itemId)?.cost ?? 0;
    const qty = Number(s.qty ?? 0);
    const unitPrice = Number(s.unitPrice ?? 0);
    return (unitPrice - unitCost) * qty;
  }

  const totals = useMemo(() => {
    const unpaidSalesTotal = sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0);
    const unpaidReceivablesTotal = receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0);
    const grand = Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal;

    const s7 = sales.filter((s) => isAfter(s.createdAt, from7));
    const s30 = sales.filter((s) => isAfter(s.createdAt, from30));
    const sm = sales.filter((s) => isAfter(s.createdAt, fromMonth));

    const sumRevenue = (list: Sale[]) => list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const sumProfit = (list: Sale[]) => list.reduce((a, b) => a + calcProfitForSale(b), 0);

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,
      grand,

      revenue7: sumRevenue(s7),
      profit7: sumProfit(s7),
      count7: s7.length,

      revenue30: sumRevenue(s30),
      profit30: sumProfit(s30),
      count30: s30.length,

      revenueM: sumRevenue(sm),
      profitM: sumProfit(sm),
      countM: sm.length,
    };
  }, [sales, receivables, saldo, from7, from30, fromMonth, itemMap]);

  const perCustomer30 = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; profit: number; unpaid: number; count: number }>();
    const list = sales.filter((s) => isAfter(s.createdAt, from30));

    for (const s of list) {
      const key = s.customerId ? `c:${s.customerId}` : "anon";
      const name =
        s.customerName || (s.customerId ? customers.find((c) => c.id === s.customerId)?.name : null) || "Anonym";

      const prev = map.get(key) || { name, revenue: 0, profit: 0, unpaid: 0, count: 0 };
      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;
      prev.unpaid += Math.max(0, saleRemaining(s));
      map.set(key, prev);
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr;
  }, [sales, customers, from30, itemMap]);

  const topItems30 = useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; qty: number; revenue: number }>();
    const list = sales.filter((s) => isAfter(s.createdAt, from30));

    for (const s of list) {
      const lines = Array.isArray(s.lines) && s.lines.length > 0
        ? s.lines
        : [{ itemId: s.itemId, itemName: s.itemName, qty: s.qty, unitPrice: s.unitPrice, lineTotal: s.total }];

      for (const l of lines as any[]) {
        const id = String(l.itemId ?? "");
        if (!id) continue;
        const name = String(l.itemName ?? itemMap.get(id)?.name ?? "Ukjent");
        const qty = Number(l.qty ?? 0) || 0;
        const revenue = Number(l.lineTotal ?? (Number(l.unitPrice ?? 0) * qty)) || 0;

        const prev = map.get(id) || { itemId: id, name, qty: 0, revenue: 0 };
        prev.qty += qty;
        prev.revenue += revenue;
        map.set(id, prev);
      }
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.qty - a.qty);
    return arr.slice(0, 12);
  }, [sales, from30, itemMap]);

  function openSaldoModal() {
    setSaldoInput(String(saldo));
    setSaldoOpen(true);
  }

  function saveSaldo() {
    const v = toNum(saldoInput);
    setSaldo(v);
    setSaldoOpen(false);
  }

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">Saldo + utestående (automatisk) + statistikk.</div>

      {/* Penger */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>
          Penger
        </div>

        <div style={{ fontSize: 44, fontWeight: 850, letterSpacing: "-0.02em" }}>{fmtKr(saldo)}</div>

        <div className="itemMeta" style={{ marginTop: 10 }}>
          Utestående salg: <b>{fmtKr(totals.unpaidSalesTotal)}</b>
          <br />
          Gjeld til deg: <b>{fmtKr(totals.unpaidReceivablesTotal)}</b>
        </div>

        <div className="itemMeta" style={{ marginTop: 10, opacity: 0.95 }}>
          Total når alt er betalt: <b>{fmtKr(totals.grand)}</b>
        </div>

        <div className="btnRow" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" type="button" onClick={openSaldoModal}>
            Oppdater saldo
          </button>
        </div>
      </div>

      {/* Perioder */}
      <div className="list">
        <div className="item">
          <p className="itemTitle">Siste 7 dager</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(totals.revenue7)}</b> • Profitt: <b>{fmtKr(totals.profit7)}</b> • Salg: <b>{totals.count7}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Siste 30 dager</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(totals.revenue30)}</b> • Profitt: <b>{fmtKr(totals.profit30)}</b> • Salg: <b>{totals.count30}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Denne måneden</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(totals.revenueM)}</b> • Profitt: <b>{fmtKr(totals.profitM)}</b> • Salg: <b>{totals.countM}</b>
          </div>
        </div>
      </div>

      {/* Solgt mest */}
      <div className="card">
        <div className="cardTitle">Solgt mest (30 dager)</div>
        <div className="cardSub">Topp varer etter antall solgt.</div>

        <div className="list">
          {topItems30.length === 0 ? (
            <div className="item">Ingen salg siste 30 dager.</div>
          ) : (
            topItems30.map((x) => (
              <div key={x.itemId} className="item">
                <p className="itemTitle">{x.name}</p>
                <div className="itemMeta">
                  Antall: <b>{x.qty}</b> • Omsetning: <b>{fmtKr(x.revenue)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Salg pr kunde */}
      <div className="card">
        <div className="cardTitle">Salg pr kunde (30 dager)</div>
        <div className="cardSub">Solgt, profitt og utestående pr kunde.</div>

        <div className="list">
          {perCustomer30.length === 0 ? (
            <div className="item">Ingen salg siste 30 dager.</div>
          ) : (
            perCustomer30.slice(0, 20).map((c) => (
              <div key={c.name} className="item">
                <p className="itemTitle">{c.name}</p>
                <div className="itemMeta">
                  Solgt: <b>{fmtKr(c.revenue)}</b> • Profitt: <b>{fmtKr(c.profit)}</b> • Salg: <b>{c.count}</b> • Utestående:{" "}
                  <b>{fmtKr(c.unpaid)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={saldoOpen} title="Oppdater saldo" onClose={() => setSaldoOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div>
            <label className="label">Saldo (kr)</label>
            <input className="input" inputMode="decimal" value={saldoInput} onChange={(e) => setSaldoInput(e.target.value)} />
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={saveSaldo}>
              Lagre
            </button>
            <button className="btn" type="button" onClick={() => setSaldoOpen(false)}>
              Avbryt
            </button>
          </div>

          <div className="itemMeta" style={{ marginTop: 6 }}>
            Saldo endres kun manuelt. Utestående oppdateres automatisk av salg/gjeld og innbetalinger.
          </div>
        </div>
      </Modal>
    </div>
  );
}
