/**
 * ThreeContextRecovery.js
 * Utility to handle WebGL context loss in Three.js applications
 * Enhanced with Potree-specific recovery mechanisms and platform optimizations
 */

import { useEffect, useRef } from 'react';
import { 
  isAppleSilicon, 
  isHighEndSystem, 
  getOptimalRenderSettings,
  detectMemoryPressure
} from './PlatformDetection';

// Add Potree-specific imports
let potreeDisposalHandlers = [];
let recoveryAttempts = 0;
const MAX_AUTO_RECOVERY_ATTEMPTS = 3;
let lastContextLossTime = 0;
let memoryMonitorInterval = null;

/**
 * Register a Potree-specific disposal handler
 * @param {Function} handler - Function to call on context loss to clean up resources
 * @returns {Function} - Function to unregister the handler
 */
export const registerPotreeDisposalHandler = (handler) => {
  if (typeof handler === 'function') {
    potreeDisposalHandlers.push(handler);
    
    // Return function to unregister
    return () => {
      potreeDisposalHandlers = potreeDisposalHandlers.filter(h => h !== handler);
    };
  }
  return () => {};
};

/**
 * Clear all Potree resources during context loss
 */
const clearPotreeResources = () => {
  console.log('Clearing Potree resources due to context loss');
  
  // Call all registered handlers
  potreeDisposalHandlers.forEach(handler => {
    try {
      handler();
    } catch (e) {
      console.error('Error in Potree disposal handler:', e);
    }
  });
  
  // Check for global Potree instance
  if (window.Potree) {
    try {
      // Try to clear any global caches
      if (window.Potree.lru && typeof window.Potree.lru.clear === 'function') {
        window.Potree.lru.clear();
        console.log('Cleared Potree LRU cache');
      }
      
      // Try to clear any loaded point clouds
      if (Array.isArray(window.Potree.loadedPointclouds)) {
        window.Potree.loadedPointclouds = [];
        console.log('Cleared Potree loaded point clouds reference');
      }
      
      // Attempt to clean up resources on Potree instance
      for (const key in window.Potree) {
        if (window.Potree[key] && typeof window.Potree[key].clear === 'function') {
          try {
            window.Potree[key].clear();
            console.log(`Cleared Potree resource: ${key}`);
          } catch (e) {
            console.warn(`Error clearing Potree resource ${key}:`, e);
          }
        }
      }
      
      // Force garbage collection if available
      if (window.gc) {
        try {
          window.gc();
          console.log('Forced garbage collection');
        } catch (e) {
          console.warn('Failed to force garbage collection:', e);
        }
      }
    } catch (e) {
      console.warn('Error clearing Potree global resources:', e);
    }
  }
};

/**
 * Initialize memory monitoring to prevent context loss
 */
export const initMemoryMonitoring = () => {
  // Clear any existing interval
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
  }

  // Create a new monitoring interval
  const checkInterval = isAppleSilicon() ? 10000 : 30000; // Check more frequently on Apple Silicon
  
  memoryMonitorInterval = setInterval(() => {
    // Skip if a context loss occurred recently
    const timeSinceContextLoss = Date.now() - lastContextLossTime;
    if (lastContextLossTime > 0 && timeSinceContextLoss < 60000) {
      return;
    }
    
    // Check for memory pressure
    if (detectMemoryPressure()) {
      console.warn('Memory pressure detected - performing preventive cleanup');
      
      // Clear THREE.js cache to free memory
      if (window.THREE && window.THREE.Cache) {
        window.THREE.Cache.clear();
        console.log('Cleared THREE.Cache');
      }
      
      // For Apple Silicon, take more aggressive measures
      if (isAppleSilicon()) {
        // Clear Potree resources before critical issues occur
        clearPotreeResources();
        
        // Request garbage collection
        if (window.gc) window.gc();
      }
    }
  }, checkInterval);
  
  // Return cleanup function
  return () => {
    if (memoryMonitorInterval) {
      clearInterval(memoryMonitorInterval);
      memoryMonitorInterval = null;
    }
  };
};

/**
 * Sets up listeners and handlers for WebGL context loss and recovery
 * @param {HTMLCanvasElement} canvas - The canvas element to monitor
 * @param {Function} onContextLost - Callback when context is lost
 * @param {Function} onContextRestored - Callback when context is restored
 */
export const setupContextLossHandling = (canvas, onContextLost, onContextRestored) => {
  if (!canvas) return;
  
  const handleContextLoss = (event) => {
    console.warn('WebGL context lost');
    lastContextLossTime = Date.now();
    
    // Prevent default behavior that would make context unrecoverable
    event.preventDefault();
    
    // Call provided handler
    if (typeof onContextLost === 'function') {
      onContextLost(event);
    }
    
    // Clean up resources to improve recovery chances
    clearPotreeResources();
    
    // Update context loss tracking (for emergency UI)
    if (window.__webglContextIssues) {
      window.__webglContextIssues.lossCount++;
      window.__webglContextIssues.lastLossTime = Date.now();
    }
    
    // Dispatch a custom event for other components to respond
    const customEvent = new CustomEvent('webglcontextlost', { detail: { timestamp: Date.now() } });
    window.dispatchEvent(customEvent);
  };
  
  const handleContextRestored = (event) => {
    console.log('WebGL context restored');
    recoveryAttempts++;
    
    // Call provided handler
    if (typeof onContextRestored === 'function') {
      onContextRestored(event);
    }
    
    // Update context recovery tracking
    if (window.__webglContextIssues) {
      window.__webglContextIssues.recoveryCount++;
    }
    
    // Dispatch a custom event for other components to respond
    const customEvent = new CustomEvent('webglcontextrestored', { detail: { timestamp: Date.now() } });
    window.dispatchEvent(customEvent);
    
    // On Apple Silicon, reduce quality after recovery to prevent further issues
    if (isAppleSilicon() && recoveryAttempts > 0) {
      console.log('Reducing quality settings after context recovery on Apple Silicon');
      
      // Reduce point budget further after each recovery
      if (window.Potree && typeof window.Potree.setPointBudget === 'function') {
        const reducedBudget = Math.max(500000, 1000000 - (recoveryAttempts * 200000));
        window.Potree.setPointBudget(reducedBudget);
        console.log(`Reduced point budget to ${reducedBudget} after recovery`);
      }
    }
  };
  
  // Apply context settings based on platform
  if (canvas.getContext && typeof canvas.getContext === 'function') {
    try {
      // Get settings based on platform
      const settings = getOptimalRenderSettings();
      
      // Apply power preference to the canvas context
      const contextOptions = {
        powerPreference: settings.powerPreference,
        antialias: settings.antialias,
        failIfMajorPerformanceCaveat: false, // Don't fail on low-performance devices
        desynchronized: isAppleSilicon() // Use desynchronized for better performance on Apple Silicon
      };
      
      // Log the context settings being used
      console.log('Using WebGL context options:', contextOptions);
      
      // Try to get the context with our optimized settings
      // This won't affect existing contexts but will apply to new ones
      canvas.getContext('webgl2', contextOptions) || 
      canvas.getContext('webgl', contextOptions) || 
      canvas.getContext('experimental-webgl', contextOptions);
    } catch (e) {
      console.warn('Failed to apply optimized WebGL context settings:', e);
    }
  }
  
  // Add event listeners
  canvas.addEventListener('webglcontextlost', handleContextLoss, false);
  canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
  
  // Start memory monitoring
  const cleanupMemoryMonitor = initMemoryMonitoring();
  
  // Return cleanup function to remove listeners
  return () => {
    canvas.removeEventListener('webglcontextlost', handleContextLoss);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    cleanupMemoryMonitor();
  };
};

/**
 * Function to check if a context already exists on a canvas
 * @param {HTMLCanvasElement} canvas - The canvas to check
 * @returns {boolean} True if a context exists, false otherwise
 */
const hasExistingContext = (canvas) => {
  if (!canvas) return false;
  
  try {
    // Try to get a context - if it returns null, there's already a context that hasn't been lost
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !gl;
  } catch (e) {
    if (e.message && e.message.includes('existing context')) {
      return true;
    }
    return false;
  }
};

/**
 * Function to forcibly clean a canvas of existing context
 * @param {HTMLCanvasElement} canvas - The canvas to clean
 * @returns {HTMLCanvasElement} The cleaned canvas, or false if cleaning failed
 */
const cleanExistingContext = (canvas) => {
  if (!canvas) return false;
  
  // Try creating a temporary canvas and replacing the original
  if (hasExistingContext(canvas)) {
    try {
      // Save attributes
      const width = canvas.width;
      const height = canvas.height;
      const style = canvas.style.cssText;
      const parentNode = canvas.parentNode;
      const nextSibling = canvas.nextSibling;
      
      // Create new canvas
      const newCanvas = document.createElement('canvas');
      newCanvas.width = width;
      newCanvas.height = height;
      newCanvas.style.cssText = style;
      
      // Replace old canvas with new one
      if (parentNode) {
        if (nextSibling) {
          parentNode.insertBefore(newCanvas, nextSibling);
        } else {
          parentNode.appendChild(newCanvas);
        }
        parentNode.removeChild(canvas);
      }
      
      console.log('Replaced canvas with a new one to clear existing context');
      return newCanvas;
    } catch (e) {
      console.error('Error cleaning existing context:', e);
      return false;
    }
  }
  
  return false;
};

/**
 * Attempts to recover from a context loss
 * @param {HTMLCanvasElement} canvas - Canvas to recover
 */
const attemptContextRecovery = (canvas) => {
  if (!canvas) return;
  
  try {
    // Check if we have an existing context problem
    if (hasExistingContext(canvas)) {
      const newCanvas = cleanExistingContext(canvas);
      if (newCanvas) {
        // Use the new canvas
        canvas = newCanvas;
      }
    }
    
    // First try forcing a style change to trigger a repaint
    const originalStyle = canvas.style.display;
    canvas.style.display = 'none';
    // Force reflow
    void canvas.offsetHeight;
    canvas.style.display = originalStyle;
    
    // Then try to force context restoration via the extension
    setTimeout(() => {
      try {
        // Check if we can get context and extension
        const gl = canvas.getContext('webgl2') || 
                  canvas.getContext('webgl') || 
                  canvas.getContext('experimental-webgl');
                  
        if (!gl) return;
        
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
          console.log('Attempting automatic context restoration via WEBGL_lose_context');
          ext.restoreContext();
        }
      } catch (e) {
        console.warn('Automatic context restoration failed:', e);
      }
    }, 300);
  } catch (e) {
    console.error('Error in recovery attempt:', e);
  }
};

/**
 * React hook to handle context loss in Three.js with react-three-fiber
 * @param {Function} onLost - Callback when context is lost
 * @param {Function} onRestored - Callback when context is restored
 */
export const useWebGLContextHandler = (onLost, onRestored) => {
  // Keep track of the cleanup function
  const cleanupRef = useRef(null);
  
  useEffect(() => {
    // Select the canvas element - r3f creates a canvas in the document
    const canvases = document.querySelectorAll('canvas');
    const canvas = canvases[canvases.length - 1]; // Get the last canvas (most likely the active one)
    
    if (canvas) {
      const handleContextLost = (event) => {
        console.warn('R3F WebGL context lost:', event);
        
        // Call user callback
        if (typeof onLost === 'function') {
          onLost(event);
        }
      };
      
      const handleContextRestored = (event) => {
        console.log('R3F WebGL context restored:', event);
        
        // Call user callback
        if (typeof onRestored === 'function') {
          onRestored(event);
        }
      };
      
      // Set up event listeners
      cleanupRef.current = setupContextLossHandling(canvas, handleContextLost, handleContextRestored);
    }
    
    // Return cleanup function
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [onLost, onRestored]);
};

/**
 * Tries to force a recovery of the WebGL context
 * @param {HTMLCanvasElement} canvas - The canvas to recover
 * @returns {boolean} Success status
 */
export const forceContextRecovery = (canvas) => {
  if (!canvas) {
    // Find canvas if not provided
    const canvases = document.querySelectorAll('canvas');
    canvas = canvases[canvases.length - 1]; // Use last canvas
    if (!canvas) return false;
  }
  
  try {
    // First try changing style and size temporarily to trigger renderer reset
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    const originalStyle = canvas.style.cssText;
    
    // Apply a minimal change to force a reflow/repaint
    canvas.style.display = 'none';
    canvas.width = originalWidth - 1;
    canvas.height = originalHeight - 1;
    
    // Force reflow
    void canvas.offsetHeight;
    
    // Restore original dimensions
    canvas.style.cssText = originalStyle;
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    
    // Get the WebGL context
    const gl = canvas.getContext('webgl2') || 
               canvas.getContext('webgl') || 
               canvas.getContext('experimental-webgl');
    
    if (!gl) return false;
    
    // Try to reset by calling loseContext and then restoreContext
    const loseExtension = gl.getExtension('WEBGL_lose_context');
    if (loseExtension) {
      console.log('Attempting to force WebGL context recovery...');
      
      // Force context loss
      loseExtension.loseContext();
      
      // Schedule context restoration after a brief delay
      setTimeout(() => {
        try {
          loseExtension.restoreContext();
          console.log('WebGL context has been successfully restored');
        } catch (err) {
          console.error('Failed to restore WebGL context:', err);
          
          // If the first attempt fails, try once more after a longer delay
          setTimeout(() => {
            try {
              loseExtension.restoreContext();
              console.log('WebGL context has been successfully restored on second attempt');
            } catch (err2) {
              console.error('Failed to restore WebGL context on second attempt:', err2);
            }
          }, 1000);
        }
      }, 300);
      
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('Error attempting to force context recovery:', err);
    return false;
  }
};

/**
 * Tries to determine if the current device might be prone to WebGL context losses
 * @returns {Object} Device capability assessment
 */
export const assessDeviceWebGLCapability = () => {
  const assessment = {
    webglSupported: false,
    webgl2Supported: false,
    rendererInfo: null,
    maxTextureSize: 0,
    maxViewportDims: null,
    isLowEndDevice: true,
    riskOfContextLoss: 'unknown',
    recommendations: []
  };
  
  try {
    // Create a test canvas
    const canvas = document.createElement('canvas');
    
    // Try WebGL 2 first
    let gl = canvas.getContext('webgl2');
    if (gl) {
      assessment.webgl2Supported = true;
    } else {
      // Fall back to WebGL 1
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    }
    
    if (gl) {
      assessment.webglSupported = true;
      
      // Get renderer info (only works if debugger extension is available)
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        assessment.rendererInfo = { vendor, renderer };
        
        // Make assessment based on renderer name
        if (renderer.includes('Apple') && (renderer.includes('M1') || renderer.includes('M2'))) {
          assessment.isLowEndDevice = false;
          assessment.riskOfContextLoss = 'low';
        } else if (renderer.includes('NVIDIA') || renderer.includes('RTX')) {
          assessment.isLowEndDevice = false;
          assessment.riskOfContextLoss = 'low';
        } else if (renderer.includes('Intel') && (
                   renderer.includes('Iris') || renderer.includes('HD') || renderer.includes('UHD'))) {
          assessment.isLowEndDevice = true;
          assessment.riskOfContextLoss = 'medium';
          assessment.recommendations.push('Reduce point cloud density to 500,000 points or less');
        } else if (renderer.includes('Intel')) {
          assessment.isLowEndDevice = true;
          assessment.riskOfContextLoss = 'high';
          assessment.recommendations.push('Reduce point cloud density to 250,000 points or less');
          assessment.recommendations.push('Disable post-processing effects');
        } else if (renderer.includes('Adreno') || renderer.includes('Mali') || renderer.includes('PowerVR')) {
          // Mobile GPUs
          assessment.isLowEndDevice = true;
          assessment.riskOfContextLoss = 'very high';
          assessment.recommendations.push('Reduce point cloud density to 100,000 points or less');
          assessment.recommendations.push('Disable all effects and use simple materials');
        }
      }
      
      // Get capability info
      assessment.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      assessment.maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      
      // Add recommendations based on capabilities
      if (assessment.maxTextureSize < 4096) {
        assessment.recommendations.push('Texture size is limited, use smaller textures');
      }
      
      if (!assessment.webgl2Supported) {
        assessment.recommendations.push('WebGL 2 not supported, some features may be unavailable');
      }
    } else {
      assessment.recommendations.push('WebGL not supported in this browser');
    }
  } catch (err) {
    console.error('Error assessing WebGL capabilities:', err);
    assessment.recommendations.push('Error detecting WebGL capabilities, assume limited support');
  }
  
  return assessment;
};

/**
 * Checks if a Potree point cloud is causing memory pressure
 * @returns {boolean} True if Potree is likely causing memory issues
 */
export const isPotreeCausingMemoryPressure = () => {
  // If Potree is not available, it can't be causing issues
  if (!window.Potree) return false;
  
  // Check if we have memory performance API
  if (!window.performance || !window.performance.memory) return false;
  
  const memory = window.performance.memory;
  const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  
  // If memory usage is high and Potree is loaded, it might be the cause
  return usageRatio > 0.7 && window.Potree !== undefined;
};

/**
 * Sets the WebGL context recovery handler for use throughout the application
 * @param {Function} recoveryHandler - The function to call when context recovery is needed
 * @returns {boolean} - Whether the handler was set successfully
 */
export const setupWebGLRecoveryHandler = (recoveryHandler) => {
  if (typeof recoveryHandler !== 'function') {
    console.warn('Invalid WebGL context recovery handler provided');
    return false;
  }
  
  try {
    // Store the recovery handler for global use
    window.__webglContextRecoveryHandler = recoveryHandler;
    console.log('WebGL context recovery handler registered');
    return true;
  } catch (error) {
    console.error('Failed to set WebGL context recovery handler:', error);
    return false;
  }
};

// For backward compatibility with existing imports
export const setWebGLContextRecovery = setupWebGLRecoveryHandler;

export default {
  setupContextLossHandling,
  useWebGLContextHandler,
  forceContextRecovery,
  assessDeviceWebGLCapability,
  registerPotreeDisposalHandler,
  clearPotreeResources,
  isPotreeCausingMemoryPressure,
  setupWebGLRecoveryHandler,
  setWebGLContextRecovery,
  initMemoryMonitoring
}; 