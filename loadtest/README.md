# 부하 테스트 (k6)

현재 구조(단일 Spring Boot + PostgreSQL)의 처리 한계와 병목을 수치로 확인하기 위한 스크립트입니다.
측정 결과는 요구사항의 요구가 아니라 설계 결정(예: 어디가 먼저 병목이 되는가)을 설명하기 위한 근거 자료입니다.

## 시나리오

| 스크립트 | 무엇을 보는가 |
| --- | --- |
| `feed.js` | 게시글 목록 keyset 순회(limit=20)와 상세 조회. 읽기 중심 트래픽 |
| `comments.js` | 댓글이 가장 많은 글(시드 기준 약 1,400개)을 화면과 같은 방식(`limit=2` → `cursor`+`limit=20`)과 끝까지 순회(`limit=50`)로 조회. 깊은 페이지에서도 응답 시간이 일정한지 |
| `likes.js` | 같은 글에 (1) 서로 다른 사용자 수백 명이 한꺼번에, (2) 일정 시간 쉬지 않고, (3) 한 사용자가 연타. 핫 로우 락 경합·커넥션 풀 대기·advisory lock 대기, 끝난 뒤 카운트 정합성 |
| `likes_multi.js` | 여러 사용자가 **각자** 같은 글을 쉬지 않고 연타(켜기·끄기가 서로 다른 사용자 사이에서 뒤섞임). `likes.js`의 burst·sustained는 요청마다 새 사용자라 켜기만 하고 spam은 한 사용자뿐이라 비어 있던 경우. 끝난 뒤 카운트 정합성 |
| `mixed.js` | 읽기 55% / 댓글 읽기 20% / 좋아요 15% / 댓글 작성 10%의 혼합 트래픽 |

쓰기는 모두 스크립트가 만든 전용 글에만 하고 끝나면 삭제(soft delete)하므로 시드 데이터의 좋아요·댓글 수는 바뀌지 않습니다.
`feed.js`·`comments.js`·`mixed.js`는 시드가 적재되어 있어야 합니다(없으면 시작 단계에서 오류로 멈춥니다).

## 준비

저장소 루트에서 전체를 띄우고 시드가 적재되었는지 확인합니다.

```
docker compose up -d --build
curl -s http://localhost:8080/health
curl -s "http://localhost:8080/api/posts?limit=1"
```

k6 설치(둘 중 하나)

```
brew install k6
```

또는 설치 없이 Docker로 실행할 수 있습니다(아래 "Docker로 실행").

## 실행

저장소 루트에서 실행합니다. `--summary-export`로 요약 JSON을 `loadtest/results/`에 남깁니다.

```
k6 run --summary-export=loadtest/results/feed.json loadtest/feed.js
k6 run --summary-export=loadtest/results/comments.json loadtest/comments.js
k6 run --summary-export=loadtest/results/likes.json loadtest/likes.js
k6 run --summary-export=loadtest/results/mixed.json loadtest/mixed.js
k6 run --summary-export=loadtest/results/likes_multi.json loadtest/likes_multi.js
```

### Docker로 실행

```
docker run --rm -i -v "$PWD/loadtest:/loadtest" --add-host=host.docker.internal:host-gateway -e BASE_URL=http://host.docker.internal:8080 grafana/k6 run --summary-export=/loadtest/results/feed.json /loadtest/feed.js
```

### 환경 변수

| 변수 | 기본값 | 대상 | 설명 |
| --- | --- | --- | --- |
| `BASE_URL` | `http://localhost:8080` | 전체 | 대상 서버 |
| `VUS` | feed 50 / comments 40(first_view만, deep_walk 8 별도라 실제 48) / likes 200 / mixed 100 | 스크립트별 | 최대 동시 가상 사용자 수(likes는 burst 시나리오의 동시 연결 수) |
| `HOLD` | feed 1m / mixed 2m | feed, mixed | 최대 부하 유지 시간 |
| `SECONDS` | 60 | comments | 시나리오 지속 시간(초) |
| `BURST` | 500 | likes | burst 시나리오의 전체 좋아요 요청 수 |
| `SUSTAINED_VUS`, `SUSTAINED_SECONDS` | 100, 30 | likes | 지속 시나리오의 동시 사용자 수, 시간(초) |
| `SPAM_VUS`, `SPAM_SECONDS` | 10, 20 | likes | 한 사용자 연타 시나리오의 동시 연결 수, 시간(초) |
| `USERS` | 300 | mixed | 혼합 트래픽의 사용자 수 |
| `MULTI_USERS`, `MULTI_ROUNDS`, `MULTI_CONN` | 50, 300, 1 | likes_multi | 동시 사용자 수, 사용자당 토글 횟수(라운드), 사용자당 동시 연결 수(2 이상이면 한 사용자가 연결 여러 개로 동시에 누른다) |

예: 동시 사용자를 늘려 보기

```
k6 run -e VUS=300 -e BURST=1000 loadtest/likes.js
```

## 결과를 읽는 법

- `http_req_duration`의 `p(95)`, `p(99)`와 `http_req_failed`를 봅니다. 평균은 꼬리 지연을 가리므로 표에는 p95를 씁니다.
- 요청별 값은 `name` 태그(`feed_list`, `post_detail`, `comments_first`, `comments_more`, `comments_walk`, `like_burst`, `like_sustained`, `like_spam`, `like_toggle`, `comment_create`)로 나뉘어 임계값 결과 목록에 표시됩니다.
- 스크립트의 임계값은 요구사항 요구가 아니라 초기 가정입니다. 측정한 뒤 근거와 함께 조정합니다.

### 좋아요 정합성 확인 (`likes.js`)

종료 직후 콘솔에 `[검증]` 줄이 출력됩니다. 요약의 사용자 정의 지표(`likes_*_applied`)와 비교합니다.

- burst, sustained: 최종 `likeCount` == `likes_burst_applied` / `likes_sustained_applied`
- spam: 한 사용자의 토글은 켜짐·꺼짐이 번갈아 나오므로 최종 `likeCount` == `likes_spam_applied`를 2로 나눈 나머지

값이 어긋나면 동시성 결함이므로 성능 수치보다 먼저 조사합니다.

### 여러 사용자 연타 정합성 확인 (`likes_multi.js`)

종료 직후 `[검증] multi:` 줄의 최종 `likeCount`가 요약의 `likes_multi_expected_liked`와 같아야 합니다. 사용자마다 성공한 토글 횟수의 홀짝을 사용자 번호의 홀짝에 맞춰 두었으므로(홀수 번호는 켜진 채로 끝남), 요청이 모두 성공했다면 기대값은 `MULTI_USERS`의 절반 올림(기본 50명이면 25)입니다. `checks`가 100%가 아니거나(음수 `likeCount` 포함) 두 값이 다르면 동시성 결함입니다. 사용자당 연결을 늘려 더 거칠게 걸 수도 있습니다.

```
k6 run -e MULTI_CONN=3 loadtest/likes_multi.js
k6 run -e MULTI_USERS=100 -e MULTI_ROUNDS=200 loadtest/likes_multi.js
```

## 측정 시 주의

- k6와 서버·DB가 같은 머신에서 돌면 서로 CPU를 빼앗습니다. 결과는 "이 환경에서의 값"이며 절대 성능이 아닙니다. 가능하면 k6를 다른 머신이나 별도 환경에서 실행하고, 같은 머신이라면 그 사실을 결과와 함께 적습니다.
- 첫 실행은 JIT·커넥션 풀 워밍업 영향이 있으므로 한 번 돌려 본 뒤, 같은 조건으로 3회 이상 측정해서 중앙값을 기록합니다.
- 서버 설정(Hikari 풀 크기 기본 10, Tomcat 스레드 기본 200)을 바꿨다면 바꾼 값을 함께 기록합니다.
- 시드가 오염되었다고 의심되면 볼륨까지 지우고 다시 띄웁니다.

```
docker compose down -v
docker compose up -d --build
```

## 측정 결과

요약과 해석은 저장소 루트 [`README.md`의 "부하 테스트"](../README.md#부하-테스트) 절에 있습니다. 원본은 `results/`에 있습니다.

| 파일 | 내용 |
| --- | --- |
| `{시나리오}-{회차}.json` | `--summary-export` 요약(지표별 p95·p99, 임계값 통과 여부, 사용자 정의 카운터) |
| `{시나리오}-{회차}.log` | 콘솔 출력. 정합성 확인용 `[검증]` 줄이 여기에 있습니다 |
| `likes_multi_u100-{회차}.*` | `likes_multi.js`를 `-e MULTI_USERS=100 -e MULTI_ROUNDS=200`으로 실행한 결과 |

- 각 시나리오를 같은 조건으로 3회 실행했습니다.
- 요약 JSON 의 카운터 `rate`는 **테스트 전체 시간 기준 평균**입니다. `likes.js`처럼 시나리오가 시간차를 두고 이어지는 경우, 시나리오별 처리량은 카운터 값을 그 시나리오의 실행 시간으로 나눠 계산해야 합니다(예: sustained 51,362건 ÷ 30초 ≈ 1,712건/s).
- `thresholds`의 `false`는 "임계값을 넘지 않음(통과)"입니다.
