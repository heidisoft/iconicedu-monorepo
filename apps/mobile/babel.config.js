module.exports = function (api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test';

  return {
    presets: [
      'babel-preset-expo',
      // NativeWind babel preset requires native worklets plugin
      // which is not available in the jest test environment
      ...(isTest ? [] : ['nativewind/babel']),
    ],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@iconicedu/ui-native': '../../packages/ui-native/src',
            '@iconicedu/shared-types': '../../packages/shared-types/src',
            '@/': './src/',
          },
        },
      ],
    ],
  };
};
