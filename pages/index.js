import { useState } from "react";

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, "0");
  return m ? `${m}:${sec}` : `${(+s).toFixed(2)}`;
};

export default function Home() {
  const api = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

  const [name, setName] = useState("温心妤");
  const [stroke, setStroke] = useState("");
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);

  async function search(cursor = 0) {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    setLoading(true);
    try {
      const url = `${api}/api/results?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}&limit=50&cursor=${cursor}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setItems(cursor === 0 ? j.items || [] : [...items, ...(j.items || [])]);
      setNext(j.nextCursor ?? null);
    } catch (e) {
      console.error(e);
      alert("查詢失敗");
    } finally {
      setLoading(false);
    }
  }

  async function getPB() {
    if (!api) return alert("未設定 NEXT_PUBLIC_API_URL");
    try {
      const url = `${api}/api/pb?name=${encodeURIComponent(name)}&stroke=${encodeURIComponent(stroke)}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return alert("查無資料");
      const j = await r.json();
      alert(`${name} ${stroke} PB: ${fmt(j.pb_seconds)}（${j.from_meet} ${j.year}，WA ${j.wa}）`);
    } catch (e) {
      console.error(e);
      alert("查 PB 失敗");
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>游泳成績查詢</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8 }}>
        <input placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={stroke} onChange={(e) => setStroke(e.target.value)}>
          <option value="">請選擇泳姿/距離</option>
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

        <button onClick={() => search(0)} disabled={loading}>查詢</button>
        <button onClick={getPB} disabled={loading}>查 PB</button>
      </div>

      <table border="1" cellPadding="6" style={{ marginTop: 16, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>年份</th><th>賽事名稱</th><th>項目</th><th>姓名</th><th>成績</th><th>名次</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i}>
              <td>{r["年份"]}</td>
              <td>{r["賽事名稱"]}</td>
              <td>{r["項目"]}</td>
              <td>{r["姓名"]}</td>
              <td>{r["成績"]}</td>
              <td>{r["名次"]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {next != null && (
        <button onClick={() => search(next)} style={{ marginTop: 12 }} disabled={loading}>
          載入更多
        </button>
      )}
    </main>
  );
}