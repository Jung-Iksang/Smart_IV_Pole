import React, { useEffect, useRef, useState } from 'react';
import { Bluetooth, BluetoothConnected, BluetoothSearching, BluetoothOff, ChevronDown, UserCog, Unplug } from 'lucide-react';
import { useBleStore } from '../../stores/bleStore';
import { useWardStore } from '../../stores/wardStore';

/**
 * 헤더의 BLE 직결 버튼.
 *  - 끊김: 클릭 → 기기 선택 팝업(사용자 제스처 필요)
 *  - 연결됨: 클릭 → 드롭다운 {환자 변경, 연결 해제}
 */
const BleConnectButton: React.FC = () => {
  const { status, deviceName, patientId, error, isSupported, connect, disconnect, openPatientPicker } = useBleStore();
  const getPatientById = useWardStore((s) => s.getPatientById);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  if (!isSupported) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-sm cursor-not-allowed"
        title="이 브라우저는 Web Bluetooth를 지원하지 않습니다. Chrome 또는 Edge를 사용하세요."
      >
        <BluetoothOff className="h-4 w-4" />
        <span>BLE 미지원</span>
      </div>
    );
  }

  const patientName = patientId ? getPatientById(patientId)?.name : undefined;
  const busy = status === 'connecting';
  const connected = status === 'connected';

  let icon: React.ReactNode;
  let label: string;
  let cls: string;
  if (connected) {
    icon = <BluetoothConnected className="h-4 w-4" />;
    label = patientName ? `${deviceName} · ${patientName}` : `${deviceName} · 환자 미지정`;
    cls = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
  } else if (busy) {
    icon = <BluetoothSearching className="h-4 w-4 animate-pulse" />;
    label = '기기 연결 중…';
    cls = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (status === 'error') {
    icon = <Bluetooth className="h-4 w-4" />;
    label = '연결 끊김 · 다시 연결';
    cls = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
  } else {
    icon = <Bluetooth className="h-4 w-4" />;
    label = 'BLE 폴 연결';
    cls = 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100';
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => (connected ? setMenuOpen((v) => !v) : connect())}
        disabled={busy}
        title={error ?? (connected ? '클릭하여 환자 변경 / 연결 해제' : 'ESP32 IV 폴에 BLE로 직접 연결')}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-70 ${cls}`}
      >
        {icon}
        <span className="max-w-[220px] truncate">{label}</span>
        {connected && <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
      </button>

      {menuOpen && connected && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-40">
          <button
            onClick={() => { setMenuOpen(false); openPatientPicker(); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <UserCog className="h-4 w-4" /> 환자 변경
          </button>
          <button
            onClick={() => { setMenuOpen(false); void disconnect(); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Unplug className="h-4 w-4" /> 연결 해제
          </button>
        </div>
      )}
    </div>
  );
};

export default BleConnectButton;
