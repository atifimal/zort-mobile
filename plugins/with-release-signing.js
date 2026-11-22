// Signs release builds (APK and the AAB for Google Play) with Zort's own upload key instead of
// the template's debug key, which every React Native project shares.
//
// The key and its passwords never enter the project: they are read from Gradle properties,
// normally in ~/.gradle/gradle.properties (see README, "İmza anahtarı"):
//   ZORT_UPLOAD_STORE_FILE, ZORT_UPLOAD_STORE_PASSWORD, ZORT_UPLOAD_KEY_ALIAS, ZORT_UPLOAD_KEY_PASSWORD
// Without them a release build still works, signed with the debug key, and Gradle says so.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// with-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    const withConfig = contents.replace(
      /signingConfigs \{\n/,
      `signingConfigs {
        ${MARKER}
        release {
            if (findProperty('ZORT_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('ZORT_UPLOAD_STORE_FILE'))
                storePassword findProperty('ZORT_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('ZORT_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('ZORT_UPLOAD_KEY_PASSWORD')
            }
        }
`,
    );
    const withBuildType = withConfig.replace(
      /(\n\s*release \{\n(?:\s*\/\/[^\n]*\n)*)\s*signingConfig signingConfigs\.debug/,
      `$1            signingConfig findProperty('ZORT_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    );
    if (withConfig === contents || withBuildType === withConfig) {
      throw new Error('with-release-signing: the signing config in android/app/build.gradle has changed shape');
    }

    config.modResults.contents = `${withBuildType}
${MARKER}
if (!findProperty('ZORT_UPLOAD_STORE_FILE')) {
    logger.warn('Zort: no upload key (ZORT_UPLOAD_STORE_FILE), so release builds are signed with the debug key')
}
`;
    return config;
  });
};
