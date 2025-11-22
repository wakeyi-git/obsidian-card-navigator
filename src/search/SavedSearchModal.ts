import { App, Modal, Notice, setIcon } from 'obsidian';
import { SavedSearch } from '../types';
import CardNavigatorPlugin from '../main';
import { t } from '../i18n';

/**
 * 저장된 검색 관리 모달
 *
 * 저장된 검색을 보여주고 적용, 삭제, 즐겨찾기 등의 작업을 수행합니다.
 */
export class SavedSearchModal extends Modal {
    private plugin: CardNavigatorPlugin;
    private onApply: (query: string) => void;

    constructor(
        app: App,
        plugin: CardNavigatorPlugin,
        onApply: (query: string) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.onApply = onApply;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('saved-search-modal');

        // Header
        const header = contentEl.createEl('div', { cls: 'modal-title' });
        header.setText(t().savedSearches.savedSearches);

        // Favorites section
        const favorites = this.plugin.savedSearchManager.getFavoriteSavedSearches();
        if (favorites.length > 0) {
            this.renderSearchSection(
                contentEl,
                t().savedSearches.favorites,
                favorites
            );
        }

        // Recent searches section
        const recent = this.plugin.savedSearchManager.getRecentSavedSearches(10);
        this.renderSearchSection(
            contentEl,
            t().savedSearches.recentSearches,
            recent
        );

        // No searches message
        const allSearches = this.plugin.savedSearchManager.getAllSavedSearches();
        if (allSearches.length === 0) {
            contentEl.createEl('div', {
                cls: 'saved-search-empty',
                text: t().savedSearches.noSavedSearches
            });
        }
    }

    private renderSearchSection(
        container: HTMLElement,
        title: string,
        searches: SavedSearch[]
    ): void {
        if (searches.length === 0) return;

        const section = container.createEl('div', { cls: 'saved-search-section' });
        section.createEl('h3', { text: title });

        const list = section.createEl('div', { cls: 'saved-search-list' });

        searches.forEach(search => {
            this.renderSearchItem(list, search);
        });
    }

    private renderSearchItem(container: HTMLElement, search: SavedSearch): void {
        const item = container.createEl('div', { cls: 'saved-search-item' });

        // Favorite icon
        const favoriteBtn = item.createEl('div', {
            cls: `saved-search-favorite ${search.favorite ? 'is-favorite' : ''}`
        });
        setIcon(favoriteBtn, search.favorite ? 'star' : 'star-off');
        favoriteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.plugin.savedSearchManager.toggleFavorite(search.id);
            this.onOpen(); // Refresh
        });

        // Search info
        const info = item.createEl('div', { cls: 'saved-search-info' });
        info.createEl('div', {
            cls: 'saved-search-name',
            text: search.name
        });
        info.createEl('div', {
            cls: 'saved-search-query',
            text: search.query
        });

        // Apply button
        const applyBtn = item.createEl('div', { cls: 'saved-search-apply' });
        setIcon(applyBtn, 'play');
        applyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.applySearch(search);
        });

        // Delete button
        const deleteBtn = item.createEl('div', { cls: 'saved-search-delete' });
        setIcon(deleteBtn, 'trash');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.deleteSearch(search);
        });

        // Click on item to apply
        item.addEventListener('click', () => {
            this.applySearch(search);
        });
    }

    private applySearch(search: SavedSearch): void {
        this.plugin.savedSearchManager.updateLastUsed(search.id);
        this.onApply(search.query);
        new Notice(t().savedSearches.searchApplied(search.name));
        this.close();
    }

    private async deleteSearch(search: SavedSearch): Promise<void> {
        const confirmed = confirm(t().savedSearches.confirmDelete(search.name));
        if (!confirmed) return;

        await this.plugin.savedSearchManager.deleteSavedSearch(search.id);
        new Notice(t().savedSearches.searchDeleted(search.name));
        this.onOpen(); // Refresh
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * 검색 저장 모달
 *
 * 현재 검색어를 저장하기 위한 이름 입력 모달
 */
export class SaveSearchModal extends Modal {
    private plugin: CardNavigatorPlugin;
    private query: string;
    private nameInput: HTMLInputElement | null = null;

    constructor(app: App, plugin: CardNavigatorPlugin, query: string) {
        super(app);
        this.plugin = plugin;
        this.query = query;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('save-search-modal');

        // Header
        contentEl.createEl('h2', { text: t().savedSearches.saveSearch });

        // Query display
        contentEl.createEl('div', {
            cls: 'save-search-query',
            text: this.query
        });

        // Name input
        const inputContainer = contentEl.createEl('div', {
            cls: 'save-search-input-container'
        });
        inputContainer.createEl('label', { text: t().savedSearches.searchName });
        this.nameInput = inputContainer.createEl('input', {
            cls: 'save-search-input',
            attr: {
                type: 'text',
                placeholder: t().savedSearches.enterSearchName
            }
        }) as HTMLInputElement;

        this.nameInput.focus();
        this.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.save();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Buttons
        const buttonContainer = contentEl.createEl('div', {
            cls: 'save-search-buttons'
        });

        const saveBtn = buttonContainer.createEl('button', {
            cls: 'mod-cta',
            text: t().savedSearches.saveButton
        });
        saveBtn.addEventListener('click', () => this.save());

        const cancelBtn = buttonContainer.createEl('button', {
            text: t().savedSearches.cancelButton
        });
        cancelBtn.addEventListener('click', () => this.close());
    }

    private save(): void {
        if (!this.nameInput) return;

        const name = this.nameInput.value.trim();
        if (!name) {
            new Notice(t().savedSearches.enterSearchName);
            return;
        }

        this.plugin.savedSearchManager.createSavedSearch(name, this.query);
        new Notice(t().savedSearches.searchSaved(name));
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
