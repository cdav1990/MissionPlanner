# Potree Point Cloud Data Directory

This directory is used to store Potree-formatted point cloud data for use with the DOF Calculator application.

## Directory Structure

Each point cloud dataset should be in its own subdirectory:

```
potree-data/
├── dataset1/
│   ├── hierarchy.bin
│   ├── metadata.json
│   ├── octree.bin
│   └── ...
├── dataset2/
│   └── ...
└── ...
```

## Creating Point Cloud Data

1. Use [Potree Converter](https://github.com/potree/PotreeConverter) to convert LAS/LAZ files to Potree format:

   ```bash
   PotreeConverter.exe C:/path/to/your/lidar.las -o C:/path/to/output -p dataset_name
   ```

2. Copy the converted data to a subdirectory within this folder.

3. When importing in the application, use the "LiDAR Import" button and select the converted data.

## Sample Data

You can find sample Potree datasets at:
- https://potree.org/potree/examples/
- https://github.com/potree/potree/tree/develop/examples/pointclouds

Download and extract these datasets into subdirectories here.

## Performance Tips

- For optimal performance with large point clouds, adjust the point budget in the application
- Consider splitting very large datasets into multiple smaller ones
- Pre-processing to reduce point density for overview visualization can improve performance 