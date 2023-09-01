const { pathsToModuleNameMapper } = require('ts-jest');
// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):
const { compilerOptions } = require('./tsconfig.json');
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coverageDirectory: 'dist/coverage',
  reporters: ['default'],
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  //testResultsProcessor: 'jest-sonar-reporter',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' } )
};