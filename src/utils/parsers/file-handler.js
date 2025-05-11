/**
 * File Handler
 * Handles loading and processing text files for scenario extraction
 */
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

class FileHandler {
  /**
   * Process a source file or directory
   * @param {string} sourcePath - Path to file or directory
   * @param {boolean} recursive - Whether to process directories recursively
   * @returns {Promise<Array>} - Array of source information objects
   */
  async processSource(sourcePath, recursive = false) {
    try {
      const sourceStat = await fs.stat(sourcePath);
      
      if (sourceStat.isFile()) {
        // Process a single file
        return [await this.processFile(sourcePath)];
      } else if (sourceStat.isDirectory()) {
        // Process a directory
        return await this.processDirectory(sourcePath, recursive);
      } else {
        logger.warn(`Unsupported source type: ${sourcePath}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error processing source ${sourcePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a directory of files
   * @param {string} dirPath - Path to directory
   * @param {boolean} recursive - Whether to process directories recursively
   * @returns {Promise<Array>} - Array of source information objects
   */
  async processDirectory(dirPath, recursive = false) {
    try {
      logger.info(`Processing directory: ${dirPath} (recursive: ${recursive})`);
      const entries = await fs.readdir(dirPath);
      
      const sources = [];
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const entryStat = await fs.stat(entryPath);
        
        if (entryStat.isFile()) {
          // Process files with supported extensions
          if (this.isSupportedFile(entryPath)) {
            sources.push(await this.processFile(entryPath));
          }
        } else if (recursive && entryStat.isDirectory()) {
          // Recursively process subdirectories
          const subSources = await this.processDirectory(entryPath, recursive);
          sources.push(...subSources);
        }
      }
      
      return sources;
    } catch (error) {
      logger.error(`Error processing directory ${dirPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a single file
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} - Source information object
   */
  async processFile(filePath) {
    try {
      logger.debug(`Processing file: ${filePath}`);
      
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Create source information object
      const sourceInfo = {
        id: `source-${uuidv4()}`,
        name: path.basename(filePath),
        type: this.detectFileType(filePath),
        path: filePath,
        date: new Date().toISOString().split('T')[0],
        content: content,
        metadata: {
          persona: this.detectPersona(filePath),
          industry: this.detectIndustry(filePath),
          customer: this.detectCustomer(filePath),
          language: this.detectLanguage(content)
        }
      };
      
      return sourceInfo;
    } catch (error) {
      logger.error(`Error processing file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a file is supported
   * @param {string} filePath - Path to file
   * @returns {boolean} - Whether the file is supported
   */
  isSupportedFile(filePath) {
    const supportedExtensions = ['.txt', '.md', '.csv', '.json'];
    const ext = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  /**
   * Detect the type of a file
   * @param {string} filePath - Path to file
   * @returns {string} - File type (e.g., 'interview', 'feedback', etc.)
   */
  detectFileType(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('interview')) return 'interview';
    if (fileName.includes('survey')) return 'survey';
    if (fileName.includes('feedback')) return 'feedback';
    if (fileName.includes('request')) return 'request';
    if (fileName.includes('ticket')) return 'ticket';
    
    return 'document';
  }

  /**
   * Detect persona from file path
   * @param {string} filePath - Path to file
   * @returns {string|null} - Persona or null
   */
  detectPersona(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    const dirName = path.basename(path.dirname(filePath)).toLowerCase();
    
    // Extract persona from naming patterns like ai-developer, business-decision-maker, etc.
    const personaPatterns = [
      'developer', 'business', 'decision-maker', 'enterprise-it', 
      'tech', 'user', 'customer', 'admin', 'manager'
    ];
    
    for (const pattern of personaPatterns) {
      if (fileName.includes(pattern) || dirName.includes(pattern)) {
        return pattern;
      }
    }
    
    return null;
  }

  /**
   * Detect industry from file path
   * @param {string} filePath - Path to file
   * @returns {string|null} - Industry or null
   */
  detectIndustry(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    const dirName = path.basename(path.dirname(filePath)).toLowerCase();
    
    const industryPatterns = [
      'finance', 'banking', 'healthcare', 'retail', 
      'technology', 'manufacturing', 'education'
    ];
    
    for (const pattern of industryPatterns) {
      if (fileName.includes(pattern) || dirName.includes(pattern)) {
        return pattern;
      }
    }
    
    return null;
  }

  /**
   * Detect customer from file path
   * @param {string} filePath - Path to file
   * @returns {string|null} - Customer or null
   */
  detectCustomer(filePath) {
    const parts = filePath.split(path.sep);
    
    // Check if the directory structure includes customer name in a standard format
    for (const part of parts) {
      if (part.startsWith('customer-') || part.startsWith('client-')) {
        return part.replace('customer-', '').replace('client-', '');
      }
    }
    
    return null;
  }

  /**
   * Detect language from content
   * @param {string} content - File content
   * @returns {string} - Language code ('en', 'ja', etc.)
   */
  detectLanguage(content) {
    // Simple language detection based on character sets
    const japaneseChars = content.match(/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/g);
    
    if (japaneseChars && japaneseChars.length > 10) {
      return 'ja';
    }
    
    return 'en';
  }
}

// Export as default
const fileHandler = new FileHandler();
export default fileHandler;