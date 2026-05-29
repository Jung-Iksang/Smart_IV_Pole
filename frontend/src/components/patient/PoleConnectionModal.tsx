import React, { useState, useEffect } from 'react';
import { X, Radio, Battery, Wifi, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useWardStore } from '../../stores/wardStore';

interface Pole {
  poleId: string;
  status: string;
  batteryLevel: number;
  isOnline: boolean;
  lastPingAt?: string;
  patientId?: string;
}

interface PoleConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  currentPoleId?: string; // 이미 연결된 폴대가 있으면 표시
}

const PoleConnectionModal: React.FC<PoleConnectionModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  currentPoleId
}) => {
  const { connectPoleToPatient, disconnectPoleFromPatient, sendPrescriptionToESP, patients } = useWardStore();
  const [onlinePoles, setOnlinePoles] = useState<Pole[]>([]);
  const [selectedPoleId, setSelectedPoleId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [prescriptionStatus, setPrescriptionStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [prescriptionMessage, setPrescriptionMessage] = useState<string>('');

  // 온라인 폴대 목록 불러오기
  useEffect(() => {
    if (isOpen) {
      fetchOnlinePoles();
    }
  }, [isOpen]);

  const fetchOnlinePoles = async () => {
    setLoading(true);
    setError('');

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1';
      const response = await fetch(`${API_URL}/poles/online`);

      if (!response.ok) {
        throw new Error('온라인 폴대 목록을 불러올 수 없습니다');
      }

      const data = await response.json();
      setOnlinePoles(data);

      // 현재 연결된 폴대가 있으면 선택
      if (currentPoleId) {
        setSelectedPoleId(currentPoleId);
      }
    } catch (err) {
      console.error('폴대 목록 불러오기 실패:', err);
      setError('온라인 폴대 목록을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedPoleId) {
      setError('폴대를 선택해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await connectPoleToPatient(patientId, selectedPoleId);
      onClose();
    } catch (err) {
      console.error('폴대 연결 실패:', err);
      setError('폴대 연결 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentPoleId) return;

    setLoading(true);
    setError('');

    try {
      await disconnectPoleFromPatient(patientId);
      onClose();
    } catch (err) {
      console.error('폴대 연결 해제 실패:', err);
      setError('폴대 연결 해제 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPrescription = async () => {
    setPrescriptionStatus('sending');
    setPrescriptionMessage('');

    try {
      const result = await sendPrescriptionToESP(patientId);
      setPrescriptionStatus('success');
      setPrescriptionMessage('처방 정보가 ESP8266으로 전송되었습니다');
      console.log('처방 전송 성공:', result);

      // 3초 후 상태 초기화
      setTimeout(() => {
        setPrescriptionStatus('idle');
        setPrescriptionMessage('');
      }, 3000);
    } catch (err: any) {
      setPrescriptionStatus('error');
      setPrescriptionMessage(err.message || '처방 정보 전송 실패');
      console.error('처방 전송 실패:', err);

      // 5초 후 상태 초기화
      setTimeout(() => {
        setPrescriptionStatus('idle');
        setPrescriptionMessage('');
      }, 5000);
    }
  };

  // 현재 환자가 처방을 가지고 있는지 확인
  const patient = patients.find(p => p.id === patientId);
  const hasPrescription = patient?.currentPrescription != null;

  const getBatteryColor = (level: number) => {
    if (level >= 70) return 'text-green-600';
    if (level >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLastPingText = (lastPingAt?: string) => {
    if (!lastPingAt) return '알 수 없음';

    const now = new Date();
    const ping = new Date(lastPingAt);
    const diffSeconds = Math.floor((now.getTime() - ping.getTime()) / 1000);

    if (diffSeconds < 60) return `${diffSeconds}초 전`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}분 전`;
    return `${Math.floor(diffSeconds / 3600)}시간 전`;
  };

  if (!isOpen) return null;

  // 사용 가능한 폴대 (온라인 + 미배정)
  const availablePoles = onlinePoles.filter(pole => !pole.patientId || pole.poleId === currentPoleId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Radio className="w-6 h-6 text-blue-600" />
              폴대 연결
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              환자: <span className="font-semibold">{patientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* 현재 연결된 폴대 정보 */}
          {currentPoleId && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-semibold text-gray-900">현재 연결된 폴대</div>
                    <div className="text-sm text-gray-600">{currentPoleId}</div>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  연결 해제
                </button>
              </div>

              {/* 처방 정보 전송 섹션 */}
              <div className="pt-3 border-t border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">처방 정보 상태</div>
                      {hasPrescription ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                          처방 있음
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                          처방 없음
                        </span>
                      )}
                    </div>
                    {prescriptionMessage && (
                      <div className={`mt-2 text-sm ${
                        prescriptionStatus === 'success' ? 'text-green-700' :
                        prescriptionStatus === 'error' ? 'text-red-700' :
                        'text-gray-600'
                      }`}>
                        {prescriptionMessage}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSendPrescription}
                    disabled={!hasPrescription || prescriptionStatus === 'sending'}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${prescriptionStatus === 'sending' ? 'animate-spin' : ''}`} />
                    {prescriptionStatus === 'sending' ? '전송 중...' : '처방 전송'}
                  </button>
                </div>
                {!hasPrescription && (
                  <div className="mt-2 text-xs text-gray-600">
                    환자에게 먼저 처방을 등록해주세요
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600">로딩 중...</p>
            </div>
          )}

          {/* 온라인 폴대 목록 */}
          {!loading && (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-green-600" />
                  온라인 폴대 ({availablePoles.length}개)
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  사용 가능한 폴대를 선택하세요
                </p>
              </div>

              {availablePoles.length === 0 ? (
                <div className="py-8 text-center">
                  <Radio className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">현재 사용 가능한 온라인 폴대가 없습니다</p>
                  <button
                    onClick={fetchOnlinePoles}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-700"
                  >
                    새로고침
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {availablePoles.map((pole) => (
                    <button
                      key={pole.poleId}
                      onClick={() => setSelectedPoleId(pole.poleId)}
                      disabled={pole.patientId && pole.poleId !== currentPoleId}
                      className={`
                        w-full p-4 border-2 rounded-lg transition-all text-left
                        ${selectedPoleId === pole.poleId
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }
                        ${pole.patientId && pole.poleId !== currentPoleId ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Selection Indicator */}
                          <div className={`
                            w-5 h-5 rounded-full border-2 flex items-center justify-center
                            ${selectedPoleId === pole.poleId
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-gray-300'
                            }
                          `}>
                            {selectedPoleId === pole.poleId && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>

                          {/* Pole Info */}
                          <div>
                            <div className="font-semibold text-gray-900">
                              {pole.poleId}
                            </div>
                            <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                              <span className="flex items-center gap-1">
                                <Battery className={`w-4 h-4 ${getBatteryColor(pole.batteryLevel)}`} />
                                {pole.batteryLevel}%
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Wifi className="w-4 h-4 text-green-600" />
                                {getLastPingText(pole.lastPingAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {pole.poleId === currentPoleId && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              현재 연결
                            </span>
                          )}
                          {pole.patientId && pole.poleId !== currentPoleId && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                              사용 중
                            </span>
                          )}
                          {!pole.patientId && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              사용 가능
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-4 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleConnect}
              disabled={!selectedPoleId || loading || selectedPoleId === currentPoleId}
              className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Radio className="w-4 h-4" />
              {currentPoleId ? '폴대 변경' : '폴대 연결'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoleConnectionModal;
