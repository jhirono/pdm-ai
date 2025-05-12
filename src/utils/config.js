/**
 * Configuration utility for PDM-AI
 * Handles loading and managing configurations from different sources
 */
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Config {
  constructor() {
    // Load .env file immediately on instantiation
    dotenv.config();

    this.config = {
      project: {
        name: null,
        creationDate: null,
      },
      llm: {
        apiKey: process.env.LLM_API_KEY || '',
        model: process.env.LLM_MODEL || 'gpt-4o',
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || process.env.MAX_TOKENS || '4000'),
        temperature: parseFloat(process.env.LLM_TEMPERATURE || process.env.TEMPERATURE || '0.7'),
      },
      language: process.env.LANGUAGE || 'en',
      logLevel: process.env.LOG_LEVEL || 'info',
    };

    // Log loaded configuration for debugging
    console.log(`Config initialized with language: ${this.config.language}`);

    this.projectRoot = null;
  }

  // Add direct property getters for commonly used properties
  get language() {
    return this.config.language;
  }

  get model() {
    return this.config.llm.model;
  }

  get maxTokens() {
    return this.config.llm.maxTokens;
  }

  get temperature() {
    return this.config.llm.temperature;
  }

  get llmApiKey() {
    return this.config.llm.apiKey;
  }

  /**
   * Load configuration from .env files in the following order:
   * 1. Project-specific .env (if provided)
   * 2. Global .env in user's home directory
   * 
   * @param {string} [projectPath] - Optional path to project directory
   * @returns {boolean} - True if any configuration was loaded
   */
  loadConfig(projectPath) {
    let configLoaded = false;

    // 1. Try project-specific .env if a project path is provided
    if (projectPath) {
      const projectEnvPath = path.join(projectPath, '.env');
      if (fs.existsSync(projectEnvPath)) {
        this.loadEnv(projectEnvPath);
        configLoaded = true;
      }
    }
    
    // 2. Try global .env if needed
    if (!configLoaded) {
      const globalEnvPath = path.join(os.homedir(), '.pdm-config', '.env');
      if (fs.existsSync(globalEnvPath)) {
        this.loadEnv(globalEnvPath);
        configLoaded = true;
      }
    }

    // Log updated configuration
    console.log(`Config loaded with language: ${this.config.language}`);
    return configLoaded;
  }

  /**
   * Load configuration from .env file
   * @param {string} envPath - Path to .env file
   * @returns {boolean} - True if successfully loaded
   */
  loadEnv(envPath) {
    try {
      if (fs.existsSync(envPath)) {
        const result = dotenv.config({ path: envPath });
        if (result.error) {
          throw result.error;
        }
        // Update config with new env values
        this.config.llm.apiKey = process.env.LLM_API_KEY || this.config.llm.apiKey;
        this.config.llm.model = process.env.LLM_MODEL || this.config.llm.model;
        this.config.llm.maxTokens = parseInt(process.env.LLM_MAX_TOKENS || process.env.MAX_TOKENS || this.config.llm.maxTokens);
        this.config.llm.temperature = parseFloat(process.env.LLM_TEMPERATURE || process.env.TEMPERATURE || this.config.llm.temperature);
        this.config.language = process.env.LANGUAGE || this.config.language;
        this.config.logLevel = process.env.LOG_LEVEL || this.config.logLevel;
        return true;
      }
    } catch (error) {
      console.error(`Error loading .env file: ${error.message}`);
    }
    return false;
  }

  /**
   * Load project configuration from .pdm directory
   * @param {string} projectPath - Path to project directory
   * @returns {boolean} - True if successfully loaded
   */
  loadProjectConfig(projectPath) {
    try {
      this.projectRoot = projectPath;
      const configPath = path.join(projectPath, '.pdm', 'config.json');
      if (fs.existsSync(configPath)) {
        const projectConfig = fs.readJsonSync(configPath);
        this.config.project = { ...this.config.project, ...projectConfig };
        return true;
      }
    } catch (error) {
      console.error(`Error loading project config: ${error.message}`);
    }
    return false;
  }

  /**
   * Save project configuration to .pdm directory
   * @returns {boolean} - True if successfully saved
   */
  saveProjectConfig() {
    try {
      if (!this.projectRoot) {
        throw new Error('Project root is not set');
      }
      
      const pdmDir = path.join(this.projectRoot, '.pdm');
      fs.ensureDirSync(pdmDir);
      
      const configPath = path.join(pdmDir, 'config.json');
      fs.writeJsonSync(configPath, this.config.project, { spaces: 2 });
      return true;
    } catch (error) {
      console.error(`Error saving project config: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the current configuration
   * @returns {Object} - Current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Update project configuration
   * @param {Object} projectConfig - Project configuration updates
   */
  updateProjectConfig(projectConfig) {
    this.config.project = { ...this.config.project, ...projectConfig };
  }

  /**
   * Generate default .env file based on .env.example
   * @param {string} envPath - Path to create the .env file
   * @returns {boolean} - True if successfully generated
   */
  generateEnvTemplate(envPath) {
    try {
      // First, try to find the .env.example file in the package root
      const packageRoot = path.resolve(__dirname, '../..');
      const envExamplePath = path.join(packageRoot, '.env.example');
      
      if (fs.existsSync(envExamplePath)) {
        // Copy the example file to the destination
        fs.copyFileSync(envExamplePath, envPath);
        console.log(`Created .env file from .env.example. Please update it with your API key.`);
        return true;
      } else {
        // Fallback to hardcoded template if .env.example is not found
        const envTemplate = `# PDM-AI Configuration
# -----------------------------
# This is a project-specific configuration file.
# You must set your LLM_API_KEY below to use PDM-AI.
#
# Get your OpenAI API key at: https://platform.openai.com/api-keys

# API key for LLM provider (REQUIRED)
LLM_API_KEY=

# Model to use for text generation 
LLM_MODEL=gpt-4o

# Maximum tokens for LLM responses
LLM_MAX_TOKENS=4000

# Randomness parameter (0.0-1.0)
LLM_TEMPERATURE=0.7

# Language (en or ja)
LANGUAGE=en

# Log level (debug, info, warn, error)
LOG_LEVEL=info
`;

        fs.writeFileSync(envPath, envTemplate);
        console.log(`Created default .env file. Please update it with your API key.`);
        return true;
      }
    } catch (error) {
      console.error(`Error generating .env template: ${error.message}`);
      return false;
    }
  }

  /**
   * Set up global configuration directory and template
   * @returns {boolean} - True if successfully set up
   */
  setupGlobalConfig() {
    try {
      const globalConfigDir = path.join(os.homedir(), '.pdm-config');
      const globalEnvPath = path.join(globalConfigDir, '.env');
      
      // Create directory if it doesn't exist
      fs.ensureDirSync(globalConfigDir);
      
      // Only create the template if it doesn't exist
      if (!fs.existsSync(globalEnvPath)) {
        this.generateEnvTemplate(globalEnvPath);
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting up global config: ${error.message}`);
      return false;
    }
  }
}

const config = new Config();
export default config;