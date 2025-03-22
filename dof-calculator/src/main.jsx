import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { applyGeometrySanitization } from './utils/geometryUtils';

// Apply geometry sanitization early to prevent NaN errors
applyGeometrySanitization();

// Check if THREE.Color is properly defined and functioning
const isColorValid = (() => {
  try {
    const color = new THREE.Color();
    return true;
  } catch (e) {
    console.error('THREE.Color constructor check failed:', e);
    return false;
  }
})();

// Force-fix the Color and Vector3 if needed to prevent R3F extension errors
if (!isColorValid || typeof THREE.Color !== 'function') {
  console.warn('Applying THREE.Color polyfill to prevent R3F extension errors');
  
  // Create a backup of the original
  const OriginalColor = THREE.Color;
  
  // Create a new constructor that will work with R3F's extension mechanism
  THREE.Color = function(r, g, b) {
    // If called without new, make sure we return a new instance
    if (!(this instanceof THREE.Color)) {
      return new THREE.Color(r, g, b);
    }

    try {
      // Try to use the original constructor
      return new OriginalColor(r, g, b);
    } catch (e) {
      console.warn('Original THREE.Color constructor failed, using polyfill');
      
      // Simple polyfill 
      this.r = 1;
      this.g = 1;
      this.b = 1;
      
      if (r !== undefined) {
        this.set(r, g, b);
      }
      
      return this;
    }
  };
  
  // Copy prototype methods
  if (OriginalColor && OriginalColor.prototype) {
    THREE.Color.prototype = OriginalColor.prototype;
  } else {
    // Basic polyfill methods if original is completely broken
    THREE.Color.prototype.set = function(r, g, b) {
      if (typeof r === 'string') {
        // Basic string parsing (enough to prevent crashes)
        if (r.startsWith('#')) {
          this.r = 0.5;
          this.g = 0.5;
          this.b = 0.5;
        } else {
          this.r = 1;
          this.g = 0;
          this.b = 0;
        }
      } else if (r !== undefined && g !== undefined && b !== undefined) {
        this.r = r;
        this.g = g;
        this.b = b;
      }
      return this;
    };
  }
  
  // Fix constructor reference
  THREE.Color.prototype.constructor = THREE.Color;
}

// Register specific THREE classes with React Three Fiber globally
// This is more explicit and reliable than extending the entire THREE object
extend({
  Color: THREE.Color,
  Vector3: THREE.Vector3,
  Vector2: THREE.Vector2,
  Matrix3: THREE.Matrix3,
  Matrix4: THREE.Matrix4,
  Quaternion: THREE.Quaternion,
  BufferGeometry: THREE.BufferGeometry,
  PointsMaterial: THREE.PointsMaterial,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  Object3D: THREE.Object3D,
  Mesh: THREE.Mesh,
  Points: THREE.Points,
  Group: THREE.Group,
  BoxGeometry: THREE.BoxGeometry,
  SphereGeometry: THREE.SphereGeometry,
  Box3: THREE.Box3
});

// Instead of modifying the THREE namespace directly, create a global reference
// that can be imported where needed
export const ThreeExtensions = {
  M3: THREE.Matrix3
};

// Debug info about THREE
console.log('Main THREE initialization:', {
  hasMatrix3: !!THREE.Matrix3,
  matrix3IsFunction: typeof THREE.Matrix3 === 'function',
  hasColor: !!THREE.Color,
  colorIsFunction: typeof THREE.Color === 'function',
  colorWorks: isColorValid
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Add error handler for unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  
  // Check if this is a THREE.Color extension error
  if (event.error && event.error.message && 
      (event.error.message.includes('THREE.Color') || 
       event.error.message.includes('CanvasImpl'))) {
    console.warn('Caught critical THREE extension error, preventing page reload');
    event.preventDefault();
    
    // Try to notify the user through UI if possible
    try {
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'fixed';
      errorDiv.style.top = '10px';
      errorDiv.style.right = '10px';
      errorDiv.style.padding = '10px';
      errorDiv.style.background = 'rgba(255,0,0,0.7)';
      errorDiv.style.color = 'white';
      errorDiv.style.borderRadius = '5px';
      errorDiv.style.zIndex = '9999';
      errorDiv.textContent = 'WebGL error detected. Try refreshing the page.';
      document.body.appendChild(errorDiv);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        errorDiv.style.opacity = '0';
        errorDiv.style.transition = 'opacity 1s';
        // Remove after fade
        setTimeout(() => errorDiv.remove(), 1000);
      }, 5000);
    } catch (e) {
      // If we can't add the notification, just log it
      console.error('Failed to show error notification:', e);
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
