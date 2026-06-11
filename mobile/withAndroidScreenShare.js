const { withAndroidManifest, withMainApplication } = require('expo/config-plugins');

module.exports = function withAndroidScreenShare(config) {
  config = withAndroidManifest(config, async (config) => {
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

  config = withMainApplication(config, async (config) => {
    let contents = config.modResults.contents;
    const webrtcImport = 'import com.oney.WebRTCModule.WebRTCModuleOptions';
    
    // Add import if missing
    if (!contents.includes(webrtcImport)) {
      if (contents.includes('import android.app.Application')) {
        contents = contents.replace('import android.app.Application', `import android.app.Application\n${webrtcImport}`);
      } else {
        // Fallback: add after package declaration
        contents = contents.replace(/package .*\n/, `$&${webrtcImport}\n`);
      }
    }

    const webrtcInit = 'WebRTCModuleOptions.getInstance().enableMediaProjectionService = true';
    // Add initialization to onCreate
    if (!contents.includes(webrtcInit)) {
      if (contents.includes('super.onCreate()')) {
        // Kotlin / Java
        const suffix = config.modResults.language === 'java' ? ';' : '';
        contents = contents.replace('super.onCreate()', `super.onCreate()${suffix}\n    ${webrtcInit}${suffix}`);
      }
    }
    
    config.modResults.contents = contents;
    return config;
  });

  return config;
};
