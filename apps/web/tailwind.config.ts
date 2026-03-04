import type { Config } from 'tailwindcss';
import uiWebTailwindBaseConfig from '../../packages/ui-web/tailwind.config';

const config: Config = {
  ...uiWebTailwindBaseConfig,
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './lib/**/*.{ts,tsx,js,jsx}',
    ...((uiWebTailwindBaseConfig.content as string[]) ?? []),
  ],
} as Config;

export default config;
