import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader';
import { isAppleSilicon, isM3Mac, isWindows, getOptimalRenderSettings } from './PlatformDetection';

// Track WebGL context loss globally and make it safer
let hasExperiencedContextLoss = false;
let potreeRecoveryAttempted = false;
let potreeLoader = null;
let PotreeLoader = null;

// Safely handle window references for SSR compatibility
const isClient = typeof window !== 'undefined';

// Default availability states
let potreeAvailable = false;
let potreeMarkupAvailable = false;

// Platform-specific point budget presets
const getPointBudgetForPlatform = () => {
  if (isM3Mac()) {
    return 1500000; // M3 Mac - balanced setting
  } else if (isAppleSilicon()) {
    return 1000000; // Other Apple Silicon - conservative
  } else if (isWindows()) {
    // Detect high-end Windows
    const settings = getOptimalRenderSettings();
    return settings.pointBudget || 2000000; // Use platform settings or default
  }
  return 2000000; // Default for other platforms
};

// Force disable Potree after context loss
const forceDisablePotree = () => {
  console.warn('WebGL context loss detected with Potree - reloading page');
  
  // Force a reload instead of trying to recover
  window.location.reload();
};

/**
 * Simple point cloud renderer using three.js particles
 * Optimized for cross-platform compatibility
 * @param {ArrayBuffer} data - PLY or PCD file data
 * @param {Object} options - Options for rendering
 * @returns {THREE.Points} - Points object to add to scene
 */
export const createSimplePointCloud = (data, options = {}) => {
  const { 
    color = 0x0088ff, 
    size = 0.05,
    extension = 'ply',
    scale = 1.0,
    onProgress = null
  } = options;
  
  let geometry;
  
  try {
    if (extension.toLowerCase() === 'ply') {
      const loader = new PLYLoader();
      geometry = loader.parse(data);
    } else if (extension.toLowerCase() === 'pcd') {
      const loader = new PCDLoader();
      // PCDLoader requires a URL, so we can't use it with direct data
      // This is a limitation of the current implementation
      console.warn('PCD direct loading not supported in simple point cloud');
      geometry = new THREE.BufferGeometry();
    } else {
      console.error('Unsupported extension for simple point cloud:', extension);
      geometry = new THREE.BufferGeometry();
    }
    
    if (geometry) {
      // Apply scale if needed
      if (scale !== 1.0) {
        geometry.scale(scale, scale, scale);
      }

      // Check if we have colors in the geometry
      const hasColors = geometry.getAttribute('color') !== undefined;
      
      // Optimize geometry for the platform
      optimizeGeometryForPlatform(geometry);
      
      // Create material with platform-specific settings
      const material = createPlatformOptimizedMaterial({
        size,
        hasColors,
        color
      });

      // Create points
      const points = new THREE.Points(geometry, material);
      
      // Add metadata
      points.userData = {
        isSimplePointCloud: true,
        pointCount: geometry.getAttribute('position').count,
        source: 'simple-renderer'
      };
      
      return points;
    }
  } catch (e) {
    console.error('Error creating simple point cloud:', e);
  }
  
  // Return empty points if failed
  const emptyGeometry = new THREE.BufferGeometry();
  const emptyMaterial = new THREE.PointsMaterial({ size: 0.1, color: 0xff0000 });
  return new THREE.Points(emptyGeometry, emptyMaterial);
};

/**
 * Optimize geometry based on platform capabilities
 */
function optimizeGeometryForPlatform(geometry) {
  // Skip if no geometry
  if (!geometry) return;
  
  try {
    // Apple Silicon benefits from reduced precision
    if (isAppleSilicon()) {
      // Convert to 16-bit floats on Apple Silicon if possible
      const position = geometry.getAttribute('position');
      if (position && position.array.constructor === Float32Array) {
        // We can't actually use 16-bit floats directly in WebGL, 
        // but we can normalize the data to improve performance
        geometry.setAttribute('position', 
          new THREE.BufferAttribute(
            new Float32Array(position.array),
            position.itemSize,
            position.normalized
          )
        );
      }
    }
    
    // For all platforms, dispose unneeded attributes to save memory
    const neededAttributes = ['position', 'color', 'normal'];
    
    geometry.attributes = Object.entries(geometry.attributes)
      .filter(([key]) => neededAttributes.includes(key))
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
    
    // Compute bounding info if missing
    if (!geometry.boundingSphere) {
      geometry.computeBoundingSphere();
    }
  } catch (e) {
    console.warn('Could not optimize geometry for platform:', e);
  }
}

/**
 * Create a material optimized for the current platform
 */
function createPlatformOptimizedMaterial(options) {
  const { size, hasColors, color } = options;
  
  // Get render settings based on platform
  const settings = getOptimalRenderSettings();
  
  // Create the material
  const material = new THREE.PointsMaterial({
    size: size,
    sizeAttenuation: true,
    vertexColors: hasColors,
    color: hasColors ? 0xffffff : color,
    transparent: true,
    opacity: 0.8,
    // On Apple Silicon, prefer high performance over quality
    alphaTest: isAppleSilicon() ? 0.1 : 0.05,
    // Disable depth write on Apple Silicon to prevent Z-fighting issues
    depthWrite: !isAppleSilicon(),
    // Use cheaper blending mode on Apple Silicon
    blending: isAppleSilicon() ? THREE.NoBlending : THREE.NormalBlending
  });
  
  return material;
}

/**
 * Initialize Potree with platform-specific optimizations
 * @returns {Promise} - Resolves when Potree is loaded or fails
 */
export const initPotree = async () => {
  if (!isClient) {
    console.warn('Potree cannot be initialized on server');
    return { available: false, error: 'Server side rendering' };
  }
  
  // Prevent initialization after context loss - force reload instead
  if (hasExperiencedContextLoss) {
    console.warn('WebGL context was lost previously - reloading page');
    window.location.reload();
    return { available: false, error: 'Previous WebGL context loss' };
  }
  
  try {
    // Check if Potree is already loaded and not disabled
    if (window.Potree && !window.Potree.disabled) {
      console.log('Potree already loaded:', window.Potree.version);
      
      // Set up the loader if not already set
      if (!potreeLoader && window.Potree.PointCloudOctreeLoader) {
        try {
          PotreeLoader = window.Potree.PointCloudOctreeLoader;
          potreeLoader = new PotreeLoader();
          potreeLoader.setPath('./potree/');
          
          // Apply platform-specific optimizations
          applyPotreePlatformOptimizations();
        } catch (e) {
          console.error('Error setting up Potree loader:', e);
          return { available: false, error: e.message };
        }
      }
      
      return { 
        available: true, 
        version: window.Potree.version,
        loader: potreeLoader 
      };
    }
    
    // Potree not available, attempt to load
    console.log('Attempting to load Potree from CDN or local...');
    
    // Try to load Potree from various sources
    try {
      // First try loading from relative path
      await loadScript('./potree/potree.js');
    } catch (localError) {
      console.warn('Failed to load Potree from local path:', localError);
      try {
        // Try CDN as fallback
        await loadScript('https://cdn.jsdelivr.net/npm/potree-core/potree/potree.js');
      } catch (cdnError) {
        console.error('Failed to load Potree from all sources:', cdnError);
        return { available: false, error: 'Failed to load Potree' };
      }
    }
    
    // Check if it loaded successfully
    if (window.Potree) {
      console.log('Potree loaded successfully:', window.Potree.version);
      
      // Initialize the loader
      if (window.Potree.PointCloudOctreeLoader) {
        try {
          PotreeLoader = window.Potree.PointCloudOctreeLoader;
          potreeLoader = new PotreeLoader();
          potreeLoader.setPath('./potree/');
          
          // Apply platform-specific optimizations
          applyPotreePlatformOptimizations();
        } catch (e) {
          console.error('Error initializing Potree loader:', e);
          return { available: false, error: e.message };
        }
      }
      
      return { 
        available: true, 
        version: window.Potree.version,
        loader: potreeLoader
      };
    } else {
      console.error('Potree failed to initialize properly');
      return { available: false, error: 'Failed to initialize' };
    }
  } catch (e) {
    console.error('Error during Potree initialization:', e);
    return { available: false, error: e.message };
  }
};

/**
 * Apply platform-specific optimizations to Potree
 */
function applyPotreePlatformOptimizations() {
  if (!window.Potree) return;
  
  try {
    // Get point budget based on platform
    const pointBudget = getPointBudgetForPlatform();
    
    // Set global point budget
    if (typeof window.Potree.setPointBudget === 'function') {
      window.Potree.setPointBudget(pointBudget);
      console.log(`Set Potree global point budget to ${pointBudget}`);
    }
    
    // Apply platform-specific settings
    if (isAppleSilicon()) {
      // For Apple Silicon, prioritize performance over quality
      if (window.Potree.Quality) {
        window.Potree.quality = window.Potree.Quality.PERFORMANCE;
      }
      
      // Disable expensive features
      if (window.Potree.Features) {
        window.Potree.Features = {
          ...window.Potree.Features,
          ENABLE_EDL: false,
          ENABLE_CLIPVOLUMES: false
        };
      }
    } else if (isWindows()) {
      // For Windows, use standard settings based on performance
      const isHighPerformance = getOptimalRenderSettings().powerPreference === 'high-performance';
      
      if (window.Potree.Quality && isHighPerformance) {
        window.Potree.quality = window.Potree.Quality.DEFAULT;
      } else if (window.Potree.Quality) {
        window.Potree.quality = window.Potree.Quality.PERFORMANCE;
      }
    }
    
    console.log('Applied platform-specific Potree optimizations');
  } catch (e) {
    console.warn('Error applying Potree optimizations:', e);
  }
}

/**
 * Load a script dynamically
 * @param {string} url - URL of the script to load
 * @returns {Promise} - Resolves when loaded, rejects on error
 */
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

/**
 * Set up WebGL context loss handling specifically for Potree
 * @param {HTMLCanvasElement} canvas - The canvas element used by Three.js
 */
export const setupPotreeContextHandling = (canvas) => {
  if (!canvas || !isClient) return;
  
  // Handle context loss
  const handleContextLoss = (event) => {
    console.warn('WebGL context lost - handling for Potree');
    
    // Force page reload instead of trying to recover
    window.location.reload();
  };
  
  // Handle context restored
  const handleContextRestored = async (event) => {
    // We shouldn't get here since we reload on loss, but just in case
    console.log('WebGL context restored - reloading page for clean state');
    window.location.reload();
  };
  
  // Add event listeners
  canvas.addEventListener('webglcontextlost', handleContextLoss, false);
  canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
  
  // Return cleanup function
  return () => {
    canvas.removeEventListener('webglcontextlost', handleContextLoss);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
  };
};

/**
 * Check if Potree is available
 * @returns {boolean} - Whether Potree is available
 */
export const isPotreeAvailable = () => potreeAvailable;

/**
 * Check if Potree markup features are available
 * @returns {boolean} - Whether markup is available
 */
export const isPotreeMarkupAvailable = () => potreeMarkupAvailable && potreeAvailable;

/**
 * Load a point cloud using Potree or fallback to simple renderer
 * @param {string|ArrayBuffer} source - URL or data of the point cloud
 * @param {Object} options - Loading options
 * @returns {Promise} - Resolves with the loaded point cloud
 */
export const loadPointCloud = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isClient) {
      reject(new Error('Cannot load point cloud on server'));
      return;
    }
    
    if (!potreeLoader) {
      reject(new Error('Potree loader not initialized'));
      return;
    }
    
    try {
      const { onProgress = null } = options;
      
      potreeLoader.load(url, 
        // onLoad
        (pointcloud) => {
          if (!pointcloud) {
            reject(new Error('Point cloud loaded but was null'));
            return;
          }
          
          try {
            // Apply settings
            if (pointcloud.material) {
              pointcloud.material.size = options.pointSize || 1.0;
              pointcloud.material.pointSizeType = 0; // Fixed
              pointcloud.material.shape = 0; // Square
              pointcloud.material.opacity = options.opacity || 1.0;
              pointcloud.material.transparent = options.opacity < 1.0;
            }
            
            // Apply point budget based on platform
            if (typeof pointcloud.pointBudget !== 'undefined') {
              const pointBudget = getPointBudgetForPlatform();
              pointcloud.pointBudget = pointBudget;
            }
            
            resolve(pointcloud);
          } catch (e) {
            console.error('Error configuring point cloud:', e);
            reject(e);
          }
        },
        // onProgress
        (xhr) => {
          if (onProgress) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            onProgress(percent, xhr);
          }
        },
        // onError
        (error) => {
          console.error('Error loading point cloud:', error);
          reject(error);
        }
      );
    } catch (e) {
      console.error('Error in loadPointCloud:', e);
      reject(e);
    }
  });
};

/**
 * Handle WebGL context loss for point clouds
 * @param {THREE.Points} pointCloud - The point cloud object to handle
 * @param {THREE.Scene} scene - The scene containing the point cloud
 */
export const handlePointCloudContextLoss = (pointCloud, scene) => {
  if (!pointCloud || !scene) return;
  
  // Remove the point cloud from the scene
  if (scene.remove && typeof scene.remove === 'function') {
    scene.remove(pointCloud);
  }
  
  // Dispose of the geometry
  if (pointCloud.geometry && 
      pointCloud.geometry.dispose && 
      typeof pointCloud.geometry.dispose === 'function') {
    pointCloud.geometry.dispose();
  }
  
  // Dispose of the material
  if (pointCloud.material) {
    if (Array.isArray(pointCloud.material)) {
      pointCloud.material.forEach(material => {
        if (material.dispose && typeof material.dispose === 'function') {
          material.dispose();
        }
      });
    } else if (pointCloud.material.dispose && 
               typeof pointCloud.material.dispose === 'function') {
      pointCloud.material.dispose();
    }
  }
  
  // Clear any other properties
  if (pointCloud.clear && typeof pointCloud.clear === 'function') {
    pointCloud.clear();
  }
};

// Exports for point cloud utilities
export { 
  PotreeLoader, 
  hasExperiencedContextLoss, 
  potreeRecoveryAttempted 
}; 