// pages/index.js
import { useMemo, useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot
} from "recharts";

// ------- helpers -------
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
  const y = +s.slice(0,4), m = +s.slice(4,6)-1, d = +s.slice(6,8);
  return new Date(y, m, d);
};
const xLabel = (v) => {
  const s = String(v || "");
  return `${s.slice(2,4)}/${s.slice(4,6)}`;
};
const api = process.env.NEXT_PUBLIC_API_URL || "";

// 綠色三角形點
const TriDot = (props) => {
  const { cx, cy } = props;
  const size = 6;
  return (
    <path d={`M ${cx} ${cy-size} L ${cx-size} ${cy+size} L ${cx+size} ${cy+size} Z`}
      fill="#35D07F" stroke="#0a0c10" strokeWidth={1}/>
  );
};

export default function Home(){
  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("50公尺蛙式");

  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [famStats, setFamStats] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [trend, setTrend] = useState([]);          // 自己
  const [leaderTrend, setLeaderTrend] = useState([]); // 榜首
  const [rankInfo, setRankInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function search(cursor=0){
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true); setErr("");

    try{
      // 統一吃 summary
      const u = `${api}/api/summary?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&limit=500&cursor=${cursor}`;
      const r = await fetch(u);
      if(!r.ok) throw new Error("summary 取得失敗");
      const j = await r.json();

      const newItems = j.items || [];
      setItems(cursor===0 ? newItems : [...items, ...newItems]);
      setNext(j.nextCursor ?? null);
      setAnalysis(j.analysis || {});
      setFamStats(j.family || {});

      // 趨勢兩條線：先以日期物件排序（保險）
      const me = (j.trend?.points||[])
        .filter(p=>p.seconds>0 && p.year)
        .map(p=>({ x:p.year, label:xLabel(p.year), y:p.seconds, d:parseYYYYMMDD(p.year) }))
        .sort((a,b)=>a.d-b.d);
      setTrend(me);

      const ld = (j.leaderTrend?.points||[])
        .filter(p=>p.seconds>0 && p.year)
        .map(p=>({ x:p.year, label:xLabel(p.year), y:p.seconds, d:parseYYYYMMDD(p.year) }))
        .sort((a,b)=>a.d-b.d);
      setLeaderTrend(ld);

      // 排行卡片
      const rr = await fetch(`${api}/api/rank?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}`);
      if(rr.ok){
        const rk = await rr.json();
        setRankInfo(rk || null);
      }else{
        setRankInfo(null);
      }

    }catch(e){
      setErr(String(e?.message || e));
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{ /* 首次自動載入 */ search(0); /* eslint-disable-next-line */ },[]);

  // PB點（自己）
  const pbPoint = useMemo(()=>{
    if(!trend.length) return null;
    let pb = trend[0];
    for(const p of trend) if(p.y < pb.y) pb = p;
    return pb;
  },[trend]);

  // 合併兩條線的 X 範圍（讓 X 軸刻度一致）
  const mergedX = useMemo(()=>{
    const set = new Map();
    for(const p of trend) set.set(p.x, {x:p.x, label:xLabel(p.x), d:parseYYYYMMDD(p.x)});
    for(const p of leaderTrend) if(!set.has(p.x)) set.set(p.x, {x:p.x, label:xLabel(p.x), d:parseYYYYMMDD(p.x)});
    return Array.from(set.values()).sort((a,b)=>a.d-b.d);
  },[trend, leaderTrend]);

  // 組合成 Recharts data，每筆包含 my/leader 的 y
  const chartData = useMemo(()=>{
    const byX = new Map(mergedX.map(e=>[e.x, {...e}]));
    for(const p of trend){
      const o = byX.get(p.x); o.my = p.y;
    }
    for(const p of leaderTrend){
      const o = byX.get(p.x); o.leader = p.y;
    }
    return Array.from(byX.values());
  },[mergedX, trend, leaderTrend]);

  const simplifyMeet = (s)=>s||"";

  return (
    <main style={{ minHeight:"100vh", background:"radial-gradient(1200px 600px at 20% -10%, #1f232b 0%, #0f1216 60%, #0a0c10 100%)", color:"#E9E9EC", padding:"24px 16px 80px" }}>
      <div style={{ maxWidth:1080, margin:"0 auto" }}>
        <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:2, color:"#E9DDBB", textShadow:"0 1px 0 #2a2e35", marginBottom:12 }}>游泳成績查詢</h1>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr auto", gap:8, marginBottom:12 }}>
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="姓名" style={inp}/>
          <select value={stroke} onChange={(e)=>setStroke(e.target.value)} style={inp}>
            {["50公尺自由式","50公尺蛙式","50公尺仰式","50公尺蝶式","100公尺自由式","100公尺蛙式","100公尺仰式","100公尺蝶式","200公尺自由式","200公尺蛙式","200公尺仰式","200公尺蝶式","200公尺混合式"].map(x=>
              <option key={x} value={x}>{x}</option>
            )}
          </select>
          <button onClick={()=>search(0)} disabled={loading} style={btn}>查詢</button>
        </div>

        {err && <div style={{ color:"#ffb3b3", marginBottom:8 }}>查詢失敗：{err}</div>}

        {/* 成績與專項分析 */}
        <Card>
          <SectionTitle>成績與專項分析（當前條件）</SectionTitle>
          <div style={{ display:"flex", gap:32, marginTop:8 }}>
            <KV label="出賽次數" value={`${analysis?.meetCount ?? 0} 場`}/>
            <KV label="平均成績" value={fmtTime(analysis?.avg_seconds)}/>
            <KV label="最佳成績" value={fmtTime(analysis?.pb_seconds)}/>
          </div>
        </Card>

        {/* 四式專項統計 */}
        <Card>
          <SectionTitle>四式專項統計（不分距離）</SectionTitle>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {["蛙式","仰式","自由式","蝶式"].map((s)=>{
              const v = famStats?.[s] || {};
              return (
                <MiniCard key={s}>
                  <div style={{ fontWeight:700, marginBottom:6 }}>{s}</div>
                  <KV label="出賽" value={`${v.count ?? 0} 場`} small/>
                  <KV label="最多距離" value={v.mostDist ? `${v.mostDist}${v.mostCount?`（${v.mostCount}場）`:""}` : "-"} small/>
                  <KV label="PB" value={fmtTime(v.pb_seconds)} small/>
                </MiniCard>
              );
            })}
          </div>
        </Card>

        {/* 排行卡片 */}
        <Card>
          <SectionTitle>排行</SectionTitle>
          <div style={{ color:"#AEB4BF", marginBottom:8 }}>
            分母：{rankInfo?.denominator ?? "-"}　你的名次：<span style={{ color:"#FFD166", fontWeight:700 }}>{rankInfo?.rank ?? "-"}</span>　
            百分位：{rankInfo?.percentile ? `${rankInfo.percentile.toFixed(1)}%` : "-"}
          </div>
          <table style={table}>
            <thead>
              <tr><th style={th}>名次</th><th style={th}>選手</th><th style={th}>PB</th><th style={th}>年份</th><th style={th}>賽事</th></tr>
            </thead>
            <tbody>
              {(rankInfo?.top || []).map((r,i)=>(
                <tr key={i}>
                  <td style={td}>{i+1}</td>
                  <td style={{...td, color: r.name===name ? "#FF6B6B":"#E9E9EC", fontWeight: r.name===name ? 800:500 }}>{r.name}</td>
                  <td style={td}>{fmtTime(r.pb_seconds)}</td>
                  <td style={td}>{r.pb_year || "-"}</td>
                  <td style={td}>{r.pb_meet || "-"}</td>
                </tr>
              ))}
              {/* 若不在前10，補一列自己的名次 */}
              {rankInfo?.you && (rankInfo.top||[]).every(t=>t.name!==name) && (
                <tr>
                  <td style={{...td, color:"#FFD166"}}>{rankInfo.you.rank}</td>
                  <td style={{...td, color:"#FF6B6B", fontWeight:800}}>{rankInfo.you.name}</td>
                  <td style={td}>{fmtTime(rankInfo.you.pb_seconds)}</td>
                  <td style={td}>{rankInfo.you.pb_year || "-"}</td>
                  <td style={td}>{rankInfo.you.pb_meet || "-"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* 成績趨勢（與榜首對照） */}
        <Card>
          <SectionTitle>成績趨勢（與榜首對照）</SectionTitle>
          <div style={{ height: 380, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top:10, right:16, bottom:6, left:0 }}>
                <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3"/>
                <XAxis dataKey="label" tick={{ fill:"#AEB4BF", fontSize:12 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}/>
                <YAxis tickFormatter={(v)=>v.toFixed(2)} domain={["auto", "auto"]}
                  tick={{ fill:"#AEB4BF", fontSize:12 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                  width={64} label={{ value:"秒數", angle:-90, position:"insideLeft", fill:"#AEB4BF" }}/>
                <Tooltip contentStyle={{ background:"#15181e", border:"1px solid #2e333b", color:"#E9E9EC" }}
                  formatter={(v, k, p)=>{
                    const d = p?.payload;
                    const parts = [];
                    if (typeof d?.leader === "number") parts.push(["榜首", fmtTime(d.leader)]);
                    if (typeof d?.my === "number") parts.push(["温心妤", fmtTime(d.my)]);
                    return parts;
                  }}
                  labelFormatter={(l, p)=>`${p?.[0]?.payload?.x}`}/>
                {/* 榜首：綠線 + 三角形點 */}
                <Line type="monotone" dataKey="leader" name="榜首"
                  stroke="#35D07F" strokeWidth={2}
                  dot={<TriDot/>} activeDot={<TriDot/>} connectNulls />
                {/* 自己：藍線 + 白圓點 */}
                <Line type="monotone" dataKey="my" name="温心妤"
                  stroke="#80A7FF" strokeWidth={2}
                  dot={{ r:3, stroke:"#0a0c10", strokeWidth:1, fill:"#ffffff" }}
                  activeDot={{ r:6 }} connectNulls />
                {/* PB 紅點（自己） */}
                {pbPoint && (
                  <ReferenceDot x={xLabel(pbPoint.x)} y={pbPoint.y} r={6}
                    fill="#FF6B6B" stroke="#0a0c10" strokeWidth={1}
                    isFront label={{ value:`PB ${fmtTime(pbPoint.y)}`, position:"right", fill:"#FFC7C7", fontSize:12 }}/>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 詳細成績 */}
        <Card>
          <SectionTitle>詳細成績</SectionTitle>
          <table style={table}>
            <thead>
              <tr><th style={th}>年份</th><th style={th}>賽事</th><th style={th}>秒數</th></tr>
            </thead>
            <tbody>
              {items.slice().sort((a,b)=>a["年份"].localeCompare(b["年份"])).map((r,i)=>(
                <tr key={i}>
                  <td style={td}>{r["年份"]}</td>
                  <td style={td}>{simplifyMeet(r["賽事名稱"])}</td>
                  <td style={td}>{fmtTime(r.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {next != null && (
            <button onClick={()=>search(next)} disabled={loading} style={{ ...btn, marginTop:12 }}>
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
    background:"linear-gradient(180deg, rgba(31,35,43,.9), rgba(19,22,27,.98)) padding-box, linear-gradient(180deg, #2b2f36, #14171c) border-box",
    border:"1px solid transparent", borderRadius:14, boxShadow:"0 10px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.02)",
    padding:16, margin:"12px 0"
  }}>{children}</section>
);
const MiniCard = ({ children }) => (
  <div style={{
    background:"linear-gradient(180deg, rgba(32,36,44,.85), rgba(18,21,26,.95)) padding-box, linear-gradient(180deg, #313641, #161a20) border-box",
    border:"1px solid transparent", borderRadius:12, boxShadow:"inset 0 1px 0 rgba(255,255,255,.03)", padding:12
  }}>{children}</div>
);
const SectionTitle = ({ children }) => (
  <div style={{ fontWeight:700, letterSpacing:.5, color:"#D8D6CB", marginBottom:6 }}>{children}</div>
);
const KV = ({ label, value, small }) => (
  <div style={{ marginRight:24 }}>
    <div style={{ fontSize: small ? 12 : 13, color:"#AEB4BF" }}>{label}</div>
    <div style={{ fontSize: small ? 16 : 20, fontWeight:700, color:"#EDEBE3", textShadow:"0 1px 0 rgba(0,0,0,.6)" }}>{value ?? "-"}</div>
  </div>
);
const inp = { background:"linear-gradient(180deg, #191c22, #12151a)", border:"1px solid #2b2f36", color:"#E9E9EC", padding:"10px 12px", borderRadius:10, outline:"none" };
const btn = { background:"linear-gradient(180deg, #2a60ff, #234ad3) padding-box, linear-gradient(180deg, #5b7cff, #1a2a6e) border-box", border:"1px solid transparent", color:"#fff", fontWeight:700, padding:"10px 16px", borderRadius:10, boxShadow:"0 6px 14px rgba(50,90,255,.35)", cursor:"pointer" };
const table = { width:"100%", marginTop:8, borderCollapse:"separate", borderSpacing:0, background:"linear-gradient(180deg, rgba(26,29,35,.85), rgba(14,16,20,.95)) padding-box, linear-gradient(180deg, #2b2f36, #171a1f) border-box", border:"1px solid transparent", borderRadius:12, overflow:"hidden" };
const th = { textAlign:"left", fontWeight:700, color:"#C8CDD7", padding:"10px 12px", borderBottom:"1px solid #2c3037", background:"rgba(255,255,255,.02)" };
const td = { color:"#E9E9EC", padding:"10px 12px", borderBottom:"1px solid #232830" };