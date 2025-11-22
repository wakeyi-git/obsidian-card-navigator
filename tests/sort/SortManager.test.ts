/**
 * SortManager 테스트
 * 
 * 파일 정렬 로직의 모든 케이스를 테스트합니다.
 */

import { TFile, App } from 'obsidian';
import { SortManager } from '../../src/sort/SortManager';
import { SortOptions, SortCriteria } from '../../src/types';

// Mock App
const mockApp = {
    metadataCache: {
        getFileCache: jest.fn()
    }
} as unknown as App;

// 헬퍼 함수: Mock TFile 생성
function createMockFile(
    basename: string,
    ctime: number,
    mtime: number,
    size: number = 1000
): TFile {
    const file = new TFile();
    file.basename = basename;
    file.name = `${basename}.md`;
    file.path = `${basename}.md`;
    file.stat = {
        ctime,
        mtime,
        size
    } as any;
    return file;
}

describe('SortManager', () => {
    let sortManager: SortManager;
    let files: TFile[];
    
    beforeEach(() => {
        sortManager = new SortManager(mockApp);
        jest.clearAllMocks();
        
        // 테스트용 파일 목록 생성
        files = [
            createMockFile('Charlie', 3000, 3500, 3000),
            createMockFile('Alice', 1000, 1500, 1000),
            createMockFile('Bob', 2000, 2500, 2000)
        ];
    });
    
    describe('sort - name criteria', () => {
        it('should sort files by name in ascending order', () => {
            const options: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            const sorted = sortManager.sort(files, options);
            
            expect(sorted.map(f => f.basename)).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        
        it('should sort files by name in descending order', () => {
            const options: SortOptions = {
                criteria: 'name',
                order: 'desc'
            };
            
            const sorted = sortManager.sort(files, options);
            
            expect(sorted.map(f => f.basename)).toEqual(['Charlie', 'Bob', 'Alice']);
        });
        
        it('should handle numeric sorting in filenames', () => {
            const numericFiles = [
                createMockFile('File 10', 1000, 1000),
                createMockFile('File 2', 2000, 2000),
                createMockFile('File 1', 3000, 3000)
            ];
            
            const options: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            const sorted = sortManager.sort(numericFiles, options);
            
            // 자연스러운 숫자 정렬: File 1, File 2, File 10
            expect(sorted.map(f => f.basename)).toEqual(['File 1', 'File 2', 'File 10']);
        });
        
        it('should handle Korean filenames', () => {
            const koreanFiles = [
                createMockFile('다', 1000, 1000),
                createMockFile('가', 2000, 2000),
                createMockFile('나', 3000, 3000)
            ];
            
            const options: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            const sorted = sortManager.sort(koreanFiles, options);
            
            expect(sorted.map(f => f.basename)).toEqual(['가', '나', '다']);
        });
    });
    
    describe('sort - created criteria', () => {
        it('should sort files by creation time in ascending order', () => {
            const options: SortOptions = {
                criteria: 'created',
                order: 'asc'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // ctime 순서: Alice(1000) < Bob(2000) < Charlie(3000)
            expect(sorted.map(f => f.basename)).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        
        it('should sort files by creation time in descending order', () => {
            const options: SortOptions = {
                criteria: 'created',
                order: 'desc'
            };
            
            const sorted = sortManager.sort(files, options);
            
            expect(sorted.map(f => f.basename)).toEqual(['Charlie', 'Bob', 'Alice']);
        });
    });
    
    describe('sort - modified criteria', () => {
        it('should sort files by modification time in ascending order', () => {
            const options: SortOptions = {
                criteria: 'modified',
                order: 'asc'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // mtime 순서: Alice(1500) < Bob(2500) < Charlie(3500)
            expect(sorted.map(f => f.basename)).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        
        it('should sort files by modification time in descending order', () => {
            const options: SortOptions = {
                criteria: 'modified',
                order: 'desc'
            };
            
            const sorted = sortManager.sort(files, options);
            
            expect(sorted.map(f => f.basename)).toEqual(['Charlie', 'Bob', 'Alice']);
        });
    });
    
    describe('sort - size criteria', () => {
        it('should sort files by size in ascending order', () => {
            const options: SortOptions = {
                criteria: 'size',
                order: 'asc'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // size 순서: Alice(1000) < Bob(2000) < Charlie(3000)
            expect(sorted.map(f => f.basename)).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        
        it('should sort files by size in descending order', () => {
            const options: SortOptions = {
                criteria: 'size',
                order: 'desc'
            };
            
            const sorted = sortManager.sort(files, options);
            
            expect(sorted.map(f => f.basename)).toEqual(['Charlie', 'Bob', 'Alice']);
        });
    });
    
    describe('sort - property criteria', () => {
        beforeEach(() => {
            // Mock 프론트매터 데이터 설정
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Alice') {
                    return { frontmatter: { priority: 1, status: 'done', date: '2024-01-01' } };
                } else if (file.basename === 'Bob') {
                    return { frontmatter: { priority: 2, status: 'inProgress', date: '2024-02-01' } };
                } else if (file.basename === 'Charlie') {
                    return { frontmatter: { priority: 3, status: 'todo', date: '2024-03-01' } };
                }
                return null;
            });
        });
        
        it('should sort files by numeric property in ascending order', () => {
            const options: SortOptions = {
                criteria: 'property',
                order: 'asc',
                propertyName: 'priority'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // priority 순서: Alice(1) < Bob(2) < Charlie(3)
            expect(sorted.map(f => f.basename)).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        
        it('should sort files by string property in ascending order', () => {
            const options: SortOptions = {
                criteria: 'property',
                order: 'asc',
                propertyName: 'status'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // status 순서 (알파벳): done < inProgress < todo
            expect(sorted.map(f => f.basename)).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        
        it('should sort files by date property in ascending order', () => {
            const options: SortOptions = {
                criteria: 'property',
                order: 'asc',
                propertyName: 'date'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // date 순서: 2024-01-01 < 2024-02-01 < 2024-03-01
            expect(sorted.map(f => f.basename)).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        
        it('should place files without property at the end', () => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Alice') {
                    return { frontmatter: { priority: 1 } };
                } else if (file.basename === 'Bob') {
                    return null; // 프론트매터 없음
                } else if (file.basename === 'Charlie') {
                    return { frontmatter: {} }; // priority 속성 없음
                }
                return null;
            });
            
            const options: SortOptions = {
                criteria: 'property',
                order: 'asc',
                propertyName: 'priority'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // Alice만 priority가 있으므로 맨 앞, Bob과 Charlie는 뒤에
            expect(sorted[0].basename).toBe('Alice');
            expect(sorted.slice(1).map(f => f.basename).sort()).toEqual(['Bob', 'Charlie']);
        });
    });
    
    describe('toggleSort', () => {
        it('should toggle order when criteria is the same', () => {
            const currentOptions: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            const newOptions = sortManager.toggleSort(currentOptions, 'name');
            
            expect(newOptions).toEqual({
                criteria: 'name',
                order: 'desc'
            });
        });
        
        it('should toggle from desc to asc', () => {
            const currentOptions: SortOptions = {
                criteria: 'name',
                order: 'desc'
            };
            
            const newOptions = sortManager.toggleSort(currentOptions, 'name');
            
            expect(newOptions).toEqual({
                criteria: 'name',
                order: 'asc'
            });
        });
        
        it('should reset to asc when criteria changes', () => {
            const currentOptions: SortOptions = {
                criteria: 'name',
                order: 'desc'
            };
            
            const newOptions = sortManager.toggleSort(currentOptions, 'modified');
            
            expect(newOptions).toEqual({
                criteria: 'modified',
                order: 'asc'
            });
        });
        
        it('should preserve propertyName when changing to property criteria', () => {
            const currentOptions: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            const newOptions = sortManager.toggleSort(currentOptions, 'property');
            
            expect(newOptions.criteria).toBe('property');
            expect(newOptions.order).toBe('asc');
        });
        
        it('should preserve propertyName when toggling property criteria', () => {
            const currentOptions: SortOptions = {
                criteria: 'property',
                order: 'asc',
                propertyName: 'priority'
            };
            
            const newOptions = sortManager.toggleSort(currentOptions, 'property');
            
            expect(newOptions).toEqual({
                criteria: 'property',
                order: 'desc',
                propertyName: 'priority'
            });
        });
    });
    
    describe('edge cases', () => {
        it('should handle empty array', () => {
            const options: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            const sorted = sortManager.sort([], options);
            
            expect(sorted).toEqual([]);
        });
        
        it('should handle single file', () => {
            const singleFile = [files[0]];
            const options: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            const sorted = sortManager.sort(singleFile, options);
            
            expect(sorted).toEqual(singleFile);
        });
        
        it('should not modify original array', () => {
            const original = [...files];
            const options: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            sortManager.sort(files, options);
            
            // 원본 배열은 변경되지 않아야 함
            expect(files).toEqual(original);
        });
        
        it('should handle files with same values', () => {
            const sameNameFiles = [
                createMockFile('Same', 1000, 1000),
                createMockFile('Same', 2000, 2000),
                createMockFile('Same', 3000, 3000)
            ];
            
            const options: SortOptions = {
                criteria: 'name',
                order: 'asc'
            };
            
            const sorted = sortManager.sort(sameNameFiles, options);
            
            // 모두 같은 이름이므로 순서가 유지되거나 안정적이어야 함
            expect(sorted.length).toBe(3);
            expect(sorted.every(f => f.basename === 'Same')).toBe(true);
        });
    });
    
    describe('isDateString (via property sorting)', () => {
        beforeEach(() => {
            (mockApp.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
                if (file.basename === 'Alice') {
                    return { frontmatter: { date: '2024-01-01' } }; // 유효한 날짜
                } else if (file.basename === 'Bob') {
                    return { frontmatter: { date: '2024-13-01' } }; // 잘못된 날짜 (13월)
                } else if (file.basename === 'Charlie') {
                    return { frontmatter: { date: 'not-a-date' } }; // 날짜 형식 아님
                }
                return null;
            });
        });
        
        it('should correctly identify and sort valid date strings', () => {
            const options: SortOptions = {
                criteria: 'property',
                order: 'asc',
                propertyName: 'date'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // 유효한 날짜 문자열은 Date 객체로 변환되어 정렬됨
            // Alice는 유효한 날짜이므로 앞에 위치
            expect(sorted[0].basename).toBe('Alice');
        });
        
        it('should handle invalid date strings as regular strings', () => {
            const options: SortOptions = {
                criteria: 'property',
                order: 'asc',
                propertyName: 'date'
            };
            
            const sorted = sortManager.sort(files, options);
            
            // 잘못된 날짜와 날짜가 아닌 문자열은 문자열로 정렬됨
            expect(sorted.length).toBe(3);
        });
    });
});
