// src/pages/Oversikt.tsx
import React, { useMemo, useState } from "react";
import {
  fmtKr,
  useCustomers,
  useItems,
  useReceivables,
  useSales,
  receivableRemaining,
  saleRemaining,
  useSaldo,
  round2,
} from "../app/storage";

function isAfter(dateIso: string, from: Date) {
  const d = new Date(dateIso);
  return Number.isFinite(d.getTime()) && d.getTime() >= from.getTime();
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

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

export function Oversikt() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales } = useSales();
  const { receivables } = useReceivables();

  const [saldo, setSaldo] = useSaldo();

  // modal for saldo
  const [saldoOpen, setSaldoOpen] = useState(false);
  const [saldoDraft, setSaldoDraft] = useState<string>(String(saldo));

  const byItemId = useMemo(() => {
    const m = new Map<string, { cost: number; name: string }>();
    for (const it of items) m.set(it.id, { cost: Number(it.cost ?? 0), name: it.name });
    return m;
  }, [items]);

  const from7 = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const from30 = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), []);
  const fromMonth = useMemo(() => startOfMonth(new Date()), []);

  function calcProfitForSale(s: any) {
    const unitCost = Number.isFinite(Number(s.unitCostAtSale)) ? Number(s.unitCostAtSale) : byItemId.get(s.itemId)?.cost ?? 0;
    const qty = Number(s.qty ?? 0);
    const unitPrice = Number(s.unitPrice ?? 0);
    return (unitPrice - unitCost) * qty;
  }

  const period = useMemo(() => {
    const all = sales;

    const s7 = all.filter((s) => isAfter(s.createdAt, from7));
    const s30 = all.filter((s) => isAfter(s.createdAt, from30));
    const sm = all.filter((s) => isAfter(s.createdAt, fromMonth));

    function sumRevenue(list: any[]) {
      return list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    }
    function sumProfit(list: any[]) {
      return list.reduce((a, b) => a + calcProfitForSale(b), 0);
    }

    return {
      s7,
      s30,
      sm,
      revenue7: sumRevenue(s7),
      profit7: sumProfit(s7),
      revenue30: sumRevenue(s30),
      profit30: sumProfit(s30),
      revenueM: sumRevenue(sm),
      profitM: sumProfit(sm),
    };
  }, [sales, from7, from30, fromMonth, byItemId]);

  // Utestående summer (auto)
  const outstanding = useMemo(() => {
    const unpaidSalesTotal = round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
    const unpaidReceivablesTotal = round2(receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0));
    const totalMoneyView = round2((Number(saldo) || 0) + unpaidSalesTotal + unpaidReceivablesTotal);

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,
      totalMoneyView,
    };
  }, [sales, receivables, saldo]);

  const perCustomer30 = useMemo(() => {
    const map = new Map<
      string,
      { customerId?: string; customerName: string; revenue: number; profit: number; unpaid: number; count: number }
    >();

    const list = sales.filter((s) => isAfter(s.createdAt, from30));

    for (const s of list) {
      const key = s.customerId ? `c:${s.customerId}` : "anon";
      const name =
        s.customerName || (s.customerId ? customers.find((c) => c.id === s.customerId)?.name : null) || "Anonym";

      const prev = map.get(key) || { customerId: s.customerId, customerName: name, revenue: 0, profit: 0, unpaid: 0, count: 0 };
      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;

      const rem = Math.max(0, saleRemaining(s));
      if (rem > 0) prev.unpaid += rem;

      map.set(key, prev);
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr;
  }, [sales, customers, from30, byItemId]);

  function openSaldo() {
    setSaldoDraft(String(saldo));
    setSaldoOpen(true);
  }

  function saveSaldo() {
    const n = round2(toNum(saldoDraft));
    setSaldo(n);
    setSaldoOpen(false);
  }

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">Saldo + utestående penger • salg/profitt</div>

      {/* Penger-kortet (saldo + utestående under hverandre) */}
      <div className="list">
        <div className="item">
          <p className="itemTitle">Penger</p>
          <div className="itemMeta" style={{ marginTop: 8 }}>
            Saldo: <b>{fmtKr(saldo)}</b>
            <br />
            Utestående betalinger (salg): <b>{fmtKr(outstanding.unpaidSalesTotal)}</b>
            <br />
            Utestående gjeld (til deg): <b>{fmtKr(outstanding.unpaidReceivablesTotal)}</b>
            <br />
            <span style={{ opacity: 0.85 }}>Totalt (saldo + utestående):</span> <b>{fmtKr(outstanding.totalMoneyView)}</b>
          </div>

          <div className="btnRow" style={{ marginTop: 12 }}>
            <button className="btn btnPrimary" type="button" onClick={openSaldo}>
              Oppdater saldo
            </button>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Siste 7 dager</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(period.revenue7)}</b> • Faktisk profitt: <b>{fmtKr(period.profit7)}</b> • Antall salg:{" "}
            <b>{period.s7.length}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Siste 30 dager</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(period.revenue30)}</b> • Faktisk profitt: <b>{fmtKr(period.profit30)}</b> • Antall salg:{" "}
            <b>{period.s30.length}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Denne måneden</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(period.revenueM)}</b> • Faktisk profitt: <b>{fmtKr(period.profitM)}</b> • Antall salg:{" "}
            <b>{period.sm.length}</b>
          </div>
        </div>
      </div>

      {/* Per kunde 30 dager */}
      <div className="card">
        <div className="cardTitle">Salg pr kunde (30 dager)</div>
        <div className="cardSub">Inntekt, faktisk profitt og utestående pr kunde.</div>

        <div className="list">
          {perCustomer30.length === 0 ? (
            <div className="item">Ingen salg siste 30 dager.</div>
          ) : (
            perCustomer30.slice(0, 20).map((c) => (
              <div key={(c.customerId ?? "anon") + "_30"} className="item">
                <p className="itemTitle">{c.customerName}</p>
                <div className="itemMeta">
                  Solgt: <b>{fmtKr(c.revenue)}</b> • Profitt: <b>{fmtKr(c.profit)}</b> • Salg: <b>{c.count}</b> •
                  Utestående: <b>{fmtKr(c.unpaid)}</b>
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
            <input className="input" inputMode="decimal" value={saldoDraft} onChange={(e) => setSaldoDraft(e.target.value)} />
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={saveSaldo}>
              Lagre
            </button>
            <button className="btn" type="button" onClick={() => setSaldoOpen(false)}>
              Avbryt
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
