/**
 * PotreeUtils.js - Simplified version with stubs for Three.js-only implementation
 * This removes Potree dependency while maintaining API compatibility
 */

import * as THREE from 'three';

/**
 * Stub implementation of loadPointCloud that creates a simple point cloud using Three.js
 */
export const loadPointCloud = (url, container, options = {}, onLoad, onProgress, onError) => {
  console.log('Using simplified Three.js point cloud loader instead of Potree');
  
  try {
    // Create a basic point cloud with Three.js instead of Potree
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({ 
      size: options.pointSize || 0.05, 
      color: 0x888888,
      sizeAttenuation: true
    });
    
    const points = new THREE.Points(geometry, material);
    
    // Mock the Potree point cloud API
    points.material.size = options.pointSize || 0.05;
    points.material.opacity = options.opacity || 1.0;
    points.material.transparent = options.opacity < 1.0;
    
    // Add standard methods expected by UI components
    points.getBoundingBox = () => new THREE.Box3().setFromObject(points);
    points.getScale = () => new THREE.Vector3(1, 1, 1);
    points.position.set(0, 0, 0);
    points.updateMatrix();
    
    // Simulate async loading with timeout
            setTimeout(() => {
      if (onLoad) onLoad(points);
    }, 100);
    
    return points;
  } catch (error) {
    console.error('Error creating Three.js point cloud:', error);
    if (onError) onError(error);
    return null;
  }
};

/**
 * Stub for point cloud optimization
 */
export const optimizePointCloud = (pointcloud) => {
  console.log('Point cloud optimization stub called');
  return pointcloud;
};

/**
 * Stub for updating point cloud settings
 */
export const updatePointCloudSettings = (pointcloud, settings = {}) => {
  console.log('Point cloud settings update stub called', settings);
  
  if (!pointcloud) return;
  
  // Handle basic settings that map to Three.js PointsMaterial
  if (settings.pointSize !== undefined && pointcloud.material) {
    pointcloud.material.size = settings.pointSize;
  }
  
  if (settings.opacity !== undefined && pointcloud.material) {
    pointcloud.material.opacity = settings.opacity;
    pointcloud.material.transparent = settings.opacity < 1.0;
  }
  
  return pointcloud;
};

/**
 * Check if system can handle point clouds (simplified)
 */
export const checkSystemCapabilities = () => {
  return {
    canRenderPointClouds: true,
    maxPointsRecommended: 500000,
    performance: 'medium',
    webglVersion: 2,
    warnings: []
  };
};

/**
 * Check if basic Potree is available (will return false)
 */
export const isPotreeAvailable = () => {
  return false;
};

/**
 * Stub for getting Potree status
 */
export const potreeStatus = {
  isInitialized: false,
  isLoading: false,
  version: 'three.js-fallback'
};

/**
 * Stub for subscribing to Potree status
 */
export const subscribeToPotreeStatus = (callback) => {
  // Just call once with the default status
  if (typeof callback === 'function') {
    setTimeout(() => callback(potreeStatus), 0);
  }
  return () => {}; // Return unsubscribe function
};

/**
 * Extract metadata from URL (simplified)
 */
export const extractMetadataFromUrl = (url) => {
    return {
    sourceType: 'unknown',
    isValid: true,
    pointCount: 0,
    boundingBox: new THREE.Box3(
      new THREE.Vector3(-10, -10, -10),
      new THREE.Vector3(10, 10, 10)
    )
  };
};

/**
 * Simple point cloud scale analyzer
 */
export const analyzePointCloudScale = (pointcloud) => {
    return {
    scale: 1.0,
    isLargeScale: false,
    isSmallScale: false,
    recommendedScale: 1.0
  };
};

// Export all stubs as default as well
export default {
  loadPointCloud,
  optimizePointCloud,
  updatePointCloudSettings,
  checkSystemCapabilities,
  isPotreeAvailable,
  potreeStatus,
  subscribeToPotreeStatus,
  extractMetadataFromUrl,
  analyzePointCloudScale
}; 