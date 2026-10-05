/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Navy: header, nút chính, liên kết, tab active (đổi ở đây là đổi toàn app)
        primary: {
          DEFAULT: '#0F3D5E',
          50:  '#EEF4F8',
          100: '#DCE8F0',
          200: '#B6CDDD',
          300: '#85A9C3',
          400: '#4A7EA3',
          500: '#1F5F8B',
          600: '#0F3D5E',
          700: '#0B2E47',
          800: '#08243A',
          900: '#051A2B',
        },
        // Màu độ mặn — CHỈ dùng cho độ mặn/cảnh báo (khớp utils/salinity.ts)
        salinity: {
          low:    '#22c55e',
          medium: '#eab308',
          high:   '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
