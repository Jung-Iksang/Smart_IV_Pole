import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, AlertTriangle, AlertCircle, Info, CheckCircle,
  Clock, Filter, Volume2, VolumeX, X, Check,
  Droplet, Battery, Phone, WifiOff, Settings,
  Gauge, Timer, OctagonAlert
} from 'lucide-react';
import { useWardStore } from '../../stores/wardStore';
import { Alert } from '../../types';
import { alertTypeLabel } from '../../utils/alertTypes';

interface AlertCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const AlertCenter: React.FC<AlertCenterProps> = ({ isOpen, onClose }) => {
  const {
    alerts,
    getActiveAlerts,
    getCriticalAlerts,
    acknowledgeAlert,
    acknowledgeAlertBackend,
    removeAlert,
    getPatientById
  } = useWardStore();

  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('alertSoundEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const playedAlertIds = useRef<Set<string>>(new Set());

  // 필터링된 알림
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return !alert.acknowledged;
    return !alert.acknowledged && alert.severity === filter;
  });

  // 우선순위별 정렬 (critical > warning > info, 최신순)
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    const severityOrder = { critical: 3, warning: 2, info: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // 알림 사운드 재생
  const playAlertSound = (severity: 'critical' | 'warning' | 'info') => {
    if (!soundEnabled) return;

    // HTML5 Audio API 사용
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 심각도별 다른 음조
    const frequency = severity === 'critical' ? 1000 : severity === 'warning' ? 800 : 600;
    const duration = severity === 'critical' ? 1000 : 500;

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration / 1000);
  };

  // 새 알림 감지 - 실제로 새로운 알림이 추가될 때만 사운드 재생
  useEffect(() => {
    const newCriticalAlerts = getCriticalAlerts().filter(alert =>
      !playedAlertIds.current.has(alert.id)
    );

    if (newCriticalAlerts.length > 0) {
      newCriticalAlerts.forEach(alert => {
        playedAlertIds.current.add(alert.id);
        playAlertSound(alert.severity);
      });
    }

    // 확인된 또는 삭제된 알림은 playedAlertIds에서 제거
    const currentAlertIds = new Set(alerts.map(alert => alert.id));
    playedAlertIds.current.forEach(alertId => {
      if (!currentAlertIds.has(alertId)) {
        playedAlertIds.current.delete(alertId);
      }
    });
  }, [alerts, soundEnabled, getCriticalAlerts, playAlertSound]);

  // 알림 확인 처리 (Backend 연동)
  const handleAcknowledge = (alertId: string) => {
    acknowledgeAlertBackend(alertId, 'NURSE001'); // Backend API 호출 후 로컬 업데이트
  };

  // 알림 삭제
  const handleRemove = (alertId: string) => {
    removeAlert(alertId);
  };

  // 전체 확인
  const handleAcknowledgeAll = () => {
    sortedAlerts.forEach(alert => {
      handleAcknowledge(alert.id);
    });
  };

  // 알림 아이콘 반환
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'low':
      case 'empty':
        return <Droplet className="w-5 h-5" />;
      case 'battery_low':
        return <Battery className="w-5 h-5" />;
      case 'button_pressed': // 간호사 호출 (nurse_call)
        return <Bell className="w-5 h-5 animate-pulse" />; // 벨 아이콘 + 애니메이션
      case 'offline':
        return <WifiOff className="w-5 h-5" />;
      case 'abnormal':
        return <AlertTriangle className="w-5 h-5" />;
      // BLE 직결 유속 알림 3종 (모바일 앱과 동일 아이콘)
      case 'flow_fast':
        return <Gauge className="w-5 h-5" />;
      case 'flow_slow':
        return <Timer className="w-5 h-5" />;
      case 'flow_stop':
        return <OctagonAlert className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  // 심각도별 스타일
  const getSeverityStyle = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'warning':
        return 'border-orange-200 bg-orange-50 text-orange-800';
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  const getSeverityIconColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500';
      case 'warning':
        return 'text-orange-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">알림 센터</h2>
                <p className="text-blue-100 text-sm">
                  활성 알림 {sortedAlerts.length}건 | 긴급 {getCriticalAlerts().length}건
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Sound Toggle */}
              <button
                onClick={() => {
                  const newSoundEnabled = !soundEnabled;
                  setSoundEnabled(newSoundEnabled);
                  localStorage.setItem('alertSoundEnabled', JSON.stringify(newSoundEnabled));
                }}
                className={`p-2 rounded-lg transition-colors ${
                  soundEnabled ? 'bg-blue-500 text-white' : 'bg-blue-300 text-blue-600'
                }`}
                title={soundEnabled ? '사운드 끄기' : '사운드 켜기'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                전체 ({filteredAlerts.length})
              </button>
              <button
                onClick={() => setFilter('critical')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'critical'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                긴급 ({alerts.filter(a => !a.acknowledged && a.severity === 'critical').length})
              </button>
              <button
                onClick={() => setFilter('warning')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'warning'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                주의 ({alerts.filter(a => !a.acknowledged && a.severity === 'warning').length})
              </button>
              <button
                onClick={() => setFilter('info')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'info'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                정보 ({alerts.filter(a => !a.acknowledged && a.severity === 'info').length})
              </button>
            </div>

            {sortedAlerts.length > 0 && (
              <button
                onClick={handleAcknowledgeAll}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                모두 확인
              </button>
            )}
          </div>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto max-h-[60vh]">
          {sortedAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">모든 알림이 확인되었습니다</h3>
              <p className="text-sm">새로운 알림이 있을 때 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {sortedAlerts.map((alert) => {
                const patient = alert.patientId ? getPatientById(alert.patientId) : null;
                const timeAgo = Math.floor((Date.now() - alert.timestamp.getTime()) / 60000);

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border-l-4 ${getSeverityStyle(alert.severity)} relative group`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`mt-1 ${getSeverityIconColor(alert.severity)}`}>
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold">
                              {alertTypeLabel(alert.type)}
                            </span>
                            {patient && (
                              <span className="text-sm font-medium text-gray-900">
                                {patient.name}
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              alert.severity === 'critical'
                                ? 'bg-red-100 text-red-800'
                                : alert.severity === 'warning'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {alert.severity === 'critical' ? '긴급' :
                               alert.severity === 'warning' ? '주의' : '정보'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 mb-2">{alert.message}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo < 1 ? '방금 전' :
                               timeAgo < 60 ? `${timeAgo}분 전` :
                               `${Math.floor(timeAgo / 60)}시간 전`}
                            </span>
                            {alert.poleId && (
                              <span>폴대: {alert.poleId}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="p-1 text-green-600 hover:bg-green-100 rounded-full transition-colors"
                          title="확인"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(alert.id)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                          title="삭제"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}</span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                자동 새로고침
              </label>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>긴급</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>주의</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>정보</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertCenter;