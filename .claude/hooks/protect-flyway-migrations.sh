#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit): chặn sửa migration Flyway đã commit.
# Migration đã chạy thì không được sửa (Flyway kiểm checksum, backend sẽ không khởi động).
# Vẫn cho tạo migration mới và sửa migration chưa commit.
set -u

file_path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -z "$file_path" ] && exit 0

case "$file_path" in
  */db/migration/V*__*.sql) ;;
  *) exit 0 ;;
esac

[ -e "$file_path" ] || exit 0

dir=$(dirname "$file_path")
if git -C "$dir" ls-files --error-unmatch -- "$file_path" >/dev/null 2>&1; then
  echo "Không được sửa migration Flyway đã commit: $(basename "$file_path"). Hãy tạo migration mới V{n}__*.sql thay vì sửa file cũ." >&2
  exit 2
fi
exit 0
