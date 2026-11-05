/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/*.html",
    "./public/*.js",
    "./frontend/src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Albert Sans", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        "soft-out": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
