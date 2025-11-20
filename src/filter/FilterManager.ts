import { TFile, App } from 'obsidian';
import { FilterOptions } from '../types';

/**
 * FilterManager 클래스
 * 
 * 주요 기능:
 * - 태그 필터링
 * - 날짜 범위 필터링 (생성일, 수정일)
 * - 프론트매터 속성 필터링
 * - 경로 필터링
 * 
 * 사용 예:
 * ```typescript
 * const filterManager = new FilterManager(app);
 * const filtered = filterManager.applyFilters(files, {
 *   tags: ['important'],
 *   createdAfter: new Date('2024-01-01'),
 *   properties: { status: '완료' }
 * });
 * ```
 */
export class FilterManager {
    private app: App;
    
    /**
     * 생성자
     * 
     * @param app - Obsidian App 인스턴스
     */
    constructor(app: App) {
        this.app = app;
    }
    
    /**
     * 모든 필터를 적용합니다
     * 
     * FilterOptions의 각 조건을 순차적으로 적용하여
     * 모든 조건을 만족하는 파일만 반환합니다.
     * 
     * @param files - 필터링할 파일 배열
     * @param options - 필터 옵션
     * @returns 필터링된 파일 배열
     */
    applyFilters(files: TFile[], options: FilterOptions): TFile[] {
        let filtered = files;
        
        // 태그 필터 적용
        if (options.tags && options.tags.length > 0) {
            filtered = this.filterByTags(filtered, options.tags);
        }
        
        // 생성일 필터 적용
        if (options.createdAfter || options.createdBefore) {
            filtered = this.filterByCreatedDate(
                filtered,
                options.createdAfter,
                options.createdBefore
            );
        }
        
        // 수정일 필터 적용
        if (options.modifiedAfter || options.modifiedBefore) {
            filtered = this.filterByModifiedDate(
                filtered,
                options.modifiedAfter,
                options.modifiedBefore
            );
        }
        
        // 프론트매터 속성 필터 적용
        if (options.properties && Object.keys(options.properties).length > 0) {
            filtered = this.filterByProperties(filtered, options.properties);
        }
        
        // 경로 필터 적용
        if (options.path) {
            filtered = this.filterByPath(filtered, options.path);
        }
        
        return filtered;
    }
    
    /**
     * 태그로 필터링합니다
     * 
     * 지정된 태그를 하나라도 포함하는 파일만 반환합니다.
     * (OR 연산)
     * 
     * 태그는 다음 위치에서 추출됩니다:
     * - 프론트매터의 tags 필드
     * - 본문의 인라인 태그 (#태그)
     * 
     * @param files - 필터링할 파일 배열
     * @param tags - 필터링할 태그 배열
     * @returns 태그를 포함하는 파일 배열
     */
    filterByTags(files: TFile[], tags: string[]): TFile[] {
        return files.filter(file => {
            const fileTags = this.getFileTags(file);
            
            // 지정된 태그를 하나라도 포함하면 true
            return tags.some(tag => 
                fileTags.some(fileTag => 
                    fileTag.toLowerCase() === tag.toLowerCase()
                )
            );
        });
    }
    
    /**
     * 파일의 모든 태그를 가져옵니다
     * 
     * @param file - 태그를 추출할 파일
     * @returns 태그 배열
     */
    private getFileTags(file: TFile): string[] {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return [];
        
        const tags: string[] = [];
        
        // 프론트매터 태그
        if (cache.frontmatter?.tags) {
            const frontmatterTags = cache.frontmatter.tags;
            if (Array.isArray(frontmatterTags)) {
                tags.push(...frontmatterTags);
            } else if (typeof frontmatterTags === 'string') {
                tags.push(frontmatterTags);
            }
        }
        
        // 인라인 태그
        if (cache.tags) {
            cache.tags.forEach(tagCache => {
                // tag는 '#태그' 형태이므로 # 제거
                const tag = tagCache.tag.replace(/^#/, '');
                tags.push(tag);
            });
        }
        
        return tags;
    }
    
    /**
     * 생성일로 필터링합니다
     * 
     * @param files - 필터링할 파일 배열
     * @param after - 시작일 (이 날짜 이후)
     * @param before - 종료일 (이 날짜 이전)
     * @returns 날짜 범위 내의 파일 배열
     */
    filterByCreatedDate(
        files: TFile[],
        after?: Date,
        before?: Date
    ): TFile[] {
        return files.filter(file => {
            const createdTime = file.stat.ctime;
            
            if (after && createdTime < after.getTime()) {
                return false;
            }
            
            if (before && createdTime > before.getTime()) {
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * 수정일로 필터링합니다
     * 
     * @param files - 필터링할 파일 배열
     * @param after - 시작일 (이 날짜 이후)
     * @param before - 종료일 (이 날짜 이전)
     * @returns 날짜 범위 내의 파일 배열
     */
    filterByModifiedDate(
        files: TFile[],
        after?: Date,
        before?: Date
    ): TFile[] {
        return files.filter(file => {
            const modifiedTime = file.stat.mtime;
            
            if (after && modifiedTime < after.getTime()) {
                return false;
            }
            
            if (before && modifiedTime > before.getTime()) {
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * 프론트매터 속성으로 필터링합니다
     * 
     * 지정된 모든 속성이 일치하는 파일만 반환합니다.
     * (AND 연산)
     * 
     * 예시:
     * ```typescript
     * filterByProperties(files, {
     *   status: '완료',
     *   priority: 'high'
     * });
     * ```
     * 
     * @param files - 필터링할 파일 배열
     * @param properties - 필터링할 속성 (key: value)
     * @returns 속성이 일치하는 파일 배열
     */
    filterByProperties(
        files: TFile[],
        properties: Record<string, any>
    ): TFile[] {
        return files.filter(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache?.frontmatter) return false;
            
            // frontmatter를 변수에 할당하여 TypeScript 타입 체크 통과
            const frontmatter = cache.frontmatter;
            
            // 모든 속성이 일치해야 함 (AND)
            return Object.entries(properties).every(([key, value]) => {
                const fileValue = frontmatter[key];
                
                // 값 비교 (대소문자 무시)
                if (typeof fileValue === 'string' && typeof value === 'string') {
                    return fileValue.toLowerCase() === value.toLowerCase();
                }
                
                return fileValue === value;
            });
        });
    }
    
    /**
     * 경로로 필터링합니다
     * 
     * 지정된 경로를 포함하는 파일만 반환합니다.
     * 
     * @param files - 필터링할 파일 배열
     * @param path - 필터링할 경로
     * @returns 경로를 포함하는 파일 배열
     */
    filterByPath(files: TFile[], path: string): TFile[] {
        return files.filter(file => 
            file.path.includes(path)
        );
    }
    
    /**
     * 빈 필터 옵션을 생성합니다
     * 
     * @returns 빈 FilterOptions 객체
     */
    static createEmptyFilter(): FilterOptions {
        return {
            tags: [],
            properties: {}
        };
    }
}
