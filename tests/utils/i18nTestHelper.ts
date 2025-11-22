/**
 * i18n Test Helper Utilities
 *
 * Provides utilities for testing internationalization in a consistent way.
 */

import { setLanguage, getLanguage, type Language } from '../../src/i18n';

/**
 * Set up test locale for consistent testing
 * @param locale - Language code to set ('en' or 'ko')
 */
export function setupTestLocale(locale: Language = 'en'): void {
	setLanguage(locale);
}

/**
 * Execute a test function with a specific locale, then restore the original locale
 * @param locale - Language code to use during test
 * @param testFn - Test function to execute
 * @returns Result of the test function
 */
export function withLocale<T>(locale: Language, testFn: () => T): T {
	const originalLocale = getLanguage();
	setLanguage(locale);
	try {
		return testFn();
	} finally {
		setLanguage(originalLocale);
	}
}

/**
 * Execute an async test function with a specific locale, then restore the original locale
 * @param locale - Language code to use during test
 * @param testFn - Async test function to execute
 * @returns Promise with result of the test function
 */
export async function withLocaleAsync<T>(
	locale: Language,
	testFn: () => Promise<T>
): Promise<T> {
	const originalLocale = getLanguage();
	setLanguage(locale);
	try {
		return await testFn();
	} finally {
		setLanguage(originalLocale);
	}
}
