import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/patient.dart';
import '../data/models/infusion_session.dart';
import '../data/models/alert.dart';
import '../data/services/api_service.dart';
import '../data/services/websocket_service.dart';

/// 수액 모니터링 상태
class InfusionState {
  final Patient? patient;
  final InfusionSession? currentSession;
  final List<Alert> alerts;
  final bool isLoading;
  final bool isConnected;
  final String? error;

  InfusionState({
    this.patient,
    this.currentSession,
    this.alerts = const [],
    this.isLoading = false,
    this.isConnected = false,
    this.error,
  });

  InfusionState copyWith({
    Patient? patient,
    InfusionSession? currentSession,
    List<Alert>? alerts,
    bool? isLoading,
    bool? isConnected,
    String? error,
  }) {
    return InfusionState(
      patient: patient ?? this.patient,
      currentSession: currentSession ?? this.currentSession,
      alerts: alerts ?? this.alerts,
      isLoading: isLoading ?? this.isLoading,
      isConnected: isConnected ?? this.isConnected,
      error: error,
    );
  }
}

/// 수액 모니터링 Provider (Notifier)
class InfusionNotifier extends StateNotifier<InfusionState> {
  final ApiService _apiService;
  WebSocketService? _wsService;
  Timer? _pollingTimer;
  StreamSubscription? _wsSubscription;
  StreamSubscription? _wsStatusSubscription;

  InfusionNotifier(this._apiService) : super(InfusionState());

  /// 로그인
  Future<bool> login(String phone, String pin) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final patient = await _apiService.patientLogin(
        phone: phone,
        pin: pin,
      );

      if (patient != null) {
        state = state.copyWith(
          patient: patient,
          isLoading: false,
        );
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          error: '로그인 실패',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// 로그아웃
  void logout() {
    stopMonitoring();
    state = InfusionState();
  }

  /// 실시간 모니터링 시작
  void startMonitoring() {
    final patient = state.patient;
    if (patient == null) return;

    // REST API 폴링 시작 (메인 데이터 소스)
    _startPolling();

    // WebSocket은 현재 비활성화 (REST API polling만 사용)
    // 추후 MQTT 브로커 연동 시 활성화 예정
  }

  /// 실시간 모니터링 중지
  void stopMonitoring() {
    _wsSubscription?.cancel();
    _wsStatusSubscription?.cancel();
    _wsService?.dispose();
    _pollingTimer?.cancel();
    _wsSubscription = null;
    _wsStatusSubscription = null;
    _wsService = null;
    _pollingTimer = null;
  }

  /// REST API 폴링 시작
  void _startPolling() {
    // 기존 타이머 취소
    _pollingTimer?.cancel();

    _pollingTimer = Timer.periodic(
      const Duration(minutes: 1), // 1분마다 폴링하여 데이터 갱신
      (_) async {
        // mounted 체크 후에만 데이터 새로고침
        if (mounted) {
          await refreshData();
        } else {
          // disposed되었으면 타이머 취소
          _pollingTimer?.cancel();
        }
      },
    );

    // 초기 데이터 로드
    refreshData();
  }

  /// 데이터 새로고침
  Future<void> refreshData() async {
    print('🔄 [APP] Polling data at ${DateTime.now().toIso8601String()}');
    
    // disposed 체크를 먼저 수행
    if (!mounted) {
      print('⚠️ [APP] Skipping - provider disposed');
      return;
    }

    final patient = state.patient;
    if (patient == null) {
      print('⚠️ [APP] Skipping - no patient logged in');
      return;
    }

    try {
      // 1. 수액 세션 조회 (활성 세션 또는 처방 정보)
      InfusionSession? session = await _apiService.getCurrentInfusion(patient.id);

      // disposed 체크
      if (!mounted) return;

      // 2. 세션 없으면 처방 정보만 조회
      if (session == null) {
        session = await _apiService.getCurrentPrescription(patient.id);
      }

      // disposed 체크
      if (!mounted) return;

      // 3. 알림 조회
      final alerts = await _apiService.getAlerts(patient.id);

      // 4. 연결 상태 업데이트 (세션이 있으면 연결됨)
      final isConnected = session != null;

      // 5. 마지막 mounted 체크 후 상태 업데이트
      if (mounted) {
        state = state.copyWith(
          currentSession: session,
          alerts: alerts,
          isConnected: isConnected,
          error: null,
        );
        print('✅ [APP] Data refreshed - Session: ${session != null}, Alerts: ${alerts.length}');
      }
    } catch (e) {
      print('❌ [APP] Refresh error: $e');
      // disposed 체크
      if (mounted) {
        state = state.copyWith(
          error: e.toString(),
          isConnected: false,
        );
      }
    }
  }


  /// 간호사 호출
  Future<void> callNurse() async {
    final patient = state.patient;
    final session = state.currentSession;

    if (patient == null) {
      throw Exception('환자 정보가 없습니다');
    }

    // 세션이 없어도 간호사 호출 가능 (sessionId는 선택적)
    final success = await _apiService.callNurse(
      patientId: patient.id,
      sessionId: session?.id, // session이 null이면 null 전달
    );

    if (!success) {
      throw Exception('간호사 호출에 실패했습니다');
    }

    // 알림 목록 갱신
    await refreshData();
  }

  @override
  void dispose() {
    stopMonitoring();
    super.dispose();
  }
}

/// 수액 모니터링 Provider
final infusionProvider = StateNotifierProvider<InfusionNotifier, InfusionState>(
  (ref) {
    final apiService = ApiService();
    return InfusionNotifier(apiService);
  },
);
