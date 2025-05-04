/**
 * Logging utility for PDM-AI
 * Provides configurable logging with different verbosity levels
 */
const config = require('./config');

class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[90m', // Grey
      reset: '\x1b[0m'   // Reset
    };
    this.currentLevel = null; // Will be determined from config if not manually set
  }

  /**
   * Get the current log level
   * @returns {number} The numeric log level
   */
  getLogLevel() {
    if (this.currentLevel !== null) {
      return this.currentLevel;
    }
    
    const configLevel = config.getConfig().logLevel;
    return this.levels[configLevel] !== undefined ? this.levels[configLevel] : this.levels.info;
  }

  /**
   * Set the current log level
   * @param {string} level - The log level (error, warn, info, debug)
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level];
      this.debug(`Log level set to ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}. Using default.`);
      this.currentLevel = this.levels.info;
    }
  }

  /**
   * Log a message if it meets the current log level
   * @param {string} level - The log level (error, warn, info, debug)
   * @param {string} message - The message to log
   */
  log(level, message) {
    if (this.levels[level] <= this.getLogLevel()) {
      const color = this.colors[level] || this.colors.reset;
      const timestamp = new Date().toISOString();
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
      console.log(`${color}${formattedMessage}${this.colors.reset}`);
    }
  }

  /**
   * Log an error message
   * @param {string} message - The error message
   */
  error(message) {
    this.log('error', message);
  }

  /**
   * Log a warning message
   * @param {string} message - The warning message
   */
  warn(message) {
    this.log('warn', message);
  }

  /**
   * Log an info message
   * @param {string} message - The info message
   */
  info(message) {
    this.log('info', message);
  }

  /**
   * Log a debug message
   * @param {string} message - The debug message
   */
  debug(message) {
    this.log('debug', message);
  }
}

module.exports = new Logger();