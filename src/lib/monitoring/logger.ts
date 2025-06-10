/**
 * Structured Logging Utility for Pure Golf Upload System
 * Provides consistent logging format for monitoring and debugging
 */

export interface LogContext {
  userId?: string;
  uploadSession?: string;
  swingId?: string;
  requestId?: string;
  operation?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  service: string;
  version: string;
}

class Logger {
  private service: string;
  private version: string;

  constructor(service: string = 'pure-upload', version: string = '1.0.0') {
    this.service = service;
    this.version = version;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      service: this.service,
      version: this.version
    };

    // In development, pretty print; in production, JSON
    if (process.env.NODE_ENV === 'development') {
      const contextStr = context ? `\n  Context: ${JSON.stringify(context, null, 2)}` : '';
      console.log(`[${level.toUpperCase()}] ${message}${contextStr}`);
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  // Specialized upload logging methods
  uploadStarted(context: LogContext): void {
    this.info('Upload session started', {
      ...context,
      operation: 'upload_start'
    });
  }

  uploadProgress(context: LogContext & { progress: number }): void {
    this.debug('Upload progress', {
      ...context,
      operation: 'upload_progress'
    });
  }

  uploadCompleted(context: LogContext & { filesUploaded: number; totalSize: number }): void {
    this.info('Upload session completed', {
      ...context,
      operation: 'upload_complete'
    });
  }

  uploadFailed(context: LogContext & { reason: string }): void {
    this.error('Upload session failed', {
      ...context,
      operation: 'upload_failed',
      error: context.reason
    });
  }

  rateLimitHit(context: LogContext): void {
    this.warn('Rate limit exceeded', {
      ...context,
      operation: 'rate_limit_exceeded'
    });
  }

  authenticationFailed(context: LogContext): void {
    this.warn('Authentication failed', {
      ...context,
      operation: 'auth_failed'
    });
  }

  validationFailed(context: LogContext & { validationError: string }): void {
    this.warn('File validation failed', {
      ...context,
      operation: 'validation_failed',
      error: context.validationError
    });
  }

  // Performance monitoring
  performanceMetric(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      operation,
      duration
    });
  }

  // Memory monitoring
  memoryUsage(context?: LogContext): void {
    const usage = process.memoryUsage();
    this.debug('Memory usage', {
      ...context,
      operation: 'memory_check',
      metadata: {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024)
      }
    });
  }
}

// Singleton instance
export const logger = new Logger();

// Helper function to generate request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to measure execution time
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.performanceMetric(operation, duration, context);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`${operation} failed`, {
      ...context,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
} 