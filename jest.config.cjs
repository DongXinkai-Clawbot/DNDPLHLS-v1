/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'engine/**/*.ts',
    'hooks/**/*.ts',
    'components/**/*.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Ignore the nested duplicate repo folder to avoid jest-haste-map package.json collisions.
  modulePathIgnorePatterns: ["<rootDir>/DNDPLHLS-master/", "<rootDir>/DNDPLHLS/"],
  testPathIgnorePatterns: [
    "<rootDir>/DNDPLHLS-master/",
    "<rootDir>/DNDPLHLS/",
    "<rootDir>/tests/ui/"
  ],
};
