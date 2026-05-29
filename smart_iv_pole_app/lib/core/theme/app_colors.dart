import 'package:flutter/material.dart';

/// 의료용 진한 컬러 시스템 (병원 스타일)
class AppColors {
  // Primary Colors - 진한 블루
  static const Color primaryBlue = Color(0xFF1E88E5); // 진한 블루
  static const Color secondaryPurple = Color(0xFF7B1FA2); // 진한 퍼플

  // Friendly Colors - 친근한 터콰이즈 테마
  static const Color gradientStart = Color(0xFF4DD0E1); // 밝은 터콰이즈
  static const Color gradientEnd = Color(0xFF26C6DA); // 진한 터콰이즈
  static const Color friendlyTeal = Color(0xFF4DD0E1); // 친근한 청록색
  static const Color softGreen = Color(0xFF66BB6A); // 부드러운 그린
  static const Color warmOrange = Color(0xFFFFA726); // 따뜻한 오렌지

  // Background Colors
  static const Color background = Color(0xFFF5F5F5); // 연한 그레이
  static const Color surface = Color(0xFFFFFFFF); // 화이트

  // Status Colors (수액 상태) - 진한 색상
  static const Color statusNormal = Color(0xFF4CAF50); // 진한 그린 (30% 이상)
  static const Color statusWarning = Color(0xFFFFA726); // 진한 오렌지 (10-30%)
  static const Color statusCritical = Color(0xFFE53935); // 진한 레드 (<10%)
  static const Color statusOffline = Color(0xFF9E9E9E); // 그레이

  // Text Colors
  static const Color textPrimary = Color(0xFF212121); // 진한 블랙
  static const Color textSecondary = Color(0xFF757575); // 미디엄 그레이
  static const Color textLight = Color(0xFF9E9E9E); // 라이트 그레이

  // Semantic Colors - 의료용 진한 색상
  static const Color emergencyRed = Color(0xFFD32F2F); // 의료용 응급 빨간색
  static const Color emergencyButton = Color(0xFFD32F2F); // 간호사 호출 버튼
  static const Color success = Color(0xFF43A047); // 진한 성공 그린
  static const Color error = Color(0xFFE53935); // 진한 에러 레드
  static const Color warning = Color(0xFFFB8C00); // 진한 경고 오렌지
  static const Color info = Color(0xFF1976D2); // 진한 정보 블루

  // Accent Colors - 진한 색상
  static const Color accent1 = Color(0xFFEF5350); // 진한 핑크/레드
  static const Color accent2 = Color(0xFF42A5F5); // 진한 스카이 블루
  static const Color accent3 = Color(0xFFAB47BC); // 진한 라벤더

  // Shadow & Overlay
  static const Color shadow = Color(0x1A000000); // 10% 블랙
  static const Color overlay = Color(0x66000000); // 40% 블랙

  // Alias for compatibility
  static const Color primary = primaryBlue;

  /// 상태에 따른 색상 반환
  static Color getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'normal':
        return statusNormal;
      case 'warning':
        return statusWarning;
      case 'critical':
        return statusCritical;
      case 'offline':
        return statusOffline;
      default:
        return statusOffline;
    }
  }

  /// 상태에 따른 배경색 반환 (연한 톤)
  static Color getStatusBackgroundColor(String status) {
    switch (status.toLowerCase()) {
      case 'normal':
        return statusNormal.withValues(alpha: 0.2);
      case 'warning':
        return statusWarning.withValues(alpha: 0.2);
      case 'critical':
        return statusCritical.withValues(alpha: 0.2);
      case 'offline':
        return statusOffline.withValues(alpha: 0.2);
      default:
        return statusOffline.withValues(alpha: 0.2);
    }
  }
}
