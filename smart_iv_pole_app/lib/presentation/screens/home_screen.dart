import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../providers/infusion_provider.dart';
import '../widgets/friendly_header.dart';
import '../widgets/simplified_status_card.dart';
import '../widgets/medication_info_card.dart';
import '../widgets/call_nurse_button.dart';
import 'login_screen.dart';

/// 홈 화면 - 수액 모니터링 및 알림
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> 
    with WidgetsBindingObserver { // 생명주기 감지 추가
  
  @override
  void initState() {
    super.initState();
    
    // 앱 생명주기 Observer 등록
    WidgetsBinding.instance.addObserver(this);
    
    // 데이터 로드 및 실시간 연결 시작
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(infusionProvider.notifier).startMonitoring();
    });
  }

  @override
  void dispose() {
    // Observer 해제
    WidgetsBinding.instance.removeObserver(this);
    
    // 실시간 연결 종료
    ref.read(infusionProvider.notifier).stopMonitoring();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    switch (state) {
      case AppLifecycleState.resumed:
        // 앱이 포그라운드로 돌아옴 - 폴링 재시작
        print('📱 [APP] Resumed - restarting polling');
        ref.read(infusionProvider.notifier).startMonitoring();
        break;
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        // 앱이 백그라운드로 감 - 폴링 중지
        print('📱 [APP] Paused - stopping polling');
        ref.read(infusionProvider.notifier).stopMonitoring();
        break;
      case AppLifecycleState.hidden:
        break;
    }
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('로그아웃'),
        content: const Text('로그아웃 하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('로그아웃'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      ref.read(infusionProvider.notifier).logout();
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  Future<void> _handleRefresh() async {
    await ref.read(infusionProvider.notifier).refreshData();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(infusionProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        onRefresh: _handleRefresh,
        child: state.isLoading && state.currentSession == null
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.error_outline,
                          size: 64,
                          color: AppColors.error,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '오류가 발생했습니다',
                          style: AppTextStyles.subtitle,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          state.error!,
                          style: AppTextStyles.body.copyWith(
                            color: AppColors.textSecondary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: _handleRefresh,
                          icon: const Icon(Icons.refresh),
                          label: const Text('다시 시도'),
                        ),
                      ],
                    ),
                  )
                : ListView(
                    padding: EdgeInsets.zero,
                    children: [
                      // 친근한 터콰이즈 헤더
                      FriendlyHeader(
                        patient: state.patient,
                        session: state.currentSession,
                        onLogout: _handleLogout,
                      ),
                      const SizedBox(height: 24),

                      // 간소화된 상태 카드 (그래프 제거)
                      SimplifiedStatusCard(session: state.currentSession),
                      const SizedBox(height: 16),

                      // 약품 정보 카드
                      MedicationInfoCard(session: state.currentSession),
                      const SizedBox(height: 24),

                      // 간호사 호출 버튼
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20),
                        child: CallNurseButton(),
                      ),
                      const SizedBox(height: 32),
                    ],
                  ),
      ),
    );
  }
}
