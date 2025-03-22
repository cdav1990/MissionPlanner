Potree Data Directory
====================

This directory is used to store point cloud data for visualization with Potree.
Point cloud data should be organized in the following structure:

/potree-data/
  ├── point-cloud-1/
  │   ├── metadata.json (or cloud.js)
  │   ├── octree/
  │   │   ├── r/
  │   │   │   ├── r0.hrc
  │   │   │   ├── r1.hrc
  │   │   │   └── ... additional nodes
  │   │   └── ... additional node files
  │   └── ... additional point cloud files
  ├── point-cloud-2/
  │   └── ... similar structure as above
  └── ... additional point clouds

To convert LAS/LAZ files to the Potree format, use PotreeConverter:
https://github.com/potree/PotreeConverter

Example conversion command:
PotreeConverter.exe C:/pointclouds/mycloud.las -o C:/potree_converted/mycloud --generate-page

After conversion, copy the output directory to this location.
