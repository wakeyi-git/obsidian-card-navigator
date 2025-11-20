/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.ts',
        '**/?(*.)+(spec|test).ts'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
    ],
    moduleFileExtensions: ['ts', 'js'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/main.ts'
    ],
    // 현실적인 커버리지 목표 설정
    coverageThreshold: {
        global: {
            // 전체 프로젝트: 단계적으로 증가시킬 목표
            branches: 5,
            functions: 5,
            lines: 5,
            statements: 5
        },
        // 테스트된 파일들은 높은 기준 유지
        'src/utils/typeGuards.ts': {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100
        },
        'src/view/ViewStateManager.ts': {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100
        }
    },
    // Obsidian 모듈 모킹
    moduleNameMapper: {
        '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts'
    },
    // 글로벌 setup
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
