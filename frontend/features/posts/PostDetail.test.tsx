import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@/shared/store/toast";
import { jsonResponse, makePost } from "@/test/posts";
import { renderWithQuery } from "@/test/render";

import { PostDetail } from "./PostDetail";
import { postKeys } from "./queries";
import type { Post } from "./types";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Handler = (method: string, path: string) => Response | Promise<Response>;

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    const path = new URL(input).pathname.replace(/^\/api/, "");
    const method = init?.method ?? "GET";
    // 댓글 영역은 별도 테스트(CommentSection.test)에서 다루므로, 여기서는 빈 목록으로 응답한다.
    if (method === "GET" && path.endsWith("/comments")) {
      return Promise.resolve(jsonResponse({ items: [], total: 0, nextCursor: null }));
    }
    return Promise.resolve(handler(method, path));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function callsOf(fetchMock: ReturnType<typeof stubFetch>, method: string) {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method).length;
}

const POST = makePost(1, {
  title: "탈모에 좋은 제품 공유해주세요",
  content: "원래도 머리 숱이 많은 편은 아니었는데,\n요새 들어 자꾸 빠지는 것 같아요..",
  author: "medi99",
  likeCount: 42,
  commentCount: 1411,
  createdAt: "2026-08-30T13:55:54Z",
});

function listOf(...items: (typeof POST)[]) {
  return { pages: [{ items, total: items.length, nextCursor: null }], pageParams: [null] };
}

function likedItemOf(client: { getQueryData: <T>(key: readonly unknown[]) => T | undefined }) {
  return client.getQueryData<{ pages: { items: Post[] }[] }>(postKeys.list())?.pages[0].items[0];
}

function loginAs(userId: string) {
  document.cookie = `x-user-id=${encodeURIComponent(userId)}; path=/`;
}

describe("PostDetail", () => {
  afterEach(() => {
    document.cookie = "x-user-id=; path=/; max-age=0";
    useToast.getState().hide();
    router.push.mockClear();
    router.replace.mockClear();
    vi.unstubAllGlobals();
  });

  it("글 본문·작성자·날짜·좋아요 수·댓글 수를 보여 준다", async () => {
    stubFetch(() => jsonResponse(POST));
    renderWithQuery(<PostDetail postId={1} />);

    expect(await screen.findByRole("heading", { name: "탈모에 좋은 제품 공유해주세요" })).toBeInTheDocument();
    expect(screen.getByText("medi99")).toBeInTheDocument();
    expect(screen.getByText("26.08.30")).toBeInTheDocument();
    expect(screen.getByText(/요새 들어 자꾸 빠지는 것 같아요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "좋아요 42" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { name: "댓글 (1,411)" })).toBeInTheDocument();
  });

  it("⋯ 메뉴는 본인 글에만 보인다", async () => {
    stubFetch(() => jsonResponse(POST));

    loginAs("medi99");
    const mine = renderWithQuery(<PostDetail postId={1} />);
    expect(await screen.findByRole("button", { name: "메뉴" })).toBeInTheDocument();
    mine.unmount();

    loginAs("dewy_day");
    renderWithQuery(<PostDetail postId={1} />);
    await screen.findByRole("heading", { name: "탈모에 좋은 제품 공유해주세요" });
    expect(screen.queryByRole("button", { name: "메뉴" })).not.toBeInTheDocument();
  });

  it("목록 캐시에 같은 글이 있으면 응답 전에 먼저 보여 주고, 그동안 좋아요는 막는다", async () => {
    const detail = deferred<Response>();
    stubFetch(() => detail.promise);
    renderWithQuery(<PostDetail postId={1} />, (client) => client.setQueryData(postKeys.list(), listOf(POST)));

    expect(screen.getByRole("heading", { name: "탈모에 좋은 제품 공유해주세요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "좋아요 42" })).toBeDisabled();

    detail.resolve(jsonResponse({ ...POST, likeCount: 45 }));

    expect(await screen.findByRole("button", { name: "좋아요 45" })).toBeEnabled();
  });

  it("좋아요를 누르면 즉시 바뀌고, 서버가 확정한 값으로 상세와 목록 캐시를 덮어쓴다", async () => {
    const toggle = deferred<Response>();
    stubFetch((method) => (method === "POST" ? toggle.promise : jsonResponse(POST)));
    const { client } = renderWithQuery(<PostDetail postId={1} />, (c) => c.setQueryData(postKeys.list(), listOf(POST)));

    const button = await screen.findByRole("button", { name: "좋아요 42" });
    await userEvent.setup().click(button);

    expect(await screen.findByRole("button", { name: "좋아요 43" })).toHaveAttribute("aria-pressed", "true");

    toggle.resolve(jsonResponse({ isLiked: true, likeCount: 50 }));

    expect(await screen.findByRole("button", { name: "좋아요 50" })).toHaveAttribute("aria-pressed", "true");
    const listed = client.getQueryData<{ pages: { items: { id: number; likeCount: number; isLiked: boolean }[] }[] }>(postKeys.list());
    expect(listed?.pages[0].items[0]).toMatchObject({ likeCount: 50, isLiked: true });
  });

  it("연타하면 요청을 순서대로 한 번에 하나씩 보내고, 마지막 응답만 화면과 캐시에 반영한다", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const queue = [first, second];
    const fetchMock = stubFetch((method) => (method === "POST" ? queue.shift()!.promise : jsonResponse(POST)));
    const { client } = renderWithQuery(<PostDetail postId={1} />, (c) => c.setQueryData(postKeys.list(), listOf(POST)));

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "좋아요 42" }));
    await user.click(await screen.findByRole("button", { name: "좋아요 43" }));

    expect(await screen.findByRole("button", { name: "좋아요 42" })).toHaveAttribute("aria-pressed", "false");
    expect(callsOf(fetchMock, "POST")).toBe(1);

    first.resolve(jsonResponse({ isLiked: true, likeCount: 43 }));
    await waitFor(() => expect(callsOf(fetchMock, "POST")).toBe(2));
    expect(screen.getByRole("button", { name: "좋아요 42" })).toHaveAttribute("aria-pressed", "false");

    // 낙관적 값(42)과 다른 서버 값을 돌려줘서, 마지막 응답이 실제로 반영됐는지 구분한다.
    second.resolve(jsonResponse({ isLiked: false, likeCount: 40 }));
    expect(await screen.findByRole("button", { name: "좋아요 40" })).toHaveAttribute("aria-pressed", "false");
    expect(client.getQueryData<Post>(postKeys.detail(1))).toMatchObject({ isLiked: false, likeCount: 40 });
    expect(likedItemOf(client)).toMatchObject({ isLiked: false, likeCount: 40 });
  });

  it("좋아요가 실패하면 토스트를 띄우고 서버 상태로 다시 맞춘다", async () => {
    stubFetch((method) => (method === "POST" ? jsonResponse({ code: "INTERNAL", message: "x" }, 500) : jsonResponse(POST)));
    renderWithQuery(<PostDetail postId={1} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "좋아요 42" }));

    await waitFor(() => expect(useToast.getState().message).toBe("좋아요를 처리하지 못했습니다."));
    expect(await screen.findByRole("button", { name: "좋아요 42" })).toHaveAttribute("aria-pressed", "false");
  });

  it("좋아요도 재조회도 모두 실패하면 낙관적 값을 서버가 확정했던 값으로 되돌린다", async () => {
    let gets = 0;
    stubFetch((method) => {
      if (method === "POST") {
        return jsonResponse({ code: "INTERNAL", message: "x" }, 500);
      }
      return ++gets === 1 ? jsonResponse(POST) : jsonResponse({ code: "INTERNAL", message: "x" }, 500);
    });
    const { client } = renderWithQuery(<PostDetail postId={1} />, (c) => c.setQueryData(postKeys.list(), listOf(POST)));

    await userEvent.setup().click(await screen.findByRole("button", { name: "좋아요 42" }));

    await waitFor(() => expect(useToast.getState().message).toBe("좋아요를 처리하지 못했습니다."));
    await waitFor(() => expect(gets).toBeGreaterThanOrEqual(2));
    expect(await screen.findByRole("button", { name: "좋아요 42" })).toHaveAttribute("aria-pressed", "false");
    expect(client.getQueryData<Post>(postKeys.detail(1))).toMatchObject({ isLiked: false, likeCount: 42 });
    expect(likedItemOf(client)).toMatchObject({ isLiked: false, likeCount: 42 });
  });

  it("연타 중 앞선 요청은 성공하고 뒤의 요청이 실패하면, 앞선 성공은 유지한 채 서버 확정 값으로 되돌린다", async () => {
    const first = deferred<Response>();
    const queue: Promise<Response>[] = [first.promise, Promise.resolve(jsonResponse({ code: "INTERNAL", message: "x" }, 500))];
    let gets = 0;
    stubFetch((method) => {
      if (method === "POST") {
        return queue.shift()!;
      }
      return ++gets === 1 ? jsonResponse(POST) : jsonResponse({ code: "INTERNAL", message: "x" }, 500);
    });
    renderWithQuery(<PostDetail postId={1} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "좋아요 42" }));
    await user.click(await screen.findByRole("button", { name: "좋아요 43" }));
    expect(await screen.findByRole("button", { name: "좋아요 42" })).toBeInTheDocument();

    // 첫 요청은 성공(서버: 좋아요 43), 두 번째는 실패 → 서버 상태는 "좋아요 43"이므로 그 값으로 돌아가야 한다.
    first.resolve(jsonResponse({ isLiked: true, likeCount: 43 }));

    expect(await screen.findByRole("button", { name: "좋아요 43" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(gets).toBeGreaterThanOrEqual(2));
    expect(screen.getByRole("button", { name: "좋아요 43" })).toHaveAttribute("aria-pressed", "true");
  });

  it("상세를 불러온 뒤 재조회가 404 를 돌려주면(다른 곳에서 삭제) 기존 본문을 지우고 없는 글 화면을 보여 준다", async () => {
    let deleted = false;
    stubFetch(() => (deleted ? jsonResponse({ code: "NOT_FOUND", message: "x" }, 404) : jsonResponse(POST)));
    const { client } = renderWithQuery(<PostDetail postId={1} />);
    expect(await screen.findByRole("heading", { name: "탈모에 좋은 제품 공유해주세요" })).toBeInTheDocument();

    deleted = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: postKeys.detail(1) });
    });

    expect(await screen.findByText("삭제되었거나 존재하지 않는 글입니다.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "탈모에 좋은 제품 공유해주세요" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /좋아요/ })).not.toBeInTheDocument();
  });

  it("상세를 불러온 뒤 재조회가 404 가 아닌 오류로 실패하면 기존 본문을 유지한다", async () => {
    let fail = false;
    stubFetch(() => (fail ? jsonResponse({ code: "INTERNAL", message: "x" }, 500) : jsonResponse(POST)));
    const { client } = renderWithQuery(<PostDetail postId={1} />);
    await screen.findByRole("heading", { name: "탈모에 좋은 제품 공유해주세요" });

    fail = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: postKeys.detail(1) });
    });

    await waitFor(() => expect(client.getQueryState(postKeys.detail(1))?.status).toBe("error"));
    expect(screen.getByRole("heading", { name: "탈모에 좋은 제품 공유해주세요" })).toBeInTheDocument();
    expect(screen.queryByText("삭제되었거나 존재하지 않는 글입니다.")).not.toBeInTheDocument();
  });

  it("수정하기를 누르면 수정 화면으로 이동한다", async () => {
    loginAs("medi99");
    stubFetch(() => jsonResponse(POST));
    renderWithQuery(<PostDetail postId={1} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "메뉴" }));
    await user.click(await screen.findByRole("button", { name: "수정하기" }));

    expect(router.push).toHaveBeenCalledWith("/posts/1/edit?from=detail");
  });

  it("삭제 팝업에서 취소하면 삭제하지 않고, 예를 누르면 삭제 후 목록으로 이동하며 목록 캐시를 비운다", async () => {
    loginAs("medi99");
    const fetchMock = stubFetch((method) => (method === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse(POST)));
    const { client } = renderWithQuery(<PostDetail postId={1} />, (c) => c.setQueryData(postKeys.list(), listOf(POST)));

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "메뉴" }));
    await user.click(await screen.findByRole("button", { name: "삭제하기" }));
    expect(await screen.findByText(/정말 삭제 하시겠습니까\?/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByText(/정말 삭제 하시겠습니까\?/)).not.toBeInTheDocument());
    expect(callsOf(fetchMock, "DELETE")).toBe(0);
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "메뉴" }));
    await user.click(await screen.findByRole("button", { name: "삭제하기" }));
    await user.click(await screen.findByRole("button", { name: "예" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(callsOf(fetchMock, "DELETE")).toBe(1);
    expect(client.getQueryData(postKeys.list())).toBeUndefined();
  });

  it("이미 삭제된 글(404)을 지우려 해도 목록으로 이동한다", async () => {
    loginAs("medi99");
    stubFetch((method) =>
      method === "DELETE" ? jsonResponse({ code: "NOT_FOUND", message: "x" }, 404) : jsonResponse(POST),
    );
    renderWithQuery(<PostDetail postId={1} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "메뉴" }));
    await user.click(await screen.findByRole("button", { name: "삭제하기" }));
    await user.click(await screen.findByRole("button", { name: "예" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("삭제가 실패하면 토스트를 띄우고 이동하지 않는다", async () => {
    loginAs("medi99");
    stubFetch((method) =>
      method === "DELETE" ? jsonResponse({ code: "INTERNAL", message: "x" }, 500) : jsonResponse(POST),
    );
    renderWithQuery(<PostDetail postId={1} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "메뉴" }));
    await user.click(await screen.findByRole("button", { name: "삭제하기" }));
    await user.click(await screen.findByRole("button", { name: "예" }));

    await waitFor(() => expect(useToast.getState().message).toContain("삭제하지 못했습니다"));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("없는 글(404)은 안내 문구와 목록으로 가는 링크를 보여 준다", async () => {
    stubFetch(() => jsonResponse({ code: "NOT_FOUND", message: "x" }, 404));
    renderWithQuery(<PostDetail postId={9} />);

    expect(await screen.findByText("삭제되었거나 존재하지 않는 글입니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로" })).toHaveAttribute("href", "/");
  });

  it("그 밖의 오류는 다시 시도를 보여 주고, 누르면 다시 불러온다", async () => {
    let fail = true;
    stubFetch(() => (fail ? jsonResponse({ code: "INTERNAL", message: "x" }, 500) : jsonResponse(POST)));
    renderWithQuery(<PostDetail postId={1} />);

    expect(await screen.findByText("게시글을 불러오지 못했습니다.")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByRole("heading", { name: "탈모에 좋은 제품 공유해주세요" })).toBeInTheDocument();
  });
});
