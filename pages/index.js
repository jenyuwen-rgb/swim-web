// pages/index.js
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
  const [famStats, setFamStats] = useState(null); // 直接吃 /stats/family
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function search(cursor = 0) {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true);
    setErr("");

    try {
      // 1) 目前條件（含距離）
      const url = `${api}/api/results?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&limit=200&cursor=${cursor}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("results 取得失敗");
      const j = await r.json();
      const newItems = j.items || [];
      setItems(cursor === 0 ? newItems : [...items, ...newItems]);
      setNext(j.nextCursor ?? null);

      // 2) 四式專項統計（不分距離）
      const sUrl = `${api}/api/stats/family?name=${encodeURIComponent(name)}`;
      const sr = await fetch(sUrl);
      if (!sr.ok) throw new Error("stats/family 取得失敗");
      const sj = await sr.json();
      setFamStats(sj || {});
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const analysis = useMemo(() => {
    if (!items.length) return { meetCount: 0, avg: 0, best: 0 };
    const secs = items.map((x) => x.seconds).filter((s) => typeof s === "number" && s > 0);
    const avg = secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : 0;
    const best = secs.length ? Math.min(...secs) : 0;
    return { meetCount: items.length, avg, best };
  }, [items]);

  const trend = useMemo(() => {
    if (!items.length) return { data: [], pb: null };
    const data = items
      .filter((x) => x.seconds > 0 && x["年份"])
      .map((x) => ({ x: x["年份"], label: xLabel(x["年份"]), y: x.seconds, d: parseYYYYMMDD(x["年份"]) }))
      .sort((a, b) => a.d - b.d);
    let pb = null;
    for (const p of data) if (!pb || p.y < pb.y) pb = p;
    return { data, pb };
  }, [items]);

  const simplifyMeet = (s) => {
    if (!s) return s;
    let result = String(s);
    result = result.replace(/^\d{4}\s*/, "");
    result = result.replace(/^\d{3}\s*/, "");
    result = result.replace(/^.*?年/, "");
    const map = [
      ["臺中市114年市長盃水上運動競賽(游泳項目)", "台中市長盃"],
      ["全國冬季短水道游泳錦標賽", "全國冬短"],
      ["全國總統盃暨美津濃游泳錦標賽", "全國總統盃"],
      ["全國總統盃暨美津濃分齡游泳錦標賽", "全國總統盃"],
      ["冬季短水道", "冬短"],
      ["全國運動會臺南市游泳代表隊選拔賽", "台南全運會選拔"],
      ["全國青少年游泳錦標賽", "全國青少年"],
      ["臺中市議長盃", "台中議長盃"],
      ["臺中市市長盃", "台中市長盃"],
      ["(游泳項目)", ""],
      ["春季游泳錦標賽", "春長"],
      ["全國E世代青少年", "E世代"],
      ["臺南市市長盃短水道", "台南市長盃"],
      ["臺南市中小學", "台南中小學"],
      ["臺南市委員盃", "台南委員盃"],
      ["臺南市全國運動會游泳選拔賽", "台南全運會選拔"],
      ["游泳錦標賽", ""],
    ];
    for (const [from, to] of map) result = result.replaceAll(from, to);
    return result.trim().replace(/\s{2,}/g, " ");
  };

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 20% -10%, #1f232b 0%, #0f1216 60%, #0a0c10 100%)", color: "#E9E9EC", padding: "24px 16px 80px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, color: "#E9DDBB", textShadow: "0 1px 0 #2a2e35", marginBottom: 12 }}>游泳成績查詢</h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 8, marginBottom: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" style={inp} />
          <select value={stroke} onChange={(e) => setStroke(e.target.value)} style={inp}>
            {["50公尺自由式","50公尺蛙式","50公尺仰式","50公尺蝶式","100公尺自由式","100公尺蛙式","100公尺仰式","100公尺蝶式","200公尺自由式","200公尺蛙式","200公尺仰式","200公尺蝶式","200公尺混合式"].map(x=>(
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <button onClick={() => search(0)} disabled={loading} style={btn}>查詢</button>
        </div>

        {err && <div style={{ color:"#ffb3b3", marginBottom:8 }}>查詢失敗：{err}</div>}

        <Card>
          <SectionTitle>成績與專項分析（當前條件）</SectionTitle>
          <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
            <KV label="出賽次數" value={`${analysis.meetCount} 場`} />
            <KV label="平均成績" value={fmtTime(analysis.avg)} />
            <KV label="最佳成績" value={fmtTime(analysis.best)} />
          </div>
        </Card>

        <Card>
          <SectionTitle>四式專項統計（不分距離）</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {["蛙式","仰式","自由式","蝶式"].map((s)=> {
              const v = famStats?.[s] || {};
              return (
                <MiniCard key={s}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{s}</div>
                  <KV label="出賽" value={`${v.count ?? 0} 場`} small />
                  <KV label="最多距離" value={v.mostDist ? `${v.mostDist}${v.mostCount?`（${v.mostCount}場）`:""}` : "-"} small />
                  <KV label="PB" value={fmtTime(v.pb_seconds)} small />
                </MiniCard>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle>成績趨勢</SectionTitle>
          <div style={{ height: 340, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={useMemo(()=>items
                .filter((x)=>x.seconds>0 && x["年份"])
                .map((x)=>({ x:x["年份"], label:xLabel(x["年份"]), y:x.seconds, d:parseYYYYMMDD(x["年份"]) }))
                .sort((a,b)=>a.d-b.d), [items])}
              margin={{ top: 10, right: 16, bottom: 6, left: 0 }}>
                <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "#AEB4BF", fontSize: 12 }} axisLine={{ stroke: "#3a3f48" }} tickLine={{ stroke: "#3a3f48" }} />
                <YAxis tickFormatter={(v)=>v.toFixed(2)} domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: "#AEB4BF", fontSize: 12 }} axisLine={{ stroke: "#3a3f48" }} tickLine={{ stroke: "#3a3f48" }} width={56} label={{ value: "秒數", angle: -90, position: "insideLeft", fill: "#AEB4BF" }} />
                <Tooltip contentStyle={{ background:"#15181e", border:"1px solid #2e333b", color:"#E9E9EC" }} formatter={(v)=>[fmtTime(v),"成績"]} labelFormatter={(l,p)=>`${p?.[0]?.payload?.x}`} />
                <Line type="monotone" dataKey="y" stroke="#80A7FF" strokeWidth={2} dot={{ r: 3, stroke: "#0a0c10", strokeWidth: 1 }} activeDot={{ r: 5 }} />
                {(() => {
                  const data = items
                    .filter((x)=>x.seconds>0 && x["年份"])
                    .map((x)=>({ label:xLabel(x["年份"]), y:x.seconds }));
                  if (!data.length) return null;
                  let pb = data[0];
                  for (const d of data) if (d.y < pb.y) pb = d;
                  return <ReferenceDot x={pb.label} y={pb.y} r={5} fill="#FF6B6B" stroke="#0a0c10" strokeWidth={1} isFront label={{ value:`PB ${fmtTime(pb.y)}`, position:"right", fill:"#FFC7C7", fontSize:12 }} />;
                })()}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle>詳細成績</SectionTitle>
          <table style={table}>
            <thead>
              <tr><th style={th}>年份</th><th style={th}>賽事</th><th style={th}>秒數</th></tr>
            </thead>
            <tbody>
              {items.slice().sort((a,b)=>b["年份"]-a["年份"]).map((r,i)=>(
                <tr key={i}>
                  <td style={td}>{r["年份"]}</td>
                  <td style={td}>{simplifyMeet(r["賽事名稱"])}</td>
                  <td style={td}>{fmtTime(r.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {next != null && (
            <button onClick={() => search(next)} disabled={loading} style={{ ...btn, marginTop: 12 }}>
              載入更多
            </button>
          )}
        </Card>
      </div>
    </main>
  );
}

const Card = ({ children }) => (
  <section style={{
    background: "linear-gradient(180deg, rgba(31,35,43,.9), rgba(19,22,27,.98)) padding-box, linear-gradient(180deg, #2b2f36, #14171c) border-box",
    border: "1px solid transparent", borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.02)",
    padding: 16, margin: "12px 0",
  }}>{children}</section>
);
const MiniCard = ({ children }) => (
  <div style={{
    background:"linear-gradient(180deg, rgba(32,36,44,.85), rgba(18,21,26,.95)) padding-box, linear-gradient(180deg, #313641, #161a20) border-box",
    border:"1px solid transparent", borderRadius:12, boxShadow:"inset 0 1px 0 rgba(255,255,255,.03)", padding:12,
  }}>{children}</div>
);
const SectionTitle = ({ children }) => (
  <div style={{ fontWeight:700, letterSpacing:.5, color:"#D8D6CB", marginBottom:6 }}>{children}</div>
);
const KV = ({ label, value, small }) => (
  <div style={{ marginRight: 24 }}>
    <div style={{ fontSize: small ? 12 : 13, color: "#AEB4BF" }}>{label}</div>
    <div style={{ fontSize: small ? 16 : 20, fontWeight: 700, color: "#EDEBE3", textShadow: "0 1px 0 rgba(0,0,0,.6)" }}>{value ?? "-"}</div>
  </div>
);
const inp = { background:"linear-gradient(180deg, #191c22, #12151a)", border:"1px solid #2b2f36", color:"#E9E9EC", padding:"10px 12px", borderRadius:10, outline:"none" };
const btn = { background:"linear-gradient(180deg, #2a60ff, #234ad3) padding-box, linear-gradient(180deg, #5b7cff, #1a2a6e) border-box", border:"1px solid transparent", color:"#fff", fontWeight:700, padding:"10px 16px", borderRadius:10, boxShadow:"0 6px 14px rgba(50,90,255,.35)", cursor:"pointer" };
const table = { width:"100%", marginTop:8, borderCollapse:"separate", borderSpacing:0, background:"linear-gradient(180deg, rgba(26,29,35,.85), rgba(14,16,20,.95)) padding-box, linear-gradient(180deg, #2b2f36, #171a1f) border-box", border:"1px solid transparent", borderRadius:12, overflow:"hidden" };
const th = { textAlign:"left", fontWeight:700, color:"#C8CDD7", padding:"10px 12px", borderBottom:"1px solid #2c3037", background:"rgba(255,255,255,.02)" };
const td = { color:"#E9E9EC", padding:"10px 12px", borderBottom:"1px solid #232830" };