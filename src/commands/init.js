/**
 * PDM-AI init command
 * Initializes a new PDM project with proper directory structure and configuration
 */
import path from 'path';
import projectManager from '../utils/project-manager.js';
import logger from '../utils/logger.js';

/**
 * Initialize a new PDM project
 * @param {string} projectName - Name of the project (optional)
 * @param {string} projectDir - Directory to create the project in (optional)
 * @returns {Promise<object>} - Promise resolving to an object with project info
 */
async function execute(projectName, projectDir) {
  try {
    // If no project directory specified, use current directory
    const targetDir = projectDir || process.cwd();
    
    // If no project name specified, use directory name
    const defaultName = path.basename(targetDir);
    const name = projectName || defaultName;
    
    // Check if directory is already a PDM project
    const existingProject = projectManager.findProjectRoot(targetDir);
    if (existingProject) {
      logger.warn(`A PDM project already exists at: ${existingProject}`);
      logger.info('Use existing project or choose a different directory.');
      return {
        success: false,
        projectName: name,
        projectDir: existingProject,
        message: 'A PDM project already exists'
      };
    }
    
    // Initialize the project
    const success = await projectManager.initializeProject(name, targetDir);
    
    if (success) {
      logger.info('');
      logger.info('Next steps:');
      logger.info('1. Place your raw text files in the .pdm/inputs/ directory');
      logger.info('2. Run `pdm scenario <input-file>` to extract user scenarios');
      logger.info('3. Run `pdm jtbd <scenarios-file>` to generate JTBDs');
      logger.info('4. Run `pdm visualize <jtbd-file>` to create visualizations');
      logger.info('');
    }
    
    return {
      success: success,
      projectName: name,
      projectDir: targetDir,
      message: success ? 'Project initialized successfully' : 'Project initialization failed'
    };
  } catch (error) {
    logger.error(`Initialization failed: ${error.message}`);
    return {
      success: false,
      projectName: projectName,
      projectDir: projectDir,
      message: `Error: ${error.message}`,
      error: error
    };
  }
}

export { execute };