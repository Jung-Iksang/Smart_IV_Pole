import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/infusion_session.dart';
import '../../data/models/patient.dart';

/// 친근한 터콰이즈 그라디언트 헤더
class FriendlyHeader extends StatelessWidget {
  final Patient? patient;
  final InfusionSession? session;
  final VoidCallback? onLogout;

  const FriendlyHeader({
    super.key,
    this.patient,
    this.session,
    this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final remaining = session?.remainingVolume.toInt() ?? 0; // 남은 수액량(mL) 표시
    final screenHeight = MediaQuery.of(context).size.height;
    final maxHeaderHeight = screenHeight * 0.33; // 화면의 1/3로 제한

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeaderHeight),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.gradientStart,
            AppColors.gradientEnd,
          ],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: SingleChildScrollView( // 스크롤 가능하게 변경 (overflow 방지)
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 첫 줄: 환자 정보 (왼쪽) + 로그아웃 버튼 (오른쪽)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // 환자 정보 (이름 | 병실-침대)
                    if (patient != null)
                      Text(
                        '${patient!.name} | ${patient!.roomInfo}',
                        style: GoogleFonts.notoSans(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      )
                    else
                      const SizedBox.shrink(),

                    // 로그아웃 버튼
                    if (onLogout != null)
                      IconButton(
                        onPressed: onLogout,
                        icon: const Icon(Icons.logout),
                        color: Colors.white,
                        iconSize: 22,
                        tooltip: '로그아웃',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      )
                    else
                      const SizedBox.shrink(),
                  ],
                ),
                const SizedBox(height: 8),

                // 캐릭터 일러스트 (중앙) - 더 작게
                Center(
                  child: Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.medical_services_rounded,
                      size: 32,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // 남은 수액량 대형 숫자 - 더 작게
                Center(
                  child: Column(
                    children: [
                      Text(
                        '$remaining',
                        style: GoogleFonts.poppins(
                          fontSize: 42,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          height: 1.0,
                        ),
                      ),
                      Text(
                        'mL',
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),

                // 라벨
                Center(
                  child: Text(
                    '남은 수액량',
                    style: GoogleFonts.notoSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withOpacity(0.9),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // 긍정 메시지
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.25),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _getStatusIcon(session),
                          color: Colors.white,
                          size: 14,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          _getPositiveMessage(session),
                          style: GoogleFonts.notoSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getStatusIcon(InfusionSession? session) {
    if (session == null) return Icons.info_outline;

    switch (session.status) {
      case InfusionStatus.normal:
        return Icons.check_circle_outline;
      case InfusionStatus.warning:
        return Icons.access_time;
      case InfusionStatus.critical:
        return Icons.warning_amber_rounded;
      case InfusionStatus.offline:
        return Icons.cloud_off_outlined;
    }
  }

  String _getPositiveMessage(InfusionSession? session) {
    if (session == null) {
      return '처방 대기 중';
    }

    switch (session.status) {
      case InfusionStatus.normal:
        return '순조롭게 투여 중 ✓';
      case InfusionStatus.warning:
        return '곧 교체 시간입니다';
      case InfusionStatus.critical:
        return '간호사가 곧 방문합니다';
      case InfusionStatus.offline:
        return '연결 확인 중...';
    }
  }
}
