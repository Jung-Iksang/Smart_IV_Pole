import React, { useState } from 'react';

/**
 * 앱 브랜딩 설정
 *
 * 이 파일에서 앱의 모든 브랜딩 요소를 중앙 관리합니다.
 * 로고 이미지나 앱 이름 변경 시 이 파일만 수정하면 전체 웹앱에 반영됩니다.
 */

// ===== 브랜딩 상수 =====
export const APP_NAME = 'MEDIPOLE';
export const APP_FULL_NAME = 'Smart IV Pole - MEDIPOLE';

// ===== 로고 이미지 경로 =====
// 로고 파일을 /public/logo/ 디렉토리에 넣고 아래 경로를 수정하세요
// eslint-disable-next-line react-refresh/only-export-components
export const LOGO_PATHS = {
  // 기본 로고 (아이콘 + 텍스트)
  main: '/logo/logo.svg',           // 또는 logo.png
  mainPng: '/logo/logo.png',

  // 아이콘만
  icon: '/logo/logo-icon.svg',      // 또는 logo-icon.png
  iconPng: '/logo/logo.png',

  // 텍스트만
  text: '/logo/logo-text.svg',      // 또는 logo-text.png
  textPng: '/logo/logo.png',

  // 테마별 로고
  white: '/logo/logo-white.svg',    // 어두운 배경용
  dark: '/logo/logo.svg',      // 밝은 배경용
} as const;

// ===== 타입 정의 =====
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';
export type LogoVariant = 'main' | 'icon' | 'text' | 'white' | 'dark';

export interface LogoImageProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  alt?: string;
  fallback?: React.ReactNode;
}

export interface LogoFullProps {
  size?: LogoSize;
  className?: string;
  variant?: Extract<LogoVariant, 'main' | 'white' | 'dark'>;
  showText?: boolean;
  textColor?: string;
  showSubtitle?: boolean;
  subtitle?: string;
}

// ===== 크기 매핑 =====
const SIZE_CONFIG = {
  sm: {
    imageSize: 'h-6',      // height만 지정 (aspect ratio 유지)
    iconSize: 'h-6',
    textSize: 'text-sm',
    subtitleSize: 'text-xs',
    gap: 'gap-1.5',
  },
  md: {
    imageSize: 'h-8',
    iconSize: 'h-8',
    textSize: 'text-lg',
    subtitleSize: 'text-xs',
    gap: 'gap-2',
  },
  lg: {
    imageSize: 'h-10',
    iconSize: 'h-10',
    textSize: 'text-xl',
    subtitleSize: 'text-sm',
    gap: 'gap-2.5',
  },
  xl: {
    imageSize: 'h-12',
    iconSize: 'h-12',
    textSize: 'text-2xl',
    subtitleSize: 'text-base',
    gap: 'gap-3',
  },
} as const;

// ===== 로고 컴포넌트 =====

/**
 * 로고 이미지 표시 (에러 핸들링 포함)
 * 이미지 로드 실패 시 fallback 표시
 */
export const LogoImage: React.FC<LogoImageProps> = ({
  variant = 'main',
  size = 'md',
  className = '',
  alt = APP_NAME,
  fallback,
}) => {
  const [hasError, setHasError] = useState(false);
  const config = SIZE_CONFIG[size];

  // 변형에 따른 이미지 경로 선택
  const getImagePath = (): string => {
    switch (variant) {
      case 'icon':
        return LOGO_PATHS.icon;
      case 'text':
        return LOGO_PATHS.text;
      case 'white':
        return LOGO_PATHS.white;
      case 'dark':
        return LOGO_PATHS.dark;
      default:
        return LOGO_PATHS.main;
    }
  };

  // 폴백 렌더링
  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  if (hasError) {
    // 기본 폴백: 텍스트 표시
    return (
      <span className={`font-bold ${config.textSize} ${className}`}>
        {APP_NAME}
      </span>
    );
  }

  return (
    <img
      src={getImagePath()}
      alt={alt}
      className={`${config.imageSize} ${className} object-contain`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
};

/**
 * 아이콘만 표시
 * 주로 축소된 사이드바나 작은 공간에 사용
 */
export const LogoIcon: React.FC<Omit<LogoImageProps, 'variant'>> = (props) => {
  return <LogoImage {...props} variant="icon" />;
};

/**
 * 텍스트만 표시
 * 주로 제목이나 헤더에 사용
 */
export const LogoText: React.FC<Omit<LogoImageProps, 'variant'>> = (props) => {
  return <LogoImage {...props} variant="text" />;
};

/**
 * 로고 전체 (아이콘 + 텍스트) 또는 이미지 + 추가 텍스트
 * 주로 사이드바나 헤더에 사용
 */
export const LogoFull: React.FC<LogoFullProps> = ({
  size = 'md',
  className = '',
  variant = 'main',
  showText = true,
  textColor = 'text-white',
  showSubtitle = false,
  subtitle,
}) => {
  const config = SIZE_CONFIG[size];

  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      <LogoImage
        variant={variant}
        size={size}
        fallback={
          // 이미지 로드 실패 시 텍스트 기반 폴백
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">IV</span>
          </div>
        }
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-semibold ${config.textSize} ${textColor}`}>
            {APP_NAME}
          </span>
          {showSubtitle && subtitle && (
            <span className={`${config.subtitleSize} ${textColor} opacity-75`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ===== 기본 export =====
export default {
  APP_NAME,
  APP_FULL_NAME,
  LOGO_PATHS,
  LogoImage,
  LogoIcon,
  LogoText,
  LogoFull,
};
