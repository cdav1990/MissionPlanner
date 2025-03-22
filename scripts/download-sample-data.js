const fs = require('fs');
const path = require('path');
const https = require('https');

// Create directories if they don't exist
const publicDir = path.join(__dirname, '../public');
const pointCloudsDir = path.join(publicDir, 'point-clouds');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(pointCloudsDir)) {
  fs.mkdirSync(pointCloudsDir, { recursive: true });
}

// Define sample point cloud URLs - these are more reliable sources
const SAMPLE_POINT_CLOUDS = [
  {
    name: 'bunny.ply',
    url: 'https://github.com/nopjia/samples/raw/main/models/stanford-bunny.ply',
    targetPath: path.join(pointCloudsDir, 'bunny.ply')
  },
  {
    name: 'dragon.ply', 
    url: 'https://github.com/nopjia/samples/raw/main/models/xyzrgb_dragon_sample.ply',
    targetPath: path.join(pointCloudsDir, 'dragon.ply')
  }
];

// Download a file
const downloadFile = (url, targetPath) => {
  return new Promise((resolve, reject) => {
    // Check if file already exists
    if (fs.existsSync(targetPath)) {
      console.log(`File ${path.basename(targetPath)} already exists, skipping download`);
      resolve();
      return;
    }

    console.log(`Downloading ${url} to ${targetPath}...`);
    
    const file = fs.createWriteStream(targetPath);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const newUrl = response.headers.location;
        console.log(`Redirected to ${newUrl}`);
        file.close();
        downloadFile(newUrl, targetPath).then(resolve).catch(reject);
        return;
      }
      
      // Check for success
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}, status code: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${path.basename(targetPath)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(targetPath, () => {}); // Delete the file if download failed
      reject(err);
    });
    
    file.on('error', (err) => {
      fs.unlink(targetPath, () => {}); // Delete the file if download failed
      reject(err);
    });
  });
};

// Download all sample files
const downloadAll = async () => {
  console.log(`Downloading sample point clouds to ${pointCloudsDir}`);
  
  for (const sample of SAMPLE_POINT_CLOUDS) {
    try {
      await downloadFile(sample.url, sample.targetPath);
    } catch (err) {
      console.error(`Error downloading ${sample.name}:`, err.message);
    }
  }
  
  console.log('Download complete');
};

// Run the download
downloadAll().catch(console.error); 