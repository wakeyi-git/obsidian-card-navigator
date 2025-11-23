import { TFile, App } from 'obsidian';
import { CardGroup, GroupingSettings, TagGroupMode, DateGroupBasis } from '../types';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * 파일을 그룹으로 나누는 관리자
 *
 * 다양한 기준으로 파일 목록을 그룹화하고,
 * 그룹 정렬 및 접힌 상태 관리를 담당합니다.
 */
export class GroupingManager {
    private app: App;
    private logger: DebugLogger;

    constructor(app: App, getSettings: () => import('../types').CardNavigatorSettings) {
        this.app = app;
        this.logger = new DebugLogger(getSettings);
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
                icon: '',
                files: files,
                collapsed: false,
                sortKey: 'all'
            }];
        }

        let groups: CardGroup[] = [];

        this.logger.debug('Grouping', `Grouping ${files.length} files by ${settings.criteria}`);

        // 핀된 파일과 일반 파일 분리
        let pinnedFileObjects: TFile[] = [];
        let unpinnedFiles = files;

        if (settings.showPinnedAsGroup && pinnedFiles && pinnedFiles.length > 0) {
            pinnedFileObjects = files.filter(file => pinnedFiles.includes(file.path));
            unpinnedFiles = files.filter(file => !pinnedFiles.includes(file.path));

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
                icon: 'pin',
                files: pinnedFileObjects,
                collapsed: false,
                sortKey: '000-pinned' // 항상 맨 앞에 오도록
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
            const folderName = folderPath === '/'
                ? 'Root'
                : (hierarchical ? folderPath : folderPath.split('/').pop() || folderPath);

            groups.push({
                id: `folder-${folderPath}`,
                name: folderName,
                icon: 'folder',
                files: folderFiles,
                collapsed: false,
                sortKey: folderName
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

            groups.push({
                id: `tag-${tag}`,
                name: isUntagged ? 'Untagged' : `#${tag}`,
                icon: 'tag',
                files: tagFiles,
                collapsed: false,
                sortKey: isUntagged ? 'zzz-untagged' : tag
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
                icon: 'calendar',
                files: yearFiles,
                collapsed: false,
                sortKey: year
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
                icon: 'calendar',
                files: monthFiles,
                collapsed: false,
                sortKey: monthKey
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
                icon: 'calendar',
                files: weekFiles,
                collapsed: false,
                sortKey: weekKey
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
                icon: 'file-text',
                files: files,
                collapsed: false,
                sortKey: 'all'
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
                icon: isNoProperty ? 'help-circle' : 'file-text',
                files: propFiles,
                collapsed: false,
                sortKey: isNoProperty ? 'zzz-no-property' : propValue
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
                icon: 'file',
                files: sizeGroups.small,
                collapsed: false,
                sortKey: 1
            });
        }

        if (sizeGroups.medium.length > 0) {
            groups.push({
                id: 'size-medium',
                name: 'Medium (10-100KB)',
                icon: 'file-text',
                files: sizeGroups.medium,
                collapsed: false,
                sortKey: 2
            });
        }

        if (sizeGroups.large.length > 0) {
            groups.push({
                id: 'size-large',
                name: 'Large (> 100KB)',
                icon: 'files',
                files: sizeGroups.large,
                collapsed: false,
                sortKey: 3
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
                icon: letter === '0-9' ? 'hash' : letter === 'Other' ? 'asterisk' : 'type',
                files: letterFiles,
                collapsed: false,
                sortKey: letter === '0-9' ? '000' : letter === 'Other' ? 'zzz' : letter
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
            }

            return settings.groupSortOrder === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * localStorage에서 접힌 상태를 복원합니다
     */
    private restoreCollapsedState(groups: CardGroup[]): void {
        groups.forEach(group => {
            const key = `card-navigator-group-collapsed-${group.id}`;
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                group.collapsed = stored === 'true';
            }
        });
    }

    /**
     * 접힌 상태를 localStorage에 저장합니다
     */
    saveCollapsedState(groupId: string, collapsed: boolean): void {
        const key = `card-navigator-group-collapsed-${groupId}`;
        localStorage.setItem(key, String(collapsed));

        this.logger.debug('Grouping', `Saved collapsed state for ${groupId}: ${collapsed}`);
    }

    /**
     * 모든 그룹을 펼칩니다
     */
    expandAllGroups(groups: CardGroup[]): void {
        groups.forEach(group => {
            group.collapsed = false;
            this.saveCollapsedState(group.id, false);
        });
    }

    /**
     * 모든 그룹을 접습니다
     */
    collapseAllGroups(groups: CardGroup[]): void {
        groups.forEach(group => {
            group.collapsed = true;
            this.saveCollapsedState(group.id, true);
        });
    }
}
