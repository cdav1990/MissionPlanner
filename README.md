# DOF Tool

A comprehensive photography tool that includes a Drone Mission Planner, DOF (Depth of Field) Calculator, and a Point Cloud Viewer for LiDAR data visualization.

## Features

- **Drone Mission Planner**: Plan aerial photography missions with precise calculations
- **DOF Calculator**: Calculate depth of field for various camera and lens configurations
- **Point Cloud Viewer**: Visualize 3D point cloud data with support for large datasets

## Mission Planner Features

The Mission Planner component provides:

- **Interactive 3D Environment**: Plan and visualize drone flight paths in a 3D space
- **Camera Frustum Visualization**: See exactly what the drone camera will capture
- **Multiple View Modes**: Perspective, Top, Front, and Side views for comprehensive planning
- **Realistic Drone Model**: Detailed 3D model of the drone with camera position
- **Manual Drone Positioning**: Precise control over drone position and rotation
- **Lighting Controls**: Adjust scene lighting for better visualization
- **Visual Style Options**: Customize the appearance of the 3D environment
- **Performance Monitoring**: Optional stats display for performance tracking

## Point Cloud Viewer Features

The Point Cloud Viewer component now supports:

- **Standard point cloud formats**: PLY, PCD, LAS/LAZ
- **Potree format for large point clouds**: With Level of Detail (LOD) rendering
- **Performance optimization**: Automatic detection of hardware capabilities
- **Error handling**: Fixes NaN values and computes proper bounding spheres
- **Visualization options**: Color by height, RGB, or solid colors
- **User controls**: Adjust point size, select renderer type, and more

## Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up sample point clouds and Potree for large point cloud support:

```bash
npm run setup-all
```

4. Start the development server:

```bash
cd dof-calculator
npm start
```

5. Navigate to http://localhost:5174 in your browser.

## Working with Large Point Clouds

For optimal performance with large point clouds (millions of points), this tool integrates Potree - a WebGL point cloud renderer with Level of Detail (LOD) capabilities.

### Converting LAS/LAZ Files to Potree Format

1. Download [PotreeConverter](https://github.com/potree/PotreeConverter/releases)
2. Convert your LAS/LAZ file:

```bash
PotreeConverter C:/path/to/pointcloud.las -o C:/output/path --generate-page
```

3. Copy the output folder to the `dof-calculator/public/potree-data` directory
4. In the Point Cloud Viewer, select the Potree renderer option

### Using the Mission Planner

1. **Select a Camera and Lens**: Choose from predefined camera and lens configurations
2. **Position the Drone**: Use the Manual Drone Positioning controls to place the drone
3. **Visualize the Camera View**: The camera frustum shows what will be captured
4. **Adjust Settings**: Fine-tune lighting, background, and other visual parameters
5. **Switch Views**: Use the view buttons to see the scene from different angles
6. **Reset Position**: Use the reset button to return the drone to its default position

### Mission Planner Controls

- **Manual Drone Positioning**: Control the drone's X, Y, Z position and rotation angles
- **Advanced Controls**: Toggle camera frustum, drone following, and performance stats
- **Scene Options**: Adjust grid size and divisions
- **Lighting Controls**: Change ambient and main light intensities
- **Visual Style**: Select background color and toggle coordinate axes

## Implementation Details

The enhanced point cloud implementation includes:

1. **EnhancedPointCloud.jsx**: Core component with:
   - Auto-detection of hardware capabilities
   - Potree integration for Level of Detail rendering
   - Automatic handling of NaN values
   - Performance monitoring and optimization
   - Comprehensive error handling
   
2. **PointCloudDemo.jsx**: User interface with:
   - Sample selection and file upload capabilities
   - Controls for visualization options
   - Performance profile selection
   - Real-time feedback on rendering statistics

3. **MissionPlanner.jsx**: Mission planning component with:
   - Three.js for 3D scene rendering
   - Camera frustum visualization
   - Multiple view modes
   - Customizable scene settings

## Future Enhancements

Planned improvements:

- **Mission Planner**:
  - Flight path creation and editing
  - Automatic mission optimization
  - Export to drone flight controller formats
  - Integration with real terrain data
  - Collaborative mission planning

- **Point Cloud Viewer**:
  - Additional visualization modes (intensity, classification, etc.)
  - Support for more point cloud formats (E57, COPC, etc.)
  - Point cloud manipulation tools (cropping, filtering)
  - Measurement tools (distance, area, volume)
  - Integration with photogrammetry tools

## Depth of Field (DOF) Calculator

A comprehensive tool for photographers and photogrammetrists to calculate and visualize depth of field for various camera and lens combinations.

- Calculate depth of field, hyperfocal distance, and other critical parameters
- Support for different camera sensor sizes and lens configurations
- Visualization of depth of field in a 3D model

## Features

- **Precise DOF Calculations**: Calculate hyperfocal distance, near limit, far limit, and total depth of field
- **Interactive Visualization**: Visual representation of depth of field with distance scale
- **Multiple Sensor Formats**: Support for various sensor sizes including Large Format, Medium Format, Full Frame, and APS-C
- **Unit Conversion**: Seamlessly switch between metric (meters) and imperial (feet) units
- **Ground Coverage Calculation**: Determine the width and height of the area covered by your camera at a specific distance
- **Ground Sample Distance (GSD)**: Calculate the pixel resolution on the ground for photogrammetry applications
- **Responsive Design**: Works on desktop and mobile devices

## Requirements

- Node.js 18.x or higher
- npm 9.x or higher

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/cdav1990/MissionPlanner.git
   cd MissionPlanner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the URL shown in your terminal (typically http://localhost:5173 or similar)

## License

MIT License

## Acknowledgments

- Formula references from photographic depth of field theory
- Inspiration from existing DOF calculators while adding unique features for photogrammetry
- Three.js community for 3D rendering capabilities
- Potree team for point cloud rendering technology 