# ESP8266 하드웨어 통합 가이드

## 🔌 통합 아키텍처

```
[ESP8266 + HX711] → WiFi → [Spring Boot :8081] → WebSocket → [React Frontend :5173]
```

## ✅ 구현 완료 항목

### 1. ESP8266 펌웨어 (Arduino)
- **파일**: `hardware/sketch_sep12a.ino`
- **기능**:
  - WiFi 연결 및 자동 재연결
  - HX711 로드셀 센서 데이터 수집
  - 무게 기반 잔여 시간 예측 (선형 회귀)
  - 4초마다 데이터 전송 (`/api/esp/data`)
  - 유속 이상 감지 시 경고 전송 (`/api/esp/alert`)
  - 안정화 알고리즘 (10초 안정 대기)

### 2. Spring Boot 백엔드
- **파일**: `Smart_IV_Pole-be/src/main/java/com/example/smartpole/controller/esp/Esp8266Controller.java`
- **엔드포인트**:
  - `POST /api/esp/data` - 센서 데이터 수신
  - `POST /api/esp/alert` - 경고 알림 수신
  - `GET /api/esp/test` - 연결 테스트
- **WebSocket 브로드캐스트**:
  - `/topic/pole/{poleId}` - Pole별 실시간 데이터
  - `/topic/patient/{patientId}` - 환자별 데이터
  - `/topic/alerts` - 전체 경고 알림

### 3. React 프론트엔드
- **파일**: `frontend/src/hooks/useWebSocket.ts`
- **기능**:
  - STOMP + SockJS를 통한 WebSocket 연결
  - 실시간 센서 데이터 수신 및 wardStore 업데이트
  - 경고 알림 수신 및 Alert 생성
  - 자동 재연결 (5초 간격)
  - Debug 로깅 지원

## 🚀 ESP8266 설정 및 연결

### 하드웨어 설정
1. **WiFi 설정** (`sketch_sep12a.ino:5-6`):
   ```cpp
   const char* ssid = "YOUR_WIFI_NAME";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

2. **서버 설정** (`sketch_sep12a.ino:7-9`):
   ```cpp
   const char* serverHost = "192.168.x.x";  // 백엔드 서버 IP
   const uint16_t serverPort = 8081;
   const char* serverPath = "/api/esp/data";
   ```

3. **Device ID 설정** (`sketch_sep12a.ino:203`):
   ```cpp
   json += "\"device_id\":\"IV_001\",";  // 환자별로 변경 필요
   ```

### 펌웨어 업로드
1. Arduino IDE에서 `hardware/sketch_sep12a.ino` 열기
2. 보드 설정: `Tools > Board > ESP8266 Boards > NodeMCU 1.0 (ESP-12E Module)`
3. 포트 선택: `Tools > Port > /dev/cu.usbserial-xxxx`
4. 업로드: `Sketch > Upload`

### 시리얼 모니터 확인
```
=== Smart IV Pole - Enhanced Monitoring ===
WiFi 연결 중........
✅ WiFi 연결 성공
IP: 192.168.1.100
🚀 모니터링 시작!
📊 무게: 450.2g | 예측: 120.5분
📤 데이터 전송: {...}
✅ 전송 성공
```

## 🔧 백엔드 설정

### application.yml 확인
```yaml
server:
  port: 8081

spring:
  datasource:
    url: jdbc:mariadb://61.245.248.193:3308/smartpole
```

### WebSocket 설정 확인
- **파일**: `Smart_IV_Pole-be/src/main/java/com/example/smartpole/config/WebSocketConfig.java`
- **엔드포인트**: `/ws` (SockJS 지원)
- **토픽 prefix**: `/topic`

### 백엔드 실행
```bash
cd Smart_IV_Pole-be
./gradlew bootRun
```

## 💻 프론트엔드 설정

### WebSocket 설정 확인
- **서버 URL**: `http://localhost:8081` (기본값)
- **재연결 간격**: 5초
- **Debug 모드**: `true` (개발 중)

### 프론트엔드 실행
```bash
cd frontend
npm install  # 최초 1회 (WebSocket 라이브러리 포함)
npm run dev
```

### 브라우저 콘솔 확인
```
📡 WebSocket Status: {isConnected: true, connectionStatus: "connected", error: null}
✅ WebSocket Connected to: http://localhost:8081
📡 Subscribed to WebSocket topics
📊 Pole Data Received: {device_id: "IV_001", weight: 450.2, ...}
```

## 📊 데이터 플로우

### 1. ESP8266 → 백엔드 (4초 간격)
```json
POST http://192.168.x.x:8081/api/esp/data
{
  "device_id": "IV_001",
  "weight": 450.2,
  "predicted_time": 7230,
  "state": "STABLE"
}
```

### 2. 백엔드 → 프론트엔드 (WebSocket)
```json
/topic/pole/IV_001
{
  "device_id": "IV_001",
  "patient_id": 1,
  "session_id": 123,
  "weight": 450.2,
  "predicted_time": 7230,
  "remaining_volume": 450,
  "percentage": 90.0,
  "state": "STABLE",
  "timestamp": "2025-10-30T15:30:00"
}
```

### 3. 프론트엔드 wardStore 업데이트
```typescript
updatePoleData("IV_001", {
  weight: 450.2,
  currentVolume: 450,
  percentage: 90.0,
  status: "online",
  estimatedTime: 120.5, // minutes
  lastUpdate: new Date()
})
```

## 🚨 경고 알림 플로우

### 1. ESP8266 → 백엔드 (유속 이상 감지)
```json
POST http://192.168.x.x:8081/api/esp/alert
{
  "device_id": "IV_001",
  "alert_type": "FLOW_RATE_ABNORMAL",
  "deviation_percent": 18.5,
  "timestamp": 1234567890
}
```

### 2. 백엔드 → 프론트엔드 (WebSocket)
```json
/topic/alerts
{
  "alert_id": 456,
  "device_id": "IV_001",
  "patient_id": 1,
  "severity": "warning",
  "message": "유속 이상 감지: 예상값과 18.5% 차이",
  "deviation_percent": 18.5
}
```

## 🧪 통합 테스트 절차

### 1. 백엔드 연결 테스트
```bash
# ESP8266에서 사용할 IP 확인
curl http://localhost:8081/api/esp/test

# 예상 응답:
{
  "status": "success",
  "message": "ESP8266 서버 정상 작동 중!",
  "timestamp": "2025-10-30T15:30:00"
}
```

### 2. ESP8266 데이터 전송 테스트 (수동)
```bash
curl -X POST http://localhost:8081/api/esp/data \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "IV_001",
    "weight": 450.5,
    "predicted_time": 7200,
    "state": "STABLE"
  }'
```

### 3. WebSocket 연결 확인
- 프론트엔드 브라우저 콘솔에서 확인:
  - `WebSocket Connected` 메시지
  - `Subscribed to WebSocket topics` 메시지
  - Pole 데이터 수신 로그

### 4. 실제 하드웨어 테스트
1. ESP8266 펌웨어 업로드
2. 시리얼 모니터에서 WiFi 연결 확인
3. 백엔드 콘솔에서 데이터 수신 확인:
   ```
   === ESP8266 데이터 수신 ===
   Device ID: IV_001
   Weight: 450.2g
   Predicted Time: 7230s
   State: STABLE
   ✅ 데이터 업데이트 및 브로드캐스트 완료
   ```
4. 프론트엔드 대시보드에서 실시간 업데이트 확인

## 🔍 문제 해결

### ESP8266 WiFi 연결 실패
- SSID/비밀번호 확인
- 2.4GHz WiFi 사용 (5GHz 지원 안함)
- 시리얼 모니터 확인: `WiFi.status()`

### 백엔드 연결 실패
- 서버 IP 주소 확인 (`ipconfig` / `ifconfig`)
- 방화벽 설정 확인 (포트 8081 허용)
- Spring Boot 실행 확인

### WebSocket 연결 실패
- 백엔드 WebSocket 설정 확인
- CORS 설정 확인 (WebSocketConfig.java)
- 브라우저 콘솔 에러 메시지 확인

### 데이터 수신 안됨
- Device ID 매핑 확인 (ESP8266 vs DB)
- InfusionSession active 상태 확인
- WebSocket 토픽 구독 확인

## 📝 개발 체크리스트

- [x] ESP8266 펌웨어 구현
- [x] 백엔드 API 엔드포인트
- [x] 백엔드 WebSocket 설정
- [x] 프론트엔드 WebSocket 클라이언트
- [x] wardStore 실시간 업데이트
- [ ] ESP8266 실제 하드웨어 연결 테스트
- [ ] 다중 Pole 동시 연결 테스트
- [ ] 네트워크 장애 복구 테스트
- [ ] 배터리 상태 모니터링 추가
- [ ] 호출 버튼 이벤트 통합

## 🎯 다음 단계

1. **ESP8266 실제 연결**: WiFi 설정 후 실제 하드웨어 테스트
2. **Device ID 매핑**: DB에 Pole-Patient 매핑 생성
3. **배터리 모니터링**: ESP8266 배터리 상태 전송 추가
4. **호출 버튼**: 긴급 호출 버튼 WebSocket 이벤트
5. **Production 배포**: 서버 IP를 실제 서버로 변경

## 📚 참고 문서

- [STOMP Protocol](https://stomp.github.io/)
- [SockJS](https://github.com/sockjs/sockjs-client)
- [ESP8266 Arduino Core](https://arduino-esp8266.readthedocs.io/)
- [HX711 Load Cell](https://github.com/bogde/HX711)
