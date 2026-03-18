import type { Config } from "tailwindcss";
import { tailwindPreset } from "@pncp/config";

const config: Config = {
  darkMode: "class",
  presets: [tailwindPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ]
};

export default config;
