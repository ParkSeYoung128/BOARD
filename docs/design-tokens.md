# 디자인 토큰 (PNG 12장 픽셀 측정값, 375×778 @1x)

측정 기준: 화면 PNG에서 색상 최빈값과 텍스트/도형 경계를 직접 측정. 글자 크기는 글리프 높이로 **추정**한 값이므로 3단계에서 시안과 겹쳐 보며 보정한다.

## 색상
| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--bg` | `#ffffff` | 배경 |
| `--text-strong` | `#292828` | 제목·본문·헤더·기본 버튼 배경 |
| `--text-body` | `#444343` | 본문 보조 |
| `--text-sub` | `#5f5e5e` | 작성자명(목록) |
| `--text-muted` | `#949393` | 날짜·보조 텍스트(상세) |
| `--text-placeholder` | `#a4aab4` | 미리보기·플레이스홀더 |
| `--gray-300` | `#cbced4` | 아이콘(회색 하트/말풍선), 미리보기 일부 |
| `--gray-200` | `#dadee3` | 비활성 버튼 배경 |
| `--line` | `#eaecee` | 구분선·입력창 테두리·취소 버튼 배경 |
| `--section` | `#f4f6f9` | 상세의 본문/댓글 사이 8px 띠 |
| `--primary` | `#c2102f` | FAB |
| `--like` | `#ff8da1` | 채운 하트(상세) |
| `--dim` | `rgba(0,0,0,.6)` | 팝업·시트 딤 |
| `--toast` | `#4d4d4d` | 토스트 배경(텍스트 흰색) |
| `--btn-cancel-text` | `#979ea9` | 팝업 취소 버튼 글자 |

폰트: Pretendard Variable(제공됨, `globals.css` 적용됨).

## Tailwind v4 `@theme` 매핑
기본 팔레트(`gray-300` 등)와 이름이 겹치지 않도록 의미 기반 이름을 쓴다. 사용 예: `bg-ink`, `text-ink-muted`, `border-line`, `bg-brand`.

```css
@import "tailwindcss";

@theme {
  --font-sans: "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  --color-ink: #292828;            /* --text-strong: 제목·본문·기본 버튼 */
  --color-ink-body: #444343;       /* --text-body */
  --color-ink-sub: #5f5e5e;        /* --text-sub: 작성자명(목록) */
  --color-ink-muted: #949393;      /* --text-muted: 날짜·보조 */
  --color-ink-placeholder: #a4aab4;/* --text-placeholder */
  --color-mist-300: #cbced4;       /* --gray-300: 회색 아이콘 */
  --color-mist-200: #dadee3;       /* --gray-200: 비활성 버튼 */
  --color-line: #eaecee;           /* --line: 구분선·테두리·취소 버튼 배경 */
  --color-section: #f4f6f9;        /* --section: 8px 띠 */
  --color-brand: #c2102f;          /* --primary: FAB */
  --color-like: #ff8da1;           /* 채운 하트 */
  --color-toast: #4d4d4d;          /* 토스트 배경 */
  --color-cancel-text: #979ea9;    /* 팝업 취소 글자 */

  --radius-btn: 12px;              /* 기본·비활성 버튼, 팝업 버튼 */
  --radius-modal: 20px;            /* 팝업·바텀시트 상단 */
  --radius-pill: 20px;             /* 댓글 입력창 */
  --radius-more: 8px;              /* 댓글 더보기 버튼 */
}
```
- 딤은 `bg-black/60`, 앱 셸은 `mx-auto w-full max-w-[375px]`.
- 글자 크기는 아래 화면별 추정값을 임의 값(`text-[14px]` 등)으로 쓰고, 3단계에서 시안과 겹쳐 보며 보정한다.

## 목록 (시안 목록 화면)
- 헤더: 제목 좌 16px, 글리프 높이 18 → **20px bold**, 하단 구분선 y=47 (1px `--line`)
- 카드: 좌우 16px, 카드 간 구분선 1px, 카드 높이 118px(구분선 포함), 첫 카드만 위 8px 추가
  - 행1 아바타 16px 원 + 작성자명 13px (`--text-sub`)
  - 행2 제목 **16px bold** (`--text-strong`), 한 줄 말줄임
  - 행3 미리보기 **14px** (`--text-placeholder`), 한 줄 말줄임
  - 행4 좌: 말풍선 아이콘+댓글 수, 하트 아이콘+좋아요 수 (12–13px, `--gray-300` 톤) / 우: 상대 시간(우측 정렬)
- FAB: 50×50 원, 우 16px·하 49px, `--primary`, 흰색 연필 아이콘
- 토스트: 중앙 정렬 pill(약 170×38, `--toast`), 하단에서 약 80px, 흰 글자 14px

## 상세 (시안 상세 화면)
- 상단 바: 뒤로가기(←) 좌 16px, ⋯(세로 점 3개, 본인 글만) 우 16px, 높이 약 48px
- 제목 18px bold (y≈82), 작성자 영역: 아바타 **36px** + 작성자명 15px bold + 날짜 12px(`--text-muted`, `yy.MM.dd`)
- 본문 14px, 줄 간격 약 18px(문단 사이 빈 줄 유지 — `white-space: pre-wrap`)
- 좋아요 행: 하트 24px + "좋아요 N" 13px, 눌리면 `--like` 하트로 채움
- 본문/댓글 사이 8px 띠 `--section`
- "댓글 (1,411)" 헤더 16px bold, 하단 구분선
- 댓글 행: 아바타 32px, 작성자명 14px bold + 시간 12px(`--text-muted`), 본문 14px, 본인 댓글만 "삭제"(12px `--text-muted`)
- "댓글 더보기 ⌄" 버튼: 좌우 16px, 높이 42px, 1px 테두리, radius 8px, 글자 `#979ea9`
- 하단 고정 입력창: 상단 구분선 + pill(높이 40px, radius 20px, 1px `--line`), 플레이스홀더 "댓글을 입력하세요."; 입력값 있으면 우측에 전송 아이콘(자율 구현)

## 작성/수정 (시안 작성 화면)
- 뒤로가기 좌상단, 헤더 텍스트 "글작성" 14px bold(y≈86)
- 제목 입력: 플레이스홀더 "제목을 입력해 주세요. (최대 20자)", 하단 1px 선(`--line`, 입력 중 `--text-strong`)
- 내용 입력: 플레이스홀더 2문단(요구사항 문구 그대로), 14px, 줄 간격 18px, 전체 높이 확장
- 하단 "작성 완료" 버튼: 좌우 16px, 높이 56px, radius 12px, 활성 `--text-strong`+흰 글자 / 비활성 `--gray-200`+흰 글자

## 팝업·시트
- 삭제 팝업: 딤 위 중앙, 폭 326px, radius 20px, 제목 "삭제하기" 16px bold, 본문 14px `--text-placeholder`(글: "삭제한 글은 복구할 수 없습니다. / 정말 삭제 하시겠습니까?", 댓글: "삭제한 댓글은…"), 버튼 2개(취소 `--line`/예 `--text-strong`) 각 130×56 radius 12px
- 바텀시트(⋯): 하단 시트 상단 radius 20px, 항목 "수정하기"(연필)/"삭제하기"(휴지통) 중앙 정렬 + 구분선, 그 아래 "취소" 전폭 버튼(`--text-strong`, 56px)

## 아이콘 (SVG로 직접 제작)
뒤로가기, ⋯, 말풍선, 하트(선/채움), 연필(FAB·시트), 휴지통, 쉐브론(⌄), 전송. 시안 해상도가 1x이므로 형태만 참고한다.

## 아바타
직접 만든 3종(`/avatar-1..3.png`) 중 **작성자명 해시로 고정 선택**.
