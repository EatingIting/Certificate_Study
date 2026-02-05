# SFU (mediasoup Node.js)
# 포트: 4000 (HTTP/WS), 40000-49999 (WebRTC UDP/TCP)

FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY config.js sfu_server.js ./

RUN adduser -D -u 1000 appuser
USER appuser

EXPOSE 4000
# WebRTC 포트는 호스트에서 매핑하거나 host network 사용
ENV ANNOUNCED_IP=
CMD ["node", "sfu_server.js"]
