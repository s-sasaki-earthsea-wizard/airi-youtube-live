/**
 * Type definitions for console logger global functions
 */

declare global {
  interface Window {
    /**
     * Export console logs as a downloadable JSON file
     * @example window.exportLogs()
     */
    exportLogs: () => void

    /**
     * Export console logs as a downloadable text file
     * @example window.exportLogsText()
     */
    exportLogsText: () => void

    /**
     * Clear all stored console logs
     * @example window.clearLogs()
     */
    clearLogs: () => void

    /**
     * Show console log statistics
     * @example window.logStats()
     */
    logStats: () => void
  }
}

export {}
