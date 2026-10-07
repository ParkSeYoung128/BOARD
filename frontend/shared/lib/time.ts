const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 댓글은 이 기간 미만이면 상대 시간, 그 이후는 날짜로 표기한다(요구사항에 없는 자율 결정). */
export const COMMENT_RELATIVE_DAYS = 30;

/**
 * 상대 시간. 방금 전(1분 미만) / N분 전 / N시간 전 / N일 전(1~6일) / N주 전(7~29일) /
 * N개월 전(30~364일) / N년 전(365일~). 현재 시각보다 미래면(시계 오차) 방금 전으로 본다.
 */
export function formatRelative(createdAt: string | Date, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  if (diff < MINUTE) {
    return "방금 전";
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)}분 전`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)}시간 전`;
  }
  const days = Math.floor(diff / DAY);
  if (days < 7) {
    return `${days}일 전`;
  }
  if (days < 30) {
    return `${Math.floor(days / 7)}주 전`;
  }
  if (days < 365) {
    return `${Math.floor(days / 30)}개월 전`;
  }
  return `${Math.floor(days / 365)}년 전`;
}

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

/** `yy.MM.dd` (Asia/Seoul 고정). 예: 26.08.30 */
export function formatDate(createdAt: string | Date): string {
  const parts = dateFormatter.formatToParts(new Date(createdAt));
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}.${pick("month")}.${pick("day")}`;
}

/** 댓글 시각: 30일 미만은 상대 시간, 그 이후는 `yy.MM.dd`. */
export function formatCommentTime(createdAt: string | Date, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(createdAt).getTime();
  if (diff < COMMENT_RELATIVE_DAYS * DAY) {
    return formatRelative(createdAt, now);
  }
  return formatDate(createdAt);
}
