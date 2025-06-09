module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:svelte/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    extraFileExtensions: ['.svelte']
  },
  env: {
    browser: true,
    es2017: true,
    node: true
  },
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser'
      }
    }
  ],
  rules: {
    // Disable rules that are too strict for rapid development
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    // Design System Enforcement Rules
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
        message: '🚫 Hard-coded hex colors are forbidden. Use design tokens: bg-primary-500, text-accent-600, etc.'
      },
      {
        selector: 'Literal[value=/^rgb\\(/]',
        message: '🚫 Hard-coded RGB colors are forbidden. Use design tokens: bg-primary-500, text-accent-600, etc.'
      },
      {
        selector: 'Literal[value=/^rgba\\(/]', 
        message: '🚫 Hard-coded RGBA colors are forbidden. Use glass utilities: .glass, .glass-sage, .glass-gold'
      },
      {
        selector: 'Literal[value=/^hsl\\(/]',
        message: '🚫 Hard-coded HSL colors are forbidden. Use design tokens: bg-primary-500, text-accent-600, etc.'
      }
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'style',
        property: 'color',
        message: '🚫 Inline color styles forbidden. Use Tailwind classes: text-primary-700, text-onSurface, etc.'
      },
      {
        object: 'style', 
        property: 'backgroundColor',
        message: '🚫 Inline background colors forbidden. Use Tailwind classes: bg-primary-500, bg-glass-white, etc.'
      },
      {
        object: 'style',
        property: 'borderColor', 
        message: '🚫 Inline border colors forbidden. Use Tailwind classes: border-surface-border, border-primary-300, etc.'
      },
      {
        object: 'style',
        property: 'boxShadow',
        message: '🚫 Inline shadows forbidden. Use shadow utilities: shadow-md, shadow-lg, shadow-xl, etc.'
      }
    ],
    // Prevent arbitrary Tailwind values that bypass design system
    'no-restricted-patterns': [
      'error',
      {
        pattern: '\\[(#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(|hsl\\().*\\]',
        message: '🚫 Arbitrary color values in Tailwind classes forbidden. Use design tokens: bg-[var(--sage-500)] → bg-primary-500'
      }
    ]
  }
}; 