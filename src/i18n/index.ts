/**
 * i18n (Internationalization) Module - Phase 4.3: Lazy Loading
 *
 * Provides translation functionality for the Card Navigator plugin.
 * Translation files are loaded on-demand to reduce initial bundle size.
 */

import { en, type TranslationKeys } from './locales/en';

export type Language = 'en' | 'ko' | 'zh-cn' | 'ja' | 'es' | 'fr' | 'de';
export type LanguageSetting = Language | 'auto';

// Re-export TranslationKeys type
export type { TranslationKeys } from './locales/en';

// ⭐ Phase 4.3: Lazy-loaded translation cache
// Only English is loaded immediately (default language)
// Other languages are loaded on-demand when setLanguage() is called
const translations: Partial<Record<Language, TranslationKeys>> = {
	en, // Always available
};

// ⭐ Track which languages are currently being loaded to prevent duplicate requests
const loadingLanguages = new Set<Language>();

let currentLanguage: Language = 'en';

/**
 * ⭐ Phase 4.3: Lazy load a translation file
 *
 * @param lang - Language to load
 * @returns Promise that resolves when the translation is loaded
 *
 * @remarks
 * - English is always available (pre-loaded)
 * - Other languages are loaded on first use
 * - Prevents duplicate loading with loadingLanguages Set
 * - Caches loaded translations for future use
 */
async function loadTranslation(lang: Language): Promise<void> {
	// English is always loaded
	if (lang === 'en') {
		return;
	}

	// Already loaded
	if (translations[lang]) {
		return;
	}

	// Currently loading
	if (loadingLanguages.has(lang)) {
		// Wait for the ongoing load to complete
		while (loadingLanguages.has(lang)) {
			await new Promise(resolve => setTimeout(resolve, 50));
		}
		return;
	}

	// Start loading
	loadingLanguages.add(lang);

	try {
		let translation: any;

		// Dynamic import based on language
		switch (lang) {
			case 'ko':
				translation = await import('./locales/ko');
				translations[lang] = translation.ko as unknown as TranslationKeys;
				break;
			case 'zh-cn':
				translation = await import('./locales/zh-cn');
				translations[lang] = translation.zhCN as unknown as TranslationKeys;
				break;
			case 'ja':
				translation = await import('./locales/ja');
				translations[lang] = translation.ja as unknown as TranslationKeys;
				break;
			case 'es':
				translation = await import('./locales/es');
				translations[lang] = translation.es as unknown as TranslationKeys;
				break;
			case 'fr':
				translation = await import('./locales/fr');
				translations[lang] = translation.fr as unknown as TranslationKeys;
				break;
			case 'de':
				translation = await import('./locales/de');
				translations[lang] = translation.de as unknown as TranslationKeys;
				break;
		}
	} finally {
		loadingLanguages.delete(lang);
	}
}

/**
 * Set the current language (synchronous)
 *
 * @param lang - Language code to set
 *
 * @remarks
 * This function sets the language immediately.
 * If the translation is not loaded, it will fall back to English temporarily.
 * Use setLanguageAsync() for guaranteed translation loading.
 */
export function setLanguage(lang: Language): void {
	currentLanguage = lang;

	// Trigger async load in background if not already loaded
	if (!translations[lang]) {
		loadTranslation(lang).catch(error => {
			console.error(`Failed to load translation for ${lang}:`, error);
		});
	}
}

/**
 * ⭐ Phase 4.3: Set the current language (async with guaranteed load)
 *
 * @param lang - Language code to set
 * @returns Promise that resolves when the language is set and loaded
 *
 * @remarks
 * This is the preferred method when you need to ensure translations are loaded
 * before continuing (e.g., during plugin initialization).
 */
export async function setLanguageAsync(lang: Language): Promise<void> {
	await loadTranslation(lang);
	currentLanguage = lang;
}

/**
 * Get the current language
 * @returns Current language code
 */
export function getLanguage(): Language {
	return currentLanguage;
}

/**
 * Get translation for the current language
 *
 * @returns Translation object for current language
 *
 * @remarks
 * If the current language is not loaded yet, falls back to English.
 * Uses Proxy for deep fallback: if a translation key is missing in the current language,
 * it automatically falls back to the English value for that specific key.
 * This ensures the plugin can always display text, even with incomplete translations.
 */
export function t(): TranslationKeys {
	// Get current language translation
	const translation = translations[currentLanguage];

	// Get English fallback (should always be available)
	const englishTranslation = translations.en;
	if (!englishTranslation) {
		console.error('English translation not loaded! This should never happen.');
		// Return English import directly as last resort
		return en;
	}

	// If current language is English or not loaded, return English
	if (currentLanguage === 'en' || !translation) {
		return englishTranslation;
	}

	// ⭐ Deep fallback using Proxy
	// If a key is missing in the current language, automatically use English value
	return createDeepFallbackProxy(translation, englishTranslation);
}

/**
 * Creates a Proxy that falls back to English for missing translation keys
 *
 * @param target - Current language translation object
 * @param fallback - English translation object (fallback)
 * @returns Proxied object with deep fallback support
 *
 * @remarks
 * This handles nested objects recursively, so even deeply nested keys
 * will fall back to English if missing in the current language.
 */
function createDeepFallbackProxy(target: any, fallback: any): any {
	return new Proxy(target, {
		get(obj, prop) {
			const value = obj[prop];
			const fallbackValue = fallback[prop];

			// If the value exists in current language
			if (value !== undefined) {
				// If it's an object (nested translations), create a proxy for it too
				if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					// Make sure fallback has the same structure
					if (typeof fallbackValue === 'object' && fallbackValue !== null) {
						return createDeepFallbackProxy(value, fallbackValue);
					}
					return value;
				}
				// Return primitive value (string, number, etc.)
				return value;
			}

			// Value is missing in current language, use English fallback
			if (fallbackValue !== undefined) {
				// Log missing translation for debugging (only in development)
				if (process.env.NODE_ENV === 'development') {
					console.warn(`Translation missing for '${String(prop)}' in ${currentLanguage}, using English`);
				}

				// If fallback is an object, create a proxy for it
				if (typeof fallbackValue === 'object' && fallbackValue !== null && !Array.isArray(fallbackValue)) {
					return createDeepFallbackProxy({}, fallbackValue);
				}
				return fallbackValue;
			}

			// Neither current language nor English has this key (shouldn't happen)
			console.error(`Translation key '${String(prop)}' not found in ${currentLanguage} or English`);
			return `[Missing: ${String(prop)}]`;
		}
	});
}

/**
 * Get available languages
 * @returns Array of available language codes
 *
 * @remarks
 * Returns all supported languages, not just loaded ones.
 * This ensures the settings UI shows all available language options.
 */
export function getAvailableLanguages(): Language[] {
	// Return all supported languages, not just loaded ones
	return ['en', 'ko', 'zh-cn', 'ja', 'es', 'fr', 'de'];
}

/**
 * Get language display name
 * @param lang - Language code
 * @returns Display name for the language
 */
export function getLanguageDisplayName(lang: Language): string {
	const displayNames: Record<Language, string> = {
		en: 'English',
		ko: '한국어',
		'zh-cn': '简体中文',
		ja: '日本語',
		es: 'Español',
		fr: 'Français',
		de: 'Deutsch',
	};
	return displayNames[lang] || lang;
}

/**
 * Detect language from Obsidian locale
 * @param obsidianLocale - Obsidian's locale string (e.g., 'en', 'ko', 'zh-CN')
 * @returns Supported language code
 */
export function detectLanguageFromLocale(obsidianLocale: string): Language {
	// Normalize the locale string
	const normalizedLocale = obsidianLocale.toLowerCase();

	// Handle special cases for Chinese variants
	if (normalizedLocale.startsWith('zh-cn') || normalizedLocale === 'zh') {
		return 'zh-cn';
	}

	// Extract the base language code (e.g., 'ko' from 'ko-KR')
	const baseLocale = normalizedLocale.split('-')[0];

	// Check if we support this language
	const availableLanguages = getAvailableLanguages();
	if (availableLanguages.includes(baseLocale as Language)) {
		return baseLocale as Language;
	}

	// Default to English if not supported
	return 'en';
}
