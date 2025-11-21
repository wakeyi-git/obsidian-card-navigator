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
            // 전체 프로젝트: 현재 커버리지 기준 (UI 제외)
            // UI 테스트 추가 시 단계적으로 상향 조정 예정
            branches: 55,
            functions: 45,
            lines: 55,
            statements: 55
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
