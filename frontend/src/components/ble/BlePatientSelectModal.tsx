import React from 'react';
import { X, Bluetooth, User, BedDouble } from 'lucide-react';
import { useWardStore } from '../../stores/wardStore';
import { useBleStore } from '../../stores/bleStore';

/**
 * BLE 폴이 어느 환자(침대)의 것인지 고르는 모달.
 * 연결 직후 매핑이 없을 때 자동으로 열리고, 헤더 버튼의 "환자 변경"으로도 연다.
 */
const BlePatientSelectModal: React.FC = () => {
  const { beds } = useWardStore();
  const { needsPatient, deviceName, patientId, setPatient, closePatientPicker } = useBleStore();

  if (!needsPatient) return null;

  const occupied = beds.filter((b) => b.patient);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bluetooth className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">폴 기기 환자 연결</h2>
              <p className="text-blue-100 text-sm">{deviceName ?? 'BLE 기기'} 가 어느 환자의 폴인가요?</p>
            </div>
          </div>
          <button onClick={closePatientPicker} className="p-2 hover:bg-blue-500 rounded-lg" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {occupied.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">등록된 환자가 없어요</p>
              <p className="text-sm mt-1">병동 화면에서 빈 침대를 눌러 환자를 먼저 등록해주세요.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {occupied.map((bed) => {
                const selected = bed.patient!.id === patientId;
                return (
                  <li key={bed.bedNumber}>
                    <button
                      onClick={() => setPatient(bed.patient!.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left ${
                        selected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold">
                          {bed.patient!.name.slice(0, 1)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{bed.patient!.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <BedDouble className="w-3 h-3" /> {bed.room} · {bed.bedNumber}
                            {bed.poleData?.poleId ? ` · 현재 폴 ${bed.poleData.poleId}` : ''}
                          </p>
                        </div>
                      </div>
                      {selected && <span className="text-xs font-semibold text-blue-600">연결됨</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500">
          선택은 이 노트북에 저장되어 다음 연결부터 자동 적용됩니다.
        </div>
      </div>
    </div>
  );
};

export default BlePatientSelectModal;
