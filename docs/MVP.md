# ProDuct Manager (PDM) - Minimum Viable Product

## Overview
ProDuct Manager (PDM) is a CLI tool for organizing customer feedback into product insights using Jobs-to-be-Done (JTBD) methodology. This MVP document outlines the core functionality required for the initial release, with a focus on the visualization capabilities.

## Core Commands

### 1. Parse Command
The parse command extracts JTBDs and user scenarios from various input sources.

### 2. Consolidate Command
The consolidate command identifies similar JTBDs and scenarios, creating abstract representations of common themes.

### 3. Abstract Command
The abstract command generates higher-level abstractions from existing JTBDs and scenarios.

### 4. Visualize Command

#### Purpose
The visualization command transforms JTBD and scenario data into graphical representations to help product teams understand relationships and patterns in user needs.

#### Command Syntax
```
pdm visualize <input-file> [options]
```

#### Parameters
- `<input-file>`: Path to the consolidated JSON file containing JTBDs and scenarios

#### Options
- `--format <format>`: Output format (mermaid, cytoscape, png, svg) [default: "mermaid"]
- `--view <view>`: Visualization perspective (jtbd, persona, priority, source) [default: "jtbd"]
- `--output <output-file>`: Output file path [default: auto-generated based on input file]
- `--abstract-only`: Only show abstract JTBDs (not applied to scenarios)
- `--include-independent`: Include independent scenarios not part of any abstraction [default: true]
- `--include-level <level>`: Maximum abstraction level to include [default: all]
- `--filter <query>`: Filter entities by text or attribute match
- `--max-nodes <number>`: Maximum number of nodes to display [default: 100]
- `--cluster <attribute>`: Cluster nodes by attribute (e.g., priority, source)
- `--highlight <id>`: Highlight specific node and its connections
- `--layout <type>`: Graph layout algorithm (hierarchical, force-directed, concentric, grid) [default: "hierarchical"]
- `--theme <name>`: Visual theme for the visualization [default: "default"]
- `--scenario-abstraction <mode>`: How to handle scenario abstractions: "both" (show abstract and independent), "abstract-only", "independent-only" [default: "both"]

#### Implementation

##### Visualization Engine
The visualization engine will support multiple output formats:

1. **Mermaid Diagrams**
   - Generate Mermaid markdown syntax for embedding in documentation
   - Support different graph types (flowchart, mindmap) based on the view
   - Style nodes based on entity types and attributes

2. **Cytoscape.js Integration**
   - Generate interactive graph visualizations optimized for complex relationship networks
   - Support advanced layouts (hierarchical, force-directed, concentric, grid)
   - Enable rich styling and interactive features (zooming, filtering, highlighting)
   - Export to HTML files with embedded Cytoscape.js for interactive exploration
   - Support for node clustering and graph algorithms for advanced analysis

3. **Static Image Export**
   - Convert diagrams to PNG/SVG using headless browser rendering
   - Support custom styling for image exports
   - Generate high-resolution images suitable for presentations and documents

##### View Types

1. **JTBD-Centric View**
   - Show JTBDs as primary nodes with hierarchical structure
   - Abstract JTBDs at the top with child JTBDs connected below
   - Connect related scenarios (both abstracted and independent) to appropriate JTBDs
   - Example structure:
     ```
     Abstract JTBD → Child JTBD → Related Scenarios (both abstracted and independent)
     ```

2. **Persona-Centric View**
   - Organize scenarios by target personas
   - Show both abstracted scenario groups and independent scenarios
   - Connect to fulfilled JTBDs
   - Example structure:
     ```
     Persona → [Abstract Scenario Groups + Independent Scenarios] → Fulfilled JTBDs
     ```

3. **Priority Heat Map**
   - Visualize JTBDs and scenarios with color intensity based on priority
   - Group JTBDs by abstraction level
   - For scenarios, include both abstraction groups and independent scenarios
   - Size nodes by occurrence count or number of child entities

4. **Source Attribution View**
   - Show relationship between source documents and extracted insights
   - Connect customer/user nodes to sources and JTBDs
   - Include comprehensive representation of all scenarios (both abstracted and independent)
   - Example structure:
     ```
     Customer → Source Document → [JTBDs + Abstract Scenarios + Independent Scenarios]
     ```

##### Entity Representation Differences

1. **JTBD Representation**
   - Primary focus on abstract JTBDs with their hierarchical relationships
   - Option to filter to abstract-only JTBDs when the graph becomes too complex
   - Clear visual differentiation of abstract vs. concrete JTBDs

2. **Scenario Representation**
   - Always show both abstracted scenario groups AND independent scenarios
   - Ensure comprehensive coverage of all user scenarios regardless of abstraction status
   - Distinct visual styling to differentiate between:
     * Abstract scenario groups
     * Scenarios belonging to abstraction groups
     * Independent scenarios (not part of any abstraction)
   - Special connectors to show relationships between abstract scenarios and their members

##### Node and Edge Styling

Nodes will be styled based on entity type and attributes:
- Abstract JTBDs: Larger size, bold border
- Concrete JTBDs: Standard size, colored by priority
- Abstract Scenarios: Distinct shape with grouping visual
- Independent Scenarios: Different shape/color from abstracted scenarios
- Personas/Sources/Customers: Distinct visual representation

Edges will indicate relationship types:
- Abstraction: Parent → Child
- Fulfillment: Scenario → JTBD
- Scenario Grouping: Abstract Scenario → Member Scenarios
- Mention: Source → JTBD
- Attribution: Customer → Source

##### Interactive Features (Cytoscape.js)
- Zoom in/out for complex graphs with many nodes
- Click to expand/collapse node clusters
- Toggle between showing/hiding independent scenarios
- Toggle between showing/hiding abstracted scenarios
- Hover for detailed information about entities
- Search and highlighting of nodes based on text
- Dynamic filtering based on attributes (priority, source, etc.)
- Graph rearrangement with different layout algorithms
- Ability to save custom views and layouts

##### Implementation Components

1. **Graph Builder**
   - Processes input JSON and constructs an internal graph representation
   - Applies filters and transformations based on command options
   - Optimizes layout for readability

2. **Rendering Engine**
   - Transforms internal graph to target output format
   - Handles styling and appearance
   - Optimizes for each output format's capabilities
   - Integrates with Cytoscape.js for advanced graph features

3. **Export Utilities**
   - Manages file I/O for different formats
   - Handles conversion between formats when needed
   - Uses Puppeteer or similar for headless browser rendering of interactive visualizations

## Technical Requirements

### Dependencies
- graph-builder: Custom module for constructing graph representations
- mermaid-cli: For generating Mermaid diagrams
- cytoscape.js: For advanced graph visualization and interactive features
- puppeteer: For headless browser rendering of Cytoscape.js visualizations
- Node.js modules:
  - fs-extra: File system operations
  - commander: CLI argument parsing
  - chalk: Terminal output styling
  - html-template: For generating HTML wrappers for Cytoscape.js

### Architecture
The visualization command will follow the same architecture pattern as other commands, with separation between:
- Command definition (in src/commands/visualize.js)
- Core visualization logic (in src/utils/visualization/)
- Format-specific renderers (in src/utils/visualization/renderers/)
- Graph algorithms and analysis utilities (in src/utils/visualization/analysis/)

## Development Plan

### Phase 1: Core Mermaid Output
- Implement basic JTBD-centric view with Mermaid output
- Support hierarchical display of abstract and concrete JTBDs
- Basic styling and relationship display

### Phase 2: Cytoscape.js Integration
- Implement HTML template with embedded Cytoscape.js
- Create graph data adapter for Cytoscape.js format
- Develop basic interactive features (zoom, hover, click)
- Implement multiple layout algorithms

### Phase 3: Enhanced Views & Features
- Implement additional view types (persona, priority, source)
- Add filtering and highlighting capabilities
- Add advanced graph analysis features (centrality, clustering)
- Create theming system for consistent visualization styles

### Phase 4: Static Export & Optimization
- Implement PNG/SVG export using Puppeteer
- Optimize rendering for large graphs
- Add performance enhancements for datasets with 100+ nodes
- Implement graph simplification algorithms for complex datasets

## Success Criteria
- Generate readable visualizations for datasets with 100+ JTBDs and scenarios
- Support multiple perspectives on the same dataset
- Provide both interactive and static output formats suitable for exploration, documentation, and presentations
- Interactive responsiveness: Smooth interactions even with large datasets
- Performance: Generate visualizations in under 5 seconds for typical datasets