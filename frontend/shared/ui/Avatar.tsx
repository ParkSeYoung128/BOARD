import { avatarSrc } from "@/shared/lib/avatar";

/** 작성자명으로 고정 선택한 아바타. size 는 px 단위 지름. */
export function Avatar({ author, size }: { author: string; size: number }) {
  return (
    // 정적 파일(/public)이고 크기가 고정이라 next/image 의 변환·지연 로딩이 필요 없다.
    <img
      src={avatarSrc(author)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
