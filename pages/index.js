
// pages/index.js
import { useMemo, useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Legend,
  BarChart, Bar, LabelList, Cell
} from "recharts";

/* ---------- tooltip 樣式（共用） ---------- */
const tooltipStyles = {
  contentStyle: {
    background: "rgba(14,16,20,0.98)",
    border: "1px solid #55607A",
    color: "#F8FAFC",
    boxShadow: "0 8px 20px rgba(0,0,0,.45)",
    padding: "10px 12px"
  },
  labelStyle: { color: "#FFE08A", fontWeight: 800 },
  itemStyle: { color: "#E5E7EB", fontWeight: 700 }
};

/* ---------- 輸入清理/過濾 ---------- */
const stripEmoji = (s="") =>
  s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
const sanitizeName = (s="") => stripEmoji(s).trim();
const isValidQueryName = (s="") => {
  const t = sanitizeName(s);
  if (t.length < 2) return false;
  return /[\p{Script=Han}A-Za-z0-9]/u.test(t);
};

/* ---------- helpers ---------- */
const fmtTimeMMSS = (s) => {
  const v = Number(s);
  if (!Number.isFinite(v)) return "-";
  const m = Math.floor(v / 60);
  const sec = v - m * 60;
  return ${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")};
};
const fmtTime = (s) => {
  if (!s && s !== 0) return "-";
  const sec = Number(s);
  if (Number.isNaN(sec)) return "-";
  const m = Math.floor(sec / 60);
  const r = sec - m * 60;
  return m ? ${m}:${r.toFixed(2).padStart(5, "0")} : r.toFixed(2);
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
  return ${yy}/${mm};
};
const api = process.env.NEXT_PUBLIC_API_URL || "";

/* 冬季短水道（前端版，與後端一致） */
const isWinterShortCourse = (meet) => {
  if (!meet) return false;
  const s = String(meet);
  return s.includes("冬季短水道") || (s.includes("短水道") && s.includes("冬"));
};

/* ---------- 線圖自訂點 ---------- */
const TriDot = (props) => {
  const v = props?.payload?.opp;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const { cx, cy } = props;
  const size = 5.5;
  return (
    <path
      d={M ${cx} ${cy-size} L ${cx-size} ${cy+size} L ${cx+size} ${cy+size} Z}
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
      d={M ${cx} ${cy-s} L ${cx-s} ${cy} L ${cx} ${cy+s} L ${cx+s} ${cy} Z}
      fill="#FFD166" stroke="#0a0c10" strokeWidth="1"
    />
  );
};

/* ---------- 顏色 ---------- */
const GREYS = ["#C9CED6", "#B6BCC7", "#A5ADBA", "#959EAD", "#8792A1"];
const SELF_BLUE = "#80A7FF"; // 你
const MULTI_PALETTE = [
  "#35D07F", "#FF7A59", "#F6BD60", "#7AD3F7",
  "#C17DFF", "#FFA8D6", "#66C561", "#FFB55E",
  "#A3E635", "#F472B6", "#22D3EE", "#F59E0B"
];

/* ================== 自由式小泳者載入動畫 ================== */
const LoadingOverlay = ({ show }) => {
  if (!show) return null;
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(10,12,16,.72)",
      backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:9999
    }}>
      <svg width="260" height="120" viewBox="0 0 260 120">
        <defs>
          <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2a60ff"/><stop offset="1" stopColor="#234ad3"/>
          </linearGradient>
        </defs>
        <path d="M0 70 Q 30 60 60 70 T 120 70 T 180 70 T 240 70"
              fill="none" stroke="url(#wave)" strokeWidth="4" opacity="0.5">
          <animate attributeName="d" dur="1.8s" repeatCount="indefinite"
                   values="M0 70 Q 30 60 60 70 T 120 70 T 180 70 T 240 70;
                           M0 70 Q 30 80 60 70 T 120 70 T 180 70 T 240 70;
                           M0 70 Q 30 60 60 70 T 120 70 T 180 70 T 240 70"/>
        </path>
        <g>
          <path id="arm" d="M0 0 C 8 -12, 26 -12, 34 0" fill="none" stroke="#EDEBE3" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="12" cy="8" r="4" fill="#EDEBE3"/>
          <rect x="8" y="12" width="18" height="4" rx="2" fill="#EDEBE3"/>
          <circle cx="5" cy="22" r="1.4" fill="#7AD3F7">
            <animate attributeName="cy" dur="0.8s" values="22;19;22" repeatCount="indefinite"/>
          </circle>
        </g>
        <g>
          <g>
            <use href="#arm" x="0" y="0">
              <animateTransform attributeName="transform" type="rotate"
                                values="0 12 8; -35 12 8; 0 12 8"
                                dur="1.2s" repeatCount="indefinite"/>
            </use>
          </g>
          <g transform="translate(20,55)">
            <g id="swimmer">
              <circle cx="12" cy="8" r="4" fill="#EDEBE3"/>
              <rect x="8" y="12" width="18" height="4" rx="2" fill="#EDEBE3"/>
              <use href="#arm" x="0" y="0">
                <animateTransform attributeName="transform" type="rotate"
                                  values="0 12 8; -35 12 8; 0 12 8"
                                  dur="1.2s" repeatCount="indefinite"/>
              </use>
            </g>
            <animateTransform attributeName="transform" type="translate"
                              values="20,55; 200,55; 20,55"
                              dur="2.6s" repeatCount="indefinite"/>
          </g>
        </g>
        <text x="130" y="100" textAnchor="middle" fill="#E9DDBB" fontWeight="800" fontSize="14">
          查詢中… 正在幫你游過資料池
        </text>
      </svg>
    </div>
  );
};

/* ---------- 自訂：分組柱狀圖圖例 ---------- */
const GroupsLegend = ({ entries }) => {
  if (!entries?.length) return null;
  return (
    <div style={{
      display:"flex", flexWrap:"wrap", gap:10, alignItems:"center",
      padding:"6px 2px", color:"#EDEBE3"
    }}>
      {entries.map(e=>(
        <div key={e.name} style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
          <span style={{
            width:12, height:12, borderRadius:999, background:e.color,
            boxShadow:"0 0 0 1px rgba(0,0,0,.6) inset"
          }}/>
          <span style={{ fontWeight:800 }}>{e.name}</span>
        </div>
      ))}
    </div>
  );
};

/* ---------- 分組柱狀圖 Tooltip（修復：未定義） ---------- */
const GroupsTooltip = ({ active, label, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const rows = payload
    .map(p => {
      const dk = p?.dataKey;
      const row = p?.payload || {};
      const meta = row?.[meta_${dk}] || {};
      const who = meta.name || "";
      const sec = Number(meta.seconds);
      const year = meta.year || "";
      if (!who || !Number.isFinite(sec)) return null;
      return { who, sec, year, color: p.color || "#EDEFF6" };
    })
    .filter(Boolean);

  if (!rows.length) return null;

  return (
    <div style={{ ...tooltipStyles.contentStyle, borderRadius:8, minWidth:180 }}>
      <div style={{ ...tooltipStyles.labelStyle, marginBottom:6, fontSize:12 }}>
        {label}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 0" }}>
          <span style={{ width:10, height:10, borderRadius:999, background:r.color }}/>
          <div style={{ ...tooltipStyles.itemStyle, display:"flex", gap:6 }}>
            <strong style={{ color:"#fff" }}>{r.who}</strong>
            <span>{fmtTimeMMSS(r.sec)}</span>
            <span style={{ opacity:.85 }}>｜{r.year || "—"}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ================================= */
export default function Home(){
  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("50公尺蛙式");
  const [ageTol, setAgeTol] = useState(0);
  const [pool] = useState(50);

  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [famStats, setFamStats] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  // 自己、對照與排行
  const [trend, setTrend] = useState([]);
  const [rankInfo, setRankInfo] = useState(null);

  // 對照（趨勢）
  const [compareName, setCompareName] = useState("");
  const [customCompare, setCustomCompare] = useState("");
  const [compareTrend, setCompareTrend] = useState([]);

  // 分組排行
  const [groupsData, setGroupsData] = useState(null);
  const [rankTab, setRankTab] = useState("top");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // --- 右軸可拖曳/滾輪平移 ---
  const [rightShift, setRightShift] = useState(0);
  const chartBoxRef = useRef(null);
  const draggingRef = useRef({ active:false, startY:0, startShift:0 });

  // === 集中管理 AbortController（放在元件內） ===
  const acRef = useRef({ summary:null, rank:null, groups:null, compare:null });
  const abortKey = (k) => {
    const ac = acRef.current[k];
    if (ac) ac.abort();
    acRef.current[k] = new AbortController();
    return acRef.current[k].signal;
  };

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
    const secPerPx = (rightBase.span || 10) / Math.max(rect.height, 1);
    const px = e.clientY - draggingRef.current.startY;
    setRightShift(draggingRef.current.startShift + px * secPerPx);
  };
  const onPointerUp = () => { draggingRef.current.active = false; };

  const loadOpponentTrend = async (who, baseStartT) => {
    const target = sanitizeName(who);
    if (!isValidQueryName(target)) { setCompareTrend([]); return; }
    const u = ${api}/api/summary?name=${encodeURIComponent(target)}&stroke=${encodeURIComponent(stroke)}&pool=${pool}&limit=500&cursor=0;
    const signal = abortKey("compare");
    const r = await fetch(u, { signal });
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

  const loadGroups = async () => {
    const who = sanitizeName(name);
    if (!isValidQueryName(who)) { setGroupsData(null); return; }
    const u = ${api}/api/groups?name=${encodeURIComponent(who)}&stroke=${encodeURIComponent(stroke)};
    const signal = abortKey("groups");
    const r = await fetch(u, { signal });
    if (!r.ok) { setGroupsData(null); return; }
    const j = await r.json();
    setGroupsData(j || null);
  };

  // 回傳最新 rk
  const refreshRankOnly = async () => {
    const who = sanitizeName(name);
    if (!isValidQueryName(who)) { setRankInfo(null); return null; }
    const rkUrl = ${api}/api/rank?name=${encodeURIComponent(who)}&stroke=${encodeURIComponent(stroke)}&ageTol=${ageTol};
    const signal = abortKey("rank");
    const rr = await fetch(rkUrl, { signal });
    if (rr.ok) {
      const rk = await rr.json();
      setRankInfo(rk || null);
      return rk || null;
    }
    return null;
  };

  async function search(cursor = 0) {
    setErr("");
    if (!api) { alert("未設定 NEXT_PUBLIC_API_URL"); return; }

    const who = sanitizeName(name);
    if (!isValidQueryName(who)) {
      setErr("請輸入至少 2 個有效字元的姓名（避免大量符號/emoji）。");
      setItems([]); setTrend([]); setRankInfo(null); setCompareTrend([]); setGroupsData(null);
      return;
    }

    setLoading(true);

    if (cursor === 0) {
      setItems([]); setTrend([]); setRankInfo(null); setCompareTrend([]); setGroupsData(null);
      setCompareName(""); setCustomCompare(""); setRightShift(0);
    }

    try {
      // 1) summary（自己）
      const u = ${api}/api/summary?name=${encodeURIComponent(who)}&stroke=${encodeURIComponent(stroke)}&pool=${pool}&limit=500&cursor=${cursor};
      const signal = abortKey("summary");
      const r = await fetch(u, { signal });
      if (!r.ok) throw new Error("summary 取得失敗");
      const j = await r.json();

      const newItems = (j.items || []).slice();

      const me = (j.trend?.points || [])
        .filter(p => p.seconds > 0 && p.year)
        .map(p => {
          const d = parseYYYYMMDD(p.year);
          return { x: p.year, t: d.getTime(), label: tToLabel(d.getTime()), y: p.seconds, d };
        })
        .sort((a, b) => a.d - b.d);
      setTrend(me);

      // PB（排冬短）供表格標紅
      let pbSeconds = null;
      for (const it of newItems) {
        if (isWinterShortCourse(it["賽事名稱"])) continue;
        const s = Number(it.seconds);
        if (!Number.isFinite(s) || s <= 0) continue;
        if (pbSeconds === null || s < pbSeconds) pbSeconds = s;
      }
      for (const it of newItems) {
        const s = Number(it.seconds);
        it.is_pb = (pbSeconds != null && Number.isFinite(s) && s === pbSeconds);
      }

      setItems(cursor === 0 ? newItems : [...items, ...newItems]);
      setNext(j.nextCursor ?? null);
      setAnalysis(j.analysis || {});
      setFamStats(j.family || {});

      // 2) rank（Top10）
      await refreshRankOnly();

      // 3) groups（分組柱狀圖）
      if (cursor === 0) await loadGroups();

      // 4) 對照（若搜尋前已手動選 compareName，沿用；否則清空）
      if (cursor === 0) {
        if (compareName) await loadOpponentTrend(compareName, me.length ? me[0].t : null);
        else setCompareTrend([]);
      }

    } catch (e) {
      if (String(e?.name) === "AbortError") return;
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ageTol/name/stroke 變更時自動更新 Top10
  useEffect(() => {
    if (!api) return;
    if (!isValidQueryName(name)) { setRankInfo(null); return; }
    (async () => { await refreshRankOnly(); })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageTol, name, stroke]);

  // 切換對照選手或泳姿 → 重抓對照趨勢
  useEffect(()=>{
    (async ()=>{
      if (!api || !compareName) { setCompareTrend([]); return; }
      if (!isValidQueryName(compareName)) { setCompareTrend([]); return; }
      try{
        await loadOpponentTrend(compareName, trend.length ? trend[0].t : null);
      }catch{
        setCompareTrend([]);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareName, stroke]);

  // 切換姓名/項目 → 重新載入分組資料
  useEffect(()=>{
    (async ()=>{
      if (!api) return;
      if (!isValidQueryName(name)) { setGroupsData(null); return; } 
      try{ await loadGroups(); }catch{ setGroupsData(null); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, stroke]);

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

  // 左軸 domain
  const leftDomain = useMemo(() => {
    let lmin = +Infinity, lmax = -Infinity;
    for (const p of chartData) {
      if (typeof p.my  === "number") { lmin = Math.min(lmin, p.my);  lmax = Math.max(lmax, p.my); }
      if (typeof p.opp === "number") { lmin = Math.min(lmin, p.opp); lmax = Math.max(lmax, p.opp); }
    }
    if (!Number.isFinite(lmin)) return ["auto", "auto"];
    const span = Math.max(lmax - lmin, 1);
    const lower = Math.max(0, lmin - span / 2);
    return [lower, lmax];
  }, [chartData]);

  /* 右軸 domain：先計基準，再加位移 */
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

  // 圖例顯示文字（折線圖）
  const oppRank = (rankInfo?.top || []).find(x => x.name === compareName)?.rank;
  const legendMap = {
    my: name || "輸入選手",
    opp: compareName ? #${oppRank ?? "?"} ${compareName} : "對照",
    diff: "差距",
  };

  // 詳細表格（倒序）
  const detailRowsDesc = useMemo(()=>{
    return items.slice().sort((a,b)=>String(b["年份"]).localeCompare(String(a["年份"])));
  },[items]);

  /* ============ 潛力排行：Top10（資料＋顏色） ============ */
  const rankBarData = useMemo(()=>{
    if (!rankInfo) return [];
    const top = (rankInfo.top || []).map((r, idx) => {
      const isYou = r.name === name;
      return {
        key: top-${idx+1},
        label: #${idx+1},
        rank: idx + 1,
        name: r.name,
        seconds: r.pb_seconds,
        year: r.year || r.pb_year || r.ymd || r.pb_yyyymmdd || "",
        meet: r.meet || r.pb_meet || r.meet_name || r.event || "",
        isYou,
        color: isYou ? SELF_BLUE : GREYS[idx % GREYS.length]
      };
    });

    const you = rankInfo.you;
    const isYouInTop = top.some(x => x.isYou);
    if (you && !isYouInTop) {
      top.push({
        key: you-${you.rank},
        label: 你(#${you.rank}),
        rank: you.rank,
        name: you.name,
        seconds: you.pb_seconds,
        year: you.year || you.pb_year || you.ymd || you.pb_yyyymmdd || "",
        meet: you.meet || you.pb_meet || you.meet_name || you.event || "",
        isYou: true,
        color: SELF_BLUE
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

  /* ================= 分組排行 ================= */
  const groupsChartKeys = useMemo(()=>{
    const set = new Set();
    (groupsData?.groups || []).forEach(g=>{
      (g.bars||[]).forEach(b => set.add(b.label));
    });
    return Array.from(set);
  }, [groupsData]);

  const groupsChartData = useMemo(()=>{
    if (!groupsData?.groups?.length) return [];
    return groupsData.groups.map(g => {
      const row = { group: g.group };
      (g.bars||[]).forEach(b => {
        row[b.label] = b.seconds ?? null;
        row[meta_${b.label}] = b;
      });
      return row;
    });
  }, [groupsData]);

  const winnersGlobalCount = useMemo(()=>{
    const cnt = new Map();
    (groupsData?.groups || []).forEach(g=>{
      (g.bars||[]).forEach(b=>{
        const who = (b && b.seconds != null && b.seconds > 0) ? (b.name || "") : "";
        if (!who) return;
        cnt.set(who, (cnt.get(who)||0)+1);
      });
    });
    return cnt;
  }, [groupsData]);

  const strongColorMap = useMemo(()=>{
    const m = new Map();
    const list = [];
    (winnersGlobalCount || new Map()).forEach((times, who) => {
      if (who && who !== name && times >= 2) list.push(who);
    });
    list.sort();
    list.forEach((who, i) => m.set(who, MULTI_PALETTE[i % MULTI_PALETTE.length]));
    return m;
  }, [winnersGlobalCount, name]);

  const pickGrey = (rowIdx, barIdx) => GREYS[(rowIdx + barIdx) % GREYS.length];

  const getBarColor = (row, key, rowIdx, barIdx) => {
    const meta = row?.[meta_${key}] || {};
    const who = meta?.name || "";
    if (!who) return pickGrey(rowIdx, barIdx);
    if (who === name) return SELF_BLUE;
    if ((winnersGlobalCount.get(who) || 0) >= 2) return strongColorMap.get(who) || pickGrey(rowIdx, barIdx);
    return pickGrey(rowIdx, barIdx);
  };

  const renderStrongLabel = (dataKey) => (props) => {
    const { x, y, width, payload } = props;
    if (x == null || y == null || width == null || !payload) return null;

    const meta = payload[meta_${dataKey}] || {};
    const who = meta.name || "";
    const sec = Number(meta.seconds);
    if (!who || !Number.isFinite(sec)) return null;

    const isStrong = who === name || (winnersGlobalCount.get(who) || 0) >= 2;
    if (!isStrong) return null;

    const cx = x + width / 2;
    const topY = y;
    const color = who === name ? SELF_BLUE : (strongColorMap.get(who) || "#EDEFF6");
    const sub = ${fmtTime(sec)}｜${meta.year || "—"};

    return (
      <g pointerEvents="none">
        <text x={cx} y={topY - 16} textAnchor="middle"
              style={{ fontWeight:800, fill:color, paintOrder:"stroke", stroke:"#0a0c10", strokeWidth:2 }}>
          {who}
        </text>
        <text x={cx} y={topY - 2} textAnchor="middle"
              style={{ fontWeight:700, fill:"#FFF", paintOrder:"stroke", stroke:"#0a0c10", strokeWidth:2 }}>
          {sub}
        </text>
      </g>
    );
  };

  // 供圖例用：只顯示藍色（你）與非灰色強勢選手
  const groupsLegendEntries = useMemo(()=>{
    const out = [];
    if (name) out.push({ name, color: SELF_BLUE });
    const list = [];
    (winnersGlobalCount || new Map()).forEach((times, who)=>{
      if (who && who !== name && times >= 2) list.push(who);
    });
    list.sort((a,b)=>a.localeCompare(b, "zh-Hans"));
    list.forEach(who=>{
      out.push({ name: who, color: strongColorMap.get(who) || "#EDEFF6" });
    });
    return out;
  }, [name, winnersGlobalCount, strongColorMap]);

  /* ================== UI ================== */

  const simplifyMeet = (s)=>s||"";

  return (
    <main style={{ minHeight:"100vh", background:"radial-gradient(1200px 600px at 20% -10%, #1f232b 0%, #0f1216 60%, #0a0c10 100%)", color:"#E9E9EC", padding:"24px 16px 80px" }}>
      {/* 載入動畫 */}
      <LoadingOverlay show={loading} />

      <div style={{ maxWidth:1200, margin:"0 auto" }}>
        <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:2, color:"#E9DDBB", textShadow:"0 1px 0 #2a2e35", marginBottom:12 }}>游泳成績查詢</h1>

        {/* 查詢列 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr auto", gap:8, marginBottom:12 }}>
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="姓名" style={inp}/>
          <select value={stroke} onChange={(e)=>setStroke(e.target.value)} style={inp}>
            {[
              "50公尺自由式","50公尺蛙式","50公尺仰式","50公尺蝶式",
              "100公尺自由式","100公尺蛙式","100公尺仰式","100公尺蝶式",
              "200公尺自由式","200公尺蛙式","200公尺仰式","200公尺蝶式","200公尺混合式"
            ].map(x => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <button
            onClick={()=>{
              const who = sanitizeName(name);
              if (!isValidQueryName(who)) {
                setErr("請輸入至少 2 個有效字元的姓名（避免大量符號/emoji）。");
                return;
              }
              setRightShift(0);
              search(0);
            }}
            disabled={loading}
            style={btn}
          >
            查詢
          </button>
        </div>

        {err && <div style={{ color:"#ffb3b3", marginBottom:8 }}>查詢失敗：{err}</div>}

        {/* 成績與專項分析 */}
        <Card>
          <SectionTitle>成績分析</SectionTitle>
          <div style={{ display:"flex", gap:32, marginTop:8, flexWrap:"wrap" }}>
            <KV label="出賽次數" value={${analysis?.meetCount ?? 0} 場}/>
            <KV label="平均成績" value={fmtTimeMMSS(analysis?.avg_seconds)}/>
            <KV label="最佳成績 (PB)" value={fmtTimeMMSS(analysis?.pb_seconds)}/>
            <KV label="WA Points" value={analysis?.wa_points != null ? Math.round(analysis.wa_points) : "-"} />
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
                  <KV label="出賽" value={${v.count ?? 0} 場} small/>
                  <KV label="最愛距離" value={v.mostDist ? ${v.mostDist}${v.mostCount?（${v.mostCount}場）:""} : "-"} small/>
                  <KV label="PB" value={fmtTime(v.pb_seconds)} small/>
                </MiniCard>
              );
            })}
          </div>
        </Card>

        {/* 潛力排行：Top10 & 分組 */}
        <Card>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <SectionTitle>潛力排行</SectionTitle>

            {rankTab==="top" && (
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input
                  type="number" min={0} max={5} step={1}
                  value={ageTol}
                  onChange={(e)=>setAgeTol(Math.max(0, Math.min(5, Number(e.target.value))))}
                  style={{ ...inp, width:120, padding:"8px 10px" }}
                  placeholder="年齡誤差(年)"
                  title="年齡誤差：0=同年；1=±1；…"
                />
                <button onClick={refreshRankOnly} style={{ ...btn, padding:"8px 12px" }}>Refresh</button>
              </div>
            )}

            <div style={{ display:"flex", gap:8 }}>
              <button
                onClick={()=>setRankTab("top")}
                style={{...tabBtn, ...(rankTab==="top"?tabBtnActive:{}), minWidth:96}}
              >Top10 & 你</button>
              <button
                onClick={()=>setRankTab("groups")}
                style={{...tabBtn, ...(rankTab==="groups"?tabBtnActive:{}), minWidth:96}}
              >分組排行</button>
            </div>
          </div>

          {rankTab==="top" && (
            <div style={{ color:"#BFC6D4", marginBottom:8 }}>
              分母：{rankInfo?.denominator ?? "-"}　你的名次：
              <span style={{ color:"#FFD166", fontWeight:800 }}>{rankInfo?.rank ?? "-"}</span>　
              百分位：{rankInfo?.percentile ? ${rankInfo.percentile.toFixed(1)}% : "-"}　年齡誤差：±{ageTol}
            </div>
          )}

          {rankTab==="top" && (
            <div style={{ width:"100%", height:340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankBarData} margin={{ top:10, right:10, bottom:6, left:10 }} isAnimationActive={false}>
                  <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3"/>
                  <XAxis dataKey="label" tick={{ fill:"#d9dde7", fontSize:12, fontWeight:700 }} axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}/>
                  <YAxis
                    domain={barDomain}
                    tickFormatter={fmtTimeMMSS} 
                    tick={{ fill:"#d9dde7", fontSize:12, fontWeight:700 }}
                    axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                    width={64} label={{ value:"時間(PB)", angle:-90, position:"insideLeft", fill:"#d9dde7" }}
                  />
                  <Tooltip
                    {...tooltipStyles}
                    cursor={false}
                    formatter={(v, _k, p) => {
                      const row = p?.payload || {};
                      const right = ${row.name || "—"}｜${row.year || "—"}｜${row.meet || "—"};
                      return [fmtTimeMMSS(v), right]; 
                    }}
                    labelFormatter={(l, payload) => {
                      const row = payload && payload[0] && payload[0].payload;
                      return row?.label || String(l);
                    }}
                  />
                  <Bar dataKey="seconds" radius={[6,6,0,0]} isAnimationActive={false}>
                    {rankBarData.map((row)=>(
                      <Cell key={row.key} fill={row.color}/>
                    ))}
                    <LabelList
                      dataKey="name"
                      position="top"
                      style={{ fill:"#fff", fontSize:12, fontWeight:800, textShadow:"0 1px 0 rgba(0,0,0,.7)" }}
                      formatter={(v, entry) => (entry?.payload?.isYou ? 你 · ${v} : v)}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {rankTab==="groups" && (
            <>
              <GroupsLegend entries={groupsLegendEntries} />

              <div style={{ width:"100%", height:400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupsChartData} margin={{ top:64, right:10, bottom:16, left:10 }} isAnimationActive={false}>
                    <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3"/>
                    <XAxis dataKey="group" tick={{ fill:"#d9dde7", fontSize:12, fontWeight:700 }} axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}/>
                    <YAxis
                      tickFormatter={fmtTimeMMSS} 
                      tick={{ fill:"#d9dde7", fontSize:12, fontWeight:700 }}
                      axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                      width={64} label={{ value:"最快時間 mm:ss", angle:-90, position:"insideLeft", fill:"#d9dde7" }}
                    />
                    <Tooltip cursor={false} content={<GroupsTooltip />} />
                    {groupsChartKeys.map((k, barIdx)=>(
                      <Bar
                        key={k}
                        dataKey={k}
                        name={k}
                        radius={[6,6,0,0]}
                        isAnimationActive={false}
                      >
                        {groupsChartData.map((row, rowIdx)=>(
                          <Cell key={${k}-${row.group}} fill={getBarColor(row, k, rowIdx, barIdx)} />
                        ))}
                        <LabelList content={renderStrongLabel(k)} />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ color:"#AEB4BF", marginTop:6, fontSize:12 }}>
                  *  Bar chart 依序為歷年最快 / 今年最快 / 去年最快 / 前年最快；強勢選手(跨組≥2)與你會在柱上顯示「姓名｜成績｜年份」。
                </div>
              </div>
            </>
          )}
        </Card>

        {/* 成績趨勢 */}
        <Card>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <SectionTitle>成績趨勢</SectionTitle>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <select
                value={compareName}
                onChange={(e)=>setCompareName(e.target.value)}
                style={{ ...inp, padding:"8px 10px" }}
                title="由對手排行 Top10 快速選擇對照選手"
              >
                <option value="">（不顯示對照）</option>
                {(rankInfo?.top||[]).map((r)=>(
                  <option key={r.name} value={r.name}>{#${r.rank} ${r.name}}</option>
                ))}
              </select>
              <input
                value={customCompare}
                onChange={(e)=>setCustomCompare(e.target.value)}
                placeholder="輸入任一選手做對照"
                style={{ ...inp, padding:"8px 10px", minWidth:220 }}
              />
              <button
                onClick={async ()=>{
                  const w=(customCompare||"").trim();
                  if(!w) return;
                  setCompareName(w);
                  try{ await loadOpponentTrend(w, trend.length ? trend[0].t : null);}catch{ setCompareTrend([]); }
                }}
                style={{ ...btn, padding:"8px 12px" }}
              >顯示</button>
            </div>
          </div>

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
                  wrapperStyle={{ color:"#F6F7FB", fontWeight:700 }}
                />

                <XAxis
                  type="number"
                  dataKey="t"
                  scale="time"
                  domain={["auto","auto"]}
                  tickFormatter={(t)=>tToLabel(t)}
                  tick={{ fill:"#d9dde7", fontSize:12, fontWeight:700 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={fmtTimeMMSS}
                  domain={leftDomain}
                  tick={{ fill:"#d9dde7", fontSize:12, fontWeight:700 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                  width={64} label={{ value:"時間", angle:-90, position:"insideLeft", fill:"#d9dde7" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={rightDomain}
                  tickFormatter={(v)=>v.toFixed(2)}
                  tick={{ fill:"#d9dde7", fontSize:12, fontWeight:700 }}
                  axisLine={{ stroke:"#3a3f48" }} tickLine={{ stroke:"#3a3f48" }}
                  width={56} label={{ value:"差(秒)", angle:90, position:"insideRight", fill:"#d9dde7" }}
                />

                <Tooltip
                  {...tooltipStyles}
                  formatter={(v, k)=> {
                    if (k === "my")  return [fmtTimeMMSS(v), name];
                    if (k === "opp") return [fmtTimeMMSS(v), compareName ? #${(rankInfo?.top||[]).find(x=>x.name===compareName)?.rank ?? "?"} ${compareName} : "對照"];
                    if (k === "diff") return [${Number(v).toFixed(2)} s, "差（我-對照）"];
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
                  strokeWidth={2.2}
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
                  strokeWidth={2.2}
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
                    isFront label={{ value:PB ${fmtTime(pbPoint.y)}, position:"right", fill:"#FFC7C7", fontSize:12 }}/>
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
  <div style={{ fontWeight:800, letterSpacing:.5, color:"#EDEBE3", marginBottom:6, textShadow:"0 1px 0 rgba(0,0,0,.6)" }}>{children}</div>
);
const KV = ({ label, value, small }) => (
  <div style={{ marginRight:24 }}>
    <div style={{ fontSize: small ? 12 : 13, color:"#AEB4BF" }}>{label}</div>
    <div style={{ fontSize: small ? 16 : 20, fontWeight:800, color:"#FFFFFF", textShadow:"0 1px 0 rgba(0,0,0,.8)" }}>
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
  borderRadius:16,
  outline:"none"
};
const btn = {
  background:"linear-gradient(180deg, #2a60ff, #234ad3) padding-box, linear-gradient(180deg, #5b7cff, #1a2a6e) border-box",
  border:"1px solid transparent",
  color:"#fff",
  fontWeight:800,
  padding:"10px 16px",
  borderRadius:10,
  boxShadow:"0 6px 14px rgba(50,90,255,.35)",
  cursor:"pointer"
};
const tabBtn = {
  background:"linear-gradient(180deg, #1a1e25, #12151a)",
  border:"1px solid #313744",
  color:"#d9dde7",
  fontWeight:800,
  padding:"6px 12px",
  borderRadius:10,
  cursor:"pointer"
};
const tabBtnActive = {
  background:"linear-gradient(180deg, #2a60ff, #234ad3)",
  border:"1px solid #4163ff",
  color:"#fff",
  boxShadow:"0 6px 14px rgba(50,90,255,.35)"
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
  fontWeight:800,
  color:"#F0F3FA",
  padding:"10px 12px",
  borderBottom:"1px solid #2c3037",
  background:"rgba(255,255,255,.03)"
};
const td = {
  color:"#E9E9EC",
  padding:"10px 12px",
  borderBottom:"1px solid #232830"
};