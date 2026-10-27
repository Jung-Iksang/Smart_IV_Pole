/**
 * 시연용 하드코딩 유속 알림 (키보드 1/2/3, 0 또는 Esc로 해제)
 * - 서버/BLE와 무관하게 병상 카드에만 표시한다. (토스트·알림센터·wardStore 미사용)
 */
export type DemoScenario = 'flow_fast' | 'flow_slow' | 'flow_stop';

export interface DemoScenarioSpec {
  label: string;
  detail: string;
  severity: 'warning' | 'critical';
  flowRate: number; // mL/min (하드코딩 표시값)
}

export const DEMO_SCENARIOS: Record<DemoScenario, DemoScenarioSpec> = {
  flow_fast: {
    label: '유속 빠름',
    detail: '처방 유속보다 빠르게 투여 중',
    severity: 'critical',
    flowRate: 3.0,
  },
  flow_slow: {
    label: '유속 느림',
    detail: '처방 유속보다 느리게 투여 중',
    severity: 'warning',
    flowRate: 0.3,
  },
  flow_stop: {
    label: '유속 정지',
    detail: '역류 또는 줄 꺾임 가능',
    severity: 'critical',
    flowRate: 0,
  },
};

export const DEMO_KEY_MAP: Record<string, DemoScenario> = {
  '1': 'flow_fast',
  '2': 'flow_slow',
  '3': 'flow_stop',
};
