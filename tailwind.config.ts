import type { Config } from "tailwindcss";

// Bảng màu "Military Administrative": đỏ đô làm màu nhấn, xanh ô-liu trầm, vàng đồng nhạt, nền kem, chữ xám đậm.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#fbf3f2", 100: "#f5e1df", 200: "#e8bdb8", 500: "#9b2c2c", 600: "#8a2323", 700: "#741c1c", 800: "#5e1717", 900: "#451111" },
        olive: { 50: "#f4f5ee", 100: "#e6e9d8", 200: "#cdd3b2", 500: "#5f6b3a", 600: "#4f5a2f", 700: "#414a27", 800: "#333a1f", 900: "#262b17" },
        bronze: { 50: "#fbf7ee", 100: "#f4ead2", 200: "#e8d4a6", 300: "#d9bb78", 400: "#c9a35a", 500: "#b08a43", 700: "#7c602d" },
        cream: { DEFAULT: "#faf7f0", 100: "#f5f0e4", 200: "#ece4d2" },
        ink: { DEFAULT: "#2a2a27", soft: "#4a4a44", muted: "#6b6b63" },
      },
      fontFamily: { sans: ['"Be Vietnam Pro"', "system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(40,30,20,.06), 0 1px 3px rgba(40,30,20,.08)" },
    },
  },
  plugins: [],
};
export default config;
