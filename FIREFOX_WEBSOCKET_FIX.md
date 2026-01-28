# 파이어폭스 웹소켓 연결 문제 해결 방법

## 주요 원인

### 1. **Mixed Content 차단**
- **문제**: HTTPS 페이지에서 WS(비보안) 연결 시도 시 파이어폭스가 보안상 차단
- **증상**: 콘솔에 "Mixed Content" 오류 표시
- **해결**: HTTPS 환경에서는 반드시 WSS(보안) 사용

### 2. **Self-signed 인증서 거부**
- **문제**: WSS 연결 시 자체 서명 인증서를 파이어폭스가 기본적으로 거부
- **증상**: "보안 연결 실패" 또는 "인증서 오류" 메시지
- **해결**: 
  - 개발 환경: `about:config`에서 `network.websocket.allowInsecureFromHTTPS` 설정 (권장하지 않음)
  - 프로덕션: 유효한 SSL 인증서 사용

### 3. **프록시 경로 불일치**
- **문제**: 개발 환경에서 프록시(`/sfu`)를 통해 연결해야 하는데 직접 포트로 연결 시도
- **증상**: 연결 타임아웃 또는 CORS 오류
- **해결**: 개발 환경에서는 프록시 경로 사용

### 4. **CORS/Origin 헤더 검증**
- **문제**: 파이어폭스가 더 엄격한 Origin 헤더 검증
- **증상**: WebSocket 핸드셰이크 실패
- **해결**: 백엔드에서 `setAllowedOrigins("*")` 설정 확인

## 코드 수정 사항

### 1. SFU WebSocket 연결 경로 수정

현재 코드 (MeetingPage.js:5411):
```javascript
const sfuWs = new WebSocket(`${protocol}://${window.location.hostname}:4000/sfu/`);
```

개선된 코드:
```javascript
// 개발 환경에서는 프록시 경로 사용, 프로덕션에서는 직접 연결
const isDev = process.env.NODE_ENV === 'development';
const sfuUrl = isDev 
    ? `${protocol}://${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/sfu/`
    : `${protocol}://${window.location.hostname}:4000/sfu/`;
const sfuWs = new WebSocket(sfuUrl);
```

### 2. 에러 핸들링 강화

```javascript
sfuWs.onerror = (error) => {
    console.error("❌ SFU WS ERROR", error);
    // 파이어폭스 특정 오류 메시지 표시
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
        console.warn("파이어폭스에서 웹소켓 연결 실패. 다음을 확인하세요:");
        console.warn("1. HTTPS 환경에서는 WSS 사용 확인");
        console.warn("2. Self-signed 인증서 사용 시 브라우저 설정 확인");
        console.warn("3. 개발 환경에서는 프록시 경로 사용 확인");
    }
};
```

### 3. 백엔드 WebSocket 설정 확인

WebSocketConfig.java에서:
```java
@Override
public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry.addHandler(handler, "/ws/room/{roomId}")
            .setAllowedOrigins("*")  // ✅ 이미 설정됨
            .setAllowedOriginPatterns("*"); // 추가: 패턴 기반 허용
}
```

## 파이어폭스 특정 설정 (개발 환경)

### 임시 해결책 (개발용만)

1. `about:config` 접속
2. 다음 설정 변경:
   - `network.websocket.allowInsecureFromHTTPS` → `true` (Mixed Content 허용)
   - `security.tls.insecure_fallback_hosts` → 서버 IP 추가

**주의**: 프로덕션 환경에서는 사용하지 마세요!

## 권장 해결 방법

### 1. 프로덕션 환경
- 유효한 SSL 인증서 사용 (Let's Encrypt 등)
- WSS 연결 사용
- Nginx 리버스 프록시 설정

### 2. 개발 환경
- 프록시 경로를 통한 연결 사용
- HTTP 환경에서는 WS 사용
- HTTPS 환경에서는 WSS + 유효한 인증서 또는 프록시 사용

## 디버깅 방법

1. **파이어폭스 개발자 도구**
   - 네트워크 탭 → WS 필터
   - 연결 시도 확인 및 상태 코드 확인

2. **콘솔 로그 확인**
   ```javascript
   sfuWs.onerror = (error) => {
       console.error("WebSocket Error:", error);
   };
   sfuWs.onclose = (event) => {
       console.log("WebSocket Closed:", event.code, event.reason);
   };
   ```

3. **서버 로그 확인**
   - SFU 서버에서 연결 시도 로그 확인
   - Spring WebSocket 핸들러 로그 확인
