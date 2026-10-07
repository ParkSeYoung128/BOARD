import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makePost } from "@/test/posts";

import { PostCard } from "./PostCard";

const NOW = new Date("2026-09-30T12:00:00Z");

describe("PostCard", () => {
  it("작성자·제목·미리보기·카운트·상대 시간을 보여 주고 상세로 연결한다", () => {
    render(
      <ul>
        <PostCard post={makePost(7, { title: "수분크림 써보신 분 계세요?", content: "살짝 말까 고민 중이에요", author: "glow_note" })} now={NOW} />
      </ul>,
    );

    expect(screen.getByText("glow_note")).toBeInTheDocument();
    expect(screen.getByText("수분크림 써보신 분 계세요?")).toBeInTheDocument();
    expect(screen.getByText("살짝 말까 고민 중이에요")).toBeInTheDocument();
    expect(screen.getByText("1,815")).toBeInTheDocument();
    expect(screen.getByText("294")).toBeInTheDocument();
    expect(screen.getByText("3시간 전")).toHaveAttribute("datetime", "2026-09-30T09:00:00Z");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/posts/7");
  });

  it("아이콘 옆 숫자는 스크린리더가 무엇의 수인지 알 수 있게 숨은 텍스트를 가진다", () => {
    render(
      <ul>
        <PostCard post={makePost(1)} now={NOW} />
      </ul>,
    );
    expect(screen.getByRole("link")).toHaveTextContent("댓글 1,815개");
    expect(screen.getByRole("link")).toHaveTextContent("좋아요 294개");
  });

  it("같은 now 를 쓰면 카드마다 같은 기준으로 시간을 계산한다", () => {
    render(
      <ul>
        <PostCard post={makePost(1, { createdAt: "2026-09-27T12:00:00Z" })} now={NOW} />
        <PostCard post={makePost(2, { createdAt: "2026-09-09T12:00:00Z" })} now={NOW} />
      </ul>,
    );
    expect(screen.getByText("3일 전")).toBeInTheDocument();
    expect(screen.getByText("3주 전")).toBeInTheDocument();
  });
});
