import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/infusion_session.dart';

/// 간소화된 수액 상태 카드 (그래프 제거)
class SimplifiedStatusCard extends StatelessWidget {
  final InfusionSession? session;

  const SimplifiedStatusCard({
    super.key,
    this.session,
  });

  @override
  Widget build(BuildContext context) {
    if (session == null) {
      return _buildEmptyCard();
    }

    final percentage = session!.remainingPercentage / 100;
    final statusColor = _getStatusColor(session!.status);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(24),
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
              Icon(
                Icons.water_drop,
                color: statusColor,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                '현재 투여 정보',
                style: GoogleFonts.notoSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // 프로그레스 바
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${session!.remainingPercentage.toStringAsFixed(0)}%',
                style: GoogleFonts.poppins(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: statusColor,
                ),
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: LinearProgressIndicator(
                  value: percentage,
                  backgroundColor: AppColors.statusOffline.withValues(alpha: 0.15),
                  valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                  minHeight: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),

          // 2x2 그리드 정보
          Row(
            children: [
              Expanded(
                child: _buildInfoTile(
                  icon: Icons.schedule,
                  label: '남은 시간',
                  value: session!.formattedRemainingTime,
                  color: statusColor,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoTile(
                  icon: Icons.speed,
                  label: '투여 속도',
                  value: session!.formattedFlowRate, // getter 사용으로 일관성 보장
                  color: statusColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildInfoTile(
                  icon: Icons.science,
                  label: '총 용량',
                  value: '${session!.totalVolume.toStringAsFixed(0)} mL',
                  color: statusColor,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildInfoTile(
                  icon: Icons.water_drop,
                  label: '남은 수액',
                  value: '${session!.remainingPercentage.toStringAsFixed(0)}%',
                  color: statusColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(48),
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
        children: [
          Icon(
            Icons.water_drop_outlined,
            size: 64,
            color: AppColors.statusOffline.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            '진행 중인 수액 투여가 없습니다',
            style: GoogleFonts.notoSans(
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 20,
            color: color,
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: GoogleFonts.notoSans(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(InfusionStatus status) {
    switch (status) {
      case InfusionStatus.normal:
        return AppColors.statusNormal;
      case InfusionStatus.warning:
        return AppColors.statusWarning;
      case InfusionStatus.critical:
        return AppColors.statusCritical;
      case InfusionStatus.offline:
        return AppColors.statusOffline;
    }
  }
}
