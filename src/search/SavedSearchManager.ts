import { SavedSearch } from '../types';
import CardNavigatorPlugin from '../main';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * 저장된 검색 관리 매니저
 *
 * 저장된 검색의 생성, 수정, 삭제, 적용을 관리합니다.
 */
export class SavedSearchManager {
    private logger: DebugLogger;

    constructor(private plugin: CardNavigatorPlugin) {
        // ✅ 함수를 전달하여 항상 최신 settings를 참조
        this.logger = new DebugLogger(() => this.plugin.settingsManager.getSettings());
    }

    /**
     * SavedSearchManager를 초기화합니다
     */
    async initialize(): Promise<void> {
        this.logger.debug('Search', 'Saved search manager initialized');
    }

    /**
     * 새로운 저장된 검색을 생성합니다
     *
     * @param name - 검색 이름
     * @param query - 검색 쿼리
     * @param favorite - 즐겨찾기 여부 (기본값: false)
     * @returns 생성된 SavedSearch 객체
     */
    createSavedSearch(name: string, query: string, favorite: boolean = false): SavedSearch {
        const settings = this.plugin.settingsManager.getSettings();

        const savedSearch: SavedSearch = {
            id: this.generateId(),
            name,
            query,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            favorite
        };

        settings.savedSearches.push(savedSearch);
        this.plugin.saveSettings();

        this.logger.debug('Search', 'Saved search created', {
            name,
            query,
            favorite
        });

        return savedSearch;
    }

    /**
     * 저장된 검색을 삭제합니다
     *
     * @param id - 삭제할 저장된 검색 ID
     */
    async deleteSavedSearch(id: string): Promise<void> {
        const settings = this.plugin.settingsManager.getSettings();
        const index = settings.savedSearches.findIndex(s => s.id === id);

        if (index === -1) {
            this.logger.warn('Search', 'Saved search not found', id);
            return;
        }

        const deleted = settings.savedSearches[index];
        settings.savedSearches.splice(index, 1);

        await this.plugin.saveSettings();
        this.logger.debug('Search', 'Saved search deleted', deleted.name);
    }

    /**
     * 저장된 검색을 업데이트합니다
     *
     * @param id - 업데이트할 저장된 검색 ID
     * @param name - 새로운 검색 이름
     * @param query - 새로운 검색 쿼리
     * @param favorite - 즐겨찾기 여부
     */
    async updateSavedSearch(
        id: string,
        name: string,
        query: string,
        favorite: boolean
    ): Promise<void> {
        const settings = this.plugin.settingsManager.getSettings();
        const savedSearch = settings.savedSearches.find(s => s.id === id);

        if (!savedSearch) {
            this.logger.warn('Search', 'Saved search not found', id);
            return;
        }

        savedSearch.name = name;
        savedSearch.query = query;
        savedSearch.favorite = favorite;

        await this.plugin.saveSettings();
        this.logger.debug('Search', 'Saved search updated', { name, query, favorite });
    }

    /**
     * 저장된 검색의 마지막 사용 시간을 업데이트합니다
     *
     * @param id - 저장된 검색 ID
     */
    async updateLastUsed(id: string): Promise<void> {
        const settings = this.plugin.settingsManager.getSettings();
        const savedSearch = settings.savedSearches.find(s => s.id === id);

        if (!savedSearch) {
            return;
        }

        savedSearch.lastUsed = Date.now();
        await this.plugin.saveSettings();
    }

    /**
     * 즐겨찾기 토글
     *
     * @param id - 저장된 검색 ID
     */
    async toggleFavorite(id: string): Promise<void> {
        const settings = this.plugin.settingsManager.getSettings();
        const savedSearch = settings.savedSearches.find(s => s.id === id);

        if (!savedSearch) {
            return;
        }

        savedSearch.favorite = !savedSearch.favorite;
        await this.plugin.saveSettings();

        this.logger.debug('Search', 'Favorite toggled', {
            name: savedSearch.name,
            favorite: savedSearch.favorite
        });
    }

    /**
     * 모든 저장된 검색을 가져옵니다
     *
     * @returns 저장된 검색 배열
     */
    getAllSavedSearches(): SavedSearch[] {
        return this.plugin.settingsManager.getSettings().savedSearches;
    }

    /**
     * 즐겨찾기 검색만 가져옵니다
     *
     * @returns 즐겨찾기 저장된 검색 배열
     */
    getFavoriteSavedSearches(): SavedSearch[] {
        return this.plugin.settingsManager.getSettings().savedSearches
            .filter(s => s.favorite);
    }

    /**
     * 최근 사용한 순서로 정렬된 저장된 검색을 가져옵니다
     *
     * @param limit - 반환할 최대 개수 (기본값: 10)
     * @returns 저장된 검색 배열
     */
    getRecentSavedSearches(limit: number = 10): SavedSearch[] {
        return this.plugin.settingsManager.getSettings().savedSearches
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, limit);
    }

    /**
     * ID로 저장된 검색을 가져옵니다
     *
     * @param id - 저장된 검색 ID
     * @returns SavedSearch 객체 또는 undefined
     */
    getSavedSearch(id: string): SavedSearch | undefined {
        return this.plugin.settingsManager.getSettings().savedSearches
            .find(s => s.id === id);
    }

    /**
     * 저장된 검색을 JSON 문자열로 내보냅니다
     *
     * @param id - 내보낼 저장된 검색 ID
     * @returns JSON 문자열 또는 빈 문자열
     */
    exportSavedSearch(id: string): string {
        const savedSearch = this.getSavedSearch(id);
        if (!savedSearch) {
            this.logger.warn('Search', 'Saved search not found for export', id);
            return '';
        }

        return JSON.stringify(savedSearch, null, 2);
    }

    /**
     * JSON 문자열로부터 저장된 검색을 가져옵니다
     *
     * @param json - 저장된 검색 JSON 문자열
     * @returns 가져오기 성공 여부
     */
    async importSavedSearch(json: string): Promise<boolean> {
        try {
            const savedSearch = JSON.parse(json) as SavedSearch;
            savedSearch.id = this.generateId();
            savedSearch.lastUsed = Date.now();

            this.plugin.settingsManager.getSettings().savedSearches.push(savedSearch);
            await this.plugin.saveSettings();

            this.logger.debug('Search', 'Saved search imported', savedSearch.name);
            return true;
        } catch (error) {
            this.logger.error('Search', 'Failed to import saved search', error);
            return false;
        }
    }

    /**
     * 고유 ID를 생성합니다
     */
    private generateId(): string {
        return `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
