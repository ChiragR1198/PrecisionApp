const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Restricts the app to phones only (no tablets) on Android.
 * Sets supports-screens so the app is not offered to large/xlarge screen devices on Play Store.
 */
function addSupportsScreensToManifest(androidManifest) {
  const { manifest } = androidManifest;

  manifest["supports-screens"] = [
    {
      $: {
        "android:smallScreens": true,
        "android:normalScreens": true,
        "android:largeScreens": false,
        "android:xlargeScreens": false,
      },
    },
  ];

  return androidManifest;
}

module.exports = function withAndroidPhoneOnly(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = addSupportsScreensToManifest(config.modResults);
    return config;
  });
};
