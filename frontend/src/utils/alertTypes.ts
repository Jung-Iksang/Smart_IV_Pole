import type { Alert } from '../types';

/**
 * 알림 타입별 라벨/심각도. 모바일 앱(alert_type_config.dart)과 문구를 맞춘다.
 */
export const ALERT_TYPE_LABELS: Record<Alert['type'], string> = {
  low: '수액 잔량 부족',
  empty: '수액 소진',
  abnormal: '유속 이상',
  button_pressed: '간호사 호출',
  battery_low: '배터리 부족',
  offline: '기기 연결 끊김',
  custom: '알림',
  flow_fast: '유속 과다',
  flow_slow: '유속 느림',
  flow_stop: '줄 꺾임·혈액 역류 가능 (유속 정지)',
};

export function alertTypeLabel(type: Alert['type']): string {
  return ALERT_TYPE_LABELS[type] ?? '알림';
}

/** BLE 알림 코드 → 심각도. 과다/정지는 긴급, 느림은 주의 (앱의 빨강/주황과 동일) */
export function bleAlertSeverity(type: string): Alert['severity'] {
  return type === 'flow_slow' ? 'warning' : 'critical';
}

export function isBleAlertType(type: string): type is 'flow_fast' | 'flow_slow' | 'flow_stop' {
  return type === 'flow_fast' || type === 'flow_slow' || type === 'flow_stop';
}
