import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/models/infusion_session.dart';

/// 수액 상태 카드 위젯
class InfusionStatusCard extends StatelessWidget {
  final InfusionSession? session;

  const InfusionStatusCard({
    super.key,
    this.session,
  });

  @override
  Widget build(BuildContext context) {
    if (session == null) {
      return _buildEmptyCard();
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // 헤더: 약품 이름 및 상태
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: _getStatusColor(session!.status).withValues(alpha: 0.1),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _getStatusColor(session!.status),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.water_drop,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session!.medicationName,
                        style: AppTextStyles.title.copyWith(
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: _getStatusColor(session!.status),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              session!.statusText,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (!session!.isOnline)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.statusOffline,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                '오프라인',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // 수액 잔량 표시
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                // 잔량 퍼센티지
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '현재 잔량',
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      '${session!.remainingPercentage.toStringAsFixed(1)}%',
                      style: AppTextStyles.title.copyWith(
                        fontSize: 32,
                        color: _getStatusColor(session!.status),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 프로그레스 바
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: session!.remainingPercentage / 100,
                    backgroundColor: AppColors.statusOffline.withValues(alpha: 0.2),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      _getStatusColor(session!.status),
                    ),
                    minHeight: 12,
                  ),
                ),
                const SizedBox(height: 24),

                // 상세 정보
                Row(
                  children: [
                    Expanded(
                      child: _buildInfoItem(
                        icon: Icons.schedule,
                        label: '남은 시간',
                        value: session!.formattedRemainingTime,
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: AppColors.statusOffline.withValues(alpha: 0.3),
                    ),
                    Expanded(
                      child: _buildInfoItem(
                        icon: Icons.speed,
                        label: '투여 속도',
                        value: '${session!.flowRate.toStringAsFixed(0)} GTT/min',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _buildInfoItem(
                        icon: Icons.science,
                        label: '총 용량',
                        value: '${session!.totalVolume.toStringAsFixed(0)} mL',
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: AppColors.statusOffline.withValues(alpha: 0.3),
                    ),
                    Expanded(
                      child: _buildInfoItem(
                        icon: Icons.water_drop,
                        label: '남은 수액',
                        value: '${session!.remainingPercentage.toStringAsFixed(0)}%',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyCard() {
    return Container(
      padding: const EdgeInsets.all(48),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(
            Icons.water_drop_outlined,
            size: 64,
            color: AppColors.statusOffline,
          ),
          const SizedBox(height: 16),
          Text(
            '진행 중인 수액 투여가 없습니다',
            style: AppTextStyles.subtitle.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Column(
      children: [
        Icon(
          icon,
          size: 20,
          color: AppColors.textSecondary,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: AppTextStyles.body.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
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
