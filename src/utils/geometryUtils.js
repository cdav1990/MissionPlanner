/**
 * Utility functions for handling THREE.js geometries
 * Particularly focused on preventing and fixing NaN errors
 */
import * as THREE from 'three';

/**
 * Sanitizes a THREE.js BufferGeometry to prevent NaN errors
 * @param {THREE.BufferGeometry} geometry - The geometry to sanitize
 * @returns {THREE.BufferGeometry} - The sanitized geometry
 */
export function sanitizeGeometry(geometry) {
  if (!geometry) return geometry;
  
  // Check and fix position attribute if it exists
  if (geometry.attributes && geometry.attributes.position) {
    const positions = geometry.attributes.position;
    let nanCount = 0;
    
    // Fix NaN values in-place
    for (let i = 0; i < positions.array.length; i++) {
      if (isNaN(positions.array[i]) || !isFinite(positions.array[i])) {
        positions.array[i] = 0;
        nanCount++;
      }
    }
    
    if (nanCount > 0) {
      console.warn(`Fixed ${nanCount} NaN values in geometry positions`);
      positions.needsUpdate = true;
    }
  }
  
  // Fix bounding sphere calculation issues
  fixBoundingSphere(geometry);
  
  return geometry;
}

/**
 * Fix issues with bounding sphere calculations
 * @param {THREE.BufferGeometry} geometry - The geometry to fix
 * @returns {THREE.BufferGeometry} - The fixed geometry
 */
export function fixBoundingSphere(geometry) {
  if (!geometry) return geometry;
  
  try {
    // First attempt to compute normally
    geometry.computeBoundingSphere();
    
    // Check if result is invalid
    if (isNaN(geometry.boundingSphere.radius) || 
        geometry.boundingSphere.radius <= 0 ||
        isNaN(geometry.boundingSphere.center.x) ||
        isNaN(geometry.boundingSphere.center.y) ||
        isNaN(geometry.boundingSphere.center.z)) {
      throw new Error('Invalid bounding sphere calculation');
    }
  } catch (e) {
    console.warn('Fixing invalid bounding sphere');
    
    // Create a bounding box to calculate a valid bounding sphere
    let min = new THREE.Vector3(Infinity, Infinity, Infinity);
    let max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    
    // If position buffer is available, use that to calculate bounds
    if (geometry.attributes && geometry.attributes.position) {
      const positions = geometry.attributes.position;
      const array = positions.array;
      
      // Scan all positions for min/max, ignoring NaN values
      for (let i = 0; i < array.length; i += 3) {
        const x = array[i];
        const y = array[i + 1];
        const z = array[i + 2];
        
        // Skip NaN or infinite values
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
        
        min.x = Math.min(min.x, x);
        min.y = Math.min(min.y, y);
        min.z = Math.min(min.z, z);
        
        max.x = Math.max(max.x, x);
        max.y = Math.max(max.y, y);
        max.z = Math.max(max.z, z);
      }
    }
    
    // If we couldn't find valid bounds, use defaults
    if (!isFinite(min.x) || !isFinite(max.x) || 
        min.x === Infinity || max.x === -Infinity) {
      min.set(-1, -1, -1);
      max.set(1, 1, 1);
    }
    
    // Create bounding box
    const box = new THREE.Box3(min, max);
    geometry.boundingBox = box;
    
    // Calculate center and radius for bounding sphere
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Use box diagonal for radius
    const size = new THREE.Vector3();
    box.getSize(size);
    const radius = Math.max(0.1, size.length() / 2);
    
    // Set bounding sphere
    geometry.boundingSphere = new THREE.Sphere(center, radius);
    console.log('Created fallback bounding sphere with radius', radius);
  }
  
  return geometry;
}

/**
 * Apply a more direct fix specifically for the BufferGeometry.computeBoundingSphere method
 * This directly targets the error seen in console
 */
export function fixComputeBoundingSphere() {
  // Store the original method
  const originalComputeBoundingSphere = THREE.BufferGeometry.prototype.computeBoundingSphere;
  
  // Override with a safe version
  THREE.BufferGeometry.prototype.computeBoundingSphere = function() {
    try {
      // Check if positions exist and are valid before calculating
      if (this.attributes && this.attributes.position) {
        const positions = this.attributes.position;
        let hasNaN = false;
        
        // Quick check for NaN values
        for (let i = 0; i < positions.array.length; i++) {
          if (isNaN(positions.array[i]) || !isFinite(positions.array[i])) {
            positions.array[i] = 0;
            hasNaN = true;
          }
        }
        
        if (hasNaN) {
          positions.needsUpdate = true;
          console.warn('Fixed NaN position values in geometry before computing bounding sphere');
        }
      }
      
      // Call original method
      originalComputeBoundingSphere.call(this);
      
      // Verify and fix the result if needed
      if (!this.boundingSphere || 
          isNaN(this.boundingSphere.radius) || 
          this.boundingSphere.radius <= 0 ||
          !this.boundingSphere.center ||
          isNaN(this.boundingSphere.center.x) ||
          isNaN(this.boundingSphere.center.y) ||
          isNaN(this.boundingSphere.center.z)) {
        
        console.warn('Creating fallback bounding sphere after failed computation');
        
        // Create a default bounding sphere
        const center = new THREE.Vector3(0, 0, 0);
        const radius = 1;
        this.boundingSphere = new THREE.Sphere(center, radius);
      }
      
      return this.boundingSphere;
    } catch (error) {
      console.error('Error in computeBoundingSphere, using fallback', error);
      
      // Create a default bounding sphere in case of any error
      const center = new THREE.Vector3(0, 0, 0);
      const radius = 1;
      this.boundingSphere = new THREE.Sphere(center, radius);
      
      return this.boundingSphere;
    }
  };
}

/**
 * Apply monkey patch to THREE.BufferGeometry to automatically sanitize geometries
 * Call this function early in your application to prevent NaN errors globally
 */
export function applyGeometrySanitization() {
  // Apply the direct fix for computeBoundingSphere
  fixComputeBoundingSphere();
  
  // Patch THREE.BoxGeometry and other primitive constructors
  const originalBoxGeometry = THREE.BoxGeometry;
  THREE.BoxGeometry = function(...args) {
    const geometry = new originalBoxGeometry(...args);
    // Ensure valid bounding sphere
    geometry.computeBoundingSphere();
    return geometry;
  };
  THREE.BoxGeometry.prototype = originalBoxGeometry.prototype;
  
  console.log('Applied global geometry sanitization');
} 