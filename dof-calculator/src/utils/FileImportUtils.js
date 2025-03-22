/**
 * Utilities for handling 3D file imports and format detection
 */
import * as THREE from 'three';

/**
 * Validate if the provided file is a valid OBJ model
 * @param {File} file - The file to validate
 * @returns {Promise<boolean>} - Promise resolving to true if valid, false otherwise
 */
export const validateObjFile = (file) => {
  return new Promise((resolve, reject) => {
    try {
      // OBJ files are text-based, so we can read a sample to verify
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const sample = e.target.result;
          
          // Basic validation - OBJ files should have 'v' vertices
          if (sample.includes('v ')) {
            // Check for malformed vertex data which could cause NaN issues
            const lines = sample.split('\n');
            const vertexLines = lines.filter(line => line.trim().startsWith('v '));
            
            // Sample a few vertices to check if they're valid numbers
            let hasInvalidVertex = false;
            // Check up to 20 random vertices
            const verticesToCheck = Math.min(vertexLines.length, 20);
            
            for (let i = 0; i < verticesToCheck; i++) {
              // Get a random vertex line
              const lineIndex = Math.floor(Math.random() * vertexLines.length);
              const vertexLine = vertexLines[lineIndex];
              const parts = vertexLine.trim().split(/\s+/);
              
              // Vertex lines should have format "v x y z" (or "v x y z w" with optional w)
              if (parts.length < 4) {
                console.warn(`Potentially invalid vertex line: "${vertexLine}"`);
                hasInvalidVertex = true;
                break;
              }
              
              // Check if the coordinates are valid numbers
              for (let j = 1; j < 4; j++) { // Check x, y, z values
                const coord = parseFloat(parts[j]);
                if (isNaN(coord) || !isFinite(coord)) {
                  console.warn(`Invalid coordinate in vertex: "${vertexLine}"`);
                  hasInvalidVertex = true;
                  break;
                }
              }
              
              if (hasInvalidVertex) break;
            }
            
            if (hasInvalidVertex) {
              console.warn("OBJ file contains possibly invalid vertex data");
              // We'll still proceed but with a warning
            }
            
            // Also check faces - especially for large files
            const faceLines = lines.filter(line => line.trim().startsWith('f '));
            if (faceLines.length === 0 && file.size > 10000) {
              // Large file with no faces is suspicious
              console.warn("OBJ file has vertices but no faces detected");
              
              // For large files, we need faces, but proceed with warning
              if (file.size > 1 * 1024 * 1024) { // > 1MB
                console.warn("Large OBJ file without faces may not render correctly");
              }
            }
            
            // For large files, verify we have enough vertices for a proper model
            if (file.size > 5 * 1024 * 1024) { // > 5MB
              console.log(`Large OBJ file (${(file.size / (1024 * 1024)).toFixed(2)}MB) with ${vertexLines.length} vertices in sample`);
              
              // Very large files should have many vertices, if our sample doesn't have many,
              // we may need to read more of the file to verify
              if (vertexLines.length < 100 && file.size > 20 * 1024 * 1024) {
                console.warn("Large file with few vertices in sample - reading more to validate");
                
                // Read a larger portion of the file for very large files
                const largerReader = new FileReader();
                largerReader.onload = (largerEvent) => {
                  const largerSample = largerEvent.target.result;
                  const largerLines = largerSample.split('\n');
                  const largerVertexCount = largerLines.filter(line => line.trim().startsWith('v ')).length;
                  
                  if (largerVertexCount < 1000 && file.size > 50 * 1024 * 1024) {
                    console.warn(`Very large file (${(file.size / (1024 * 1024)).toFixed(2)}MB) with only ${largerVertexCount} vertices found`);
                    // Still proceed, but with warning - might be a corrupted or non-standard file
                  }
                  
                  resolve(true);
                };
                
                largerReader.onerror = (err) => {
                  console.error('Error reading larger sample:', err);
                  // Still resolve as true since we already found vertices
                  resolve(true);
                };
                
                // Read a 1MB chunk from the middle of the file for larger validation
                const midPoint = Math.floor(file.size / 2);
                const startPos = Math.max(0, midPoint - 500000);
                largerReader.readAsText(file.slice(startPos, startPos + 1 * 1024 * 1024));
                return; // Exit and wait for larger reader
              }
            }
            
            // Otherwise, consider it valid
            resolve(true);
          } else {
            reject(new Error('No vertices found in OBJ file'));
          }
        } catch (err) {
          console.error('Error parsing OBJ file sample:', err);
          reject(err);
        }
      };
      
      reader.onerror = (err) => {
        console.error('Error reading OBJ file:', err);
        reject(new Error('Error reading OBJ file'));
      };
      
      // Read only first 100KB for initial checks
      // For larger files, more data is needed for a thorough check
      const sampleSize = file.size > 50 * 1024 * 1024 ? 200 * 1024 : 100 * 1024;
      reader.readAsText(file.slice(0, sampleSize));
    } catch (err) {
      console.error('Error validating OBJ file:', err);
      reject(err);
    }
  });
};

/**
 * Creates a revocable blob URL with metadata
 * @param {File} file - The file to create a URL for
 * @returns {object} - Object containing the URL and metadata
 */
export const createMetadataEnrichedBlobUrl = (file) => {
  if (!file) {
    throw new Error('No file provided to create blob URL');
  }
  
  try {
    // Create base blob URL
    const blobUrl = URL.createObjectURL(file);
    
    // Extract file metadata
    const fileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      extension: file.name.split('.').pop().toLowerCase(),
      lastModified: file.lastModified,
      dateCreated: new Date().toISOString()
    };
    
    // Create URL params
    const params = new URLSearchParams();
    params.append('filename', file.name);
    params.append('size', file.size.toString());
    params.append('type', file.type || 'application/octet-stream');
    params.append('extension', fileMetadata.extension);
    params.append('lastModified', file.lastModified.toString());
    
    // Create enriched URL
    const urlWithMetadata = `${blobUrl}?${params.toString()}`;
    
    return {
      url: urlWithMetadata,
      baseUrl: blobUrl,
      metadata: fileMetadata
    };
  } catch (err) {
    console.error('Error creating blob URL:', err);
    throw err;
  }
};

/**
 * Extracts metadata from a blob URL
 * @param {string} url - The URL to extract metadata from
 * @returns {object} - The extracted metadata
 */
export const extractMetadataFromBlobUrl = (url) => {
  const metadata = {
    filename: '',
    size: 0,
    type: '',
    extension: '',
    lastModified: 0
  };
  
  if (!url) return metadata;
  
  try {
    if (url.includes('?')) {
      const [baseUrl, queryString] = url.split('?');
      const params = new URLSearchParams(queryString);
      
      // Extract all available metadata
      metadata.filename = params.get('filename') || '';
      metadata.size = parseInt(params.get('size') || '0', 10);
      metadata.type = params.get('type') || '';
      metadata.extension = params.get('extension') || 
                         (metadata.filename ? metadata.filename.split('.').pop().toLowerCase() : '');
      metadata.lastModified = parseInt(params.get('lastModified') || '0', 10);
      metadata.baseUrl = baseUrl;
    }
  } catch (err) {
    console.warn('Error extracting metadata from URL:', err);
  }
  
  return metadata;
};

/**
 * Detect file format based on extension and content
 * @param {File} file - The file to detect format for
 * @returns {Promise<string>} - Promise resolving to the detected format
 */
export const detectFileFormat = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    
    try {
      // First check by extension
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (['obj', 'ply', 'stl', 'glb', 'gltf', 'fbx', 'pcd', 'las', 'laz'].includes(extension)) {
        // Known 3D format by extension
        resolve(extension);
        return;
      }
      
      // If no recognized extension, try to detect by MIME type and content
      if (file.type === 'application/octet-stream') {
        // Read the first few bytes to check for known signatures
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target.result;
          const view = new DataView(buffer);
          
          // Check for common binary formats
          if (buffer.byteLength >= 4) {
            // Check for STL (binary) - should start with a 80-byte header
            // followed by a 4-byte unsigned integer
            if (buffer.byteLength >= 84) {
              const triangleCount = view.getUint32(80, true);
              if (triangleCount > 0 && triangleCount < 10000000 && 
                 buffer.byteLength === 84 + (triangleCount * 50)) {
                resolve('stl');
                return;
              }
            }
            
            // Check for glTF binary (GLB)
            if (view.getUint32(0, true) === 0x46546C67) {
              resolve('glb');
              return;
            }
            
            // PLY binary signature
            if (buffer.byteLength >= 10) {
              const header = new TextDecoder().decode(buffer.slice(0, 10));
              if (header.startsWith('ply')) {
                resolve('ply');
                return;
              }
            }
          }
          
          // If small file, assume PLY for now
          if (file.size < 1000000) {
            console.warn('Small binary file with unknown format, assuming PLY');
            resolve('ply');
          } else {
            reject(new Error('Could not detect 3D file format'));
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Error reading file header for format detection'));
        };
        
        reader.readAsArrayBuffer(file.slice(0, 1024)); // Read first 1KB
      } else {
        // No known format detected
        reject(new Error(`Unknown 3D file format: ${file.type}`));
      }
    } catch (err) {
      console.error('Error detecting file format:', err);
      reject(err);
    }
  });
};

/**
 * Creates a simplified material for use with loaded models
 * @param {object} options - Material options
 * @returns {THREE.Material} - The created material
 */
export const createSimplifiedMaterial = (options = {}) => {
  const defaultOptions = {
    color: 0x8888ff,
    opacity: 1.0,
    transparent: false,
    flatShading: true,
    side: THREE.DoubleSide,
    wireframe: false
  };
  
  const materialOptions = { ...defaultOptions, ...options };
  return new THREE.MeshStandardMaterial(materialOptions);
};

/**
 * Convert LoaderError objects to more user-friendly messages
 * @param {Error} error - The error to convert
 * @returns {string} - User-friendly error message
 */
export const getUserFriendlyErrorMessage = (error) => {
  if (!error) return 'Unknown error';
  
  const errorMessage = error.message || error.toString();
  
  // Common OBJ loader errors
  if (errorMessage.includes('Unexpected token') || 
      errorMessage.includes('JSON')) {
    return 'Invalid file format. Please ensure you\'re uploading a valid 3D model file.';
  }
  
  if (errorMessage.includes('NetworkError') || 
      errorMessage.includes('failed to fetch') || 
      errorMessage.includes('network error')) {
    return 'Network error while loading model. Please check your connection and try again.';
  }
  
  if (errorMessage.includes('memory') || errorMessage.includes('out of memory')) {
    return 'The model is too large for your device\'s memory. Try a smaller model or reduce texture sizes.';
  }
  
  if (errorMessage.includes('Not a proper OBJ file') || 
      errorMessage.includes('Failed to load the model') ||
      errorMessage.includes('No vertices found')) {
    return 'Invalid 3D model file. The file appears to be damaged or in an unsupported format.';
  }
  
  return errorMessage;
}; 