import { TFile, App } from 'obsidian';
import { CardNavigatorSettings } from '../../types';
import { DebugLogger } from '../../utils/DebugLogger';

/**
 * 검색 전략 인터페이스
 *
 * @remarks
 * Strategy Pattern을 사용하여 각 검색 타입을 독립적인 클래스로 분리합니다.
 * 새로운 검색 타입을 추가하려면 이 인터페이스를 구현하고 SearchEngine에 등록하면 됩니다.
 */
export interface SearchStrategy {
    /**
     * 동기 검색 실행
     *
     * @param query - 검색어
     * @param files - 검색할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 검색 결과
     *
     * @remarks
     * 파일 본문을 읽지 않고 메타데이터만 사용하는 빠른 검색입니다.
     * line:, content:, task: 등 본문 검색이 필요한 경우 경고를 출력하고 필터링하지 않습니다.
     */
    executeSync(query: string, files: TFile[], caseSensitive: boolean): TFile[];

    /**
     * 비동기 검색 실행
     *
     * @param query - 검색어
     * @param files - 검색할 파일 목록
     * @param caseSensitive - 대소문자 구분 여부
     * @returns 검색 결과
     *
     * @remarks
     * 파일 본문을 읽어서 검색하는 정확하지만 느린 검색입니다.
     * 기본 구현은 executeSync를 Promise로 래핑합니다.
     */
    executeAsync(query: string, files: TFile[], caseSensitive: boolean): Promise<TFile[]>;
}

/**
 * 검색 전략 설정
 *
 * @remarks
 * 검색 전략 클래스 생성 시 필요한 의존성들을 주입합니다.
 */
export interface SearchStrategyConfig {
    /** Obsidian App 인스턴스 */
    app: App;

    /** 디버그 로거 */
    logger: DebugLogger;

    /** 설정 가져오기 함수 */
    getSettings: () => CardNavigatorSettings;
}
