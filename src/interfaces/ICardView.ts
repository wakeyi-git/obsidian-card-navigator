import CardNavigatorPlugin from '../main';

/**
 * CardFactory가 필요로 하는 View 인터페이스
 * 
 * @remarks
 * 전체 CardNavigatorView 대신 필요한 메서드만 노출하여
 * 순환 참조를 방지하고 의존성을 명확히 합니다.
 * 
 * CardFactory는 이 인터페이스만 의존하므로:
 * - CardNavigatorView의 내부 구현 변경이 CardFactory에 영향을 주지 않음
 * - 테스트 시 인터페이스만 모킹하면 됨
 * - 순환 참조 해결
 * 
 * @example
 * ```typescript
 * // CardFactory.ts
 * constructor(
 *     app: App,
 *     view: ICardView,  // ✅ Interface 사용
 *     renderer: CardRenderer,
 *     ...
 * ) {
 *     this.view = view;
 * }
 * 
 * // view.ts
 * export class CardNavigatorView extends ItemView implements ICardView {
 *     // ✅ ICardView 구현
 *     public plugin: CardNavigatorPlugin;
 *     
 *     // ... 기존 구현
 * }
 * ```
 * 
 * @see {@link CardFactory}
 * @see {@link CardNavigatorView}
 */
export interface ICardView {
	/**
	 * 플러그인 인스턴스
	 * 
	 * @remarks
	 * CardFactory는 이를 통해:
	 * - settings: `plugin.settingsManager.getSettings()`
	 * - presets: `plugin.presetManager.getCardSettingsForFile(file)`
	 * 
	 * 에 접근합니다.
	 */
	plugin: CardNavigatorPlugin;
}
