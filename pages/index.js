// pages/index.js
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot
} from "recharts";

const fmtTime = (s) => {
  if (s == null) return "-";
  const sec = Number(s);
  if (Number.isNaN(sec)) return "-";
  const m = Math.floor(sec / 60);
  const r = sec - m * 60;
  return m ? `${m}:${r.toFixed(2).padStart(5, "0")}` : r.toFixed(2);
};

export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_URL || "";

  // 查詢條件
  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("50公尺蛙式");

  // 後端回傳
  const [summary, setSummary] = useState(null);        // /summary
  const [rank, setRank] = useState(null);              // /rank
  const [top1Trend, setTop1Trend] = useState(null);    // top1 對手的 trend.points
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 觸發查詢
  async function search() {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true);
    setErr("");
    setTop1Trend(null);

    try {
      // 1) 你的 summary
      {
        const url = `${api}/api/summary?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&limit=500&cursor=0`;
        const r = await fetch(url);
        if (!r.ok) throw new Error("results 取得失敗");
        const j = await r.json();
        setSummary(j || null);
      }

      // 2) 排行（抓 top1 與你的名次）
      {
        const url = `${api}/api/rank?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}`;
        const r = await fetch(url);
        if (r.ok) {
          const j = await r.json();
          setRank(j || null);

          // 3) 取 Top1 對手的 summary → 趨勢線
          const top1Name = j?.top?.[0]?.name;
          if (top1Name) {
            const url2 = `${api}/api/summary?name=${encodeURIComponent(top1Name)}&stroke=${encodeURIComponent(stroke)}&limit=500&cursor=0`;
            const r2 = await fetch(url2);
            if (r2.ok) {
              const j2 = await r2.json();
              setTop1Trend(j2?.trend?.points || null);
            }
          }
        }
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // 你的 PB 點位（用 summary 直接算）
  const myPB = useMemo(() => {
    const pts = summary?.trend?.points || [];
    if (!pts.length) return null;
    let best = null;
    for (const p of pts) {
      if (p.seconds > 0 && (best == null || p.seconds < best.seconds)) best = p;
    }
    return best; // { year, seconds }
  }, [summary]);

  // X 軸刻度間距（簡化標籤）
  const xInterval = useMemo(() => {
    const n = summary?.trend?.points?.length || 0;
    if (n <= 8) return 0;                 // 少量資料全部顯示
    return Math.ceil(n / 8);              // 盡量壓到 ~8 個刻度
  }, [summary]);

  // Rank 顯示資料（前 10 + 你自己不在前 10 時追加）
  const rankRows = useMemo(() => {
    const top = rank?.top || [];
    const you = rank?.you;
    const rows = top.slice(0, 10).map((r, i) => ({
      rank: r.rank ?? i + 1,
      name: r.name,
      pb: r.pb_seconds ?? r.pb,
      year: r.pb_year,
      meet: r.pb_meet,
      isYou: r.name === name,
    }));
    if (you && !rows.find((r) => r.name === name)) {
      rows.push({
        rank: you.rank,
        name: you.name,
        pb: you.pb_seconds ?? you.pb,
        year: you.pb_year,
        meet: you.pb_meet,
        isYou: true,
      });
    }
    return rows;
  }, [rank, name]);

  // 初次載入給個預設查詢
  useEffect(() => {
    // 自動先查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <button onClick={search} disabled={loading} style={btn}>查詢</button>
        </div>

        {err && <div style={{ color:"#ffb3b3", marginBottom:8 }}>查詢失敗：{err}</div>}

        {/* 成績與專項分析（當前條件） */}
        <Card>
          <SectionTitle>成績與專項分析（當前條件）</SectionTitle>
          <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
            <KV label="出賽次數" value={`${summary?.analysis?.meetCount ?? 0} 場`} />
            <KV label="平均成績" value={fmtTime(summary?.analysis?.avg_seconds)} />
            <KV label="最佳成績" value={fmtTime(summary?.analysis?.pb_seconds)} />
          </div>
        </Card>

        {/* 四式專項統計（不分距離） */}
        <Card>
          <SectionTitle>四式專項統計（不分距離）</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {["蛙式","仰式","自由式","蝶式"].map((s)=> {
              const v = summary?.family?.[s] || {};
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

        {/* 排行卡片 */}
        <Card>
          <SectionTitle>排行</SectionTitle>
          <div style={{ marginBottom: 10, color:"#AEB4BF" }}>
            分母：{rank?.denominator ?? "-"}　
            你的名次：{rank?.rank ?? "-"}　
            百分位：{rank?.percentile != null ? `${rank.percentile.toFixed(1)}%` : "-"}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr><th style={th}>名次</th><th style={th}>選手</th><th style={th}>PB</th><th style={th}>年份</th><th style={th}>賽事</th></tr>
              </thead>
              <tbody>
                {rankRows.map((r, i) => (
                  <tr key={`${r.name}-${i}`} style={r.isYou ? { outline: "2px solid #E06C75", outlineOffset: -2 } : undefined}>
                    <td style={td}>{r.rank}</td>
                    <td style={{...td, color: r.isYou ? "#FF7B7B" : "#E9E9EC", fontWeight: r.isYou ? 800 : 600}}>{r.name}</td>
                    <td style={td}>{fmtTime(r.pb)}</td>
                    <td style={td}>{r.year ?? "-"}</td>
                    <td style={td}>{r.meet ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 成績趨勢（加入 Top1 對手曲線、X 軸簡化、PB 紅點） */}
        <Card>
          <SectionTitle>成績趨勢</SectionTitle>
          <div style={{ height: 360, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary?.trend?.points || []} margin={{ top: 10, right: 16, bottom: 6, left: 0 }}>
                <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#AEB4BF", fontSize: 12 }}
                  axisLine={{ stroke: "#3a3f48" }}
                  tickLine={{ stroke: "#3a3f48" }}
                  interval={xInterval}
                />
                <YAxis
                  tickFormatter={(v)=>Number(v).toFixed(2)}
                  tick={{ fill: "#AEB4BF", fontSize: 12 }}
                  axisLine={{ stroke: "#3a3f48" }}
                  tickLine={{ stroke: "#3a3f48" }}
                  width={56}
                  label={{ value: "秒數", angle: -90, position: "insideLeft", fill: "#AEB4BF" }}
                />
                <Tooltip
                  contentStyle={{ background:"#15181e", border:"1px solid #2e333b", color:"#E9E9EC" }}
                  formatter={(v)=>[fmtTime(v),"成績"]}
                  labelFormatter={(l,p)=>`${p?.[0]?.payload?.year}`}
                />

                {/* 你的曲線 */}
                <Line type="monotone" dataKey="seconds" stroke="#80A7FF" strokeWidth={2}
                      dot={{ r: 3, stroke: "#0a0c10", strokeWidth: 1 }} activeDot={{ r: 5 }} />

                {/* PB 紅點 */}
                {myPB && (
                  <ReferenceDot
                    x={myPB.year}
                    y={myPB.seconds}
                    r={5}
                    fill="#FF6B6B"
                    stroke="#0a0c10"
                    strokeWidth={1}
                    isFront
                    label={{ value:`PB ${fmtTime(myPB.seconds)}`, position:"right", fill:"#FFC7C7", fontSize:12 }}
                  />
                )}

                {/* 對手 Top1 曲線（橘色） */}
                {Array.isArray(top1Trend) && top1Trend.length > 0 && (
                  <Line
                    type="monotone"
                    data={top1Trend}
                    dataKey="seconds"
                    name={rank?.top?.[0]?.name || "Top1"}
                    stroke="#FFAA33"
                    strokeWidth={2}
                    dot={false}
                    legendType="circle"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 詳細成績（你的 PB 秒數標紅） */}
        <Card>
          <SectionTitle>詳細成績</SectionTitle>
          <table style={table}>
            <thead>
              <tr><th style={th}>年份</th><th style={th}>賽事</th><th style={th}>秒數</th></tr>
            </thead>
            <tbody>
              {(summary?.items || []).slice().sort((a,b)=>b["年份"]-a["年份"]).map((r,i)=>{
                const isPB = summary?.analysis?.pb_seconds != null && r.seconds === summary.analysis.pb_seconds;
                return (
                  <tr key={i}>
                    <td style={td}>{r["年份"]}</td>
                    <td style={td}>{r["賽事名稱"]}</td>
                    <td style={{...td, color: isPB ? "#FF7B7B" : "#E9E9EC", fontWeight: isPB ? 800 : 600}}>
                      {fmtTime(r.seconds)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </main>
  );
}

/* --- 小元件與樣式 --- */
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