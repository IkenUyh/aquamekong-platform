# Triển khai production (AWS EC2)

GitHub Actions build image, server chỉ kéo về và chạy.

```
merge vào main ──► GitHub Actions: test → build 3 image → đẩy lên GHCR (ghcr.io/ikenuyh/aquamekong-*)
                                                   │
                                                   ▼ SSH
                    EC2 t3.small: deploy/deploy.sh <sha> → docker compose pull && up -d
```

- Máy: EC2 `t3.small` (2 vCPU, 2 GB RAM, x86), Ubuntu 26.04, ổ gp3 30 GB, Singapore, Elastic IP `56.10.164.250`.
- Tên miền: `aquamekong.kienhuy-dev.name.vn`, bản ghi A ở Vietnix trỏ về Elastic IP.
- `docker-compose.prod.yml` ghép đè lên `docker-compose.yml`: dùng image trên GHCR thay vì build, đóng mọi cổng trừ Caddy (80/443, tự xin chứng chỉ Let's Encrypt), giới hạn heap JVM ở 512 MB.
- Chỉ `main` (bản release) được đẩy image và deploy. `develop` và PR chỉ build để kiểm tra.
- Image có ba tag: commit SHA (deploy dùng tag này), phiên bản (`0.4.0`) và `latest`.

## Cài server lần đầu

Chạy trên server (`ssh -i aquamekong-ec2.pem ubuntu@56.10.164.250`). Bọc khối lệnh trong `{ }` khi dán: `sudo` xoá phần chữ dán sẵn đang chờ, nên các dòng sau dòng `sudo` đầu tiên sẽ không chạy.

1. Swap 2 GB (ml-service học lại mô hình cảnh báo sớm lên tới ~750 MB):
   ```bash
   {
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
   sudo sysctl --system > /dev/null
   }
   ```
2. Docker theo [hướng dẫn chính thức](https://docs.docker.com/engine/install/ubuntu/), giới hạn log 10 MB × 3 file mỗi container, fail2ban cho SSH, và thêm user `ubuntu` vào nhóm `docker` (đăng nhập lại để có hiệu lực).
3. Lấy repo (repo public, không cần đăng nhập) và tạo `.env`:
   ```bash
   {
   git clone https://github.com/IkenUyh/aquamekong-platform.git ~/aquamekong-platform
   cd ~/aquamekong-platform
   cp deploy/.env.production.example .env
   sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
   sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" .env
   chmod 600 .env
   }
   ```
   Rồi `nano .env` để điền `SEED_DATA_URL`, `GDRIVE_FOLDER_ID`, `GDRIVE_API_KEY` (hỏi nhóm) và `ADMIN_PASSWORD`.
4. Khoá riêng cho GitHub Actions (tạo trên laptop, không dùng lại khoá `aquamekong-ec2.pem`):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/aquamekong-deploy -N "" -C "github-actions-deploy"
   ssh -i ~/Downloads/Key/aquamekong-ec2.pem ubuntu@56.10.164.250 'cat >> ~/.ssh/authorized_keys' < ~/.ssh/aquamekong-deploy.pub
   ssh-keyscan -t ed25519 56.10.164.250
   ```
5. GitHub → repo → *Settings → Secrets and variables → Actions → New repository secret*:

   | Secret | Giá trị |
   |---|---|
   | `DEPLOY_HOST` | `56.10.164.250` |
   | `DEPLOY_USER` | `ubuntu` |
   | `DEPLOY_SSH_KEY` | toàn bộ file `~/.ssh/aquamekong-deploy` (khoá riêng, cả dòng `BEGIN`/`END`) |
   | `DEPLOY_KNOWN_HOSTS` | dòng `56.10.164.250 ssh-ed25519 AAAA...` mà `ssh-keyscan` in ra |

   Chưa có `DEPLOY_SSH_KEY` thì job deploy tự bỏ qua, CI vẫn xanh.

## Deploy

- **Tự động:** merge release vào `main` và push. Theo dõi ở tab Actions, job "Deploy to EC2".
- **Lần đầu:** GHCR chưa có image nào cho tới khi `main` chạy CI một lần. Sau lần đó, nên đặt 3 package `aquamekong-*` thành *Public* (GitHub → *Packages* → package → *Package settings → Change visibility*) để chạy `deploy.sh` tay trên server không cần đăng nhập GHCR. Job deploy tự đăng nhập bằng token của job, nên không bắt buộc.
- **Chạy tay / quay về bản cũ** trên server:
  ```bash
  cd ~/aquamekong-platform
  ./deploy/deploy.sh                # kéo lại đúng bản trong IMAGE_TAG của .env
  ./deploy/deploy.sh <commit-sha>   # chuyển sang commit khác đã có image trên GHCR
  ```

Lần chạy đầu, ml-service tự tải `SEED_DATA_URL` và nạp dữ liệu RYNAN khi DB còn trống; Caddy xin chứng chỉ HTTPS trong vòng một phút (bản ghi A phải trỏ đúng IP trước).

## Vận hành

```bash
cd ~/aquamekong-platform
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
dc ps                                  # trạng thái và healthcheck
dc logs -f --tail=100 backend          # log một service
docker stats --no-stream               # RAM từng container
dc logs backend | grep "tài khoản admin"   # mật khẩu admin sinh tự động (khi ADMIN_PASSWORD trống)
```

- **Sao lưu DB:** `dc exec -T postgres pg_dump -U aquamekong aquamekong | gzip > ~/backup-$(date +%F).sql.gz`, rồi tải về laptop bằng `scp`.
- **Trọng số ST-GNN** (không có trong repo): chép thư mục chứa `st_gnn_horizon_{1,7}.pth` và scaler lên server, rồi `dc cp <thư mục> ml-service:/tmp/stgnn && dc exec ml-service python -m app.stgnn.install /tmp/stgnn`.
- **Security group:** chỉ mở 22 (SSH), 80 và 443. Postgres, Redis, backend và ml-service không mở cổng nào ra ngoài.
- **Chi phí:** khoảng 26 USD/tháng (t3.small ~19, IPv4 ~3,65, ổ 30 GB ~3). Credit specification để *Standard* để không bị tính thêm tiền CPU; có budget cảnh báo ở 30 USD.
