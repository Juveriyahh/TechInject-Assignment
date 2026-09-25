import type { Config } from 'tailwindcss';
import { techInjectPreset } from '@tech-inject/ui/tailwind-preset';

export default {
  ...techInjectPreset,
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}']
} satisfies Config;
