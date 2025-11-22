/**
 * i18n (Internationalization) Module
 *
 * Provides translation functionality for the Card Navigator plugin.
 */

import { en, type TranslationKeys } from './locales/en';
import { ko } from './locales/ko';
import { zhCN } from './locales/zh-cn';
import { ja } from './locales/ja';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { de } from './locales/de';

export type Language = 'en' | 'ko' | 'zh-cn' | 'ja' | 'es' | 'fr' | 'de';
export type LanguageSetting = Language | 'auto';

// Re-export TranslationKeys type
export type { TranslationKeys } from './locales/en';

// Use TranslationKeys as the base type for all translations
const translations: Record<Language, TranslationKeys> = {
	en,
	ko: ko as unknown as TranslationKeys,
	'zh-cn': zhCN as unknown as TranslationKeys,
	ja: ja as unknown as TranslationKeys,
	es: es as unknown as TranslationKeys,
	fr: fr as unknown as TranslationKeys,
	de: de as unknown as TranslationKeys,
};

let currentLanguage: Language = 'en';

/**
 * Set the current language
 * @param lang - Language code to set
 */
export function setLanguage(lang: Language): void {
	if (lang in translations) {
		currentLanguage = lang;
	}
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
 * @returns Translation object for current language
 */
export function t(): TranslationKeys {
	return translations[currentLanguage];
}

/**
 * Get available languages
 * @returns Array of available language codes
 */
export function getAvailableLanguages(): Language[] {
	return Object.keys(translations) as Language[];
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
