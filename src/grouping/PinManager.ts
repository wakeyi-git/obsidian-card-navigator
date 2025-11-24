import { TFile } from 'obsidian';

/**
 * ⭐ Section 3.3: 핀 파일 분리 결과
 */
export interface PinPartition<T> {
	/** 핀된 항목 목록 */
	pinned: T[];
	/** 일반 항목 목록 */
	normal: T[];
}

/**
 * ⭐ Section 3.3: 핀 파일 처리 관리자
 *
 * 그룹화와 정렬에서 중복되던 핀 파일 처리 로직을 통합합니다.
 *
 * @remarks
 * 성능 최적화:
 * - Set 기반 빠른 조회 (O(1))
 * - 제네릭 partition 메서드로 재사용성 향상
 * - 핀 우선순위 로직을 한 곳에서 관리
 *
 * @example
 * ```typescript
 * const pinManager = new PinManager(['file1.md', 'file2.md']);
 *
 * // 파일이 핀되어 있는지 확인
 * if (pinManager.isPinned(file)) { ... }
 *
 * // 파일 목록을 핀/일반으로 분리
 * const { pinned, normal } = pinManager.partitionFiles(files);
 *
 * // 정렬 비교 함수에서 핀 우선순위 적용
 * const comparison = pinManager.comparePinPriority(fileA, fileB);
 * ```
 */
export class PinManager {
	/** 핀된 파일 경로 Set (빠른 조회를 위해) */
	private pinnedFilesSet: Set<string>;

	/** 핀된 파일 경로 배열 (순서 유지) */
	private pinnedFilesArray: string[];

	/**
	 * PinManager 생성자
	 *
	 * @param pinnedFiles - 핀된 파일 경로 배열 (순서 유지)
	 */
	constructor(pinnedFiles: string[] = []) {
		this.pinnedFilesArray = pinnedFiles;
		this.pinnedFilesSet = new Set(pinnedFiles);
	}

	/**
	 * 파일이 핀되어 있는지 확인합니다
	 *
	 * @param file - 확인할 파일
	 * @returns 핀 여부
	 *
	 * @remarks
	 * Set을 사용하여 O(1) 시간 복잡도로 조회합니다.
	 */
	isPinned(file: TFile): boolean {
		return this.pinnedFilesSet.has(file.path);
	}

	/**
	 * 파일 경로가 핀되어 있는지 확인합니다
	 *
	 * @param filePath - 확인할 파일 경로
	 * @returns 핀 여부
	 */
	isPinnedPath(filePath: string): boolean {
		return this.pinnedFilesSet.has(filePath);
	}

	/**
	 * 파일 목록을 핀/일반으로 분리합니다
	 *
	 * @param files - 분리할 파일 목록
	 * @returns 핀 파일과 일반 파일로 분리된 객체
	 *
	 * @remarks
	 * GroupingManager에서 사용하던 분리 로직을 통합합니다.
	 */
	partitionFiles(files: TFile[]): PinPartition<TFile> {
		const pinned: TFile[] = [];
		const normal: TFile[] = [];

		for (const file of files) {
			if (this.isPinned(file)) {
				pinned.push(file);
			} else {
				normal.push(file);
			}
		}

		return { pinned, normal };
	}

	/**
	 * 제네릭 항목 목록을 핀/일반으로 분리합니다
	 *
	 * @param items - 분리할 항목 목록
	 * @param getFile - 항목에서 파일을 가져오는 함수
	 * @returns 핀 항목과 일반 항목으로 분리된 객체
	 *
	 * @remarks
	 * 파일이 아닌 다른 타입(예: CardGroup, CardData 등)도 분리할 수 있습니다.
	 */
	partition<T>(items: T[], getFile: (item: T) => TFile): PinPartition<T> {
		const pinned: T[] = [];
		const normal: T[] = [];

		for (const item of items) {
			const file = getFile(item);
			if (this.isPinned(file)) {
				pinned.push(item);
			} else {
				normal.push(item);
			}
		}

		return { pinned, normal };
	}

	/**
	 * 두 파일의 핀 우선순위를 비교합니다
	 *
	 * @param fileA - 첫 번째 파일
	 * @param fileB - 두 번째 파일
	 * @returns 비교 결과
	 *   - -1: A가 B보다 앞(A가 핀되었거나, 둘 다 핀된 경우 A가 먼저 핀됨)
	 *   - 1: B가 A보다 앞(B가 핀되었거나, 둘 다 핀된 경우 B가 먼저 핀됨)
	 *   - 0: 핀 우선순위가 같음(둘 다 핀되지 않음)
	 *
	 * @remarks
	 * SortManager에서 사용하던 핀 우선순위 로직을 통합합니다.
	 * 이 메서드는 0을 반환하면 다른 정렬 기준을 적용해야 합니다.
	 */
	comparePinPriority(fileA: TFile, fileB: TFile): number {
		if (this.pinnedFilesSet.size === 0) {
			return 0; // 핀된 파일이 없으면 우선순위 없음
		}

		const aPath = fileA.path;
		const bPath = fileB.path;
		const aPinned = this.pinnedFilesSet.has(aPath);
		const bPinned = this.pinnedFilesSet.has(bPath);

		// 핀 여부가 다르면 핀된 파일 우선
		if (aPinned && !bPinned) return -1;
		if (!aPinned && bPinned) return 1;

		// 둘 다 핀되었으면 핀된 순서대로
		if (aPinned && bPinned) {
			const aIndex = this.pinnedFilesArray.indexOf(aPath);
			const bIndex = this.pinnedFilesArray.indexOf(bPath);
			return aIndex - bIndex;
		}

		// 둘 다 핀되지 않았으면 우선순위 없음
		return 0;
	}

	/**
	 * 핀된 파일 개수를 반환합니다
	 *
	 * @returns 핀된 파일 개수
	 */
	getPinnedCount(): number {
		return this.pinnedFilesSet.size;
	}

	/**
	 * 핀된 파일이 있는지 확인합니다
	 *
	 * @returns 핀된 파일 존재 여부
	 */
	hasPinnedFiles(): boolean {
		return this.pinnedFilesSet.size > 0;
	}

	/**
	 * 핀된 파일 경로 배열을 반환합니다
	 *
	 * @returns 핀된 파일 경로 배열 (순서 유지)
	 */
	getPinnedFiles(): string[] {
		return [...this.pinnedFilesArray];
	}
}
