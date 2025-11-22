/**
 * Locale Utility Tests
 */

import { getMomentLocale } from '../../src/utils/locale';

describe('locale utilities', () => {
	describe('getMomentLocale', () => {
		let consoleWarnSpy: jest.SpyInstance;

		beforeEach(() => {
			// Spy on console.warn
			consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
		});

		afterEach(() => {
			consoleWarnSpy.mockRestore();
			// Clean up window.moment
			delete (window as any).moment;
		});

		it('should return locale from window.moment if available', () => {
			// Mock window.moment
			(window as any).moment = {
				locale: jest.fn().mockReturnValue('ko'),
			};

			const result = getMomentLocale();

			expect(result).toBe('ko');
			expect((window as any).moment.locale).toHaveBeenCalled();
		});

		it('should return "en" if window.moment is undefined', () => {
			// Ensure window.moment is undefined
			delete (window as any).moment;

			const result = getMomentLocale();

			expect(result).toBe('en');
		});

		it('should return "en" if window.moment.locale is undefined', () => {
			(window as any).moment = {};

			const result = getMomentLocale();

			expect(result).toBe('en');
		});

		it('should return "en" if window.moment.locale returns undefined', () => {
			(window as any).moment = {
				locale: jest.fn().mockReturnValue(undefined),
			};

			const result = getMomentLocale();

			expect(result).toBe('en');
		});

		it('should handle various locale codes', () => {
			const testCases = [
				'en',
				'ko',
				'zh-CN',
				'ja',
				'fr',
				'de',
				'es',
			];

			testCases.forEach(locale => {
				(window as any).moment = {
					locale: jest.fn().mockReturnValue(locale),
				};

				const result = getMomentLocale();
				expect(result).toBe(locale);
			});
		});

		it('should return "en" and log warning on error', () => {
			// Mock moment.locale to throw an error
			(window as any).moment = {
				locale: jest.fn().mockImplementation(() => {
					throw new Error('Moment error');
				}),
			};

			const result = getMomentLocale();

			expect(result).toBe('en');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'Failed to get moment locale:',
				expect.any(Error)
			);
		});

		it('should handle null window.moment gracefully', () => {
			(window as any).moment = null;

			const result = getMomentLocale();

			expect(result).toBe('en');
		});

		it('should handle non-function locale property', () => {
			(window as any).moment = {
				locale: 'not-a-function',
			};

			const result = getMomentLocale();

			expect(result).toBe('en');
		});

		it('should return "en" if locale() returns empty string', () => {
			(window as any).moment = {
				locale: jest.fn().mockReturnValue(''),
			};

			const result = getMomentLocale();

			// Empty string is falsy, so it should return 'en'
			expect(result).toBe('en');
		});

		it('should work with locale() returning null', () => {
			(window as any).moment = {
				locale: jest.fn().mockReturnValue(null),
			};

			const result = getMomentLocale();

			expect(result).toBe('en');
		});
	});
});
