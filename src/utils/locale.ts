/**
 * Locale Utility Functions
 *
 * Provides safe access to locale-related functionality in Obsidian environment.
 */

/**
 * Safely get the current moment locale from Obsidian
 *
 * Obsidian provides a global moment instance that includes locale information.
 * This function provides safe access to that locale with proper error handling.
 *
 * @returns Current locale string (e.g., 'en', 'ko', 'zh-CN') or 'en' as fallback
 *
 * @example
 * ```ts
 * const locale = getMomentLocale();
 * console.log(locale); // 'ko' or 'en' etc.
 * ```
 */
export function getMomentLocale(): string {
	try {
		// Access window.moment safely with proper typing
		return window.moment?.locale?.() || 'en';
	} catch (error) {
		console.warn('Failed to get moment locale:', error);
		return 'en';
	}
}
