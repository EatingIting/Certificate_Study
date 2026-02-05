# Frontend (React) - multi-stage
# 빌드: node로 npm run build → 서빙: nginx

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# 빌드 시 백엔드/SFU URL은 런타임에 window.location 사용 가능하므로 기본값으로 빌드
# 필요 시: docker build --build-arg REACT_APP_BACKEND_ORIGIN=...
ARG REACT_APP_BACKEND_ORIGIN=
ARG REACT_APP_SFU_WS_HOST=
ENV REACT_APP_BACKEND_ORIGIN=$REACT_APP_BACKEND_ORIGIN
ENV REACT_APP_SFU_WS_HOST=$REACT_APP_SFU_WS_HOST
RUN npm run build

# nginx로 정적 파일 서빙
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/build .

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
