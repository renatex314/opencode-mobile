/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Dark theme palette inspired by opencode TUI
        bg: {
          primary: "#0d1117",
          secondary: "#161b22",
          tertiary: "#21262d",
          hover: "#30363d",
        },
        border: {
          DEFAULT: "#30363d",
          muted: "#21262d",
        },
        text: {
          primary: "#e6edf3",
          secondary: "#8b949e",
          muted: "#6e7681",
          link: "#58a6ff",
        },
        accent: {
          blue: "#58a6ff",
          green: "#3fb950",
          yellow: "#d29922",
          red: "#f85149",
          purple: "#bc8cff",
          orange: "#f0883e",
          cyan: "#39d353",
        },
        token: {
          keyword: "#ff7b72",
          string: "#a5d6ff",
          comment: "#8b949e",
          number: "#79c0ff",
          function: "#d2a8ff",
          operator: "#ff7b72",
          type: "#ffa657",
          variable: "#e6edf3",
        },
      },
      fontFamily: {
        mono: ["monospace"],
      },
    },
  },
  plugins: [],
};
