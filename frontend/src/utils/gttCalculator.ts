// GTT (점적 수) 계산 유틸리티
// 간호사가 의사 처방을 받아 IV 투여 속도를 계산하는 함수들

import { IVPrescription } from '../types';

/**
 * GTT/min 계산
 * @param totalVolume 총 투여량 (mL)
 * @param duration 투여 시간 (분)
 * @param gttFactor GTT factor (20 for macro drip, 60 for micro drip)
 * @returns GTT per minute
 */
export const calculateGTT = (
  totalVolume: number,
  duration: number,
  gttFactor: number
): number => {
  if (duration === 0) return 0;
  return (totalVolume * gttFactor) / duration;
};

/**
 * mL/min 계산 (분당 투여 속도)
 * @param totalVolume 총 투여량 (mL)
 * @param duration 투여 시간 (분)
 * @returns mL per minute
 */
export const calculateFlowRate = (
  totalVolume: number,
  duration: number
): number => {
  if (duration === 0) return 0;
  return totalVolume / duration;
};

/**
 * 투여 시간 계산 (총 용량과 분당 유량으로부터)
 * @param totalVolume 총 투여량 (mL)
 * @param flowRatePerMin 분당 유량 (mL/min)
 * @returns 투여 시간 (분)
 */
export const calculateDuration = (
  totalVolume: number,
  flowRatePerMin: number
): number => {
  if (flowRatePerMin === 0) return 0;
  return totalVolume / flowRatePerMin;
};

/**
 * 예상 완료 시간 계산
 * @param startTime 투여 시작 시간
 * @param duration 투여 시간 (분)
 * @returns 예상 완료 시간
 */
export const calculateEstimatedEndTime = (
  startTime: Date,
  duration: number
): Date => {
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + duration);
  return endTime;
};

/**
 * 남은 시간 계산
 * @param startTime 투여 시작 시간
 * @param duration 총 투여 시간 (분)
 * @param currentTime 현재 시간 (기본값: 현재 시간)
 * @returns 남은 시간 (분)
 */
export const calculateRemainingTime = (
  startTime: Date,
  duration: number,
  currentTime: Date = new Date()
): number => {
  const elapsedMinutes = Math.floor(
    (currentTime.getTime() - startTime.getTime()) / (1000 * 60)
  );
  return Math.max(0, duration - elapsedMinutes);
};

/**
 * 현재 진행률 계산
 * @param startTime 투여 시작 시간
 * @param duration 총 투여 시간 (분)
 * @param currentTime 현재 시간 (기본값: 현재 시간)
 * @returns 진행률 (0-100%)
 */
export const calculateProgress = (
  startTime: Date,
  duration: number,
  currentTime: Date = new Date()
): number => {
  const elapsedMinutes = Math.floor(
    (currentTime.getTime() - startTime.getTime()) / (1000 * 60)
  );
  const progress = (elapsedMinutes / duration) * 100;
  return Math.min(100, Math.max(0, progress));
};

/**
 * IV 처방 전체 계산
 * @param medicationName 약품명
 * @param totalVolume 총 투여량 (mL)
 * @param duration 투여 시간 (분)
 * @param gttFactor GTT factor (20 or 60)
 * @param prescribedBy 처방의사
 * @param notes 특이사항
 * @returns 계산된 IV 처방 정보
 */
export const createIVPrescription = (
  medicationName: string,
  totalVolume: number,
  duration: number,
  gttFactor: 20 | 60,
  prescribedBy: string,
  notes?: string
): IVPrescription => {
  const calculatedGTT = calculateGTT(totalVolume, duration, gttFactor);
  const calculatedFlowRate = calculateFlowRate(totalVolume, duration);

  return {
    id: `rx_${Date.now()}`,
    medicationName,
    totalVolume,
    duration,
    gttFactor,
    calculatedGTT: Math.round(calculatedGTT * 10) / 10, // 소수점 1자리
    calculatedFlowRate: Math.round(calculatedFlowRate * 10) / 10,
    prescribedBy,
    prescribedAt: new Date(),
    notes
  };
};

/**
 * 유량 편차 계산 및 알림 레벨 결정
 * @param prescribedRate 처방된 유량 (mL/min)
 * @param actualRate 실제 측정된 유량 (mL/min)
 * @returns 편차 정보와 알림 레벨
 */
export const calculateFlowDeviation = (
  prescribedRate: number,
  actualRate: number
) => {
  const deviation = actualRate - prescribedRate;
  const deviationPercent = (Math.abs(deviation) / prescribedRate) * 100;

  let alertLevel: 'normal' | 'warning' | 'critical' = 'normal';

  if (deviationPercent > 20) {
    alertLevel = 'critical';
  } else if (deviationPercent > 10) {
    alertLevel = 'warning';
  }

  return {
    deviation: Math.round(deviation * 10) / 10,
    deviationPercent: Math.round(deviationPercent * 10) / 10,
    alertLevel,
    message: deviationPercent > 10
      ? `유량 편차 ${deviationPercent.toFixed(1)}% (처방: ${prescribedRate.toFixed(2)} mL/min, 실제: ${actualRate.toFixed(2)} mL/min)`
      : null
  };
};

/**
 * 일반적인 약물별 기본 설정
 */
export const COMMON_MEDICATIONS = [
  {
    id: 'saline',
    name: '생리식염수',
    concentration: undefined,
    commonDosages: [500, 1000],
    unit: 'mL' as const,
    category: 'fluid' as const
  },
  {
    id: 'dextrose_5',
    name: '5% 포도당',
    concentration: undefined,
    commonDosages: [500, 1000],
    unit: 'mL' as const,
    category: 'fluid' as const
  },
  {
    id: 'dextrose_10',
    name: '10% 포도당',
    concentration: undefined,
    commonDosages: [500, 1000],
    unit: 'mL' as const,
    category: 'fluid' as const
  },
  {
    id: 'ringer',
    name: '링거액',
    concentration: undefined,
    commonDosages: [500, 1000],
    unit: 'mL' as const,
    category: 'fluid' as const
  },
  {
    id: 'hartmann',
    name: '하트만액',
    concentration: undefined,
    commonDosages: [500, 1000],
    unit: 'mL' as const,
    category: 'fluid' as const
  }
];

/**
 * 일반적인 투여 시간 옵션 (분)
 */
export const COMMON_DURATIONS = [
  { label: '30분', value: 30 },
  { label: '1시간', value: 60 },
  { label: '2시간', value: 120 },
  { label: '3시간', value: 180 },
  { label: '4시간', value: 240 },
  { label: '6시간', value: 360 },
  { label: '8시간', value: 480 },
  { label: '12시간', value: 720 },
  { label: '24시간', value: 1440 }
];