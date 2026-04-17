/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Ignore only broken legacy files that aren't used in the app build
  { ignores: ['src/components/BillCard.tsx', 'src/components/bill/BillCard.tsx'] },
];
