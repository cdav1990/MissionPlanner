const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');
const url = require('url');

// Configuration
const POTREE_RELEASE_URL = 'https://github.com/potree/potree/archive/refs/tags/1.8.2.zip';
const POTREE_DIRECTORY = path.join(__dirname, '../public/potree');
const POTREE_DATA_DIRECTORY = path.join(__dirname, '../public/potree-data');
const TEMP_DOWNLOAD_PATH = path.join(__dirname, '../temp-potree.zip');

// Helper to download files with redirect support
function downloadFile(fileUrl, destination) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${fileUrl} to ${destination}...`);
    
    // Function to handle the actual download
    const download = (downloadUrl) => {
      // Parse the URL to determine whether to use http or https
      const parsedUrl = url.parse(downloadUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const request = protocol.get(downloadUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          console.log(`Following redirect to ${redirectUrl}`);
          download(redirectUrl);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download, status code: ${response.statusCode}`));
          return;
        }
        
        const file = fs.createWriteStream(destination);
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100);
            process.stdout.write(`Download progress: ${progress}%\r`);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('\nDownload completed!');
          resolve();
        });
        
        file.on('error', (err) => {
          fs.unlink(destination, () => {});
          reject(err);
        });
      });
      
      request.on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });
      
      // Set a timeout
      request.setTimeout(30000, () => {
        request.abort();
        reject(new Error('Download timeout'));
      });
    };
    
    // Start the download process
    download(fileUrl);
  });
}

// Make directory if it doesn't exist
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Clean up function for temporary files
function cleanup() {
  if (fs.existsSync(TEMP_DOWNLOAD_PATH)) {
    console.log('Cleaning up temporary files...');
    fs.unlinkSync(TEMP_DOWNLOAD_PATH);
  }
}

// Extract zip file and move contents from nested directory
function extractZip(zipPath, destinationPath) {
  console.log(`Extracting ${zipPath} to ${destinationPath}...`);
  
  try {
    const zip = new AdmZip(zipPath);
    
    // Extract to temporary directory first
    const tempDir = path.join(__dirname, '../temp-potree-extract');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    ensureDirectoryExists(tempDir);
    zip.extractAllTo(tempDir, true);
    
    // Potree archive from GitHub has a nested directory named potree-1.8.2
    // We need to move contents from this directory to our target potree directory
    const extractedDirs = fs.readdirSync(tempDir);
    if (extractedDirs.length === 0) {
      throw new Error('Zip extraction failed: no files extracted');
    }
    
    const potreeNestedDir = path.join(tempDir, extractedDirs[0]);
    if (!fs.existsSync(potreeNestedDir)) {
      throw new Error('Potree directory structure not as expected');
    }
    
    // Make sure destination exists
    ensureDirectoryExists(destinationPath);
    
    // Move contents from nested directory to destination
    const nestedContents = fs.readdirSync(potreeNestedDir);
    for (const item of nestedContents) {
      const source = path.join(potreeNestedDir, item);
      const dest = path.join(destinationPath, item);
      
      if (fs.existsSync(dest)) {
        // Remove existing directory/file
        if (fs.statSync(dest).isDirectory()) {
          fs.rmSync(dest, { recursive: true, force: true });
        } else {
          fs.unlinkSync(dest);
        }
      }
      
      // Move the item
      fs.renameSync(source, dest);
      console.log(`Moved ${item} to ${destinationPath}`);
    }
    
    // Clean up temporary extraction directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log('Extraction completed!');
  } catch (err) {
    console.error('Error during extraction:', err);
    throw err;
  }
}

// Create example data
function createExampleData() {
  console.log('Setting up example data directory structure...');
  
  // Create the potree-data directory and subdirectories
  ensureDirectoryExists(POTREE_DATA_DIRECTORY);
  
  // Create a README file explaining the directory
  const readmePath = path.join(POTREE_DATA_DIRECTORY, 'README.txt');
  const readmeContent = `Potree Data Directory
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
`;

  fs.writeFileSync(readmePath, readmeContent);
  console.log(`Created README at ${readmePath}`);
  
  // Create an example 'forest' directory to store a sample point cloud
  const forestDir = path.join(POTREE_DATA_DIRECTORY, 'forest');
  ensureDirectoryExists(forestDir);
  
  // Create a placeholder metadata.json file
  const metadataPath = path.join(forestDir, 'metadata.json');
  const metadataContent = `{
  "version": "1.8",
  "name": "forest",
  "description": "Example forest point cloud (placeholder)",
  "points": 0,
  "projection": "+proj=utm +zone=32 +ellps=WGS84 +datum=WGS84 +units=m +no_defs",
  "scale": [0.001, 0.001, 0.001],
  "boundingBox": {
    "min": [-10, -10, -10],
    "max": [10, 10, 10]
  }
}`;

  fs.writeFileSync(metadataPath, metadataContent);
  console.log(`Created placeholder metadata at ${metadataPath}`);
  
  // Create a placeholder octree directory
  const octreeDir = path.join(forestDir, 'octree');
  ensureDirectoryExists(octreeDir);
}

// Try to download a pre-built Potree distribution
async function downloadPreBuiltPotree() {
  try {
    console.log('Trying to download a pre-built Potree distribution...');
    
    // Use a CDN URL instead of GitHub
    const cdnUrl = 'https://cdn.jsdelivr.net/gh/potree/potree@1.8/build/potree.zip';
    const tempDir = path.join(__dirname, '../temp-potree-dist');
    const tempZip = path.join(tempDir, 'potree.zip');
    
    // Ensure temp directory exists
    ensureDirectoryExists(tempDir);
    
    // Download the pre-built distribution
    await downloadFile(cdnUrl, tempZip);
    
    // Extract directly to public directory
    const zip = new AdmZip(tempZip);
    zip.extractAllTo(POTREE_DIRECTORY, true);
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Verify that potree.js exists
    const potreeJs = path.join(POTREE_DIRECTORY, 'build', 'potree.js');
    if (!fs.existsSync(potreeJs)) {
      throw new Error('Potree.js not found after extraction');
    }
    
    return true;
  } catch (error) {
    console.warn('Failed to download pre-built distribution:', error.message);
    return false;
  }
}

// Main execution function
async function setup() {
  try {
    console.log('Setting up Potree library for point cloud visualization...');
    
    // Create directories
    ensureDirectoryExists(POTREE_DIRECTORY);
    
    // Check if Potree is already installed
    if (fs.existsSync(path.join(POTREE_DIRECTORY, 'build', 'potree.js'))) {
      console.log('Potree library already installed. Skipping download.');
    } else {
      // First try to download the pre-built distribution
      const preBuiltSuccess = await downloadPreBuiltPotree();
      
      if (!preBuiltSuccess) {
        // If pre-built fails, try source code
        console.log('Downloading Potree source code...');
        await downloadFile(POTREE_RELEASE_URL, TEMP_DOWNLOAD_PATH);
        
        // Extract Potree
        extractZip(TEMP_DOWNLOAD_PATH, POTREE_DIRECTORY);
        
        // Clean up
        cleanup();
      }
      
      console.log('Potree library installed successfully!');
    }
    
    // Create example data structure
    createExampleData();
    
    // Check if we need to install adm-zip
    if (!fs.existsSync(path.join(__dirname, '../node_modules/adm-zip'))) {
      console.log('Installing required dependencies...');
      
      // Try to install adm-zip
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const install = spawn(npm, ['install', 'adm-zip', '--no-save'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      await new Promise((resolve, reject) => {
        install.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`npm install failed with code ${code}`));
          }
        });
      });
    }
    
    console.log('\n✅ Potree setup completed successfully!');
    console.log('\nTo use large point clouds:');
    console.log('1. Convert LAS/LAZ files to Potree format using PotreeConverter');
    console.log('2. Place converted data in the public/potree-data directory');
    console.log('3. Use the point cloud viewer with the Potree renderer enabled\n');
    
  } catch (error) {
    console.error('\nError setting up Potree:', error);
    cleanup();
    process.exit(1);
  }
}

// Run the setup
setup(); 