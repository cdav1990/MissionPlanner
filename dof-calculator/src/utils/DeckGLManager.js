/**
 * DeckGLManager.js
 * Utility to manage deck.gl instances and provide optimized settings
 * for different platforms including M3 MacBooks
 */

import { isAppleSilicon, isM3Mac, isWindows } from './PlatformDetection';

// Global settings and state
let initialized = false;
let deckInstances = new Map();
let lastDevicePixelRatio = window.devicePixelRatio || 1;

/**
 * Get optimized deck.gl settings based on the platform
 * @returns {Object} Optimized settings for the current platform
 */
export function getOptimizedDeckSettings() {
  const isM3MacDevice = isM3Mac();
  const isAppleSiliconDevice = isAppleSilicon();
  const isWindowsDevice = isWindows();
  
  // Base settings for all platforms
  const baseSettings = {
    pickingRadius: 5,
    useDevicePixels: true,
    parameters: {
      depthTest: true,
      blend: true,
      blendFunc: [
        WebGLRenderingContext.SRC_ALPHA,
        WebGLRenderingContext.ONE_MINUS_SRC_ALPHA,
        WebGLRenderingContext.ONE,
        WebGLRenderingContext.ONE_MINUS_SRC_ALPHA
      ]
    }
  };
  
  // M3 Mac specific settings
  if (isM3MacDevice) {
    return {
      ...baseSettings,
      glOptions: {
        // For M3 Macs, these settings generally work well
        failIfMajorPerformanceCaveat: false,
        antialias: true,
        stencil: false,
        depth: true,
        powerPreference: 'high-performance',
        alpha: false
      },
      useDevicePixels: Math.min(window.devicePixelRatio, 1.5), // Cap pixel ratio for Retina displays
      parameters: {
        ...baseSettings.parameters,
        // Enable mesh optimization
        [WebGLRenderingContext.UNPACK_FLIP_Y_WEBGL]: false
      }
    };
  }
  
  // Other Apple Silicon (non-M3) settings
  if (isAppleSiliconDevice) {
    return {
      ...baseSettings,
      glOptions: {
        failIfMajorPerformanceCaveat: false,
        antialias: false, // Disable antialiasing for better performance
        stencil: false,
        depth: true,
        powerPreference: 'low-power', // Power saving is prioritized
        alpha: false
      },
      useDevicePixels: Math.min(window.devicePixelRatio, 1.0), // Limit to standard resolution
      parameters: {
        ...baseSettings.parameters
      }
    };
  }
  
  // Windows specific settings
  if (isWindowsDevice) {
    return {
      ...baseSettings,
      glOptions: {
        failIfMajorPerformanceCaveat: false,
        antialias: true,
        stencil: false,
        depth: true,
        powerPreference: 'high-performance',
        alpha: false
      },
      useDevicePixels: true,
      parameters: {
        ...baseSettings.parameters
      }
    };
  }
  
  // Default settings for other platforms
  return baseSettings;
}

/**
 * Get optimized layer settings for point clouds
 * @returns {Object} Optimized layer settings for point clouds
 */
export function getPointCloudLayerSettings() {
  const isM3MacDevice = isM3Mac();
  const isAppleSiliconDevice = isAppleSilicon();
  
  // Base settings
  const baseSettings = {
    pointSize: 1.5,
    material: true,
    sizeUnits: 'pixels',
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 0, 150]
  };
  
  if (isM3MacDevice) {
    return {
      ...baseSettings,
      pointSize: 1.5,
      // M3 can handle a bit more points
      maxPoints: 3000000
    };
  }
  
  if (isAppleSiliconDevice) {
    return {
      ...baseSettings,
      pointSize: 1.2,
      // More conservative for other Apple Silicon
      maxPoints: 1500000
    };
  }
  
  // Default/Windows settings
  return {
    ...baseSettings,
    pointSize: 2.0,
    maxPoints: 5000000
  };
}

/**
 * Register a deck.gl instance for centralized management
 * @param {string} id - Unique identifier for the deck instance
 * @param {Object} deckInstance - The deck.gl instance to register
 */
export function registerDeckInstance(id, deckInstance) {
  deckInstances.set(id, deckInstance);
  
  if (!initialized) {
    // Set up global listeners for device pixel ratio changes
    // This helps adapt to external display connections/disconnections
    window.matchMedia('screen and (min-resolution: 2dppx)').addListener(() => {
      handleDevicePixelRatioChange();
    });
    
    initialized = true;
  }
}

/**
 * Unregister a deck.gl instance
 * @param {string} id - Unique identifier for the deck instance
 */
export function unregisterDeckInstance(id) {
  deckInstances.delete(id);
}

/**
 * Handle device pixel ratio changes (like connecting to external monitors)
 */
function handleDevicePixelRatioChange() {
  const newDpr = window.devicePixelRatio || 1;
  
  if (Math.abs(newDpr - lastDevicePixelRatio) > 0.1) {
    lastDevicePixelRatio = newDpr;
    
    // Update all registered deck instances
    deckInstances.forEach((instance) => {
      if (instance && instance.setProps) {
        // Calculate appropriate DPR based on platform
        let adjustedDpr = newDpr;
        
        if (isAppleSilicon()) {
          adjustedDpr = Math.min(newDpr, isM3Mac() ? 1.5 : 1.0);
        }
        
        instance.setProps({
          useDevicePixels: adjustedDpr
        });
      }
    });
  }
}

/**
 * Clean up any resources
 */
export function cleanup() {
  deckInstances.clear();
  initialized = false;
}

export default {
  getOptimizedDeckSettings,
  getPointCloudLayerSettings,
  registerDeckInstance,
  unregisterDeckInstance,
  cleanup
}; 