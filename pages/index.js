// pages/index.js
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Legend
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

  const [summary, setSummary] = useState(null);
  const [rank, setRank] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true);
    setErr("");
    try {
      const url = `${api}/api/summary?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("summary 取得失敗");
      const j = await r.json();
      setSummary(j);

      const r2 = await fetch(`${api}/api/rank?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}`);
      if (!r2.ok) throw new Error("rank 取得失敗");
      const j2 = await r2.json();
      setRank(j2);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // 趨勢資料
  const trendData = useMemo(() => {
    if (!summary?.trend?.points) return [];
    return summary.trend.points
      .map((x) => ({ x: x.year, label: xLabel(x.year), y: x.seconds, d: parseYYYYMMDD(x.year) }))
      .sort((a, b) => a.d - b.d);
  }, [summary]);

  const leaderTrend = useMemo(() => {
    if (!rank?.leaderTrend) return [];
    return rank.leaderTrend
      .map((x) => ({ x: x.year, label: xLabel(x.year), y: x.seconds, d: parseYYYYMMDD(x.year) }))
      .sort((a, b) => a.d - b.d);
  }, [rank]);

  // 找 PB
  const pb = useMemo(() => {
    if (!summary?.analysis?.pb_seconds) return null;
    let best = null;
    for (const p of trendData) {
      if (!best || p.y < best.y) best = p;
    }
    return best;
  }, [trendData, summary]);

  return (
    <main style={{ minHeight: "100vh", background: "#0f1216", color: "#E9E9EC", padding: "24px 16px 80px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#E9DDBB", marginBottom: 12 }}>游泳成績查詢</h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 8, marginBottom: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" style={inp} />
          <select value={stroke} onChange={(e) => setStroke(e.target.value)} style={inp}>
            {["50公尺自由式","50公尺蛙式","50公尺仰式","50公尺蝶式",
              "100公尺自由式","100公尺蛙式","100公尺仰式","100公尺蝶式",
              "200公尺自由式","200公尺蛙式","200公尺仰式","200公尺蝶式","200公尺混合式"].map(x=>(
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <button onClick={() => search()} disabled={loading} style={btn}>查詢</button>
        </div>

        {err && <div style={{ color:"#ffb3b3" }}>查詢失敗：{err}</div>}

        {/* 成績分析 */}
        {summary && (
          <Card>
            <SectionTitle>成績與專項分析</SectionTitle>
            <div style={{ display: "flex", gap: 32 }}>
              <KV label="出賽次數" value={`${summary.analysis.meetCount} 場`} />
              <KV label="平均成績" value={fmtTime(summary.analysis.avg_seconds)} />
              <KV label="最佳成績" value={fmtTime(summary.analysis.pb_seconds)} />
            </div>
          </Card>
        )}

        {/* 四式專項 */}
        {summary && (
          <Card>
            <SectionTitle>四式專項統計</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {["蛙式","仰式","自由式","蝶式"].map((s)=> {
                const v = summary.family?.[s] || {};
                return (
                  <MiniCard key={s}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{s}</div>
                    <KV label="出賽" value={`${v.count ?? 0} 場`} small />
                    <KV label="最多距離" value={v.mostDist ? `${v.mostDist}（${v.mostCount}場）` : "-"} small />
                    <KV label="PB" value={fmtTime(v.pb_seconds)} small />
                  </MiniCard>
                );
              })}
            </div>
          </Card>
        )}

        {/* 排行卡片 */}
        {rank && (
          <Card>
            <SectionTitle>排行</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
              {(rank.top || []).map((r,i)=>(
                <MiniCard key={i} style={{ background: r.name===name ? "#402" : undefined }}>
                  <div style={{ fontWeight: 700, color: r.name===name ? "#ff6b6b":"#fff" }}>{r.rank}. {r.name}</div>
                  <KV label="PB" value={fmtTime(r.pb)} small />
                  <KV label="年份" value={r.pb_year} small />
                  <KV label="賽事" value={r.pb_meet} small />
                </MiniCard>
              ))}
              {rank.you && !rank.top?.some(x=>x.name===name) && (
                <MiniCard style={{ background:"#402" }}>
                  <div style={{ fontWeight: 700, color:"#ff6b6b" }}>{rank.you.rank}. {rank.you.name}</div>
                  <KV label="PB" value={fmtTime(rank.you.pb_seconds)} small />
                </MiniCard>
              )}
            </div>
          </Card>
        )}

        {/* 成績趨勢 */}
        {summary && (
          <Card>
            <SectionTitle>成績趨勢</SectionTitle>
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 10, right: 16, bottom: 6, left: 0 }}>
                  <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3" />
                  <XAxis dataKey="label" type="category"
                    allowDuplicatedCategory={false}
                    tick={{ fill: "#AEB4BF", fontSize: 12 }} />
                  <YAxis tickFormatter={(v)=>v.toFixed(2)} tick={{ fill: "#AEB4BF", fontSize: 12 }} />
                  <Tooltip formatter={(v)=>[fmtTime(v),"成績"]} />
                  <Legend />
                  <Line data={trendData} dataKey="y" name={name}
                    stroke="#4A90E2" strokeWidth={2}
                    dot={{ r: 4, fill:"#fff", stroke:"#4A90E2", strokeWidth:2 }} />
                  <Line data={leaderTrend} dataKey="y" name="榜首"
                    stroke="#4CAF50" strokeWidth={2}
                    dot={{ r: 5, fill:"#4CAF50", stroke:"#0a0c10", strokeWidth:1, shape:"triangle" }} />
                  {pb && (
                    <ReferenceDot x={pb.label} y={pb.y} r={6} fill="#FF6B6B"
                      stroke="#0a0c10" label={{ value:`PB ${fmtTime(pb.y)}`, position:"right", fill:"#FF6B6B", fontSize:12 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* 詳細成績 */}
        {summary && (
          <Card>
            <SectionTitle>詳細成績</SectionTitle>
            <table style={table}>
              <thead><tr><th style={th}>年份</th><th style={th}>賽事</th><th style={th}>秒數</th><th style={th}>名次</th></tr></thead>
              <tbody>
                {summary.items.slice().sort((a,b)=>b["年份"]-a["年份"]).map((r,i)=>(
                  <tr key={i}>
                    <td style={td}>{r["年份"]}</td>
                    <td style={td}>{r["賽事名稱"]}</td>
                    <td style={{...td, color:(pb && r.seconds===pb.y)?"#ff6b6b":"#E9E9EC"}}>{fmtTime(r.seconds)}</td>
                    <td style={td}>{r["名次"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </main>
  );
}

const Card = ({ children }) => (
  <section style={{ background:"#191c22", borderRadius:14, padding:16, margin:"12px 0" }}>{children}</section>
);
const MiniCard = ({ children, style }) => (
  <div style={{ background:"#222", borderRadius:12, padding:12, ...style }}>{children}</div>
);
const SectionTitle = ({ children }) => (
  <div style={{ fontWeight:700, marginBottom:6 }}>{children}</div>
);
const KV = ({ label, value, small }) => (
  <div style={{ marginRight: 24 }}>
    <div style={{ fontSize: small?12:13, color:"#AEB4BF" }}>{label}</div>
    <div style={{ fontSize: small?16:20, fontWeight:700, color:"#EDEBE3" }}>{value ?? "-"}</div>
  </div>
);
const inp = { background:"#191c22", border:"1px solid #2b2f36", color:"#E9E9EC", padding:"10px 12px", borderRadius:10 };
const btn = { background:"#2a60ff", color:"#fff", fontWeight:700, padding:"10px 16px", borderRadius:10, cursor:"pointer" };
const table = { width:"100%", marginTop:8, borderCollapse:"collapse" };
const th = { textAlign:"left", fontWeight:700, color:"#C8CDD7", padding:"10px 12px", borderBottom:"1px solid #2c3037" };
const td = { color:"#E9E9EC", padding:"10px 12px", borderBottom:"1px solid #232830" };