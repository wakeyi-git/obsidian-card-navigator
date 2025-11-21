/**
 * Error Handler Utility
 *
 * Provides standardized error handling across the plugin with consistent
 * logging and user notification.
 */

import { Notice } from 'obsidian';
import { DebugLogger } from './DebugLogger';
import type { DebugCategory } from '../types';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
	/** Informational message, no action required */
	INFO = 'info',
	/** Warning that doesn't prevent functionality */
	WARNING = 'warning',
	/** Error that affects functionality but is recoverable */
	ERROR = 'error',
	/** Critical error that may prevent plugin operation */
	CRITICAL = 'critical',
}

/**
 * Context information for error tracking
 */
export interface ErrorContext {
	/** Category of the operation (e.g., 'Plugin', 'View', 'Card') */
	category: DebugCategory;
	/** Action that was being performed (e.g., 'save settings', 'render cards') */
	action: string;
	/** Additional data for debugging */
	data?: Record<string, unknown>;
}

/**
 * Error Handler
 *
 * Provides standardized error handling with consistent logging,
 * user notifications, and error recovery options.
 *
 * @example
 * ```ts
 * try {
 *   await someOperation();
 * } catch (error) {
 *   this.errorHandler.handle(
 *     error,
 *     ErrorSeverity.ERROR,
 *     { category: 'Plugin', action: 'save settings' },
 *     t().errors.settingsSaveFailed,
 *     true // shouldThrow
 *   );
 * }
 * ```
 */
export class ErrorHandler {
	constructor(private logger: DebugLogger) {}

	/**
	 * Handle an error with consistent logging and user notification
	 *
	 * @param error - The error object
	 * @param severity - How severe the error is
	 * @param context - Context information for debugging
	 * @param userMessage - Optional custom message to show user
	 * @param shouldThrow - Whether to re-throw the error after handling
	 */
	handle(
		error: unknown,
		severity: ErrorSeverity,
		context: ErrorContext,
		userMessage?: string,
		shouldThrow = false
	): void {
		const errorMessage = error instanceof Error ? error.message : String(error);

		// Log error with appropriate level
		this.logError(severity, context, errorMessage);

		// Show user notification based on severity
		if (severity === ErrorSeverity.ERROR || severity === ErrorSeverity.CRITICAL) {
			const message = userMessage || this.getDefaultMessage(context.action);
			const duration = severity === ErrorSeverity.CRITICAL ? 10000 : 5000;
			new Notice(message, duration);
		} else if (severity === ErrorSeverity.WARNING && userMessage) {
			new Notice(userMessage, 3000);
		}

		// Re-throw if needed
		if (shouldThrow) {
			throw error;
		}
	}

	/**
	 * Handle an async error with consistent logging and user notification
	 *
	 * Convenience wrapper for async operations that may throw errors.
	 *
	 * @param operation - Async operation to execute
	 * @param severity - How severe any error would be
	 * @param context - Context information for debugging
	 * @param userMessage - Optional custom message to show user
	 * @returns Result of the operation, or undefined if it failed
	 */
	async handleAsync<T>(
		operation: () => Promise<T>,
		severity: ErrorSeverity,
		context: ErrorContext,
		userMessage?: string
	): Promise<T | undefined> {
		try {
			return await operation();
		} catch (error) {
			this.handle(error, severity, context, userMessage, false);
			return undefined;
		}
	}

	/**
	 * Log error with appropriate level based on severity
	 */
	private logError(
		severity: ErrorSeverity,
		context: ErrorContext,
		errorMessage: string
	): void {
		const logMessage = `${context.action} failed`;
		const logData = {
			error: errorMessage,
			severity,
			...context.data,
		};

		switch (severity) {
			case ErrorSeverity.INFO:
				this.logger.debug(context.category, logMessage, logData);
				break;
			case ErrorSeverity.WARNING:
				this.logger.warn(context.category, logMessage, logData);
				break;
			case ErrorSeverity.ERROR:
			case ErrorSeverity.CRITICAL:
				this.logger.error(context.category, logMessage, logData);
				break;
		}
	}

	/**
	 * Get default user-facing error message
	 */
	private getDefaultMessage(action: string): string {
		return `Failed to ${action}`;
	}
}
