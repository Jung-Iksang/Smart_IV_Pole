import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/infusion_session.dart';

/// 약품 정보 카드
class MedicationInfoCard extends StatelessWidget {
  final InfusionSession? session;

  const MedicationInfoCard({
    super.key,
    this.session,
  });

  @override
  Widget build(BuildContext context) {
    if (session == null) {
      return const SizedBox.shrink();
    }

    final startTime = DateFormat('a hh:mm', 'ko_KR').format(session!.startTime);
    final estimatedEndTime = session!.expectedEndTime ??
        session!.startTime.add(Duration(minutes: session!.remainingTimeMinutes));
    final endTime = DateFormat('a hh:mm', 'ko_KR').format(estimatedEndTime);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 제목
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.friendlyTeal.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.medication,
                  color: AppColors.friendlyTeal,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '처방 약품',
                style: GoogleFonts.notoSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 약품명
          Text(
            session!.medicationName,
            style: GoogleFonts.notoSans(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),

          // 시간 정보
          Row(
            children: [
              Expanded(
                child: _buildTimeInfo(
                  icon: Icons.play_circle_outline,
                  label: '시작',
                  time: startTime,
                ),
              ),
              Container(
                width: 1,
                height: 40,
                color: AppColors.statusOffline.withValues(alpha: 0.2),
                margin: const EdgeInsets.symmetric(horizontal: 12),
              ),
              Expanded(
                child: _buildTimeInfo(
                  icon: Icons.check_circle_outline,
                  label: '완료 예정',
                  time: endTime,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTimeInfo({
    required IconData icon,
    required String label,
    required String time,
  }) {
    return Row(
      children: [
        Icon(
          icon,
          size: 18,
          color: AppColors.textSecondary,
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: GoogleFonts.notoSans(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
            Text(
              time,
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
