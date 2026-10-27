import { create } from 'zustand';
import { DemoScenario } from '../utils/demoAlert';

/**
 * 시연용 가상 수액 상태 (서버/하드웨어 없음, 메모리 보관)
 * - 환자가 등록된 첫 병상에 90 mL 로 표시
 * - 시작: 2초에 1 mL 감소 (유속 빠름 1초, 느림 4초, 정지 시 멈춤)
 */
export const DEMO_START_ML = 90;
export const DEMO_CAPACITY_ML = 100;

interface DemoState {
  scenario: DemoScenario | null;
  volume: number;
  running: boolean;
  setScenario: (s: DemoScenario | null) => void;
  toggleRun: () => void;
  reset: () => void;
}

let timer: ReturnType<typeof setInterval> | null = null;
let tick = 0;

const secondsPerMl = (s: DemoScenario | null): number | null => {
  switch (s) {
    case 'flow_fast': return 1;
    case 'flow_slow': return 4;
    case 'flow_stop': return null; // 흐름 정지
    default: return 2;
  }
};

export const useDemoStore = create<DemoState>((set, get) => ({
  scenario: null,
  volume: DEMO_START_ML,
  running: false,

  setScenario: (scenario) => set({ scenario }),

  toggleRun: () => {
    if (get().running) {
      if (timer) clearInterval(timer);
      timer = null;
      set({ running: false });
      return;
    }
    tick = 0;
    timer = setInterval(() => {
      const { volume, scenario } = get();
      if (volume <= 0) { get().toggleRun(); return; }
      const sec = secondsPerMl(scenario);
      if (sec === null) return;
      tick++;
      if (tick % sec !== 0) return;
      set({ volume: volume - 1 });
    }, 1000);
    set({ running: true });
  },

  reset: () => {
    if (timer) clearInterval(timer);
    timer = null;
    set({ running: false, volume: DEMO_START_ML, scenario: null });
  },
}));
