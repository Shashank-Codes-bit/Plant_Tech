// Dynamic config on top of app.json.
// APP_VARIANT (set by the EAS build profile) builds a separate app that installs next to the real one:
//   staging     → "Hara Hisaab QA", talks to the staging server ("staging" profile)
//   development → "Hara Hisaab Dev", a dev client that loads JS from `npx expo start` ("development" profile)
const VARIANTS = {
  staging: { name: "Hara Hisaab QA", scheme: "nurserypos-qa", id: "com.planteck.nurserypos.qa" },
  development: { name: "Hara Hisaab Dev", scheme: "nurserypos-dev", id: "com.planteck.nurserypos.dev" },
};

module.exports = ({ config }) => {
  const variant = VARIANTS[process.env.APP_VARIANT];
  if (!variant) return config;
  return {
    ...config,
    name: variant.name,
    scheme: variant.scheme,
    android: { ...config.android, package: variant.id },
    ios: { ...config.ios, bundleIdentifier: variant.id },
  };
};
