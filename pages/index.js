// pages/index.js
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceDot
} from "recharts";

/* ---------- helpers ---------- */
const fmtTime = (s) => {
  if (s == null) return "-";
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
const ymdLabel = (v) => {
  const s = String(v || "");
  return `${s.slice(0,4)}${s.slice(4,6)}${s.slice(6,8)}`;
};

/* ---------- UI atoms ---------- */
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

/* ---------- page ---------- */
export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_URL || "";

  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("50公尺蛙式");

  const [items, setItems] = useState([]);
  const [analysis, setAnalysis] = useState({ meetCount: 0, avg_seconds: null, pb_seconds: null });
  const [famStats, setFamStats] = useState(null);
  const [leaderTrend, setLeaderTrend] = useState(null); // [{year, seconds}]
  const [rankBox, setRankBox] = useState(null);         // /api/rank 全包
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function search(cursor = 0) {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true);
    setErr("");
    try {
      // 1) summary：明細 / 分析 / 四式（後端已做冬短剔除）
      const sUrl = `${api}/api/summary?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&limit=200&cursor=${cursor}`;
      const sr = await fetch(sUrl);
      if (!sr.ok) throw new Error("results 取得失敗");
      const sj = await sr.json();

      setItems(cursor === 0 ? (sj.items || []) : [...items, ...(sj.items || [])]);
      setNext(sj.nextCursor ?? null);
      setAnalysis(sj.analysis || {});
      setFamStats(sj.family || {});

      // 2) rank：拿到 leader 趨勢給成績趨勢圖用
      const rUrl = `${api}/api/rank?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}`;
      const rr = await fetch(rUrl);
      if (rr.ok) {
        const rj = await rr.json();
        setRankBox(rj);
        setLeaderTrend(rj?.leader?.trend || null);
      } else {
        setRankBox(null);
        setLeaderTrend(null);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  /* ---------- 成績趨勢資料（自己＋榜首對齊後合併） ---------- */
  const trendMerged = useMemo(() => {
    const selfPts = (items || [])
      .filter((x) => x.seconds > 0 && x["年份"])
      .map((x) => ({ year: ymdLabel(x["年份"]), d: parseYYYYMMDD(x["年份"]), self: x.seconds }))
      .sort((a, b) => a.d - b.d);

    const leaderPts = (leaderTrend || [])
      .filter((p) => p?.seconds > 0 && p?.year)
      .map((p) => ({ year: ymdLabel(p.year), d: parseYYYYMMDD(p.year), leader: p.seconds }))
      .sort((a, b) => a.d - b.d);

    // union by year
    const map = new Map();
    for (const p of selfPts) map.set(p.year, { year: p.year, d: p.d, self: p.self });
    for (const p of leaderPts) map.set(p.year, { ...(map.get(p.year) || { year: p.year, d: p.d }), leader: p.leader });
    const arr = Array.from(map.values()).sort((a, b) => a.d - b.d);
    // 製作美觀用 label（降密度）
    const interval = Math.max(0, Math.floor(arr.length / 10));
    return arr.map((p, idx) => ({ ...p, label: idx % (interval || 1) === 0 ? `${p.year.slice(2,4)}/${p.year.slice(4,6)}` : "" }));
  }, [items, leaderTrend]);

  /* ---------- PB 紅點 ---------- */
  const pbPoint = useMemo(() => {
    const data = (items || [])
      .filter((x) => x.seconds > 0 && x["年份"])
      .map((x) => ({ year: ymdLabel(x["年份"]), y: x.seconds }));
    if (!data.length) return null;
    let pb = data[0];
    for (const p of data) if (p.y < pb.y) pb = p;
    // 對應 merged label
    const found = trendMerged.find((t) => t.year === pb.year);
    return found ? { x: found.label || `${found.year.slice(2,4)}/${found.year.slice(4,6)}`, y: pb.y } : null;
  }, [items, trendMerged]);

  /* ---------- 排行表格資料 ---------- */
  const topRows = useMemo(() => {
    const top = rankBox?.top || [];
    // 若本人不在 Top10，額外加一列在最後
    const myRank = rankBox?.rank;
    const meInTop = top.some((r) => r.name === name);
    const rows = [...top];
    if (myRank && !meInTop) {
      rows.push({ name, pb_seconds: rankBox?.you?.pb_seconds ?? null, pb_year: null, pb_meet: null, rank: myRank, _isMe: true });
    }
    return rows.map((r) => ({ ...r, _isMe: r.name === name || r._isMe }));
  }, [rankBox, name]);

  useEffect(() => {
    // 首次自動查一次
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
          <button onClick={() => search(0)} disabled={loading} style={btn}>查詢</button>
        </div>

        {err && <div style={{ color:"#ffb3b3", marginBottom:8 }}>查詢失敗：{err}</div>}

        {/* 成績與專項分析 */}
        <Card>
          <SectionTitle>成績與專項分析（當前條件）</SectionTitle>
          <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
            <KV label="出賽次數" value={`${analysis.meetCount ?? 0} 場`} />
            <KV label="平均成績" value={fmtTime(analysis.avg_seconds)} />
            <KV label="最佳成績" value={fmtTime(analysis.pb_seconds)} />
          </div>
        </Card>

        {/* 四式專項統計 */}
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

        {/* 排行 */}
        <Card>
          <SectionTitle>排行</SectionTitle>
          <div style={{ color:"#AEB4BF", marginBottom:8 }}>
            分母：<span style={{ color:"#EDEBE3" }}>{rankBox?.denominator ?? "-"}</span>
            &nbsp;&nbsp;你的名次：<span style={{ color:"#FFD36B", fontWeight:700 }}>{rankBox?.rank ?? "-"}</span>
            &nbsp;&nbsp;百分位：<span style={{ color:"#EDEBE3" }}>{rankBox?.percentile ? `${rankBox.percentile.toFixed(1)}%` : "-"}</span>
          </div>
          <table style={table}>
            <thead>
              <tr><th style={th}>名次</th><th style={th}>選手</th><th style={th}>PB</th><th style={th}>年份</th><th style={th}>賽事</th></tr>
            </thead>
            <tbody>
              {(topRows || []).map((r, i) => {
                const style = r._isMe ? { ...td, color:"#FFB3B3", fontWeight:700 } : td;
                return (
                  <tr key={`${r.name}-${i}`}>
                    <td style={style}>{r.rank ?? (i+1)}</td>
                    <td style={style}>{r.name}</td>
                    <td style={style}>{fmtTime(r.pb_seconds)}</td>
                    <td style={style}>{r.pb_year || "-"}</td>
                    <td style={style}>{r.pb_meet || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 成績趨勢（自己＋leader 橘線） */}
        <Card>
          <SectionTitle>成績趨勢</SectionTitle>
          <div style={{ height: 360, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendMerged}
                margin={{ top: 10, right: 16, bottom: 6, left: 0 }}
              >
                <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  interval={Math.max(0, Math.floor((trendMerged?.length || 0) / 10))}
                  tick={{ fill: "#AEB4BF", fontSize: 12 }}
                  axisLine={{ stroke: "#3a3f48" }}
                  tickLine={{ stroke: "#3a3f48" }}
                />
                <YAxis
                  tickFormatter={(v)=>v.toFixed(2)}
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fill: "#AEB4BF", fontSize: 12 }}
                  axisLine={{ stroke: "#3a3f48" }}
                  tickLine={{ stroke: "#3a3f48" }}
                  width={56}
                  label={{ value: "秒數", angle: -90, position: "insideLeft", fill: "#AEB4BF" }}
                />
                <Tooltip
                  contentStyle={{ background:"#15181e", border:"1px solid #2e333b", color:"#E9E9EC" }}
                  formatter={(v, n) => [fmtTime(v), n === "self" ? "成績" : "榜首"]}
                  labelFormatter={(l, p) => {
                    const raw = p?.[0]?.payload?.year;
                    return raw ? raw : l;
                  }}
                />
                {/* 自己（藍） */}
                <Line type="monotone" dataKey="self" name="self"
                  stroke="#80A7FF" strokeWidth={2}
                  dot={{ r: 3, stroke: "#0a0c10", strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                {/* 榜首（橘） */}
                <Line type="monotone" dataKey="leader" name="leader"
                  stroke="#F6A31A" strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                {/* PB 紅點 */}
                {pbPoint && (
                  <ReferenceDot x={pbPoint.x} y={pbPoint.y} r={5} fill="#FF6B6B" stroke="#0a0c10" strokeWidth={1}
                    isFront label={{ value:`PB ${fmtTime(pbPoint.y)}`, position:"right", fill:"#FFC7C7", fontSize:12 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 詳細成績（原始賽事名稱） */}
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
                  <td style={td}>{r["賽事名稱"]}</td>
                  <td style={{ ...td, color: (analysis?.pb_seconds && r.seconds === analysis.pb_seconds) ? "#FF6B6B" : "#E9E9EC" }}>
                    {fmtTime(r.seconds)}
                  </td>
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