/**
 * Utility functions for model loading and metadata handling
 */

/**
 * Creates a blob URL for a file with metadata embedded in the query string
 * @param {File} file - The file to create a blob URL for
 * @returns {Object} - Object containing the URL and metadata
 */
export const createMetadataEnrichedBlobUrl = (file) => {
  try {
    // Create a blob URL for the file
    const blobUrl = URL.createObjectURL(file);
    
    // Extract important metadata
    const metadata = {
      filename: file.name,
      extension: file.name.split('.').pop().toLowerCase(),
      size: file.size,
      type: file.type || 'application/octet-stream',
      lastModified: new Date(file.lastModified).toISOString()
    };
    
    // Add metadata as query parameters to the URL
    const url = new URL(blobUrl);
    Object.entries(metadata).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    console.log(`Created metadata-enriched URL: ${url.toString().substring(0, 100)}...`);
    
    return {
      url: url.toString(),
      metadata
    };
  } catch (err) {
    console.error('Error creating metadata-enriched blob URL:', err);
    // Fallback to regular blob URL if there's an error
    return {
      url: URL.createObjectURL(file),
      metadata: {
        filename: file.name,
        extension: file.name.split('.').pop().toLowerCase(),
        size: file.size
      }
    };
  }
};

/**
 * Get a user-friendly error message from various error types
 * @param {Error|Object|string} error - The error to get a message from
 * @returns {string} - A user-friendly error message
 */
export const getUserFriendlyErrorMessage = (error) => {
  // If it's a simple string, return it
  if (typeof error === 'string') {
    return error;
  }
  
  // If it's an Error object or has a message property, return the message
  if (error && error.message) {
    // For Out of Memory errors, provide a more helpful message
    if (error.message.includes('out of memory') || 
        error.message.includes('OOM') || 
        error.message.includes('memory limit')) {
      return 'Out of memory while processing the model. Try a smaller file or enable low memory mode.';
    }
    
    // For WebGL context lost errors
    if (error.message.includes('context lost') || 
        error.message.includes('WebGL') ||
        error.message.includes('GPU')) {
      return 'WebGL rendering error. Your GPU may be overloaded. Try a smaller file or close other applications.';
    }
    
    // For network errors
    if (error.message.includes('network') || 
        error.message.includes('Network') || 
        error.message.includes('CORS') ||
        error.message.includes('fetch')) {
      return 'Network error while loading the model. Check your internet connection.';
    }
    
    // For parsing errors
    if (error.message.includes('parse') || 
        error.message.includes('syntax') || 
        error.message.includes('unexpected')) {
      return 'Error parsing the model file. The file may be corrupted or in an unsupported format.';
    }
    
    // Return the original message if none of the above match
    return error.message;
  }
  
  // If it's an object but doesn't have a message property, stringify it
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch (e) {
      return 'Unknown error object';
    }
  }
  
  // Default fallback
  return 'An unknown error occurred';
};

/**
 * Analyzes a 3D model and logs information about it
 * @param {Object} model - The Three.js model object
 * @param {string} url - The URL of the model
 */
export const analyzeModel = (model, url) => {
  if (!model) {
    console.error("Model is null or undefined");
    return;
  }
  
  let totalVertices = 0;
  let totalFaces = 0;
  let meshCount = 0;
  let geometryIssues = 0;
  
  // Walk the model hierarchy
  model.traverse(child => {
    if (child.isMesh) {
      meshCount++;
      
      if (child.geometry) {
        const geometry = child.geometry;
        
        // Check position attribute
        if (geometry.attributes && geometry.attributes.position) {
          const vertices = geometry.attributes.position.count;
          totalVertices += vertices;
          
          // Check for NaN/invalid values
          const positions = geometry.attributes.position.array;
          let nanCount = 0;
          for (let i = 0; i < positions.length; i++) {
            if (isNaN(positions[i]) || !isFinite(positions[i])) {
              nanCount++;
            }
          }
          
          if (nanCount > 0) {
            console.warn(`Mesh ${meshCount} has ${nanCount} NaN values in positions`);
            geometryIssues++;
          }
          
          // Check face count
          if (geometry.index) {
            const faces = geometry.index.count / 3;
            totalFaces += faces;
            
            if (faces === 0) {
              console.warn(`Mesh ${meshCount} has 0 faces despite having ${vertices} vertices`);
              geometryIssues++;
            }
          } else {
            const faces = vertices / 3;
            totalFaces += faces;
            
            if (faces === 0) {
              console.warn(`Mesh ${meshCount} has 0 faces (non-indexed) despite having ${vertices} vertices`);
              geometryIssues++;
            }
          }
        } else {
          console.warn(`Mesh ${meshCount} has no position attribute`);
          geometryIssues++;
        }
        
        // Check bounding sphere
        if (!geometry.boundingSphere || isNaN(geometry.boundingSphere.radius)) {
          console.warn(`Mesh ${meshCount} has invalid bounding sphere`);
          geometryIssues++;
        }
      } else {
        console.warn(`Mesh ${meshCount} has no geometry`);
        geometryIssues++;
      }
    }
  });
  
  console.log(`Model analysis complete for ${url ? url.substring(0, 100) + '...' : 'unknown source'}`, {
    meshCount,
    totalVertices,
    totalFaces,
    geometryIssues,
    modelType: model.type || 'unknown',
    hasChildren: model.children?.length > 0
  });
  
  // Check if the model seems valid
  if (totalVertices === 0 || totalFaces === 0) {
    console.error("Model appears to have no geometry content - rendering will likely fail");
  } else if (geometryIssues > 0) {
    console.warn(`Model has ${geometryIssues} geometry issues that may affect rendering`);
  } else {
    console.log("Model appears valid and should render correctly");
  }
};

/**
 * Determines if the current device has WebGL 2 support
 * @returns {boolean} - Whether WebGL 2 is supported
 */
export const hasWebGL2Support = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch (e) {
    return false;
  }
};

/**
 * Gets information about the GPU
 * @returns {Object} - Object containing GPU information
 */
export const getGPUInfo = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      return { renderer: 'WebGL not supported', vendor: 'unknown' };
    }
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    
    if (!debugInfo) {
      return { 
        renderer: 'WebGL supported but GPU info not available',
        vendor: 'unknown',
        isAppleSilicon: navigator.userAgent.toLowerCase().includes('mac') && 
                       (navigator.userAgent.includes('Mac OS X') || navigator.userAgent.includes('macOS'))
      };
    }
    
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    
    return {
      renderer,
      vendor,
      isM1: renderer.includes('Apple M1'),
      isM2: renderer.includes('Apple M2'),
      isM3: renderer.includes('Apple M3'),
      isAppleSilicon: renderer.includes('Apple M')
    };
  } catch (e) {
    console.error('Error getting GPU info:', e);
    return { renderer: 'Error detecting GPU', vendor: 'unknown' };
  }
}; 