import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// 앱 브랜딩 상수 및 로고 위젯 관리
///
/// 이 파일에서 앱의 모든 브랜딩 요소를 중앙 관리합니다.
/// 로고 이미지나 앱 이름 변경 시 이 파일만 수정하면 전체 앱에 반영됩니다.
class AppBranding {
  AppBranding._(); // 인스턴스화 방지

  /// 앱 이름
  static const String appName = 'MEDIPOLE';

  /// 앱 전체 이름 (필요시)
  static const String appFullName = 'Smart IV Pole - MEDIPOLE';

  /// ===== 로고 이미지 경로 =====
  /// 로고 파일을 assets/logo/ 디렉토리에 넣고 아래 경로를 수정하세요
  static const String logoMain = 'assets/logo/logo.png';
  static const String logoIcon = 'assets/logo/logo_icon.png';
  static const String logoText = 'assets/logo/logo_text.png';
  static const String logoWhite = 'assets/logo/logo_white.png';
  static const String logoDark = 'assets/logo/logo_dark.png';

  /// 로고 이미지 위젯 (에러 핸들링 포함)
  /// 이미지 로드 실패 시 fallback 위젯 표시
  static Widget logoImage({
    String? imagePath,
    double? height,
    double? width,
    BoxFit fit = BoxFit.contain,
    Widget? fallback,
  }) {
    final path = imagePath ?? logoMain;

    return Image.asset(
      path,
      height: height,
      width: width,
      fit: fit,
      errorBuilder: (context, error, stackTrace) {
        // 이미지 로드 실패 시 fallback 또는 기본 텍스트
        return fallback ??
            Text(
              appName,
              style: TextStyle(
                fontSize: height != null ? height * 0.5 : 20,
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            );
      },
    );
  }

  /// 작은 로고 위젯 (높이: 32)
  /// 주로 앱바나 작은 공간에 사용
  static Widget logoSmall({
    String? imagePath,
    Widget? fallback,
  }) {
    return logoImage(
      imagePath: imagePath ?? logoIcon,
      height: 32,
      fallback: fallback ??
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Center(
              child: Text(
                'IV',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
    );
  }

  /// 중간 로고 위젯 (높이: 48)
  /// 주로 대시보드나 메인 화면에 사용
  static Widget logoMedium({
    String? imagePath,
    Widget? fallback,
  }) {
    return logoImage(
      imagePath: imagePath ?? logoIcon,
      height: 48,
      fallback: fallback ??
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Text(
                'IV',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
    );
  }

  /// 큰 로고 위젯 (높이: 64)
  /// 주로 스플래시 화면이나 로그인 화면에 사용
  static Widget logoLarge({
    String? imagePath,
    Widget? fallback,
  }) {
    return logoImage(
      imagePath: imagePath ?? logoMain,
      height: 64,
      fallback: fallback ??
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Center(
              child: Text(
                'IV',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
    );
  }

  /// 로고 이미지 + 앱 이름 조합 위젯
  /// 주로 앱바에 사용
  static Widget logoWithName({
    double iconSize = 28,
    double fontSize = 18,
    String? imagePath,
    Color? textColor,
    String? subtitle,
    Widget? iconFallback,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        logoImage(
          imagePath: imagePath ?? logoIcon,
          height: iconSize,
          fallback: iconFallback ??
              Container(
                width: iconSize,
                height: iconSize,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB),
                  borderRadius: BorderRadius.circular(iconSize * 0.25),
                ),
                child: Center(
                  child: Text(
                    'IV',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: iconSize * 0.4375,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
        ),
        SizedBox(width: iconSize * 0.25),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              appName,
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.bold,
                color: textColor ?? Colors.white,
              ),
            ),
            if (subtitle != null)
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: fontSize * 0.67,
                  fontWeight: FontWeight.normal,
                  color: textColor ?? Colors.white,
                ),
              ),
          ],
        ),
      ],
    );
  }

  /// 아이콘만 표시 (축소된 사이드바용)
  static Widget logoIconOnly({
    double size = 32,
    String? imagePath,
    Widget? fallback,
  }) {
    return logoImage(
      imagePath: imagePath ?? logoIcon,
      height: size,
      width: size,
      fallback: fallback,
    );
  }

  /// 텍스트만 표시 (헤더용)
  static Widget logoTextOnly({
    double height = 24,
    String? imagePath,
    Widget? fallback,
  }) {
    return logoImage(
      imagePath: imagePath ?? logoText,
      height: height,
      fallback: fallback ??
          Text(
            appName,
            style: TextStyle(
              fontSize: height,
              fontWeight: FontWeight.bold,
            ),
          ),
    );
  }
}
