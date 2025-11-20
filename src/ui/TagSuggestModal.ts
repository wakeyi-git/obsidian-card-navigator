import { App, FuzzySuggestModal, CachedMetadata } from 'obsidian';

/**
 * 태그 선택 모달
 * 
 * MetadataCache를 활용하여 Vault의 모든 태그를 검색합니다.
 */
export class TagSuggestModal extends FuzzySuggestModal<string> {
	private tags: string[];
	private onChoose: (tag: string | null) => void;

	constructor(app: App, onChoose: (tag: string | null) => void) {
		super(app);
		this.onChoose = onChoose;
		this.tags = this.getAllTags();
		this.setPlaceholder('태그를 선택하세요...');
	}

	/**
	 * Vault의 모든 태그를 효율적으로 가져옵니다
	 * 
	 * @remarks
	 * MetadataCache를 활용하여 캐시된 데이터만 사용합니다.
	 * 파일을 직접 읽지 않으므로 빠르게 동작합니다.
	 */
	private getAllTags(): string[] {
		const tagSet = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();
		
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			
			// 캐시가 없으면 건너뛰기 (안전성)
			if (!cache) continue;
			
			// 본문 태그 수집
			this.collectInlineTags(cache, tagSet);
			
			// 프론트매터 태그 수집
			this.collectFrontmatterTags(cache, tagSet);
		}
		
		return Array.from(tagSet).sort();
	}

	/**
	 * 본문의 인라인 태그를 수집합니다 (#tag 형식)
	 */
	private collectInlineTags(
		cache: CachedMetadata, 
		tagSet: Set<string>
	): void {
		if (!cache.tags) return;
		
		for (const tagCache of cache.tags) {
			// null 체크 간소화
			if (tagCache?.tag) {
				tagSet.add(tagCache.tag);
			}
		}
	}

	/**
	 * 프론트매터의 태그를 수집합니다
	 */
	private collectFrontmatterTags(
		cache: CachedMetadata,
		tagSet: Set<string>
	): void {
		const frontmatterTags = cache.frontmatter?.tags;
		if (!frontmatterTags) return;
		
		// 배열 처리 일원화
		const tagsArray = Array.isArray(frontmatterTags) 
			? frontmatterTags 
			: [frontmatterTags];
		
		for (const tag of tagsArray) {
			const normalizedTag = this.normalizeTag(tag);
			if (normalizedTag) {
				tagSet.add(normalizedTag);
			}
		}
	}

	/**
	 * 태그를 정규화합니다 (#을 붙이고, 유효성 검사)
	 */
	private normalizeTag(tag: unknown): string | null {
		// 문자열이 아니거나 빈 문자열이면 null
		if (typeof tag !== 'string' || !tag.trim()) {
			return null;
		}
		
		// #이 없으면 추가
		return tag.startsWith('#') ? tag : `#${tag}`;
	}

	getItems(): string[] {
		return this.tags;
	}

	getItemText(tag: string): string {
		return tag;
	}

	onChooseItem(tag: string, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(tag);
	}
}