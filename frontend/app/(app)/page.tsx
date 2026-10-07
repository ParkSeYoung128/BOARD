import { PostList } from "@/features/posts/PostList";
import { WriteFab } from "@/features/posts/WriteFab";
import { Header } from "@/shared/ui/Header";

/** 목록 화면. 서버 컴포넌트로 두고 데이터·상호작용은 클라이언트 컴포넌트(PostList)에 맡긴다. */
export default function HomePage() {
  return (
    <>
      <Header variant="page" title="BOARD" />
      <PostList />
      <WriteFab />
    </>
  );
}
