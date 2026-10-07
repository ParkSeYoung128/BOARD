import { PostEdit } from "@/features/posts/PostEdit";
import { PostNotFound } from "@/features/posts/PostNotFound";
import { parsePostId } from "@/features/posts/postId";

/**
 * 글 수정 화면. 주소의 id 가 양의 정수가 아니면 서버에 묻지 않고 "없는 글" 화면을 보여 준다.
 * `?from=detail` 은 상세의 수정하기에서 들어왔다는 표시로, 수정 완료 후 `router.back()` 을 써도 되는지 판단하는 데만 쓴다.
 */
export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const postId = parsePostId((await params).id);
  const fromDetail = (await searchParams).from === "detail";
  return postId === null ? <PostNotFound /> : <PostEdit postId={postId} fromDetail={fromDetail} />;
}
