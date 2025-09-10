// pages/index.js
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

/* ---------- utils ---------- */
const fmtTime = (s) => (s ? (+s).toFixed(2) : "");

// '20250726' -> Date(2025, 07, 26)
const parseYYYYMMDD = (v) => {
  const s = String(v || "");
  const y = +s.slice(0, 4);
  const m = +s.slice(4, 6) - 1;
  const d = +s.slice(6, 8);
  return new Date(y, m, d);
};

// '20250726' -> '25/07'
const xLabel = (v) => {
  const s = String(v || "");
  return `${s.slice(2, 4)}/${s.slice(4, 6)}`;
};

// 簡化賽事名稱（依你提供的規則）
const simplifyMeetName = (raw) => {
  if (!raw) return "";
  let result = String(raw);

  // 去掉前置年份 / 編號
  result = result.replace(/^\d{4}\s*/g, "");
  result = result.replace(/^\d{3}\s*/g, "");

  // 批次替換
  const repl = [
    ["臺中市114年市長盃水上運動競賽(游泳項目)", "台中市長盃"],
    ["全國冬季短水道游泳錦標賽", "全國冬短"],
    ["全國總統盃暨美津濃游泳錦標賽", "全國總統盃"],
    ["全國總統盃暨美津濃分齡游泳錦標賽", "全國總統盃"],
    ["冬季短水道", "冬短"],
    ["全國運動會臺南市游泳代表隊選拔賽", "台南全運會選拔"],
    ["全國青少年游泳錦標賽", "全國青少"],
    ["臺中市議長盃", "台中議長盃"],
    ["臺中市市長盃", "台中市長盃"],
    ["(游泳項目)", ""],
    ["全國E世代青少年", "E世代"],
    ["臺南市市長盃短水道", "台南市長盃"],
    ["臺南市中小學", "台南中小學"],
    ["臺南市委員盃", "台南委員盃"],
    ["臺南市全國運動會游泳選拔賽", "台南全運會選拔"],
    ["游泳錦標賽", ""],
  ];
  for (const [a, b] of repl) result = result.replaceAll(a, b);

  // 移除「xxxx年」前綴（若還殘留）
  result = result.replace(/^.*?年/, "");

  // 收尾空白
  return result.trim();
};

/* ---------- component ---------- */
export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("50公尺蛙式");

  // itemsStroke：目前選擇的泳姿資料（用於趨勢與明細）
  const [itemsStroke, setItemsStroke] = useState([]);
  const [nextStroke, setNextStroke] = useState(null);

  // itemsAll：該選手「所有泳姿」資料（用於四式統計與總覽）
  const [itemsAll, setItemsAll] = useState([]);
  const [loading, setLoading] = useState(false);

  // 取資料（單次）
  async function fetchPage({ name, stroke = "", cursor = 0, limit = 200 }) {
    const url =
      `${api}/api/results?name=${encodeURIComponent(name)}` +
      `&stroke=${encodeURIComponent(stroke)}` +
      `&limit=${limit}&cursor=${cursor}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("fetch error");
    return r.json();
  }

  // 取「所有泳姿」全部頁
  async function fetchAllStrokes(name) {
    let cursor = 0;
    const out = [];
    for (;;) {
      const j = await fetchPage({ name, stroke: "", cursor, limit: 500 });
      if (j.items?.length) out.push(...j.items);
      if (j.nextCursor == null) break;
      cursor = j.nextCursor;
      // 若資料很多可考慮加跳出保護
      if (out.length > 5000) break;
    }
    return out;
  }

  // 查詢：同時抓「目前泳姿」與「全泳姿」
  async function search() {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true);
    try {
      // 目前泳姿（第一頁）
      const j1 = await fetchPage({ name, stroke, cursor: 0, limit: 500 });
      setItemsStroke(j1.items || []);
      setNextStroke(j1.nextCursor ?? null);

      // 全泳姿（全部頁）
      const all = await fetchAllStrokes(name);
      setItemsAll(all);
    } catch (e) {
      console.error(e);
      alert("查詢失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  // 載入更多（目前泳姿）
  async function loadMore() {
    if (nextStroke == null) return;
    const j = await fetchPage({ name, stroke, cursor: nextStroke, limit: 500 });
    setItemsStroke((prev) => [...prev, ...(j.items || [])]);
    setNextStroke(j.nextCursor ?? null);
  }

  /* ---------- 分析（用所有泳姿 itemsAll） ---------- */
  const analysis = useMemo(() => {
    if (!itemsAll.length) return null;

    const secs = itemsAll
      .map((x) => x.seconds)
      .filter((s) => typeof s === "number" && s > 0);
    const avg = secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : 0;
    const best = secs.length ? Math.min(...secs) : 0;

    const styles = ["蛙式", "仰式", "自由式", "蝶式"];
    const byStyle = Object.fromEntries(
      styles.map((s) => [s, { count: 0, pb: null, mostDist: "", mostCount: 0 }])
    );
    const countByStyleDist = Object.fromEntries(
      styles.map((s) => [s, {}])
    );

    for (const it of itemsAll) {
      const cat = String(it["項目"] || "");
      const style = styles.find((k) => cat.includes(k));
      if (!style) continue;

      byStyle[style].count += 1;

      // 取距離（例：'50公尺蛙式' -> '50公尺'）
      const dist = cat.split(style)[0].trim() || "-";
      countByStyleDist[style][dist] =
        (countByStyleDist[style][dist] || 0) + 1;

      // PB
      const sec = it.seconds;
      if (sec > 0 && (byStyle[style].pb == null || sec < byStyle[style].pb)) {
        byStyle[style].pb = sec;
      }
    }

    for (const s of styles) {
      const m = countByStyleDist[s];
      let maxDist = "-",
        maxC = 0;
      for (const d of Object.keys(m)) {
        if (m[d] > maxC) {
          maxC = m[d];
          maxDist = d;
        }
      }
      byStyle[s].mostDist = maxDist;
      byStyle[s].mostCount = maxC;
    }

    return {
      meetCount: itemsAll.length,
      avg,
      best,
      byStyle,
    };
  }, [itemsAll]);

  /* ---------- 趨勢圖（用目前泳姿 itemsStroke） ---------- */
  const trend = useMemo(() => {
    if (!itemsStroke.length) return { data: [], pb: null };
    const data = itemsStroke
      .filter((x) => x.seconds > 0 && x["年份"])
      .map((x) => ({
        x: x["年份"],
        label: xLabel(x["年份"]),
        y: x.seconds,
        d: parseYYYYMMDD(x["年份"]),
      }))
      .sort((a, b) => a.d - b.d);

    let pb = null;
    for (const p of data) if (!pb || p.y < pb.y) pb = p;
    return { data, pb };
  }, [itemsStroke]);

  /* ---------- 明細（最新在上，並簡化賽事名稱） ---------- */
  const detailRows = useMemo(() => {
    return itemsStroke
      .slice()
      .sort((a, b) => b["年份"] - a["年份"]) // 最新在上
      .map((r) => ({
        ymd: r["年份"],
        meet: simplifyMeetName(r["賽事名稱"]),
        sec: r.seconds,
      }));
  }, [itemsStroke]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% -10%, #1f232b 0%, #0f1216 60%, #0a0c10 100%)",
        color: "#E9E9EC",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue"',
        padding: "24px 16px 80px",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 2,
            color: "#E9DDBB",
            textShadow: "0 1px 0 #2a2e35",
            marginBottom: 12,
          }}
        >
          游泳成績查詢
        </h1>

        {/* 搜尋列 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr auto",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="姓名"
            style={inp}
          />
          <select
            value={stroke}
            onChange={(e) => setStroke(e.target.value)}
            style={inp}
          >
            <option value="50公尺自由式">50公尺自由式</option>
            <option value="50公尺蛙式">50公尺蛙式</option>
            <option value="50公尺仰式">50公尺仰式</option>
            <option value="50公尺蝶式">50公尺蝶式</option>
            <option value="100公尺自由式">100公尺自由式</option>
            <option value="100公尺蛙式">100公尺蛙式</option>
            <option value="100公尺仰式">100公尺仰式</option>
            <option value="100公尺蝶式">100公尺蝶式</option>
            <option value="200公尺自由式">200公尺自由式</option>
            <option value="200公尺蛙式">200公尺蛙式</option>
            <option value="200公尺仰式">200公尺仰式</option>
            <option value="200公尺蝶式">200公尺蝶式</option>
            <option value="200公尺混合式">200公尺混合式</option>
          </select>
          <button onClick={search} disabled={loading} style={btn}>
            查詢
          </button>
        </div>

        {/* 成績與專項分析（所有泳姿） */}
        <Card>
          <SectionTitle>成績與專項分析（當前選手，全泳姿）</SectionTitle>
          <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
            <KV label="出賽次數" value={`${analysis?.meetCount ?? 0} 場`} />
            <KV label="平均成績" value={fmtTime(analysis?.avg ?? 0)} />
            <KV label="最佳成績" value={fmtTime(analysis?.best ?? 0)} />
          </div>
        </Card>

        {/* 四式統計（所有泳姿） */}
        <Card>
          <SectionTitle>四式專項統計（不分距離）</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            {["蛙式", "仰式", "自由式", "蝶式"].map((s) => {
              const v = analysis?.byStyle?.[s] || {};
              return (
                <MiniCard key={s}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{s}</div>
                  <KV label="出賽" value={`${v.count ?? 0} 場`} small />
                  <KV
                    label="最多距離"
                    value={`${v.mostDist || "-"}（${v.mostCount || 0}場）`}
                    small
                  />
                  <KV label="PB" value={fmtTime(v.pb)} small />
                </MiniCard>
              );
            })}
          </div>
        </Card>

        {/* 趨勢圖（目前泳姿） */}
        <Card>
          <SectionTitle>成績趨勢（{stroke}）</SectionTitle>
          <div style={{ height: 340, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data} margin={{ top: 10, right: 16, bottom: 6, left: 0 }}>
                <CartesianGrid stroke="#2b2f36" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
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
                  contentStyle={{
                    background: "#15181e",
                    border: "1px solid #2e333b",
                    color: "#E9E9EC",
                  }}
                  formatter={(v) => [fmtTime(v), "成績"]}
                  labelFormatter={(l, p) => `${p?.[0]?.payload?.x}`}
                />
                <Line
                  type="monotone"
                  dataKey="y"
                  stroke="#80A7FF"
                  strokeWidth={2}
                  dot={{ r: 3, stroke: "#0a0c10", strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                {trend.pb && (
                  <ReferenceDot
                    x={trend.pb.label}
                    y={trend.pb.y}
                    r={5}
                    fill="#FF6B6B"
                    stroke="#0a0c10"
                    strokeWidth={1}
                    isFront
                    label={{
                      value: `PB ${fmtTime(trend.pb.y)}`,
                      position: "right",
                      fill: "#FFC7C7",
                      fontSize: 12,
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 詳細成績（最新在上；賽事名稱已簡化） */}
        <Card>
          <SectionTitle>詳細成績（{stroke}）</SectionTitle>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>年份</th>
                <th style={th}>賽事</th>
                <th style={th}>秒數</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.ymd}</td>
                  <td style={td}>{r.meet}</td>
                  <td style={td}>{fmtTime(r.sec)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {nextStroke != null && (
            <button onClick={loadMore} disabled={loading} style={{ ...btn, marginTop: 12 }}>
              載入更多
            </button>
          )}
        </Card>
      </div>
    </main>
  );
}

/* ---------- UI ---------- */
const metal = {
  card:
    "linear-gradient(180deg, rgba(31,35,43,.9), rgba(19,22,27,.98)) padding-box, linear-gradient(180deg, #2b2f36, #14171c) border-box",
  shadow: "0 10px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.02)",
  border: "1px solid transparent",
  radius: 14,
};

const Card = ({ children }) => (
  <section
    style={{
      background: metal.card,
      border: metal.border,
      borderRadius: metal.radius,
      boxShadow: metal.shadow,
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
  color: "white",
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