import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/constants/app_branding.dart';
import '../../providers/infusion_provider.dart';
import 'home_screen.dart';

/// 로그인 화면 - 스플래시 애니메이션 포함
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _pinController = TextEditingController();
  final _pinFocusNode = FocusNode();
  bool _isLoading = false;
  String? _errorMessage;
  bool _isButtonPressed = false;

  // 애니메이션 컨트롤러
  late AnimationController _animationController;
  late Animation<double> _logoFadeAnimation;
  late Animation<double> _logoScaleAnimation;
  late Animation<double> _logoPositionAnimation;
  late Animation<double> _titleFadeAnimation;
  late Animation<Offset> _titleSlideAnimation;
  late Animation<double> _subtitleFadeAnimation;
  late Animation<Offset> _subtitleSlideAnimation;
  late Animation<double> _formFadeAnimation;
  late Animation<Offset> _formSlideAnimation;

  @override
  void initState() {
    super.initState();

    // 애니메이션 컨트롤러 초기화 (1.8초)
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1800),
      vsync: this,
    );

    // 로고 페이드인 (0.0 - 0.22, 400ms)
    _logoFadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.0, 0.22, curve: Curves.easeIn),
      ),
    );

    // 로고 스케일 (0.33 - 0.56, 400ms) - 2배 → 1배 (중앙에서 600ms 대기)
    _logoScaleAnimation = Tween<double>(
      begin: 2.0,
      end: 1.0,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.33, 0.56, curve: Curves.easeOut),
      ),
    );

    // 로고 위치 이동 (0.33 - 0.56, 400ms) - 중앙 → 상단 (중앙에서 600ms 대기)
    _logoPositionAnimation = Tween<double>(
      begin: 0.0, // 중앙 (화면 높이의 0%)
      end: 1.0,   // 최종 위치 (상단)
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.33, 0.56, curve: Curves.easeOut),
      ),
    );

    // MEDIPOLE 타이틀 (0.50 - 0.67, 300ms)
    _titleFadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.50, 0.67, curve: Curves.easeIn),
      ),
    );

    _titleSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.5),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.50, 0.67, curve: Curves.easeOut),
      ),
    );

    // 부제 (0.58 - 0.75, 300ms)
    _subtitleFadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.58, 0.75, curve: Curves.easeIn),
      ),
    );

    _subtitleSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.5),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.58, 0.75, curve: Curves.easeOut),
      ),
    );

    // 입력 폼 (0.67 - 0.89, 400ms)
    _formFadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.67, 0.89, curve: Curves.easeIn),
      ),
    );

    _formSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.67, 0.89, curve: Curves.easeOut),
      ),
    );

    // 애니메이션 시작
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    _phoneController.dispose();
    _pinController.dispose();
    _pinFocusNode.dispose();
    super.dispose();
  }

  // 전화번호 자동 포맷팅
  void _formatPhoneNumber(String value) {
    // 숫자만 추출
    String digitsOnly = value.replaceAll('-', '');

    // 숫자만 11자리까지 제한
    if (digitsOnly.length > 11) {
      digitsOnly = digitsOnly.substring(0, 11);
    }

    // 포맷팅
    String formatted = '';
    if (digitsOnly.length <= 3) {
      formatted = digitsOnly;
    } else if (digitsOnly.length <= 7) {
      formatted = '${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3)}';
    } else {
      formatted = '${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3, 7)}-${digitsOnly.substring(7)}';
    }

    // TextFormField 업데이트
    _phoneController.value = TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );

    // 13자리 완성되면 PIN 필드로 자동 이동 (010-1234-5678)
    if (formatted.length == 13) {
      _pinFocusNode.requestFocus();
    }
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final success = await ref.read(infusionProvider.notifier).login(
            _phoneController.text,
            _pinController.text,
          );

      if (!mounted) return;

      if (success) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      } else {
        setState(() {
          _errorMessage = '로그인에 실패했습니다. 전화번호와 PIN을 확인해주세요.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '오류가 발생했습니다: ${e.toString()}';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  // 뉴모피즘 버튼 위젯
  Widget _buildNeumorphicButton({
    required VoidCallback? onPressed,
    required Widget child,
  }) {
    return GestureDetector(
      onTapDown: onPressed != null ? (_) => setState(() => _isButtonPressed = true) : null,
      onTapUp: onPressed != null ? (_) {
        setState(() => _isButtonPressed = false);
        onPressed();
      } : null,
      onTapCancel: () => setState(() => _isButtonPressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(16),
          boxShadow: _isButtonPressed
              ? [
                  // 눌린 상태 (inset shadows)
                  BoxShadow(
                    color: Colors.grey.shade400,
                    offset: const Offset(-3, -3),
                    blurRadius: 6,
                    spreadRadius: -2,
                  ),
                  BoxShadow(
                    color: Colors.white.withOpacity(0.7),
                    offset: const Offset(3, 3),
                    blurRadius: 6,
                    spreadRadius: -2,
                  ),
                ]
              : [
                  // 기본 상태 (raised shadows)
                  const BoxShadow(
                    color: Colors.white,
                    offset: Offset(-6, -6),
                    blurRadius: 12,
                    spreadRadius: 0,
                  ),
                  BoxShadow(
                    color: Colors.grey.shade400,
                    offset: const Offset(6, 6),
                    blurRadius: 12,
                    spreadRadius: 0,
                  ),
                ],
        ),
        child: Center(child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: AnimatedBuilder(
          animation: _animationController,
          builder: (context, child) {
            // 로고 위치 계산 (중앙 → 상단)
            final interpolatedTop = (screenHeight * 0.35) -
                (_logoPositionAnimation.value * ((screenHeight * 0.35) - 60.0));

            return Stack(
              children: [
                // 스플래시 로고 (중앙에서 시작)
                Positioned(
                  top: interpolatedTop,
                  left: 0,
                  right: 0,
                  child: FadeTransition(
                    opacity: _logoFadeAnimation,
                    child: Transform.scale(
                      scale: _logoScaleAnimation.value,
                      child: Center(
                        child: AppBranding.logoImage(
                          height: 128,
                        ),
                      ),
                    ),
                  ),
                ),

                // 로그인 콘텐츠 (순차적으로 표시)
                SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // 로고 공간 확보
                        const SizedBox(height: 200),

                        // MEDIPOLE 텍스트
                        SlideTransition(
                          position: _titleSlideAnimation,
                          child: FadeTransition(
                            opacity: _titleFadeAnimation,
                            child: Text(
                              'MEDIPOLE',
                              style: GoogleFonts.poppins(
                                fontSize: 32,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),

                        // 부제
                        SlideTransition(
                          position: _subtitleSlideAnimation,
                          child: FadeTransition(
                            opacity: _subtitleFadeAnimation,
                            child: Text(
                              '스마트 링거 폴대',
                              style: AppTextStyles.subtitle.copyWith(
                                color: AppColors.textSecondary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),

                        // 중간 공간
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.08,
                        ),

                        // 전화번호 입력
                        SlideTransition(
                          position: _formSlideAnimation,
                          child: FadeTransition(
                            opacity: _formFadeAnimation,
                            child: TextFormField(
                              controller: _phoneController,
                              keyboardType: TextInputType.phone,
                              maxLength: 13,
                              onChanged: _formatPhoneNumber,
                              decoration: InputDecoration(
                                labelText: '전화번호',
                                hintText: '010-1234-5678',
                                prefixIcon: const Icon(Icons.phone),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                filled: true,
                                fillColor: AppColors.surface,
                                counterText: '',
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return '전화번호를 입력해주세요';
                                }
                                if (value.length != 13) {
                                  return '올바른 전화번호를 입력해주세요 (010-1234-5678)';
                                }
                                return null;
                              },
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // PIN 입력
                        SlideTransition(
                          position: _formSlideAnimation,
                          child: FadeTransition(
                            opacity: _formFadeAnimation,
                            child: TextFormField(
                              controller: _pinController,
                              focusNode: _pinFocusNode,
                              keyboardType: TextInputType.number,
                              obscureText: true,
                              maxLength: 6,
                              decoration: InputDecoration(
                                labelText: 'PIN 번호',
                                hintText: '6자리 숫자',
                                prefixIcon: const Icon(Icons.lock),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                filled: true,
                                fillColor: AppColors.surface,
                                counterText: '',
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'PIN 번호를 입력해주세요';
                                }
                                if (value.length != 6) {
                                  return '6자리 숫자를 입력해주세요';
                                }
                                return null;
                              },
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // 에러 메시지
                        if (_errorMessage != null)
                          SlideTransition(
                            position: _formSlideAnimation,
                            child: FadeTransition(
                              opacity: _formFadeAnimation,
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.error.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  _errorMessage!,
                                  style: AppTextStyles.body.copyWith(
                                    color: AppColors.error,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                          ),
                        if (_errorMessage != null) const SizedBox(height: 16),

                        // 뉴모피즘 로그인 버튼
                        SlideTransition(
                          position: _formSlideAnimation,
                          child: FadeTransition(
                            opacity: _formFadeAnimation,
                            child: _buildNeumorphicButton(
                              onPressed: _isLoading ? null : _handleLogin,
                              child: _isLoading
                                  ? SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation<Color>(
                                            AppColors.primary),
                                      ),
                                    )
                                  : Text(
                                      '로그인',
                                      style: AppTextStyles.button.copyWith(
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // 도움말 텍스트
                        SlideTransition(
                          position: _formSlideAnimation,
                          child: FadeTransition(
                            opacity: _formFadeAnimation,
                            child: Text(
                              'PIN 번호를 잊으셨나요?\n간호사실에 문의해주세요.',
                              style: AppTextStyles.caption.copyWith(
                                color: AppColors.textSecondary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),

                        // 하단 여백
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.08,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
