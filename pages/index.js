// pages/index.js
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";

/* ===== Utils ===== */
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
  return `${s.slice(2, 4)}/${s.slice(4, 6)}`; // yy/mm
};

export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_URL || "";

  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("50公尺蛙式");

  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [famStats, setFamStats] = useState(null);
  const [rank, setRank] = useState(null); // /api/rank
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function search(cursor = 0) {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true);
    setErr("");

    try {
      // 1) 明細 + 分析 + 趨勢
      const url = `${api}/api/summary?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&limit=200&cursor=${cursor}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("summary 取得失敗");
      const j = await r.json();
      const newItems = j.items || [];
      setItems(cursor === 0 ? newItems : [...items, ...newItems]);
      setNext(j.nextCursor ?? null);

      // 2) 四式（也可從 summary.family 取，這裡保留原獨立 API）
      const sUrl = `${api}/api/stats/family?name=${encodeURIComponent(name)}`;
      const sr = await fetch(sUrl);
      if (sr.ok) {
        const sj = await sr.json();
        setFamStats(sj || {});
      }

      // 3) 排行（含 leaderTrendFull）
      const rkUrl = `${api}/api/rank?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}`;
      const rr = await fetch(rkUrl);
      if (!rr.ok) throw new Error("rank 取得失敗");
      const rj = await rr.json();
      setRank(rj);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  /* 當前條件的分析（用 items 計） */
  const analysis = useMemo(() => {
    if (!items.length) return { meetCount: 0, avg: 0, best: 0, pbPoint: null };
    const filtered = items
      .filter((x) => typeof x.seconds === "number" && x.seconds > 0 && x["年份"])
      .map((x) => ({
        x: x["年份"],
        label: xLabel(x["年份"]),
        y: x.seconds,
        d: parseYYYYMMDD(x["年份"]),
      }))
      .sort((a, b) => a.d - b.d);
    const secs = filtered.map((p) => p.y);
    const avg = secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : 0;
    let pb = null;
    for (const p of filtered) if (!pb || p.y < pb.y) pb = p;
    return { meetCount: items.length, avg, best: pb ? pb.y : 0, pbPoint: pb, series: filtered };
  }, [items]);

  /* 榜首完整趨勢線（後端提供 leaderTrendFull） */
  const leaderSeries = useMemo(() => {
    const pts = rank?.leaderTrendFull || [];
    const arr = pts
      .filter((x) => x.seconds > 0 && x.year)
      .map((x) => ({
        x: x.year,
        label: xLabel(x.year),
        y: x.seconds,
        d: parseYYYYMMDD(x.year),
      }))
      .sort((a, b) => a.d - b.d);
    return arr;
  }, [rank]);

  /* X 軸去密集：自動保留首尾與適度抽樣 */
  const xTicks = useMemo(() => {
    const xs = (analysis.series || []).map((p) => p.label);
    if (!xs.length) return [];
    const uniq = Array.from(new Set(xs));
    const keep = Math.max(3, Math.ceil(uniq.length / 6)); // 目標 ~6 組 tick
    const ticks = uniq.filter((_, i) => i % keep === 0);
    if (ticks[ticks.length - 1] !== uniq[uniq.length - 1]) ticks.push(uniq[uniq.length - 1]);
    return ticks;
  }, [analysis.series]);

  /* 表格排序（最新版：最新在上） */
  const tableRows = useMemo(
    () => items.slice().sort((a, b) => Number(b["年份"]) - Number(a["年份"])),
    [items]
  );

  /* 簡化賽事（保留原函式，但你前面說過表格想先看原始名稱，這裡就不套簡化了） */
  const simplifyMeet = (s) => s || "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1200px 600px at 20% -10%, #1f232b 0%, #0f1216 60%, #0a0c10 100%)",
        color: "#E9E9EC",
        padding: "24px 16px 80px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue"',
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, color: "#E9DDBB", textShadow: "0 1px 0 #2a2e35", marginBottom: 12 }}>
          游泳成績查詢
        </h1>

        {/* 搜尋列 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 8, marginBottom: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" style={inp} />
          <select value={stroke} onChange={(e) => setStroke(e.target.value)} style={inp}>
            {[
              "50公尺自由式","50公尺蛙式","50公尺仰式","50公尺蝶式",
              "100公尺自由式","100公尺蛙式","100公尺仰式","100公尺蝶式",
              "200公尺自由式","200公尺蛙式","200公尺仰式","200公尺蝶式","200公尺混合式",
            ].map((x) => (<option key={x} value={x}>{x}</option>))}
          </select>
          <button onClick={() => search(0)} disabled={loading} style={btn}>查詢</button>
        </div>

        {err && <div style={{ color: "#ffb3b3", marginBottom: 8 }}>查詢失敗：{err}</div>}

        {/* 成績與專項分析 */}
        <Card>
          <SectionTitle>成績與專項分析（當前條件）</SectionTitle>
          <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
            <KV label="出賽次數" value={`${analysis.meetCount} 場`} />
            <KV label="平均成績" value={fmtTime(analysis.avg)} />
            <KV label="最佳成績" value={fmtTime(analysis.best)} />
          </div>
        </Card>

        {/* 四式專項統計 */}
        <Card>
          <SectionTitle>四式專項統計（不分距離）</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {["蛙式", "仰式", "自由式", "蝶式"].map((s) => {
              const v = famStats?.[s] || {};
              return (
                <MiniCard key={s}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{s}</div>
                  <KV label="出賽" value={`${v.count ?? 0} 場`} small />
                  <KV
                    label="最多距離"
                    value={v.mostDist ? `${v.mostDist}${v.mostCount ? `（${v.mostCount}場）` : ""}` : "-"}
                    small
                  />
                  <KV label="PB" value={fmtTime(v.pb_seconds)} small />
                </MiniCard>
              );
            })}
          </div>
        </Card>

        {/* 排行卡片 */}
        <Card>
          <SectionTitle>排行（同年份＋同賽事名稱＋同項目，對手池 PB 排名；PB 排除冬短）</SectionTitle>
          {rank ? (
            <div>
              <div style={{ marginBottom: 8, color: "#AEB4BF", fontSize: 13 }}>
                分母 {rank.denominator ?? "-"}，你的名次 {rank.rank ?? "-"}，百分位 {rank.percentile ? rank.percentile.toFixed(2) : "-"}%
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {(rank.top || []).map((x) => (
                  <MiniCard key={`${x.name}-${x.pb}`} >
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    }}>
                      <div style={{ fontWeight: 700, color: x.name === name ? "#ff6b6b" : "#EDEBE3" }}>
                        {x.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#AEB4BF" }}>{fmtTime(x.pb)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#AEB4BF", marginTop: 4 }}>
                      {x.pb_year} · {x.pb_meet}
                    </div>
                  </MiniCard>
                ))}
              </div>
              {/* 若不在前 10，另列出本人 */}
              {rank.rank && (rank.rank > 10) && (
                <div style={{ marginTop: 8 }}>
                  <MiniCard>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 800, color: "#ff6b6b" }}>{rank.you?.name || name}（第 {rank.rank} 名）</div>
                      <div style={{ fontSize: 12, color: "#AEB4BF" }}>{fmtTime(rank.you?.pb_seconds)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#AEB4BF", marginTop: 4 }}>
                      你的 PB
                    </div>
                  </MiniCard>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "#AEB4BF" }}>尚無排行資料</div>
          )}
        </Card>

        {/* 成績趨勢：加入榜首完整趨勢線；X 軸減少擁擠；PB 紅點 */}
        <Card>
          <SectionTitle>成績趨勢（與榜首對照）</SectionTitle>
          <div style={{ height: 360, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={analysis.series}
                margin={{ top: 10, right: 16, bottom: 6, left: 0 }}
              >
                <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  ticks={xTicks}
                  interval={0}
                  minTickGap={16}
                  tick={{ fill: "#AEB4BF", fontSize: 12 }}
                  axisLine={{ stroke: "#3a3f48" }}
                  tickLine={{ stroke: "#3a3f48" }}
                />
                <YAxis
                  tickFormatter={(v) => v.toFixed(2)}
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fill: "#AEB4BF", fontSize: 12 }}
                  axisLine={{ stroke: "#3a3f48" }}
                  tickLine={{ stroke: "#3a3f48" }}
                  width={56}
                  label={{ value: "秒數", angle: -90, position: "insideLeft", fill: "#AEB4BF" }}
                />
                <Tooltip
                  contentStyle={{ background: "#15181e", border: "1px solid #2e333b", color: "#E9E9EC" }}
                  formatter={(v, k) => [fmtTime(v), k === "y" ? "成績" : "榜首"]}
                  labelFormatter={(l, p) => `${p?.[0]?.payload?.x}`}
                />

                {/* 你的線 */}
                <Line
                  type="monotone"
                  dataKey="y"
                  stroke="#80A7FF"
                  strokeWidth={2}
                  dot={{ r: 3, stroke: "#0a0c10", strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                  name="成績"
                />
                {/* 你的 PB 紅點 */}
                {analysis.pbPoint && (
                  <ReferenceDot
                    x={analysis.pbPoint.label}
                    y={analysis.pbPoint.y}
                    r={5}
                    fill="#FF6B6B"
                    stroke="#0a0c10"
                    strokeWidth={1}
                    isFront
                    label={{
                      value: `PB ${fmtTime(analysis.pbPoint.y)}`,
                      position: "right",
                      fill: "#FFC7C7",
                      fontSize: 12,
                    }}
                  />
                )}

                {/* 榜首完整趨勢線（使用 secondary data） */}
                {leaderSeries.length > 0 && (
                  <Line
                    type="monotone"
                    data={leaderSeries}
                    dataKey="y"
                    stroke="#5CD18F"
                    strokeWidth={2}
                    dot={{ r: 0 }}
                    name={`榜首：${rank?.leader?.name || ""}`}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 明細（最新在最上；賽事暫時用原始名稱） */}
        <Card>
          <SectionTitle>詳細成績</SectionTitle>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>年份</th>
                <th style={th}>賽事</th>
                <th style={th}>秒數</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r["年份"]}</td>
                  <td style={td}>{r["賽事名稱"]}</td>
                  <td style={{
                    ...td,
                    color:
                      analysis.pbPoint && r["年份"] === analysis.pbPoint.x && r.seconds === analysis.pbPoint.y
                        ? "#FF6B6B"
                        : "#E9E9EC",
                    fontWeight:
                      analysis.pbPoint && r["年份"] === analysis.pbPoint.x && r.seconds === analysis.pbPoint.y
                        ? 800
                        : 400,
                  }}>
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

/* ======= UI pieces ======= */
const Card = ({ children }) => (
  <section
    style={{
      background:
        "linear-gradient(180deg, rgba(31,35,43,.9), rgba(19,22,27,.98)) padding-box, linear-gradient(180deg, #2b2f36, #14171c) border-box",
      border: "1px solid transparent",
      borderRadius: 14,
      boxShadow: "0 10px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.02)",
      padding: 16,
      margin: "12px 0",
    }}
  >
    {children}
  </section>
);

const MiniCard = ({ children }) => (
  <div
    style={{
      background:
        "linear-gradient(180deg, rgba(32,36,44,.85), rgba(18,21,26,.95)) padding-box, linear-gradient(180deg, #313641, #161a20) border-box",
      border: "1px solid transparent",
      borderRadius: 12,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
      padding: 12,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <div
    style={{
      fontWeight: 700,
      letterSpacing: 0.5,
      color: "#D8D6CB",
      marginBottom: 6,
    }}
  >
    {children}
  </div>
);

const KV = ({ label, value, small }) => (
  <div style={{ marginRight: 24 }}>
    <div style={{ fontSize: small ? 12 : 13, color: "#AEB4BF" }}>{label}</div>
    <div
      style={{
        fontSize: small ? 16 : 20,
        fontWeight: 700,
        color: "#EDEBE3",
        textShadow: "0 1px 0 rgba(0,0,0,.6)",
      }}
    >
      {value ?? "-"}
    </div>
  </div>
);

const inp = {
  background: "linear-gradient(180deg, #191c22, #12151a)",
  border: "1px solid #2b2f36",
  color: "#E9E9EC",
  padding: "10px 12px",
  borderRadius: 10,
  outline: "none",
};

const btn = {
  background:
    "linear-gradient(180deg, #2a60ff, #234ad3) padding-box, linear-gradient(180deg, #5b7cff, #1a2a6e) border-box",
  border: "1px solid transparent",
  color: "#fff",
  fontWeight: 700,
  padding: "10px 16px",
  borderRadius: 10,
  boxShadow: "0 6px 14px rgba(50,90,255,.35)",
  cursor: "pointer",
};

const table = {
  width: "100%",
  marginTop: 8,
  borderCollapse: "separate",
  borderSpacing: 0,
  background:
    "linear-gradient(180deg, rgba(26,29,35,.85), rgba(14,16,20,.95)) padding-box, linear-gradient(180deg, #2b2f36, #171a1f) border-box",
  border: "1px solid transparent",
  borderRadius: 12,
  overflow: "hidden",
};

const th = {
  textAlign: "left",
  fontWeight: 700,
  color: "#C8CDD7",
  padding: "10px 12px",
  borderBottom: "1px solid #2c3037",
  background: "rgba(255,255,255,.02)",
};

const td = {
  color: "#E9E9EC",
  padding: "10px 12px",
  borderBottom: "1px solid #232830",
};