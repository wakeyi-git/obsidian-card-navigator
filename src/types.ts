import { TFile } from 'obsidian';

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
    | 'outgoing-links';   // 나가는 링크

/**
 * 카드 섹션 설정
 */
export interface CardSectionSettings {
    /** 섹션 표시 여부 */
    enabled: boolean;
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
    /** 디버그 설정 */
    debug: DebugSettings;
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
 * 정렬 설정
 */
export interface SortOptions {
    /** 정렬 기준 */
    criteria: SortCriteria;
    /** 정렬 순서 */
    order: SortOrder;
    /** 프론트매터 속성 이름 (criteria가 'property'일 때 사용) */
    propertyName?: string;
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
 * 프리셋 우선순위 모드
 */
export type PresetPriorityMode = 
    | 'auto'    // 현재 모드에 따라 자동 결정
    | 'manual'; // 수동으로 우선순위 선택

/**
 * 수동 우선순위 타입
 */
export type ManualPriorityType = 
    | 'folder-first'  // 폴더 프리셋 우선
    | 'tag-first';    // 태그 프리셋 우선

/**
 * 프리셋 우선순위 설정
 * 
 * 폴더 프리셋과 태그 프리셋 중 어느 것을 우선 적용할지 결정합니다.
 */
export interface PresetPrioritySettings {
    /** 우선순위 모드 */
    mode: PresetPriorityMode;
    /** 수동 모드일 때의 우선순위 타입 */
    manualType: ManualPriorityType;
}

/**
 * 프리셋 매핑 타입
 */
export type PresetMappingType = 
    | 'folder'  // 특정 폴더에 프리셋 연결
    | 'tag';    // 특정 태그에 프리셋 연결

/**
 * 프리셋 매핑
 * 
 * 특정 폴더나 태그에 프리셋을 자동으로 적용합니다.
 */
export interface PresetMapping {
    /** 매핑 타입 */
    type: PresetMappingType;
    /** 대상 (폴더 경로 또는 태그명) */
    target: string;
    /** 적용할 프리셋 ID */
    presetId: string;
    /** 우선순위 (낮을수록 먼저 적용) */
    priority: number;
    /** 하위 폴더 포함 여부 (폴더 매핑일 때만 사용) */
    includeSubfolders?: boolean;
}

/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS: CardNavigatorSettings = {
    enablePresets: true,
    header: {
        enabled: true,
        contentType: 'filename',
        maxLength: 100,
        contentRenderMode: 'plain',
        includeFirstHeader: false,
        normalStyle: {
            fontSize: 14,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        activeStyle: {
            fontSize: 14,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        focusedStyle: {
            fontSize: 14,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        }
    },
    body: {
        enabled: true,
        contentType: 'content',
        maxLength: 200,
        contentRenderMode: 'plain',
        includeFirstHeader: false,
        normalStyle: {
            fontSize: 13,
            backgroundColor: 'var(--background-primary)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        activeStyle: {
            fontSize: 13,
            backgroundColor: 'var(--background-primary)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        focusedStyle: {
            fontSize: 13,
            backgroundColor: 'var(--background-primary)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        }
    },
    footer: {
        enabled: true,
        contentType: 'tags',
        maxLength: 50,
        contentRenderMode: 'plain',
        includeFirstHeader: false,
        normalStyle: {
            fontSize: 12,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        activeStyle: {
            fontSize: 12,
            backgroundColor: 'var(--background-primary-alt)',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0
        },
        focusedStyle: {
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
        backgroundColor: 'var(--background-secondary)',
        fontSize: 14,
        borderColor: 'var(--interactive-accent)',
        borderWidth: 2,
        borderRadius: 5
    },
    focusedCardStyle: {
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
        manualType: 'tag-first'
    },
    debug: {
        enabled: false,
        categories: {}
    }
};
