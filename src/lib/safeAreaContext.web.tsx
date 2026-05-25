import React from 'react';
import { View } from 'react-native';

export function SafeAreaView({ children, style }: { children?: React.ReactNode; style?: any }) {
  return <View style={style}>{children}</View>;
}
