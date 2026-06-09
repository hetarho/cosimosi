#!/usr/bin/env bash
#
# lightsail-bootstrap.sh — 맨 Ubuntu(24.04) Lightsail 인스턴스를 cosimosi 백엔드를 돌릴 수 있는
# 상태로 만드는 1회성 부트스트랩(DEPLOY.md §3). 서버에서 한 번 실행하면 Docker Engine + Compose
# 플러그인 설치, swap, /srv 스택 디렉터리, (선택) GHCR 로그인까지 끝낸다. 멱등성을 지켜 여러 번
# 돌려도 안전하다 — 이미 된 단계는 건너뛴다.
#
# 실행 (Lightsail에 ssh 접속 후):
#   curl -fsSLO https://raw.githubusercontent.com/hetarho/cosimosi/main/scripts/lightsail-bootstrap.sh
#   bash lightsail-bootstrap.sh
# 또는 리포를 clone 했다면: bash scripts/lightsail-bootstrap.sh
#
# 선택 환경변수:
#   SWAP_SIZE   swap 파일 크기 (기본 2G — 1GB 플랜 안전판)
#   GHCR_USER   GitHub 사용자명 — GHCR_PAT와 함께 주면 GHCR 로그인까지 자동
#   GHCR_PAT    read:packages 권한 PAT (compose pull용)
#
# 방화벽(80/443/22)은 Lightsail 콘솔 Networking 탭에서 여는 게 표준이라 이 스크립트는 건드리지
# 않는다(호스트 ufw를 켜면 Docker의 iptables 규칙과 충돌할 수 있어 일부러 피한다).

set -euo pipefail

SWAP_SIZE="${SWAP_SIZE:-2G}"
STACK_BASE="/srv"
STACKS=(cosimosi-staging cosimosi-prod)
# 비-root로 docker를 쓸 사용자 — sudo로 실행됐으면 호출자(ubuntu), 아니면 현재 사용자.
TARGET_USER="${SUDO_USER:-$(id -un)}"

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
note() { printf '  \033[1;33mℹ\033[0m %s\n' "$*"; }

# cloud-init / unattended-upgrades가 첫 부팅 때 apt 잠금을 쥐고 있는 경우가 잦다 — 풀릴 때까지 대기.
wait_apt() {
  while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
     || sudo fuser /var/lib/apt/lists/lock     >/dev/null 2>&1 \
     || sudo fuser /var/lib/dpkg/lock          >/dev/null 2>&1; do
    note "apt 잠금 대기 중(cloud-init/unattended-upgrades)… 5s"
    sleep 5
  done
}

export DEBIAN_FRONTEND=noninteractive

# ── 0. 사전 점검 ──────────────────────────────────────────────────────────────
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "이 스크립트는 Lightsail 리눅스 서버에서 실행한다(로컬 Windows/Mac 아님)." >&2
  exit 1
fi
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" ]] || note "Ubuntu가 아님(ID=${ID:-?}) — Docker apt 방식이 안 맞을 수 있다."
  [[ "${VERSION_ID:-}" == "24.04" ]] || note "Ubuntu 24.04 기준 스크립트(현재 ${VERSION_ID:-?}) — 보통 그래도 동작한다."
fi

# ── 1. Docker Engine + Compose 플러그인 (공식 apt 저장소 방식) ─────────────────
if command -v docker >/dev/null 2>&1; then
  ok "Docker 이미 설치됨 — $(docker --version)"
else
  log "Docker Engine 설치 (공식 apt 저장소)"

  # 충돌하는 옛 패키지 제거(설치돼 있을 때만).
  for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
    if dpkg -s "$pkg" >/dev/null 2>&1; then
      wait_apt; sudo apt-get remove -y "$pkg" || true
    fi
  done

  # Docker GPG 키 + deb822 .sources 등록(공식 문서의 현재 방식).
  wait_apt; sudo apt-get update -y
  wait_apt; sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
  fi
  CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  ARCH="$(dpkg --print-architecture)"
  sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${CODENAME}
Components: stable
Architectures: ${ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
EOF

  wait_apt; sudo apt-get update -y
  wait_apt; sudo apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  ok "설치됨 — $(docker --version)"
fi

# 부팅 시 자동 시작 + 지금 실행.
sudo systemctl enable --now docker
ok "docker 서비스 활성 — $(docker compose version | head -n1)"

# ── 2. 비-root docker 권한 (docker 그룹) ──────────────────────────────────────
if id -nG "$TARGET_USER" | tr ' ' '\n' | grep -qx docker; then
  ok "'$TARGET_USER' 이미 docker 그룹"
else
  log "'$TARGET_USER'를 docker 그룹에 추가"
  sudo usermod -aG docker "$TARGET_USER"
  note "그룹은 다음 로그인부터 적용된다 — 지금 세션에선 'newgrp docker' 또는 재접속 필요."
fi

# ── 3. Swap (1GB 플랜 OOM 안전판) ─────────────────────────────────────────────
if swapon --show=NAME --noheadings | grep -qx /swapfile; then
  ok "swap 이미 활성 (/swapfile)"
else
  log "swap 파일 생성 ($SWAP_SIZE)"
  if [[ ! -f /swapfile ]]; then
    # fallocate가 일부 FS에서 안 먹으면 dd로 폴백.
    sudo fallocate -l "$SWAP_SIZE" /swapfile 2>/dev/null || \
      sudo dd if=/dev/zero of=/swapfile bs=1M count="$(( ${SWAP_SIZE%G} * 1024 ))" status=none
  fi
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -qx '/swapfile none swap sw 0 0' /etc/fstab || \
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  ok "swap 활성 + /etc/fstab 등록"
fi
# 서버에선 메모리 압박일 때만 swap을 쓰도록 swappiness를 낮춘다.
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-cosimosi-swappiness.conf >/dev/null
sudo sysctl -q vm.swappiness=10 || true

# ── 4. /srv 스택 디렉터리 (배포 워크플로가 SSH로 채운다) ───────────────────────
log "스택 디렉터리 생성 ($STACK_BASE/${STACKS[*]})"
for s in "${STACKS[@]}"; do
  sudo mkdir -p "$STACK_BASE/$s"
done
# 배포는 $TARGET_USER로 SSH해 이 디렉터리에 compose/.env/migrations를 쓴다 → 소유권을 넘긴다.
sudo chown -R "$TARGET_USER":"$TARGET_USER" "${STACKS[@]/#/$STACK_BASE/}"
ok "준비됨 — 각 디렉터리에 docker-compose.prod.yml·Caddyfile·.env(비추적)를 둘 것"

# ── 5. GHCR 로그인 (compose pull용) — 자격증명이 주어졌을 때만 ─────────────────
if [[ -n "${GHCR_USER:-}" && -n "${GHCR_PAT:-}" ]]; then
  log "GHCR 로그인 ('$TARGET_USER' 사용자)"
  # 배포는 $TARGET_USER로 docker를 부르므로 그 사용자의 ~/.docker에 자격증명이 있어야 한다.
  # docker 그룹이 이번 세션엔 아직 미적용 → sg로 그룹을 활성화해 실행. 실패해도 부트스트랩은 계속.
  if printf '%s' "$GHCR_PAT" | sudo -u "$TARGET_USER" -H sg docker -c \
       "docker login ghcr.io -u '$GHCR_USER' --password-stdin"; then
    ok "GHCR 로그인 완료"
  else
    note "GHCR 자동 로그인 실패 — 재접속 후 수동: echo <PAT> | docker login ghcr.io -u <user> --password-stdin"
  fi
else
  note "GHCR 로그인 생략(자격증명 미지정). 재접속 후: echo <PAT> | docker login ghcr.io -u <github-user> --password-stdin"
fi

# ── 6. 검증 ───────────────────────────────────────────────────────────────────
log "검증 — hello-world 실행"
if sudo docker run --rm hello-world >/dev/null 2>&1; then
  sudo docker image rm hello-world >/dev/null 2>&1 || true
  ok "Docker 정상 동작"
else
  echo "  ✗ hello-world 실행 실패 — 네트워크/설치 상태 확인 필요" >&2
  exit 1
fi

# ── 다음 단계 안내 ─────────────────────────────────────────────────────────────
cat <<DONE

$(printf '\033[1;32m부트스트랩 완료.\033[0m') 남은 1회성 작업(DEPLOY.md §3·§4):
  1. Lightsail 콘솔 Networking → 인바운드 TCP 22·80·443 열기 (+ Static IP 부여)
  2. 배포용 SSH 공개키를 ~/.ssh/authorized_keys 에 등록 (이미 됐으면 통과)
  3. $STACK_BASE/${STACKS[0]} · $STACK_BASE/${STACKS[1]} 에 docker-compose.prod.yml·Caddyfile·.env 배치
  4. GitHub Secrets: SSH_HOST(고정 IP)·SSH_USER($TARGET_USER)·SSH_KEY·DIRECT_DATABASE_URL
  5. Cloudflare DNS: api(.staging).<도메인> A → 고정 IP (DNS-only 또는 Full(strict), Flexible 금지)
  6. repo 변수 DEPLOY_ENABLED=true → develop/main push로 자동 배포

  ⚠ 비-root docker(이번에 그룹 추가했다면)는 재접속 또는 'newgrp docker' 후 적용됩니다.
DONE
