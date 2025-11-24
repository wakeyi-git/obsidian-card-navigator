import { TFile } from 'obsidian';
import { CardFactory } from './CardFactory';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * ⭐ 증분 렌더링 (Incremental Rendering) - Phase 3.1
 *
 * 대량의 카드를 청크 단위로 나눠서 렌더링하여 브라우저 블로킹을 방지합니다.
 *
 * @remarks
 * - 기본 청크 크기: 20개
 * - requestAnimationFrame을 활용하여 다음 프레임에서 렌더링
 * - 진행률 콜백을 통해 사용자에게 로딩 상태 피드백
 * - 렌더링 취소 기능 제공 (빠른 파일 전환 대응)
 */
export class IncrementalRenderer {
	private cardFactory: CardFactory;
	private logger: DebugLogger;

	/** 한 번에 렌더링할 카드 수 */
	private chunkSize = 20;

	/** 렌더링 취소 콜백 (ViewRenderer의 shouldCancelRendering 사용) */
	private shouldCancelCallback: ((renderingId: number, context: string) => boolean) | null = null;

	constructor(cardFactory: CardFactory, logger: DebugLogger) {
		this.cardFactory = cardFactory;
		this.logger = logger;
	}

	/**
	 * 렌더링 취소 콜백을 설정합니다
	 *
	 * @param callback - 렌더링 취소 여부를 확인하는 함수
	 */
	setShouldCancelCallback(callback: (renderingId: number, context: string) => boolean): void {
		this.shouldCancelCallback = callback;
	}

	/**
	 * ⭐ 파일 목록을 증분 방식으로 렌더링합니다
	 *
	 * @param files - 렌더링할 파일 목록
	 * @param container - 카드를 추가할 컨테이너
	 * @param activeFile - 현재 활성 파일
	 * @param onFileOpen - 파일 열기 콜백
	 * @param onProgress - 진행률 콜백 (0.0 ~ 1.0)
	 * @param renderingId - 렌더링 ID (필수, ViewRenderer에서 전달)
	 * @returns 완료 여부 (취소되면 false)
	 */
	async renderInChunks(
		files: TFile[],
		container: HTMLElement,
		activeFile: TFile | null,
		onFileOpen: (file: TFile) => void,
		onProgress?: (progress: number) => void,
		renderingId?: number
	): Promise<boolean> {
		if (renderingId === undefined) {
			throw new Error('renderingId is required for incremental rendering');
		}

		const totalChunks = Math.ceil(files.length / this.chunkSize);
		this.logger.debug('View', 'Starting incremental rendering', {
			totalFiles: files.length,
			chunkSize: this.chunkSize,
			totalChunks,
			renderingId
		});

		for (let i = 0; i < totalChunks; i++) {
			// 취소 확인 (ViewRenderer의 shouldCancelRendering 사용)
			if (this.shouldCancelCallback && this.shouldCancelCallback(renderingId, `incremental chunk ${i + 1}/${totalChunks}`)) {
				this.logger.debug('View', 'Incremental rendering cancelled', {
					chunk: i + 1,
					totalChunks,
					renderingId
				});
				return false;
			}

			const start = i * this.chunkSize;
			const end = Math.min(start + this.chunkSize, files.length);
			const chunk = files.slice(start, end);

			// 청크 렌더링
			await this.renderChunk(chunk, container, activeFile, onFileOpen);

			// 진행률 업데이트
			const progress = (i + 1) / totalChunks;
			if (onProgress) {
				onProgress(progress);
			}

			this.logger.debug('View', 'Chunk rendered', {
				chunk: i + 1,
				totalChunks,
				progress: `${(progress * 100).toFixed(1)}%`
			});

			// 마지막 청크가 아니면 다음 프레임까지 대기
			if (i < totalChunks - 1) {
				await this.waitForNextFrame();
			}
		}

		this.logger.debug('View', 'Incremental rendering completed', {
			totalFiles: files.length,
			totalChunks
		});

		return true;
	}

	/**
	 * 단일 청크를 렌더링합니다
	 *
	 * @param files - 청크에 포함된 파일 목록
	 * @param container - 카드를 추가할 컨테이너
	 * @param activeFile - 현재 활성 파일
	 * @param onFileOpen - 파일 열기 콜백
	 */
	private async renderChunk(
		files: TFile[],
		container: HTMLElement,
		activeFile: TFile | null,
		onFileOpen: (file: TFile) => void
	): Promise<void> {
		// ⭐ DocumentFragment 사용: 청크의 카드들을 먼저 fragment에 모아서 한 번에 추가
		const fragment = document.createDocumentFragment();

		for (const file of files) {
			await this.cardFactory.createCard(
				file,
				fragment as unknown as HTMLElement,
				activeFile,
				onFileOpen
			);
		}

		// 한 번에 DOM에 추가 (리플로우 1회)
		container.appendChild(fragment);
	}

	/**
	 * 다음 프레임까지 대기합니다
	 *
	 * @returns Promise (다음 프레임에서 resolve)
	 */
	private waitForNextFrame(): Promise<void> {
		return new Promise(resolve => {
			requestAnimationFrame(() => resolve());
		});
	}

	/**
	 * 청크 크기를 설정합니다
	 *
	 * @param size - 청크 크기 (1 이상)
	 */
	setChunkSize(size: number): void {
		if (size < 1) {
			throw new Error('Chunk size must be at least 1');
		}
		this.chunkSize = size;
		this.logger.debug('View', `Chunk size set to ${size}`);
	}

	/**
	 * 현재 청크 크기를 반환합니다
	 */
	getChunkSize(): number {
		return this.chunkSize;
	}
}
