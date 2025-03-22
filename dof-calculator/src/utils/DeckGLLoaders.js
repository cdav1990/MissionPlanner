/**
 * DeckGLLoaders.js
 * Utility for loading point cloud formats into deck.gl
 */

import { load } from '@loaders.gl/core';
import { PLYLoader } from '@loaders.gl/ply';
import { LASLoader } from '@loaders.gl/las';

/**
 * Load a point cloud file and normalize it for deck.gl
 * @param {string} url - URL to the point cloud file
 * @param {Object} options - Options for loading
 * @returns {Promise<Object>} - Point cloud data and metadata
 */
export async function loadPointCloud(url, options = {}) {
  const {
    onProgress = null,
    normalize = true,
    optimizeForM3 = true,
    maxPoints = 0
  } = options;

  try {
    // Determine loader based on file extension
    const fileExtension = url.split('.').pop().toLowerCase();
    let loader;
    
    switch (fileExtension) {
      case 'ply':
        loader = PLYLoader;
        break;
      case 'las':
      case 'laz':
        loader = LASLoader;
        break;
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`);
    }
    
    // Set up loader options
    const loaderOptions = {
      las: {
        skip: maxPoints > 0 ? Math.ceil(1000000 / maxPoints) : 0, // Skip points for downsampling
        worker: true
      },
      ply: {
        worker: true
      },
      fetch: {
        onProgress: (progress) => {
          if (onProgress && progress.loaded && progress.total) {
            onProgress(progress.loaded / progress.total);
          }
        }
      }
    };
    
    // Load the file
    const data = await load(url, loader, loaderOptions);
    
    // The structure will depend on the loader used
    let pointCloud;
    let metadata;
    
    if (fileExtension === 'ply') {
      pointCloud = data;
      metadata = {
        vertexCount: data.attributes.POSITION.value.length / 3,
        hasNormals: !!data.attributes.NORMAL,
        hasColors: !!data.attributes.COLOR_0,
        format: 'ply'
      };
    } else if (fileExtension === 'las' || fileExtension === 'laz') {
      pointCloud = {
        attributes: {
          POSITION: {
            value: data.attributes.POSITION.value,
            size: 3
          }
        }
      };
      
      // LAS can have color as RGB or RGBA
      if (data.attributes.COLOR_0) {
        pointCloud.attributes.COLOR_0 = {
          value: data.attributes.COLOR_0.value,
          size: data.attributes.COLOR_0.size || 3
        };
      }
      
      // Some LAS files have intensity
      if (data.attributes.INTENSITY) {
        pointCloud.attributes.INTENSITY = {
          value: data.attributes.INTENSITY.value,
          size: 1
        };
      }
      
      // Some LAS files have classification
      if (data.attributes.CLASSIFICATION) {
        pointCloud.attributes.CLASSIFICATION = {
          value: data.attributes.CLASSIFICATION.value,
          size: 1
        };
      }
      
      metadata = {
        vertexCount: data.attributes.POSITION.value.length / 3,
        hasNormals: false,
        hasColors: !!data.attributes.COLOR_0,
        hasIntensity: !!data.attributes.INTENSITY,
        hasClassification: !!data.attributes.CLASSIFICATION,
        header: data.header,
        format: 'las'
      };
    }
    
    // Normalize the data if requested
    if (normalize) {
      normalizePointCloud(pointCloud, optimizeForM3);
    }
    
    return { 
      pointCloud, 
      metadata
    };
  } catch (error) {
    console.error('Error loading point cloud:', error);
    throw error;
  }
}

/**
 * Normalize a point cloud for consistent rendering
 * @param {Object} pointCloud - The point cloud data
 * @param {boolean} optimizeForM3 - Whether to apply M3-specific optimizations
 */
function normalizePointCloud(pointCloud, optimizeForM3 = true) {
  const positions = pointCloud.attributes.POSITION.value;
  const vertexCount = positions.length / 3;
  
  // Find center and scale
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  
  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  
  const maxSize = Math.max(sizeX, sizeY, sizeZ);
  const scale = maxSize > 0 ? 10 / maxSize : 1;
  
  // Center and normalize the point cloud
  for (let i = 0; i < vertexCount; i++) {
    positions[i * 3] = (positions[i * 3] - centerX) * scale;
    positions[i * 3 + 1] = (positions[i * 3 + 1] - centerY) * scale;
    positions[i * 3 + 2] = (positions[i * 3 + 2] - centerZ) * scale;
  }
  
  // Apply M3-specific optimizations if requested
  if (optimizeForM3) {
    // Convert to Float32 to ensure compatibility
    if (!(positions instanceof Float32Array)) {
      pointCloud.attributes.POSITION.value = new Float32Array(positions);
    }
    
    // If there are colors, ensure they're in the right format
    if (pointCloud.attributes.COLOR_0) {
      const colors = pointCloud.attributes.COLOR_0.value;
      
      // Convert to Uint8Array for better performance on M3
      if (!(colors instanceof Uint8Array)) {
        const size = pointCloud.attributes.COLOR_0.size || 3;
        const uint8Colors = new Uint8Array(colors.length);
        
        for (let i = 0; i < colors.length; i++) {
          uint8Colors[i] = Math.min(255, Math.max(0, Math.round(colors[i] * 255)));
        }
        
        pointCloud.attributes.COLOR_0.value = uint8Colors;
      }
    }
  }
  
  // Add the normalization metadata to the point cloud
  pointCloud.metadata = {
    ...pointCloud.metadata,
    normalizedCenter: [centerX, centerY, centerZ],
    normalizedScale: scale,
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      size: [sizeX, sizeY, sizeZ]
    }
  };
}

/**
 * Get the color attribute accessor function
 * @param {Object} pointCloud - The point cloud data
 * @param {string} colorMode - Color mode: 'rgb', 'height', 'intensity', 'classification'
 * @returns {Function} - Color accessor function for deck.gl
 */
export function getColorAccessor(pointCloud, colorMode = 'rgb') {
  const hasColors = pointCloud.attributes && pointCloud.attributes.COLOR_0;
  const hasIntensity = pointCloud.attributes && pointCloud.attributes.INTENSITY;
  const hasClassification = pointCloud.attributes && pointCloud.attributes.CLASSIFICATION;
  const positions = pointCloud.attributes.POSITION.value;
  
  // Color by RGB if available and requested
  if (colorMode === 'rgb' && hasColors) {
    const colors = pointCloud.attributes.COLOR_0.value;
    const colorSize = pointCloud.attributes.COLOR_0.size || 3;
    
    return (object, { index }) => {
      const i = index * colorSize;
      return [
        colors[i],
        colors[i + 1 < colors.length ? i + 1 : i],
        colors[i + 2 < colors.length ? i + 2 : i],
        255
      ];
    };
  }
  
  // Color by height (Z value)
  if (colorMode === 'height') {
    // Find min/max Z for normalization
    let minZ = Infinity;
    let maxZ = -Infinity;
    
    for (let i = 0; i < positions.length; i += 3) {
      const z = positions[i + 2];
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    
    const zRange = maxZ - minZ;
    
    return (object, { index }) => {
      const z = positions[index * 3 + 2];
      const normalizedZ = zRange > 0 ? (z - minZ) / zRange : 0.5;
      
      // Use a height-based color ramp (blue to red)
      return [
        Math.floor(normalizedZ * 255), // R
        Math.floor((1 - normalizedZ) * 100), // G
        Math.floor((1 - normalizedZ) * 255), // B
        255 // A
      ];
    };
  }
  
  // Color by intensity if available
  if (colorMode === 'intensity' && hasIntensity) {
    const intensities = pointCloud.attributes.INTENSITY.value;
    
    // Find min/max intensity for normalization
    let minIntensity = Infinity;
    let maxIntensity = -Infinity;
    
    for (let i = 0; i < intensities.length; i++) {
      minIntensity = Math.min(minIntensity, intensities[i]);
      maxIntensity = Math.max(maxIntensity, intensities[i]);
    }
    
    const intensityRange = maxIntensity - minIntensity;
    
    return (object, { index }) => {
      const intensity = intensities[index];
      const normalizedIntensity = intensityRange > 0 ? 
        (intensity - minIntensity) / intensityRange : 0.5;
      
      const value = Math.floor(normalizedIntensity * 255);
      return [value, value, value, 255];
    };
  }
  
  // Color by classification if available
  if (colorMode === 'classification' && hasClassification) {
    const classifications = pointCloud.attributes.CLASSIFICATION.value;
    
    // Standard LAS classification colors
    const classColors = {
      0: [255, 255, 255], // Created, never classified
      1: [192, 192, 192], // Unclassified
      2: [161, 99, 20],   // Ground
      3: [49, 136, 39],   // Low Vegetation
      4: [100, 167, 83],  // Medium Vegetation
      5: [0, 128, 0],     // High Vegetation
      6: [242, 16, 22],   // Building
      7: [223, 51, 194],  // Low Point (noise)
      8: [170, 85, 255],  // Reserved
      9: [32, 119, 240],  // Water
      10: [172, 172, 47], // Rail
      11: [174, 141, 0],  // Road Surface
      12: [153, 102, 51], // Reserved
      13: [204, 153, 0],  // Wire - Guard (Shield)
      14: [204, 102, 0],  // Wire - Conductor (Phase)
      15: [255, 204, 0],  // Transmission Tower
      16: [255, 153, 0],  // Wire-structure Connector
      17: [153, 51, 0],   // Bridge Deck
      18: [204, 0, 102]   // High Noise
    };
    
    return (object, { index }) => {
      const classification = classifications[index];
      const color = classColors[classification] || [255, 0, 255]; // Default magenta for unknown
      return [...color, 255];
    };
  }
  
  // Default color (white)
  return [255, 255, 255, 255];
}

export default {
  loadPointCloud,
  getColorAccessor
}; 