import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { postKeys } from "@/features/posts/queries";
import type { Post } from "@/features/posts/types";
import { useToast } from "@/shared/store/toast";
import { activeSentinelCount, intersectAll } from "@/test/intersection-observer";
import { jsonResponse, makePost } from "@/test/posts";
import { renderWithQuery } from "@/test/render";

import { CommentSection } from "./CommentSection";
import { commentKeys } from "./keys";
import type { Comment } from "./types";

function makeComment(id: number, overrides: Partial<Comment> = {}): Comment {
  return { id, postId: 1, content: `댓글 ${id}`, author: "soft_toner", createdAt: "2026-09-30T11:00:00Z", ...overrides };
}

/** 최신순으로 정렬된 댓글 N개(id 가 큰 것이 최신). */
function commentsOf(count: number, overrides: Partial<Comment> = {}) {
  return Array.from({ length: count }, (_, index) => makeComment(count - index, overrides));
}

type Request = { method: string; path: string; params: URLSearchParams; body: unknown };

/**
 * 댓글 API 를 흉내 내는 서버. 목록은 offset 을 커서로 쓰는 단순한 구현이며(클라이언트는 커서를 해석하지 않는다),
 * `intercept` 로 특정 요청만 실패시키거나 늦출 수 있다.
 */
function stubServer(initial: Comment[], intercept?: (request: Request) => Response | Promise<Response> | undefined) {
  const state = { comments: [...initial], requests: [] as Request[] };
  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    const url = new URL(input);
    const request: Request = {
      method: init?.method ?? "GET",
      path: url.pathname.replace(/^\/api/, ""),
      params: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    state.requests.push(request);

    const intercepted = intercept?.(request);
    if (intercepted) {
      return Promise.resolve(intercepted);
    }
    if (request.method === "GET") {
      const limit = Number(request.params.get("limit"));
      const offset = Number(request.params.get("cursor") ?? 0);
      const end = offset + limit;
      return Promise.resolve(
        jsonResponse({
          items: state.comments.slice(offset, end),
          total: state.comments.length,
          nextCursor: end < state.comments.length ? String(end) : null,
        }),
      );
    }
    if (request.method === "POST") {
      const created = makeComment(Math.max(0, ...state.comments.map((c) => c.id)) + 1, {
        author: "me",
        content: (request.body as { content: string }).content,
      });
      state.comments.unshift(created);
      return Promise.resolve(jsonResponse(created, 201));
    }
    const id = Number(request.path.split("/").pop());
    state.comments = state.comments.filter((comment) => comment.id !== id);
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { state, fetchMock };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const POST = makePost(1, { commentCount: 3 });
const ERROR_500 = () => jsonResponse({ code: "INTERNAL", message: "x" }, 500);

function listOf(...items: Post[]) {
  return { pages: [{ items, total: items.length, nextCursor: null }], pageParams: [null] };
}

function renderSection(prepare?: Parameters<typeof renderWithQuery>[1]) {
  return renderWithQuery(<CommentSection postId={1} />, (client) => {
    client.setQueryData(postKeys.detail(1), POST);
    client.setQueryData(postKeys.list(), listOf(POST));
    prepare?.(client);
  });
}

function loginAs(userId: string) {
  document.cookie = `x-user-id=${encodeURIComponent(userId)}; path=/`;
}

function requestsOf(server: ReturnType<typeof stubServer>, method: string) {
  return server.state.requests.filter((request) => request.method === method);
}

function cachedCommentCount(client: ReturnType<typeof renderSection>["client"]) {
  return {
    detail: client.getQueryData<Post>(postKeys.detail(1))?.commentCount,
    list: client.getQueryData<ReturnType<typeof listOf>>(postKeys.list())?.pages[0].items[0].commentCount,
  };
}

describe("CommentSection", () => {
  afterEach(() => {
    document.cookie = "x-user-id=; path=/; max-age=0";
    useToast.getState().hide();
    vi.unstubAllGlobals();
  });

  describe("목록", () => {
    it("처음에는 limit=2 로 2개만 요청해 보여 주고, 총 개수가 2개를 넘으면 더보기를 보여 준다", async () => {
      const server = stubServer(commentsOf(5));
      renderSection();

      expect(await screen.findByText("댓글 5")).toBeInTheDocument();
      expect(screen.getByText("댓글 4")).toBeInTheDocument();
      expect(screen.queryByText("댓글 3")).not.toBeInTheDocument();
      expect(server.state.requests).toHaveLength(1);
      expect(server.state.requests[0].params.get("limit")).toBe("2");
      expect(server.state.requests[0].params.has("cursor")).toBe(false);
      expect(screen.getByRole("button", { name: "댓글 더보기" })).toBeInTheDocument();
    });

    it("총 개수가 2개 이하면 더보기를 보여 주지 않는다", async () => {
      stubServer(commentsOf(2));
      renderSection();

      expect(await screen.findByText("댓글 2")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "댓글 더보기" })).not.toBeInTheDocument();
    });

    it("댓글이 하나도 없으면 안내 문구를 보여 준다", async () => {
      stubServer([]);
      renderSection();

      expect(await screen.findByText("아직 댓글이 없어요.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "댓글 더보기" })).not.toBeInTheDocument();
    });

    it("더보기를 누르면 cursor 와 limit=20 으로 이어서 불러오고 버튼은 사라진다", async () => {
      const server = stubServer(commentsOf(5));
      renderSection();
      await screen.findByText("댓글 5");

      await userEvent.setup().click(screen.getByRole("button", { name: "댓글 더보기" }));

      expect(await screen.findByText("댓글 1")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
        expect.arrayContaining(["댓글 5", "댓글 4", "댓글 3", "댓글 2", "댓글 1"].map((text) => expect.stringContaining(text))),
      );
      const second = server.state.requests[1];
      expect(second.params.get("cursor")).toBe("2");
      expect(second.params.get("limit")).toBe("20");
      expect(screen.queryByRole("button", { name: "댓글 더보기" })).not.toBeInTheDocument();
    });

    it("더보기 이후에는 스크롤(센티널)로 20개씩 이어 불러오고, 끝나면 더 요청하지 않는다", async () => {
      const server = stubServer(commentsOf(45));
      renderSection();
      await screen.findByText("댓글 45");
      expect(activeSentinelCount()).toBe(0);

      await userEvent.setup().click(screen.getByRole("button", { name: "댓글 더보기" }));
      await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(22));
      await waitFor(() => expect(activeSentinelCount()).toBe(1));

      intersectAll();
      await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(42));
      await waitFor(() => expect(activeSentinelCount()).toBe(1));

      intersectAll();
      await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(45));
      await waitFor(() => expect(activeSentinelCount()).toBe(0));

      expect(server.state.requests.map((request) => request.params.get("limit"))).toEqual(["2", "20", "20", "20"]);
    });

    it("첫 페이지 오류는 댓글 영역에 오류를 보여 주고, 다시 시도하면 목록으로 바뀐다", async () => {
      let fail = true;
      stubServer(commentsOf(2), () => (fail ? ERROR_500() : undefined));
      renderSection();

      expect(await screen.findByText("댓글을 불러오지 못했습니다.")).toBeInTheDocument();

      fail = false;
      await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));

      expect(await screen.findByText("댓글 2")).toBeInTheDocument();
    });

    it("다음 페이지 오류는 불러온 댓글을 유지하고, 다시 시도하면 이어서 불러온다", async () => {
      let fail = false;
      stubServer(commentsOf(5), (request) => (fail && request.params.has("cursor") ? ERROR_500() : undefined));
      renderSection();
      await screen.findByText("댓글 5");

      fail = true;
      await userEvent.setup().click(screen.getByRole("button", { name: "댓글 더보기" }));

      expect(await screen.findByText("댓글을 더 불러오지 못했습니다.")).toBeInTheDocument();
      expect(screen.getByText("댓글 5")).toBeInTheDocument();
      expect(activeSentinelCount()).toBe(0);

      fail = false;
      await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));

      expect(await screen.findByText("댓글 1")).toBeInTheDocument();
    });

    it("이미 여러 페이지를 불러온 캐시로 다시 열어도(뒤로·앞으로 이동) 더보기 없이 스크롤로 이어서 불러온다", async () => {
      const all = commentsOf(45);
      const server = stubServer(all);
      renderSection((client) =>
        client.setQueryData(commentKeys.list(1), {
          pages: [
            { items: all.slice(0, 2), total: 45, nextCursor: "2" },
            { items: all.slice(2, 22), total: 45, nextCursor: "22" },
          ],
          pageParams: [null, "2"],
        }),
      );

      // 캐시된 22개가 곧바로 보이고, 이미 펼쳐진 목록이므로 "댓글 더보기"는 없다.
      expect(screen.getAllByRole("listitem")).toHaveLength(22);
      expect(screen.queryByRole("button", { name: "댓글 더보기" })).not.toBeInTheDocument();
      await waitFor(() => expect(activeSentinelCount()).toBe(1));

      intersectAll();
      await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(42));
      expect(screen.queryByRole("button", { name: "댓글 더보기" })).not.toBeInTheDocument();
      expect(requestsOf(server, "GET").some((request) => request.params.get("cursor") === "22")).toBe(true);
    });

    it("첫 더보기가 실패하면 다시 시도만 보이고 더보기 버튼은 함께 보이지 않는다", async () => {
      stubServer(commentsOf(5), (request) => (request.params.has("cursor") ? ERROR_500() : undefined));
      renderSection();
      await screen.findByText("댓글 5");

      await userEvent.setup().click(screen.getByRole("button", { name: "댓글 더보기" }));

      expect(await screen.findByText("댓글을 더 불러오지 못했습니다.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "댓글 더보기" })).not.toBeInTheDocument();
    });

    it("삭제 버튼은 본인 댓글에만 보인다", async () => {
      loginAs("me");
      stubServer([makeComment(2, { author: "me" }), makeComment(1, { author: "soft_toner" })]);
      renderSection();
      await screen.findByText("댓글 2");

      const items = screen.getAllByRole("listitem");
      expect(within(items[0]).getByRole("button", { name: "삭제" })).toBeInTheDocument();
      expect(within(items[1]).queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
    });
  });

  describe("작성", () => {
    it("내용이 있을 때만 전송 아이콘이 보이고, 공백뿐이면 보이지 않는다", async () => {
      stubServer([]);
      renderSection();
      const input = await screen.findByRole("textbox", { name: "댓글 입력" });
      const user = userEvent.setup();

      expect(input).toHaveAttribute("placeholder", "댓글을 입력하세요.");
      expect(screen.queryByRole("button", { name: "댓글 등록" })).not.toBeInTheDocument();

      await user.type(input, "   ");
      expect(screen.queryByRole("button", { name: "댓글 등록" })).not.toBeInTheDocument();

      await user.type(input, "안녕");
      expect(screen.getByRole("button", { name: "댓글 등록" })).toBeInTheDocument();
    });

    it("등록하면 앞뒤 공백을 뺀 내용을 보내고, 새 댓글이 맨 위에 나타나며 입력창이 비워진다. 글의 댓글 수도 올라간다", async () => {
      loginAs("me");
      const server = stubServer(commentsOf(3));
      const { client } = renderSection();
      await screen.findByText("댓글 3");
      const input = screen.getByRole("textbox", { name: "댓글 입력" });
      const user = userEvent.setup();

      await user.type(input, "  새 댓글입니다  ");
      await user.click(screen.getByRole("button", { name: "댓글 등록" }));

      await waitFor(() => expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("새 댓글입니다"));
      expect(requestsOf(server, "POST")[0].body).toEqual({ content: "새 댓글입니다" });
      expect(input).toHaveValue("");
      expect(screen.queryByRole("button", { name: "댓글 등록" })).not.toBeInTheDocument();
      expect(cachedCommentCount(client)).toEqual({ detail: 4, list: 4 });
      // 새 댓글이 들어와도 첫 페이지는 계속 2개, 나머지는 더보기 뒤에 있다.
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "댓글 더보기" })).toBeInTheDocument();
    });

    it("엔터로도 등록한다", async () => {
      const server = stubServer([]);
      renderSection();
      await screen.findByText("아직 댓글이 없어요.");

      await userEvent.setup().type(screen.getByRole("textbox", { name: "댓글 입력" }), "엔터로 등록{Enter}");

      await waitFor(() => expect(requestsOf(server, "POST")).toHaveLength(1));
      expect(await screen.findByText("엔터로 등록", { selector: "p" })).toBeInTheDocument();
    });

    it("한글 조합 중 엔터는 제출하지 않는다", async () => {
      const server = stubServer([]);
      renderSection();
      await screen.findByText("아직 댓글이 없어요.");
      const input = screen.getByRole("textbox", { name: "댓글 입력" });
      await userEvent.setup().type(input, "안녕");

      const notPrevented = fireEvent.keyDown(input, { key: "Enter", isComposing: true });

      expect(notPrevented).toBe(false);
      expect(requestsOf(server, "POST")).toHaveLength(0);
    });

    it("등록 중에는 전송이 막혀 같은 내용이 두 번 등록되지 않는다", async () => {
      const gate = deferred<Response>();
      let blocked = true;
      const server = stubServer([], (request) => (request.method === "POST" && blocked ? gate.promise : undefined));
      renderSection();
      await screen.findByText("아직 댓글이 없어요.");
      const user = userEvent.setup();

      await user.type(screen.getByRole("textbox", { name: "댓글 입력" }), "한 번만");
      await user.click(screen.getByRole("button", { name: "댓글 등록" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "댓글 등록" })).toBeDisabled());
      await user.click(screen.getByRole("button", { name: "댓글 등록" }));
      await user.type(screen.getByRole("textbox", { name: "댓글 입력" }), "{Enter}");

      expect(requestsOf(server, "POST")).toHaveLength(1);

      blocked = false;
      await act(async () => {
        gate.resolve(jsonResponse(makeComment(1, { content: "한 번만", author: "me" }), 201));
      });
    });

    it("등록에 실패하면 토스트를 띄우고 입력한 내용은 그대로 둔다", async () => {
      stubServer([], (request) => (request.method === "POST" ? ERROR_500() : undefined));
      const { client } = renderSection();
      await screen.findByText("아직 댓글이 없어요.");
      const input = screen.getByRole("textbox", { name: "댓글 입력" });
      const user = userEvent.setup();

      await user.type(input, "실패할 댓글");
      await user.click(screen.getByRole("button", { name: "댓글 등록" }));

      await waitFor(() => expect(useToast.getState().message).toBe("댓글을 등록하지 못했습니다."));
      expect(input).toHaveValue("실패할 댓글");
      expect(cachedCommentCount(client)).toEqual({ detail: 3, list: 3 });
    });
  });

  describe("삭제", () => {
    function setup(comments: Comment[]) {
      loginAs("me");
      const server = stubServer(comments);
      const rendered = renderSection();
      return { server, ...rendered };
    }

    it("확인 팝업에서 취소하면 삭제 요청을 보내지 않는다", async () => {
      const { server } = setup([makeComment(1, { author: "me" })]);
      await screen.findByText("댓글 1");
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "삭제" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/삭제한 댓글은 복구할 수 없습니다/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "취소" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(requestsOf(server, "DELETE")).toHaveLength(0);
      expect(screen.getByText("댓글 1")).toBeInTheDocument();
    });

    it("예를 누르면 삭제하고 목록에서 사라지며 글의 댓글 수가 줄어든다", async () => {
      const { server, client } = setup([makeComment(2, { author: "me" }), makeComment(1, { author: "other" })]);
      await screen.findByText("댓글 2");
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "삭제" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "예" }));

      await waitFor(() => expect(screen.queryByText("댓글 2")).not.toBeInTheDocument());
      expect(requestsOf(server, "DELETE")[0].path).toBe("/comments/2");
      expect(screen.getByText("댓글 1")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(cachedCommentCount(client)).toEqual({ detail: 2, list: 2 });
    });

    it("첫 페이지에서 하나를 지워도 뒤에 남은 댓글을 가져와 더보기를 유지한다", async () => {
      const { server } = setup([
        makeComment(3, { author: "me" }),
        makeComment(2, { author: "other" }),
        makeComment(1, { author: "other" }),
      ]);
      await screen.findByText("댓글 3");
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "삭제" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "예" }));

      // 지운 뒤 첫 페이지를 다시 조회하므로, 남은 두 댓글이 모두 보이고 더보기는 필요 없다.
      expect(await screen.findByText("댓글 1")).toBeInTheDocument();
      expect(screen.getByText("댓글 2")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "댓글 더보기" })).not.toBeInTheDocument();
      expect(requestsOf(server, "GET").length).toBeGreaterThanOrEqual(2);
    });

    it("이미 삭제된 댓글(404)은 성공으로 보고 목록에서 지운다", async () => {
      loginAs("me");
      const server: ReturnType<typeof stubServer> = stubServer([makeComment(1, { author: "me" })], (request) => {
        if (request.method !== "DELETE") {
          return undefined;
        }
        // 다른 곳에서 이미 지워진 상황: 서버에는 댓글이 없고 삭제 요청은 404 를 돌려준다.
        server.state.comments = [];
        return jsonResponse({ code: "NOT_FOUND", message: "x" }, 404);
      });
      const { client } = renderSection();
      await screen.findByText("댓글 1");
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "삭제" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "예" }));

      await waitFor(() => expect(screen.queryByText("댓글 1")).not.toBeInTheDocument());
      expect(useToast.getState().message).toBeNull();
      expect(cachedCommentCount(client)).toEqual({ detail: 2, list: 2 });
    });

    it("삭제에 실패하면 토스트를 띄우고 댓글과 댓글 수는 그대로 둔다", async () => {
      loginAs("me");
      stubServer([makeComment(1, { author: "me" })], (request) => (request.method === "DELETE" ? ERROR_500() : undefined));
      const { client } = renderSection();
      await screen.findByText("댓글 1");
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "삭제" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "예" }));

      await waitFor(() => expect(useToast.getState().message).toBe("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요."));
      expect(screen.getByText("댓글 1")).toBeInTheDocument();
      expect(cachedCommentCount(client)).toEqual({ detail: 3, list: 3 });
    });
  });
});
