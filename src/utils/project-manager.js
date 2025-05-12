/**
 * Project Manager utility for PDM-AI
 * Handles project initialization, directory structure management, and versioning
 */
import fs from 'fs-extra';
import path from 'path';
import config from './config.js';
import logger from './logger.js';

class ProjectManager {
  /**
   * Initialize a new PDM project
   * @param {string} projectName - Name of the project
   * @param {string} projectDir - Directory to create the project in
   * @returns {Promise<boolean>} - Promise resolving to success or failure
   */
  async initializeProject(projectName, projectDir) {
    try {
      logger.info(`Initializing project "${projectName}" in ${projectDir}`);
      
      // Create project directory if it doesn't exist
      if (!fs.existsSync(projectDir)) {
        logger.debug(`Creating project directory: ${projectDir}`);
        fs.mkdirSync(projectDir, { recursive: true });
      }
      
      // Set up the global configuration directory if it doesn't exist
      config.setupGlobalConfig();
      
      // Set project root in config
      config.projectRoot = projectDir;
      
      // Update and save project configuration
      const projectConfig = {
        name: projectName,
        creationDate: new Date().toISOString(),
        version: '0.1.0'
      };
      config.updateProjectConfig(projectConfig);
      
      // Create directory structure
      await this.createDirectoryStructure(projectDir);
      
      // Save project configuration
      config.saveProjectConfig();
      
      // Generate .env template
      const envPath = path.join(projectDir, '.env');
      if (!fs.existsSync(envPath)) {
        logger.debug('Generating .env template');
        config.generateEnvTemplate(envPath);
      }
      
      // Initialize version tracking
      await this.initializeVersionTracking(projectDir);
      
      logger.info(`Project "${projectName}" successfully initialized`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize project: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Create standard directory structure for a PDM project
   * @param {string} projectDir - Project directory
   * @returns {Promise<void>}
   */
  async createDirectoryStructure(projectDir) {
    logger.debug('Creating project directory structure');
    
    const directories = [
      // Main directories
      path.join(projectDir, '.pdm'),
      
      // Subdirectories for organization
      path.join(projectDir, '.pdm', 'inputs'),
      path.join(projectDir, '.pdm', 'inputs', 'raw'),
      path.join(projectDir, '.pdm', 'outputs'),
      path.join(projectDir, '.pdm', 'outputs', 'scenarios'),
      path.join(projectDir, '.pdm', 'outputs', 'jtbds'),
      path.join(projectDir, '.pdm', 'outputs', 'visualizations'),
      path.join(projectDir, '.pdm', 'versions'),
      path.join(projectDir, '.pdm', 'temp')
    ];
    
    // Create directories sequentially
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        logger.debug(`Creating directory: ${dir}`);
        await fs.mkdirp(dir);
      }
    }
    
    // Create initial README files with usage instructions
    await this.createReadmeFiles(projectDir);
  }
  
  /**
   * Create README files for project directories
   * @param {string} projectDir - Project directory
   * @returns {Promise<void>}
   */
  async createReadmeFiles(projectDir) {
    const readmeFiles = [
      {
        path: path.join(projectDir, 'README.md'),
        content: `# ${config.getConfig().project.name || 'PDM-AI Project'}

PDM-AI Project initialized on ${new Date().toLocaleDateString()}

## Structure
- \`.pdm/inputs/\`: Place your raw text files here for processing
- \`.pdm/outputs/\`: Generated scenarios, JTBDs, and visualizations
- \`.pdm/\`: Project configuration and version tracking

## Usage
- Use \`pdm scenario\` to extract scenarios from input files
- Use \`pdm jtbd\` to generate JTBDs from scenarios
- Use \`pdm visualize\` to create visual representations of your JTBDs
`
      },
      {
        path: path.join(projectDir, '.pdm', 'inputs', 'README.md'),
        content: `# Input Files

Place your raw text files in this directory for processing. These can be:
- Customer interview transcripts
- Feedback surveys
- Feature requests
- Support tickets
- Any text content with customer needs and feedback

## Usage
Run \`pdm scenario\` on files in this directory to extract user scenarios.
`
      }
    ];
    
    // Write files sequentially
    for (const file of readmeFiles) {
      if (!fs.existsSync(file.path)) {
        logger.debug(`Creating README: ${file.path}`);
        await fs.writeFile(file.path, file.content);
      }
    }
  }
  
  /**
   * Initialize version tracking system
   * @param {string} projectDir - Project directory
   * @returns {Promise<void>}
   */
  async initializeVersionTracking(projectDir) {
    logger.debug('Initializing version tracking system');
    
    const versionDir = path.join(projectDir, '.pdm', 'versions');
    const initialVersion = {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      command: 'init',
      changeType: 'initial',
      systemInfo: {
        os: process.platform,
        nodeVersion: process.version,
        applicationVersion: '0.1.0'
      }
    };
    
    const versionPath = path.join(versionDir, 'version_0.1.0.json');
    await fs.writeJson(versionPath, initialVersion, { spaces: 2 });
  }
  
  /**
   * Check if the current directory is within a PDM project
   * @param {string} dir - Directory to check
   * @returns {string|null} - Root directory of the project or null
   */
  findProjectRoot(dir) {
    // Start with the current directory and move up
    let currentDir = dir;
    
    while (currentDir !== path.parse(currentDir).root) {
      const pdmDir = path.join(currentDir, '.pdm');
      const configFile = path.join(pdmDir, 'config.json');
      
      if (fs.existsSync(configFile)) {
        return currentDir;
      }
      
      // Move up to parent directory
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }
}

const projectManager = new ProjectManager();
export default projectManager;