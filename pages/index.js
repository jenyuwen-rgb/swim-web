// pages/index.js
import { useMemo, useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Legend,
  BarChart, Bar, LabelList
} from "recharts";

/* ---------- helpers ---------- */
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
const tToLabel = (t) => {
  const d = new Date(t);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth()+1).padStart(2, "0");
  return `${yy}/${mm}`;
};
const api = process.env.NEXT_PUBLIC_API_URL || "";

// 冬季短水道（前端版，與後端一致）
const isWinterShortCourse = (meet) => {
  if (!meet) return false;
  const s = String(meet);
  return s.includes("冬季短水道") || (s.includes("短水道") && s.includes("冬"));
};

/* ---------- 自訂點樣式（含安全檢查） ---------- */
const TriDot = (props) => {
  const v = props?.payload?.opp;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const { cx, cy } = props;
  const size = 5.5;
  return (
    <path
      d={`M ${cx} ${cy-size} L ${cx-size} ${cy+size} L ${cx+size} ${cy+size} Z`}
      fill="#35D07F" stroke="#0a0c10" strokeWidth="1"
    />
  );
};
const DiamondDot = (props) => {
  const v = props?.payload?.diff;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const { cx, cy } = props;
  const s = 5;
  return (
    <path
      d={`M ${cx} ${cy-s} L ${cx-s} ${cy} L ${cx} ${cy+s} L ${cx+s} ${cy} Z`}
      fill="#FFD166" stroke="#0a0c10" strokeWidth="1"
    />
  );
};

export default function Home(){
  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("50公尺蛙式");
  const [ageTol, setAgeTol] = useState(1); // 年齡誤差：0=同年、1=±1

  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [famStats, setFamStats] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  // 自己、對照與排行
  const [trend, setTrend] = useState([]);               // 自己
  const [rankInfo, setRankInfo] = useState(null);
  const [compareName, setCompareName] = useState("");   // 對照選手
  const [compareTrend, setCompareTrend] = useState([]); // 對照趨勢

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // --- 右軸可拖曳/滾輪平移 ---
  const [rightShift, setRightShift] = useState(0);
  const chartBoxRef = useRef(null);
  const draggingRef = useRef({ active:false, startY:0, startShift:0 });

  const onWheelRight = (e) => {
    e.preventDefault();
    const step = (rightBase.span || 1) / 2;
    setRightShift(s => s + Math.sign(e.deltaY) * step);
  };
  const onPointerDown = (e) => {
    draggingRef.current = { active:true, startY:e.clientY, startShift:rightShift };
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current.active || !chartBoxRef.current) return;
    const rect = chartBoxRef.current.getBoundingClientRect();
    const px = e.clientY - draggingRef.current.startY;
    const secPerPx = (rightBase.span || 10) / Math.max(rect.height, 1);
    setRightShift(draggingRef.current.startShift + px * secPerPx);
  };
  const onPointerUp = () => { draggingRef.current.active = false; };

  const loadOpponentTrend = async (who, baseStartT) => {
    if (!who) { setCompareTrend([]); return; }
    const u = `${api}/api/summary?name=${encodeURIComponent(who)}&stroke=${encodeURIComponent(stroke)}&limit=500&cursor=0`;
    const r = await fetch(u);
    if (!r.ok) throw new Error("compare summary 失敗");
    const j = await r.json();
    const opp = (j.trend?.points||[])
      .filter(p=>p.seconds>0 && p.year)
      .map(p=>{
        const d = parseYYYYMMDD(p.year);
        return { x:p.year, t:d.getTime(), label:tToLabel(d.getTime()), y:p.seconds, d };
      })
      .sort((a,b)=>a.d-b.d);
    setCompareTrend(baseStartT ? opp.filter(p=>p.t >= baseStartT) : opp);
  };

  async function search(cursor=0){
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true); setErr("");

    if (cursor === 0) {
      setItems([]); setTrend([]); setRankInfo(null); setCompareTrend([]);
    }

    try{
      // 1) summary（自己）
      const u = `${api}/api/summary?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&limit=500&cursor=${cursor}`;
      const r = await fetch(u);
      if(!r.ok) throw new Error("summary 取得失敗");
      const j = await r.json();

      const newItems = (j.items || []).slice();

      const me = (j.trend?.points||[])
        .filter(p=>p.seconds>0 && p.year)
        .map(p=>{
          const d = parseYYYYMMDD(p.year);
          return { x:p.year, t:d.getTime(), label:tToLabel(d.getTime()), y:p.seconds, d };
        })
        .sort((a,b)=>a.d-b.d);
      setTrend(me);

      // PB（排冬短）供表格標紅
      let pbSeconds = null;
      for(const it of newItems){
        if (isWinterShortCourse(it["賽事名稱"])) continue;
        const s = Number(it.seconds);
        if (!Number.isFinite(s) || s<=0) continue;
        if (pbSeconds===null || s < pbSeconds) pbSeconds = s;
      }
      for(const it of newItems){
        const s = Number(it.seconds);
        it.is_pb = (pbSeconds!=null && Number.isFinite(s) && s===pbSeconds);
      }

      setItems(cursor===0 ? newItems : [...items, ...newItems]);
      setNext(j.nextCursor ?? null);
      setAnalysis(j.analysis || {});
      setFamStats(j.family || {});

      // 2) rank（拿 top10；預設對照＝top1）
      const rkUrl = `${api}/api/rank?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&ageTol=${ageTol}`;
      const rr = await fetch(rkUrl);
      if(rr.ok){
        const rk = await rr.json();
        setRankInfo(rk || null);

        if (cursor === 0) {
          const defaultOpp = rk?.top?.[0]?.name || "";
          const willUse = compareName || defaultOpp;
          if (!compareName && defaultOpp) setCompareName(defaultOpp);
          if (willUse) await loadOpponentTrend(willUse, me.length ? me[0].t : null);
        }
      }else{
        setRankInfo(null);
        setCompareTrend([]);
      }

    }catch(e){
      setErr(String(e?.message || e));
    }finally{
      setLoading(false);
    }
  }

  // 初次載入
  useEffect(()=>{ search(0); /* eslint-disable-next-line */ },[]);

  // 切換對照選手或泳姿 → 重抓對照趨勢
  useEffect(()=>{
    (async ()=>{
      if (!api || !compareName) { setCompareTrend([]); return; }
      try{
        await loadOpponentTrend(compareName, trend.length ? trend[0].t : null);
      }catch{
        setCompareTrend([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareName, stroke]);

  // PB點（自己）
  const pbPoint = useMemo(()=>{
    if(!trend.length) return null;
    let pb = trend[0];
    for(const p of trend) if(p.y < pb.y) pb = p;
    return pb;
  },[trend]);

  // 合併 X（毫秒 t）
  const mergedX = useMemo(()=>{
    const set = new Map();
    for(const p of trend) set.set(p.t, { t:p.t, label:tToLabel(p.t) });
    for(const p of compareTrend) if(!set.has(p.t)) set.set(p.t, { t:p.t, label:tToLabel(p.t) });
    return Array.from(set.values()).sort((a,b)=>a.t-b.t);
  },[trend, compareTrend]);

  // 組合 data + 差值
  const chartData = useMemo(()=>{
    const byT = new Map(mergedX.map(e=>[e.t, {...e}]));
    for(const p of trend){ const o = byT.get(p.t); o.my = p.y; }
    for(const p of compareTrend){ const o = byT.get(p.t); o.opp = p.y; }
    for(const o of byT.values()){
      if (typeof o.my === "number" && typeof o.opp === "number") o.diff = o.my - o.opp;
    }
    return Array.from(byT.values());
  },[mergedX, trend, compareTrend]);

  /* ===== 右軸 domain：先計基準，再加位移 ===== */
  const rightBase = useMemo(()=>{
    let lmin = +Infinity, lmax = -Infinity, dmin = +Infinity, dmax = -Infinity;
    for(const p of chartData){
      if (typeof p.my === "number") { lmin = Math.min(lmin, p.my); lmax = Math.max(lmax, p.my); }
      if (typeof p.opp === "number"){ lmin = Math.min(lmin, p.opp); lmax = Math.max(lmax, p.opp); }
      if (typeof p.diff === "number"){ dmin = Math.min(dmin, p.diff); dmax = Math.max(dmax, p.diff); }
    }
    if (!Number.isFinite(lmin)) { lmin = 0; lmax = 1; }
    if (!Number.isFinite(dmin)) { dmin = 0; dmax = 1; }

    const leftSpan = Math.max(lmax - lmin, 1);
    const gapTop = Math.max(leftSpan * 0.06, 0.6);
    const pushDown = Math.max(leftSpan * 0.35, 1.5);
    const rMax = lmin - gapTop - pushDown;
    const diffSpan = Math.max(dmax - dmin, leftSpan * 0.4);
    const rMin = rMax - diffSpan;

    return { leftMin:lmin, leftMax:lmax, rMin, rMax, span: rMax - rMin };
  },[chartData]);

  const rightDomain = useMemo(()=>{
    const { rMin, rMax } = rightBase;
    return [rMin + rightShift, rMax + rightShift];
  },[rightBase, rightShift]);

  // 圖例顯示文字
  const oppRank =
    (rankInfo?.top || []).find(x => x.name === compareName)?.rank;
  const legendMap = {
    my: name || "輸入選手",
    opp: compareName ? `#${oppRank ?? "?"} ${compareName}` : "對照",
    diff: "差距",
  };

  // 詳細表格（倒序）
  const detailRowsDesc = useMemo(()=>{
    return items.slice().sort((a,b)=>String(b["年份"]).localeCompare(String(a["年份"])));
  },[items]);

  // ============ 潛力排行：Bar Chart =============
  const rankBarData = useMemo(()=>{
    if (!rankInfo) return [];
    const top = (rankInfo.top || []).map((r, idx) => ({
      key: `top-${idx+1}`,
      label: `#${idx+1}`,
      name: r.name,
      seconds: r.pb_seconds,
      isYou: r.name === name
    }));
    const you = rankInfo.you;
    const isYouInTop = top.some(x => x.isYou);
    if (you && !isYouInTop) {
      top.push({
        key: `you-${you.rank}`,
        label: `你(#${you.rank})`,
        name: you.name,
        seconds: you.pb_seconds,
        isYou: true
      });
    }
    return top;
  }, [rankInfo, name]);

  const barDomain = useMemo(()=>{
    if (!rankBarData.length) return ["auto","auto"];
    let min = Infinity, max = -Infinity;
    rankBarData.forEach(d => {
      const v = Number(d.seconds);
      if (Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
    });
    if (!Number.isFinite(min)) return ["auto","auto"];
    const pad = Math.max((max-min)*0.08, 0.4);
    return [Math.max(0, min - pad), max + pad];
  }, [rankBarData]);

  const simplifyMeet = (s)=>s||"";

  return (
    <main style={{ minHeight:"100vh", background:"radial-gradient(1200px 600px at 20% -10%, #1f232b 0%, #0f1216 60%, #0a0c10 100%)", color:"#E9E9EC", padding:"24px 16px 80px" }}>
      <div style={{ maxWidth:1080, margin:"0 auto" }}>
        <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:2, color:"#E9DDBB", textShadow:"0 1px 0 #2a2e35", marginBottom:12 }}>游泳成績查詢</h1>

        {/* 查詢列：姓名 / 項目 / 年齡誤差 / 查詢 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr 0.8fr auto", gap:8, marginBottom:12 }}>
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="姓名" style={inp}/>
          <select value={stroke} onChange={(e)=>setStroke(e.target.value)} style={inp}>
            {["50公尺自由式","50公尺蛙式","50公尺仰式","50公尺蝶式","100公尺自由式","100公尺蛙式","100公尺仰式","100公尺蝶式","200公尺自由式","200公尺蛙式","200公尺仰式","200公尺蝶式","200公尺混合式"].map(x=>
              <option key={x} value={x}>{x}</option>
            )}
          </select>
          <input
            type="number" min={0} max={5} step={1}
            value={ageTol}
            onChange={(e)=>setAgeTol(Math.max(0, Math.min(5, Number(e.target.value))))}
            style={inp}
            placeholder="年齡誤差(年)"
            title="年齡誤差：0=同年；1=±1；…"
          />
          <button onClick={()=>{ setRightShift(0); search(0); }} disabled={loading} style={btn}>查詢</button>
        </div>

        {err && <div style={{ color:"#ffb3b3", marginBottom:8 }}>查詢失敗：{err}</div>}

        {/* 成績與專項分析 */}
        <Card>
          <SectionTitle>成績分析</SectionTitle>
          <div style={{ display:"flex", gap:32, marginTop:8 }}>
            <KV label="出賽次數" value={`${analysis?.meetCount ?? 0} 場`}/>
            <KV label="平均成績" value={fmtTime(analysis?.avg_seconds)}/>
            <KV label="最佳成績" value={fmtTime(analysis?.pb_seconds)}/>
          </div>
        </Card>

        {/* 四式專項統計 */}
        <Card>
          <SectionTitle>四式統計分析</SectionTitle>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {["蛙式","仰式","自由式","蝶式"].map((s)=>{
              const v = famStats?.[s] || {};
              return (
                <MiniCard key={s}>
                  <div style={{ fontWeight:700, marginBottom:6 }}>{s}</div>
                  <KV label="出賽" value={`${v.count ?? 0} 場`} small/>
                  <KV label="最愛距離" value={v.mostDist ? `${v.mostDist}${v.mostCount?`（${v.mostCount}場）`:""}` : "-"} small/>
                  <KV label="PB" value={fmtTime(v.pb_seconds)} small/>
                </MiniCard>
              );
            })}
          </div>
        </Card>

        {/* 潛力排行（Bar Chart） */}
        <Card>
          <SectionTitle>潛力排行</SectionTitle>
          <div style={{ color:"#AEB4BF", marginBottom:8 }}>
            分母：{rankInfo?.denominator ?? "-"}　你的名次：<span style={{ color:"#FFD166", fontWeight:700 }}>{rankInfo?.rank ?? "-"}</span>　
            百分位：{rankInfo?.percentile ? `${rankInfo.percentile.toFixed(1)}%` : "-"}　年齡誤差：±{ageTol}
          </div>

          <div style={{ width:"100%", height:340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rankBarData}
                margin={{ top:10, right:10, bottom:6, left:10 }}
                isAnimationActive={false}
              >
                <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3"/>
                <XAxis
                  dataKey="label"
                  tick={{ fill:"#AEB4BF", fontSize:12 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                />
                <YAxis
                  domain={barDomain}
                  tickFormatter={(v)=>v.toFixed(2)}
                  tick={{ fill:"#AEB4BF", fontSize:12 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                  width={64} label={{ value:"秒數(PB)", angle:-90, position:"insideLeft", fill:"#AEB4BF" }}
                />
                <Tooltip
                  contentStyle={{ background:"#15181e", border:"1px solid #2e333b", color:"#E9E9EC" }}
                  formatter={(v, k, payload)=>[fmtTime(v), payload?.payload?.name || ""]}
                  labelFormatter={(l)=>String(l)}
                />
                <Bar dataKey="seconds" radius={[6,6,0,0]} isAnimationActive={false}>
                  <LabelList
                    dataKey="name"
                    position="top"
                    style={{ fill:"#EDEBE3", fontSize:12, fontWeight:700, textShadow:"0 1px 0 rgba(0,0,0,.6)" }}
                    formatter={(v, entry) => (entry?.payload?.isYou ? `你 · ${v}` : v)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 對照選手選單 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:8, margin:"12px 0" }}>
          <select value={compareName} onChange={(e)=>setCompareName(e.target.value)} style={inp}>
            <option value="">（選擇對照選手：來自對手排行 Top10）</option>
            {(rankInfo?.top||[]).map((r)=>(
              <option key={r.name} value={r.name}>{`#${r.rank} ${r.name}`}</option>
            ))}
          </select>
        </div>

        {/* 成績趨勢（我的、對照、與差） */}
        <Card>
          <SectionTitle>成績趨勢</SectionTitle>
          <div
            ref={chartBoxRef}
            style={{ height: 420, marginTop: 8, position:"relative" }}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* 右側拖拉/滾輪把手 */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onWheel={onWheelRight}
              title="拖曳或滾輪：上下平移右側『差(秒)』"
              style={{
                position:"absolute", top:0, right:0, width:28, height:"100%",
                cursor:"ns-resize",
                background:"linear-gradient(90deg, transparent, rgba(255,255,255,.04) 40%, transparent)",
                zIndex:2
              }}
            />
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top:10, right:32, bottom:6, left:0 }}>
                <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3"/>

                <Legend
                  verticalAlign="top"
                  height={28}
                  formatter={(value)=>legendMap[value] ?? value}
                />

                <XAxis
                  type="number"
                  dataKey="t"
                  scale="time"
                  domain={["auto","auto"]}
                  tickFormatter={(t)=>tToLabel(t)}
                  tick={{ fill:"#AEB4BF", fontSize:12 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v)=>v.toFixed(2)}
                  domain={["auto","auto"]}
                  tick={{ fill:"#AEB4BF", fontSize:12 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                  width={64} label={{ value:"秒數", angle:-90, position:"insideLeft", fill:"#AEB4BF" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={rightDomain}
                  tickFormatter={(v)=>v.toFixed(2)}
                  tick={{ fill:"#AEB4BF", fontSize:12 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                  width={56} label={{ value:"差(秒)", angle:90, position:"insideRight", fill:"#AEB4BF" }}
                />

                <Tooltip
                  contentStyle={{ background:"#15181e", border:"1px solid #2e333b", color:"#E9E9EC" }}
                  formatter={(v, k)=> {
                    if (k === "my")  return [fmtTime(v), name];
                    if (k === "opp") return [fmtTime(v), compareName ? `#${oppRank ?? "?"} ${compareName}` : "對照"];
                    if (k === "diff") return [`${Number(v).toFixed(2)} s`, "差（我-對照）"];
                    return [v, k];
                  }}
                  labelFormatter={(t)=>String(tToLabel(t))}
                />

                {/* 對照：綠線 */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="opp"
                  name="opp"
                  stroke="#35D07F"
                  strokeWidth={2}
                  connectNulls
                  dot={<TriDot />}
                  activeDot={<TriDot />}
                />

                {/* 自己：藍線 */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="my"
                  name="my"
                  stroke="#80A7FF"
                  strokeWidth={2}
                  dot={{ r:3, stroke:"#0a0c10", strokeWidth:1, fill:"#ffffff" }}
                  activeDot={{ r:6 }}
                  connectNulls
                />

                {/* 差：黃虛線（右軸） */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="diff"
                  name="diff"
                  stroke="#FFD166"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={<DiamondDot />}
                  activeDot={<DiamondDot />}
                  connectNulls
                />

                {pbPoint && (
                  <ReferenceDot x={pbPoint.t} y={pbPoint.y} r={6}
                    fill="#FF6B6B" stroke="#0a0c10" strokeWidth={1}
                    isFront label={{ value:`PB ${fmtTime(pbPoint.y)}`, position:"right", fill:"#FFC7C7", fontSize:12 }}/>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 控制列 */}
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={()=>setRightShift(0)} style={{...btn, padding:"6px 10px"}}>重置差(秒)位置</button>
          </div>
        </Card>

        {/* 詳細成績（最新在上；PB 標紅） */}
        <Card>
          <SectionTitle>詳細成績賽事出處</SectionTitle>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>年份</th>
                <th style={th}>賽事</th>
                <th style={th}>姓名</th>
                <th style={th}>性別</th>
                <th style={th}>出生年</th>
                <th style={th}>秒數</th>
              </tr>
            </thead>
            <tbody>
              {detailRowsDesc.map((r,i)=>(
                <tr key={i}>
                  <td style={td}>{r["年份"]}</td>
                  <td style={td}>{simplifyMeet(r["賽事名稱"])}</td>
                  <td style={td}>{r["姓名"]}</td>
                  <td style={td}>{r["性別"] || "-"}</td>
                  <td style={td}>{r["出生年"] || "-"}</td>
                  <td style={{...td, color: r.is_pb ? "#FF6B6B" : "#E9E9EC", fontWeight: r.is_pb ? 800 : 500}}>
                    {fmtTime(r.seconds)}{r.is_pb ? "  (PB)" : ""}
                  </td>
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

/* ---------- UI bits ---------- */
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
    <div style={{ fontSize: small ? 16 : 20, fontWeight:700, color:"#EDEBE3", textShadow:"0 1px 0 rgba(0,0,0,.6)" }}>
      {value ?? "-"}
    </div>
  </div>
);

/* ---------- styles ---------- */
const inp = {
  background:"linear-gradient(180deg, #191c22, #12151a)",
  border:"1px solid #2b2f36",
  color:"#E9E9EC",
  padding:"10px 12px",
  borderRadius:10,
  outline:"none"
};
const btn = {
  background:"linear-gradient(180deg, #2a60ff, #234ad3) padding-box, linear-gradient(180deg, #5b7cff, #1a2a6e) border-box",
  border:"1px solid transparent",
  color:"#fff",
  fontWeight:700,
  padding:"10px 16px",
  borderRadius:10,
  boxShadow:"0 6px 14px rgba(50,90,255,.35)",
  cursor:"pointer"
};
const table = {
  width:"100%",
  marginTop:8,
  borderCollapse:"separate",
  borderSpacing:0,
  background:"linear-gradient(180deg, rgba(26,29,35,.85), rgba(14,16,20,.95)) padding-box, linear-gradient(180deg, #2b2f36, #171a1f) border-box",
  border:"1px solid transparent",
  borderRadius:12,
  overflow:"hidden"
};
const th = {
  textAlign:"left",
  fontWeight:700,
  color:"#C8CDD7",
  padding:"10px 12px",
  borderBottom:"1px solid #2c3037",
  background:"rgba(255,255,255,.02)"
};
const td = {
  color:"#E9E9EC",
  padding:"10px 12px",
  borderBottom:"1px solid #232830"
};