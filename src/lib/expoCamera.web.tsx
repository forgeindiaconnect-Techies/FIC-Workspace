import React from 'react';
import { View } from 'react-native';

export type CameraType = 'front' | 'back';

const grantedPermission = { granted: true };

export function useCameraPermissions() {
  return [grantedPermission, async () => grantedPermission] as const;
}

export function useMicrophonePermissions() {
  return [grantedPermission, async () => grantedPermission] as const;
}

export function CameraView({ style }: { style?: any }) {
  return <View style={style} />;
}
