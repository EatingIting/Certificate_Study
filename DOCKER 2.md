# Docker 이미지화 및 EC2 실행 가이드

Frontend, Backend, SFU를 Docker 이미지로 빌드하고 EC2에서 이미지만 내려받아 실행하는 방법입니다.

---

## 1. 로컬에서 이미지 빌드

프로젝트 루트에서:

```bash
# 전체 빌드
docker compose build

# 개별 빌드
docker build -t certificate-study/backend:latest ./Backend
docker build -t certificate-study/frontend:latest ./Frontend
docker build -t certificate-study/sfu:latest ./SFU
```

---

## 2. EC2에서 환경 설정

1. **환경변수 파일 생성**

   ```bash
   cp .env.example .env
   # Backend용 변수가 있으면 Backend/.env 도 생성 (또는 루트 .env에 통합)
   ```

2. **`.env`에 실제 값 입력**

   - `RDS_*`, `KAKAO_*`, `GOOGLE_*`, `NAVER_*`, `AWS_*`, `OPENAI_API_KEY`
   - `ANNOUNCED_IP`: EC2 공인 IP 또는 도메인 (예: `15.165.181.93` 또는 `onsil.study`)

---

## 3. EC2에서 이미지만 내려받아 실행 (Pull & Run)

### 방법 A: 레지스트리에서 Pull 후 docker compose

1. **이미지를 레지스트리에 Push (한 번만, CI 또는 로컬에서)**

   ```bash
   # 예: AWS ECR
   aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin <계정ID>.dkr.ecr.ap-northeast-2.amazonaws.com
   docker tag certificate-study/backend:latest <계정ID>.dkr.ecr.ap-northeast-2.amazonaws.com/certificate-study/backend:latest
   docker push <계정ID>.dkr.ecr.ap-northeast-2.amazonaws.com/certificate-study/backend:latest
   # frontend, sfu 동일
   ```

2. **docker-compose에서 이미지만 사용하도록 수정**

   `docker-compose.yml`에서 `build:` 블록을 제거하고 `image:`만 레지스트리 URL로 지정:

   ```yaml
   backend:
     image: <계정ID>.dkr.ecr.ap-northeast-2.amazonaws.com/certificate-study/backend:latest
     # build: 제거
   ```

3. **EC2에서 Pull & Run**

   ```bash
   docker compose pull
   docker compose up -d
   ```

### 방법 B: EC2에서 직접 빌드 후 실행

EC2에 코드를 올린 경우:

```bash
cd /path/to/Certificate_Study
cp .env.example .env
# .env 편집
docker compose build
docker compose up -d
```

---

## 4. docker run으로 개별 실행 (이미지만 받은 경우)

레지스트리에서 이미지를 받은 뒤 컨테이너만 실행하려면:

```bash
# Backend (환경변수는 --env-file 또는 -e 로 전달)
docker run -d --name backend -p 8080:8080 --env-file .env certificate-study/backend:latest

# Frontend
docker run -d --name frontend -p 3000:80 certificate-study/frontend:latest

# SFU (WebRTC 포트 범위 + ANNOUNCED_IP)
docker run -d --name sfu -p 4000:4000 \
  -p 40000-49999:40000-49999/udp -p 40000-49999:40000-49999/tcp \
  -e ANNOUNCED_IP=15.165.181.93 \
  certificate-study/sfu:latest
```

Backend는 DB/OAuth 등 변수가 많으므로 `--env-file ./Backend/.env` 또는 `--env-file .env` 사용을 권장합니다.

---

## 5. Nginx 리버스 프록시 (EC2 권장)

EC2에서 80/443을 받아 세 컨테이너로 나누려면 호스트에 Nginx를 두고 예시처럼 설정합니다:

- `https://도메인/` → `http://localhost:3000` (frontend)
- `https://도메인/api`, WebSocket 등 → `http://localhost:8080` (backend)
- `wss://도메인/sfu/` → `http://localhost:4000` (sfu)

보안 그룹에서 **4000, 40000–49999 (UDP/TCP)** 를 열어두어야 WebRTC가 동작합니다.

---

## 6. 포트 요약

| 서비스   | 컨테이너 포트 | 기본 호스트 매핑 |
|----------|----------------|-------------------|
| Backend  | 8080           | 8080:8080         |
| Frontend | 80             | 3000:80           |
| SFU      | 4000 + 40000–49999 | 4000, 40000–49999/udp, 40000–49999/tcp |

---

## 7. OAuth2 로그인 (onsil.study 등 도메인)

OAuth2(카카오/구글/네이버)는 **리다이렉트 URL**이 개발자 콘솔에 등록한 값과 정확히 일치해야 합니다.

### 백엔드에서 할 일 (둘 중 하나)

**방법 A: 기준 URL 고정 (권장)**  
Nginx에서 X-Forwarded 헤더를 안 보낼 때 사용합니다.

- `.env` 또는 Backend 환경변수에 추가:
  ```bash
  APP_OAUTH2_BASE_URL=https://onsil.study
  ```
- `application.properties`에 추가해도 됩니다: `app.oauth2.base-url=https://onsil.study`
- 그러면 Spring이 카카오/구글/네이버로 보내는 `redirect_uri`가 `https://onsil.study/login/oauth2/code/kakao` 등으로 고정됩니다.

**방법 B: Nginx에서 X-Forwarded 헤더 전달**  
Backend로 프록시하는 location에 다음을 넣습니다:

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Host $host;
```

- `server.forward-headers-strategy=framework`가 이미 있으므로, 위 헤더가 오면 Spring이 `redirect_uri`를 `https://onsil.study/...`로 만듭니다.
- 이렇게 하면 `app.oauth2.base-url` 설정은 필요 없습니다.

### 프론트엔드

- 로그인 버튼/링크에서 OAuth 시작 시 **`redirect_origin`** 파라미터로 `https://onsil.study`를 넘기면, 로그인 성공 후 그 주소로 돌아갑니다.
- 개발자 콘솔(카카오/구글/네이버)에는 **리다이렉트 URI**를 다음처럼 등록해야 합니다:
  - `https://onsil.study/login/oauth2/code/kakao`
  - `https://onsil.study/login/oauth2/code/google`
  - `https://onsil.study/login/oauth2/code/naver`

---

## 8. 트러블슈팅

- **`docker compose -f docker-compose-web.yaml up -d` 시 ".env not found"**: 프로젝트 루트에 `.env`가 없어서 발생합니다. `.env.example`을 복사한 뒤 실제 값으로 채우세요.
  ```bash
  cp .env.example .env
  # .env 편집 후 다시: docker compose -f docker-compose-web.yaml up -d
  ```
- **SFU 서버에 peer 접속이 안 됨**: ① **Web 서비스가 떠 있어야 합니다.** docker-compose-web가 .env 없이 실패하면 프론트/백엔드가 안 떠 있어서 브라우저가 SFU에 연결할 수 없습니다. `.env` 생성 후 `docker compose -f docker-compose-web.yaml up -d`로 프론트·백엔드를 먼저 기동하세요. ② 프론트엔드 nginx가 `/sfu/`를 SFU 주소(기본 `15.165.181.93:4000`)로 프록시합니다. 프론트와 SFU가 **같은 호스트**에서 돌 때 프록시가 실패하면, nginx의 `proxy_pass`를 `http://host.docker.internal:4000`으로 바꾸고, docker-compose-web의 frontend 서비스에 `extra_hosts: ["host.docker.internal:host-gateway"]`를 추가한 뒤 이미지를 다시 빌드해 보세요. ③ SFU 포트(4000, 40000–40200 UDP/TCP)가 방화벽·보안 그룹에서 열려 있는지 확인하세요.
- **Backend DB 연결 실패**: `RDS_HOSTNAME` 등이 .env에 맞는지, EC2 보안 그룹에서 RDS 접근 허용 여부 확인.
- **SFU 검은 화면**: `ANNOUNCED_IP`가 클라이언트가 접속하는 주소(공인 IP 또는 도메인)와 일치하는지 확인.
- **Frontend에서 API/SFU 404**: Nginx에서 `/api`, `/sfu/` 등이 올바른 컨테이너로 프록시되는지 확인.
- **OAuth2 로그인 실패**: 개발자 콘솔 리다이렉트 URI가 `https://onsil.study/login/oauth2/code/{kakao|google|naver}` 인지 확인. 백엔드에 `APP_OAUTH2_BASE_URL=https://onsil.study` 설정 또는 Nginx에서 X-Forwarded-Proto/Host 전달 여부 확인.