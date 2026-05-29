# Smart IV Pole - AWS 배포 가이드

AWS에 Smart IV Pole 시스템을 배포하는 전체 가이드입니다.

---

## 📋 목차

1. [시스템 아키텍처](#시스템-아키텍처)
2. [사전 준비](#사전-준비)
3. [백엔드 배포 (EC2)](#백엔드-배포-ec2)
4. [프론트엔드 배포 (S3 + CloudFront)](#프론트엔드-배포-s3--cloudfront)
5. [데이터베이스 설정](#데이터베이스-설정)
6. [ESP32 연결](#esp32-연결)
7. [비용 최적화](#비용-최적화)
8. [문제 해결](#문제-해결)

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                            │
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                │
│  │ CloudFront   │         │    EC2       │                │
│  │   (CDN)      │────────▶│ Spring Boot  │                │
│  │              │         │   (t2.micro) │                │
│  └──────────────┘         └──────┬───────┘                │
│         │                        │                         │
│         │                        │                         │
│  ┌──────▼──────┐          ┌─────▼────────┐               │
│  │     S3      │          │  RDS/VM      │               │
│  │  (Frontend) │          │  MariaDB     │               │
│  └─────────────┘          └──────────────┘               │
│                                  │                         │
└──────────────────────────────────┼─────────────────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │   ESP32 IoT Device │
                         │  (IV Pole Sensor)  │
                         └────────────────────┘
```

### 구성 요소

| 컴포넌트 | AWS 서비스 | 용도 | 비용 |
|---------|-----------|------|------|
| **프론트엔드** | S3 + CloudFront | React SPA 호스팅 | ~$1-2/월 |
| **백엔드** | EC2 t2.micro | Spring Boot API | 무료 (12개월) |
| **데이터베이스** | RDS 또는 VM | MariaDB | 무료 또는 현재 VM 유지 |
| **CDN** | CloudFront | 전 세계 빠른 콘텐츠 전송 | 50GB 무료/월 |
| **스토리지** | S3 | 정적 파일 저장 | 5GB 무료/월 |

---

## 🔧 사전 준비

### 1. AWS 계정 생성
- [AWS Free Tier](https://aws.amazon.com/free/) 가입
- 신용카드 등록 필요 (Free Tier 범위 내 사용 시 과금 없음)

### 2. AWS CLI 설치 및 설정
```bash
# macOS (Homebrew)
brew install awscli

# 설정
aws configure
# AWS Access Key ID: [입력]
# AWS Secret Access Key: [입력]
# Default region name: ap-northeast-2  # 서울 리전
# Default output format: json
```

### 3. 필수 도구 설치
```bash
# Git
brew install git

# Node.js (프론트엔드)
brew install node

# Java 21 (로컬 빌드용)
brew install openjdk@21
```

### 4. 프로젝트 클론
```bash
git clone https://github.com/your-repo/Smart_IV_Pole.git
cd Smart_IV_Pole
```

---

## 🖥️ 백엔드 배포 (EC2)

### Step 1: EC2 인스턴스 생성

#### AWS 콘솔에서:
1. **EC2 대시보드** → **인스턴스 시작**
2. **AMI 선택**: Ubuntu Server 22.04 LTS (64비트)
3. **인스턴스 유형**: t2.micro (Free Tier)
4. **키 페어**: 새로 생성 (smartpole-key.pem) 또는 기존 키 선택
5. **네트워크 설정**:
   - VPC: 기본 VPC
   - 퍼블릭 IP 자동 할당: **활성화**
   - 보안 그룹 규칙:
     ```
     SSH (22)       0.0.0.0/0
     HTTP (80)      0.0.0.0/0
     HTTPS (443)    0.0.0.0/0
     Custom (8080)  0.0.0.0/0  # Spring Boot (임시)
     ```
6. **스토리지**: 8GB gp3 (Free Tier)
7. **인스턴스 시작**

#### 키 페어 권한 설정
```bash
chmod 400 ~/Downloads/smartpole-key.pem
mv ~/Downloads/smartpole-key.pem ~/.ssh/
```

### Step 2: EC2 초기 설정

```bash
# EC2 접속
ssh -i ~/.ssh/smartpole-key.pem ubuntu@your-ec2-public-ip

# 초기 설정 스크립트 실행 (로컬에서)
cd Smart_IV_Pole/Smart_IV_Pole-be/deploy
bash -c "$(cat setup-ec2.sh)" | ssh -i ~/.ssh/smartpole-key.pem ubuntu@your-ec2-ip
```

또는 EC2에서 직접:
```bash
# 시스템 업데이트
sudo apt-get update && sudo apt-get upgrade -y

# Java 21 설치
sudo apt-get install -y openjdk-21-jdk

# Nginx 설치
sudo apt-get install -y nginx

# 애플리케이션 디렉토리 생성
sudo mkdir -p /opt/smart-iv-pole
sudo chown -R ubuntu:ubuntu /opt/smart-iv-pole

# 방화벽 설정
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### Step 3: 환경 변수 설정

로컬에서 `.env.production` 파일 생성:
```bash
cd Smart_IV_Pole/Smart_IV_Pole-be/deploy
cp .env.production.example .env.production
```

파일 내용 수정:
```bash
# EC2 Public IP 또는 도메인으로 변경
SPRING_DATASOURCE_URL=jdbc:mariadb://your-db-host:3306/smartpole
SPRING_DATASOURCE_USERNAME=your_db_username
SPRING_DATASOURCE_PASSWORD=your_secure_password

# CORS 설정 (프론트엔드 URL)
CORS_ALLOWED_ORIGINS=https://your-cloudfront-id.cloudfront.net
```

### Step 4: 백엔드 배포

```bash
cd Smart_IV_Pole/Smart_IV_Pole-be/deploy

# 배포 스크립트 실행
./deploy.sh ubuntu@your-ec2-public-ip

# 또는 수동 배포:
# 1. Gradle 빌드
cd ..
./gradlew clean build -x test

# 2. JAR 파일 업로드
scp -i ~/.ssh/smartpole-key.pem build/libs/*.jar \
  ubuntu@your-ec2-ip:/opt/smart-iv-pole/smart-iv-pole-backend.jar

# 3. 환경 변수 업로드
scp -i ~/.ssh/smartpole-key.pem deploy/.env.production \
  ubuntu@your-ec2-ip:/opt/smart-iv-pole/.env

# 4. systemd 서비스 파일 업로드
scp -i ~/.ssh/smartpole-key.pem deploy/smartpole.service \
  ubuntu@your-ec2-ip:/tmp/
ssh -i ~/.ssh/smartpole-key.pem ubuntu@your-ec2-ip \
  "sudo mv /tmp/smartpole.service /etc/systemd/system/"

# 5. 서비스 시작
ssh -i ~/.ssh/smartpole-key.pem ubuntu@your-ec2-ip << 'EOF'
  sudo systemctl daemon-reload
  sudo systemctl start smartpole
  sudo systemctl enable smartpole
  sudo systemctl status smartpole
EOF
```

### Step 5: Nginx 설정

```bash
# Nginx 설정 파일 업로드
scp -i ~/.ssh/smartpole-key.pem deploy/nginx.conf \
  ubuntu@your-ec2-ip:/tmp/smartpole

# EC2에서 설정 활성화
ssh -i ~/.ssh/smartpole-key.pem ubuntu@your-ec2-ip << 'EOF'
  sudo mv /tmp/smartpole /etc/nginx/sites-available/smartpole
  sudo ln -s /etc/nginx/sites-available/smartpole /etc/nginx/sites-enabled/
  sudo rm -f /etc/nginx/sites-enabled/default

  # Nginx 설정 테스트
  sudo nginx -t

  # Nginx 재시작
  sudo systemctl restart nginx
EOF
```

### Step 6: 배포 확인

```bash
# API 테스트
curl http://your-ec2-public-ip/api/v1/health

# 응답 예시:
# {"status":"UP"}
```

---

## 🌐 프론트엔드 배포 (S3 + CloudFront)

### Step 1: 환경 변수 설정

```bash
cd Smart_IV_Pole/frontend/deploy
cp .env.production.example .env.production
```

파일 내용 수정:
```bash
# EC2 Public IP로 변경
VITE_API_URL=http://your-ec2-public-ip/api/v1

# 또는 Elastic IP 사용 시:
# VITE_API_URL=http://54.180.99.88/api/v1
```

### Step 2: S3 버킷 생성 및 배포

#### 방법 1: 자동 배포 스크립트
```bash
cd Smart_IV_Pole/frontend/deploy

# S3 버킷 이름 (고유해야 함)
./build-and-upload.sh smart-iv-pole-frontend-your-name
```

#### 방법 2: 수동 배포

**1. 프로덕션 빌드**
```bash
cd Smart_IV_Pole/frontend
npm install
npm run build
```

**2. S3 버킷 생성**
```bash
aws s3 mb s3://smart-iv-pole-frontend --region ap-northeast-2
```

**3. 정적 웹 호스팅 활성화**
```bash
aws s3 website s3://smart-iv-pole-frontend \
  --index-document index.html \
  --error-document index.html
```

**4. 버킷 정책 설정 (퍼블릭 읽기 허용)**
```bash
aws s3api put-bucket-policy --bucket smart-iv-pole-frontend --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::smart-iv-pole-frontend/*"
  }]
}'
```

**5. 파일 업로드**
```bash
aws s3 sync dist/ s3://smart-iv-pole-frontend \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html"

# index.html은 캐싱 비활성화
aws s3 cp dist/index.html s3://smart-iv-pole-frontend/index.html \
  --cache-control "no-cache"
```

### Step 3: CloudFront 배포 생성 (선택사항)

#### AWS 콘솔에서:
1. **CloudFront** → **배포 생성**
2. **원본 도메인**: smart-iv-pole-frontend.s3-website-ap-northeast-2.amazonaws.com
3. **뷰어 프로토콜 정책**: Redirect HTTP to HTTPS
4. **캐시 키 및 원본 요청**: CachingOptimized (권장)
5. **대체 도메인 이름 (CNAME)**: your-domain.com (선택사항)
6. **SSL 인증서**: 기본 CloudFront 인증서
7. **배포 생성**

배포 완료까지 10-15분 소요됩니다.

---

## 🗄️ 데이터베이스 설정

### Option 1: 현재 VM MariaDB 유지 (권장 - 비용 절감)

현재 DB 설정 그대로 사용 (실제 credentials는 .env 파일 참조):
```bash
SPRING_DATASOURCE_URL=jdbc:mariadb://your-db-host:3306/smartpole
SPRING_DATASOURCE_USERNAME=your_db_username
SPRING_DATASOURCE_PASSWORD=your_secure_password
```

VM 방화벽에서 EC2 IP 허용 필요:
```bash
# VM에서 MariaDB 방화벽 설정
sudo ufw allow from your-ec2-public-ip to any port 3306
```

### Option 2: RDS MariaDB 사용 (Free Tier)

#### AWS 콘솔에서:
1. **RDS** → **데이터베이스 생성**
2. **엔진**: MariaDB 10.11
3. **템플릿**: 프리 티어
4. **DB 인스턴스 식별자**: smartpole-db
5. **마스터 사용자 이름**: admin
6. **마스터 암호**: your-secure-password
7. **인스턴스 클래스**: db.t2.micro (Free Tier)
8. **스토리지**: 20GB gp2 (Free Tier)
9. **VPC 보안 그룹**: EC2에서 접근 허용
10. **데이터베이스 이름**: smartpole
11. **데이터베이스 생성**

#### 환경 변수 업데이트
```bash
SPRING_DATASOURCE_URL=jdbc:mariadb://smartpole-db.xxxxxxxxx.ap-northeast-2.rds.amazonaws.com:3306/smartpole
SPRING_DATASOURCE_USERNAME=admin
SPRING_DATASOURCE_PASSWORD=your-secure-password
```

#### 기존 데이터 마이그레이션
```bash
# VM에서 데이터 덤프
mysqldump -h 61.245.248.193 -P 3308 -u yizy -p smartpole > smartpole_backup.sql

# RDS로 복원
mysql -h smartpole-db.xxxxxxxxx.ap-northeast-2.rds.amazonaws.com \
  -u admin -p smartpole < smartpole_backup.sql
```

---

## 📡 ESP32 연결

자세한 내용은 [`hardware/AWS_CONNECTION_GUIDE.md`](hardware/AWS_CONNECTION_GUIDE.md) 참조

### 간단 요약:

1. **EC2 Public IP 확인**
2. **ESP32 코드 수정**:
   ```cpp
   const char* serverHost = "your-ec2-public-ip";
   const uint16_t serverPort = 80;
   const char* serverPath = "/api/v1/esp/data";
   ```
3. **펌웨어 업로드**
4. **연결 테스트**

---

## 💰 비용 최적화

### Free Tier 활용 (12개월)
- **EC2 t2.micro**: 750시간/월 무료
- **S3**: 5GB 스토리지 무료
- **CloudFront**: 50GB 전송 무료
- **RDS db.t2.micro**: 750시간/월 무료

### 예상 월간 비용

| 항목 | 사용량 | 비용 |
|------|--------|------|
| EC2 t2.micro | 24/7 실행 | **무료** (Free Tier) |
| S3 스토리지 | ~100MB | **무료** (5GB 한도) |
| CloudFront | ~1GB/월 | **무료** (50GB 한도) |
| RDS (선택) | 750시간/월 | **무료** 또는 VM 유지 |
| **총 비용** | | **$0-2/월** |

### 비용 절감 팁
1. **현재 VM MariaDB 유지** → RDS 비용 절약
2. **Elastic IP 사용 시 연결 유지** → 미사용 시 과금
3. **CloudWatch 알람 설정** → Free Tier 초과 시 알림
4. **불필요한 인스턴스 중지** → 개발 환경

---

## 🔍 문제 해결

### 백엔드 문제

#### Spring Boot 시작 실패
```bash
# 로그 확인
ssh ubuntu@your-ec2-ip
sudo journalctl -u smartpole -n 100 --no-pager

# 일반적인 원인:
# 1. DB 연결 실패 → .env 파일 확인
# 2. 포트 충돌 → netstat -tulpn | grep 8080
# 3. 메모리 부족 → free -h
```

#### Nginx 502 Bad Gateway
```bash
# Spring Boot 상태 확인
sudo systemctl status smartpole

# Spring Boot 재시작
sudo systemctl restart smartpole

# Nginx 로그
sudo tail -f /var/log/nginx/smartpole-error.log
```

### 프론트엔드 문제

#### API 연결 실패 (CORS 에러)
```javascript
// 브라우저 콘솔 에러:
// Access to XMLHttpRequest has been blocked by CORS policy
```

**해결**:
1. 백엔드 `.env`에서 `CORS_ALLOWED_ORIGINS` 확인
2. CloudFront URL 추가
3. Spring Boot 재시작

#### S3 업로드 실패
```bash
# AWS CLI 인증 확인
aws sts get-caller-identity

# S3 버킷 권한 확인
aws s3api get-bucket-policy --bucket smart-iv-pole-frontend
```

### ESP32 연결 문제

자세한 문제 해결은 [`hardware/AWS_CONNECTION_GUIDE.md`](hardware/AWS_CONNECTION_GUIDE.md#문제-해결) 참조

---

## 📊 모니터링 및 로그

### CloudWatch 로그 설정 (선택사항)

```bash
# CloudWatch 에이전트 설치
sudo wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# 로그 수집 설정
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json
```

### 로그 확인 명령어

```bash
# Spring Boot 로그
sudo journalctl -u smartpole -f

# Nginx 액세스 로그
sudo tail -f /var/log/nginx/smartpole-access.log

# Nginx 에러 로그
sudo tail -f /var/log/nginx/smartpole-error.log
```

---

## ✅ 배포 체크리스트

### 백엔드
- [ ] EC2 인스턴스 생성 및 실행 중
- [ ] Java 21 설치 완료
- [ ] Spring Boot JAR 파일 업로드
- [ ] systemd 서비스 등록 및 실행
- [ ] Nginx 설치 및 설정
- [ ] 보안 그룹에서 포트 80/443 허용
- [ ] 환경 변수 설정 (DB 연결 정보)
- [ ] API 엔드포인트 테스트 성공

### 프론트엔드
- [ ] React 프로덕션 빌드 생성
- [ ] S3 버킷 생성 및 정적 호스팅 활성화
- [ ] S3에 파일 업로드 완료
- [ ] CloudFront 배포 생성 (선택사항)
- [ ] 환경 변수 설정 (백엔드 URL)
- [ ] CORS 설정 확인

### 데이터베이스
- [ ] MariaDB 연결 테스트 성공
- [ ] 초기 데이터 마이그레이션 완료 (필요 시)

### ESP32
- [ ] EC2 Public IP 확인
- [ ] ESP32 코드 업데이트
- [ ] 펌웨어 업로드 완료
- [ ] WiFi 연결 테스트
- [ ] API 데이터 전송 테스트

---

## 📞 지원

문제 발생 시:
1. 로그 확인 (CloudWatch 또는 SSH)
2. 보안 그룹 및 방화벽 설정 확인
3. API 엔드포인트 curl 테스트
4. GitHub Issues에 문의

---

## 🚀 다음 단계

1. **도메인 연결** (Route 53)
2. **HTTPS 인증서** (Let's Encrypt 또는 ACM)
3. **WebSocket 실시간 업데이트** 구현
4. **CloudWatch 모니터링** 설정
5. **Auto Scaling** 설정 (트래픽 증가 시)
