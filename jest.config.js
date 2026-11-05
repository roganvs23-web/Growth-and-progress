/** Unit tests for the pure logic in src/core (runs in plain Node). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/core'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, isolatedModules: true, rootDir: '.', types: ['jest', 'node'] } }] },
};
