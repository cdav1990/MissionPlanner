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
  
  // Apple Silicon settings (more conservative)
  if (isAppleSilicon()) {
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
      useHighPrecision: false
    };
  }
  
  // High-end system settings (more aggressive)
  if (isHighEndSystem()) {
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
  
  return hasContextIssues || highJSHeapUsage;
}

// Initialize platform detection
export function initializePlatformDetection() {
  // Log platform detection info
  console.log('Platform Detection:');
  console.log(`- Apple Silicon: ${isAppleSilicon()}`);
  console.log(`- High-end System: ${isHighEndSystem()}`);
  console.log(`- Hardware Concurrency: ${navigator.hardwareConcurrency || 'unknown'}`);
  
  // Log the settings we'll use
  const settings = getOptimalRenderSettings();
  console.log('Using render settings:', settings);
  
  // Store settings globally for components to access
  window.__platformSettings = settings;
  
  return settings;
}

// Export settings object to be used across the application
export const PlatformSettings = {
  initAndGetSettings: initializePlatformDetection,
  isAppleSilicon,
  isHighEndSystem,
  getOptimalRenderSettings,
  getThreadSettings,
  detectMemoryPressure
};

export default PlatformSettings; 