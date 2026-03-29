import {
  getCustomers,
  customerTotalRemaining,
  customerTotalBought,
  fmtKr
} from "../app/storage";

export default function Oversikt() {
  const customers = getCustomers();

  const totalDebt = customers.reduce(
    (sum, c) => sum + customerTotalRemaining(c.id),
    0
  );

  const totalRevenue = customers.reduce(
    (sum, c) => sum + customerTotalBought(c.id),
    0
  );

  const avgDebt =
    customers.length > 0 ? totalDebt / customers.length : 0;

  const topCustomers = [...customers]
    .sort(
      (a, b) =>
        customerTotalRemaining(b.id) -
        customerTotalRemaining(a.id)
    )
    .slice(0, 5);

  return (
    <div className="grid">

      <div className="grid2">
        <div className="card">
          <div className="label">Totalt utestående</div>
          <div className="kpi">{fmtKr(totalDebt)}</div>
        </div>

        <div className="card">
          <div className="label">Totalt omsatt</div>
          <div className="kpi">{fmtKr(totalRevenue)}</div>
        </div>

        <div className="card">
          <div className="label">Snitt gjeld per kunde</div>
          <div className="kpi">{fmtKr(avgDebt)}</div>
        </div>

        <div className="card">
          <div className="label">Antall kunder</div>
          <div className="kpi">{customers.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="label">Topp skyldnere</div>

        <div className="list">
          {topCustomers.map((c) => (
            <div key={c.id} className="row">
              <div>{c.name}</div>
              <div>{fmtKr(customerTotalRemaining(c.id))}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
