import { TFile } from 'obsidian';
import type { LanguageSetting } from './i18n';

/**
 * 렌더링 상태 정보
 *
 * @remarks
 * Phase 1.2: 조건부 재렌더링을 위한 상태 추적
 */
export interface RenderState {
	/** 파일 개수 */
	fileCount: number;
	/** 현재 모드 */
	mode: string;
	/** 정렬 기준 (JSON 문자열로 직렬화됨) */
	sortBy: string;
	/** 정렬 순서 (JSON 문자열로 직렬화됨) */
	sortOrder: string;
	/** 검색 쿼리 */
	query: string;
	/** 그룹화 활성화 여부 */
	groupingEnabled: boolean;
	/** 그룹화 기준 */
	groupingCriteria: string;
	/** 그룹 정렬 */
	groupingSort: string;
	/** 그룹 정렬 순서 */
	groupingSortOrder: string;
	/** 폴더 경로 (폴더 모드) */
	folderPath?: string;
	/** 활성 태그 (태그 모드) */
	activeTags?: string;
	/** 지정된 태그 (태그 모드) */
	specifiedTags?: string;
	/** 추가 설정 */
	[key: string]: unknown;
}

/**
 * 렌더링 변경 사항
 *
 * @remarks
 * Phase 1.2: 어떤 부분이 변경되었는지 추적
 */
export interface RenderChanges {
	/** 파일 목록이 변경됨 */
	filesChanged: boolean;
	/** 그룹 구조가 변경됨 */
	groupsChanged: boolean;
	/** 정렬 순서가 변경됨 */
	sortChanged: boolean;
	/** 스타일만 변경됨 */
	stylesChanged: boolean;
	/** 변경된 파일 경로 목록 */
	changedFiles: Set<string>;
	/** 변경 타입 (전체/부분) */
	changeType: 'full' | 'partial' | 'none';
}

/**
 * 카드 섹션
 * 
 * 카드의 각 영역(헤더/바디/풋터)을 표현합니다.
 */
export interface CardSection {
    /** 섹션 타입 */
    type: 'header' | 'body' | 'footer';
    /** 표시할 내용 */
    content: string;
    /** 표시 여부 */
    visible: boolean;
}

/**
 * 카드별 설정
 * 
 * 프리셋이 매핑된 파일의 경우 전역 설정 대신 이 설정이 적용됩니다.
 */
export interface CardSettings {
    header: CardSectionSettings;
    body: CardSectionSettings;
    footer: CardSectionSettings;
    renderMode: RenderMode;
    normalCardStyle: CardStyleSettings;
    activeCardStyle: CardStyleSettings;
    focusedCardStyle: CardStyleSettings;
}

/**
 * 카드 데이터
 * 
 * 렌더링에 필요한 모든 카드 정보를 담고 있습니다.
 */
export interface CardData {
    /** 원본 파일 */
    file: TFile;
    /** 헤더 섹션 */
    header: CardSection;
    /** 바디 섹션 */
    body: CardSection;
    /** 풋터 섹션 */
    footer: CardSection;
    /** 카드별 설정 */
    cardSettings: CardSettings;
}

/**
 * 카드 콘텐츠 타입
 *
 * 각 섹션에 표시할 수 있는 내용의 종류입니다.
 */
export type CardContentType =
    | 'filename'          // 파일명
    | 'file-path'         // 파일 경로
    | 'first-header'      // 첫 번째 # 제목
    | 'content'           // 파일 본문
    | 'tags'              // 태그 목록
    | 'created-date'      // 생성일
    | 'modified-date'     // 수정일
    | 'property'          // 프론트매터 속성값
    | 'backlinks'         // 백링크
    | 'outgoing-links'    // 나가는 링크
    | 'image-thumbnail';  // 이미지 섬네일

/**
 * 이미지 섬네일 크기
 */
export type ThumbnailSize =
    | 'small'   // 80px
    | 'medium'  // 150px
    | 'large';  // 250px

/**
 * 이미지 종횡비
 */
export type ThumbnailAspectRatio =
    | 'square'    // 1:1
    | 'original'  // 원본 비율 유지
    | '16:9'      // 16:9
    | '4:3';      // 4:3

/**
 * 이미지 폴백 타입
 */
export type ThumbnailFallback =
    | 'none'          // 폴백 없음 (이미지 없으면 섹션 숨김)
    | 'icon'          // 파일 타입 아이콘
    | 'folder-color'  // 폴더 기반 색상
    | 'tag-color'     // 태그 기반 색상
    | 'first-emoji';  // 본문의 첫 번째 이모지

/**
 * 이미지 섬네일 설정
 */
export interface ImageThumbnailSettings {
    /** 이미지 섬네일 활성화 여부 */
    enabled: boolean;
    /** 섬네일 크기 */
    size: ThumbnailSize;
    /** 종횡비 */
    aspectRatio: ThumbnailAspectRatio;
    /** 폴백 옵션 */
    fallback: ThumbnailFallback;
    /** 외부 이미지 허용 여부 (http/https) */
    allowExternalImages: boolean;
    /** 이미지 로딩 실패 시 재시도 횟수 */
    retryCount: number;
    /** 이미지를 클릭 시 동작 */
    clickAction: 'open-file' | 'open-image' | 'none';
}

/**
 * 카드 섹션 설정
 */
/**
 * 섹션 내용 설정
 *
 * @remarks
 * 상태별로 다른 내용 설정을 가질 수 있습니다.
 */
export interface CardSectionContentSettings {
    /** 일반 상태에서 상속 여부 (활성/포커스 상태에서만 사용) */
    inheritFromNormal?: boolean;
    /** 표시할 콘텐츠 타입 */
    contentType: CardContentType;
    /** 프론트매터 속성 이름 (contentType이 'property'일 때 사용) */
    customProperty?: string;
    /**
     * 최대 글자 수
     *
     * @remarks
     * contentType이 'content'이고 contentRenderMode가 'markdown-html'일 때는 무시됩니다.
     */
    maxLength?: number;
    /** 본문 렌더링 모드 (contentType이 'content'일 때만 사용) */
    contentRenderMode?: RenderMode;
    /** 본문 표시 시 첫 번째 헤더 포함 여부 (contentType이 'content'일 때만 사용) */
    includeFirstHeader?: boolean;
    /** 이미지 섬네일 설정 (contentType이 'image-thumbnail'일 때만 사용) */
    imageThumbnail?: ImageThumbnailSettings;
}

export interface CardSectionSettings {
    /** 섹션 표시 여부 */
    enabled: boolean;
    /** 일반 상태 내용 설정 */
    normalContent: CardSectionContentSettings;
    /** 활성 상태 내용 설정 */
    activeContent: CardSectionContentSettings;
    /** 포커스 상태 내용 설정 */
    focusedContent: CardSectionContentSettings;
    /** 일반 상태 스타일 */
    normalStyle: CardSectionStyleSettings;
    /** 활성 상태 스타일 */
    activeStyle: CardSectionStyleSettings;
    /** 포커스 상태 스타일 */
    focusedStyle: CardSectionStyleSettings;
}

/**
 * 렌더링 모드
 */
export type RenderMode = 
    | 'plain'           // 일반 텍스트 (마크다운 문법 그대로)
    | 'markdown-html';  // 마크다운 완전 렌더링

/**
 * 레이아웃 모드
 */
export type LayoutMode = 
    | 'horizontal'  // 가로 모드 (viewport width > height)
    | 'vertical';   // 세로 모드 (viewport width < height)

/**
 * 스크롤 동작 모드
 */
export type ScrollBehaviorMode = 
    | 'center'   // 항상 화면 중앙으로 스크롤
    | 'nearest'  // 카드가 보이지 않을 때만 최소한의 스크롤
    | 'none';    // 자동 스크롤 안 함

/**
 * 태그 클릭 동작 모드
 */
export type TagClickAction = 
    | 'obsidian-search'  // Obsidian 기본 검색으로 태그 검색
    | 'plugin-search';   // Card Navigator 검색 모드로 전환

/**
 * 드래그 앤 드롭 콘텐츠 타입
 */
export type DragDropContentType = 
    | 'link'         // [[파일명]] 링크 형식
    | 'full-content'; // 파일 전체 내용

/**
 * 드래그 앤 드롭 파일 내용 옵션
 */
export interface DragDropFullContentOptions {
    /** 프론트매터 포함 여부 */
    includeFrontmatter: boolean;
    /** 최대 길이 제한 활성화 여부 */
    enableLengthLimit: boolean;
    /** 최대 글자 수 (enableLengthLimit가 true일 때 적용) */
    maxLength: number;
}

/**
 * 드래그 앤 드롭 설정
 */
export interface DragDropSettings {
    /** 에디터에 삽입할 콘텐츠 타입 */
    contentType: DragDropContentType;
    /** 파일 전체 내용 삽입 시 추가 옵션 */
    fullContentOptions: DragDropFullContentOptions;
}

/**
 * 레이아웃 설정
 */
export interface LayoutSettings {
    /** 레이아웃 모드 (자동 계산) */
    mode: LayoutMode;
    /** 카드 최소 너비 (px) */
    cardMinWidth: number;
    /** 카드 최소 높이 (px) */
    cardMinHeight: number;
    /** 카드 최대 너비 (px) */
    cardMaxWidth: number;
    /** 카드 최대 높이 (px) */
    cardMaxHeight: number;
    /** 카드 간격 (px) */
    gap: number;
}

/**
 * 카드 스타일 설정
 */
export interface CardStyleSettings {
    /** 일반 상태에서 상속 여부 (활성/포커스 상태에서만 사용) */
    inheritFromNormal?: boolean;
    /** 카드 전체 배경색 */
    backgroundColor: string;
    /** 헤더 배경색 (선택적) */
    headerBackgroundColor?: string;
    /** 바디 배경색 (선택적) */
    bodyBackgroundColor?: string;
    /** 풋터 배경색 (선택적) */
    footerBackgroundColor?: string;
    /** 폰트 크기 (px) */
    fontSize: number;
    /** 테두리 색 */
    borderColor: string;
    /** 테두리 두께 (px) */
    borderWidth: number;
    /** 테두리 둥글기 (px) */
    borderRadius: number;
}

/**
 * 카드 섹션 스타일 설정
 *
 * 각 섹션의 상태별 스타일을 개별적으로 설정합니다.
 */
export interface CardSectionStyleSettings {
    /** 일반 상태에서 상속 여부 (활성/포커스 상태에서만 사용) */
    inheritFromNormal?: boolean;
    /** 폰트 크기 (px) */
    fontSize: number;
    /** 배경색 */
    backgroundColor: string;
    /** 테두리 색 */
    borderColor: string;
    /** 테두리 두께 (px) */
    borderWidth: number;
    /** 테두리 둥글기 (px) */
    borderRadius: number;
}

/**
 * 디버그 카테고리
 * 
 * 기능 영역별로 디버그 로그를 선택적으로 활성화할 수 있습니다.
 */
export type DebugCategory =
    | 'Plugin'
    | 'View'
    | 'Layout'
    | 'Search'
    | 'Filter'
    | 'Navigation'
    | 'Card'
    | 'Mode'
    | 'Preset'
    | 'Sort'
    | 'Selection'
    | 'DragDrop'
    | 'Settings'
    | 'Grouping'
    | 'Cache' // Phase 5.3
    | 'Event'
    | 'UI'
    | 'Performance';

/**
 * 디버그 설정
 */
export interface DebugSettings {
    /** 디버그 모드 활성화 여부 */
    enabled: boolean;
    /**
     * 카테고리별 활성화 상태
     *
     * @remarks
     * 설정하지 않은 카테고리는 기본적으로 활성화됩니다.
     */
    categories?: Partial<Record<DebugCategory, boolean>>;
}

/**
 * 그룹화 기준
 */
export type GroupCriteria =
    | 'none'            // 그룹화 안 함 (기존 동작)
    | 'folder'          // 폴더별
    | 'tag'             // 태그별
    | 'date-year'       // 연도별
    | 'date-month'      // 월별
    | 'date-week'       // 주별
    | 'property'        // 프론트매터 속성별
    | 'size'            // 파일 크기별
    | 'first-letter';   // 첫 글자별

/**
 * 날짜 그룹화 기준 (생성일 vs 수정일)
 */
export type DateGroupBasis =
    | 'created'     // 생성일
    | 'modified';   // 수정일

/**
 * 태그 그룹화 모드
 */
export type TagGroupMode =
    | 'first'   // 첫 번째 태그만
    | 'all';    // 모든 태그 (파일 중복 표시)

/**
 * 그룹 정렬 기준
 */
export type GroupSortCriteria =
    | 'name'          // 그룹명 알파벳 순
    | 'file-count'    // 파일 개수 순
    | 'latest-file'   // 최신 파일 기준
    | 'hierarchy';    // 계층 구조 (폴더 깊이, 태그 계층)

/**
 * 그룹화 설정
 */
export interface GroupingSettings {
    /** 그룹화 활성화 여부 */
    enabled: boolean;
    /** 그룹화 기준 */
    criteria: GroupCriteria;
    /** 날짜 그룹화 기준 (criteria가 date-* 일 때 사용) */
    dateBasis: DateGroupBasis;
    /** 태그 그룹화 모드 (criteria가 'tag'일 때 사용) */
    tagMode: TagGroupMode;
    /** 프론트매터 속성명 (criteria가 'property'일 때 사용) */
    propertyName?: string;
    /** 폴더 그룹화 계층 구조 사용 여부 */
    folderHierarchical: boolean;
    /** 그룹 정렬 기준 */
    groupSort: GroupSortCriteria;
    /** 그룹 정렬 순서 */
    groupSortOrder: SortOrder;
    /** 그룹 내 파일 정렬 (기존 sort 설정 사용) */
    inheritFileSorting: boolean;
    /** 핀된 파일을 별도 그룹으로 분리 여부 */
    showPinnedAsGroup?: boolean;
}

/**
 * 카드 그룹 (렌더링용 데이터 구조)
 *
 * @remarks
 * Phase 3: 계층 구조 필드 추가
 * - level: 계층 깊이 (0 = 루트)
 * - parentId: 부모 그룹 ID
 * - children: 자식 그룹 배열
 * - fullPath: 전체 경로 (폴더/태그)
 * - totalFileCount: 하위 포함 총 파일 수
 */
export interface CardGroup {
    /** 그룹 고유 ID (접기 상태 저장용, 예: "folder-path/to/folder") */
    id: string;
    /** 그룹명 (화면 표시용, 예: "folder") */
    name: string;
    /** 전체 경로 (예: "path/to/folder" 또는 "project/frontend") */
    fullPath: string;
    /** 그룹 아이콘 (lucide icon name) */
    icon: string;
    /** 그룹에 속한 파일 목록 (직계 파일만) */
    files: TFile[];
    /** 접힌 상태 */
    collapsed: boolean;
    /** 정렬 키 (그룹 정렬에 사용) */
    sortKey: string | number;

    // === 계층 구조 필드 (Phase 3) ===
    /** 계층 깊이 (0 = 루트 레벨) */
    level: number;
    /** 부모 그룹 ID (null = 최상위) */
    parentId: string | null;
    /** 자식 그룹 배열 */
    children: CardGroup[];
    /** 모든 하위 그룹 포함 총 파일 수 */
    totalFileCount: number;
}

/**
 * 기본 설정 타입
 * 
 * @deprecated
 * baseSettings 필드가 제거되어 더 이상 사용되지 않습니다.
 */
export type BaseSettings = Omit<CardNavigatorSettings, 'presets' | 'presetMappings' | 'debug'>;

/**
 * 플러그인 설정
 */
export interface CardNavigatorSettings {
    /** 언어 설정 */
    language: LanguageSetting;
    /** 프리셋 기능 활성화 여부 */
    enablePresets: boolean;
    /** 헤더 설정 */
    header: CardSectionSettings;
    /** 바디 설정 */
    body: CardSectionSettings;
    /** 풋터 설정 */
    footer: CardSectionSettings;
    /** 렌더링 모드 */
    renderMode: RenderMode;
    /** 일반 카드 스타일 */
    normalCardStyle: CardStyleSettings;
    /** 활성 카드 스타일 (현재 열린 파일) */
    activeCardStyle: CardStyleSettings;
    /** 포커스 카드 스타일 (키보드로 선택된 카드) */
    focusedCardStyle: CardStyleSettings;
    /** 레이아웃 설정 */
    layout: LayoutSettings;
    /** 현재 모드 */
    currentMode: NavigatorMode;
    /** 폴더 모드 설정 */
    folderMode: FolderModeSettings;
    /** 태그 모드 설정 */
    tagMode: TagModeSettings;
    /** 정렬 설정 */
    sort: SortOptions;
    /** 스크롤 동작 모드 */
    scrollBehavior: ScrollBehaviorMode;
    /** 태그 클릭 동작 모드 */
    tagClickAction: TagClickAction;
    /** 드래그 앤 드롭 설정 */
    dragDrop: DragDropSettings;
    /** 프리셋 목록 */
    presets: Preset[];
    /** 프리셋 매핑 목록 */
    presetMappings: PresetMapping[];
    /** 프리셋 우선순위 설정 */
    presetPriority: PresetPrioritySettings;
    /** 저장된 검색 목록 */
    savedSearches: SavedSearch[];
    /** 퍼지 검색 활성화 여부 */
    enableFuzzySearch: boolean;
    /** 퍼지 검색 임계값 (0-1) */
    fuzzySearchThreshold: number;
    /** 검색어 하이라이트 활성화 여부 */
    enableSearchHighlight?: boolean;
    /** 대소문자 구분 검색 */
    caseSensitiveSearch?: boolean;
    /** 카드 호버 액션 활성화 여부 */
    enableCardHoverActions?: boolean;
    /** 핀된 파일 경로 목록 */
    pinnedFiles?: string[];
    /** 핀된 파일 항상 표시 여부 */
    alwaysShowPinnedFiles?: boolean;
    /** 그룹화 설정 */
    grouping: GroupingSettings;
    /** 디버그 설정 */
    debug: DebugSettings;
    /** ⭐ Section 13.2: 증분 렌더링 청크 크기 (한 번에 렌더링할 카드 수) */
    incrementalRenderChunkSize?: number;
}

/**
 * 검색 쿼리
 */
export interface SearchQuery {
    type: 'path' | 'file' | 'tag' | 'line' | 'section' | 'property' | 'created' | 'modified' | 'text' | 'task' | 'task-todo' | 'task-done' | 'block' | 'content' | 'link' | 'outgoing-link';
    value: string;
    /** 속성 이름 (type이 'property'일 때 사용) */
    propertyName?: string;
}

/**
 * 파싱된 검색 쿼리 트리 구조
 * 
 * Boolean 연산자를 지원하기 위한 트리 구조입니다.
 * 
 * @remarks
 * - 연산자 노드: type이 'operator'이며 left/right 자식을 가집니다
 * - 리프 노드: type이 'search'이며 실제 검색 쿼리를 담고 있습니다
 * - 우선순위: NOT > AND > OR
 * 
 * @example
 * ```typescript
 * // "tag:#work OR tag:#study"
 * {
 *   type: 'operator',
 *   operator: 'OR',
 *   left: { type: 'search', search: { type: 'tag', value: '#work' } },
 *   right: { type: 'search', search: { type: 'tag', value: '#study' } }
 * }
 * ```
 */
export interface ParsedQuery {
    /** 노드 타입 */
    type: 'operator' | 'search';
    /** 연산자 타입 (연산자 노드일 때만) */
    operator?: 'AND' | 'OR' | 'NOT';
    /** 왼쪽 자식 노드 (연산자 노드일 때만) */
    left?: ParsedQuery;
    /** 오른쪽 자식 노드 (연산자 노드일 때만) */
    right?: ParsedQuery;
    /** 검색 쿼리 (리프 노드일 때만) */
    search?: SearchQuery;
    /** 대소문자 구분 (선택적) */
    caseSensitive?: boolean;
}

/**
 * 필터 옵션
 *
 * 파일 목록을 필터링할 때 사용하는 조건들입니다.
 */
export interface FilterOptions {
    /** 태그 필터 */
    tags: string[];
    /** 생성일 시작 */
    createdAfter?: Date;
    /** 생성일 종료 */
    createdBefore?: Date;
    /** 수정일 시작 */
    modifiedAfter?: Date;
    /** 수정일 종료 */
    modifiedBefore?: Date;
    /** 프론트매터 속성 필터 */
    properties: Record<string, unknown>;
    /** 경로 필터 (태그 모드에서 사용) */
    path?: string;
}

/**
 * 카드 네비게이터 모드
 */
export type NavigatorMode = 
    | 'folder'  // 폴더 기반 카드 표시
    | 'tag'     // 태그 기반 카드 표시
    | 'search'; // 검색 결과 카드 표시

/**
 * 폴더 모드 설정
 */
export interface FolderModeSettings {
    /** 활성 폴더 사용 여부 */
    useActiveFolder: boolean;
    /** 지정 폴더 경로 */
    specifiedFolder?: string;
    /** 하위 폴더 포함 여부 */
    includeSubfolders: boolean;
}

/**
 * 태그 모드 설정
 */
export interface TagModeSettings {
    /** 활성 파일 태그 사용 여부 */
    useActiveFileTags: boolean;
    /** 지정 태그 목록 */
    specifiedTags: string[];
    /** 태그 매칭 방식 */
    tagOperator: 'AND' | 'OR';
}

/**
 * 정렬 기준
 */
export type SortCriteria = 
    | 'name'      // 파일명
    | 'created'   // 생성일
    | 'modified'  // 수정일
    | 'size'      // 파일 크기
    | 'property'; // 프론트매터 속성

/**
 * 정렬 순서
 */
export type SortOrder = 
    | 'asc'   // 오름차순
    | 'desc'; // 내림차순

/**
 * 단일 정렬 레벨
 */
export interface SortLevel {
    /** 정렬 기준 */
    criteria: SortCriteria;
    /** 정렬 순서 */
    order: SortOrder;
    /** 프론트매터 속성 이름 (criteria가 'property'일 때 사용) */
    propertyName?: string;
}

/**
 * 정렬 설정
 */
export interface SortOptions {
    /** 정렬 기준 */
    criteria: SortCriteria;
    /** 정렬 순서 */
    order: SortOrder;
    /** 프론트매터 속성 이름 (criteria가 'property'일 때 사용) */
    propertyName?: string;
    /** 다단계 정렬 활성화 여부 */
    enableMultiSort?: boolean;
    /** 다단계 정렬 레벨 (최대 3개) */
    levels?: SortLevel[];
}

/**
 * 프리셋
 * 
 * 사용자 설정을 저장하고 빠르게 불러올 수 있습니다.
 */
export interface Preset {
    /** 프리셋 고유 ID */
    id: string;
    /** 프리셋 이름 */
    name: string;
    /** 프리셋 설명 */
    description: string;
    /** 저장된 설정 */
    settings: CardNavigatorSettings;
    /** 생성 시간 (타임스탬프) */
    createdAt: number;
}

/**
 * 저장된 검색
 *
 * 자주 사용하는 검색 쿼리를 저장합니다.
 */
export interface SavedSearch {
    /** 고유 ID */
    id: string;
    /** 검색 이름 */
    name: string;
    /** 검색 쿼리 */
    query: string;
    /** 생성 시간 (타임스탬프) */
    createdAt: number;
    /** 마지막 사용 시간 (타임스탬프) */
    lastUsed: number;
    /** 즐겨찾기 여부 */
    favorite: boolean;
}

/**
 * 프리셋 우선순위 모드
 */
export type PresetPriorityMode =
    | 'auto'       // 현재 모드에 따라 자동 결정 (폴더 모드 → tag-first, 태그 모드 → folder-first)
    | 'semi-auto'  // 사용자 선택한 타입을 우선하되, 같은 타입 내에서는 자동 결정
    | 'manual';    // 매핑 목록 순서대로 적용 (첫 매치 우선)

/**
 * 우선순위 타입 (반자동 모드에서 사용)
 */
export type PriorityType =
    | 'folder'    // 폴더 프리셋 우선
    | 'tag'       // 태그 프리셋 우선
    | 'property'  // 속성 프리셋 우선
    | 'date';     // 날짜 프리셋 우선

/**
 * 프리셋 우선순위 설정
 *
 * 여러 프리셋 타입 중 어느 것을 우선 적용할지 결정합니다.
 */
export interface PresetPrioritySettings {
    /** 우선순위 모드 */
    mode: PresetPriorityMode;
    /** 반자동 모드일 때의 우선순위 타입 순서 */
    preferredType: PriorityType;
}

/**
 * 프리셋 매핑 타입
 */
export type PresetMappingType =
    | 'folder'    // 특정 폴더에 프리셋 연결
    | 'tag'       // 특정 태그에 프리셋 연결
    | 'property'  // 프론트매터 속성 값에 따라 프리셋 연결
    | 'date';     // 날짜 범위에 따라 프리셋 연결

/**
 * 날짜 매핑 기준
 */
export type DateMappingCriteria =
    | 'created-date'   // 파일 생성일
    | 'modified-date'  // 파일 수정일
    | 'property';      // 프론트매터의 날짜 속성

/**
 * 프리셋 매핑
 *
 * 특정 폴더, 태그, 속성, 날짜 범위에 프리셋을 자동으로 적용합니다.
 *
 * ⭐ 개선 (2025-11-23):
 * - property, date 타입 추가
 * - 고유 ID 추가로 매핑 관리 개선
 * - 배열 순서가 곧 우선순위 (인덱스 = 우선순위)
 */
export interface PresetMapping {
    /** 매핑 고유 ID (자동 생성, addMapping 호출 시 생성됨) */
    id?: string;
    /** 매핑 타입 */
    type: PresetMappingType;
    /**
     * 대상
     * - folder: 폴더 경로 (예: "Projects/Work")
     * - tag: 태그명 (예: "meeting")
     * - property: 속성명 (예: "status")
     * - date: 날짜 범위를 설명하는 레이블 (예: "최근 7일")
     */
    target: string;
    /** 적용할 프리셋 ID */
    presetId: string;
    /**
     * 우선순위 (낮을수록 먼저 적용)
     * @deprecated 배열 순서로 우선순위를 관리하므로 더 이상 사용하지 않음
     */
    priority: number;

    // ===== 폴더 매핑 전용 옵션 =====
    /** 하위 폴더 포함 여부 (폴더 매핑일 때만 사용) */
    includeSubfolders?: boolean;

    // ===== 속성 매핑 전용 옵션 =====
    /**
     * 속성 값 (property 매핑일 때 사용)
     * - 예: status 속성이 "in-progress"인 파일
     */
    propertyValue?: string;

    // ===== 날짜 매핑 전용 옵션 =====
    /** 날짜 매핑 기준 (date 매핑일 때 사용) */
    dateCriteria?: DateMappingCriteria;
    /** 사용자 정의 날짜 속성명 (dateCriteria가 'property'일 때 사용) */
    datePropertyName?: string;
    /** 시작 날짜 (YYYY-MM-DD 형식, date 매핑일 때 사용) */
    dateFrom?: string;
    /** 종료 날짜 (YYYY-MM-DD 형식, date 매핑일 때 사용) */
    dateTo?: string;
    /** 상대 날짜 사용 여부 (예: "최근 7일") */
    useRelativeDate?: boolean;
    /** 상대 날짜 일수 (useRelativeDate가 true일 때 사용) */
    relativeDays?: number;
}

/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS: CardNavigatorSettings = {
    language: 'auto',
    enablePresets: true,
    header: {
        enabled: true,
        normalContent: {
            contentType: 'filename',
            maxLength: 100,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        activeContent: {
            inheritFromNormal: true,
            contentType: 'filename',
            maxLength: 100,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        focusedContent: {
            inheritFromNormal: true,
            contentType: 'filename',
            maxLength: 100,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        normalStyle: {
            fontSize: 14,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        activeStyle: {
            inheritFromNormal: true,
            fontSize: 14,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        focusedStyle: {
            inheritFromNormal: true,
            fontSize: 14,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        }
    },
    body: {
        enabled: true,
        normalContent: {
            contentType: 'content',
            maxLength: 200,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        activeContent: {
            inheritFromNormal: true,
            contentType: 'content',
            maxLength: 200,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        focusedContent: {
            inheritFromNormal: true,
            contentType: 'content',
            maxLength: 200,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        normalStyle: {
            fontSize: 13,
            backgroundColor: 'var(--background-primary)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        activeStyle: {
            inheritFromNormal: true,
            fontSize: 13,
            backgroundColor: 'var(--background-primary)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        focusedStyle: {
            inheritFromNormal: true,
            fontSize: 13,
            backgroundColor: 'var(--background-primary)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        }
    },
    footer: {
        enabled: true,
        normalContent: {
            contentType: 'tags',
            maxLength: 50,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        activeContent: {
            inheritFromNormal: true,
            contentType: 'tags',
            maxLength: 50,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        focusedContent: {
            inheritFromNormal: true,
            contentType: 'tags',
            maxLength: 50,
            contentRenderMode: 'plain',
            includeFirstHeader: false
        },
        normalStyle: {
            fontSize: 12,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        activeStyle: {
            inheritFromNormal: true,
            fontSize: 12,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        focusedStyle: {
            inheritFromNormal: true,
            fontSize: 12,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        }
    },
    renderMode: 'plain',
    normalCardStyle: {
        backgroundColor: 'var(--background-secondary)',
        fontSize: 14,
        borderColor: 'var(--background-modifier-border)',
        borderWidth: 1,
        borderRadius: 5
    },
    activeCardStyle: {
        inheritFromNormal: false, // 테두리 스타일이 다르므로 상속하지 않음
        backgroundColor: 'var(--background-secondary)',
        fontSize: 14,
        borderColor: 'var(--interactive-accent)',
        borderWidth: 2,
        borderRadius: 5
    },
    focusedCardStyle: {
        inheritFromNormal: false, // 테두리 스타일이 다르므로 상속하지 않음
        backgroundColor: 'var(--background-secondary-alt)',
        fontSize: 14,
        borderColor: 'var(--interactive-accent)',
        borderWidth: 2,
        borderRadius: 5
    },
    layout: {
        mode: 'vertical',
        cardMinWidth: 200,
        cardMinHeight: 250,
        cardMaxWidth: 400,
        cardMaxHeight: 500,
        gap: 10
    },
    currentMode: 'folder',
    folderMode: {
        useActiveFolder: true,
        includeSubfolders: false
    },
    tagMode: {
        useActiveFileTags: true,
        specifiedTags: [],
        tagOperator: 'OR'
    },
    sort: {
        criteria: 'name',
        order: 'asc'
    },
    scrollBehavior: 'nearest',
    tagClickAction: 'plugin-search',
    dragDrop: {
        contentType: 'link',
        fullContentOptions: {
            includeFrontmatter: false,
            enableLengthLimit: false,
            maxLength: 1000
        }
    },
    presets: [],
    presetMappings: [],
    presetPriority: {
        mode: 'auto',
        preferredType: 'tag'
    },
    savedSearches: [],
    enableFuzzySearch: false,
    fuzzySearchThreshold: 0.3,
    enableSearchHighlight: true,
    caseSensitiveSearch: false,
    enableCardHoverActions: true,
    pinnedFiles: [],
    alwaysShowPinnedFiles: false,
    grouping: {
        enabled: false,
        criteria: 'none',
        dateBasis: 'modified',
        tagMode: 'first',
        folderHierarchical: false,
        groupSort: 'name',
        groupSortOrder: 'asc',
        inheritFileSorting: true,
        showPinnedAsGroup: true
    },
    debug: {
        enabled: false,
        categories: {}
    },
    incrementalRenderChunkSize: 20
};
