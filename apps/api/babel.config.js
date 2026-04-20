module.exports = {
  presets: [['@babel/preset-typescript', { allExtensions: true }]],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    '@babel/plugin-transform-class-properties',
    '@babel/plugin-transform-modules-commonjs',
  ],
};
