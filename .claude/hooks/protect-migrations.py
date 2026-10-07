#!/usr/bin/env python3
"""PreToolUse 훅 (Edit/Write): 이미 존재하는 Flyway 마이그레이션 수정을 차단한다.

적용된 마이그레이션을 고치면 Flyway 체크섬이 어긋난다. 스키마 변경은 새 V{n}__*.sql 파일로 추가한다.
새 파일을 만드는 것은 허용한다.
"""
import json, os, re, sys

data = json.load(sys.stdin)
if data.get("tool_name") not in ("Edit", "Write", "MultiEdit"):
    sys.exit(0)
path = (data.get("tool_input") or {}).get("file_path", "") or ""
if re.search(r"/db/migration/V\d+__[^/]+\.sql$", path.replace("\\", "/")) and os.path.exists(path):
    print("차단: 기존 Flyway 마이그레이션은 수정하지 않습니다. 스키마 변경은 새 V{n}__설명.sql 파일로 추가하세요.", file=sys.stderr)
    sys.exit(2)
sys.exit(0)
