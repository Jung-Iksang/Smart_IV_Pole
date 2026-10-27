import React, { useState } from 'react';
import {
  Calendar, Filter, Search, Download, Clock, CheckCircle,
  AlertTriangle, Info, Droplet, Battery, Phone, WifiOff,
  User, Tag
} from 'lucide-react';
import { useWardStore } from '../../stores/wardStore';
import { Alert } from '../../types';

const AlertHistory: React.FC = () => {
  const { alerts, getPatientById } = useWardStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
  const [typeFilter, setTypeFilter] = useState<'all' | Alert['type']>('all');

  // 날짜 필터링 함수
  const getDateFilter = (dateRange: string) => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return (date: Date) => date >= today;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return (date: Date) => date >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return (date: Date) => date >= monthAgo;
      default:
        return () => true;
    }
  };

  // 알림 필터링
  const filteredAlerts = alerts.filter(alert => {
    const dateFilter = getDateFilter(dateRange);
    const matchesDate = dateFilter(alert.timestamp);
    const matchesSearch = searchTerm === '' ||
      alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alert.patientId && getPatientById(alert.patientId)?.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesType = typeFilter === 'all' || alert.type === typeFilter;

    return matchesDate && matchesSearch && matchesSeverity && matchesType;
  });

  // 시간순 정렬 (최신순)
  const sortedAlerts = [...filteredAlerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // 통계 계산
  const stats = {
    total: filteredAlerts.length,
    critical: filteredAlerts.filter(a => a.severity === 'critical').length,
    warning: filteredAlerts.filter(a => a.severity === 'warning').length,
    info: filteredAlerts.filter(a => a.severity === 'info').length,
    acknowledged: filteredAlerts.filter(a => a.acknowledged).length,
  };

  // CSV 내보내기
  const exportToCSV = () => {
    const csvData = sortedAlerts.map(alert => {
      const patient = alert.patientId ? getPatientById(alert.patientId) : null;
      return {
        '시간': alert.timestamp.toLocaleString('ko-KR'),
        '환자': patient?.name || '해당없음',
        '유형': getAlertTypeLabel(alert.type),
        '심각도': getSeverityLabel(alert.severity),
        '메시지': alert.message,
        '폴대ID': alert.poleId,
        '확인상태': alert.acknowledged ? '확인됨' : '미확인',
        '확인자': alert.acknowledgedBy || '',
        '확인시간': alert.acknowledgedAt ? alert.acknowledgedAt.toLocaleString('ko-KR') : ''
      };
    });

    const headers = Object.keys(csvData[0] || {}).join(',');
    const rows = csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `alert_history_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 알림 유형 라벨
  const getAlertTypeLabel = (type: Alert['type']) => {
    const labels: Record<Alert['type'], string> = {
      low: '수액 부족',
      empty: '수액 소진',
      abnormal: '이상 상태',
      button_pressed: '호출 버튼',
      battery_low: '배터리 부족',
      offline: '연결 끊김',
      custom: '사용자 정의',
      flow_fast: '유속 과다',
      flow_slow: '유속 느림',
      flow_stop: '줄 꺾임·혈액 역류 가능'
    };
    return labels[type] || type;
  };

  // 심각도 라벨
  const getSeverityLabel = (severity: Alert['severity']) => {
    const labels = {
      critical: '긴급',
      warning: '주의',
      info: '정보'
    };
    return labels[severity];
  };

  // 알림 아이콘
  const getAlertIcon = (type: Alert['type']) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case 'low':
      case 'empty':
        return <Droplet className={iconClass} />;
      case 'battery_low':
        return <Battery className={iconClass} />;
      case 'button_pressed':
        return <Phone className={iconClass} />;
      case 'offline':
        return <WifiOff className={iconClass} />;
      case 'abnormal':
        return <AlertTriangle className={iconClass} />;
      default:
        return <Info className={iconClass} />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">알림 히스토리</h2>
            <p className="text-sm text-gray-600 mt-1">
              총 {stats.total}건 | 긴급 {stats.critical}건 | 미확인 {stats.total - stats.acknowledged}건
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-gray-50 border-b">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="환자명 또는 메시지 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="today">오늘</option>
            <option value="week">최근 1주일</option>
            <option value="month">최근 1개월</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 심각도</option>
            <option value="critical">긴급</option>
            <option value="warning">주의</option>
            <option value="info">정보</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 유형</option>
            <option value="low">수액 부족</option>
            <option value="empty">수액 소진</option>
            <option value="button_pressed">호출 버튼</option>
            <option value="battery_low">배터리 부족</option>
            <option value="offline">연결 끊김</option>
            <option value="abnormal">이상 상태</option>
          </select>
        </div>
      </div>

      {/* Alert List */}
      <div className="max-h-96 overflow-y-auto">
        {sortedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mb-4" />
            <h3 className="text-lg font-medium mb-2">해당 기간에 알림이 없습니다</h3>
            <p className="text-sm">필터 조건을 변경해보세요.</p>
          </div>
        ) : (
          <div className="divide-y">
            {sortedAlerts.map((alert) => {
              const patient = alert.patientId ? getPatientById(alert.patientId) : null;
              return (
                <div key={alert.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    {/* Icon & Severity */}
                    <div className="flex flex-col items-center">
                      <div className={`p-2 rounded-full ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                        alert.severity === 'warning' ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {getAlertIcon(alert.type)}
                      </div>
                      <span className={`text-xs mt-1 px-2 py-1 rounded-full font-medium ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        alert.severity === 'warning' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {getSeverityLabel(alert.severity)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {patient && (
                              <span className="font-medium text-gray-900">{patient.name}</span>
                            )}
                            <span className="text-sm text-gray-500">
                              {getAlertTypeLabel(alert.type)}
                            </span>
                            {alert.poleId && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {alert.poleId}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-800 mb-2">{alert.message}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {alert.timestamp.toLocaleString('ko-KR')}
                            </span>
                            {alert.acknowledged && (
                              <>
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="w-3 h-3" />
                                  확인됨
                                </span>
                                {alert.acknowledgedBy && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {alert.acknowledgedBy}
                                  </span>
                                )}
                                {alert.acknowledgedAt && (
                                  <span>
                                    {alert.acknowledgedAt.toLocaleString('ko-KR')}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          alert.acknowledged
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {alert.acknowledged ? '확인됨' : '미확인'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;