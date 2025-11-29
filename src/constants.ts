/**
 * Card Navigator 플러그인 전역 상수
 * 
 * @remarks
 * 코드 전반에서 사용되는 매직 넘버와 문자열을 중앙 집중식으로 관리합니다.
 * 이를 통해 코드 가독성과 유지보수성을 향상시킵니다.
 */

/** 
 * 타이밍 관련 상수 (밀리초)
 * 
 * @remarks
 * Obsidian의 비동기 이벤트 처리와 동기화를 위한 타이밍 값들입니다.
 */
export const TIMING = {
    /** 
     * Vault 파일 목록 업데이트 대기 시간
     * 
     * @remarks
     * Obsidian vault가 파일 목록을 업데이트하는 데 필요한 최소 시간입니다.
     */
    VAULT_UPDATE_DELAY: 50,
    
    /** 
     * Obsidian metadataCache 업데이트 대기 시간
     * 
     * @remarks
     * 파일의 메타데이터(링크, 태그 등)가 캐시에 반영되는 데 필요한 시간입니다.
     */
    METADATA_UPDATE_DELAY: 100,
    
    /** 
     * 렌더링 완료 후 스크롤까지의 대기 시간
     * 
     * @remarks
     * 카드 렌더링이 완료되고 DOM이 안정화된 후 스크롤을 수행하기 위한 대기 시간입니다.
     */
    RENDER_COMPLETE_DELAY: 150,
    
    /** 
     * 검색 입력 디바운스 시간
     * 
     * @remarks
     * 사용자의 검색 입력이 멈춘 후 실제 검색을 수행하기까지의 대기 시간입니다.
     */
    SEARCH_DEBOUNCE_DELAY: 300,
    
    /** 
     * 파일 감지 디바운스 시간
     * 
     * @remarks
     * 파일 변경 이벤트가 연속으로 발생할 때 중복 처리를 방지하기 위한 시간입니다.
     */
    FILE_CHANGE_DEBOUNCE_DELAY: 150,
} as const;

/** 
 * 캐시 관련 상수
 * 
 * @remarks
 * 성능 최적화를 위한 캐시 크기 설정값들입니다.
 */
export const CACHE = {
    /** 
     * LRU 캐시 최대 항목 수
     * 
     * @remarks
     * 카드 콘텐츠 캐시의 최대 크기입니다.
     * 메모리 사용량과 성능 사이의 균형을 위한 값입니다.
     */
    MAX_CONTENT_CACHE_SIZE: 200,
} as const;

/** 
 * 렌더링 관련 상수
 * 
 * @remarks
 * 카드 렌더링 성능 최적화를 위한 설정값들입니다.
 */
export const RENDERING = {
    /** 
     * 배치 렌더링 시 한 번에 처리할 카드 수
     * 
     * @remarks
     * 대량의 카드를 렌더링할 때 UI 블로킹을 방지하기 위한 배치 크기입니다.
     */
    BATCH_SIZE: 50,
    
    /** 
     * 가상 스크롤링 버퍼 (화면 밖 카드 개수)
     * 
     * @remarks
     * 가상 스크롤링 사용 시 화면 밖에 미리 렌더링할 카드의 개수입니다.
     * 부드러운 스크롤 경험을 위한 버퍼입니다.
     */
    VIRTUAL_SCROLL_BUFFER: 3,
} as const;

/**
 * UI 관련 상수
 *
 * @deprecated Use i18n.t().ui instead
 *
 * @remarks
 * These constants are deprecated. Use the i18n module for localized strings.
 */

/** 
 * Viewport 관련 상수
 * 
 * @remarks
 * Intersection Observer 기반 성능 최적화를 위한 설정값들입니다.
 * 대량 파일 렌더링 시 초기 로딩 성능을 크게 개선합니다.
 */
/**
 * 레이아웃 설정 슬라이더 제한값
 *
 * @remarks
 * 각 레이아웃 설정 항목의 최소값, 최대값, 단계를 정의합니다.
 */
export const LAYOUT_LIMITS = {
    /** 카드 최소 너비 */
    cardMinWidth: { min: 100, max: 400, step: 10 },
    /** 카드 최소 높이 */
    cardMinHeight: { min: 80, max: 300, step: 10 },
    /** 카드 최대 너비 */
    cardMaxWidth: { min: 200, max: 800, step: 10 },
    /** 카드 최대 높이 */
    cardMaxHeight: { min: 150, max: 600, step: 10 },
    /** 카드 간격 */
    gap: { min: 5, max: 20, step: 1 },
} as const;

/**
 * 2D 매트릭스 레이아웃 설정 제한값
 *
 * @remarks
 * 2D 매트릭스 그룹화 모드에서 사용되는 셀 및 카드 크기 설정의 제한값입니다.
 */
export const MATRIX_LIMITS = {
    /** 셀 최소 너비 (px) */
    cellMinWidth: { min: 100, max: 500, step: 10 },
    /** 셀 최소 높이 (px) */
    cellMinHeight: { min: 100, max: 500, step: 10 },
    /** 셀 내 카드 최소 너비 (px) */
    cardMinWidth: { min: 100, max: 300, step: 10 },
} as const;

export const VIEWPORT = {
    /** 
     * viewport 밖에서 미리 로드할 거리 (px)
     * 
     * @remarks
     * 사용자가 스크롤하기 전에 미리 카드를 렌더링하기 위한 여유 공간입니다.
     * 값이 클수록 더 부드러운 스크롤 경험을 제공하지만 메모리를 더 사용합니다.
     */
    PRELOAD_MARGIN: '400px',
    
    /** 
     * 카드가 보이는 것으로 간주할 임계값 (0.0 ~ 1.0)
     * 
     * @remarks
     * Intersection Observer의 threshold 값입니다.
     * 0.01은 카드의 1%만 보여도 보이는 것으로 간주합니다.
     */
    VISIBILITY_THRESHOLD: 0.01,
    
    /** 
     * 플레이스홀더 최소 높이 (px)
     * 
     * @remarks
     * 카드 렌더링 전 레이아웃 공간을 확보하기 위한 최소 높이입니다.
     * 실제 카드와 비슷한 크기를 지정하여 레이아웃 shift를 방지합니다.
     */
    PLACEHOLDER_MIN_HEIGHT: 200,
    
    /** 
     * 초기에 강제 렌더링할 카드 수
     * 
     * @remarks
     * 활성 카드 주변의 카드를 즉시 렌더링하여 사용자에게 즉각적인 피드백을 제공합니다.
     * 너무 크면 초기 로딩이 느려지고, 너무 작으면 화면이 비어 보일 수 있습니다.
     */
    INITIAL_RENDER_COUNT: 10,
} as const;
