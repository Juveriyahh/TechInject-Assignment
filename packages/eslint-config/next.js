/** ESLint configuration for the Next.js applications. */
module.exports = {
  ...require('./index.js'),
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'next/core-web-vitals', 'prettier']
};
