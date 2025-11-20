import { CardNavigatorSettings, DebugCategory } from '../types';

/**
 * 디버그 로거
 * 
 * 개발 중 디버깅을 위한 구조화된 로깅 시스템입니다.
 * 설정에서 활성화/비활성화 및 카테고리별 필터링이 가능합니다.
 * 
 * @remarks
 * Production 빌드에서는 자동으로 비활성화되며,
 * 로그 함수 호출 자체가 최적화로 제거됩니다.
 * 
 * @example
 * ```typescript
 * const logger = new DebugLogger(() => settingsManager.getSettings());
 * 
 * // 기본 로그
 * logger.debug('View', 'Rendering cards', { count: files.length });
 * 
 * // 성능 측정
 * logger.time('View', 'renderCards');
 * await renderCards();
 * logger.timeEnd('View', 'renderCards');
 * 
 * // 그룹화
 * logger.group('Layout', 'Calculating layout');
 * logger.debug('Layout', 'Grid columns', { columns: 4 });
 * logger.debug('Layout', 'Card size', { width: 200, height: 150 });
 * logger.groupEnd();
 * ```
 */
export class DebugLogger {
	private getSettings: () => CardNavigatorSettings;
	private timers: Map<string, number> = new Map();

	/**
	 * DebugLogger를 생성합니다
	 * 
	 * @param getSettings - 현재 설정을 반환하는 함수
	 * 
	 * @remarks
	 * settings 객체를 직접 저장하지 않고 함수를 저장하여,
	 * 항상 최신 설정을 참조할 수 있도록 합니다.
	 */
	constructor(getSettings: () => CardNavigatorSettings) {
		this.getSettings = getSettings;
	}

	/**
	 * 디버그 모드가 활성화되어 있는지 확인
	 * 
	 * @param category - 확인할 카테고리
	 * @returns 해당 카테고리의 로그 출력 여부
	 */
	private isEnabled(category: DebugCategory): boolean {
		const settings = this.getSettings();
		
		if (!settings.debug?.enabled) {
			return false;
		}

		// 카테고리별 설정 확인
		const categorySettings = settings.debug.categories?.[category];
		return categorySettings !== false; // 기본값은 true
	}

	/**
	 * 디버그 로그 출력
	 * 
	 * @param category - 로그 카테고리
	 * @param message - 로그 메시지
	 * @param data - 추가 데이터 (선택)
	 */
	debug(category: DebugCategory, message: string, data?: unknown): void {
		if (!this.isEnabled(category)) return;

		const prefix = `[${category}]`;
		if (data !== undefined) {
			console.log(prefix, message, data);
		} else {
			console.log(prefix, message);
		}
	}

	/**
	 * 경고 로그 출력
	 * 
	 * @param category - 로그 카테고리
	 * @param message - 경고 메시지
	 * @param data - 추가 데이터 (선택)
	 */
	warn(category: DebugCategory, message: string, data?: unknown): void {
		if (!this.isEnabled(category)) return;

		const prefix = `[${category}]`;
		if (data !== undefined) {
			console.warn(prefix, message, data);
		} else {
			console.warn(prefix, message);
		}
	}

	/**
	 * 오류 로그 출력
	 * 
	 * @param category - 로그 카테고리
	 * @param message - 오류 메시지
	 * @param error - Error 객체 또는 추가 데이터 (선택)
	 * 
	 * @remarks
	 * 오류 로그는 디버그 모드가 꺼져있어도 항상 출력됩니다.
	 */
	error(category: DebugCategory, message: string, error?: unknown): void {
		const prefix = `[${category}]`;
		if (error !== undefined) {
			console.error(prefix, message, error);
		} else {
			console.error(prefix, message);
		}
	}

	/**
	 * 시간 측정 시작
	 * 
	 * @param category - 로그 카테고리
	 * @param label - 측정 레이블
	 */
	time(category: DebugCategory, label: string): void {
		if (!this.isEnabled(category)) return;

		const key = `${category}:${label}`;
		this.timers.set(key, performance.now());
	}

	/**
	 * 시간 측정 종료 및 결과 출력
	 * 
	 * @param category - 로그 카테고리
	 * @param label - 측정 레이블
	 * @returns 경과 시간 (ms)
	 */
	timeEnd(category: DebugCategory, label: string): number | undefined {
		if (!this.isEnabled(category)) return;

		const key = `${category}:${label}`;
		const startTime = this.timers.get(key);
		
		if (startTime === undefined) {
			this.warn(category, `타이머를 찾을 수 없습니다: ${label}`);
			return undefined;
		}

		const duration = performance.now() - startTime;
		this.timers.delete(key);
		
		this.debug(category, `⏱️ ${label}`, `${duration.toFixed(2)}ms`);
		return duration;
	}

	/**
	 * 그룹 시작
	 * 
	 * @param category - 로그 카테고리
	 * @param label - 그룹 레이블
	 */
	group(category: DebugCategory, label: string): void {
		if (!this.isEnabled(category)) return;

		console.group(`[${category}] ${label}`);
	}

	/**
	 * 접힌 그룹 시작
	 * 
	 * @param category - 로그 카테고리
	 * @param label - 그룹 레이블
	 */
	groupCollapsed(category: DebugCategory, label: string): void {
		if (!this.isEnabled(category)) return;

		console.groupCollapsed(`[${category}] ${label}`);
	}

	/**
	 * 그룹 종료
	 */
	groupEnd(): void {
		console.groupEnd();
	}

	/**
	 * 테이블 형식으로 데이터 출력
	 * 
	 * @param category - 로그 카테고리
	 * @param data - 테이블로 출력할 데이터
	 */
	table(category: DebugCategory, data: unknown): void {
		if (!this.isEnabled(category)) return;

		console.log(`[${category}]`);
		console.table(data);
	}
}
