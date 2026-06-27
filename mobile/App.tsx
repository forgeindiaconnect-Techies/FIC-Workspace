import { registerWebRTCGlobals } from './src/lib/webrtc';
import notifee, { EventType } from '@notifee/react-native';

registerWebRTCGlobals();

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction) {
    if (detail.pressAction.id === 'decline') {
      // Need to tell server call declined? We can just clear the notification
      await notifee.cancelNotification(detail.notification?.id || '');
    } else if (detail.pressAction.id === 'answer') {
      // Launch app handled by launchActivity
      await notifee.cancelNotification(detail.notification?.id || '');
    }
  }
});

import App from './src/App';
export default App;
