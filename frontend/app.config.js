// Dynamic config on top of app.json.
// APP_VARIANT=staging (set by the "staging" EAS profile) builds the separate "NurseryPOS QA"
// app, which installs next to the real one and talks to the staging server.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== "staging") return config;
  return {
    ...config,
    name: "NurseryPOS QA",
    scheme: "nurserypos-qa",
    android: { ...config.android, package: "com.planteck.nurserypos.qa" },
    ios: { ...config.ios, bundleIdentifier: "com.planteck.nurserypos.qa" },
  };
};
