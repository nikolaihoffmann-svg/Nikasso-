import { useEffect, useState } from "react";
import { ensureSeedData } from "./storage";
import Logo from "./Logo";

import Oversikt from "../pages/Oversikt";
import Varer from "../pages/Varer";
import Innkjop from "../pages/Innkjop";
import Salg from "../pages/Salg";
import Kunder from "../pages/Kunder";
import Gjeld from "../pages/Gjeld";
import DataPage from "../pages/Data";

type Tab =
  | "oversikt"
  | "varer"
  | "innkjop"
  | "salg"
  | "kunder"
  | "gjeld"
  | "data";

export default function App() {
  const [tab, setTab] = useState<Tab>("oversikt");

  useEffect(() => {
    ensureSeedData();
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  return (
    <div className="app">
      <header className="header">
        <Logo />

        <button className="dataBtn" onClick={() => setTab("data")}>
          ⚙️
        </button>
      </header>

      <nav className="nav">
        <button className={tab==="oversikt"?"active":""} onClick={()=>setTab("oversikt")}>oversikt</button>
        <button className={tab==="varer"?"active":""} onClick={()=>setTab("varer")}>varer</button>
        <button className={tab==="innkjop"?"active":""} onClick={()=>setTab("innkjop")}>innkjop</button>
        <button className={tab==="salg"?"active":""} onClick={()=>setTab("salg")}>salg</button>
        <button className={tab==="kunder"?"active":""} onClick={()=>setTab("kunder")}>kunder</button>
        <button className={tab==="gjeld"?"active":""} onClick={()=>setTab("gjeld")}>gjeld</button>
      </nav>

      <main className="content">
        {tab==="oversikt" && <Oversikt />}
        {tab==="varer" && <Varer />}
        {tab==="innkjop" && <Innkjop />}
        {tab==="salg" && <Salg />}
        {tab==="kunder" && <Kunder />}
        {tab==="gjeld" && <Gjeld />}
        {tab==="data" && <DataPage />}
      </main>
    </div>
  );
}
