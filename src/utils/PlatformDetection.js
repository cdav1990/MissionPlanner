/**
 * Platform Detection Utility
 * Detects hardware capabilities and optimizes settings based on the platform
 */

// Detect if running on Apple Silicon
export function isAppleSilicon() {
  return /Mac/.test(navigator.platform) && 
         navigator.userAgent.includes('AppleWebKit') &&
         !navigator.userAgent.includes('Intel');
}

// Detect if running on a high-end system
export function isHighEndSystem() {
  // Check for high core count
  const highCoreCount = navigator.hardwareConcurrency >= 8;
  
  // Check for high memory (rough estimation)
  const highMemory = window.performance && 
                    window.performance.memory && 
                    window.performance.memory.jsHeapSizeLimit > 2000000000;
  
  // Use canvas performance test to estimate GPU power
  const gpuPowerScore = measureGPUPerformance();
  
  return (highCoreCount && gpuPowerScore > 0.7) || 
         (highMemory && gpuPowerScore > 0.5);
}

// Improved device detection for M3 Macs
export function isM3Mac() {
  // Check if it's a Mac
  if (!/Mac/.test(navigator.platform)) return false;
  
  // Check for Apple Silicon
  if (!isAppleSilicon()) return false;
  
  // Attempt to detect M3 specifically via WebGL renderer string
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return false;
    
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    
    // M3 Macs typically include "Apple M3" in the renderer string
    return /Apple M3/i.test(renderer);
  } catch (e) {
    return false; 
  }
}

// Detect Windows machine
export function isWindows() {
  return /Win/.test(navigator.platform);
}

// Measure GPU performance using a canvas benchmark
function measureGPUPerformance() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || 
               canvas.getContext('webgl') || 
               canvas.getContext('experimental-webgl');
    
    if (!gl) return 0.3; // Low score if WebGL not available
    
    // Check for WebGL2 support (better performance)
    const isWebGL2 = !!canvas.getContext('webgl2');
    
    // Check for key extensions
    const hasAnisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
    const hasFloatTextures = gl.getExtension('OES_texture_float');
    const hasInstancing = gl.getExtension('ANGLE_instanced_arrays') || isWebGL2;
    
    // Check for max texture size (higher is better)
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const textureSizeScore = Math.min(maxTextureSize / 16384, 1.0);
    
    // Check for max render buffer size
    const maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    const renderBufferScore = Math.min(maxRenderBufferSize / 16384, 1.0);
    
    // Compute overall score
    let score = 0.2; // Base score
    if (isWebGL2) score += 0.3;
    if (hasAnisotropic) score += 0.1;
    if (hasFloatTextures) score += 0.1;
    if (hasInstancing) score += 0.1;
    score += textureSizeScore * 0.1;
    score += renderBufferScore * 0.1;
    
    // Log the detected performance
    console.log(`GPU Performance Score: ${score.toFixed(2)}`);
    
    return Math.min(score, 1.0);
  } catch (e) {
    console.error('Error measuring GPU performance:', e);
    return 0.3; // Default to low score on error
  }
}

// Get optimal render settings based on platform
export function getOptimalRenderSettings() {
  // Default settings for medium spec systems
  const defaultSettings = {
    powerPreference: 'default',
    maxPointsPerNode: 1000000,
    pointBudget: 2000000,
    antialias: true,
    pixelRatio: window.devicePixelRatio > 1 ? 1 : window.devicePixelRatio,
    useShadows: true,
    usePostProcessing: true,
    maxTextureSize: 2048,
    useInstancing: true,
    useCompression: true,
    useEffects: true,
    useAdaptiveDpr: true,
    useHighPrecision: true
  };
  
  // M3 Mac settings (conservative but optimized for M3)
  if (isM3Mac()) {
    return {
      ...defaultSettings,
      powerPreference: 'high-performance', // M3 has good GPU performance while staying power-efficient
      maxPointsPerNode: 750000,            // Slightly higher than base Apple Silicon
      pointBudget: 1500000,                // Higher but still conservative
      antialias: true,                     // M3 can handle antialiasing
      pixelRatio: Math.min(window.devicePixelRatio, 1.25), // Higher than 1.0 but capped
      useShadows: false,                   // Still avoid shadows
      usePostProcessing: true,             // M3 can handle basic post-processing
      maxTextureSize: 2048,                // M3 can handle larger textures
      useEffects: true,                    // Enable basic effects
      useAdaptiveDpr: true,                // Keep adaptive DPR
      useHighPrecision: false,             // Still avoid high precision calculations
      // Specific optimizations for Apple GPUs
      useAppleOptimizations: true
    };
  }
  // Other Apple Silicon settings (more conservative)
  else if (isAppleSilicon()) {
    return {
      ...defaultSettings,
      powerPreference: 'low-power',
      maxPointsPerNode: 500000,
      pointBudget: 1000000,
      antialias: false,
      pixelRatio: Math.min(window.devicePixelRatio, 1.0),
      useShadows: false,
      usePostProcessing: false,
      maxTextureSize: 1024,
      useEffects: false,
      useAdaptiveDpr: true,
      useHighPrecision: false,
      // Specific optimizations for Apple GPUs
      useAppleOptimizations: true
    };
  }
  // Windows-specific optimizations
  else if (isWindows()) {
    const isHighEnd = isHighEndSystem();
    return {
      ...defaultSettings,
      powerPreference: isHighEnd ? 'high-performance' : 'default',
      maxPointsPerNode: isHighEnd ? 2000000 : 1000000,
      pointBudget: isHighEnd ? 5000000 : 2000000,
      antialias: isHighEnd,
      pixelRatio: isHighEnd ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 1.0),
      useShadows: isHighEnd,
      usePostProcessing: isHighEnd,
      maxTextureSize: isHighEnd ? 4096 : 2048,
      // Windows-specific optimizations
      useWGLExtensions: true
    };
  }
  // High-end system settings (more aggressive)
  else if (isHighEndSystem()) {
    return {
      ...defaultSettings,
      powerPreference: 'high-performance',
      maxPointsPerNode: 3000000,
      pointBudget: 8000000, 
      antialias: true,
      pixelRatio: window.devicePixelRatio,
      useShadows: true,
      usePostProcessing: true,
      maxTextureSize: 4096,
      useEffects: true,
      useAdaptiveDpr: false,
      useHighPrecision: true
    };
  }
  
  return defaultSettings;
}

// Get CPU thread settings
export function getThreadSettings() {
  const cpuCores = navigator.hardwareConcurrency || 4;
  
  // M3 Macs can handle more threads
  if (isM3Mac()) {
    return {
      useThreadPool: true,
      poolSize: Math.min(Math.max(2, cpuCores - 1), 8),
      prioritizeMainThread: true
    };
  }
  
  return {
    useThreadPool: cpuCores > 4,
    poolSize: Math.min(Math.max(1, cpuCores - 2), 16),
    prioritizeMainThread: isAppleSilicon() // Prioritize main thread on Apple Silicon
  };
}

// Detect if device has memory pressure issues
export function detectMemoryPressure() {
  // Check if we've had WebGL context losses
  const hasContextIssues = window.__webglContextIssues && 
                          window.__webglContextIssues.lossCount > 0;
  
  // For Chrome, try to get memory info
  const highJSHeapUsage = window.performance && 
                         window.performance.memory && 
                         (window.performance.memory.usedJSHeapSize / 
                          window.performance.memory.jsHeapSizeLimit) > 0.7;

  // Add more aggressive detection on M3 Macs
  const isM3WithRecentPressure = isM3Mac() && window.__lastMemoryPressureTime && 
                                (Date.now() - window.__lastMemoryPressureTime < 120000);
  
  return hasContextIssues || highJSHeapUsage || isM3WithRecentPressure;
}

// Initialize platform detection
export function initializePlatformDetection() {
  // Log platform detection info
  console.log('Platform Detection:');
  console.log(`- Apple Silicon: ${isAppleSilicon()}`);
  console.log(`- M3 Mac: ${isM3Mac()}`);
  console.log(`- Windows: ${isWindows()}`);
  console.log(`- High-end System: ${isHighEndSystem()}`);
  console.log(`- Hardware Concurrency: ${navigator.hardwareConcurrency || 'unknown'}`);
  
  // Log the settings we'll use
  const settings = getOptimalRenderSettings();
  console.log('Using render settings:', settings);
  
  // Store settings globally for components to access
  window.__platformSettings = settings;
  
  // Add memory pressure tracking
  window.__lastMemoryPressureTime = 0;
  
  return settings;
}

// Export settings object to be used across the application
export const PlatformSettings = {
  initAndGetSettings: initializePlatformDetection,
  isAppleSilicon,
  isM3Mac,
  isWindows,
  isHighEndSystem,
  getOptimalRenderSettings,
  getThreadSettings,
  detectMemoryPressure
};

export default PlatformSettings; 