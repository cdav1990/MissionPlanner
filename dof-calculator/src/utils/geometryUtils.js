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
  
  try {
    // Check and fix position attribute if it exists
    if (geometry.attributes && geometry.attributes.position) {
      const positions = geometry.attributes.position;
      let nanCount = 0;
      
      if (!positions || !positions.array) {
        console.warn('Invalid position attribute in geometry');
        return geometry;
      }
      
      // Fix NaN values in-place
      for (let i = 0; i < positions.array.length; i++) {
        if (isNaN(positions.array[i]) || !isFinite(positions.array[i])) {
          // Instead of just setting to 0, set to a safe value based on index position
          // This helps maintain the geometry shape better
          const axis = i % 3; // 0 = x, 1 = y, 2 = z
          const vertex = Math.floor(i / 3);
          
          // Try to estimate value based on surrounding vertices
          if (vertex > 0 && i >= 3) {
            // Use previous vertex value for same axis
            positions.array[i] = positions.array[i - 3];
          } else {
            // Fallback default values per axis
            positions.array[i] = axis === 0 ? 0.5 : (axis === 1 ? 0.5 : 0.5);
          }
          
          nanCount++;
        }
      }
      
      if (nanCount > 0) {
        const alreadyWarned = window._geometryNaNWarnings?.has(geometry);
        if (!alreadyWarned) {
          console.warn(`Fixed ${nanCount} NaN values in geometry positions`);
          // Track warnings to avoid console spam
          if (!window._geometryNaNWarnings) {
            window._geometryNaNWarnings = new WeakMap();
          }
          window._geometryNaNWarnings.set(geometry, true);
        }
        
        // Always ensure the buffer is updated
        positions.needsUpdate = true;
      }
    }
    
    // Fix bounding sphere calculation issues
    fixBoundingSphere(geometry);
    
    return geometry;
  } catch (error) {
    console.error('Error in sanitizeGeometry:', error);
    return geometry; // Return the original geometry instead of failing
  }
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
  
  // Add tracking to prevent duplicate warnings for the same geometry
  if (!window._boundingSphereFixTracking) {
    window._boundingSphereFixTracking = new WeakMap();
  }
  
  // Override with a safe version
  THREE.BufferGeometry.prototype.computeBoundingSphere = function() {
    try {
      // First check if this is even a valid geometry
      if (!this || !this.attributes) {
        // Create a minimal valid bounding sphere
        this.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
        return this.boundingSphere;
      }
      
      // Check if positions exist and are valid before calculating
      if (this.attributes && this.attributes.position) {
        const positions = this.attributes.position;
        
        // Check if positions array exists
        if (!positions || !positions.array || positions.array.length === 0) {
          // Create a default bounding sphere
          this.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
          return this.boundingSphere;
        }
        
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
          
          // Check if we've already logged a warning for this geometry
          const alreadyFixed = window._boundingSphereFixTracking.get(this);
          if (!alreadyFixed) {
            console.warn('Fixed NaN position values in geometry before computing bounding sphere');
            window._boundingSphereFixTracking.set(this, true);
          }
        }
      }
      
      // Call original method within try/catch
      try {
        originalComputeBoundingSphere.call(this);
      } catch (innerError) {
        console.warn('Error in original computeBoundingSphere, creating fallback', innerError);
        this.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
      }
      
      // Verify and fix the result if needed
      if (!this.boundingSphere || 
          isNaN(this.boundingSphere.radius) || 
          this.boundingSphere.radius <= 0 ||
          !this.boundingSphere.center ||
          isNaN(this.boundingSphere.center.x) ||
          isNaN(this.boundingSphere.center.y) ||
          isNaN(this.boundingSphere.center.z)) {
        
        // Only log once per geometry
        const alreadyFixed = window._boundingSphereFixTracking.get(this);
        if (!alreadyFixed) {
          console.warn('Creating fallback bounding sphere after failed computation');
          window._boundingSphereFixTracking.set(this, true);
        }
        
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
  
  // Instead of replacing the constructor, we'll add our sanitization to BoxGeometry's prototype
  // This avoids the "Cannot assign to read only property" error
  if (THREE.BoxGeometry && THREE.BoxGeometry.prototype) {
    const originalComputeBoundingSphere = THREE.BoxGeometry.prototype.computeBoundingSphere;
    
    if (originalComputeBoundingSphere) {
      THREE.BoxGeometry.prototype.computeBoundingSphere = function() {
        // Call the original method
        originalComputeBoundingSphere.call(this);
        
        // Apply sanitization after original computation
        if (this.boundingSphere) {
          if (isNaN(this.boundingSphere.radius) || this.boundingSphere.radius <= 0) {
            console.warn('Fixing invalid bounding sphere in BoxGeometry');
            this.boundingSphere.radius = 1;
          }
          
          if (this.boundingSphere.center && 
              (isNaN(this.boundingSphere.center.x) || 
               isNaN(this.boundingSphere.center.y) || 
               isNaN(this.boundingSphere.center.z))) {
            console.warn('Fixing invalid bounding sphere center in BoxGeometry');
            this.boundingSphere.center.set(0, 0, 0);
          }
        }
        
        return this.boundingSphere;
      };
    }
  }
  
  console.log('Applied global geometry sanitization');
} 