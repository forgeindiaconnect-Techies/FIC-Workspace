const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidScreenShare(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    const hasService = application.service.some(
      (s) => s.$['android:name'] === 'com.oney.WebRTCModule.MediaProjectionService'
    );

    if (!hasService) {
      application.service.push({
        $: {
          'android:name': 'com.oney.WebRTCModule.MediaProjectionService',
          'android:foregroundServiceType': 'mediaProjection'
        }
      });
    }

    return config;
  });
};
