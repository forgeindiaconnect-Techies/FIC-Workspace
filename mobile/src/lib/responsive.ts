import { Dimensions, Platform, StatusBar } from 'react-native';

/**
 * Responsive design utilities for React Native
 * Handles different screen sizes, OS versions, and notches
 */

export const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

export const getScreenType = (width: number) => {
  if (width < 480) return 'small'; // Small phones (iPhone SE, etc)
  if (width < 600) return 'mobile'; // Standard phones
  if (width < 768) return 'compact'; // Larger phones / small tablets
  if (width < 1024) return 'tablet'; // Tablets
  return 'desktop'; // Large tablets / web
};

export const getStatusBarHeight = () => {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight || 24;
  }
  if (Platform.OS === 'ios') {
    return 44; // iPhone 14 and earlier
  }
  return 0; // Web
};

export const getSafeAreaInsets = (insets: any) => {
  return {
    top: insets?.top || getStatusBarHeight(),
    bottom: insets?.bottom || (Platform.OS === 'ios' ? 34 : 0),
    left: insets?.left || 0,
    right: insets?.right || 0,
  };
};

export const getTopBarHeight = (insets: any = {}) => {
  const safeArea = getSafeAreaInsets(insets);
  const baseHeight = Platform.select({
    ios: 56,
    android: 56,
    web: 64,
  }) || 56;
  return baseHeight + safeArea.top;
};

export const getBottomNavHeight = (width?: number) => {
  const screenWidth = width || getScreenDimensions().width;
  if (screenWidth < 768) {
    return Platform.select({
      ios: 83, // Bottom safe area included
      android: 72,
      web: 80,
    }) || 72;
  }
  return Platform.select({
    ios: 88,
    android: 80,
    web: 92,
  }) || 80;
};

export const getContentPadding = (screenType: string, width: number) => {
  if (screenType === 'small') {
    return { horizontal: 12, vertical: 16 };
  }
  if (screenType === 'mobile') {
    return { horizontal: 16, vertical: 20 };
  }
  if (screenType === 'compact') {
    return { horizontal: 16, vertical: 24 };
  }
  if (screenType === 'tablet') {
    return { horizontal: 24, vertical: 28 };
  }
  return { horizontal: 32, vertical: 32 };
};

export const getResponsiveFontSize = (screenType: string, baseSize: number) => {
  if (screenType === 'small') {
    return Math.max(12, baseSize - 2);
  }
  if (screenType === 'mobile') {
    return baseSize;
  }
  if (screenType === 'compact' || screenType === 'tablet') {
    return baseSize + 1;
  }
  return baseSize + 2;
};

export const getGridColumns = (screenType: string) => {
  if (screenType === 'small' || screenType === 'mobile') return 2;
  if (screenType === 'compact') return 3;
  if (screenType === 'tablet') return 4;
  return 5;
};

export const getResponsiveValue = <T extends number | string>(
  values: {
    small?: T;
    mobile?: T;
    compact?: T;
    tablet?: T;
    desktop?: T;
  },
  screenType: string,
  defaultValue: T
): T => {
  return values[screenType as keyof typeof values] || defaultValue;
};

export const useResponsiveLayout = () => {
  const { width, height } = getScreenDimensions();
  const screenType = getScreenType(width);
  const statusBarHeight = getStatusBarHeight();
  const contentPadding = getContentPadding(screenType, width);
  const gridColumns = getGridColumns(screenType);

  return {
    width,
    height,
    screenType,
    statusBarHeight,
    contentPadding,
    gridColumns,
    isSmallScreen: screenType === 'small',
    isMobileScreen: screenType === 'mobile',
    isTabletScreen: screenType === 'tablet' || screenType === 'desktop',
  };
};
