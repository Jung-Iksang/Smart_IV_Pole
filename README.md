<div align="center">

# 💧 Smart IV Pole

### IoT 기반 실시간 수액 모니터링 시스템

수액 잔량을 실시간으로 측정하고, 교체 시점을 자동으로 알려주는 스마트 링거 폴대

<br/>

![Java](https://img.shields.io/badge/Java-21-007396?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5.5-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat-square&logo=flutter&logoColor=white)
![ESP8266](https://img.shields.io/badge/ESP8266-E7352C?style=flat-square&logo=espressif&logoColor=white)
![MQTT](https://img.shields.io/badge/MQTT-660066?style=flat-square&logo=mqtt&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

![Status](https://img.shields.io/badge/status-completed-success?style=flat-square)
![Team](https://img.shields.io/badge/team-4_members-blue?style=flat-square)
![Year](https://img.shields.io/badge/2025-graduation_project-orange?style=flat-square)

</div>

---

## 📑 목차

- [데모](#-데모)
- [프로젝트 개요](#-프로젝트-개요)
- [주요 기능](#-주요-기능)
- [내가 맡은 역할](#-내가-맡은-역할)
- [시스템 아키텍처](#-시스템-아키텍처)
- [기술 스택](#-기술-스택)
- [프로젝트 구조](#-프로젝트-구조)
- [실행 방법](#-실행-방법)
- [API 엔드포인트](#-api-엔드포인트)
- [팀](#-팀)

---

## 🖥 데모

### 병동 통합 모니터링 대시보드

병동 전체 환자의 수액 상태를 한눈에 확인하고 실시간으로 모니터링합니다.

![대시보드](./docs/images/dashboard.png)

### 병상 현황 화면

![병동 현황](./docs/images/ward-overview.png)

<!-- 📱 앱 화면: 아래에 Flutter 앱 스크린샷을 추가하세요 (예: docs/images/app-home.png) -->
<!-- ![앱 화면](./docs/images/app-home.png) -->

---

## 📌 프로젝트 개요

기존 링거 폴대에 **로드셀 센서 모듈**을 부착하여 수액 잔량을 실시간으로 측정하고,
교체 시점을 자동으로 예측·알림하는 IoT 시스템입니다.

### 해결하는 문제

| 문제 | 해결 |
|------|------|
| 간호사가 수액 잔량을 일일이 수동 확인 | 실시간 자동 모니터링으로 업무 부담 감소 |
| 수액 소진 시 혈액 역류·공기 색전 위험 | 잔량 부족 시 자동 알림으로 사고 예방 |
| 환자·보호자의 불안감 | 언제든 잔량과 예상 소진 시간 확인 가능 |

---

## ✨ 주요 기능

- **실시간 수액 잔량 측정** — 로드셀(HX711) 기반 무게 측정으로 잔량을 정밀 산출
- **GTT 계산 및 소진 시간 예측** — 점적 수를 계산해 예상 소진 시간을 자동 예측
- **자동 알림** — 잔량 부족 시 웹·앱으로 푸시 알림
- **병동 통합 대시보드** — 병동 전체 환자를 한 화면에서 모니터링
- **상태 시각화** — 잔량에 따른 색상 구분으로 우선순위를 즉시 파악

### 상태 표시 기준

| 색상 | 잔량 | 상태 |
|------|------|------|
| 🟢 녹색 | 30% 이상 | 정상 |
| 🟡 주황 | 10–30% | 주의 |
| 🔴 빨강 | 10% 미만 | 긴급 |
| ⚫ 회색 | — | 오프라인 |

---

## 👤 내가 맡은 역할

> **4인 팀 프로젝트** 중 다음 두 영역을 담당했습니다.

### 1. Flutter 모바일 앱 개발 (`smart_iv_pole_app/`)
- 환자/병동 수액 상태 모니터링 화면 구현
- 실시간 데이터 연동 및 잔량 부족 푸시 알림

### 2. 로드셀 무게 측정 알고리즘 (`hardware/`)
- HX711 로드셀 센서 값 보정(calibration) 및 노이즈 필터링
- 센서 드리프트·크리프(creep) 보정으로 측정 정확도 개선
- 무게 변화량 기반 수액 잔량 및 GTT 산출 로직

<!-- 알고리즘 개선 상세: hardware/ALGORITHM_IMPROVEMENTS.md, hardware/CREEP_COMPENSATION_FIX.md 참고 -->

---

## 🏗 시스템 아키텍처

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   ESP8266       │  MQTT   │  Spring Boot    │   WS    │     Client      │
│   + Load Cell   │ ──────▶ │    Backend      │ ──────▶ │  React 웹 / 앱  │
│   (Hardware)    │         │   (REST API)    │         │  Flutter App    │
└─────────────────┘         └────────┬────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │     MariaDB     │
                            │   (Database)    │
                            └─────────────────┘
```

센서가 측정한 무게 데이터는 **MQTT**로 백엔드에 전송되고, 백엔드는 이를 가공해 DB에 저장한 뒤 **WebSocket**으로 웹·앱 클라이언트에 실시간 푸시합니다.

---

## 🛠 기술 스택

| 구분 | 기술 |
|------|------|
| **Backend** | Spring Boot 3.5.5, Java 21, Hibernate JPA |
| **Database** | MariaDB |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query |
| **Mobile** | Flutter |
| **Hardware** | ESP8266, HX711, Load Cell |
| **통신** | MQTT, WebSocket(STOMP), REST API |
| **Infra** | Docker, AWS |

---

## 📂 프로젝트 구조

```
Smart_IV_Pole/
├── Smart_IV_Pole-be/       # Spring Boot 백엔드 (REST API, WebSocket)
│   └── src/main/java/...
├── frontend/               # React 웹 대시보드
│   └── src/
│       ├── components/     # UI 컴포넌트
│       ├── stores/         # Zustand 상태관리
│       └── services/       # API 통신
├── smart_iv_pole_app/      # Flutter 모바일 앱  👈 담당
│   └── lib/
├── hardware/               # ESP8266 펌웨어 + 로드셀 알고리즘  👈 담당
│   └── sketch_sep12a/
├── mqtt/                   # MQTT 브로커 설정
├── DB/                     # 데이터베이스 스키마
└── docker-compose.yml      # 통합 실행 환경
```

---

## 🚀 실행 방법

### Backend
```bash
cd Smart_IV_Pole-be
./gradlew bootRun          # http://localhost:8081
```

### Frontend
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

### Mobile (Flutter)
```bash
cd smart_iv_pole_app
flutter pub get
flutter run
```

### Hardware (ESP8266)
1. Arduino IDE에서 `hardware/sketch_sep12a/` 열기
2. `config.h.example`을 복사해 `config.h`로 만들고 WiFi/서버 설정 입력
3. ESP8266 보드에 업로드

### 전체 실행 (Docker)
```bash
docker-compose up -d
```

---

## 🔌 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET`  | `/api/v1/patients` | 환자 목록 조회 |
| `POST` | `/api/v1/patients` | 환자 등록 |
| `GET`  | `/api/v1/drips` | 수액 종류 조회 |
| `POST` | `/api/v1/drips` | 수액 종류 등록 |
| `GET`  | `/api/v1/infusions` | 주입 세션 조회 |

---

## 👥 팀

**동의과학대학교 컴퓨터정보학과 · 2025 졸업작품 (4인 팀)**

| 이름 | 역할 |
|------|------|
| **정익상** | Flutter 앱 개발, 로드셀 측정 알고리즘 |
| 팀원 2 | <!-- 역할 입력 --> |
| 팀원 3 | <!-- 역할 입력 --> |
| 팀원 4 | <!-- 역할 입력 --> |

---

## 📄 라이선스

This project is for educational purposes.
