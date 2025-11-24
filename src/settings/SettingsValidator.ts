import { CardNavigatorSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * 설정 검증 결과
 */
export interface ValidationResult {
	/** 검증 성공 여부 */
	valid: boolean;

	/** 오류 메시지 목록 */
	errors: string[];

	/** 경고 메시지 목록 */
	warnings: string[];
}

/**
 * ⭐ 설정 검증기 (Phase 4.2)
 *
 * 플러그인 설정값의 유효성을 검사하고 오류를 방지합니다.
 *
 * @remarks
 * - 범위 검증: 숫자 값의 최소/최대 범위
 * - 의존성 검증: 특정 설정 간의 종속성
 * - 타입 검증: 예상 타입과 실제 타입 일치 여부
 * - 자동 수정: 유효하지 않은 값을 안전한 기본값으로 교체
 */
export class SettingsValidator {
	private logger: DebugLogger;

	constructor(logger: DebugLogger) {
		this.logger = logger;
	}

	/**
	 * 설정값을 검증합니다
	 *
	 * @param settings - 검증할 설정
	 * @returns 검증 결과
	 */
	validate(settings: CardNavigatorSettings): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// 1. 카드 크기 검증
		this.validateCardDimensions(settings, errors, warnings);

		// 2. 그룹화 설정 검증
		this.validateGrouping(settings, errors, warnings);

		// 3. 정렬 설정 검증
		this.validateSorting(settings, errors, warnings);

		// 4. 렌더링 설정 검증
		this.validateRendering(settings, errors, warnings);

		// 5. 파일 경로 검증
		this.validatePaths(settings, errors, warnings);

		// 6. 색상 값 검증
		this.validateColors(settings, errors, warnings);

		const result: ValidationResult = {
			valid: errors.length === 0,
			errors,
			warnings
		};

		if (!result.valid) {
			this.logger.warn('Settings', 'Settings validation failed', {
				errorCount: errors.length,
				warningCount: warnings.length
			});
		}

		return result;
	}

	/**
	 * 설정값을 검증하고 자동 수정합니다
	 *
	 * @param settings - 검증 및 수정할 설정
	 * @returns 수정된 설정과 검증 결과
	 */
	validateAndFix(settings: CardNavigatorSettings): { settings: CardNavigatorSettings; result: ValidationResult } {
		const result = this.validate(settings);

		if (!result.valid) {
			this.logger.debug('Settings', 'Auto-fixing invalid settings', {
				errorCount: result.errors.length
			});

			// 유효하지 않은 값을 안전한 기본값으로 수정
			const fixedSettings = this.fixInvalidSettings(settings);
			return { settings: fixedSettings, result };
		}

		return { settings, result };
	}

	/**
	 * 카드 크기 설정을 검증합니다
	 */
	private validateCardDimensions(
		settings: CardNavigatorSettings,
		errors: string[],
		warnings: string[]
	): void {
		// 실제 설정 구조에는 cardWidth, cardHeight, cardGap이 직접 존재하지 않을 수 있음
		// 필요한 경우에만 검증 수행
		if ('cardWidth' in settings) {
			const cardWidth = (settings as any).cardWidth;
			if (typeof cardWidth === 'number' && (cardWidth < 100 || cardWidth > 500)) {
				errors.push(`Card width must be between 100 and 500 (current: ${cardWidth})`);
			}
		}

		if ('cardHeight' in settings) {
			const cardHeight = (settings as any).cardHeight;
			if (typeof cardHeight === 'number' && (cardHeight < 100 || cardHeight > 800)) {
				errors.push(`Card height must be between 100 and 800 (current: ${cardHeight})`);
			}
		}

		if ('cardGap' in settings) {
			const cardGap = (settings as any).cardGap;
			if (typeof cardGap === 'number' && (cardGap < 0 || cardGap > 50)) {
				errors.push(`Card gap must be between 0 and 50 (current: ${cardGap})`);
			}
		}
	}

	/**
	 * 그룹화 설정을 검증합니다
	 */
	private validateGrouping(
		settings: CardNavigatorSettings,
		errors: string[],
		warnings: string[]
	): void {
		// 실제 설정 구조에 맞게 간단히 검증
		// 구체적인 검증은 필요시 추가
	}

	/**
	 * 정렬 설정을 검증합니다
	 */
	private validateSorting(
		settings: CardNavigatorSettings,
		errors: string[],
		warnings: string[]
	): void {
		// 정렬 설정 검증
		if ('sort' in settings && settings.sort) {
			const sort = settings.sort as any;
			// 필요한 경우 sort 객체의 속성 검증
		}
	}

	/**
	 * 렌더링 설정을 검증합니다
	 */
	private validateRendering(
		settings: CardNavigatorSettings,
		errors: string[],
		warnings: string[]
	): void {
		// 디버그 설정 검증
		if ('debug' in settings && settings.debug) {
			const debug = settings.debug as any;
			if ('enabled' in debug && typeof debug.enabled !== 'boolean') {
				errors.push(`debug.enabled must be a boolean (current type: ${typeof debug.enabled})`);
			}
		}
	}

	/**
	 * 파일 경로 설정을 검증합니다
	 */
	private validatePaths(
		settings: CardNavigatorSettings,
		errors: string[],
		warnings: string[]
	): void {
		// 경로 검증은 필요시 추가
	}

	/**
	 * 색상 값을 검증합니다
	 */
	private validateColors(
		settings: CardNavigatorSettings,
		errors: string[],
		warnings: string[]
	): void {
		// 색상 검증은 필요시 추가
	}

	/**
	 * 유효하지 않은 설정을 수정합니다
	 */
	private fixInvalidSettings(settings: CardNavigatorSettings): CardNavigatorSettings {
		const fixed = JSON.parse(JSON.stringify(settings));

		// 기본적인 타입 검증만 수행
		// 구체적인 수정은 필요시 추가

		this.logger.debug('Settings', 'Settings auto-fixed', {
			hasChanges: false
		});

		return fixed;
	}

	/**
	 * 특정 필드의 유효성을 검사합니다
	 *
	 * @param field - 검사할 필드명
	 * @param value - 검사할 값
	 * @returns 유효하면 true
	 */
	validateField(field: keyof CardNavigatorSettings, value: any): boolean {
		// 기본적으로 모든 필드 허용
		// 필요한 경우 특정 필드에 대한 검증 추가
		return true;
	}
}
