import { TFile, App } from 'obsidian';
import { CardGroup, GroupingSettings, TagGroupMode, DateGroupBasis } from '../types';
import { DebugLogger } from '../utils/DebugLogger';
import { GroupStateManager } from './GroupStateManager';
import { PinManager } from './PinManager';

/**
 * 파일을 그룹으로 나누는 관리자
 *
 * 다양한 기준으로 파일 목록을 그룹화하고,
 * 그룹 정렬 및 접힌 상태 관리를 담당합니다.
 *
 * ⭐ Section 3.3: PinManager 통합
 * - 핀 파일 분리 로직을 PinManager로 위임
 * - 중복 코드 제거 및 성능 향상
 */
export class GroupingManager {
    private app: App;
    private logger: DebugLogger;
    /** ⭐ Phase 2: 그룹 상태 배치 처리 관리자 */
    private stateManager: GroupStateManager;

    constructor(app: App, getSettings: () => import('../types').CardNavigatorSettings) {
        this.app = app;
        this.logger = new DebugLogger(getSettings);
        this.stateManager = new GroupStateManager();
        this.stateManager.loadAll(); // ⭐ 초기화 시 일괄 로드
    }

    /**
     * GroupStateManager 인스턴스를 가져옵니다
     */
    getStateManager(): GroupStateManager {
        return this.stateManager;
    }

    /**
     * 파일 목록을 그룹으로 나눕니다
     *
     * @param files - 그룹화할 파일 목록
     * @param settings - 그룹화 설정
     * @param pinnedFiles - 핀된 파일 경로 목록 (선택사항)
     * @returns 그룹 배열
     */
    groupFiles(files: TFile[], settings: GroupingSettings, pinnedFiles?: string[]): CardGroup[] {
        if (!settings.enabled || settings.criteria === 'none') {
            // 그룹화 비활성화 시 전체를 하나의 그룹으로 (헤더 숨김)
            return [{
                id: 'all',
                name: '',
                fullPath: '',
                icon: '',
                files: files,
                collapsed: false,
                sortKey: 'all',
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: files.length
            }];
        }

        let groups: CardGroup[] = [];

        this.logger.debug('Grouping', `Grouping ${files.length} files by ${settings.criteria}`);

		// ⭐ Section 3.3: PinManager를 사용한 핀/일반 파일 분리
        let pinnedFileObjects: TFile[] = [];
        let unpinnedFiles = files;

        if (settings.showPinnedAsGroup && pinnedFiles && pinnedFiles.length > 0) {
			const pinManager = new PinManager(pinnedFiles);
			const partition = pinManager.partitionFiles(files);
            pinnedFileObjects = partition.pinned;
            unpinnedFiles = partition.normal;

            this.logger.debug('Grouping', `Separated ${pinnedFileObjects.length} pinned files and ${unpinnedFiles.length} unpinned files`);
        }

        switch (settings.criteria) {
            case 'folder':
                groups = this.groupByFolder(unpinnedFiles, settings.folderHierarchical);
                break;
            case 'tag':
                groups = this.groupByTag(unpinnedFiles, settings.tagMode);
                break;
            case 'date-year':
                groups = this.groupByDateYear(unpinnedFiles, settings.dateBasis);
                break;
            case 'date-month':
                groups = this.groupByDateMonth(unpinnedFiles, settings.dateBasis);
                break;
            case 'date-week':
                groups = this.groupByDateWeek(unpinnedFiles, settings.dateBasis);
                break;
            case 'property':
                groups = this.groupByProperty(unpinnedFiles, settings.propertyName || '');
                break;
            case 'size':
                groups = this.groupBySize(unpinnedFiles);
                break;
            case 'first-letter':
                groups = this.groupByFirstLetter(unpinnedFiles);
                break;
        }

        // 핀된 파일 그룹 추가 (맨 앞에)
        if (settings.showPinnedAsGroup && pinnedFileObjects.length > 0) {
            const pinnedGroup: CardGroup = {
                id: 'pinned',
                name: 'Pinned',
                fullPath: '',
                icon: 'pin',
                files: pinnedFileObjects,
                collapsed: false,
                sortKey: '000-pinned', // 항상 맨 앞에 오도록
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: pinnedFileObjects.length
            };
            groups.unshift(pinnedGroup);

            this.logger.debug('Grouping', `Added pinned group with ${pinnedFileObjects.length} files`);
        }

        // 그룹 정렬
        this.sortGroups(groups, settings);

        // 접힌 상태 복원
        this.restoreCollapsedState(groups);

        this.logger.debug('Grouping', `Created ${groups.length} groups`);

        return groups;
    }

    /**
     * 폴더별로 그룹화합니다
     */
    private groupByFolder(files: TFile[], hierarchical: boolean): CardGroup[] {
        const folderMap = new Map<string, TFile[]>();

        for (const file of files) {
            const folderPath = file.parent?.path || '/';

            if (!folderMap.has(folderPath)) {
                folderMap.set(folderPath, []);
            }
            folderMap.get(folderPath)!.push(file);
        }

        const groups: CardGroup[] = [];

        for (const [folderPath, folderFiles] of folderMap.entries()) {
            const parts = folderPath === '/' ? [] : folderPath.split('/').filter(p => p);
            const folderName = folderPath === '/'
                ? 'Root'
                : (hierarchical ? folderPath : parts[parts.length - 1] || folderPath);
            const level = folderPath === '/' ? 0 : parts.length - 1;

            // 부모 경로 계산
            let parentPath: string | null = null;
            if (parts.length > 1) {
                parentPath = parts.slice(0, -1).join('/');
            } else if (parts.length === 1) {
                parentPath = '/';
            }

            groups.push({
                id: `folder-${folderPath}`,
                name: folderName,
                fullPath: folderPath,
                icon: 'folder',
                files: folderFiles,
                collapsed: false,
                sortKey: folderName,
                level,
                parentId: parentPath ? `folder-${parentPath}` : null,
                children: [],
                totalFileCount: folderFiles.length
            });
        }

        return groups;
    }

    /**
     * 태그별로 그룹화합니다
     */
    private groupByTag(files: TFile[], mode: TagGroupMode): CardGroup[] {
        const tagMap = new Map<string, TFile[]>();
        let untaggedCount = 0;
        let cacheNotReadyCount = 0;

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);

            // ⭐ 캐시가 준비되지 않은 경우 감지
            if (!cache) {
                cacheNotReadyCount++;
                this.logger.debug('Grouping', `Cache not ready for file: ${file.path}`);
                // 캐시가 없으면 임시로 untagged로 분류 (나중에 재렌더링됨)
                if (!tagMap.has('__untagged__')) {
                    tagMap.set('__untagged__', []);
                }
                tagMap.get('__untagged__')!.push(file);
                continue;
            }

            // 본문 태그 (#tag 형식)
            const inlineTags = cache?.tags?.map(t => t.tag.replace(/^#/, '')) || [];

            // 프론트매터 태그 (tags: [...] 형식)
            let frontmatterTags: string[] = [];
            if (cache?.frontmatter?.tags) {
                const fmTags = cache.frontmatter.tags;
                if (Array.isArray(fmTags)) {
                    frontmatterTags = fmTags.map(t => String(t).replace(/^#/, ''));
                } else if (typeof fmTags === 'string') {
                    frontmatterTags = [fmTags.replace(/^#/, '')];
                }
            }

            // 두 가지 태그를 합침 (중복 제거)
            const allTags = Array.from(new Set([...inlineTags, ...frontmatterTags]));

            this.logger.debug('Grouping', `Tag detection for file: ${file.path}`, {
                hasCache: cache !== null && cache !== undefined,
                inlineTags: inlineTags,
                frontmatterTags: frontmatterTags,
                allTags: allTags,
                tagCount: allTags.length
            });

            if (allTags.length === 0) {
                // 태그 없는 파일
                untaggedCount++;
                if (!tagMap.has('__untagged__')) {
                    tagMap.set('__untagged__', []);
                }
                tagMap.get('__untagged__')!.push(file);
            } else {
                const tagsToUse = mode === 'first' ? [allTags[0]] : allTags;

                for (const tag of tagsToUse) {
                    if (!tagMap.has(tag)) {
                        tagMap.set(tag, []);
                    }
                    tagMap.get(tag)!.push(file);
                }
            }
        }

        // ⭐ 캐시가 준비되지 않은 파일이 있으면 경고
        if (cacheNotReadyCount > 0) {
            this.logger.debug('Grouping', `Warning: ${cacheNotReadyCount} files have no cache ready. They will be re-grouped when cache is available.`);
        }

        this.logger.debug('Grouping', 'Tag grouping summary', {
            totalFiles: files.length,
            untaggedCount,
            uniqueTags: tagMap.size,
            tags: Array.from(tagMap.keys())
        });

        const groups: CardGroup[] = [];

        for (const [tag, tagFiles] of tagMap.entries()) {
            const isUntagged = tag === '__untagged__';
            const parts = tag.split('/');
            const level = isUntagged ? 0 : parts.length - 1;

            // 부모 태그 계산
            let parentTag: string | null = null;
            if (!isUntagged && parts.length > 1) {
                parentTag = parts.slice(0, -1).join('/');
            }

            groups.push({
                id: `tag-${tag}`,
                name: isUntagged ? 'Untagged' : tag,
                fullPath: tag,
                icon: 'tag',
                files: tagFiles,
                collapsed: false,
                sortKey: isUntagged ? 'zzz-untagged' : tag,
                level,
                parentId: parentTag ? `tag-${parentTag}` : null,
                children: [],
                totalFileCount: tagFiles.length
            });
        }

        return groups;
    }

    /**
     * 연도별로 그룹화합니다
     */
    private groupByDateYear(files: TFile[], basis: DateGroupBasis): CardGroup[] {
        const yearMap = new Map<number, TFile[]>();

        for (const file of files) {
            const timestamp = basis === 'created' ? file.stat.ctime : file.stat.mtime;
            const date = new Date(timestamp);
            const year = date.getFullYear();

            if (!yearMap.has(year)) {
                yearMap.set(year, []);
            }
            yearMap.get(year)!.push(file);
        }

        const groups: CardGroup[] = [];

        for (const [year, yearFiles] of yearMap.entries()) {
            groups.push({
                id: `year-${year}`,
                name: `${year}`,
                fullPath: `${year}`,
                icon: 'calendar',
                files: yearFiles,
                collapsed: false,
                sortKey: year,
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: yearFiles.length
            });
        }

        return groups;
    }

    /**
     * 월별로 그룹화합니다
     */
    private groupByDateMonth(files: TFile[], basis: DateGroupBasis): CardGroup[] {
        const monthMap = new Map<string, TFile[]>();

        for (const file of files) {
            const timestamp = basis === 'created' ? file.stat.ctime : file.stat.mtime;
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const key = `${year}-${month}`;

            if (!monthMap.has(key)) {
                monthMap.set(key, []);
            }
            monthMap.get(key)!.push(file);
        }

        const groups: CardGroup[] = [];

        for (const [monthKey, monthFiles] of monthMap.entries()) {
            const [year, month] = monthKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

            groups.push({
                id: `month-${monthKey}`,
                name: monthName,
                fullPath: monthKey,
                icon: 'calendar',
                files: monthFiles,
                collapsed: false,
                sortKey: monthKey,
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: monthFiles.length
            });
        }

        return groups;
    }

    /**
     * 주별로 그룹화합니다
     */
    private groupByDateWeek(files: TFile[], basis: DateGroupBasis): CardGroup[] {
        const weekMap = new Map<string, TFile[]>();

        for (const file of files) {
            const timestamp = basis === 'created' ? file.stat.ctime : file.stat.mtime;
            const date = new Date(timestamp);
            const weekNumber = this.getWeekNumber(date);
            const year = date.getFullYear();
            const key = `${year}-W${weekNumber}`;

            if (!weekMap.has(key)) {
                weekMap.set(key, []);
            }
            weekMap.get(key)!.push(file);
        }

        const groups: CardGroup[] = [];

        for (const [weekKey, weekFiles] of weekMap.entries()) {
            groups.push({
                id: `week-${weekKey}`,
                name: weekKey.replace('-W', ' Week '),
                fullPath: weekKey,
                icon: 'calendar',
                files: weekFiles,
                collapsed: false,
                sortKey: weekKey,
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: weekFiles.length
            });
        }

        return groups;
    }

    /**
     * ISO 주 번호를 계산합니다
     */
    private getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    /**
     * 프론트매터 속성별로 그룹화합니다
     */
    private groupByProperty(files: TFile[], propertyName: string): CardGroup[] {
        if (!propertyName) {
            // 속성명이 없으면 전체를 하나의 그룹으로
            return [{
                id: 'all',
                name: 'All Files (No Property Specified)',
                fullPath: '',
                icon: 'file-text',
                files: files,
                collapsed: false,
                sortKey: 'all',
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: files.length
            }];
        }

        const propertyMap = new Map<string, TFile[]>();
        let cacheNotReadyCount = 0;

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);

            // ⭐ 캐시가 준비되지 않은 경우 감지
            if (!cache) {
                cacheNotReadyCount++;
                this.logger.debug('Grouping', `Cache not ready for property grouping: ${file.path}`);
            }

            const value = cache?.frontmatter?.[propertyName];

            let key: string;
            if (value === undefined || value === null) {
                key = `__no_${propertyName}__`;
            } else if (Array.isArray(value)) {
                key = value.join(', ');
            } else {
                key = String(value);
            }

            if (!propertyMap.has(key)) {
                propertyMap.set(key, []);
            }
            propertyMap.get(key)!.push(file);
        }

        // ⭐ 캐시가 준비되지 않은 파일이 있으면 경고
        if (cacheNotReadyCount > 0) {
            this.logger.debug('Grouping', `Warning: ${cacheNotReadyCount} files have no cache ready for property grouping.`);
        }

        const groups: CardGroup[] = [];

        for (const [propValue, propFiles] of propertyMap.entries()) {
            const isNoProperty = propValue.startsWith('__no_');

            groups.push({
                id: `property-${propertyName}-${propValue}`,
                name: isNoProperty ? `No ${propertyName}` : propValue,
                fullPath: propValue,
                icon: isNoProperty ? 'help-circle' : 'file-text',
                files: propFiles,
                collapsed: false,
                sortKey: isNoProperty ? 'zzz-no-property' : propValue,
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: propFiles.length
            });
        }

        return groups;
    }

    /**
     * 파일 크기별로 그룹화합니다
     */
    private groupBySize(files: TFile[]): CardGroup[] {
        const sizeGroups: { [key: string]: TFile[] } = {
            small: [],
            medium: [],
            large: []
        };

        for (const file of files) {
            const sizeKB = file.stat.size / 1024;

            if (sizeKB < 10) {
                sizeGroups.small.push(file);
            } else if (sizeKB < 100) {
                sizeGroups.medium.push(file);
            } else {
                sizeGroups.large.push(file);
            }
        }

        const groups: CardGroup[] = [];

        if (sizeGroups.small.length > 0) {
            groups.push({
                id: 'size-small',
                name: 'Small (< 10KB)',
                fullPath: 'small',
                icon: 'file',
                files: sizeGroups.small,
                collapsed: false,
                sortKey: 1,
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: sizeGroups.small.length
            });
        }

        if (sizeGroups.medium.length > 0) {
            groups.push({
                id: 'size-medium',
                name: 'Medium (10-100KB)',
                fullPath: 'medium',
                icon: 'file-text',
                files: sizeGroups.medium,
                collapsed: false,
                sortKey: 2,
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: sizeGroups.medium.length
            });
        }

        if (sizeGroups.large.length > 0) {
            groups.push({
                id: 'size-large',
                name: 'Large (> 100KB)',
                fullPath: 'large',
                icon: 'files',
                files: sizeGroups.large,
                collapsed: false,
                sortKey: 3,
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: sizeGroups.large.length
            });
        }

        return groups;
    }

    /**
     * 첫 글자별로 그룹화합니다
     */
    private groupByFirstLetter(files: TFile[]): CardGroup[] {
        const letterMap = new Map<string, TFile[]>();

        for (const file of files) {
            const firstChar = file.basename.charAt(0).toUpperCase();
            let key: string;

            if (/[0-9]/.test(firstChar)) {
                key = '0-9';
            } else if (/[A-Z]/.test(firstChar)) {
                key = firstChar;
            } else if (/[ㄱ-ㅎ가-힣]/.test(firstChar)) {
                // 한글: 초성 추출
                key = this.getKoreanInitial(firstChar);
            } else {
                key = 'Other';
            }

            if (!letterMap.has(key)) {
                letterMap.set(key, []);
            }
            letterMap.get(key)!.push(file);
        }

        const groups: CardGroup[] = [];

        for (const [letter, letterFiles] of letterMap.entries()) {
            groups.push({
                id: `letter-${letter}`,
                name: letter === '0-9' ? '0-9' : letter === 'Other' ? 'Other' : letter,
                fullPath: letter,
                icon: letter === '0-9' ? 'hash' : letter === 'Other' ? 'asterisk' : 'type',
                files: letterFiles,
                collapsed: false,
                sortKey: letter === '0-9' ? '000' : letter === 'Other' ? 'zzz' : letter,
                level: 0,
                parentId: null,
                children: [],
                totalFileCount: letterFiles.length
            });
        }

        return groups;
    }

    /**
     * 한글 문자의 초성을 추출합니다
     */
    private getKoreanInitial(char: string): string {
        const charCode = char.charCodeAt(0);

        // 한글 완성형 범위: 0xAC00 ~ 0xD7A3
        if (charCode >= 0xAC00 && charCode <= 0xD7A3) {
            const initials = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
            const initialIndex = Math.floor((charCode - 0xAC00) / 588);
            return initials[initialIndex];
        }

        // 초성 자체인 경우: 0x3131 ~ 0x314E
        if (charCode >= 0x3131 && charCode <= 0x314E) {
            return char;
        }

        return 'Other';
    }

    /**
     * 그룹을 정렬합니다
     */
    private sortGroups(groups: CardGroup[], settings: GroupingSettings): void {
        groups.sort((a, b) => {
            // 핀된 그룹은 항상 맨 위에 (정렬 규칙 무시)
            if (a.id === 'pinned') return -1;
            if (b.id === 'pinned') return 1;

            let comparison = 0;

            switch (settings.groupSort) {
                case 'name':
                    comparison = String(a.sortKey).localeCompare(String(b.sortKey), undefined, {
                        sensitivity: 'base',
                        numeric: true
                    });
                    break;
                case 'file-count':
                    comparison = a.files.length - b.files.length;
                    break;
                case 'latest-file': {
                    const latestA = Math.max(...a.files.map(f => f.stat.mtime));
                    const latestB = Math.max(...b.files.map(f => f.stat.mtime));
                    comparison = latestA - latestB;
                    break;
                }
                case 'hierarchy':
                    comparison = this.compareByHierarchy(a, b, settings.criteria);
                    break;
            }

            return settings.groupSortOrder === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * 계층 구조에 따라 그룹을 비교합니다
     */
    private compareByHierarchy(a: CardGroup, b: CardGroup, criteria: string): number {
        if (criteria === 'folder') {
            return this.compareFolderHierarchy(a, b);
        } else if (criteria === 'tag') {
            return this.compareTagHierarchy(a, b);
        }
        // 다른 기준에서는 이름으로 폴백
        return String(a.sortKey).localeCompare(String(b.sortKey), undefined, {
            sensitivity: 'base',
            numeric: true
        });
    }

    /**
     * 폴더 계층 구조로 비교합니다 (상위 폴더가 먼저)
     */
    private compareFolderHierarchy(a: CardGroup, b: CardGroup): number {
        // folder-{path} 형식에서 경로 추출
        const pathA = a.id.replace('folder-', '');
        const pathB = b.id.replace('folder-', '');

        // 루트 폴더 처리
        if (pathA === '/') return -1;
        if (pathB === '/') return 1;

        // 경로를 /로 분할하여 깊이 계산
        const depthA = pathA.split('/').filter(p => p).length;
        const depthB = pathB.split('/').filter(p => p).length;

        // 깊이가 다르면 얕은 것이 먼저 (상위 폴더가 먼저)
        if (depthA !== depthB) {
            return depthA - depthB;
        }

        // 깊이가 같으면 경로를 알파벳순으로 비교
        return pathA.localeCompare(pathB, undefined, {
            sensitivity: 'base',
            numeric: true
        });
    }

    /**
     * 태그 계층 구조로 비교합니다 (상위 태그가 먼저)
     * 예: #project, #project/frontend, #project/backend
     */
    private compareTagHierarchy(a: CardGroup, b: CardGroup): number {
        // tag-{tagname} 형식에서 태그 이름 추출
        const tagA = a.name.replace('#', '');
        const tagB = b.name.replace('#', '');

        // Untagged는 항상 마지막
        if (tagA === 'Untagged') return 1;
        if (tagB === 'Untagged') return -1;

        // /로 분할하여 계층 깊이 계산
        const depthA = tagA.split('/').length;
        const depthB = tagB.split('/').length;

        // 한 태그가 다른 태그의 접두사인지 확인
        if (tagB.startsWith(tagA + '/')) {
            // B가 A의 하위 태그 -> A가 먼저
            return -1;
        }
        if (tagA.startsWith(tagB + '/')) {
            // A가 B의 하위 태그 -> B가 먼저
            return 1;
        }

        // 깊이가 다르면 얕은 것이 먼저 (상위 태그가 먼저)
        if (depthA !== depthB) {
            return depthA - depthB;
        }

        // 깊이가 같고 상하위 관계가 아니면 알파벳순
        return tagA.localeCompare(tagB, undefined, {
            sensitivity: 'base',
            numeric: true
        });
    }

    /**
     * ⭐ localStorage에서 접힌 상태를 복원합니다 (Phase 2: 캐시에서 일괄 조회)
     */
    private restoreCollapsedState(groups: CardGroup[]): void {
        groups.forEach(group => {
            group.collapsed = this.stateManager.getCollapsed(group.id);
        });
    }

    /**
     * ⭐ 접힌 상태를 저장합니다 (Phase 2: 디바운스된 일괄 저장)
     */
    saveCollapsedState(groupId: string, collapsed: boolean): void {
        this.stateManager.setCollapsed(groupId, collapsed);
        this.logger.debug('Grouping', `Saved collapsed state for ${groupId}: ${collapsed}`);
    }

    /**
     * ⭐ 모든 그룹을 펼칩니다 (Phase 2: 배치 저장)
     */
    expandAllGroups(groups: CardGroup[]): void {
        const states = groups.map(group => {
            group.collapsed = false;
            return { groupId: group.id, collapsed: false };
        });
        this.stateManager.setBatch(states);
    }

    /**
     * ⭐ 모든 그룹을 접습니다 (Phase 2: 배치 저장)
     */
    collapseAllGroups(groups: CardGroup[]): void {
        const states = groups.map(group => {
            group.collapsed = true;
            return { groupId: group.id, collapsed: true };
        });
        this.stateManager.setBatch(states);
    }

    /**
     * ⭐ 상태 관리자 플러시 (플러그인 종료 시 호출)
     */
    flush(): void {
        this.stateManager.flush();
    }

    /**
     * 볼트의 전체 폴더 목록을 계층 구조로 반환합니다
     *
     * @remarks
     * ⭐ Phase 3 최적화: hasChildren 계산을 O(n²) → O(n)으로 개선
     * - 기존: 각 폴더마다 전체 폴더 목록 순회
     * - 개선: 사전에 hasChildrenMap 구축 후 O(1) 조회
     *
     * @returns 폴더 경로와 마크다운 파일 수를 포함한 배열
     */
    getAllFolders(): { path: string; name: string; fileCount: number; level: number; hasChildren: boolean; parentId: string | null }[] {
        const folderMap = new Map<string, number>();
        const allFolderPaths = new Set<string>();

        // 모든 마크다운 파일의 폴더를 수집
        const markdownFiles = this.app.vault.getMarkdownFiles();
        for (const file of markdownFiles) {
            const folderPath = file.parent?.path || '/';
            folderMap.set(folderPath, (folderMap.get(folderPath) || 0) + 1);
            allFolderPaths.add(folderPath);

            // 중간 폴더들도 모두 추가 (계층 구조 유지를 위해)
            if (folderPath !== '/') {
                const parts = folderPath.split('/');
                for (let i = 1; i < parts.length; i++) {
                    const intermediatePath = parts.slice(0, i).join('/');
                    if (intermediatePath && !allFolderPaths.has(intermediatePath)) {
                        allFolderPaths.add(intermediatePath);
                        if (!folderMap.has(intermediatePath)) {
                            folderMap.set(intermediatePath, 0);
                        }
                    }
                }
            }
        }

        // ⭐ Phase 3 최적화: hasChildrenMap 사전 구축 (O(n))
        const hasChildrenMap = new Set<string>();
        for (const folderPath of allFolderPaths) {
            if (folderPath === '/') continue;

            const parts = folderPath.split('/').filter(p => p);
            if (parts.length > 1) {
                // 부모 경로가 자식을 가짐
                const parentPath = parts.slice(0, -1).join('/');
                hasChildrenMap.add(parentPath);
            } else if (parts.length === 1) {
                // 루트가 자식을 가짐
                hasChildrenMap.add('/');
            }
        }

        // 폴더 목록을 배열로 변환하고 정렬
        const folders: { path: string; name: string; fileCount: number; level: number; hasChildren: boolean; parentId: string | null }[] = [];

        for (const [folderPath, fileCount] of folderMap.entries()) {
            const parts = folderPath === '/' ? [] : folderPath.split('/').filter(p => p);
            const name = folderPath === '/' ? 'Root' : parts[parts.length - 1] || folderPath;
            const level = parts.length > 0 ? parts.length - 1 : 0;

            // 부모 경로 계산
            let parentPath: string | null = null;
            if (parts.length > 1) {
                parentPath = parts.slice(0, -1).join('/');
            } else if (parts.length === 1) {
                parentPath = '/';
            }

            // ⭐ Phase 3 최적화: O(1) 조회
            const hasChildren = hasChildrenMap.has(folderPath);

            folders.push({
                path: folderPath,
                name,
                fileCount,
                level,
                hasChildren,
                parentId: parentPath ? `folder-${parentPath}` : null
            });
        }

        // 경로별로 오름차순 정렬
        folders.sort((a, b) => a.path.localeCompare(b.path));

        return folders;
    }

    /**
     * 볼트의 전체 태그 목록을 계층 구조로 반환합니다
     *
     * @remarks
     * ⭐ Phase 3 최적화: hasChildren 계산을 O(n²) → O(n)으로 개선
     * - 기존: 각 태그마다 전체 태그 목록 순회
     * - 개선: 사전에 hasChildrenMap 구축 후 O(1) 조회
     *
     * @returns 태그와 사용 횟수를 포함한 배열
     */
    getAllTags(): { tag: string; name: string; fileCount: number; level: number; hasChildren: boolean; parentId: string | null }[] {
        const tagMap = new Map<string, Set<string>>();
        const allTagPaths = new Set<string>();

        // 모든 마크다운 파일의 태그를 수집
        const markdownFiles = this.app.vault.getMarkdownFiles();
        for (const file of markdownFiles) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache) continue;

            const tags: string[] = [];

            // frontmatter 태그
            if (cache.frontmatter?.tags) {
                const fmTags = cache.frontmatter.tags;
                if (Array.isArray(fmTags)) {
                    // null, undefined, 빈 문자열 필터링
                    tags.push(...fmTags
                        .filter((t): t is string => typeof t === 'string' && t.length > 0)
                        .map((t: string) => t.startsWith('#') ? t.slice(1) : t));
                } else if (typeof fmTags === 'string' && fmTags.length > 0) {
                    tags.push(fmTags.startsWith('#') ? fmTags.slice(1) : fmTags);
                }
            }

            // 인라인 태그
            if (cache.tags) {
                tags.push(...cache.tags.map(t => t.tag.slice(1))); // # 제거
            }

            // 태그별 파일 수 집계 및 중간 태그 추가
            for (const tag of tags) {
                if (!tagMap.has(tag)) {
                    tagMap.set(tag, new Set());
                }
                tagMap.get(tag)!.add(file.path);
                allTagPaths.add(tag);

                // 중간 태그들도 모두 추가 (계층 구조 유지를 위해)
                const parts = tag.split('/');
                for (let i = 1; i < parts.length; i++) {
                    const intermediateTag = parts.slice(0, i).join('/');
                    if (intermediateTag && !allTagPaths.has(intermediateTag)) {
                        allTagPaths.add(intermediateTag);
                        if (!tagMap.has(intermediateTag)) {
                            tagMap.set(intermediateTag, new Set());
                        }
                    }
                }
            }
        }

        // ⭐ Phase 3 최적화: hasChildrenMap 사전 구축 (O(n))
        const hasChildrenMap = new Set<string>();
        for (const tag of allTagPaths) {
            const parts = tag.split('/');
            if (parts.length > 1) {
                // 부모 태그가 자식을 가짐
                const parentTag = parts.slice(0, -1).join('/');
                hasChildrenMap.add(parentTag);
            }
        }

        // 태그 목록을 배열로 변환하고 정렬
        const tagsArray: { tag: string; name: string; fileCount: number; level: number; hasChildren: boolean; parentId: string | null }[] = [];

        for (const [tag, files] of tagMap.entries()) {
            const parts = tag.split('/');
            const name = parts[parts.length - 1];
            const level = parts.length - 1;

            // 부모 태그 계산
            let parentTag: string | null = null;
            if (parts.length > 1) {
                parentTag = parts.slice(0, -1).join('/');
            }

            // ⭐ Phase 3 최적화: O(1) 조회
            const hasChildren = hasChildrenMap.has(tag);

            tagsArray.push({
                tag,
                name,
                fileCount: files.size,
                level,
                hasChildren,
                parentId: parentTag ? `tag-${parentTag}` : null
            });
        }

        // 태그별로 오름차순 정렬
        tagsArray.sort((a, b) => a.tag.localeCompare(b.tag));

        return tagsArray;
    }

    /**
     * 플랫 그룹 목록을 계층 구조로 변환합니다
     *
     * @remarks
     * Phase 3: 폴더나 태그 그룹을 트리 구조로 변환합니다.
     * - parentId를 기반으로 부모-자식 관계를 설정
     * - children 배열에 자식 그룹을 추가
     * - totalFileCount를 재귀적으로 계산
     *
     * @param groups - 플랫 그룹 배열
     * @returns 계층 구조를 가진 루트 그룹 배열
     */
    buildHierarchy(groups: CardGroup[]): CardGroup[] {
        // 그룹 ID -> 그룹 맵 생성
        const groupMap = new Map<string, CardGroup>();
        for (const group of groups) {
            // children 배열 초기화
            group.children = [];
            groupMap.set(group.id, group);
        }

        // 루트 그룹들 (parentId가 null이거나 부모가 존재하지 않는 그룹)
        const rootGroups: CardGroup[] = [];

        // 부모-자식 관계 설정
        for (const group of groups) {
            if (group.parentId === null) {
                // 루트 그룹
                rootGroups.push(group);
            } else {
                const parent = groupMap.get(group.parentId);
                if (parent) {
                    // 부모가 있으면 자식으로 추가
                    parent.children.push(group);
                } else {
                    // 부모가 없으면 루트로 처리 (중간 폴더가 없는 경우)
                    rootGroups.push(group);
                }
            }
        }

        // totalFileCount 재귀 계산
        this.calculateTotalFileCounts(rootGroups);

        this.logger.debug('Grouping', `Built hierarchy: ${rootGroups.length} root groups from ${groups.length} total groups`);

        return rootGroups;
    }

    /**
     * 계층 구조의 totalFileCount를 재귀적으로 계산합니다
     *
     * @param groups - 계층화된 그룹 배열
     * @returns 이 레벨의 모든 파일 수 합계
     */
    private calculateTotalFileCounts(groups: CardGroup[]): number {
        let total = 0;

        for (const group of groups) {
            // 자식 그룹의 파일 수 계산
            const childrenTotal = this.calculateTotalFileCounts(group.children);
            // 직접 파일 수 + 자식 파일 수
            group.totalFileCount = group.files.length + childrenTotal;
            total += group.totalFileCount;
        }

        return total;
    }

    /**
     * 계층 구조를 플랫 배열로 펼칩니다 (렌더링용)
     *
     * @remarks
     * Phase 4에서 사용될 메서드입니다.
     * 트리 구조를 깊이 우선 순회하여 플랫 배열로 반환합니다.
     * 접힌 그룹의 자식은 포함하지 않습니다.
     *
     * @param groups - 계층화된 그룹 배열
     * @param includeCollapsed - 접힌 그룹의 자식도 포함할지 여부
     * @returns 깊이 우선 순회된 플랫 그룹 배열
     */
    flattenHierarchy(groups: CardGroup[], includeCollapsed: boolean = false): CardGroup[] {
        const result: CardGroup[] = [];

        const traverse = (groupList: CardGroup[]) => {
            for (const group of groupList) {
                result.push(group);

                // 자식이 있고, 펼쳐져 있거나 includeCollapsed가 true인 경우
                if (group.children.length > 0 && (!group.collapsed || includeCollapsed)) {
                    traverse(group.children);
                }
            }
        };

        traverse(groups);
        return result;
    }

    /**
     * 특정 그룹의 모든 조상 그룹을 펼칩니다
     *
     * @remarks
     * 활성 파일이 속한 그룹을 자동으로 펼칠 때 사용합니다.
     *
     * @param groupId - 대상 그룹 ID
     * @param groups - 모든 그룹 배열
     */
    expandAncestors(groupId: string, groups: CardGroup[]): void {
        const groupMap = new Map<string, CardGroup>();
        for (const group of groups) {
            groupMap.set(group.id, group);
        }

        const targetGroup = groupMap.get(groupId);
        if (!targetGroup) return;

        // 부모를 따라 올라가면서 모두 펼침
        let currentId = targetGroup.parentId;
        const expandedIds: string[] = [];

        while (currentId) {
            const parent = groupMap.get(currentId);
            if (parent) {
                if (parent.collapsed) {
                    parent.collapsed = false;
                    expandedIds.push(parent.id);
                }
                currentId = parent.parentId;
            } else {
                break;
            }
        }

        // 배치 저장
        if (expandedIds.length > 0) {
            const states = expandedIds.map(id => ({ groupId: id, collapsed: false }));
            this.stateManager.setBatch(states);
            this.logger.debug('Grouping', `Expanded ${expandedIds.length} ancestor groups for ${groupId}`);
        }
    }
}
