import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";

const fmtTime = (s) => {
  if (!s && s !== 0) return "-";
  const sec = Number(s);
  if (Number.isNaN(sec)) return "-";
  const m = Math.floor(sec / 60);
  const r = sec - m * 60;
  return m ? `${m}:${r.toFixed(2).padStart(5, "0")}` : r.toFixed(2);
};
const parseYYYYMMDD = (v) => {
  const s = String(v || "");
  const y = +s.slice(0, 4), m = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
  return new Date(y, m, d);
};
const xLabel = (v) => {
  const s = String(v || "");
  return `${s.slice(2, 4)}/${s.slice(4, 6)}`;
};

export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_URL || "";

  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("50公尺蛙式");

  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [famStats, setFamStats] = useState(null);
  const [rankData, setRankData] = useState(null); // Rank API
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function search(cursor = 0) {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true);
    setErr("");

    try {
      const url = `${api}/api/results?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&limit=200&cursor=${cursor}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("results 取得失敗");
      const j = await r.json();
      const newItems = j.items || [];
      setItems(cursor === 0 ? newItems : [...items, ...newItems]);
      setNext(j.nextCursor ?? null);

      const sUrl = `${api}/api/stats/family?name=${encodeURIComponent(name)}`;
      const sr = await fetch(sUrl);
      if (!sr.ok) throw new Error("stats/family 取得失敗");
      const sj = await sr.json();
      setFamStats(sj || {});

      const rUrl = `${api}/api/rank?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}`;
      const rr = await fetch(rUrl);
      if (!rr.ok) throw new Error("rank 取得失敗");
      const rj = await rr.json();
      setRankData(rj || null);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const pbValue = useMemo(() => {
    if (!items.length) return null;
    const secs = items.map((x) => x.seconds).filter((s) => typeof s === "number" && s > 0);
    return secs.length ? Math.min(...secs) : null;
  }, [items]);

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 20% -10%, #1f232b 0%, #0f1216 60%, #0a0c10 100%)", color: "#E9E9EC", padding: "24px 16px 80px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#E9DDBB" }}>游泳成績查詢</h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 8, marginBottom: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" style={inp} />
          <select value={stroke} onChange={(e) => setStroke(e.target.value)} style={inp}>
            {["50公尺自由式","50公尺蛙式","50公尺仰式","50公尺蝶式","100公尺自由式","100公尺蛙式","100公尺仰式","100公尺蝶式","200公尺自由式","200公尺蛙式","200公尺仰式","200公尺蝶式","200公尺混合式"].map(x=>(
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <button onClick={() => search(0)} disabled={loading} style={btn}>查詢</button>
        </div>

        {err && <div style={{ color:"#ffb3b3" }}>查詢失敗：{err}</div>}

        {/* 排行卡片 */}
        {rankData && (
          <Card>
            <SectionTitle>排行</SectionTitle>
            <div style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 8 }}>總人數：{rankData.denominator}，你的排名：{rankData.rank}（{rankData.percentile?.toFixed(2)}%）</div>
              <table style={table}>
                <thead><tr><th style={th}>名次</th><th style={th}>姓名</th><th style={th}>PB</th><th style={th}>年份</th><th style={th}>賽事</th></tr></thead>
                <tbody>
                  {rankData.top.map((r, i) => (
                    <tr key={i} style={{ color: r.name === name ? "#ff6b6b" : "#E9E9EC" }}>
                      <td style={td}>{r.rank}</td>
                      <td style={td}>{r.name}</td>
                      <td style={td}>{fmtTime(r.pb)}</td>
                      <td style={td}>{r.pb_year}</td>
                      <td style={td}>{r.pb_meet}</td>
                    </tr>
                  ))}
                  {rankData.you && rankData.rank > 10 && (
                    <tr style={{ color:"#ff6b6b" }}>
                      <td style={td}>{rankData.you.rank}</td>
                      <td style={td}>{rankData.you.name}</td>
                      <td style={td}>{fmtTime(rankData.you.pb_seconds)}</td>
                      <td style={td}>{rankData.you.pb_year}</td>
                      <td style={td}>{rankData.you.pb_meet}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 詳細成績 */}
        <Card>
          <SectionTitle>詳細成績</SectionTitle>
          <table style={table}>
            <thead><tr><th style={th}>年份</th><th style={th}>賽事</th><th style={th}>秒數</th></tr></thead>
            <tbody>
              {items.slice().sort((a,b)=>b["年份"]-a["年份"]).map((r,i)=>(
                <tr key={i}>
                  <td style={td}>{r["年份"]}</td>
                  <td style={td}>{r["賽事名稱"]}</td>
                  <td style={{ ...td, color: r.seconds === pbValue ? "#ff6b6b" : "#E9E9EC" }}>{fmtTime(r.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </main>
  );
}

const Card = ({ children }) => (
  <section style={{ background:"linear-gradient(180deg, rgba(31,35,43,.9), rgba(19,22,27,.98)) padding-box, linear-gradient(180deg, #2b2f36, #14171c) border-box", border:"1px solid transparent", borderRadius:14, padding:16, margin:"12px 0" }}>{children}</section>
);
const SectionTitle = ({ children }) => (<div style={{ fontWeight:700, color:"#D8D6CB", marginBottom:6 }}>{children}</div>);
const inp = { background:"linear-gradient(180deg, #191c22, #12151a)", border:"1px solid #2b2f36", color:"#E9E9EC", padding:"10px 12px", borderRadius:10 };
const btn = { background:"linear-gradient(180deg, #2a60ff, #234ad3)", border:"1px solid transparent", color:"#fff", fontWeight:700, padding:"10px 16px", borderRadius:10, cursor:"pointer" };
const table = { width:"100%", marginTop:8, borderCollapse:"collapse" };
const th = { textAlign:"left", fontWeight:700, color:"#C8CDD7", padding:"8px" };
const td = { color:"#E9E9EC", padding:"8px" };