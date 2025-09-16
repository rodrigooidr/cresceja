module.exports = {
  stories: [
    "../src/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    // opcional: "msw-storybook-addon", // se quiser usar MSW depois
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: { disableTelemetry: true },
};
