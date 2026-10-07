import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@/shared/store/toast";
import { jsonResponse, makePost } from "@/test/posts";
import { renderWithQuery } from "@/test/render";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { PostEdit } from "./PostEdit";
import { postKeys } from "./queries";
import { PostWrite } from "./PostWrite";
import type { Post } from "./types";

type Handler = (method: string, path: string, body: unknown) => Response | Promise<Response>;

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    const path = new URL(input).pathname.replace(/^\/api/, "");
    return Promise.resolve(handler(init?.method ?? "GET", path, init?.body ? JSON.parse(String(init.body)) : undefined));
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

const POST = makePost(1, { title: "원래 제목", content: "원래 내용", author: "medi99", likeCount: 42, commentCount: 7 });
const ERROR_500 = () => jsonResponse({ code: "INTERNAL", message: "x" }, 500);

function listOf(...items: Post[]) {
  return { pages: [{ items, total: items.length, nextCursor: null }], pageParams: [null] };
}

function loginAs(userId: string) {
  document.cookie = `x-user-id=${encodeURIComponent(userId)}; path=/`;
}

afterEach(() => {
  document.cookie = "x-user-id=; path=/; max-age=0";
  useToast.getState().hide();
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PostWrite", () => {
  async function fill(title = "새 글 제목", content = "새 글 내용") {
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "제목" }), title);
    await user.type(screen.getByRole("textbox", { name: "내용" }), content);
    return user;
  }

  it("작성하면 서버에 보내고, 목록 캐시를 비운 뒤 토스트와 함께 목록으로 replace 이동한다", async () => {
    const fetchMock = stubFetch(() => jsonResponse({ ...POST, id: 99 }, 201));
    const { client } = renderWithQuery(<PostWrite />, (c) => c.setQueryData(postKeys.list(), listOf(POST)));
    const user = await fill();

    await user.click(screen.getByRole("button", { name: "작성 완료" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/posts$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ title: "새 글 제목", content: "새 글 내용" });
    expect(useToast.getState().message).toBe("게시글이 등록되었습니다.");
    expect(router.push).not.toHaveBeenCalled();
    expect(client.getQueryData(postKeys.list())).toBeUndefined();
  });

  it("요청 중에는 버튼이 막혀 같은 글이 두 번 등록되지 않는다", async () => {
    const gate = deferred<Response>();
    const fetchMock = stubFetch(() => gate.promise);
    renderWithQuery(<PostWrite />);
    const user = await fill();

    await user.click(screen.getByRole("button", { name: "작성 완료" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "작성 완료" })).toBeDisabled());
    fireEvent.submit(screen.getByRole("form", { name: "글작성" }));

    expect(callsOf(fetchMock, "POST")).toBe(1);
    await act(async () => {
      gate.resolve(jsonResponse({ ...POST, id: 99 }, 201));
    });
  });

  it("실패하면 토스트를 띄우고 이동하지 않으며 입력은 그대로 둔다", async () => {
    stubFetch(ERROR_500);
    const { client } = renderWithQuery(<PostWrite />, (c) => c.setQueryData(postKeys.list(), listOf(POST)));
    const user = await fill();

    await user.click(screen.getByRole("button", { name: "작성 완료" }));

    await waitFor(() => expect(useToast.getState().message).toBe("게시글을 등록하지 못했습니다."));
    expect(router.replace).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox", { name: "제목" }) as HTMLInputElement).value).toBe("새 글 제목");
    expect((screen.getByRole("textbox", { name: "내용" }) as HTMLTextAreaElement).value).toBe("새 글 내용");
    expect(screen.getByRole("button", { name: "작성 완료" })).toBeEnabled();
    expect(client.getQueryData(postKeys.list())).toBeDefined();
  });
});

describe("PostEdit", () => {
  const titleBox = () => screen.getByRole("textbox", { name: "제목" }) as HTMLInputElement;
  const contentBox = () => screen.getByRole("textbox", { name: "내용" }) as HTMLTextAreaElement;

  it("서버 응답이 도착하기 전에는 폼을 그리지 않고, 도착하면 서버 값으로 채운다(목록 캐시의 오래된 값이 아니라)", async () => {
    loginAs("medi99");
    const detail = deferred<Response>();
    stubFetch(() => detail.promise);
    renderWithQuery(<PostEdit postId={1} />, (c) =>
      c.setQueryData(postKeys.list(), listOf({ ...POST, title: "오래된 제목", content: "오래된 내용" })),
    );

    expect(screen.queryByRole("textbox", { name: "제목" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("게시글을 불러오는 중");

    detail.resolve(jsonResponse(POST));

    expect(await screen.findByRole("textbox", { name: "제목" })).toHaveValue("원래 제목");
    expect(contentBox()).toHaveValue("원래 내용");
    expect(screen.getByRole("button", { name: "수정 완료" })).toBeEnabled();
  });

  it("수정하면 제목과 내용을 PATCH 로 보내고, 서버가 돌려준 글로 상세·목록 캐시를 교체한 뒤 이동한다", async () => {
    loginAs("medi99");
    const updated = { ...POST, title: "고친 제목", content: "고친 내용", likeCount: 50 };
    const fetchMock = stubFetch((method) => (method === "PATCH" ? jsonResponse(updated) : jsonResponse(POST)));
    const { client } = renderWithQuery(<PostEdit postId={1} />, (c) => c.setQueryData(postKeys.list(), listOf(POST)));
    await screen.findByRole("textbox", { name: "제목" });
    const user = userEvent.setup();

    await user.clear(titleBox());
    await user.type(titleBox(), "고친 제목");
    await user.clear(contentBox());
    await user.type(contentBox(), "고친 내용");
    await user.click(screen.getByRole("button", { name: "수정 완료" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/posts/1"));
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(patch[0]).toMatch(/\/posts\/1$/);
    expect(JSON.parse(String(patch[1]?.body))).toEqual({ title: "고친 제목", content: "고친 내용" });
    expect(useToast.getState().message).toBe("게시글이 수정되었습니다.");
    expect(client.getQueryData<Post>(postKeys.detail(1))).toEqual(updated);
    expect(client.getQueryData<ReturnType<typeof listOf>>(postKeys.list())?.pages[0].items[0]).toEqual(updated);
  });

  it("상세의 수정하기로 들어왔다면(fromDetail) 수정 후 뒤로 이동해 상세가 기록에 두 번 쌓이지 않는다", async () => {
    loginAs("medi99");
    stubFetch((method) => (method === "PATCH" ? jsonResponse({ ...POST, title: "고침" }) : jsonResponse(POST)));
    renderWithQuery(<PostEdit postId={1} fromDetail />);
    await screen.findByRole("textbox", { name: "제목" });

    await userEvent.setup().click(screen.getByRole("button", { name: "수정 완료" }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("그 밖의 경로로 들어왔다면, 브라우저 기록이 길어도 뒤로 가지 않고 상세로 replace 한다", async () => {
    loginAs("medi99");
    // 외부 사이트에서 주소로 바로 들어온 경우처럼 기록은 있지만 직전 항목이 이 글의 상세가 아니다.
    vi.spyOn(window.history, "length", "get").mockReturnValue(5);
    stubFetch((method) => (method === "PATCH" ? jsonResponse({ ...POST, title: "고침" }) : jsonResponse(POST)));
    renderWithQuery(<PostEdit postId={1} />);
    await screen.findByRole("textbox", { name: "제목" });

    await userEvent.setup().click(screen.getByRole("button", { name: "수정 완료" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/posts/1"));
    expect(router.back).not.toHaveBeenCalled();
  });

  it("입력 중에 서버 값이 다시 도착해도 입력한 내용을 덮어쓰지 않는다", async () => {
    loginAs("medi99");
    let server = POST;
    stubFetch(() => jsonResponse(server));
    const { client } = renderWithQuery(<PostEdit postId={1} />);
    await screen.findByRole("textbox", { name: "제목" });
    await userEvent.setup().type(titleBox(), "!!");

    server = { ...POST, title: "다른 곳에서 바뀐 제목", content: "다른 곳에서 바뀐 내용" };
    await act(async () => {
      await client.refetchQueries({ queryKey: postKeys.detail(1) });
      // 쿼리 구독자에게 변경이 전달되는 것은 다음 타이머 턴이다. 그 뒤의 화면을 확인해야 이 테스트가 의미가 있다.
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(client.getQueryData<Post>(postKeys.detail(1))?.title).toBe("다른 곳에서 바뀐 제목");
    expect(titleBox()).toHaveValue("원래 제목!!");
    expect(contentBox()).toHaveValue("원래 내용");
  });

  it("본인 글이 아니면 폼을 보여 주지 않고 상세로 돌려보낸다", async () => {
    loginAs("dewy_day");
    stubFetch(() => jsonResponse(POST));
    renderWithQuery(<PostEdit postId={1} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/posts/1"));
    expect(screen.queryByRole("textbox", { name: "제목" })).not.toBeInTheDocument();
  });

  it("서버가 403 을 돌려주면 토스트를 띄우고 상세로 돌려보낸다", async () => {
    loginAs("medi99");
    stubFetch((method) => (method === "PATCH" ? jsonResponse({ code: "FORBIDDEN", message: "x" }, 403) : jsonResponse(POST)));
    renderWithQuery(<PostEdit postId={1} />);
    await screen.findByRole("textbox", { name: "제목" });

    await userEvent.setup().click(screen.getByRole("button", { name: "수정 완료" }));

    await waitFor(() => expect(useToast.getState().message).toBe("수정 권한이 없습니다."));
    expect(router.replace).toHaveBeenCalledWith("/posts/1");
  });

  it("수정 중 글이 삭제되어 404 가 오면 없는 글 화면을 보여 준다", async () => {
    loginAs("medi99");
    let deleted = false;
    stubFetch((method) => {
      if (method === "PATCH") {
        deleted = true;
        return jsonResponse({ code: "NOT_FOUND", message: "x" }, 404);
      }
      return deleted ? jsonResponse({ code: "NOT_FOUND", message: "x" }, 404) : jsonResponse(POST);
    });
    renderWithQuery(<PostEdit postId={1} />);
    await screen.findByRole("textbox", { name: "제목" });

    await userEvent.setup().click(screen.getByRole("button", { name: "수정 완료" }));

    expect(await screen.findByText("삭제되었거나 존재하지 않는 글입니다.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "제목" })).not.toBeInTheDocument();
  });

  it("그 밖의 실패는 토스트를 띄우고 입력을 유지한다", async () => {
    loginAs("medi99");
    stubFetch((method) => (method === "PATCH" ? ERROR_500() : jsonResponse(POST)));
    renderWithQuery(<PostEdit postId={1} />);
    await screen.findByRole("textbox", { name: "제목" });
    await userEvent.setup().type(titleBox(), "!");

    await userEvent.setup().click(screen.getByRole("button", { name: "수정 완료" }));

    await waitFor(() => expect(useToast.getState().message).toBe("게시글을 수정하지 못했습니다."));
    expect(titleBox()).toHaveValue("원래 제목!");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "수정 완료" })).toBeEnabled();
  });

  it("없는 글이면 없는 글 화면을, 불러오기에 실패하면 다시 시도를 보여 준다", async () => {
    loginAs("medi99");
    stubFetch(() => jsonResponse({ code: "NOT_FOUND", message: "x" }, 404));
    const first = renderWithQuery(<PostEdit postId={1} />);
    expect(await screen.findByText("삭제되었거나 존재하지 않는 글입니다.")).toBeInTheDocument();
    first.unmount();

    stubFetch(ERROR_500);
    renderWithQuery(<PostEdit postId={1} />);
    expect(await screen.findByText("게시글을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
