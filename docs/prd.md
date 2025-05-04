# Product Requirements Document: PDM-AI

## 1. Product Overview

PDM-AI is a command-line interface (CLI) tool designed to transform customer feedback into structured product insights using the Jobs-to-be-Done (JTBD) methodology. The tool helps product managers and UX researchers extract user scenarios from raw feedback, cluster them into meaningful JTBDs, and visualize these insights for better decision-making.

This document outlines a streamlined implementation focused on core functionality with support for incremental processing of feedback data.

## 2. Core Commands

PDM-AI provides four primary commands that form a coherent workflow for processing customer feedback:

### 2.1 pdm init
Initialize a new PDM project structure to store feedback, scenarios, JTBDs, and visualization outputs with proper versioning support.

```
pdm init [--name=<project-name>] [--dir=<project-directory>]
```

- Creates a project structure with directories for inputs, outputs, and configuration
- Sets up a `.pdm` configuration directory to track project state
- Initializes version tracking for incremental processing
- Generates default configuration files and templates

### 2.2 pdm scenario
Extract user scenarios from input text files in the format "As a [persona], I want to [action], so that I can [value/goal]".

```
pdm scenario <source> [--output=<path>] [--recursive] [--model=<llm-model>] [--verbose]
```

- Supports processing individual files or directories
- Extracts well-formed user stories that follow the "As a, I want to, so that" format
- Maintains source attribution with file paths and timestamps
- Supports recursive directory processing
- Preserves unique IDs for incremental updates
- Verbose mode provides detailed output during processing

### 2.3 pdm jtbd
Generate Jobs-to-be-Done (JTBDs) from user scenarios through semantic clustering and abstraction, with support for two-layer abstraction.

```
pdm jtbd <input> [--output=<path>] [--model=<llm-model>] [--layers=<1|2>] [--incremental] [--verbose]
```

- Clusters similar scenarios based on semantic meaning
- Generates JTBDs in the format "When [situation], I want to [motivation], so I can [expected outcome]"
- Creates hierarchical JTBD structure with two abstraction layers when specified
- Maintains relationships between JTBDs and original scenarios
- Features automatic threshold tuning based on desired abstraction layers
- Supports incremental updates to add new scenarios to existing JTBDs
- Verbose mode provides detailed output during processing

### 2.4 pdm visualize
Create visual representations of JTBDs and user scenarios to identify patterns and priorities.

```
pdm visualize <input> [--format=<format>] [--view=<view>] [--output=<path>] [--filter=<query>]
```

- Generates Mermaid diagrams (default) with options to export to Figma and Miro
- Supports multiple visualization views (JTBD-centric, persona-centric)
- Highlights importance through visual styling
- Maintains source traceability in visualizations
- Shows incremental changes in different versions

## 3. System Architecture

### 3.1 Core Components

1. **Project Manager**: Handles project initialization and structure management
2. **Parser**: Extracts structured scenarios from raw text using LLM
3. **Clustering Engine**: Groups similar scenarios using embedding models
4. **JTBD Generator**: Creates abstract JTBDs from scenario clusters using LLM
5. **Abstraction Engine**: Creates higher-level JTBDs from first-level JTBDs
6. **Visualization Generator**: Creates visual representations of the insights
7. **State Manager**: Tracks project versions and manages incremental updates
8. **Version Controller**: Manages versioning across all data artifacts with comprehensive metadata

### 3.2 Data Flow

1. Raw text files → Parser → Structured User Scenarios (JSON)
2. User Scenarios → Clustering Engine → Scenario Clusters
3. Scenario Clusters → JTBD Generator → First-layer JTBDs (JSON)
4. First-layer JTBDs → Abstraction Engine → Second-layer JTBDs (JSON)
5. JTBD Hierarchy → Visualization Generator → Visual Diagrams (Mermaid/Figma/Miro)

### 3.3 Incremental Processing Flow

1. New text files → Parser → New User Scenarios
2. New + Existing Scenarios → Clustering Engine → Updated Clusters
3. Updated Clusters → JTBD Generator → Updated JTBDs with version tracking
4. Updated JTBDs → Visualization with change highlighting

## 4. Data Structures

### 4.1 User Scenario Structure

```json
{
  "id": "scenario-001",
  "format": "user-story",
  "statement": "As a mobile user, I want to see my account balance with one tap, so that I can quickly check funds before making a purchase",
  "persona": "Mobile User",
  "action": "see my account balance with one tap",
  "value": "quickly check funds before making a purchase",
  "sources": ["source-001"],
  "customer": "Acme Bank",
  "version": "1.0",
  "timestamp": "2025-05-04T10:30:00Z"
}
```

### 4.2 JTBD Structure

```json
{
  "id": "jtbd-001",
  "statement": "When I'm away from my computer, I want to quickly check my account balance, so I can make informed spending decisions",
  "sources": ["source-001", "source-003"],
  "customer": ["Acme Bank", "Metro Financial"],
  "relatedScenarios": ["scenario-001", "scenario-005"],
  "level": 1,
  "parentId": "jtbd-100",
  "childIds": [],
  "version": "1.0",
  "timestamp": "2025-05-04T11:45:00Z"
}
```

### 4.3 Source Structure

```json
{
  "id": "source-001",
  "name": "customer_interview_2025_05_01.txt",
  "type": "interview",
  "path": "/inputs/interviews/customer_interview_2025_05_01.txt",
  "date": "2025-05-01",
  "metadata": {
    "persona": "Product Manager",
    "industry": "Finance",
    "customer": "Acme Bank",
    "language": "en"
  }
}
```

### 4.4 Version Tracking Structure

```json
{
  "version": "1.0",
  "timestamp": "2025-05-04T14:30:00Z",
  "command": "jtbd",
  "inputFiles": ["scenarios_v1.0.json"],
  "outputFiles": ["jtbds_v1.0.json"],
  "sourceCount": 5,
  "scenarioCount": 28,
  "jtbdCount": 8,
  "jtbdLayers": 2,
  "changeType": "initial",
  "changedEntities": {
    "added": ["scenario-001", "scenario-002"],
    "modified": ["jtbd-001"],
    "deleted": []
  },
  "systemInfo": {
    "os": "macOS",
    "nodeVersion": "v18.15.0",
    "applicationVersion": "1.0.0"
  }
}
```

## 5. Configuration

PDM-AI uses a `.env` file for configuration with the following parameters:

```
LLM_API_KEY=xxxx                # API key for LLM provider
LLM_MODEL=gpt-4o                # Model to use for text generation
MAX_TOKENS=4000                 # Maximum tokens for LLM responses
TEMPERATURE=0.7                 # Randomness parameter (0.0-1.0)
LANGUAGE=en                     # Language (en or ja)
```

The system should be designed to support multiple LLM providers:
- OpenAI (default in MVP)
- Google (future extension)
- Anthropic (future extension)

## 6. Incremental Processing Support

### 6.1 Enhanced Version Control

- Implement comprehensive version tracking that captures:
  - Full command history with parameters used
  - Timestamp, user, and environment information
  - Detailed change logs (added, modified, deleted entities)
  - Hash-based verification for data integrity
  - Parent-child relationships between versions
- Support for version tagging with custom labels
- Ability to rollback to any previous version
- Differential comparisons between any two versions
- Visual representation of version history as a timeline

### 6.2 Incremental Scenario Processing

- Add new scenarios while preserving existing ones
- Assign unique IDs to ensure no conflicts during merging
- Track original source file for each scenario

### 6.3 Incremental JTBD Generation

- Add new scenarios to existing clusters where appropriate
- Create new clusters for scenarios that don't fit existing ones
- Update JTBDs based on new scenarios while preserving existing structure
- Track changes to JTBDs across versions
- Maintain hierarchical relationships in two-layer abstraction

### 6.4 Differential Visualization

- Highlight new scenarios and JTBDs in visualizations
- Show version differences with visual indicators
- Support viewing historical versions

### 6.5 Automatic Threshold Tuning

- Dynamically adjust clustering thresholds based on:
  - Number of input scenarios
  - Semantic similarity distribution
  - Desired abstraction layers
  - Target number of JTBDs per layer
- Implement adaptive algorithms that balance:
  - Coverage (ensuring all scenarios are represented)
  - Coherence (ensuring JTBDs are meaningful and distinct)
  - Hierarchical consistency (ensuring parent-child relationships are logical)
- Provide feedback on threshold selection in verbose mode
- Allow for manual overrides when necessary

### 6.6 Generic Customer Field Extraction

- Use LLM to intelligently extract customer information from input text regardless of format
- Implement entity recognition techniques to identify:
  - Company names and abbreviations
  - Brand references
  - Industry-specific terminology
  - Contextual clues about customer identity
- Support multiple languages for customer extraction (English, Japanese, etc.)
- Consolidate different references to the same customer
- Allow for confidence scoring of extracted customer names
- Enable manual correction and standardization of customer names

## 7. Implementation Plan

### 7.1 Phase 1: Core Functionality (1-2 weeks)

#### 7.1.1 Project Setup and Initialization (2-3 days)
- Set up Node.js project structure with proper packaging
- Implement `pdm init` command with the following capabilities:
  - Create standardized directory structure (inputs/, outputs/, .pdm/)
  - Generate configuration templates (.env file)
  - Set up version tracking system
  - Initialize an empty project with metadata (name, creation date)
- Build configuration loading mechanism with support for:
  - Environment variables
  - Default configurations
  - Project-specific overrides
- Develop logging system with configurable verbosity levels

#### 7.1.2 User Scenario Extraction (3-4 days)
- Implement input file handling with support for:
  - Single file processing
  - Directory processing with recursive option
  - Multi-language detection (English/Japanese)
- Build OpenAI API integration with:
  - Proper error handling and rate limiting
  - Tokenization management
  - Context optimization for large files
- Develop LLM prompting for user scenario extraction:
  - Create effective prompt templates
  - Parse "As a [persona], I want to [action], so that I can [value/goal]" format
  - Extract customer information using entity recognition
- Implement source tracking and attribution:
  - Generate unique IDs for scenarios
  - Maintain file paths and timestamps
  - Store original text snippets

#### 7.1.3 JTBD Generation with Clustering (4-5 days)
- Implement embedding generation using text-embedding-3-large:
  - Create vector representations of scenarios
  - Cache embeddings for performance
  - Handle batching for large scenario sets
- Build adaptive clustering algorithm:
  - Implement similarity calculation between scenarios
  - Develop automatic threshold tuning based on scenario count and similarity distribution
  - Create cluster validation mechanism
- Implement JTBD generation from scenario clusters:
  - Create effective prompts for "When [situation], I want to [motivation], so I can [expected outcome]" format
  - Maintain relationships between JTBDs and source scenarios
  - Aggregate customer information from scenarios to JTBDs
- Add version tracking and incremental capability:
  - Store version information with each processing run
  - Save intermediate results for incremental updates

#### 7.1.4 Basic Visualization (2-3 days)
- Implement Mermaid diagram generation:
  - Create JTBD-centric view showing relationships to scenarios
  - Build persona-centric view grouping scenarios by persona
- Develop styling and formatting:
  - Add color coding for different entity types
  - Use styling to represent relationships
  - Include metadata in node labels
- Build output generation:
  - Create proper file output with headers
  - Support different output formats
  - Add timestamp and version information to outputs

#### 7.1.5 Integration and Testing (2-3 days)
- Develop end-to-end workflow integration:
  - Connect all modules into a coherent process
  - Ensure proper data flow between components
  - Implement error handling and recovery
- Create test harness:
  - Develop tests for each major component
  - Create integration tests with sample data
  - Test with English and Japanese content
- Build validation tools:
  - Implement data structure validation
  - Create quality checks for extracted scenarios and JTBDs
  - Set up performance monitoring

### 7.2 Phase 2: Advanced Features (1 week)
// ...existing code...

### 7.3 Phase 3: Refinement (1 week)
// ...existing code...

## 8. Success Criteria

The PDM-AI implementation will be considered successful when:

1. It can extract meaningful user scenarios from text files with >80% accuracy
2. It can cluster similar scenarios and generate relevant JTBDs
3. It can create hierarchical JTBDs with two layers of abstraction
4. It can incrementally process new feedback without losing previous insights
5. It can visualize the relationships between JTBDs and scenarios across versions
6. It maintains complete traceability from JTBDs back to source content
7. It supports both English and Japanese inputs/outputs
8. The entire process is executable through four simple CLI commands
9. It can export visualizations to industry-standard tools like Figma and Miro

## 9. Technical Stack

- Node.js for core application
- OpenAI API for LLM capabilities
- text-embedding-3-large for embeddings
- Commander.js for CLI structure
- Mermaid.js for visualization generation
- dotenv for configuration management
- fs-extra for enhanced file operations
- Figma API and Miro API for extended visualization exports

## 10. Test Scenarios

The following test scenarios will be used to validate the PDM-AI implementation, using both English and Japanese input files:

### 10.1 Initial Processing Test

#### English Content Test
```bash
# Initialize project
pdm init --name="AI Platform Insights" --dir="ai-platform-project"

# Extract user scenarios from English content
pdm scenario ./docs/sample_inputs/aiplat2/ --output=./output/scenarios_en.json --recursive --verbose

# Generate first-layer JTBDs
pdm jtbd ./output/scenarios_en.json --output=./output/jtbds_1layer_en.json --layers=1 --verbose

# Generate two-layer JTBDs
pdm jtbd ./output/scenarios_en.json --output=./output/jtbds_2layers_en.json --layers=2 --verbose

# Visualize JTBD hierarchy
pdm visualize ./output/jtbds_2layers_en.json --format=mermaid --view=jtbd --output=./output/jtbd_viz_en.md
```

**Expected Results:**
- From aiplat2 English files, extract at least 20 user scenarios from various perspectives
- Customer names like "Global Energy Corporation", "Healthcare Provider Network" should be properly captured
- Generate approximately 5-8 top-level JTBDs and 10-15 second-level JTBDs
- Visualization should show clear hierarchical relationships

#### Japanese Content Test
```bash
# Extract user scenarios from Japanese content
pdm scenario ./docs/sample_inputs/lazuli.txt --output=./output/scenarios_ja.json --verbose

# Generate JTBDs from Japanese scenarios
pdm jtbd ./output/scenarios_ja.json --output=./output/jtbds_ja.json --layers=2 --verbose

# Visualize JTBD hierarchy
pdm visualize ./output/jtbds_ja.json --format=mermaid --view=jtbd --output=./output/jtbd_viz_ja.md
```

**Expected Results:**
- From lazuli.txt, extract at least 15 user scenarios
- Customer names like "Mizkan Holdings", "アシックス", "村田製作所" should be properly captured
- Generate hierarchical JTBDs that reflect common themes across different companies
- Visualization should be properly rendered with Japanese characters

### 10.2 Incremental Processing Test

```bash
# Extract user scenarios from new content
pdm scenario ./docs/sample_inputs/aiplat/ --output=./output/new_scenarios.json --recursive

# Incrementally update JTBDs with new scenarios
pdm jtbd ./output/new_scenarios.json --output=./output/updated_jtbds.json --layers=2 --incremental --verbose

# Visualize updated JTBD hierarchy with changes highlighted
pdm visualize ./output/updated_jtbds.json --format=mermaid --view=jtbd --output=./output/updated_viz.md
```

**Expected Results:**
- New scenarios should be extracted from aiplat files
- Existing JTBD structure should be maintained where appropriate
- New scenarios should be incorporated into existing JTBDs or create new ones as needed
- Visualization should highlight which JTBDs and scenarios are new or modified

### 10.3 Cross-Language Integration Test

```bash
# Combine English and Japanese scenarios
pdm scenario ./docs/sample_inputs/aiplat2/ ./docs/sample_inputs/lazuli.txt --output=./output/combined_scenarios.json --recursive

# Generate JTBDs from combined scenarios
pdm jtbd ./output/combined_scenarios.json --output=./output/combined_jtbds.json --layers=2 --verbose

# Visualize combined JTBD hierarchy
pdm visualize ./output/combined_jtbds.json --format=mermaid --view=jtbd --output=./output/combined_viz.md
```

**Expected Results:**
- Both English and Japanese scenarios should be properly processed
- JTBDs should reflect themes that span across languages
- Similar concepts from different languages should be clustered together
- Visualization should handle both language character sets

### 10.4 Extended Test: Alternative Data Sources

```bash
# Process customer feedback from retail domain
pdm scenario ./docs/sample_inputs/costco_online/ --output=./output/retail_scenarios.json --recursive

# Generate JTBDs with automatic threshold tuning
pdm jtbd ./output/retail_scenarios.json --output=./output/retail_jtbds.json --layers=2 --verbose

# Export visualization to Figma (future capability)
pdm visualize ./output/retail_jtbds.json --format=figma --view=persona --output=./output/retail_viz.fig
```

**Expected Results:**
- Retail-specific user scenarios should be extracted
- Customer names should be identified correctly
- JTBDs should reflect retail-specific themes
- Visualizations should appropriately group scenarios by persona