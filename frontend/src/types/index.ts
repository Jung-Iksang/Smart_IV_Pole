// Smart IV Pole - Type Definitions

export interface Medication {
  id: string;
  name: string;
  concentration?: number; // mg/mL
  commonDosages: number[];
  unit: 'mg' | 'g' | 'mL' | 'units';
  category: 'antibiotic' | 'analgesic' | 'fluid' | 'other';
}

export interface IVPrescription {
  id: string;
  medicationName: string;
  totalVolume: number; // mL
  duration: number; // 분
  gttFactor: 20 | 60; // macro/micro drip (20 GTT/mL or 60 GTT/mL)
  calculatedGTT: number; // GTT/min
  calculatedFlowRate: number; // mL/min (분당 투여 속도)
  prescribedBy: string; // 의사명
  prescribedAt: Date; // 처방 작성 시간
  startedAt?: Date; // 투여 시작 시간 (실제 IV 연결 시점)
  notes?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone?: string; // 전화번호 추가 (선택적)
  pinCode?: string; // 모바일 앱 로그인용 6자리 PIN (선택적)
  room: string;
  bed: string;
  nurseId: string;
  nurseName: string;
  admissionDate: Date;
  age: number;
  gender: 'male' | 'female';
  weight?: number; // kg
  height?: number; // cm
  allergies?: string[];
  poleId?: string; // 연결된 폴대 ID (선택적)
  currentPrescription?: IVPrescription;
  prescriptionHistory: IVPrescription[]; // 투여 이력 추가
  medicalHistory?: string[];
  discharged?: boolean;
  dischargedAt?: Date;
}

export interface PoleData {
  poleId: string;
  patientId?: string;
  weight: number;          // ESP32 로드셀 값 (g)
  capacity: number;        // 수액 총 용량 (ml)
  currentVolume: number;   // 현재 잔량 (ml)
  percentage: number;      // 잔량 퍼센트 (%)
  battery: number;         // 배터리 잔량 (%)
  status: 'online' | 'offline' | 'error';
  flowRate: number;        // 계산된 유량 (mL/min)
  prescribedRate: number;  // 처방된 유량 (mL/min)
  estimatedTime: number;   // 예상 완료시간 (분)
  lastUpdate: Date;
  isButtonPressed: boolean; // 호출 버튼 상태
  hasActiveAlert?: boolean; // ESP8266 알림 발생 여부 (퍼센트가 아닌 실제 알림 기준)
  alertSeverity?: 'warning' | 'critical'; // 활성 알림의 심각도
}

export interface IVSession {
  id: string;
  patientId: string;
  poleId: string;
  medicationType: string;
  volume: number;
  prescribedRate: number;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'paused' | 'stopped';
  nurseName: string;
  doctorName: string;
}

export interface Alert {
  id: string;
  poleId: string;
  patientId?: string;
  type: 'low' | 'empty' | 'abnormal' | 'button_pressed' | 'battery_low' | 'offline' | 'custom';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface Ward {
  id: string;
  name: string;
  totalBeds: number;
  occupiedBeds: number;
  nurseInCharge: string;
}

export interface BedInfo {
  bedNumber: string;
  room: string;
  patient?: Patient;
  poleData?: PoleData;
  ivSession?: IVSession;
  status: 'occupied' | 'empty' | 'maintenance';
}

export type StatusColor = 'normal' | 'warning' | 'critical' | 'offline';

export interface WardStats {
  total: number;
  normal: number;
  warning: number;
  critical: number;
  offline: number;
}

// Drug Administration Types
export interface DripDB {
  dripId?: number;
  dripName: string;
}