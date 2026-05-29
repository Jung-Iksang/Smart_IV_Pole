import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/patient.dart';
import '../models/infusion_session.dart';
import '../models/alert.dart';
import '../../core/constants/api_constants.dart';

/// REST API 서비스
class ApiService {
  final http.Client _client = http.Client();

  /// Bool 파싱 헬퍼 (문자열 "true"/"false"나 1/0을 bool로 변환)
  bool _parseBool(dynamic value) {
    if (value == null) return false;
    if (value is bool) return value;
    if (value is String) {
      return value.toLowerCase() == 'true';
    }
    if (value is int) {
      return value == 1;
    }
    return false;
  }

  /// 환자 로그인 (전화번호 + PIN 코드 인증)
  Future<Patient?> patientLogin({
    required String phone,
    required String pin,
  }) async {
    try {
      final response = await _client
          .post(
            Uri.parse(ApiConstants.loginEndpoint),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'phone': phone,
              'pinCode': pin,
            }),
          )
          .timeout(ApiConstants.connectionTimeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        // ApiResponse<T> 형식 처리
        if (_parseBool(data['success']) && data['data'] != null) {
          return Patient.fromJson(data['data']);
        }
      }

      return null;
    } catch (e) {
      print('Login error: $e');
      return null;
    }
  }

  /// 현재 수액 세션 조회 (처방 + 하드웨어 데이터)
  Future<InfusionSession?> getCurrentInfusion(String patientId) async {
    try {
      final response = await _client
          .get(
            Uri.parse(ApiConstants.currentInfusionEndpoint(patientId)),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(ApiConstants.connectionTimeout);

      print('🔍 [API] getCurrentInfusion - Status: ${response.statusCode}');
      print('🔍 [API] Response body: ${response.body}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        print('🔍 [API] Parsed JSON: $data');
        print('🔍 [API] success type: ${data['success'].runtimeType}, value: ${data['success']}');
        print('🔍 [API] data field: ${data['data']}');

        if (_parseBool(data['success']) && data['data'] != null) {
          print('🔍 [API] Attempting to parse InfusionSession from: ${data['data']}');
          final session = InfusionSession.fromJson(data['data']);
          print('✅ [API] Successfully parsed session: ${session?.id}');
          return session;
        } else {
          print('⚠️ [API] API returned success=false or data=null');
        }
      } else {
        print('❌ [API] Non-200 status code: ${response.statusCode}');
      }

      return null;
    } catch (e, stackTrace) {
      print('❌ [API] Get current infusion error: $e');
      print('Stack trace: $stackTrace');
      return null;
    }
  }

  /// 현재 처방 정보 조회 (수액 세션 없을 때)
  Future<InfusionSession?> getCurrentPrescription(String patientId) async {
    try {
      final response = await _client
          .get(
            Uri.parse(ApiConstants.prescriptionEndpoint(patientId)),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(ApiConstants.connectionTimeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        // 디버깅: success 필드 타입 확인
        print('getCurrentPrescription - success type: ${data['success'].runtimeType}, value: ${data['success']}');

        if (_parseBool(data['success']) && data['data'] != null) {
          return InfusionSession.fromJson(data['data']);
        }
      }

      return null;
    } catch (e, stackTrace) {
      print('Get current prescription error: $e');
      print('Stack trace: $stackTrace');
      return null;
    }
  }

  /// 알림 목록 조회
  Future<List<Alert>> getAlerts(String patientId) async {
    try {
      final response = await _client
          .get(
            Uri.parse(ApiConstants.alertsEndpoint(patientId)),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(ApiConstants.connectionTimeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        if (_parseBool(data['success']) && data['data'] != null) {
          final List<dynamic> alertsJson = data['data'];
          return alertsJson.map((json) => Alert.fromJson(json)).toList();
        }
      }

      return [];
    } catch (e) {
      print('Get alerts error: $e');
      return [];
    }
  }

  /// 간호사 호출 (비상 버튼)
  Future<bool> callNurse({
    required String patientId,
    String? sessionId, // sessionId는 선택적 (세션 없이도 호출 가능)
  }) async {
    try {
      // sessionId가 있을 때만 body에 포함
      final Map<String, dynamic> requestBody = {
        'patientId': patientId,
      };

      if (sessionId != null && sessionId.isNotEmpty) {
        requestBody['sessionId'] = sessionId;
      }

      print('Calling nurse - patientId: $patientId, sessionId: $sessionId');
      print('Request body: ${json.encode(requestBody)}');

      final response = await _client
          .post(
            Uri.parse(ApiConstants.callNurseEndpoint),
            headers: {'Content-Type': 'application/json'},
            body: json.encode(requestBody),
          )
          .timeout(ApiConstants.connectionTimeout);

      print('Response status: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return _parseBool(data['success']);
      }

      return false;
    } catch (e, stackTrace) {
      print('Call nurse error: $e');
      print('Stack trace: $stackTrace');
      return false;
    }
  }

  /// 연결 테스트
  Future<bool> testConnection() async {
    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConstants.baseUrl}/api/v1/health'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 5));

      return response.statusCode == 200;
    } catch (e) {
      print('Connection test error: $e');
      return false;
    }
  }

  /// 리소스 정리
  void dispose() {
    _client.close();
  }
}
