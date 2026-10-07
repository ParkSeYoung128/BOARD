#!/usr/bin/env python3
"""PreToolUse 훅 (실험용 가드)
- 되돌리기 어려운 git 명령 차단
- 이 실험은 정적 분석만 하므로 Bash 실행과 파일 수정 차단
- 저장소(스냅샷) 밖 파일 읽기 차단: 정답지나 이후 커밋·완성된 README를 보면 실험이 오염된다
exit 2 = 차단(stderr 메시지가 Claude에게 전달됨), exit 0 = 허용
"""
import json, os, re, sys

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
inp = data.get("tool_input", {}) or {}
project = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd())

def block(msg):
    print(msg, file=sys.stderr)
    sys.exit(2)

def inside_project(p):
    if not p:
        return True
    full = os.path.realpath(p if os.path.isabs(p) else os.path.join(project, p))
    return full == project or full.startswith(project + os.sep)

if tool == "Bash":
    cmd = inp.get("command", "")
    if re.search(r"\bgit\s+(commit|push|merge|rebase|reset|checkout|switch|branch)\b", cmd):
        block("차단: git 상태를 바꾸는 명령은 사람이 직접 실행합니다.")
    block("차단: 이 실험은 정적 분석만 합니다. Read/Grep/Glob으로 코드를 읽어 주세요.")

if tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
    block("차단: 이 실험은 읽기 전용입니다. 코드를 수정하지 않습니다.")

if tool in ("Read", "Grep", "Glob"):
    target = inp.get("file_path") or inp.get("path") or ""
    if not inside_project(target):
        block("차단: 실험 중에는 저장소 밖 파일을 읽지 않습니다.")

sys.exit(0)
