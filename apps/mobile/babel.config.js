module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Keep expo-router transform enabled for every platform build (iOS/Android/Web),
    // because file-system route resolution and deep-link mapping assume this plugin ran.
    plugins: ["expo-router/babel"],
  };
};
