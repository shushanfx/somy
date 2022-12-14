module.exports = {
  presets: [
    '@babel/preset-typescript',
    [
      '@babel/preset-env',
      {
        modules: false,
      },
    ],
  ],
  plugins: ['@babel/plugin-transform-runtime'],
  env: {
    test: {
      presets: ['@babel/preset-env'],
    },
  },
};
