/**
 * Console Logger Utility
 *
 * Captures browser console logs and stores them in localStorage for debugging.
 * Useful for sharing console logs with Claude Code during development.
 *
 * Usage:
 * 1. Call setupConsoleLogger() in your app initialization
 * 2. Use console.log/info/warn/error as normal
 * 3. In browser console, run: window.exportLogs() to download logs
 * 4. Share the downloaded file with Claude Code
 */

interface LogEntry {
  timestamp: string
  level: 'LOG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  data?: any[]
}

const MAX_LOGS = 200 // Keep last 200 log entries
const STORAGE_KEY = 'airi-console-logs'

let logBuffer: LogEntry[] = []
let isSetup = false

/**
 * Setup console logger to capture all console output
 */
export function setupConsoleLogger() {
  if (isSetup) {
    console.warn('[ConsoleLogger] Already setup, skipping')
    return
  }

  // Load existing logs from localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      logBuffer = JSON.parse(stored)
    }
  }
  catch (error) {
    console.error('[ConsoleLogger] Failed to load existing logs:', error)
  }

  // Store original console methods
  const originalConsole = {
    info: console.info,
    warn: console.warn,
    error: console.error,
  }

  /**
   * Helper to add log entry to buffer and localStorage
   */
  const addLogEntry = (level: LogEntry['level'], args: any[]) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
      ).join(' '),
      data: args,
    }

    logBuffer.push(entry)

    // Keep only last MAX_LOGS entries
    if (logBuffer.length > MAX_LOGS) {
      logBuffer = logBuffer.slice(-MAX_LOGS)
    }

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logBuffer))
    }
    catch {
      // If localStorage is full, clear old logs and try again
      logBuffer = logBuffer.slice(-50)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logBuffer))
      }
      catch {
        // Give up if still failing
      }
    }
  }

  // Override console methods (except console.info which we use below)
  /* eslint-disable no-console */
  const originalLog = console.log
  console.log = (...args: any[]) => {
    addLogEntry('LOG', args)
    originalLog(...args)
  }
  /* eslint-enable no-console */

  console.info = (...args: any[]) => {
    addLogEntry('INFO', args)
    originalConsole.info(...args)
  }

  console.warn = (...args: any[]) => {
    addLogEntry('WARN', args)
    originalConsole.warn(...args)
  }

  console.error = (...args: any[]) => {
    addLogEntry('ERROR', args)
    originalConsole.error(...args)
  }

  // Add global helper functions
  const windowWithLogger = window as any

  /**
   * Export logs as a downloadable JSON file
   */
  windowWithLogger.exportLogs = () => {
    const logsJson = JSON.stringify(logBuffer, null, 2)
    const blob = new Blob([logsJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `airi-console-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    console.info(`[ConsoleLogger] Exported ${logBuffer.length} log entries`)
  }

  /**
   * Export logs as a readable text file
   */
  windowWithLogger.exportLogsText = () => {
    const logsText = logBuffer.map(entry =>
      `[${entry.timestamp}] [${entry.level}] ${entry.message}`,
    ).join('\n')

    const blob = new Blob([logsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `airi-console-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    console.info(`[ConsoleLogger] Exported ${logBuffer.length} log entries as text`)
  }

  /**
   * Clear all stored logs
   */
  windowWithLogger.clearLogs = () => {
    logBuffer = []
    localStorage.removeItem(STORAGE_KEY)
    console.info('[ConsoleLogger] All logs cleared')
  }

  /**
   * Show log statistics
   */
  windowWithLogger.logStats = () => {
    const stats = logBuffer.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.info('[ConsoleLogger] Statistics:', {
      total: logBuffer.length,
      ...stats,
      oldestLog: logBuffer[0]?.timestamp,
      newestLog: logBuffer[logBuffer.length - 1]?.timestamp,
    })
  }

  isSetup = true
  console.info('[ConsoleLogger] Setup complete. Available commands:')
  console.info('  - window.exportLogs()      : Download logs as JSON')
  console.info('  - window.exportLogsText()  : Download logs as text')
  console.info('  - window.clearLogs()       : Clear all logs')
  console.info('  - window.logStats()        : Show log statistics')
}

/**
 * Get current log buffer (for programmatic access)
 */
export function getLogs(): LogEntry[] {
  return [...logBuffer]
}

/**
 * Clear log buffer
 */
export function clearLogs() {
  logBuffer = []
  localStorage.removeItem(STORAGE_KEY)
}
