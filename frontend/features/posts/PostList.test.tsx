import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { activeSentinelCount, intersectAll } from "@/test/intersection-observer";
import { jsonResponse, makePost } from "@/test/posts";
import { renderWithQuery } from "@/test/render";

import { PostList } from "./PostList";
import { postKeys } from "./queries";

type Handler = (url: URL) => Response | Promise<Response>;

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((input: string) => Promise.resolve(handler(new URL(input))));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const PAGE_1 = { items: [makePost(3), makePost(2)], total: 3, nextCursor: "c1" };
const PAGE_2 = { items: [makePost(1)], total: 3, nextCursor: null };

describe("PostList", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("불러오는 동안 스켈레톤을 보여 주고, 끝나면 최신순 카드와 상세 링크를 그린다", async () => {
    stubFetch(() => jsonResponse(PAGE_1));
    renderWithQuery(<PostList />);

    expect(screen.getByRole("status")).toHaveTextContent("게시글을 불러오는 중");

    expect(await screen.findByText("제목 3")).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/posts/3", "/posts/2"]);
    expect(screen.queryByText("마지막 글입니다.")).not.toBeInTheDocument();
  });

  it("글이 하나도 없으면 안내 문구를 보여 준다(total 이 아니라 items 로 판단)", async () => {
    stubFetch(() => jsonResponse({ items: [], total: 0, nextCursor: null }));
    renderWithQuery(<PostList />);

    expect(await screen.findByText("아직 게시글이 없어요.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("첫 페이지 오류는 전체 오류 화면을 보여 주고, 다시 시도하면 목록으로 바뀐다", async () => {
    let fail = true;
    stubFetch(() => (fail ? jsonResponse({ code: "INTERNAL", message: "x" }, 500) : jsonResponse(PAGE_2)));
    renderWithQuery(<PostList />);

    expect(await screen.findByText("게시글을 불러오지 못했습니다.")).toBeInTheDocument();

    fail = false;
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("제목 1")).toBeInTheDocument();
    expect(screen.queryByText("게시글을 불러오지 못했습니다.")).not.toBeInTheDocument();
  });

  it("끝까지 내리면 cursor 로 다음 페이지를 이어 붙이고, 마지막 페이지에서는 감시를 멈춘다", async () => {
    const fetchMock = stubFetch((url) => jsonResponse(url.searchParams.get("cursor") === "c1" ? PAGE_2 : PAGE_1));
    renderWithQuery(<PostList />);
    await screen.findByText("제목 3");
    expect(activeSentinelCount()).toBe(1);

    intersectAll();

    expect(await screen.findByText("제목 1")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("cursor")).toBe("c1");
    expect(await screen.findByText("마지막 글입니다.")).toBeInTheDocument();
    expect(activeSentinelCount()).toBe(0);
  });

  it("다음 페이지 요청이 실패하면 목록은 유지하고 감시를 끈 뒤, 다시 시도로 이어서 불러온다", async () => {
    let failNext = true;
    const fetchMock = stubFetch((url) => {
      if (url.searchParams.get("cursor") !== "c1") {
        return jsonResponse(PAGE_1);
      }
      return failNext ? jsonResponse({ code: "INTERNAL", message: "x" }, 500) : jsonResponse(PAGE_2);
    });
    renderWithQuery(<PostList />);
    await screen.findByText("제목 3");

    intersectAll();

    expect(await screen.findByText("더 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByText("제목 3")).toBeInTheDocument();
    expect(activeSentinelCount()).toBe(0);
    const callsAfterFailure = fetchMock.mock.calls.length;
    intersectAll();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFailure);

    failNext = false;
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("제목 1")).toBeInTheDocument();
    expect(screen.queryByText("더 불러오지 못했습니다.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("목록이 보이는 상태에서 재조회가 실패해도 오류 화면으로 바뀌지 않는다", async () => {
    let fail = false;
    stubFetch(() => (fail ? jsonResponse({ code: "INTERNAL", message: "x" }, 500) : jsonResponse(PAGE_2)));
    const { client } = renderWithQuery(<PostList />);
    await screen.findByText("제목 1");

    fail = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: postKeys.list() });
    });

    await waitFor(() => expect(client.getQueryState(postKeys.list())?.status).toBe("error"));
    expect(screen.getByText("제목 1")).toBeInTheDocument();
    expect(screen.queryByText("게시글을 불러오지 못했습니다.")).not.toBeInTheDocument();
  });
});
