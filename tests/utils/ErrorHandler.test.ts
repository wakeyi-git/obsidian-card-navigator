/**
 * ErrorHandler Tests
 */

import { Notice } from 'obsidian';
import { ErrorHandler, ErrorSeverity, ErrorContext } from '../../src/utils/ErrorHandler';
import { DebugLogger } from '../../src/utils/DebugLogger';

// Mock Notice
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
}));

describe('ErrorHandler', () => {
	let errorHandler: ErrorHandler;
	let mockLogger: jest.Mocked<DebugLogger>;

	beforeEach(() => {
		// Clear all mocks
		jest.clearAllMocks();

		// Create mock logger
		mockLogger = {
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		} as any;

		// Create error handler
		errorHandler = new ErrorHandler(mockLogger);
	});

	describe('handle', () => {
		const context: ErrorContext = {
			category: 'Plugin',
			action: 'test operation',
		};

		it('should log error with ERROR severity', () => {
			const error = new Error('Test error');

			errorHandler.handle(error, ErrorSeverity.ERROR, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Plugin',
				'test operation failed',
				expect.objectContaining({
					error: 'Test error',
					severity: ErrorSeverity.ERROR,
				})
			);
		});

		it('should log error with CRITICAL severity', () => {
			const error = new Error('Critical error');

			errorHandler.handle(error, ErrorSeverity.CRITICAL, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Plugin',
				'test operation failed',
				expect.objectContaining({
					error: 'Critical error',
					severity: ErrorSeverity.CRITICAL,
				})
			);
		});

		it('should log warning with WARNING severity', () => {
			const error = new Error('Warning');

			errorHandler.handle(error, ErrorSeverity.WARNING, context);

			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Plugin',
				'test operation failed',
				expect.objectContaining({
					error: 'Warning',
					severity: ErrorSeverity.WARNING,
				})
			);
		});

		it('should log debug with INFO severity', () => {
			const error = new Error('Info');

			errorHandler.handle(error, ErrorSeverity.INFO, context);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				'Plugin',
				'test operation failed',
				expect.objectContaining({
					error: 'Info',
					severity: ErrorSeverity.INFO,
				})
			);
		});

		it('should show Notice for ERROR severity', () => {
			const error = new Error('Test error');
			const userMessage = 'Operation failed';

			errorHandler.handle(error, ErrorSeverity.ERROR, context, userMessage);

			expect(Notice).toHaveBeenCalledWith(userMessage, 5000);
		});

		it('should show Notice with longer duration for CRITICAL severity', () => {
			const error = new Error('Critical error');
			const userMessage = 'Critical failure';

			errorHandler.handle(error, ErrorSeverity.CRITICAL, context, userMessage);

			expect(Notice).toHaveBeenCalledWith(userMessage, 10000);
		});

		it('should show Notice for WARNING severity only if userMessage provided', () => {
			const error = new Error('Warning');

			errorHandler.handle(error, ErrorSeverity.WARNING, context);
			expect(Notice).not.toHaveBeenCalled();

			errorHandler.handle(error, ErrorSeverity.WARNING, context, 'Warning message');
			expect(Notice).toHaveBeenCalledWith('Warning message', 3000);
		});

		it('should not show Notice for INFO severity', () => {
			const error = new Error('Info');

			errorHandler.handle(error, ErrorSeverity.INFO, context, 'Info message');

			expect(Notice).not.toHaveBeenCalled();
		});

		it('should use default message if userMessage not provided', () => {
			const error = new Error('Test error');

			errorHandler.handle(error, ErrorSeverity.ERROR, context);

			expect(Notice).toHaveBeenCalledWith('Failed to test operation', 5000);
		});

		it('should re-throw error if shouldThrow is true', () => {
			const error = new Error('Test error');

			expect(() => {
				errorHandler.handle(error, ErrorSeverity.ERROR, context, undefined, true);
			}).toThrow('Test error');
		});

		it('should not throw error if shouldThrow is false', () => {
			const error = new Error('Test error');

			expect(() => {
				errorHandler.handle(error, ErrorSeverity.ERROR, context, undefined, false);
			}).not.toThrow();
		});

		it('should handle non-Error objects', () => {
			const error = 'String error';

			errorHandler.handle(error, ErrorSeverity.ERROR, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Plugin',
				'test operation failed',
				expect.objectContaining({
					error: 'String error',
				})
			);
		});

		it('should include additional data in log', () => {
			const error = new Error('Test error');
			const contextWithData: ErrorContext = {
				category: 'Plugin',
				action: 'test operation',
				data: {
					fileName: 'test.md',
					lineNumber: 42,
				},
			};

			errorHandler.handle(error, ErrorSeverity.ERROR, contextWithData);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Plugin',
				'test operation failed',
				expect.objectContaining({
					error: 'Test error',
					severity: ErrorSeverity.ERROR,
					fileName: 'test.md',
					lineNumber: 42,
				})
			);
		});
	});

	describe('handleAsync', () => {
		const context: ErrorContext = {
			category: 'View',
			action: 'async operation',
		};

		it('should return result on success', async () => {
			const operation = jest.fn().mockResolvedValue('success');

			const result = await errorHandler.handleAsync(
				operation,
				ErrorSeverity.ERROR,
				context
			);

			expect(result).toBe('success');
			expect(operation).toHaveBeenCalled();
			expect(mockLogger.error).not.toHaveBeenCalled();
			expect(Notice).not.toHaveBeenCalled();
		});

		it('should handle error and return undefined on failure', async () => {
			const error = new Error('Async error');
			const operation = jest.fn().mockRejectedValue(error);

			const result = await errorHandler.handleAsync(
				operation,
				ErrorSeverity.ERROR,
				context,
				'Operation failed'
			);

			expect(result).toBeUndefined();
			expect(mockLogger.error).toHaveBeenCalled();
			expect(Notice).toHaveBeenCalledWith('Operation failed', 5000);
		});

		it('should not throw error even if operation fails', async () => {
			const operation = jest.fn().mockRejectedValue(new Error('Async error'));

			await expect(
				errorHandler.handleAsync(operation, ErrorSeverity.ERROR, context)
			).resolves.toBeUndefined();
		});

		it('should log error with WARNING severity', async () => {
			const error = new Error('Warning');
			const operation = jest.fn().mockRejectedValue(error);

			await errorHandler.handleAsync(
				operation,
				ErrorSeverity.WARNING,
				context
			);

			expect(mockLogger.warn).toHaveBeenCalledWith(
				'View',
				'async operation failed',
				expect.objectContaining({
					error: 'Warning',
					severity: ErrorSeverity.WARNING,
				})
			);
		});
	});

	describe('ErrorSeverity enum', () => {
		it('should have correct severity levels', () => {
			expect(ErrorSeverity.INFO).toBe('info');
			expect(ErrorSeverity.WARNING).toBe('warning');
			expect(ErrorSeverity.ERROR).toBe('error');
			expect(ErrorSeverity.CRITICAL).toBe('critical');
		});
	});
});
