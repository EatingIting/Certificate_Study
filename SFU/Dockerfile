FROM node:20

WORKDIR /app

# mediasoup 빌드 필수 패키지
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    git

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN useradd -m appuser
USER appuser

EXPOSE 4000

ENV ANNOUNCED_IP=

CMD ["node", "sfu_server.js"]
