import { App, FuzzySuggestModal, TFolder } from 'obsidian';
import { t } from '../i18n';

/**
 * 폴더 선택 모달
 * 
 * Vault의 모든 폴더를 검색하여 선택할 수 있습니다.
 */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private folders: TFolder[];
	private onChoose: (folder: TFolder | null) => void;

	/**
	 * 생성자
	 * 
	 * @param app - Obsidian App 객체
	 * @param onChoose - 폴더 선택 시 호출되는 콜백 함수
	 */
	constructor(app: App, onChoose: (folder: TFolder | null) => void) {
		super(app);
		this.onChoose = onChoose;
		
		// Vault의 모든 폴더 가져오기
		this.folders = this.getAllFolders();
		
		// 플레이스홀더 설정
		this.setPlaceholder(t().folderSuggest.placeholder);
	}

	/**
	 * Vault의 모든 폴더를 재귀적으로 가져옵니다
	 */
	private getAllFolders(): TFolder[] {
		const folders: TFolder[] = [];
		
		// 루트 폴더 추가
		const rootFolder = this.app.vault.getRoot();
		folders.push(rootFolder);
		
		// 재귀적으로 모든 하위 폴더 추가
		const collectFolders = (folder: TFolder) => {
			folder.children.forEach(child => {
				if (child instanceof TFolder) {
					folders.push(child);
					collectFolders(child);
				}
			});
		};
		
		collectFolders(rootFolder);
		
		return folders;
	}

	/**
	 * 검색 가능한 항목 목록을 반환합니다
	 */
	getItems(): TFolder[] {
		return this.folders;
	}

	/**
	 * 각 항목을 문자열로 변환합니다 (검색용)
	 */
	getItemText(folder: TFolder): string {
		// 루트 폴더는 "/ (루트)" 로 표시
		if (folder.path === '/') {
			return t().folderSuggest.rootFolder;
		}
		return folder.path;
	}

	/**
	 * 항목을 선택했을 때 호출됩니다
	 */
	onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(folder);
	}

	/**
	 * 모달 열기
	 */
	open(): void {
		super.open();
		
		// 추가 옵션: "활성 폴더 사용"을 상단에 표시하고 싶다면
		// 여기에 커스텀 엘리먼트를 추가할 수 있습니다
	}
}
