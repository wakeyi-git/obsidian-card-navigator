import { App, Menu, Notice, TFile } from 'obsidian';
import { DebugLogger } from '../utils/DebugLogger';
import { CardNavigatorSettings } from '../types';
import { t } from '../i18n';

/**
 * 카드 컨텍스트 메뉴
 * 
 * 카드 우클릭 시 표시되는 메뉴를 관리합니다.
 * 파일 열기, 링크 복사, 내용 복사, 파일 작업 기능을 제공합니다.
 */
export class CardContextMenu {
    private app: App;
    private logger: DebugLogger;

    constructor(app: App, getSettings: () => CardNavigatorSettings) {
        this.app = app;
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(getSettings);
    }

    /**
     * 컨텍스트 메뉴 표시
     * 
     * @param event - 마우스 이벤트
     * @param file - 대상 파일
     */
    show(event: MouseEvent, file: TFile): void {
        const menu = new Menu();

        menu.addItem(item => {
            item.setTitle(t().contextMenu.openInNewTab)
                .setIcon('file-plus')
                .onClick(() => {
                    const leaf = this.app.workspace.getLeaf('tab');
                    leaf.openFile(file);
                });
        });

        menu.addItem(item => {
            item.setTitle(t().contextMenu.openInNewWindow)
                .setIcon('popup-open')
                .onClick(() => {
                    const leaf = this.app.workspace.getLeaf('window');
                    leaf.openFile(file);
                });
        });

        menu.addItem(item => {
            item.setTitle(t().contextMenu.openInRightPanel)
                .setIcon('separator-vertical')
                .onClick(() => {
                    // 현재 활성 리프를 수직으로 분할 (오른쪽에 새 패널 생성)
                    const leaf = this.app.workspace.getLeaf('split', 'vertical');
                    leaf.openFile(file);
                });
        });

        menu.addSeparator();

        menu.addItem(item => {
            item.setTitle(t().contextMenu.copyWikiLink)
                .setIcon('link')
                .onClick(() => {
                    navigator.clipboard.writeText(`[[${file.basename}]]`);
                    new Notice(t().notices.contextMenu.markdownLinkCopied);
                });
        });

        menu.addItem(item => {
            item.setTitle(t().contextMenu.copyMarkdownLink)
                .setIcon('link')
                .onClick(() => {
                    const relativePath = file.path;
                    navigator.clipboard.writeText(`[${file.basename}](${relativePath})`);
                    new Notice(t().notices.contextMenu.markdownLinkCopied);
                });
        });

        menu.addItem(item => {
            item.setTitle(t().contextMenu.copyFilePath)
                .setIcon('folder')
                .onClick(() => {
                    navigator.clipboard.writeText(file.path);
                    new Notice(t().notices.contextMenu.filePathCopied);
                });
        });

        menu.addSeparator();

        menu.addItem(item => {
            item.setTitle(t().contextMenu.copyFullContent)
                .setIcon('copy')
                .onClick(async () => {
                    await this.copyFullContent(file);
                });
        });

        menu.addItem(item => {
            item.setTitle(t().contextMenu.copyFirstParagraph)
                .setIcon('copy')
                .onClick(async () => {
                    await this.copyFirstParagraph(file);
                });
        });

        menu.addSeparator();

        menu.addItem(item => {
            item.setTitle(t().contextMenu.rename)
                .setIcon('pencil')
                .onClick(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this.app as any).fileManager.promptForFileRename(file);
                });
        });

        menu.addItem(item => {
            item.setTitle(t().contextMenu.moveTo)
                .setIcon('folder-input')
                .onClick(() => {
                    // Obsidian의 내장 파일 이동 명령어 실행
                    // 파일을 먼저 활성화한 후 명령어 실행
                    const leaf = this.app.workspace.getLeaf(false);
                    leaf.openFile(file).then(() => {
                        // @ts-ignore - Obsidian 내부 API 사용
                        this.app.commands.executeCommandById('file-explorer:move-file');
                    });
                });
        });

        menu.addItem(item => {
            item.setTitle(t().contextMenu.delete)
                .setIcon('trash')
                .onClick(async () => {
                    await this.deleteFile(file);
                });
        });

        menu.showAtMouseEvent(event);
    }

    /**
     * 전체 내용 복사
     * 
     * @param file - 대상 파일
     */
    private async copyFullContent(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            await navigator.clipboard.writeText(content);
            new Notice(t().notices.contextMenu.fullContentCopied);
        } catch (error) {
            this.logger.error('UI', t().notices.contextMenu.contentCopyFailed, error);
            new Notice(t().notices.contextMenu.contentCopyFailed);
        }
    }

    /**
     * 첫 문단 복사
     * 
     * @param file - 대상 파일
     */
    private async copyFirstParagraph(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            
            const lines = content.split('\n');
            const firstParagraph: string[] = [];
            
            for (const line of lines) {
                if (line.trim() === '' && firstParagraph.length > 0) {
                    break;
                }
                if (line.trim() !== '') {
                    firstParagraph.push(line);
                }
            }

            const text = firstParagraph.join('\n');
            await navigator.clipboard.writeText(text);
            new Notice(t().notices.contextMenu.firstParagraphCopied);
        } catch (error) {
            this.logger.error('UI', t().notices.contextMenu.firstParagraphCopyFailed, error);
            new Notice(t().notices.contextMenu.firstParagraphCopyFailed);
        }
    }

    /**
     * 파일 삭제
     * 
     * 사용자 확인 후 파일을 삭제합니다.
     * 
     * @param file - 대상 파일
     */
    private async deleteFile(file: TFile): Promise<void> {
        const confirmDelete = confirm(t().notices.contextMenu.deleteConfirm(file.basename));

        if (!confirmDelete) return;

        try {
            await this.app.vault.delete(file);
            new Notice(t().notices.contextMenu.fileDeleted(file.basename));
        } catch (error) {
            this.logger.error('UI', t().notices.contextMenu.fileDeleteFailed, error);
            new Notice(t().notices.contextMenu.fileDeleteFailed);
        }
    }

    /**
     * 파일 메뉴 항목 등록
     * 
     * Obsidian의 파일 메뉴에 커스텀 항목을 추가할 수 있습니다.
     */
    registerFileMenuItems(): void {
        this.logger.debug('UI', t().notices.contextMenu.menuRegistered);
    }
}
