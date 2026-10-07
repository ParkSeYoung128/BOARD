import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { countCodePoints } from "@/shared/lib/codepoint";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { CONTENT_MAX_LENGTH, PostForm } from "./PostForm";

function setup(props: Partial<React.ComponentProps<typeof PostForm>> = {}) {
  const onSubmit = vi.fn();
  const view = render(<PostForm heading="글작성" submitLabel="작성 완료" onSubmit={onSubmit} {...props} />);
  return {
    onSubmit,
    ...view,
    title: screen.getByRole("textbox", { name: "제목" }) as HTMLInputElement,
    content: screen.getByRole("textbox", { name: "내용" }) as HTMLTextAreaElement,
    button: screen.getByRole("button", { name: "작성 완료" }),
  };
}

describe("PostForm", () => {
  it("제목과 내용이 모두 있을 때만 버튼이 활성화된다", async () => {
    const { title, content, button } = setup();
    const user = userEvent.setup();

    expect(button).toBeDisabled();
    await user.type(title, "제목");
    expect(button).toBeDisabled();
    await user.type(content, "내용");
    expect(button).toBeEnabled();
    await user.clear(title);
    expect(button).toBeDisabled();
  });

  it("공백만 입력하면 비어 있는 것으로 본다", async () => {
    const { title, content, button } = setup();
    const user = userEvent.setup();

    await user.type(title, "   ");
    await user.type(content, "내용");
    expect(button).toBeDisabled();

    await user.type(title, "제목");
    await user.clear(content);
    await user.type(content, "  \n ");
    expect(button).toBeDisabled();
  });

  it("제목은 코드포인트 20자까지만 입력되고, 이모지 하나는 1자로 센다", async () => {
    const { title } = setup();
    const user = userEvent.setup();

    await user.type(title, "abcdefghijklmnopqrstuvwxyz");
    expect(title.value).toBe("abcdefghijklmnopqrst");

    await user.clear(title);
    fireEvent.change(title, { target: { value: "😀".repeat(25) } });
    expect(countCodePoints(title.value)).toBe(20);
    expect(title.value).toBe("😀".repeat(20));
  });

  it("한글 조합 중에는 자르지 않고, 조합이 끝나면 입력창의 값으로 20자에 맞춘다", () => {
    const { title } = setup();
    const over = "가".repeat(21);

    fireEvent.compositionStart(title);
    fireEvent.change(title, { target: { value: over } });
    expect(title.value).toBe(over);

    fireEvent.compositionEnd(title);
    expect(title.value).toBe("가".repeat(20));
  });

  it("조합 중에 버튼을 눌러도 제목은 20자로 잘려 전송된다", () => {
    const { title, content, button, onSubmit } = setup();
    fireEvent.change(content, { target: { value: "내용" } });
    fireEvent.compositionStart(title);
    fireEvent.change(title, { target: { value: "가".repeat(21) } });

    fireEvent.click(button);

    expect(onSubmit).toHaveBeenCalledWith({ title: "가".repeat(20), content: "내용" });
  });

  it("전송은 원문으로 한다(앞뒤 공백·줄바꿈 유지, 판단에만 trim)", async () => {
    const { title, content, button, onSubmit } = setup();
    await userEvent.setup().type(title, "제목");
    fireEvent.change(content, { target: { value: "  첫 줄\n둘째 줄\n" } });

    fireEvent.click(button);

    expect(onSubmit).toHaveBeenCalledWith({ title: "제목", content: "  첫 줄\n둘째 줄\n" });
  });

  it("내용이 20,000자를 넘으면 자르지 않고 안내를 보여 주며 제출을 막는다", async () => {
    const { title, content, button, onSubmit } = setup();
    await userEvent.setup().type(title, "제목");

    fireEvent.change(content, { target: { value: "a".repeat(CONTENT_MAX_LENGTH + 1) } });

    expect(content.value).toHaveLength(CONTENT_MAX_LENGTH + 1);
    expect(screen.getByRole("alert")).toHaveTextContent("내용은 20,000자까지 입력할 수 있어요.");
    expect(button).toBeDisabled();
    fireEvent.submit(button.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(content, { target: { value: "a".repeat(CONTENT_MAX_LENGTH) } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("제목에서 Enter 를 누르면 제출하지 않고 내용 칸으로 이동한다", async () => {
    const { title, content, onSubmit } = setup();
    const user = userEvent.setup();
    await user.type(title, "제목");
    await user.type(content, "내용");
    await user.click(title);

    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(content).toHaveFocus();
  });

  it("조합 확정 Enter 는 내용 칸으로 이동하지 않는다", () => {
    const { title, content } = setup();
    title.focus();

    const notPrevented = fireEvent.keyDown(title, { key: "Enter", isComposing: true });

    expect(notPrevented).toBe(false);
    expect(content).not.toHaveFocus();
  });

  it("요청 중에는 버튼이 막히고 제출해도 전송하지 않는다", async () => {
    const { title, content, button, onSubmit } = setup({ pending: true });
    await userEvent.setup().type(title, "제목");
    fireEvent.change(content, { target: { value: "내용" } });

    expect(button).toBeDisabled();
    fireEvent.submit(button.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("초기값으로 채우며, 부모가 다른 초기값을 다시 넘겨도 입력 중인 내용을 덮어쓰지 않는다", async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PostForm heading="글수정" submitLabel="수정 완료" initial={{ title: "원래 제목", content: "원래 내용" }} onSubmit={onSubmit} />,
    );
    const title = screen.getByRole("textbox", { name: "제목" }) as HTMLInputElement;
    expect(title.value).toBe("원래 제목");
    expect((screen.getByRole("textbox", { name: "내용" }) as HTMLTextAreaElement).value).toBe("원래 내용");

    await userEvent.setup().type(title, "!");
    rerender(<PostForm heading="글수정" submitLabel="수정 완료" initial={{ title: "서버가 바꾼 제목", content: "서버가 바꾼 내용" }} onSubmit={onSubmit} />);

    expect(title.value).toBe("원래 제목!");
    expect((screen.getByRole("textbox", { name: "내용" }) as HTMLTextAreaElement).value).toBe("원래 내용");
  });
});
