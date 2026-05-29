# Logo Assets

이 디렉토리에 로고 이미지 파일을 넣어주세요.

## 필요한 파일

### 권장 파일 구조:
```
logo/
├── logo.png           # 기본 로고 (512x512 권장)
├── logo_icon.png      # 아이콘만 (256x256 권장)
├── logo_text.png      # 텍스트만 (가로 긴 형태)
├── logo_white.png     # 어두운 배경용 흰색 로고
└── logo_dark.png      # 밝은 배경용 어두운 로고
```

## 파일 형식
- **PNG** (투명 배경 권장)
- **SVG** (확대/축소에 유리)

## 사용 위치
- `home_screen.dart` - 앱바 로고
- `login_screen.dart` - 로그인 화면 로고
- 기타 모든 화면에서 `AppBranding` 클래스를 통해 접근
