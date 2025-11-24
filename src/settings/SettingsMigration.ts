import { CardNavigatorSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * 설정 마이그레이션 정보
 */
export interface MigrationInfo {
	/** 이전 버전 */
	fromVersion: number;

	/** 새 버전 */
	toVersion: number;

	/** 변경된 필드 목록 */
	changedFields: string[];

	/** 마이그레이션 성공 여부 */
	success: boolean;
}

/**
 * ⭐ 설정 마이그레이션 (Phase 4.2)
 *
 * 플러그인 업데이트 시 설정 구조 변경을 자동으로 처리합니다.
 *
 * @remarks
 * - 버전별 마이그레이션: 각 버전 변경사항을 순차적으로 적용
 * - 하위 호환성: 이전 버전 설정을 새 버전으로 변환
 * - 안전한 업데이트: 원본 데이터 보존 및 오류 처리
 */
export class SettingsMigration {
	private logger: DebugLogger;

	/** 현재 설정 버전 */
	private readonly CURRENT_VERSION = 2;

	constructor(logger: DebugLogger) {
		this.logger = logger;
	}

	/**
	 * 설정을 현재 버전으로 마이그레이션합니다
	 *
	 * @param data - 로드된 설정 데이터
	 * @returns 마이그레이션된 설정
	 */
	migrate(data: any): { settings: CardNavigatorSettings; info: MigrationInfo | null } {
		const version = this.getVersion(data);

		if (version === this.CURRENT_VERSION) {
			// 마이그레이션 불필요
			return { settings: data as CardNavigatorSettings, info: null };
		}

		this.logger.debug('Settings', 'Starting settings migration', {
			fromVersion: version,
			toVersion: this.CURRENT_VERSION
		});

		const changedFields: string[] = [];
		let migratedData = { ...data };

		// 버전별 마이그레이션 순차 적용
		if (version < 1) {
			migratedData = this.migrateV0toV1(migratedData, changedFields);
		}
		if (version < 2) {
			migratedData = this.migrateV1toV2(migratedData, changedFields);
		}

		// 버전 업데이트
		(migratedData as any).version = this.CURRENT_VERSION;

		const info: MigrationInfo = {
			fromVersion: version,
			toVersion: this.CURRENT_VERSION,
			changedFields,
			success: true
		};

		this.logger.debug('Settings', 'Settings migration completed', {
			...info,
			totalChanges: changedFields.length
		});

		return { settings: migratedData as CardNavigatorSettings, info };
	}

	/**
	 * 설정 데이터에서 버전을 가져옵니다
	 */
	private getVersion(data: any): number {
		// version 필드가 없으면 0 (초기 버전)
		return data.version || 0;
	}

	/**
	 * 버전 0 → 1 마이그레이션
	 *
	 * @remarks
	 * 변경 사항:
	 * - cardSize → cardWidth, cardHeight로 분리
	 * - enableViewport → viewportThreshold로 변경
	 */
	private migrateV0toV1(data: any, changedFields: string[]): any {
		const migrated = { ...data };

		// cardSize → cardWidth, cardHeight
		if ('cardSize' in migrated && !('cardWidth' in migrated)) {
			const cardSize = migrated.cardSize;
			migrated.cardWidth = cardSize;
			migrated.cardHeight = Math.round(cardSize * 1.5); // 3:2 비율
			delete migrated.cardSize;
			changedFields.push('cardSize → cardWidth, cardHeight');

			this.logger.debug('Settings', 'Migrated cardSize to cardWidth/cardHeight', {
				cardSize,
				cardWidth: migrated.cardWidth,
				cardHeight: migrated.cardHeight
			});
		}

		// enableViewport → viewportThreshold
		if ('enableViewport' in migrated && !('viewportThreshold' in migrated)) {
			const enableViewport = migrated.enableViewport;
			migrated.viewportThreshold = enableViewport ? 100 : undefined;
			delete migrated.enableViewport;
			changedFields.push('enableViewport → viewportThreshold');

			this.logger.debug('Settings', 'Migrated enableViewport to viewportThreshold', {
				enableViewport,
				viewportThreshold: migrated.viewportThreshold
			});
		}

		return migrated;
	}

	/**
	 * 버전 1 → 2 마이그레이션
	 *
	 * @remarks
	 * 변경 사항:
	 * - showCardBorder → cardBorderWidth로 변경
	 * - colorScheme → cardBackgroundColor, cardBorderColor로 분리
	 * - sortDirection → sortOrder로 이름 변경 (값은 동일)
	 */
	private migrateV1toV2(data: any, changedFields: string[]): any {
		const migrated = { ...data };

		// showCardBorder → cardBorderWidth
		if ('showCardBorder' in migrated && !('cardBorderWidth' in migrated)) {
			const showCardBorder = migrated.showCardBorder;
			migrated.cardBorderWidth = showCardBorder ? 1 : 0;
			delete migrated.showCardBorder;
			changedFields.push('showCardBorder → cardBorderWidth');

			this.logger.debug('Settings', 'Migrated showCardBorder to cardBorderWidth', {
				showCardBorder,
				cardBorderWidth: migrated.cardBorderWidth
			});
		}

		// colorScheme → cardBackgroundColor, cardBorderColor
		if ('colorScheme' in migrated) {
			const colorScheme = migrated.colorScheme;

			if (colorScheme === 'light' && !migrated.cardBackgroundColor) {
				migrated.cardBackgroundColor = '#ffffff';
				migrated.cardBorderColor = '#e0e0e0';
				changedFields.push('colorScheme (light) → color settings');
			} else if (colorScheme === 'dark' && !migrated.cardBackgroundColor) {
				migrated.cardBackgroundColor = '#1e1e1e';
				migrated.cardBorderColor = '#404040';
				changedFields.push('colorScheme (dark) → color settings');
			}

			delete migrated.colorScheme;

			this.logger.debug('Settings', 'Migrated colorScheme to color settings', {
				colorScheme,
				cardBackgroundColor: migrated.cardBackgroundColor,
				cardBorderColor: migrated.cardBorderColor
			});
		}

		// sortDirection → sortOrder (이름만 변경)
		if ('sortDirection' in migrated && !('sortOrder' in migrated)) {
			migrated.sortOrder = migrated.sortDirection;
			delete migrated.sortDirection;
			changedFields.push('sortDirection → sortOrder');

			this.logger.debug('Settings', 'Renamed sortDirection to sortOrder', {
				value: migrated.sortOrder
			});
		}

		return migrated;
	}

	/**
	 * 현재 설정 버전을 반환합니다
	 */
	getCurrentVersion(): number {
		return this.CURRENT_VERSION;
	}

	/**
	 * 마이그레이션이 필요한지 확인합니다
	 *
	 * @param data - 설정 데이터
	 * @returns 마이그레이션이 필요하면 true
	 */
	needsMigration(data: any): boolean {
		const version = this.getVersion(data);
		return version < this.CURRENT_VERSION;
	}

	/**
	 * 설정 데이터를 이전 버전으로 다운그레이드합니다
	 *
	 * @param data - 현재 설정 데이터
	 * @param targetVersion - 목표 버전
	 * @returns 다운그레이드된 설정
	 *
	 * @remarks
	 * 주의: 다운그레이드는 데이터 손실이 발생할 수 있습니다.
	 * 주로 테스트 또는 롤백 목적으로 사용됩니다.
	 */
	downgrade(data: CardNavigatorSettings, targetVersion: number): any {
		if (targetVersion >= this.CURRENT_VERSION) {
			this.logger.warn('Settings', 'Cannot downgrade to current or higher version', {
				currentVersion: this.CURRENT_VERSION,
				targetVersion
			});
			return data;
		}

		this.logger.warn('Settings', 'Downgrading settings (data loss may occur)', {
			fromVersion: this.CURRENT_VERSION,
			toVersion: targetVersion
		});

		let downgraded = { ...data };

		// V2 → V1
		if (targetVersion < 2) {
			downgraded = this.downgradeV2toV1(downgraded);
		}

		// V1 → V0
		if (targetVersion < 1) {
			downgraded = this.downgradeV1toV0(downgraded);
		}

		(downgraded as any).version = targetVersion;
		return downgraded;
	}

	/**
	 * 버전 2 → 1 다운그레이드
	 */
	private downgradeV2toV1(data: any): any {
		const downgraded = { ...data };

		// cardBorderWidth → showCardBorder
		if ('cardBorderWidth' in downgraded) {
			downgraded.showCardBorder = downgraded.cardBorderWidth > 0;
			delete downgraded.cardBorderWidth;
		}

		// 색상 설정 제거 (V1에는 없음)
		delete downgraded.cardBackgroundColor;
		delete downgraded.cardBorderColor;
		delete downgraded.activeCardBorderColor;

		// sortOrder → sortDirection
		if ('sortOrder' in downgraded) {
			downgraded.sortDirection = downgraded.sortOrder;
			delete downgraded.sortOrder;
		}

		return downgraded;
	}

	/**
	 * 버전 1 → 0 다운그레이드
	 */
	private downgradeV1toV0(data: any): any {
		const downgraded = { ...data };

		// cardWidth, cardHeight → cardSize (평균값 사용)
		if ('cardWidth' in downgraded && 'cardHeight' in downgraded) {
			downgraded.cardSize = Math.round((downgraded.cardWidth + downgraded.cardHeight) / 2);
			delete downgraded.cardWidth;
			delete downgraded.cardHeight;
		}

		// viewportThreshold → enableViewport
		if ('viewportThreshold' in downgraded) {
			downgraded.enableViewport = downgraded.viewportThreshold !== undefined;
			delete downgraded.viewportThreshold;
		}

		return downgraded;
	}
}
