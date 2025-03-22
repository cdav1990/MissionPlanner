/**
 * WebGLContextManager.js
 * Provides centralized management of WebGL contexts for improved stability and recovery
 * Works across platforms including Mac M3 and Windows
 */

import { 
  isAppleSilicon, 
  isM3Mac, 
  isWindows, 
  getOptimalRenderSettings 
} from './PlatformDetection';

// Global state tracking
let contextLossCount = 0;
let recoveryCount = 0;
let contextLossTime = 0;
let memoryMonitoringInterval = null;
let registeredCanvases = new Map();
let globalRecoveryFlag = false;

// Safety check for window object (for SSR compatibility)
const isClient = typeof window !== 'undefined';

// Register global context loss tracking
if (isClient) {
  window.__webglContextIssues = window.__webglContextIssues || {
    lossCount: 0,
    recoveryCount: 0,
    lastLossTime: 0,
    hasUnrecoverableLoss: false
  };
}

/**
 * Register a canvas for monitoring and automatic recovery
 * @param {HTMLCanvasElement} canvas - The canvas to monitor
 * @param {Object} options - Configuration options
 * @returns {Function} - Function to unregister the canvas
 */
export const registerCanvas = (canvas, options = {}) => {
  if (!canvas) {
    console.warn('No canvas provided to registerCanvas');
    return () => {};
  }
  
  if (!isClient) {
    console.warn('WebGLContextManager not available on server');
    return () => {};
  }
  
  try {
    const id = canvas.id || `canvas-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Set ID if not already present
    if (!canvas.id) {
      canvas.id = id;
    }
    
    // Set default options
    const config = {
      onContextLost: () => {},
      onContextRestored: () => {},
      autoRecover: false,
      forceReload: true,
      ...options
    };
    
    // Register in our tracking map
    registeredCanvases.set(id, { canvas, config });
    
    // Set up event listeners
    const handleContextLost = (event) => {
      try {
        console.warn(`WebGL context lost on canvas ${id}`);
        event.preventDefault(); // Important to allow for recovery
        
        // Update global tracking
        contextLossCount++;
        contextLossTime = Date.now();
        if (window.__webglContextIssues) {
          window.__webglContextIssues.lossCount++;
          window.__webglContextIssues.lastLossTime = contextLossTime;
        }
        
        // Call the provided handler
        if (typeof config.onContextLost === 'function') {
          config.onContextLost(event);
        }
        
        // If forceReload is enabled, reload the page
        if (config.forceReload) {
          console.log('Forcing page reload due to WebGL context loss');
          setTimeout(() => {
            window.location.reload();
          }, 500);
          return;
        }
        
        // Auto-recover if enabled (otherwise just stay broken)
        if (config.autoRecover) {
          // Delay recovery attempt to allow for cleanup
          setTimeout(() => {
            if (registeredCanvases.has(id)) {
              attemptRecovery(id);
            }
          }, 1000);
        }
      } catch (e) {
        console.error('Error in context lost handler:', e);
        // Force reload on error
        window.location.reload();
      }
    };
    
    const handleContextRestored = (event) => {
      try {
        console.log(`WebGL context restored on canvas ${id}`);
        recoveryCount++;
        if (window.__webglContextIssues) {
          window.__webglContextIssues.recoveryCount++;
        }
        
        // Call the provided handler
        if (typeof config.onContextRestored === 'function') {
          config.onContextRestored(event);
        }
        
        // Dispatch global event
        try {
          const globalEvent = new CustomEvent('global-webgl-context-restored', { 
            detail: { canvasId: id, timestamp: Date.now() } 
          });
          window.dispatchEvent(globalEvent);
        } catch (e) {
          console.error('Error dispatching global restored event:', e);
        }
      } catch (e) {
        console.error('Error in context restored handler:', e);
      }
    };
    
    // Add event listeners
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    // Store the listeners for cleanup
    registeredCanvases.get(id).listeners = {
      lost: handleContextLost,
      restored: handleContextRestored
    };
    
    // Start memory monitoring if this is the first canvas
    if (registeredCanvases.size === 1) {
      startMemoryMonitoring();
    }
    
    // Apply platform-specific optimizations to the context
    applyPlatformOptimizations(canvas);
    
    console.log(`Canvas registered with WebGLContextManager: ${id}`);
    
    // Return unregister function
    return () => unregisterCanvas(id);
  } catch (e) {
    console.error('Error in registerCanvas:', e);
    return () => {};
  }
};

/**
 * Unregister a canvas from monitoring
 * @param {string} id - The canvas ID to unregister
 */
export const unregisterCanvas = (id) => {
  try {
    const registration = registeredCanvases.get(id);
    if (registration) {
      const { canvas, listeners } = registration;
      
      // Remove event listeners
      if (canvas && listeners) {
        try {
          canvas.removeEventListener('webglcontextlost', listeners.lost);
          canvas.removeEventListener('webglcontextrestored', listeners.restored);
        } catch (e) {
          console.warn('Error removing event listeners:', e);
        }
      }
      
      // Remove from tracking
      registeredCanvases.delete(id);
      
      // Stop memory monitoring if this was the last canvas
      if (registeredCanvases.size === 0) {
        stopMemoryMonitoring();
      }
      
      console.log(`Canvas unregistered from WebGLContextManager: ${id}`);
    }
  } catch (e) {
    console.error('Error in unregisterCanvas:', e);
  }
};

/**
 * Apply platform-specific optimizations to a WebGL context
 * @param {HTMLCanvasElement} canvas - Canvas element to optimize
 */
export const applyPlatformOptimizations = (canvas) => {
  if (!canvas || !canvas.getContext) {
    console.warn('Invalid canvas provided to applyPlatformOptimizations');
    return;
  }
  
  try {
    // Get optimal settings for the platform
    const settings = getOptimalRenderSettings();
    
    // Configure context attributes based on platform
    const contextOptions = {
      powerPreference: settings.powerPreference,
      antialias: settings.antialias,
      alpha: false, // Disable alpha for better performance
      depth: true,
      stencil: false,
      failIfMajorPerformanceCaveat: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      desynchronized: isAppleSilicon() // Use desynchronized mode on Apple Silicon
    };
    
    // Apply optimized context
    const gl = canvas.getContext('webgl2', contextOptions) || 
              canvas.getContext('webgl', contextOptions);
    
    if (gl) {
      console.log('Applied WebGL optimizations with settings:', contextOptions);
    } else {
      console.warn('Failed to get WebGL context for optimization');
    }
    
    // Apply platform-specific canvas settings
    if (isAppleSilicon() || isM3Mac()) {
      // On Apple Silicon, reduce canvas resolution slightly if high DPI
      if (window.devicePixelRatio > 1) {
        const scaleFactor = isM3Mac() ? 0.85 : 0.75; // M3 can handle slightly higher resolution
        canvas.style.width = `${canvas.offsetWidth}px`;
        canvas.style.height = `${canvas.offsetHeight}px`;
        canvas.width = Math.floor(canvas.offsetWidth * scaleFactor);
        canvas.height = Math.floor(canvas.offsetHeight * scaleFactor);
        console.log(`Applied Apple Silicon resolution scaling: ${scaleFactor}`);
      }
    }
  } catch (e) {
    console.warn('Error applying WebGL optimizations:', e);
  }
};

/**
 * Attempt to recover a lost WebGL context
 * @param {string} canvasId - ID of the canvas to recover
 * @returns {boolean} - Whether recovery was successful
 */
export const attemptRecovery = (canvasId) => {
  try {
    // Find registration by ID
    const registration = registeredCanvases.get(canvasId);
    if (!registration) {
      console.warn(`No canvas found with ID: ${canvasId}`);
      
      // Fallback: try to find by DOM ID if direct map lookup failed
      if (isClient && document) {
        const canvasByDomId = document.getElementById(canvasId);
        if (canvasByDomId) {
          console.log(`Found canvas by DOM ID: ${canvasId}`);
          return attemptRecoveryForCanvas(canvasByDomId);
        }
      }
      
      return false;
    }
    
    // Otherwise use registered canvas
    const { canvas } = registration;
    return attemptRecoveryForCanvas(canvas);
  } catch (e) {
    console.error('Error in attemptRecovery:', e);
    return false;
  }
};

/**
 * Attempt recovery on a specific canvas
 * @param {HTMLCanvasElement} canvas - Canvas to recover
 * @returns {boolean} - Whether recovery was successful
 */
function attemptRecoveryForCanvas(canvas) {
  if (!canvas) {
    console.warn('No canvas provided for recovery');
    return false;
  }
  
  try {
    console.log(`Attempting WebGL context recovery for canvas ${canvas.id}`);
    
    // Set recovery flag
    globalRecoveryFlag = true;
    
    // If we've had multiple context losses in a short time, 
    // take more aggressive measures
    const aggressive = contextLossCount > 2 && 
                      (Date.now() - contextLossTime < 60000);
    
    // Store original dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Reset canvas dimensions to force a new context
    canvas.width = 1;
    canvas.height = 1;
    
    // Force garbage collection if available
    if (window.gc) window.gc();
    
    // Clear THREE.js cache if available
    if (window.THREE && window.THREE.Cache) {
      window.THREE.Cache.clear();
    }
    
    // Reset to original dimensions
    canvas.width = width;
    canvas.height = height;
    
    // If aggressive recovery is needed, reduce dimensions
    if (aggressive) {
      console.log('Using aggressive recovery with reduced dimensions');
      canvas.width = Math.floor(width * 0.75);
      canvas.height = Math.floor(height * 0.75);
    }
    
    // Apply platform-specific optimizations with more conservative settings
    const contextOptions = {
      powerPreference: isAppleSilicon() ? 'low-power' : 'default',
      antialias: false,
      alpha: false,
      depth: true,
      stencil: false,
      failIfMajorPerformanceCaveat: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false
    };
    
    // Try to create a new context
    const gl = canvas.getContext('webgl2', contextOptions) || 
               canvas.getContext('webgl', contextOptions);
    
    // Clear recovery flag regardless of outcome
    globalRecoveryFlag = false;
    
    if (gl) {
      console.log(`Successfully recovered WebGL context for canvas ${canvas.id}`);
      
      // Trigger the webglcontextrestored event
      try {
        const event = new Event('webglcontextrestored');
        canvas.dispatchEvent(event);
      } catch (e) {
        console.error('Error dispatching restored event:', e);
      }
      
      return true;
    } else {
      console.error('Failed to create new WebGL context');
      return false;
    }
  } catch (e) {
    console.error('Error during WebGL context recovery:', e);
    globalRecoveryFlag = false;
    return false;
  }
}

/**
 * Start memory monitoring to prevent context loss
 */
export const startMemoryMonitoring = () => {
  // Only run on client
  if (!isClient) return;
  
  // Clear any existing interval
  stopMemoryMonitoring();
  
  // Determine check interval based on platform
  const checkInterval = isAppleSilicon() ? 15000 : 30000;
  
  console.log(`Starting memory monitoring with interval: ${checkInterval}ms`);
  
  memoryMonitoringInterval = setInterval(() => {
    try {
      // Skip if recovery is in progress
      if (globalRecoveryFlag) return;
      
      // Check for memory pressure
      if (typeof navigator.deviceMemory !== 'undefined') {
        // If device has low memory, take preventive action
        if (navigator.deviceMemory < 4) {
          console.log('Low memory device detected, performing preventive cleanup');
          preventiveCleanup();
        }
      }
      
      // Clear THREE.js cache periodically
      if (window.THREE && window.THREE.Cache) {
        window.THREE.Cache.clear();
      }
      
      // If we've had context losses, reduce all canvas resolutions
      if (contextLossCount > 0) {
        registeredCanvases.forEach((registration, id) => {
          const { canvas } = registration;
          if (canvas && canvas.width > 512) {
            // Reduce canvas size by 10%
            canvas.width = Math.floor(canvas.width * 0.9);
            canvas.height = Math.floor(canvas.height * 0.9);
          }
        });
      }
    } catch (e) {
      console.error('Error in memory monitoring:', e);
    }
  }, checkInterval);
};

/**
 * Stop memory monitoring
 */
export const stopMemoryMonitoring = () => {
  if (memoryMonitoringInterval) {
    clearInterval(memoryMonitoringInterval);
    memoryMonitoringInterval = null;
    console.log('Stopped memory monitoring');
  }
};

/**
 * Perform preventive cleanup to avoid context loss
 */
export const preventiveCleanup = () => {
  if (!isClient) return;
  
  try {
    // Clear THREE.js cache
    if (window.THREE && window.THREE.Cache) {
      window.THREE.Cache.clear();
    }
    
    // Release any textures or unnecessary resources
    if (window.CLEANUP_HANDLERS && Array.isArray(window.CLEANUP_HANDLERS)) {
      window.CLEANUP_HANDLERS.forEach(handler => {
        if (typeof handler === 'function') {
          try {
            handler();
          } catch (e) {
            console.warn('Error in cleanup handler:', e);
          }
        }
      });
    }
    
    // Force garbage collection if available
    if (window.gc) window.gc();
  } catch (e) {
    console.error('Error in preventiveCleanup:', e);
  }
};

/**
 * React hook to handle WebGL context for a canvas element
 * @param {Object} options - Configuration options
 * @returns {Object} - Canvas ref and status
 */
export const useWebGLContext = (options = {}) => {
  if (!isClient || typeof React === 'undefined' || 
      !React.useRef || !React.useEffect || !React.useState) {
    console.warn('React not available, useWebGLContext hook cannot be used');
    return { canvasRef: { current: null }, contextLost: false };
  }
  
  const canvasRef = React.useRef(null);
  const [contextLost, setContextLost] = React.useState(false);
  
  React.useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    // Create our handlers
    const onContextLost = () => {
      setContextLost(true);
      if (options.onContextLost) options.onContextLost();
    };
    
    const onContextRestored = () => {
      setContextLost(false);
      if (options.onContextRestored) options.onContextRestored();
    };
    
    // Register with our manager
    const unregister = registerCanvas(canvas, {
      ...options,
      onContextLost,
      onContextRestored
    });
    
    // Cleanup function
    return unregister;
  }, []); // Intentionally empty deps to avoid re-registering
  
  return { canvasRef, contextLost };
};

// Get all canvas IDs for debugging
export const getRegisteredCanvasIds = () => {
  return Array.from(registeredCanvases.keys());
};

// Emergency recovery for all canvases
export const emergencyRecoveryAll = () => {
  let successCount = 0;
  
  registeredCanvases.forEach((registration, id) => {
    if (attemptRecovery(id)) {
      successCount++;
    }
  });
  
  return successCount;
};

// Export a single, easily importable object
export const WebGLContextManager = {
  registerCanvas,
  unregisterCanvas,
  applyPlatformOptimizations,
  attemptRecovery,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  preventiveCleanup,
  useWebGLContext,
  getRegisteredCanvasIds,
  emergencyRecoveryAll
};

export default WebGLContextManager; 