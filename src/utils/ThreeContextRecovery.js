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
        desynchronized: isAppleSilicon(), // Use desynchronized for better performance on Apple Silicon
        // Add alpha:false to improve performance slightly
        alpha: false,
        // Add depth:true to ensure proper depth testing
        depth: true,
        // Add stencil:false unless needed to save memory
        stencil: false,
        // Add premultipliedAlpha:false for better color handling
        premultipliedAlpha: false
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
 * Check if a canvas already has a WebGL context
 * @param {HTMLCanvasElement} canvas - The canvas element to check
 * @returns {boolean} - Whether the canvas has an active context
 */
const hasExistingContext = (canvas) => {
  if (!canvas) return false;
  
  try {
    // Try to get the existing context
    const gl = canvas.getContext('webgl2') || 
               canvas.getContext('webgl') || 
               canvas.getContext('experimental-webgl');
    
    // Check if we got a valid context and it's not lost
    return gl !== null && gl !== undefined && !gl.isContextLost();
  } catch (e) {
    console.warn('Error checking for existing WebGL context:', e);
    return false;
  }
};

/**
 * Attempt to clean an existing WebGL context
 * @param {HTMLCanvasElement} canvas - The canvas element to clean
 * @returns {boolean} - Whether the cleaning was successful
 */
const cleanExistingContext = (canvas) => {
  if (!canvas) return false;
  
  try {
    const gl = canvas.getContext('webgl2') || 
               canvas.getContext('webgl') || 
               canvas.getContext('experimental-webgl');
    
    if (!gl) return false;
    
    // Clean up all resources
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) {
      // Force context loss to clear memory and resources
      loseContext.loseContext();
      
      // Set a timeout to restore after a brief delay
      setTimeout(() => {
        if (loseContext) {
          try {
            loseContext.restoreContext();
            console.log('WebGL context manually restored');
          } catch (e) {
            console.warn('Error restoring WebGL context:', e);
          }
        }
      }, 500);
      
      return true;
    }
    
    return false;
  } catch (e) {
    console.warn('Error cleaning WebGL context:', e);
    return false;
  }
};

/**
 * Attempt to recover from WebGL context loss
 * @param {HTMLCanvasElement} canvas - The canvas element to recover
 * @returns {boolean} - Whether recovery was initiated
 */
const attemptContextRecovery = (canvas) => {
  if (!canvas) return false;

  console.log('Attempting to manually restore WebGL context...');
  
  try {
    // Force canvas reset
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear any existing context
    cleanExistingContext(canvas);
    
    // Reset canvas dimensions to force a context refresh
    canvas.width = 1;
    canvas.height = 1;
    canvas.width = width;
    canvas.height = height;
    
    // Clear any listeners that might be causing issues
    const newCanvas = canvas.cloneNode(true);
    if (canvas.parentNode) {
      canvas.parentNode.replaceChild(newCanvas, canvas);
    }
    
    // Apply WebGL2 context with memory-optimized settings
    const settings = getOptimalRenderSettings();
    const contextOptions = {
      powerPreference: isAppleSilicon() ? 'low-power' : settings.powerPreference,
      antialias: false, // Disable for recovery to save memory
      alpha: false,     // Disable alpha for recovery
      depth: true,      // Keep depth testing
      stencil: false,   // Disable stencil for recovery
      failIfMajorPerformanceCaveat: false,
      premultipliedAlpha: false
    };
    
    // Try WebGL2 first, fall back to WebGL
    const gl = newCanvas.getContext('webgl2', contextOptions) || 
               newCanvas.getContext('webgl', contextOptions) || 
               newCanvas.getContext('experimental-webgl', contextOptions);
    
    if (gl) {
      console.log('Successfully created new WebGL context');
      
      // Dispatch a fake contextrestored event
      const event = new Event('webglcontextrestored');
      newCanvas.dispatchEvent(event);
      
      return true;
    } else {
      console.error('Failed to create new WebGL context');
      return false;
    }
  } catch (e) {
    console.error('Error during manual context recovery:', e);
    return false;
  }
};

/**
 * React hook for handling WebGL context loss and restoration
 * @param {Function} onLost - Callback when context is lost
 * @param {Function} onRestored - Callback when context is restored
 * @returns {Object} - Reference object to attach to canvas
 */
export const useWebGLContextHandler = (onLost, onRestored) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleContextLost = (event) => {
      console.warn('WebGL context lost detected in hook');
      if (typeof onLost === 'function') onLost(event);
    };
    
    const handleContextRestored = (event) => {
      console.log('WebGL context restored detected in hook');
      if (typeof onRestored === 'function') onRestored(event);
    };
    
    // Set up event listeners
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
    
    // Add global event listeners for app-wide response
    window.addEventListener('webglcontextlost', handleContextLost, false);
    window.addEventListener('webglcontextrestored', handleContextRestored, false);
    
    // Clean up function
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      window.removeEventListener('webglcontextlost', handleContextLost);
      window.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [onLost, onRestored]);
  
  return canvasRef;
};

/**
 * Force context recovery on a specific canvas element
 * @param {HTMLCanvasElement} canvas - The canvas element to recover
 * @returns {boolean} - Whether recovery was successful
 */
export const forceContextRecovery = (canvas) => {
  if (!canvas) {
    console.warn('No canvas provided for context recovery');
    return false;
  }
  
  // Update recovery attempts
  recoveryAttempts++;
  console.log(`Forcing context recovery (attempt ${recoveryAttempts})`);
  
  // Apply different strategies based on platform and recovery attempts
  if (isAppleSilicon()) {
    // Apple Silicon - more aggressive approach
    console.log('Using Apple Silicon specific recovery approach');
    
    // Clean up THREE.js cache first
    if (window.THREE && window.THREE.Cache) {
      window.THREE.Cache.clear();
    }
    
    // Clear Potree resources
    clearPotreeResources();
    
    // Force garbage collection if available
    if (window.gc) {
      try {
        window.gc();
      } catch (e) {
        console.warn('Failed to force garbage collection:', e);
      }
    }
    
    // Attempt context recovery with reduced settings
    if (recoveryAttempts > 1) {
      // On second+ attempt, simplify the canvas significantly
      const width = canvas.width;
      const height = canvas.height;
      
      // Temporarily reduce canvas size to reduce memory pressure
      canvas.width = Math.floor(width * 0.5);
      canvas.height = Math.floor(height * 0.5);
      
      // Attempt recovery
      const result = attemptContextRecovery(canvas);
      
      // After a delay, restore original size
      setTimeout(() => {
        canvas.width = width;
        canvas.height = height;
      }, 1000);
      
      return result;
    }
  }
  
  // General approach for all platforms
  return attemptContextRecovery(canvas);
};

/**
 * Assess device WebGL capability and recommend settings
 * @returns {Object} - Assessment results with recommended settings
 */
export const assessDeviceWebGLCapability = () => {
  const result = {
    isWebGLAvailable: false,
    isWebGL2Available: false,
    maxTextureSize: 0,
    maxPointSize: 0,
    maxViewportDims: [0, 0],
    recommendedPointBudget: 0,
    recommendedQuality: 'low',
    gpuInfo: 'Unknown',
    isAppleSilicon: isAppleSilicon(),
    isHighEndSystem: isHighEndSystem(),
    detectedIssues: []
  };
  
  try {
    // Create temporary canvas
    const canvas = document.createElement('canvas');
    
    // Try WebGL2 first
    let gl = canvas.getContext('webgl2');
    if (gl) {
      result.isWebGLAvailable = true;
      result.isWebGL2Available = true;
    } else {
      // Fall back to WebGL
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        result.isWebGLAvailable = true;
      }
    }
    
    if (gl) {
      // Get capabilities
      result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      result.maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      
      // Try to get GPU info
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        result.gpuInfo = `${vendor} - ${renderer}`;
        
        // Check for known problematic GPUs or drivers
        const lowerGPUInfo = result.gpuInfo.toLowerCase();
        
        if (lowerGPUInfo.includes('intel')) {
          result.detectedIssues.push('Intel integrated graphics may have performance limitations with large point clouds');
          
          // Integrated graphics generally need lower point budgets
          result.recommendedPointBudget = 500000;
          result.recommendedQuality = 'low';
        } else if (lowerGPUInfo.includes('nvidia')) {
          result.recommendedPointBudget = 2000000;
          result.recommendedQuality = 'high';
        } else if (lowerGPUInfo.includes('amd') || lowerGPUInfo.includes('radeon')) {
          result.recommendedPointBudget = 1500000;
          result.recommendedQuality = 'medium';
        } else if (lowerGPUInfo.includes('apple')) {
          // Apple GPU - could be M1/M2/etc
          result.recommendedPointBudget = 1000000;
          result.recommendedQuality = 'medium';
          
          if (lowerGPUInfo.includes('m1')) {
            result.detectedIssues.push('Apple M1 GPUs may experience WebGL context issues with large point clouds');
          }
        }
      }
      
      // Try to get point size range
      try {
        result.maxPointSize = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
      } catch (e) {
        console.warn('Could not determine max point size:', e);
        result.maxPointSize = 64; // Fallback default
      }
      
      // Default recommended settings if not set based on GPU
      if (result.recommendedPointBudget === 0) {
        result.recommendedPointBudget = 1000000;
        result.recommendedQuality = 'medium';
      }
      
      // Adjust based on detected system specs
      if (result.isHighEndSystem) {
        result.recommendedPointBudget = Math.min(3000000, result.recommendedPointBudget * 1.5);
        if (result.recommendedQuality === 'low') {
          result.recommendedQuality = 'medium';
        }
      } else if (result.isAppleSilicon) {
        // Cautious defaults for Apple Silicon
        result.recommendedPointBudget = Math.min(result.recommendedPointBudget, 1000000);
        result.detectedIssues.push('Apple Silicon support is experimental - reduced point budget recommended');
      }
    }
  } catch (e) {
    console.warn('Error assessing WebGL capabilities:', e);
    result.detectedIssues.push('Error during WebGL capability assessment: ' + e.message);
  }
  
  return result;
};

/**
 * Check if Potree is using excessive memory
 * @returns {boolean} - Whether Potree is causing memory pressure
 */
export const isPotreeCausingMemoryPressure = () => {
  // Check for global Potree memory stats
  if (window.Potree && window.Potree.memoryStats) {
    const memoryStats = window.Potree.memoryStats;
    
    // If we're using more than 1.5GB for point cloud data, consider it pressure
    if (memoryStats.pointCloudData > 1500 * 1024 * 1024) {
      return true;
    }
    
    // If we have more than 100 nodes loaded, consider it pressure
    if (memoryStats.nodesLoaded > 100) {
      return true;
    }
  }
  
  // Default to platform-based memory pressure detection
  return detectMemoryPressure();
};

/**
 * Register a WebGL context recovery handler function
 * @param {Function} recoveryHandler - Function to handle recovery
 */
export const setWebGLContextRecovery = (recoveryHandler) => {
  if (typeof window !== 'undefined' && typeof recoveryHandler === 'function') {
    // Create the global recovery handler object if it doesn't exist
    if (!window.__webglContextRecovery) {
      window.__webglContextRecovery = {
        handlers: [],
        attemptRecovery: (canvas) => {
          // Default implementation uses our forceContextRecovery function
          return forceContextRecovery(canvas);
        }
      };
    }
    
    // Register the custom handler
    window.__webglContextRecovery.handlers.push(recoveryHandler);
    
    // Return unregister function
    return () => {
      if (window.__webglContextRecovery && window.__webglContextRecovery.handlers) {
        window.__webglContextRecovery.handlers = 
          window.__webglContextRecovery.handlers.filter(h => h !== recoveryHandler);
      }
    };
  }
  
  // Return empty function if registration failed
  return () => {};
};

/**
 * Emergency context recovery - a last resort function to try to recover when other methods fail
 * This is more aggressive and will completely rebuild the canvas
 */
export const emergencyContextRecovery = (canvas) => {
  if (!canvas) return false;
  
  console.log('Attempting emergency WebGL context recovery');
  
  try {
    // Force clear everything
    if (window.THREE) {
      if (window.THREE.Cache) {
        window.THREE.Cache.clear();
        console.log('Cleared THREE.Cache');
      }
      
      if (window.THREE.WebGLRenderer && window.THREE.WebGLRenderer.pool) {
        console.log('Disposing WebGLRenderer pool');
        window.THREE.WebGLRenderer.pool.dispose();
      }
    }
    
    // Clean any global Potree resources
    if (window.Potree) {
      console.log('Cleaning Potree global resources');
      try {
        if (window.Potree.lru && typeof window.Potree.lru.clear === 'function') {
          window.Potree.lru.clear();
        }
        
        if (Array.isArray(window.Potree.loadedPointclouds)) {
          window.Potree.loadedPointclouds = [];
        }
      } catch (e) {
        console.warn('Error cleaning Potree resources:', e);
      }
    }
    
    // Force garbage collection if available
    if (window.gc) {
      console.log('Forcing garbage collection');
      window.gc();
    }
    
    // Try to clone and replace the canvas as a last resort
    const parent = canvas.parentNode;
    if (parent) {
      console.log('Replacing canvas element');
      
      // Store original properties
      const width = canvas.width;
      const height = canvas.height;
      const style = canvas.style.cssText;
      const id = canvas.id;
      const className = canvas.className;
      
      // Create a new canvas with the same properties
      const newCanvas = document.createElement('canvas');
      newCanvas.width = width;
      newCanvas.height = height;
      newCanvas.style.cssText = style;
      newCanvas.id = id;
      newCanvas.className = className;
      
      // Replace the old canvas
      parent.replaceChild(newCanvas, canvas);
      
      // Dispatch a fake webglcontextrestored event
      setTimeout(() => {
        try {
          const event = new Event('webglcontextrestored');
          newCanvas.dispatchEvent(event);
          console.log('Dispatched restored event on new canvas');
        } catch (e) {
          console.error('Error dispatching event:', e);
        }
      }, 100);
      
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Emergency context recovery failed:', e);
    return false;
  }
};

// Export the getImWebGLContextRecovery function (used in the error message)
export const getImWebGLContextRecovery = () => {
  return {
    setupContextLossHandling,
    useWebGLContextHandler,
    forceContextRecovery,
    assessDeviceWebGLCapability,
    initMemoryMonitoring
  };
};

// Setup WebGL context recovery helpers
export const setupWebGLContextRecovery = (canvas) => {
  return setupContextLossHandling(canvas);
}; 