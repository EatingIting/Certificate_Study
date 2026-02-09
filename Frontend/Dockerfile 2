FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG REACT_APP_BACKEND_ORIGIN=
ARG REACT_APP_SFU_WS_HOST=
ENV REACT_APP_BACKEND_ORIGIN=$REACT_APP_BACKEND_ORIGIN
ENV REACT_APP_SFU_WS_HOST=$REACT_APP_SFU_WS_HOST
RUN npm run build

FROM nginx:alpine
WORKDIR /usr/share/nginx/html

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/build .

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
