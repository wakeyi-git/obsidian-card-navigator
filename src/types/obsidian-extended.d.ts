/**
 * Extended type definitions for Obsidian environment
 *
 * This file extends the global Window interface to include
 * Obsidian-specific properties that are not in the official type definitions.
 */

import 'obsidian';

declare global {
	interface Window {
		/**
		 * Moment.js instance provided by Obsidian
		 * Used for locale detection and date formatting
		 */
		moment?: {
			/**
			 * Get or set the current locale
			 * @returns Current locale string (e.g., 'en', 'ko', 'zh-CN')
			 */
			locale: () => string;
		};
	}
}

export {};
