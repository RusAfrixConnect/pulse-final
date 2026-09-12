// Config dynamique : part d'app.json (statique, commité sans secret) et injecte la clé
// Google Maps depuis la variable d'environnement GOOGLE_MAPS_API_KEY au moment du build,
// pour ne jamais avoir la clé en clair dans le dépôt (public sur GitHub).
// En local (Expo Go / dev client), définis GOOGLE_MAPS_API_KEY dans ton shell si tu veux
// que la carte s'affiche aussi en dev ; en build EAS, elle vient du secret créé via
// `eas env:create` (déjà fait pour production/preview/development).
const { expo } = require('./app.json');

module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  return {
    ...config,
    ...expo,
    ios: {
      ...expo.ios,
      config: {
        ...(expo.ios?.config || {}),
        ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
      },
    },
    android: {
      ...expo.android,
      config: {
        ...(expo.android?.config || {}),
        ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
      },
    },
  };
};
