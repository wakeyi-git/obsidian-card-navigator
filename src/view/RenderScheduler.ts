import { DebugLogger } from '../utils/DebugLogger';

/**
 * 렌더링 작업의 우선순위
 */
export type RenderPriority = 'high' | 'normal' | 'low';

/**
 * 렌더링 작업 인터페이스
 */
export interface RenderTask {
	/** 작업 실행 함수 */
	execute: () => void | Promise<void>;

	/** 작업 설명 (디버깅용) */
	description: string;

	/** 우선순위 (기본값: normal) */
	priority: RenderPriority;
}

/**
 * ⭐ 렌더링 스케줄러 (Phase 3.2)
 *
 * 렌더링 작업을 우선순위 기반 큐로 관리하고,
 * requestIdleCallback을 활용하여 브라우저 유휴 시간에 처리합니다.
 *
 * @remarks
 * - 우선순위: high (즉시 처리) > normal (일반) > low (유휴 시)
 * - requestIdleCallback 지원: 브라우저 유휴 시간 활용
 * - Fallback: requestAnimationFrame 사용
 */
export class RenderScheduler {
	private logger: DebugLogger;

	/** 렌더링 작업 큐 (우선순위 순 정렬) */
	private renderQueue: RenderTask[] = [];

	/** 현재 렌더링 중인지 여부 */
	private isRendering = false;

	/** requestIdleCallback 지원 여부 */
	private supportsIdleCallback: boolean;

	/** 작업 처리 시간 제한 (ms) - requestIdleCallback의 timeRemaining() 기준 */
	private readonly MIN_TIME_REMAINING = 10;

	/** requestIdleCallback 타임아웃 (ms) - 너무 오래 대기하지 않도록 */
	private readonly IDLE_TIMEOUT = 2000;

	constructor(logger: DebugLogger) {
		this.logger = logger;
		this.supportsIdleCallback = typeof requestIdleCallback !== 'undefined';
	}

	/**
	 * ⭐ 렌더링 작업을 스케줄링합니다
	 *
	 * @param execute - 실행할 작업
	 * @param description - 작업 설명
	 * @param priority - 우선순위 (기본값: normal)
	 */
	schedule(
		execute: () => void | Promise<void>,
		description: string,
		priority: RenderPriority = 'normal'
	): void {
		const task: RenderTask = { execute, description, priority };

		// 우선순위에 따라 큐에 삽입
		this.renderQueue.push(task);
		this.sortQueue();

		this.logger.debug('View', 'Render task scheduled', {
			description,
			priority,
			queueLength: this.renderQueue.length
		});

		// 렌더링 중이 아니면 큐 처리 시작
		if (!this.isRendering) {
			this.processQueue();
		}
	}

	/**
	 * 우선순위에 따라 큐를 정렬합니다
	 *
	 * @private
	 */
	private sortQueue(): void {
		this.renderQueue.sort((a, b) => {
			const priorityA = this.getPriorityValue(a.priority);
			const priorityB = this.getPriorityValue(b.priority);
			return priorityB - priorityA; // 높은 우선순위가 앞으로
		});
	}

	/**
	 * 우선순위의 숫자 값을 반환합니다
	 *
	 * @param priority - 우선순위
	 * @returns 숫자 값 (높을수록 우선)
	 * @private
	 */
	private getPriorityValue(priority: RenderPriority): number {
		const map: Record<RenderPriority, number> = {
			high: 3,
			normal: 2,
			low: 1
		};
		return map[priority] || 2;
	}

	/**
	 * ⭐ 렌더링 큐를 처리합니다
	 *
	 * @private
	 */
	private async processQueue(): Promise<void> {
		if (this.isRendering) {
			return;
		}

		this.isRendering = true;

		while (this.renderQueue.length > 0) {
			const task = this.renderQueue.shift();
			if (!task) break;

			this.logger.debug('View', 'Processing render task', {
				description: task.description,
				priority: task.priority,
				remaining: this.renderQueue.length
			});

			// 우선순위에 따라 처리 방식 결정
			if (task.priority === 'high') {
				// High 우선순위: 즉시 실행
				await this.executeTask(task);
			} else if (this.supportsIdleCallback) {
				// requestIdleCallback 사용
				await this.executeWithIdleCallback(task);
			} else {
				// Fallback: requestAnimationFrame 사용
				await this.executeWithAnimationFrame(task);
			}
		}

		this.isRendering = false;

		this.logger.debug('View', 'Render queue completed', {
			tasksProcessed: 'all'
		});
	}

	/**
	 * 작업을 즉시 실행합니다
	 *
	 * @param task - 실행할 작업
	 * @private
	 */
	private async executeTask(task: RenderTask): Promise<void> {
		try {
			const result = task.execute();
			if (result instanceof Promise) {
				await result;
			}
		} catch (error) {
			this.logger.error('View', `Render task failed: ${task.description}`, error);
		}
	}

	/**
	 * requestIdleCallback을 사용하여 작업을 실행합니다
	 *
	 * @param task - 실행할 작업
	 * @private
	 */
	private async executeWithIdleCallback(task: RenderTask): Promise<void> {
		return new Promise((resolve) => {
			requestIdleCallback(
				async (deadline) => {
					// 유휴 시간이 충분하면 실행
					if (deadline.timeRemaining() > this.MIN_TIME_REMAINING || deadline.didTimeout) {
						await this.executeTask(task);
						resolve();
					} else {
						// 시간 부족: 다시 큐에 추가
						this.renderQueue.unshift(task);
						this.logger.debug('View', 'Task rescheduled (insufficient time)', {
							description: task.description,
							timeRemaining: deadline.timeRemaining()
						});
						resolve();
					}
				},
				{ timeout: this.IDLE_TIMEOUT }
			);
		});
	}

	/**
	 * requestAnimationFrame을 사용하여 작업을 실행합니다 (Fallback)
	 *
	 * @param task - 실행할 작업
	 * @private
	 */
	private async executeWithAnimationFrame(task: RenderTask): Promise<void> {
		return new Promise((resolve) => {
			requestAnimationFrame(async () => {
				await this.executeTask(task);
				resolve();
			});
		});
	}

	/**
	 * 큐의 모든 작업을 취소합니다
	 */
	clearQueue(): void {
		const cancelledCount = this.renderQueue.length;
		this.renderQueue = [];

		if (cancelledCount > 0) {
			this.logger.debug('View', 'Render queue cleared', {
				cancelledTasks: cancelledCount
			});
		}
	}

	/**
	 * 현재 큐의 크기를 반환합니다
	 */
	getQueueSize(): number {
		return this.renderQueue.length;
	}

	/**
	 * 현재 렌더링 중인지 여부를 반환합니다
	 */
	getIsRendering(): boolean {
		return this.isRendering;
	}

	/**
	 * requestIdleCallback 지원 여부를 반환합니다
	 */
	getSupportsIdleCallback(): boolean {
		return this.supportsIdleCallback;
	}
}
