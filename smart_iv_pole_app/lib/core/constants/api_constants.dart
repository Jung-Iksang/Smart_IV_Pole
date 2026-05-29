/// API 상수 정의
class ApiConstants {
  // Base URLs
  // iPhone 시뮬레이터는 localhost 사용 가능
  // 실제 기기 테스트 시에는 컴퓨터의 IP 주소로 변경 필요
  static const String baseUrl = 'http://10.43.194.173:8081';
  static const String wsUrl = 'ws://10.43.194.173:8081';

  // API Paths
  static const String apiVersion = '/api/v1';
  static const String mobilePath = '/mobile';

  // Full paths
  static const String mobileApiBase = '$baseUrl$apiVersion$mobilePath';
  static const String wsBase = '$wsUrl/ws';

  // Endpoints
  static const String loginEndpoint = '$mobileApiBase/auth/patient-login';
  static String currentInfusionEndpoint(String patientId) =>
      '$mobileApiBase/patients/$patientId/current-infusion';
  static String prescriptionEndpoint(String patientId) =>
      '$mobileApiBase/patients/$patientId/prescription';
  static String alertsEndpoint(String patientId) =>
      '$mobileApiBase/patients/$patientId/alerts';
  static const String callNurseEndpoint = '$mobileApiBase/alerts/call-nurse';

  // WebSocket endpoints
  static String patientWebSocket(String patientId) =>
      '$wsBase/patient/$patientId';

  // Timeouts
  static const Duration connectionTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 10);

  // Intervals
  static const Duration apiPollingInterval = Duration(seconds: 5);
  static const Duration wsReconnectDelay = Duration(seconds: 3);
}
