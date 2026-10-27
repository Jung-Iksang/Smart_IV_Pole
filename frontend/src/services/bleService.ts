/**
 * ESP32 IV 폴 BLE 직결 클라이언트 (Web Bluetooth, Chrome/Edge 전용)
 *
 * 펌웨어 ble_wifi_prov.h 와 같은 서비스/특성 UUID를 쓴다.
 * IV 상태 특성(a3c87504)의 notify 프레임을 JSON으로 파싱해 콜백으로 넘긴다.
 *   {"type":"telemetry","w":512.3,"w0":550.0,"flow":0.0123,"eta":3400,"state":"monitor","dev":12.5}
 *   {"type":"alert","alert":"flow_stop","dev":-96.1,"msg":"..."}
 *   {"phase":"monitor","weight":..,"flow":..}   ← 구 프레임(상태 전환)
 *
 * 보안 컨텍스트(localhost 또는 https)에서만 동작하고, requestDevice는 클릭 등
 * 사용자 제스처 안에서 호출해야 한다.
 */

export const BLE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const BLE_IV_STATUS_UUID = 'a3c87504-8ed3-4bdf-8a39-a01bebede295';
export const BLE_COMMAND_UUID = 'a3c87503-8ed3-4bdf-8a39-a01bebede295';
export const BLE_NAME_PREFIX = 'INFUCARE';

export type BleStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BleTelemetryFrame {
  type: 'telemetry';
  w: number;        // 현재 무게(g) ≈ 잔량(ml)
  w0: number;       // 거치 시점 무게(g). 0이면 미정
  flow: number;     // g/s
  eta: number;      // 예상 남은 초. -1이면 미정
  state: string;    // wait | baseline | monitor | stabilize | done | tare
  dev?: number;     // 기준 유속 대비 편차 %
}

export interface BleAlertFrame {
  type: 'alert';
  alert: 'flow_fast' | 'flow_slow' | 'flow_stop' | string;
  dev?: number;
  msg: string;
}

export type BleFrame = BleTelemetryFrame | BleAlertFrame;

type FrameHandler = (frame: BleFrame, raw: Record<string, unknown>) => void;
type StatusHandler = (status: BleStatus, error?: string) => void;

const RECONNECT_DELAYS_MS = [1000, 2000, 3000];

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

/** 수신 JSON을 통일된 프레임으로 정규화. 알 수 없는 프레임은 null. */
export function normalizeFrame(json: Record<string, unknown>): BleFrame | null {
  const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

  if (json.type === 'telemetry') {
    return {
      type: 'telemetry',
      w: num(json.w),
      w0: num(json.w0),
      flow: num(json.flow),
      eta: num(json.eta, -1),
      state: String(json.state ?? 'unknown').toLowerCase(),
      dev: typeof json.dev === 'number' ? json.dev : undefined,
    };
  }
  if (json.type === 'alert') {
    return {
      type: 'alert',
      alert: String(json.alert ?? 'unknown'),
      dev: typeof json.dev === 'number' ? json.dev : undefined,
      msg: String(json.msg ?? ''),
    };
  }
  // 구 펌웨어 phase 프레임 → telemetry 로 흡수
  if ('phase' in json) {
    return {
      type: 'telemetry',
      w: num(json.weight),
      w0: 0,
      flow: num(json.flow),
      eta: -1,
      state: String(json.phase ?? 'unknown').toLowerCase(),
    };
  }
  return null;
}

export class BleIvPoleClient {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private status: BleStatus = 'disconnected';
  private userDisconnected = false;
  private reconnecting = false;
  private readonly decoder = new TextDecoder('utf-8');

  constructor(
    private readonly onFrame: FrameHandler,
    private readonly onStatus: StatusHandler,
  ) {}

  get deviceName(): string | null {
    return this.device?.name ?? null;
  }

  get isConnected(): boolean {
    return this.status === 'connected' && !!this.device?.gatt?.connected;
  }

  /** 기기 선택 팝업 → 연결 → notify 구독. 반드시 사용자 제스처 안에서 호출. */
  async requestAndConnect(): Promise<string> {
    if (!isWebBluetoothSupported()) {
      throw new Error('이 브라우저는 Web Bluetooth를 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.');
    }
    if (!window.isSecureContext) {
      throw new Error('BLE는 localhost 또는 https 에서만 동작합니다. http://localhost:3000 으로 여세요.');
    }

    this.userDisconnected = false;
    this.setStatus('connecting');

    try {
      const device = await navigator.bluetooth!.requestDevice({
        filters: [{ namePrefix: BLE_NAME_PREFIX }],
        optionalServices: [BLE_SERVICE_UUID],
      });
      this.attachDevice(device);
      await this.connectGatt();
      return device.name ?? device.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 사용자가 팝업을 닫은 경우는 오류가 아니라 취소
      if (/cancel/i.test(msg)) {
        this.setStatus('disconnected');
        throw new Error('기기 선택이 취소되었습니다.');
      }
      this.setStatus('error', msg);
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    this.userDisconnected = true;
    try {
      if (this.characteristic) {
        this.characteristic.removeEventListener('characteristicvaluechanged', this.handleValue);
        try { await this.characteristic.stopNotifications(); } catch { /* 이미 끊김 */ }
      }
      this.device?.gatt?.disconnect();
    } finally {
      this.characteristic = null;
      this.setStatus('disconnected');
    }
  }

  private attachDevice(device: BluetoothDevice) {
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnected);
    }
    this.device = device;
    device.addEventListener('gattserverdisconnected', this.handleDisconnected);
  }

  private async connectGatt(): Promise<void> {
    const gatt = this.device?.gatt;
    if (!gatt) throw new Error('GATT 서버를 사용할 수 없습니다.');

    const server = await gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    const ch = await service.getCharacteristic(BLE_IV_STATUS_UUID);
    await ch.startNotifications();
    ch.addEventListener('characteristicvaluechanged', this.handleValue);
    this.characteristic = ch;
    this.setStatus('connected');
    console.log(`🔵 [BLE] 연결됨: ${this.device?.name}`);

    // 연결 직후 현재 상태 1회 요청 (커맨드 특성이 있는 펌웨어만)
    try {
      const cmd = await service.getCharacteristic(BLE_COMMAND_UUID);
      await cmd.writeValue(new TextEncoder().encode(JSON.stringify({ cmd: 'status' })));
    } catch { /* 선택 기능 */ }
  }

  private handleValue = (ev: Event) => {
    const target = ev.target as BluetoothRemoteGATTCharacteristic;
    const dv = target.value;
    if (!dv || dv.byteLength === 0) return;
    const raw = this.decoder.decode(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
    try {
      const json = JSON.parse(raw) as Record<string, unknown>;
      const frame = normalizeFrame(json);
      if (frame) this.onFrame(frame, json);
      else console.warn('[BLE] 알 수 없는 프레임:', raw);
    } catch (e) {
      console.warn('[BLE] 프레임 파싱 실패:', raw, e);
    }
  };

  private handleDisconnected = () => {
    console.warn('🔴 [BLE] 링크 끊김');
    this.characteristic = null;
    if (this.userDisconnected) {
      this.setStatus('disconnected');
      return;
    }
    void this.tryReconnect();
  };

  private async tryReconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.setStatus('connecting');
    try {
      for (const [i, delay] of RECONNECT_DELAYS_MS.entries()) {
        await new Promise((r) => setTimeout(r, delay));
        if (this.userDisconnected) return;
        try {
          console.log(`🔄 [BLE] 재연결 시도 ${i + 1}/${RECONNECT_DELAYS_MS.length}`);
          await this.connectGatt();
          return;
        } catch (e) {
          console.warn('[BLE] 재연결 실패:', e);
        }
      }
      this.setStatus('error', '기기와 연결이 끊겼어요. 다시 연결해주세요.');
    } finally {
      this.reconnecting = false;
    }
  }

  private setStatus(status: BleStatus, error?: string) {
    this.status = status;
    this.onStatus(status, error);
  }
}
