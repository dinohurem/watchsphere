// Xcode 27 rejects pod targets whose IPHONEOS_DEPLOYMENT_TARGET is below 15.0
// (SDWebImage 9.0, RNCAsyncStorage resources 13.4, lottie-ios privacy bundle 13.0).
// Raise every pod target to at least the app's minimum (16.0, set via expo-build-properties) after `pod install`.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# withPodsDeploymentTarget';

module.exports = function withPodsDeploymentTarget(config, { minimum = '16.0' } = {}) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes(MARKER)) return cfg;
      const hook = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${minimum}')
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${minimum}'
        end
      end
    end
`;
      // Run after react_native_post_install so nothing resets the value afterwards.
      const rnCall = /react_native_post_install\([\s\S]*?\n\s*\)\n/;
      const anchor = 'post_install do |installer|';
      if (rnCall.test(contents)) {
        contents = contents.replace(rnCall, (m) => `${m}${hook}`);
      } else if (contents.includes(anchor)) {
        contents = contents.replace(anchor, `${anchor}${hook}`);
      } else {
        throw new Error('withPodsDeploymentTarget: post_install block not found in Podfile');
      }
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
};
