# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart IV Pole (스마트 링거 폴대) is an IoT-based medical device graduation project that transforms standard IV poles into intelligent monitoring systems. The system uses sensors and communication modules to monitor IV fluid administration status, reducing nursing workload and enabling real-time monitoring for patients and caregivers.

## System Architecture

The project follows a modular retrofit design with these main components:

### Hardware Components
- **Load Cell Sensors (2x)**: Weight measurement for fluid level tracking using HX711 ADC modules with ESP32
  - Measurement algorithm: Nurse input as primary, supplemented by load cell for accuracy
  - Only measures when stable (3+ seconds without movement) to avoid irregular readings
  - Calculates expected depletion time based on weight reduction rate
- **Display/Tablet**: Patient interface showing fluid status and call button
- **Call Button & Status LEDs**: Emergency communication and visual status indicators
- **MCU (ESP32)**: Central processing unit for sensor data and communication
- **Battery System**: Rechargeable power with 24+ hour operation

### Software Architecture
- **Embedded Firmware**: Real-time sensor processing, infusion rate calculation, anomaly detection
- **Mobile App (Flutter)**: Patient/caregiver interface for real-time monitoring and alerts
- **Web Dashboard**: Nurse monitoring system for ward-wide IV status management
  - Real-time monitoring with color-coded status (Green: >30%, Orange: 10-30%, Red: <10%, Gray: Offline)
  - Priority-based alert management with quick action buttons
  - Patient-specific detailed management and automated nursing records
  - Role-based access control (head nurse vs general nurse)
  - Mobile/tablet optimized views for ward rounds
  - WebSocket-based real-time updates (1-second intervals)
- **Pole UI**: Built-in display for direct patient interaction

### Communication Flow
```
[Sensors] → [MCU + BLE/Wi-Fi] → [Cloud/Hospital Server] → [Apps/Dashboard]
```

## Technology Stack

### Backend (Spring Boot)
- **Framework**: Spring Boot 3.5.5 with Java 21
- **Database**: MariaDB with Hibernate JPA
- **Configuration**: Hibernate DDL auto-update, external MariaDB server at 61.245.248.193:3308
- **Port**: 8081 (configured in application.yml)
- **Dependencies**: Spring Web, Spring Data JPA, Validation, WebFlux, Lombok

### Frontend (React Dashboard)
- **Framework**: React 19 with TypeScript
- **Build System**: Vite 7.1.2 with hot reload
- **Styling**: Tailwind CSS 4.0 + Radix UI primitives
- **State Management**: Zustand with persistence
- **Routing**: React Router v7
- **Icons**: Lucide React
- **Port**: 5173 (Vite default)

### Database Schema (MariaDB)
- **Server**: 61.245.248.193:3308 (username: yizy, database: smartpole)
- **patients**: Patient info with room_id and bed_number for bed assignment persistence
- **drip_types**: IV fluid types and medications
- **infusion_sessions**: Active IV sessions with real-time monitoring data
- **alert_logs**: Medical alerts with severity levels and acknowledgment tracking
- **nurses**: Staff authentication and role management
- **poles**: Hardware device status and battery monitoring

## Development Commands

### Backend (Spring Boot)
```bash
cd Smart_IV_Pole-be/
./gradlew bootRun         # Start development server (port 8081)
./gradlew test            # Run tests
./gradlew build          # Build application
./gradlew clean build    # Clean build
```

### Frontend (React)
```bash
cd frontend/
npm install               # Install dependencies
npm run dev              # Start development server (port 5173)
npm run build            # Production build (TypeScript + Vite)
npm run lint             # ESLint code quality check
npm run preview          # Preview production build
```

### Development Workflow
1. Start backend: `cd Smart_IV_Pole-be && ./gradlew bootRun`
2. Start frontend: `cd frontend && npm run dev`
3. Access application: http://localhost:5173
4. Backend API: http://localhost:8081/api/v1

## Core Medical Algorithm - GTT Calculator

The **GTT (점적 수) calculation system** is the core differentiator that bridges manual nurse input with real-time sensor data:

- **Primary Input**: Nurse manual entry for medication volume, duration, and GTT factor
- **Formula**: `(총 용량 × GTT factor) / 투여 시간(분)` where GTT factor is 20 (macro) or 60 (micro)
- **Real-time Monitoring**: ESP8266 load cell data provides accuracy verification
- **Status Algorithm**: Compare expected vs. actual depletion rates:
  - **정상 (Normal)**: Actual rate within ±10% of calculated rate
  - **주의 (Warning)**: 10-20% deviation from expected rate
  - **응급 (Critical)**: >20% deviation - major discrepancy requiring immediate attention

Located in `frontend/src/utils/gttCalculator.ts` with medical-grade precision.

### ESP8266 Intelligent Monitoring System

**Event-Driven Architecture** - Traffic optimization through local monitoring:

1. **Prescription Retrieval** (`/api/esp/init?device_id={id}`)
   - ESP8266 fetches prescription data when connected to patient pole
   - Receives: total_volume_ml, flow_rate_ml_min, gtt_factor

2. **High-Precision Local Monitoring**
   - **Measurement**: 1-second interval, 0.1g precision
   - **Flow Rate Calculation**: 60-second moving average (60 samples)
   - **Real-time Prediction**: Estimated end time updated every second
   - **Serial Monitor Output**: Continuous developer-friendly logging

3. **Event-Based Backend Communication** (Traffic Optimization)
   - **Normal Operation**: No transmission (ESP monitors locally)
   - **Initial Data**: Single transmission after 60 seconds
   - **Deviation Alert**: ≥15% flow rate deviation → backend alert
   - **Critical Alert**: ≥25% deviation or <10% remaining volume
   - **Minimum Interval**: 5 seconds between transmissions

4. **Serial Monitor Output Format** (Arduino IDE)
   ```
   [60s] 무게: 497.2g (잔량: 497.2g, 99.4%) | 유속: 2.80 mL/분 (처방: 2.78, 편차: +0.7%) | 예상완료: 177분 후
   ```

**Benefits**:
- ✅ Network traffic reduction: 3-second polling → event-based (99% reduction)
- ✅ Battery optimization: Minimal HTTP requests
- ✅ Real-time accuracy: 60-second moving average eliminates noise
- ✅ Developer monitoring: Complete visibility via Serial Monitor

## Critical Architecture Patterns

### Drug Administration Workflow Separation
**Problem Solved**: Separate patient registration from drug prescription to align with backend API structure and improve workflow clarity.

**Implementation**:
1. **PatientModal**: Handles only patient registration (name, age, room assignment)
2. **DrugPrescriptionModal**: Independent drug prescription interface
3. **Backend Integration**: DrugType CRUD API at `/api/v1/drips`
4. **Workflow**: Patient registration → bed assignment → separate drug prescription

```typescript
// Key API: DrugType CRUD operations
GET    /api/v1/drips           # Get all drug types
POST   /api/v1/drips           # Create new drug type
PUT    /api/v1/drips/{id}      # Update drug type
DELETE /api/v1/drips/{id}      # Delete drug type
```

**Component Integration**:
- DrugPrescriptionModal loads available drugs from backend on open
- Graceful fallback when backend unavailable
- GTT calculations remain in frontend with real-time preview
- Separation improves maintainability and aligns with medical workflow

### Bed Assignment Persistence System
**Problem Solved**: Patients stay assigned to specific beds (301A-1 through 301A-6) after page navigation/refresh.

**Implementation**:
1. **Database Storage**: `room_id` and `bed_number` columns in patients table
2. **Priority System**: DB bed info → localStorage mapping → existing data → defaults
3. **Conversion Logic**: `convertDBPatientToFrontend()` in wardStore.ts handles bed assignment priority
4. **Real-time Sync**: `fetchPatients()` automatically syncs DB changes to frontend

```typescript
// Key function: wardStore.ts convertDBPatientToFrontend()
if (dbPatient.roomId && dbPatient.bedNumber) {
  // DB bed info takes priority
  room = dbPatient.roomId;
  bed = dbPatient.bedNumber;
} else if (patientBedMapping?.has(patientId)) {
  // Fallback to localStorage mapping
  const bedNumber = patientBedMapping.get(patientId)!;
}
```

### State Management Architecture (Zustand)
**Central Store**: `frontend/src/stores/wardStore.ts`
- **Hybrid Persistence**: Database + localStorage for offline resilience
- **Real-time Updates**: Mock MQTT simulation with database sync
- **API Integration**: Automatic server connection with graceful fallback
- **Bed Mapping**: Patient-bed relationship management with persistence

**Key Actions**:
- `fetchPatients()`: Load patients from database with bed assignment
- `addPatient()`: Create patient with bed assignment in database (no prescription)
- `addIVPrescription()`: Separate function for drug prescription management
- `checkConnection()`: Test backend connectivity and sync data
- `convertDBPatientToFrontend()`: Handle bed assignment priority logic
- `convertFrontendPatientToDB()`: Handle age→birthDate schema conversion

### Data Flow Architecture
```
ESP32 Sensors → MQTT → Spring Boot API (port 8081) → MariaDB
                                    ↓
Frontend (port 5173) → Zustand Store → localStorage backup
                                    ↓
React Components (persistent across navigation)
```

### Component Architecture
- **WardOverview**: Main dashboard with 6-bed grid layout and real-time monitoring
- **PatientList**: Comprehensive patient management with search and GTT calculator
- **PatientModal**: Patient registration with bed selection (IV prescription removed)
- **DrugPrescriptionModal**: Separate drug prescription interface with backend integration
- **BedCard**: Individual bed status with color-coded visual indicators

## Key Features Implemented

- ✅ **Database Integration**: Full Spring Boot + MariaDB backend with RESTful API
- ✅ **Bed Assignment Persistence**: room_id + bed_number database columns with priority system
- ✅ **Patient Management**: Complete CRUD operations with automatic bed assignment
- ✅ **Drug Administration System**: Separate drug prescription workflow with backend API
- ✅ **Ward Monitoring**: 6-bed dashboard with real-time status and color coding
- ✅ **GTT Calculator**: Medical-grade IV infusion rate calculations with nurse workflow
- ✅ **Alert System**: Priority-based notifications with severity levels
- ✅ **Workflow Separation**: Patient registration and drug prescription as independent workflows
- ✅ **Offline Resilience**: localStorage backup when backend unavailable
- ✅ **Data Synchronization**: Automatic sync between frontend and database
- 🚧 ESP32 hardware integration (in development - currently mock data)
- 🚧 Real MQTT broker integration (planned)

## MQTT Topic Structure (Planned)

### Device Topics
- `pole/{poleId}/status` - Device online/offline status
- `pole/{poleId}/weight` - Real-time load cell data
- `pole/{poleId}/battery` - Battery level monitoring
- `pole/{poleId}/button` - Emergency call button events

### Alert Topics
- `alert/{poleId}/low` - Low fluid alerts (<10%)
- `alert/{poleId}/empty` - Empty fluid alerts
- `alert/{poleId}/abnormal` - Abnormal flow rate detection

## Common Development Tasks

### Adding New Patient
1. Use `wardStore.addPatient()` with bed assignment (patient info only)
2. Backend automatically stores in database with room_id/bed_number
3. Frontend updates immediately with bed persistence
4. Drug prescription is separate workflow via DrugPrescriptionModal

### Adding Drug Prescription
1. Use DrugPrescriptionModal component with patient reference
2. Modal loads available drugs from `/api/v1/drips` endpoint
3. GTT calculations performed in frontend with real-time preview
4. Prescription stored via `addIVPrescription()` store method

### Debugging Bed Assignment Issues
1. Check `convertDBPatientToFrontend()` priority logic in wardStore.ts
2. Verify database has room_id and bed_number columns populated
3. Confirm `fetchPatients()` is called on page navigation

### Backend Entity Changes
1. Modify entity in `Smart_IV_Pole-be/src/main/java/com/example/smartpole/entity/`
2. Restart Spring Boot (`./gradlew bootRun`) to pick up changes
3. Hibernate DDL auto-create will update database schema
4. Update frontend TypeScript interfaces in `frontend/src/services/api.ts`

### Testing Backend Connectivity
```bash
# Test patients API
curl http://localhost:8081/api/v1/patients

# Test patient creation
curl -X POST http://localhost:8081/api/v1/patients \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Patient","phone":"010-1234-5678","birthDate":"1990-01-01","gender":"male","roomId":"301A","bedNumber":"2"}'

# Test drug types API
curl http://localhost:8081/api/v1/drips

# Test drug type creation
curl -X POST http://localhost:8081/api/v1/drips \
  -H "Content-Type: application/json" \
  -d '{"dripName":"Normal Saline 500mL"}'
```

### Direct Database Access
```bash
# Connect to MariaDB server (credentials in Smart_IV_Pole-be/.env)
mysql -h 61.245.248.193 -P 3308 -u yizy --skip-ssl -p
# Password: (see Smart_IV_Pole-be/.env file)

# Once connected, use the database
USE smartpole;
SHOW TABLES;
```

## Medical Compliance & UI Standards

### Color Coding Standards
- 🟢 **Green (30%+ fluid)**: Normal operation, no intervention needed
- 🟡 **Orange (10-30% fluid)**: Attention needed, prepare for change
- 🔴 **Red (<10% fluid)**: Critical/Emergency, immediate action required
- ⚫ **Gray**: Offline or hardware disconnected

### UI/UX Requirements
- **3-Click Rule**: All major functions accessible within 3 clicks
- **Touch-Friendly**: Minimum 44px touch targets for tablet use
- **Real-time Updates**: 1-second interval refresh for critical monitoring
- **Medical Workflow**: Nurse receives prescription → inputs → calculates → monitors

## Development Guidelines

### Frontend Development
- **Entry Point**: `frontend/src/App.tsx` renders WardOverview as main dashboard
- **State Management**: Use wardStore methods for consistent state across components
- **API Integration**: All backend calls go through `frontend/src/services/api.ts`
- **Styling**: Tailwind CSS 4.0 with `@import "tailwindcss"` syntax
- **Icons**: Use Lucide React for consistency

### Backend Development
- **Entity Changes**: Always restart Spring Boot after entity modifications
- **Database**: Hibernate auto-creates schema, use migration scripts for production
- **API Responses**: Follow `ApiResponse<T>` wrapper pattern for consistency
- **CORS**: Configured for frontend development server

### MQTT Integration (Future)
- Use `useMQTT()` hook for real-time connections
- Mock implementation in `frontend/src/hooks/useMQTT.ts`
- Real implementation planned for `useRealMQTT()` function
- Topic structure documented above for ESP32 integration

### Important Notes
- **Bed Assignment**: Database persistence is critical - always include room_id and bed_number
- **Workflow Separation**: Keep patient registration and drug prescription as separate operations
- **Schema Compatibility**: Frontend uses `age` but backend expects `birthDate` (auto-converted)
- **Page Navigation**: WardOverview calls `fetchPatients()` on every entry for fresh data
- **Offline Mode**: Frontend gracefully falls back to localStorage when backend unavailable
- **Medical Accuracy**: GTT calculations follow hospital protocols with proper rounding
- **Drug API Integration**: DrugPrescriptionModal requires backend connectivity for drug list