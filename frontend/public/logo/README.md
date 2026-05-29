# Logo Assets

이 디렉토리에 로고 이미지 파일을 넣어주세요.

## 필요한 파일

### 권장 파일 구조:
```
logo/
├── logo.png           # 기본 로고 (512x512 권장)
├── logo.svg           # SVG 로고 (벡터 형식, 권장)
├── logo-icon.png      # 아이콘만 (256x256 권장)
├── logo-text.png      # 텍스트만 (가로 긴 형태)
├── logo-white.png     # 어두운 배경용 흰색 로고
└── logo-dark.png      # 밝은 배경용 어두운 로고
```

## 파일 형식
- **SVG** (확대/축소에 가장 유리, 권장)
- **PNG** (투명 배경 권장)
- **WebP** (최신 브라우저용, 용량 절약)

## 사용 위치
- `Sidebar.tsx` - 사이드바 로고
- `PatientDetail.tsx` - 상세 페이지 로고
- `NurseDashboard.tsx` - 대시보드 로고
- 기타 모든 컴포넌트에서 `branding.tsx`를 통해 접근
