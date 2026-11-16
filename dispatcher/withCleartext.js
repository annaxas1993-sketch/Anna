const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withCleartext(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$["android:usesCleartextTraffic"] = "true";
    }
    return config;
  });
};
