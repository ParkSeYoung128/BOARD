import { PostDetail } from "@/features/posts/PostDetail";
import { PostNotFound } from "@/features/posts/PostNotFound";
import { parsePostId } from "@/features/posts/postId";

/** 게시글 상세. 주소의 id 가 양의 정수가 아니면 서버에 묻지 않고 "없는 글" 화면을 보여 준다. */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const postId = parsePostId((await params).id);
  return postId === null ? <PostNotFound /> : <PostDetail postId={postId} />;
}
