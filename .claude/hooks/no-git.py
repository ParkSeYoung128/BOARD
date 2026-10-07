#!/usr/bin/env python3
"""PreToolUse 훅 (Bash): git 상태를 바꾸는 명령과 PR 생성을 차단한다.

AGENTS.md의 "에이전트는 git을 하지 않는다"를 지시문이 아니라 장치로 강제한다.
조회(status, diff, log, show, blame)는 허용한다.
exit 2 = 차단(stderr 메시지가 에이전트에게 전달됨), exit 0 = 허용
"""
import json, re, sys

data = json.load(sys.stdin)
if data.get("tool_name") != "Bash":
    sys.exit(0)
cmd = (data.get("tool_input") or {}).get("command", "")

BLOCKED = re.compile(
    r"\bgit\b[^;&|\n]*?\s(commit|push|merge|rebase|reset|checkout|switch|branch|stash|tag|cherry-pick|revert|add|rm|mv|restore|clean)\b"
    r"|\bgh\s+pr\s+(create|merge|edit|close)\b"
    r"|\bgh\s+issue\s+(create|edit|close)\b"
)
if BLOCKED.search(cmd):
    print("차단: git 변경과 PR·이슈 생성은 사람이 직접 합니다. 커밋 메시지나 PR 본문은 텍스트로 제안만 하세요.", file=sys.stderr)
    sys.exit(2)
sys.exit(0)
