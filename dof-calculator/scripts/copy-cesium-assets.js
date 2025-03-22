import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file URL and convert it to a directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define source and destination paths
const cesiumSource = path.resolve(__dirname, '../node_modules/cesium/Build/Cesium');
const cesiumDestination = path.resolve(__dirname, '../public/cesium');

// Ensure destination directory exists
fs.ensureDirSync(cesiumDestination);

// Copy the Cesium assets
fs.copySync(cesiumSource, cesiumDestination, {
  recursive: true
});

console.log('Cesium assets copied to public/cesium'); 