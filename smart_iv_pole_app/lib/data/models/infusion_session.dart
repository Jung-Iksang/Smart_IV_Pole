/// 수액 투여 세션 모델
class InfusionSession {
  final String id;
  final String patientId;
  final String poleId;
  final String medicationName;
  final double totalVolume; // 총 용량 (mL)
  final double currentWeight; // 현재 무게 (g) - 하드웨어 센서값
  final double remainingVolume; // 남은 용량 (mL) - 계산된 값
  final double remainingPercentage; // 잔량 (%)
  final int remainingTimeMinutes; // 남은 시간 (분)
  final InfusionStatus status; // 상태
  final double flowRate; // 투여 속도 (mL/분)
  final DateTime startTime; // 시작 시간
  final DateTime? expectedEndTime; // 종료 예정 시간
  final DateTime lastUpdate; // 마지막 업데이트
  final String dataSource; // 데이터 소스 ("HARDWARE" or "INITIAL_SETTING")
  final bool isHardwareConnected; // 하드웨어 연결 상태

  InfusionSession({
    required this.id,
    required this.patientId,
    required this.poleId,
    required this.medicationName,
    required this.totalVolume,
    required this.currentWeight,
    required this.remainingVolume,
    required this.remainingPercentage,
    required this.remainingTimeMinutes,
    required this.status,
    required this.flowRate,
    required this.startTime,
    this.expectedEndTime,
    required this.lastUpdate,
    this.dataSource = 'INITIAL_SETTING',
    this.isHardwareConnected = false,
  });

  factory InfusionSession.fromJson(Map<String, dynamic> json) {
    try {
      print('🔍 [MODEL] InfusionSession.fromJson - Input JSON: $json');

      // Extract and log each field individually
      final sessionId = json['sessionId']?.toString() ?? json['id']?.toString() ?? '';
      final patientId = json['patientId']?.toString() ?? '';
      final poleId = json['poleId']?.toString() ?? '';
      final medicationName = json['medicationName'] ?? json['dripName'] ?? 'Unknown';
      final totalVolume = (json['totalVolumeMl'] ?? json['totalVolume'] ?? 0).toDouble();
      final currentWeight = (json['currentWeightGrams'] ?? json['currentWeight'] ?? 0).toDouble();
      final remainingVolume = (json['remainingVolumeMl'] ?? json['remainingVolume'] ?? 0).toDouble();

      // 🔄 RECALCULATE PERCENTAGE: 프론트엔드와 동일한 로직 적용
      // 백엔드 percentage는 수액팩 무게 때문에 100% 초과 가능 → 무시
      // 처방 totalVolume 기준으로 재계산: (remainingVolume / totalVolume) * 100
      final backendPercentage = (json['remainingPercentage'] ?? 0).toDouble();
      final remainingPercentage = totalVolume > 0
          ? (remainingVolume / totalVolume) * 100
          : 0.0;

      print('📊 [PERCENTAGE] Recalculated: $remainingVolume/$totalVolume mL = ${remainingPercentage.toStringAsFixed(1)}% (Backend: ${backendPercentage.toStringAsFixed(1)}%)');

      final remainingTimeMinutes = json['remainingTimeMinutes'] ?? json['calculatedRemainingTime'] ?? 0;
      final status = _parseStatus(json['status']);
      final flowRate = (json['currentFlowRate'] ?? json['flowRate'] ?? json['gtt'] ?? 0).toDouble();

      print('🔍 [MODEL] Parsed fields:');
      print('  - sessionId: $sessionId');
      print('  - patientId: $patientId');
      print('  - poleId: $poleId');
      print('  - medicationName: $medicationName');
      print('  - totalVolume: $totalVolume');
      print('  - currentWeight: $currentWeight');
      print('  - remainingVolume: $remainingVolume');
      print('  - remainingPercentage: $remainingPercentage');
      print('  - remainingTimeMinutes: $remainingTimeMinutes');
      print('  - status: $status');
      print('  - flowRate: $flowRate');

      final session = InfusionSession(
        id: sessionId,
        patientId: patientId,
        poleId: poleId,
        medicationName: medicationName,
        totalVolume: totalVolume,
        currentWeight: currentWeight,
        remainingVolume: remainingVolume,
        remainingPercentage: remainingPercentage,
        remainingTimeMinutes: remainingTimeMinutes,
        status: status,
        flowRate: flowRate,
        startTime: json['startTime'] != null
            ? DateTime.parse(json['startTime'])
            : DateTime.now(),
        expectedEndTime: json['expectedEndTime'] != null
            ? DateTime.parse(json['expectedEndTime'])
            : null,
        lastUpdate: (json['lastUpdate'] ?? json['lastSensorUpdate']) != null
            ? DateTime.parse(json['lastUpdate'] ?? json['lastSensorUpdate'])
            : DateTime.now(),
        dataSource: json['dataSource']?.toString() ?? 'INITIAL_SETTING',
        isHardwareConnected: _parseBool(json['isHardwareConnected']),
      );

      print('✅ [MODEL] Successfully created InfusionSession: ${session.id}');
      return session;
    } catch (e, stackTrace) {
      print('❌ [MODEL] InfusionSession.fromJson error: $e');
      print('❌ [MODEL] JSON data: $json');
      print('❌ [MODEL] Stack trace: $stackTrace');
      rethrow;
    }
  }

  /// Bool 파싱 헬퍼 (문자열 "true"/"false"를 bool로 변환)
  static bool _parseBool(dynamic value) {
    try {
      if (value == null) return false;
      if (value is bool) return value;
      if (value is String) {
        final lower = value.toLowerCase();
        return lower == 'true' || lower == '1';
      }
      if (value is int) {
        return value == 1;
      }
      return false;
    } catch (e) {
      print('_parseBool error for value: $value (${value.runtimeType})');
      return false;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patientId': patientId,
      'poleId': poleId,
      'medicationName': medicationName,
      'totalVolume': totalVolume,
      'currentWeight': currentWeight,
      'remainingPercentage': remainingPercentage,
      'calculatedRemainingTime': remainingTimeMinutes,
      'status': status.name,
      'flowRate': flowRate,
      'startTime': startTime.toIso8601String(),
      'expectedEndTime': expectedEndTime?.toIso8601String(),
      'lastSensorUpdate': lastUpdate.toIso8601String(),
      'dataSource': dataSource,
      'isHardwareConnected': isHardwareConnected,
    };
  }

  static InfusionStatus _parseStatus(dynamic status) {
    if (status == null) return InfusionStatus.offline;

    final statusStr = status.toString().toLowerCase();
    switch (statusStr) {
      case 'normal':
        return InfusionStatus.normal;
      case 'warning':
        return InfusionStatus.warning;
      case 'critical':
        return InfusionStatus.critical;
      case 'offline':
        return InfusionStatus.offline;
      default:
        return InfusionStatus.offline;
    }
  }

  /// 시간 포맷팅 (예: "2시간 34분")
  String get formattedRemainingTime {
    final hours = remainingTimeMinutes ~/ 60;
    final minutes = remainingTimeMinutes % 60;

    if (hours > 0) {
      return '$hours시간 $minutes분';
    } else {
      return '$minutes분';
    }
  }

  /// mL/분 형식의 투여 속도 (항상 일관된 형식으로 반환)
  String get formattedFlowRate => '${flowRate.toStringAsFixed(2)} mL/분';

  /// 상태 텍스트
  String get statusText {
    switch (status) {
      case InfusionStatus.normal:
        return '정상 투여 중';
      case InfusionStatus.warning:
        return '주의 필요';
      case InfusionStatus.critical:
        return '긴급';
      case InfusionStatus.offline:
        return '오프라인';
    }
  }

  /// 데이터 업데이트 여부 확인 (30초 이내 업데이트면 온라인)
  bool get isOnline {
    final now = DateTime.now();
    final diff = now.difference(lastUpdate);
    return diff.inSeconds < 30;
  }
}

/// 수액 투여 상태
enum InfusionStatus {
  normal, // 정상 (30% 이상)
  warning, // 주의 (10-30%)
  critical, // 긴급 (<10%)
  offline, // 오프라인
}
