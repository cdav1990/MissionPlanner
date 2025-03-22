/**
 * ModelLoaderUtils.js
 * Utility functions for managing 3D model loading and related resources.
 */
import * as THREE from 'three';

// Track resources for proper cleanup
const loadedResources = {
  textures: [],
  materials: [],
  geometries: [],
  objects: [],
  blobUrls: new Set()
};

/**
 * Cleans up all cached resources used by model loaders
 * @param {boolean} [forceGC=false] - Whether to try forcing garbage collection
 * @returns {boolean} Success status
 */
export function cleanupAllModelLoader(forceGC = false) {
  // Clean up any cached resources like textures
  try {
    // Clear THREE.js cache
    Object.keys(THREE.Cache.files).forEach(key => {
      THREE.Cache.remove(key);
    });
    
    // Dispose tracked textures
    loadedResources.textures.forEach(texture => {
      if (texture && texture.dispose) {
        texture.dispose();
      }
    });
    loadedResources.textures = [];
    
    // Dispose tracked materials
    loadedResources.materials.forEach(material => {
      if (material && material.dispose) {
        // Make sure to dispose any textures in the material
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.specularMap) material.specularMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        
        material.dispose();
      }
    });
    loadedResources.materials = [];
    
    // Dispose tracked geometries
    loadedResources.geometries.forEach(geometry => {
      if (geometry && geometry.dispose) {
        geometry.dispose();
      }
    });
    loadedResources.geometries = [];
    
    // Release memory from tracked objects
    loadedResources.objects.forEach(object => {
      if (object) {
        // Clear any references that might prevent GC
        if (object.parent) object.parent.remove(object);
        if (object.children) object.children.length = 0;
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });
    loadedResources.objects = [];
    
    // Revoke any stored blob URLs
    loadedResources.blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn(`Failed to revoke blob URL: ${url}`, e);
      }
    });
    loadedResources.blobUrls.clear();
    
    // Try to hint to the browser to collect garbage
    if (forceGC && window.gc) {
      try {
        window.gc();
      } catch (e) {
        // Ignore if not available
      }
    }
    
    console.log("Model loader cache and resources cleared");
    return true;
  } catch (err) {
    console.error("Error cleaning up model loader resources:", err);
    return false;
  }
}

/**
 * Register a resource for tracking and later cleanup
 * @param {string} type - Resource type: 'texture', 'material', 'geometry', 'object', 'blobUrl'
 * @param {Object} resource - The resource to track
 */
export function registerResource(type, resource) {
  if (!resource) return;
  
  switch (type) {
    case 'texture':
      loadedResources.textures.push(resource);
      break;
    case 'material':
      loadedResources.materials.push(resource);
      break;
    case 'geometry':
      loadedResources.geometries.push(resource);
      break;
    case 'object':
      loadedResources.objects.push(resource);
      break;
    case 'blobUrl':
      loadedResources.blobUrls.add(resource);
      break;
    default:
      console.warn(`Unknown resource type: ${type}`);
  }
}

/**
 * Creates a blob URL from a file and registers it for cleanup
 * @param {File|Blob} file - The file or blob to create URL from
 * @returns {string} The created blob URL
 */
export function createAndTrackBlobUrl(file) {
  const url = URL.createObjectURL(file);
  registerResource('blobUrl', url);
  return url;
}

/**
 * Alias for cleanupAllModelLoader to maintain compatibility
 * @param {boolean} [forceGC=false] - Whether to try forcing garbage collection
 * @returns {boolean} Success status
 */
export function cleanupAllBlobUrls(forceGC = false) {
  return cleanupAllModelLoader(forceGC);
}

/**
 * Gets memory usage statistics 
 * @returns {Object|null} Memory stats or null if not available
 */
export function getMemoryStats() {
  if (window.performance && window.performance.memory) {
    const memory = window.performance.memory;
    return {
      usedJSHeapSize: formatBytes(memory.usedJSHeapSize),
      jsHeapSizeLimit: formatBytes(memory.jsHeapSizeLimit),
      totalJSHeapSize: formatBytes(memory.totalJSHeapSize),
      percentUsed: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1) + '%',
      resourceCount: {
        textures: loadedResources.textures.length,
        materials: loadedResources.materials.length,
        geometries: loadedResources.geometries.length,
        objects: loadedResources.objects.length,
        blobUrls: loadedResources.blobUrls.size,
        cacheItems: Object.keys(THREE.Cache.files).length
      }
    };
  }
  return null;
}

/**
 * Helper to format bytes into human-readable format
 * @private
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Export an object for backward compatibility with existing imports
// But prefer to use the named exports directly
const ModelLoaderUtils = {
  cleanupAllModelLoader,
  cleanupAllBlobUrls,
  registerResource,
  createAndTrackBlobUrl,
  getMemoryStats
};

// We're exporting BOTH ways to maintain compatibility while fixing HMR
// Named exports (preferred) and a default export for legacy code
export { ModelLoaderUtils };
export default ModelLoaderUtils; 