module.exports = {
  env: {
    browser: false,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
      generators: false,
      experimentalObjectRestSpread: true,
    },
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // turn off bad rules:
    'no-console': 'off', // Already caught by tslint
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/camelcase': 'off', // There are a few exceptions, like variables from the backend and stuff
    '@typescript-eslint/no-inferrable-types': 'off',
    'require-atomic-updates': 'off', // shitty rule that gives many false positives. See https://github.com/eslint/eslint/issues/11899

    // activate awesome rules:
    '@typescript-eslint/no-unnecessary-type-assertion': ['error'],
    '@typescript-eslint/no-extra-non-null-assertion': ['error'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'none',
      },
    ],
    '@typescript-eslint/require-await': 'off', // currently buggy on 2019-11-20, see https://github.com/typescript-eslint/typescript-eslint/issues/1226
    '@typescript-eslint/no-unnecessary-condition': [
      'error',
      {
        ignoreRhs: true,
      },
    ],
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        ignoreRhs: true,
      },
    ],
  },
}
