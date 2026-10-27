import { create } from 'zustand';
import toast from 'react-hot-toast';
import { BleIvPoleClient, type BleFrame, type BleStatus } from '../services/bleService';
import { useWardStore } from './wardStore';
import { alertTypeLabel, bleAlertSeverity, isBleAlertType } from '../utils/alertTypes';
import type { Alert } from '../types';

/**
 * 노트북 ↔ ESP32 BLE 직결 상태.
 * 프레임은 useWebSocket.ts 가 쓰는 것과 같은 진입점(updatePoleData / addAlert)으로 흘려보내
 * 침대 카드 색, 알림 센터 목록·비프음이 그대로 동작하게 한다.
 */

const PATIENT_MAP_KEY = 'smart_iv_pole_ble_patient'; // { [poleId]: patientId }

function loadPatientMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PATIENT_MAP_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function savePatientMap(map: Record<string, string>) {
  localStorage.setItem(PATIENT_MAP_KEY, JSON.stringify(map));
}

interface BleState {
  status: BleStatus;
  deviceName: string | null;
  patientId: string | null;
  error: string | null;
  lastFrameAt: Date | null;
  /** 연결은 됐는데 환자 매핑이 없어 선택 모달을 띄워야 하는 상태 */
  needsPatient: boolean;
  isSupported: boolean;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setPatient: (patientId: string) => void;
  openPatientPicker: () => void;
  closePatientPicker: () => void;
}

let client: BleIvPoleClient | null = null;

export const useBleStore = create<BleState>((set, get) => {
  const handleStatus = (status: BleStatus, error?: string) => {
    set({ status, error: error ?? null });
  };

  const handleFrame = (frame: BleFrame) => {
    const { deviceName, patientId } = get();
    if (!deviceName) return;
    const poleId = deviceName;
    const ward = useWardStore.getState();
    set({ lastFrameAt: new Date() });

    if (frame.type === 'telemetry') {
      const existing = ward.poleData.get(poleId);
      const patient = patientId ? ward.patients.find((p) => p.id === patientId) : undefined;
      const prescribed = patient?.currentPrescription?.totalVolume;
      const capacity = prescribed || (frame.w0 > 0 ? frame.w0 : existing?.capacity || 500);
      const volume = Math.max(0, frame.w);
      const percentage = Math.max(0, Math.min(100, (volume / capacity) * 100));
      const idle = frame.state === 'wait' || frame.state === 'done' || frame.state === 'tare';
      const hasActiveAlert = existing?.hasActiveAlert ?? false;

      ward.updatePoleData(poleId, {
        poleId,
        ...(patientId ? { patientId } : {}),
        weight: frame.w,
        currentVolume: volume,
        capacity,
        percentage,
        flowRate: idle || frame.flow <= 0 ? 0 : frame.flow * 60, // g/s → mL/min
        estimatedTime: frame.eta > 0 ? frame.eta / 60 : 0,
        status: hasActiveAlert ? 'error' : 'online',
        lastUpdate: new Date(),
      });
      return;
    }

    // alert
    const type: Alert['type'] = isBleAlertType(frame.alert) ? frame.alert : 'abnormal';
    const severity = bleAlertSeverity(frame.alert);
    const label = alertTypeLabel(type);
    const message = frame.msg || label;

    ward.updatePoleData(poleId, {
      poleId,
      ...(patientId ? { patientId } : {}),
      hasActiveAlert: true,
      alertSeverity: severity === 'critical' ? 'critical' : 'warning',
      status: 'error',
    });

    ward.addAlert({
      id: `BLE-${poleId}-${Date.now()}`,
      poleId,
      patientId: patientId ?? undefined,
      type,
      severity,
      message,
      timestamp: new Date(),
      acknowledged: false,
    });

    const patientName = patientId ? ward.getPatientById(patientId)?.name : undefined;
    showAlertToast(label, message, severity, patientName);
  };

  return {
    status: 'disconnected',
    deviceName: null,
    patientId: null,
    error: null,
    lastFrameAt: null,
    needsPatient: false,
    isSupported: typeof navigator !== 'undefined' && !!navigator.bluetooth,

    connect: async () => {
      if (!client) client = new BleIvPoleClient(handleFrame, handleStatus);
      try {
        const name = await client.requestAndConnect();
        const mapped = loadPatientMap()[name] ?? null;
        set({ deviceName: name, patientId: mapped, needsPatient: !mapped, error: null });
        if (mapped) linkPoleToPatientBed(name, mapped);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        set({ error: msg });
        if (!/취소/.test(msg)) toast.error(msg);
      }
    },

    disconnect: async () => {
      await client?.disconnect();
      set({ status: 'disconnected', needsPatient: false, error: null });
    },

    setPatient: (patientId) => {
      const { deviceName } = get();
      if (!deviceName) return;
      const map = loadPatientMap();
      map[deviceName] = patientId;
      savePatientMap(map);
      set({ patientId, needsPatient: false });
      linkPoleToPatientBed(deviceName, patientId);
    },

    openPatientPicker: () => set({ needsPatient: true }),
    closePatientPicker: () => set({ needsPatient: false }),
  };
});

/**
 * BLE 폴을 선택한 환자의 침대에 즉시 연결한다.
 * updatePoleData 의 자동 연결은 침대에 poleData 가 없을 때만 동작하므로,
 * 다른 폴이 붙어 있던 침대나 이미 다른 침대에 붙은 같은 폴을 여기서 정리한다.
 */
function linkPoleToPatientBed(poleId: string, patientId: string) {
  const ward = useWardStore.getState();
  ward.updatePoleData(poleId, { poleId, patientId });
  const pole = useWardStore.getState().poleData.get(poleId);
  useWardStore.setState((state) => ({
    beds: state.beds.map((bed) => {
      if (bed.patient?.id === patientId) return { ...bed, poleData: pole };
      if (bed.poleData?.poleId === poleId) return { ...bed, poleData: undefined };
      return bed;
    }),
  }));
  useWardStore.getState().saveToStorage();
}

function showAlertToast(
  label: string,
  message: string,
  severity: Alert['severity'],
  patientName?: string,
) {
  const critical = severity === 'critical';
  toast.custom(
    (t) => (
      <div
        className={`${t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'opacity-0'} max-w-sm w-full rounded-xl shadow-lg border-l-4 bg-white px-4 py-3 ${
          critical ? 'border-red-500' : 'border-orange-500'
        }`}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${critical ? 'bg-red-500' : 'bg-orange-500'} animate-pulse`}
          />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${critical ? 'text-red-700' : 'text-orange-700'}`}>
              {label}
              {patientName ? <span className="ml-2 text-gray-500 font-medium">{patientName}</span> : null}
            </p>
            <p className="text-sm text-gray-700 mt-0.5">{message}</p>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      </div>
    ),
    { duration: 6000, id: `ble-alert-${Date.now()}` },
  );
}
