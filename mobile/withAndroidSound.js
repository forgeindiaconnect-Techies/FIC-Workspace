const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAndroidSound = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'raw');
      if (!fs.existsSync(resDir)) {
        fs.mkdirSync(resDir, { recursive: true });
      }
      
      const soundFile = path.join(projectRoot, '..', 'public', 'phone-calling-1.wav');
      const destFile = path.join(resDir, 'phone_calling_1.wav');
      
      if (fs.existsSync(soundFile)) {
        fs.copyFileSync(soundFile, destFile);
      } else {
        console.warn(`[withAndroidSound] Could not find sound file at ${soundFile}`);
      }
      
      return config;
    },
  ]);
};

module.exports = withAndroidSound;
