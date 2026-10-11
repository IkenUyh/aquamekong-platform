#!/usr/bin/env bash
# ============================================
# Cập nhật production lên một commit đã có image trên GHCR.
#   ./deploy/deploy.sh <commit-sha>     (GitHub Actions gọi sau khi đẩy image)
#   ./deploy/deploy.sh                  (chạy tay: giữ IMAGE_TAG trong .env, chỉ kéo và khởi động lại)
# Quay về bản cũ: ./deploy/deploy.sh <sha của bản cũ>
# ============================================
set -euo pipefail

# Cả script nằm trong main: git checkout bên dưới có thể đổi chính file này giữa chừng,
# nên bash phải đọc hết trước khi chạy
main() {
    cd "$(dirname "${BASH_SOURCE[0]}")/.."
    COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

    if [ ! -f .env ]; then
        echo "Thiếu .env: cp deploy/.env.production.example .env rồi điền giá trị" >&2
        exit 1
    fi

    if [ $# -ge 1 ]; then
        sha="$1"
        # Compose file, Caddyfile và script khớp với image của commit đó
        git fetch --quiet origin
        git checkout --quiet --detach "$sha"
        if grep -q '^IMAGE_TAG=' .env; then
            sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$sha/" .env
        else
            echo "IMAGE_TAG=$sha" >> .env
        fi
    fi

    # Thư mục mount vào ml-service phải có trước (không thì Docker tạo với chủ root) và ghi được bởi uid 10001
    mkdir -p data/inbox data/features
    chmod -R a+rwX data/inbox data/features

    "${COMPOSE[@]}" pull --quiet
    "${COMPOSE[@]}" up -d --remove-orphans
    # Xoá image cũ không còn container nào dùng, để ổ 30 GB không đầy dần
    docker image prune -f > /dev/null

    "${COMPOSE[@]}" ps
}

main "$@"
exit
