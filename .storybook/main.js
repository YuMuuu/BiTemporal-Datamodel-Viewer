module.exports = {
  stories: [
    '../app/**/*.stories.@(js|jsx)'
  ],
  addons: [
    '@storybook/addon-essentials',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  webpackFinal: async (config) => {
    // Transpile JSX in .stories.jsx under app/
    config.module.rules.push({
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: {
        loader: require.resolve('babel-loader'),
        options: {
          presets: [require.resolve('@babel/preset-react')],
        },
      },
    });
    return config;
  },
};
