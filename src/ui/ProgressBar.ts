/**
 * 증분 렌더링 진행률 표시 바
 *
 * ⭐ Section 13.1: 증분 렌더링 진행률 UI
 *
 * @remarks
 * 대량의 카드를 렌더링할 때 사용자에게 진행 상황을 시각적으로 보여줍니다.
 * 툴바 아래에 가는 진행률 바를 표시하며, 렌더링 완료 시 자동으로 사라집니다.
 *
 * @example
 * ```typescript
 * const progressBar = new ProgressBar(containerEl);
 * progressBar.show();
 * progressBar.setProgress(0.5); // 50%
 * progressBar.hide();
 * ```
 */
export class ProgressBar {
	private containerEl: HTMLElement;
	private progressBarEl: HTMLElement | null = null;
	private progressFillEl: HTMLElement | null = null;
	private currentProgress: number = 0;

	/**
	 * ProgressBar 생성자
	 *
	 * @param containerEl - 진행률 바를 추가할 컨테이너 요소
	 */
	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
	}

	/**
	 * 진행률 바를 표시합니다
	 *
	 * @remarks
	 * 이미 표시되어 있으면 아무 작업도 하지 않습니다.
	 */
	show(): void {
		if (this.progressBarEl && this.progressBarEl.isConnected) {
			return; // 이미 표시됨
		}

		// 진행률 바 컨테이너 생성
		this.progressBarEl = this.containerEl.createDiv({
			cls: 'card-navigator-progress-bar'
		});

		// 진행률 채우기 요소 생성
		this.progressFillEl = this.progressBarEl.createDiv({
			cls: 'progress-fill'
		});

		// 초기 진행률 설정
		this.setProgress(0);
	}

	/**
	 * 진행률을 설정합니다
	 *
	 * @param progress - 진행률 (0.0 ~ 1.0)
	 *
	 * @remarks
	 * 진행률은 0.0(0%)부터 1.0(100%)까지의 값입니다.
	 * 범위를 벗어난 값은 자동으로 클램핑됩니다.
	 */
	setProgress(progress: number): void {
		// 진행률 범위 제한 (0 ~ 1)
		this.currentProgress = Math.max(0, Math.min(1, progress));

		if (this.progressFillEl) {
			// 진행률에 따라 너비 설정
			this.progressFillEl.style.width = `${this.currentProgress * 100}%`;
		}
	}

	/**
	 * 현재 진행률을 반환합니다
	 *
	 * @returns 현재 진행률 (0.0 ~ 1.0)
	 */
	getProgress(): number {
		return this.currentProgress;
	}

	/**
	 * 진행률 바를 숨깁니다
	 *
	 * @param animated - 페이드아웃 애니메이션 사용 여부 (기본값: true)
	 *
	 * @remarks
	 * 애니메이션을 사용하면 0.3초 동안 페이드아웃됩니다.
	 */
	hide(animated: boolean = true): void {
		if (!this.progressBarEl || !this.progressBarEl.isConnected) {
			return; // 이미 숨겨짐
		}

		if (animated) {
			// 페이드아웃 애니메이션
			this.progressBarEl.addClass('fade-out');

			// 애니메이션 완료 후 제거
			setTimeout(() => {
				if (this.progressBarEl) {
					this.progressBarEl.remove();
					this.progressBarEl = null;
					this.progressFillEl = null;
				}
			}, 300); // CSS 애니메이션 시간과 일치
		} else {
			// 즉시 제거
			this.progressBarEl.remove();
			this.progressBarEl = null;
			this.progressFillEl = null;
		}
	}

	/**
	 * 진행률 바가 표시 중인지 확인합니다
	 *
	 * @returns 표시 여부
	 */
	isVisible(): boolean {
		return this.progressBarEl !== null && this.progressBarEl.isConnected;
	}

	/**
	 * 진행률을 업데이트하고 완료 시 자동으로 숨깁니다
	 *
	 * @param progress - 진행률 (0.0 ~ 1.0)
	 *
	 * @remarks
	 * 진행률이 1.0(100%)에 도달하면 잠시 후 자동으로 숨겨집니다.
	 */
	updateProgress(progress: number): void {
		this.setProgress(progress);

		// 완료 시 자동으로 숨김 (100ms 후)
		if (this.currentProgress >= 1.0) {
			setTimeout(() => {
				this.hide();
			}, 100);
		}
	}

	/**
	 * 리소스를 정리합니다
	 *
	 * @remarks
	 * 컴포넌트를 파괴할 때 호출하여 메모리 누수를 방지합니다.
	 */
	destroy(): void {
		if (this.progressBarEl) {
			this.progressBarEl.remove();
			this.progressBarEl = null;
			this.progressFillEl = null;
		}
	}
}
