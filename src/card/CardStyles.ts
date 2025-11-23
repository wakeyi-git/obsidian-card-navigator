import { CardNavigatorSettings, CardStyleSettings } from '../types';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * 카드 스타일을 CSS 변수로 동적 관리합니다
 * 
 * 설정이 변경될 때마다 CSS 변수를 업데이트하여
 * 실시간으로 스타일이 반영되도록 합니다.
 * 
 * @remarks
 * 관리하는 카드 타입:
 * - normal: 일반 카드
 * - active: 활성 카드 (현재 열린 파일)
 * - focused: 포커스 카드 (키보드로 선택)
 * 
 * 모든 CSS 변수는 'card-navigator-' 접두사를 사용하여
 * Obsidian 기본 UI나 다른 플러그인과의 충돌을 방지합니다.
 */
export class CardStyleManager {
    private logger: DebugLogger;

    constructor(getSettings: () => CardNavigatorSettings) {
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(getSettings);
    }

    /**
     * 설정에 따라 모든 CSS 변수를 업데이트합니다
     * 
     * @param settings - 플러그인 설정
     */
    applyStyles(settings: CardNavigatorSettings): void {
        this.applyCardStyle('normal', settings.normalCardStyle);
        this.applyCardStyle('active', settings.activeCardStyle);
        this.applyCardStyle('focused', settings.focusedCardStyle);
    }

    /**
     * 특정 카드 타입의 스타일을 CSS 변수로 적용합니다
     *
     * @param type - 카드 타입 (normal, active, focused)
     * @param style - 스타일 설정
     *
     * @remarks
     * inheritFromNormal이 true인 경우, CSS 변수를 설정하지 않아
     * 자동으로 normal 값으로 폴백되도록 합니다.
     */
    private applyCardStyle(
        type: 'normal' | 'active' | 'focused',
        style: CardStyleSettings
    ): void {
        const root = document.body;

        // 상속 모드인 경우, CSS 변수를 설정하지 않음 (폴백으로 normal 사용)
        if (type !== 'normal' && style.inheritFromNormal) {
            // 상속 모드: 기존 CSS 변수 제거하여 폴백 활성화
            root.style.removeProperty(`--card-navigator-bg-${type}`);
            root.style.removeProperty(`--card-navigator-font-size-${type}`);
            root.style.removeProperty(`--card-navigator-border-color-${type}`);
            root.style.removeProperty(`--card-navigator-border-width-${type}`);
            root.style.removeProperty(`--card-navigator-border-radius-${type}`);
            return;
        }

        // 일반 모드: CSS 변수 설정
        root.style.setProperty(
            `--card-navigator-bg-${type}`,
            style.backgroundColor
        );

        root.style.setProperty(
            `--card-navigator-font-size-${type}`,
            `${style.fontSize}px`
        );

        root.style.setProperty(
            `--card-navigator-border-color-${type}`,
            style.borderColor
        );

        root.style.setProperty(
            `--card-navigator-border-width-${type}`,
            `${style.borderWidth}px`
        );

        root.style.setProperty(
            `--card-navigator-border-radius-${type}`,
            `${style.borderRadius}px`
        );
    }

    /**
     * 모든 스타일을 초기화합니다
     */
    resetStyles(): void {
        const root = document.body;
        const types = ['normal', 'active', 'focused'];
        const properties = [
            'bg',
            'font-size',
            'border-color',
            'border-width',
            'border-radius'
        ];

        types.forEach(type => {
            properties.forEach(prop => {
                root.style.removeProperty(`--card-navigator-${prop}-${type}`);
            });
        });
    }

    /**
     * 특정 카드 타입의 스타일만 업데이트합니다
     * 
     * @param type - 카드 타입
     * @param style - 스타일 설정
     */
    updateCardStyle(
        type: 'normal' | 'active' | 'focused',
        style: CardStyleSettings
    ): void {
        this.applyCardStyle(type, style);
    }

    /**
     * 현재 적용된 CSS 변수 값을 출력합니다
     * 
     * @remarks
     * 디버깅 목적으로 사용됩니다.
     */
    logCurrentStyles(): void {
        const root = document.body;
        const types = ['normal', 'active', 'focused'];
        
        this.logger.debug('Card', '=== Card Navigator Styles ===');
        types.forEach(type => {
            this.logger.debug('Card', `[${type}]`, {
                bg: root.style.getPropertyValue(`--card-navigator-bg-${type}`),
                fontSize: root.style.getPropertyValue(`--card-navigator-font-size-${type}`),
                borderColor: root.style.getPropertyValue(`--card-navigator-border-color-${type}`),
                borderWidth: root.style.getPropertyValue(`--card-navigator-border-width-${type}`),
                borderRadius: root.style.getPropertyValue(`--card-navigator-border-radius-${type}`)
            });
        });
    }
}
