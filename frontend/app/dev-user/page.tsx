"use client";

import { useEffect, useState } from "react";

const USERS = ["dewy_day", "glow_note", "demo_user", "calm_skin", "soft_toner", "night_serum", "pore_care", "hydra_log", "plain_face"];

const DEFAULT_USER = "demo_user";

function readCookie(name: string): string | null {
  const hit = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

export default function DevUserPage() {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(readCookie("x-user-id"));
  }, []);

  function select(userId: string) {
    document.cookie = `x-user-id=${encodeURIComponent(userId)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.location.href = "/";
  }

  function clear() {
    document.cookie = "x-user-id=; path=/; max-age=0";
    setCurrent(null);
  }

  return (
    <main style={{ padding: 24, fontFamily: "monospace", maxWidth: 480 }}>
      <h1 style={{ fontSize: 16, marginBottom: 4 }}>개발용 유저 전환</h1>
      <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
        수정하지 마세요. 고르면 <code>x-user-id</code> 쿠키가 설정되고 홈으로 이동합니다.
      </p>

      <p style={{ fontSize: 13 }}>
        현재:{" "}
        <strong>{current ?? `(없음 → 기본값 ${DEFAULT_USER})`}</strong>
      </p>

      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {USERS.map((user) => (
          <button
            key={user}
            onClick={() => select(user)}
            style={{
              padding: "10px 12px",
              textAlign: "left",
              fontFamily: "inherit",
              fontSize: 13,
              border: "1px solid #ddd",
              borderRadius: 6,
              background: user === current ? "#f0f0f0" : "#fff",
              cursor: "pointer",
            }}
          >
            {user}
            {user === DEFAULT_USER ? "  (기본)" : ""}
          </button>
        ))}
      </div>

      <button
        onClick={clear}
        style={{
          marginTop: 16,
          padding: "8px 12px",
          fontFamily: "inherit",
          fontSize: 12,
          border: "1px solid #ddd",
          borderRadius: 6,
          background: "#fff",
          cursor: "pointer",
        }}
      >
        쿠키 삭제
      </button>
    </main>
  );
}
