import React from 'react';
import { View, StyleSheet, Platform, StatusBar, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, TopBar } from './layout';
import { Outlet, useLocation } from '../lib/router';
import { getScreenType, getContentPadding, getBottomNavHeight } from '../lib/responsive';

export default function AppLayout() {
  const location = useLocation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pageTitle = location.pathname.split('/')[1] || 'Workspace';
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  
  const screenType = getScreenType(width);
  const contentPadding = getContentPadding(screenType, width);
  const bottomNavHeight = getBottomNavHeight(width);

  React.useEffect(() => {
    const checkFullscreen = () => {
      const active = !!(global as any).isFullScreenMeetingActive;
      if (active !== isFullscreen) {
        setIsFullscreen(active);
      }
    };
    const interval = setInterval(checkFullscreen, 100);
    return () => clearInterval(interval);
  }, [isFullscreen]);

  return (
    <SafeAreaView style={[styles.safeArea, isFullscreen && styles.safeAreaFullscreen]} edges={isFullscreen ? [] : ['top', 'bottom', 'left', 'right']}>
      <StatusBar 
        translucent 
        backgroundColor="transparent" 
        barStyle={isFullscreen ? "light-content" : "dark-content"} 
        hidden={isFullscreen}
      />
      <View style={styles.container}>
        {!isFullscreen && <TopBar title={pageTitle} />}
        <View style={[
          styles.main,
          isFullscreen && styles.mainFullscreen,
          !isFullscreen && {
            paddingHorizontal: contentPadding.horizontal,
            paddingTop: contentPadding.vertical,
            paddingBottom: bottomNavHeight + contentPadding.vertical,
          }
        ]}>
          <View style={styles.contentWrapper}>
            <Outlet />
          </View>
        </View>
        {!isFullscreen && <BottomNav />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  safeAreaFullscreen: {
    backgroundColor: '#090d16',
  },
  container: {
    flex: 1,
  },
  main: {
    flex: 1,
  },
  mainFullscreen: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  contentWrapper: {
    flex: 1,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
});

