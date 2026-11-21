// Windows only: keeps the Android C++ build within the 260-character path limit.
//
// Without long-path support (off by default on Windows), the native build fails with
// "Filename longer than 260 characters": React Native libraries' object files end up in paths
// of 300+ characters. Two changes fix it:
// - CMAKE_OBJECT_PATH_MAX makes CMake replace an object file's long source-relative directory
//   with a hash once the path gets too long (no limit is set for Android builds by default);
// - the build directory moves from android/app/.cxx to <project>/.cx, so that even the
//   shortened paths fit.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// with-short-cxx-dir';

module.exports = function withShortCxxDir(config) {
  return withAppBuildGradle(config, (config) => {
    if (process.platform !== 'win32' || config.modResults.contents.includes(MARKER)) return config;
    config.modResults.contents += `
${MARKER}
android {
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_OBJECT_PATH_MAX=240"
            }
        }
    }
    externalNativeBuild {
        cmake {
            buildStagingDirectory = new File(rootDir.parentFile, ".cx")
        }
    }
}
`;
    return config;
  });
};
