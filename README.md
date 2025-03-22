# DOF Tool

A comprehensive photography tool that includes a Drone Mission Planner, DOF (Depth of Field) Calculator, and a Point Cloud Viewer for LiDAR data visualization.

## Features

- **Drone Mission Planner**: Plan aerial photography missions with precise calculations
- **DOF Calculator**: Calculate depth of field for various camera and lens configurations
- **Point Cloud Viewer**: Visualize 3D point cloud data with support for large datasets

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

### Troubleshooting

- **Potree not loading**: Make sure you've run the setup script (`npm run setup-potree`) and that the necessary files exist in `dof-calculator/public/potree/build`.
- **Point cloud not visible**: Check that sample files exist in `dof-calculator/public/samples`.
- **Performance issues**: Use the performance profiles in the UI to match your system capabilities.
- **NaN errors**: The component includes automatic handling for NaN values in point coordinates.

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

3. **Setup scripts**:
   - `setup-potree.js`: Downloads and configures Potree library
   - `download-samples.js`: Downloads sample point cloud files

## Future Enhancements

Planned improvements for the point cloud viewer:

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
   git clone https://github.com/cdav1990/Photogrammetry_DOF.git
   cd Photogrammetry_DOF
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

## Usage

1. **Select Camera Format**: Choose your camera's sensor size from the dropdown menu
2. **Set Focal Length**: Enter the focal length of your lens in millimeters
3. **Set Aperture**: Select the f-stop value for your lens
4. **Adjust Focus Distance**: Use the slider or direct input to set your focus distance
5. **Toggle Units**: Switch between meters and feet using the toggle button
6. **View Results**: See the calculated DOF values and visualization

## Technical Details

### Core Calculations

The calculator implements the following key formulas:

- **Hyperfocal Distance**: The distance beyond which all objects appear acceptably sharp
- **Circle of Confusion**: The maximum blur spot diameter that will still be perceived as a point by the human eye
- **Near Limit**: The closest distance at which objects appear acceptably sharp
- **Far Limit**: The furthest distance at which objects appear acceptably sharp
- **Ground Sample Distance (GSD)**: The distance between pixel centers as measured on the ground

### Technology Stack

- **React**: Frontend UI library
- **Vite**: Build tool and development server
- **D3.js**: For data visualization
- **CSS**: Custom styling with responsive design

## Development

### Project Structure

```
dof-calculator/
├── public/            # Static assets
├── src/
│   ├── assets/        # Application assets
│   │   ├── DOFCalculator.jsx    # Main calculator component
│   │   └── DOFVisualization.jsx # Visualization component
│   ├── data/          # Data files
│   │   └── cameraLensData.json  # Camera and lens data
│   ├── utils/         # Utility functions
│   │   └── dofCalculations.js   # Core DOF calculation functions
│   ├── App.jsx        # Main application component
│   ├── App.css        # Application styles
│   ├── index.css      # Global styles
│   └── main.jsx       # Application entry point
├── .gitignore         # Git ignore file
├── package.json       # Project dependencies and scripts
└── vite.config.js     # Vite configuration
```

### Building for Production

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

None

## Acknowledgments

- Formula references from photographic depth of field theory
- Inspiration from existing DOF calculators while adding unique features for photogrammetry 