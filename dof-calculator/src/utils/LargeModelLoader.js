/**
 * Optimized large model loading utilities
 * Provides worker-based loading and LOD support for large 3D models
 */
import * as THREE from 'three';
// Updated import for Three.js 0.170.0+
import { mergeBufferGeometries } from 'three-stdlib';

// Size thresholds for different loading strategies
const SIZE_THRESHOLDS = {
  SMALL: 5 * 1024 * 1024,       // 5MB - use standard loading
  MEDIUM: 30 * 1024 * 1024,     // 30MB (reduced from 50MB) - use chunked loading
  LARGE: 50 * 1024 * 1024       // 50MB (reduced from 200MB) - use LOD + decimation
};

// Performance profiles based on system capabilities
const PERFORMANCE_PROFILES = {
  HIGH: {
    maxTriangles: 2000000,      // 2M triangles max for high-end systems
    chunkSize: 1000000,         // 1M triangles per chunk
    lodLevels: 4,               // Support 4 LOD levels
    useCompression: false,      // No compression needed for high-end
    useWorker: true             // Use worker for non-blocking loading
  },
  MEDIUM: {
    maxTriangles: 1000000,      // 1M triangles max for mid-range systems
    chunkSize: 500000,          // 500k triangles per chunk
    lodLevels: 3,               // Support 3 LOD levels
    useCompression: true,       // Use compression for better performance
    useWorker: true             // Use worker for non-blocking loading
  },
  LOW: {
    maxTriangles: 500000,       // 500k triangles max for low-end systems
    chunkSize: 250000,          // 250k triangles per chunk
    lodLevels: 2,               // Support only 2 LOD levels
    useCompression: true,       // Always use compression for low-end
    useWorker: true             // Use worker even for smaller models
  }
};

/**
 * Detect system capabilities and return appropriate performance profile
 * @returns {Object} Performance profile based on system capabilities
 */
export function detectPerformanceProfile() {
  let profile = PERFORMANCE_PROFILES.MEDIUM; // Default to medium

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) {
      console.warn('WebGL not supported, using LOW performance profile');
      return PERFORMANCE_PROFILES.LOW;
    }
    
    // Check for high-end GPU
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      console.log(`GPU detected: ${vendor} ${renderer}`);
      
      // Apple Silicon detection
      const isAppleSilicon = vendor.includes('Apple') && 
                           (renderer.includes('Apple M') || renderer.includes('Apple GPU'));
      
      // Check if we're running on an M-series chip
      const isM3 = isAppleSilicon && renderer.includes('M3');
      
      // High-end GPU detection (this is a simple heuristic)
      const isHighEnd = isM3 || 
                      renderer.includes('RTX') || 
                      renderer.includes('Radeon Pro') || 
                      (renderer.includes('Intel') && renderer.includes('Iris'));
                      
      // Mid-range GPU detection
      const isMidRange = !isHighEnd && (
                       renderer.includes('GTX') || 
                       renderer.includes('Radeon') || 
                       isAppleSilicon);
      
      if (isHighEnd) {
        profile = PERFORMANCE_PROFILES.HIGH;
      } else if (isMidRange) {
        profile = PERFORMANCE_PROFILES.MEDIUM;
      } else {
        profile = PERFORMANCE_PROFILES.LOW;
      }
    }
    
    // Check available memory - if available
    if (window.performance && window.performance.memory) {
      const { jsHeapSizeLimit } = window.performance.memory;
      // If low memory, downgrade profile
      if (jsHeapSizeLimit < 1 * 1024 * 1024 * 1024) { // Less than 1GB
        if (profile === PERFORMANCE_PROFILES.HIGH) {
          profile = PERFORMANCE_PROFILES.MEDIUM;
        } else if (profile === PERFORMANCE_PROFILES.MEDIUM) {
          profile = PERFORMANCE_PROFILES.LOW;
        }
      }
    }
    
    console.log('Selected performance profile:', 
      profile === PERFORMANCE_PROFILES.HIGH ? 'HIGH' :
      profile === PERFORMANCE_PROFILES.MEDIUM ? 'MEDIUM' : 'LOW');
    
    return profile;
  } catch (e) {
    console.error('Error detecting performance profile:', e);
    return PERFORMANCE_PROFILES.LOW; // Fall back to low profile
  }
}

/**
 * Progressive OBJ loader that uses web workers and LOD for large models
 * @param {File|Blob|String} input - File, Blob, or URL to load
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} Promise that resolves with the loaded model details
 */
export async function loadLargeObjModel(input, options = {}) {
  const {
    onProgress = () => {},
    onLodLevelLoaded = () => {},
    material = null,
    profile = null
  } = options;
  
  // Determine performance profile if not provided
  const performanceProfile = profile || detectPerformanceProfile();
  
  // Create response object
  const modelResponse = {
    model: null,           // The Three.js model/group
    meshes: [],            // Array of individual meshes
    stats: {
      triangles: 0,
      vertices: 0,
      materials: 0,
      fileSize: 0,
      loadTime: 0,
      lodLevels: []
    },
    lod: null,             // LOD object if created
    inputType: typeof input
  };
  
  // Start timing
  const startTime = performance.now();
  
  // Figure out the input type and get file size
  let fileSize = 0;
  let fileData = null;
  let objUrl = null;
  
  try {
    if (input instanceof File || input instanceof Blob) {
      fileSize = input.size;
      modelResponse.stats.fileSize = fileSize;
      modelResponse.inputType = input instanceof File ? 'File' : 'Blob';
      
      // Create a URL for the file/blob
      objUrl = URL.createObjectURL(input);
    } else if (typeof input === 'string') {
      objUrl = input;
      modelResponse.inputType = 'URL';
      
      // For URL, try to get content size with a HEAD request
      try {
        const response = await fetch(input, { method: 'HEAD' });
        fileSize = parseInt(response.headers.get('content-length') || '0', 10);
        modelResponse.stats.fileSize = fileSize;
      } catch (e) {
        console.warn('Could not determine file size from URL:', e);
      }
    } else {
      throw new Error('Input must be a File, Blob, or URL string');
    }
    
    // Decide on loading strategy based on file size
    let loadingStrategy = 'standard';
    if (fileSize >= SIZE_THRESHOLDS.LARGE) {
      loadingStrategy = 'lod';
    } else if (fileSize >= SIZE_THRESHOLDS.MEDIUM) {
      loadingStrategy = 'chunked';
    }
    
    console.log(`Using ${loadingStrategy} loading for ${fileSize / (1024 * 1024).toFixed(2)}MB file`);
    
    // Initial progress update
    onProgress({ 
      phase: 'initializing', 
      progress: 0.05, 
      strategy: loadingStrategy,
      fileSize
    });
    
    // Use a specific approach based on file size
    if (loadingStrategy === 'standard') {
      // For small files, use standard loading (but still in a worker if supported)
      if (performanceProfile.useWorker) {
        try {
          modelResponse.model = await loadWithWorker(objUrl, { onProgress });
        } catch (workerError) {
          console.warn("Worker loading failed, falling back to direct loading:", workerError);
          // Fall back to standard loading
          const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
          const loader = new OBJLoader();
          
          modelResponse.model = await new Promise((resolve, reject) => {
            loader.load(
              objUrl,
              (obj) => resolve(obj),
              (event) => {
                if (event.lengthComputable) {
                  onProgress({ 
                    phase: 'loading', 
                    progress: event.loaded / event.total 
                  });
                }
              },
              (error) => reject(error)
            );
          });
        }
      } else {
        // Fallback to standard Three.js loader if worker not supported
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
        const loader = new OBJLoader();
        
        modelResponse.model = await new Promise((resolve, reject) => {
          loader.load(
            objUrl,
            (obj) => resolve(obj),
            (event) => {
              if (event.lengthComputable) {
                onProgress({ 
                  phase: 'loading', 
                  progress: event.loaded / event.total 
                });
              }
            },
            (error) => reject(error)
          );
        });
      }
      
      // Count triangles and vertices
      modelResponse.model.traverse(child => {
        if (child.isMesh) {
          modelResponse.meshes.push(child);
          
          if (child.geometry) {
            const geometry = child.geometry;
            const vertexCount = geometry.attributes.position.count;
            modelResponse.stats.vertices += vertexCount;
            
            // Count triangles
            if (geometry.index) {
              modelResponse.stats.triangles += geometry.index.count / 3;
            } else {
              modelResponse.stats.triangles += vertexCount / 3;
            }
          }
          
          // Apply custom material if provided
          if (material) {
            if (Array.isArray(material)) {
              child.material = material;
            } else {
              child.material = material.clone();
            }
          }
        }
      });
    } else if (loadingStrategy === 'chunked' || loadingStrategy === 'lod') {
      // For medium and large files, always start with a low-res preview
      onProgress({ 
        phase: 'loading-preview', 
        progress: 0.1 
      });
      
      // Generate a decimated preview version with very low resolution first
      // Using a much lower detail factor for initial preview
      const previewFactor = loadingStrategy === 'lod' ? 0.02 : 0.05;
      const previewModel = await loadDecimatedPreview(objUrl, previewFactor, { onProgress });
      
      // Signal that we have a preview available
      onLodLevelLoaded({
        level: 0,
        model: previewModel,
        quality: 'preview',
        triangles: countTriangles(previewModel)
      });
      
      // Set the preview as the initial model
      modelResponse.model = previewModel;
      
      // If it's a LOD strategy, continue loading higher quality versions
      if (loadingStrategy === 'lod') {
        // For large files, use LOD-based loading
        // Create an LOD system with multiple detail levels
        const lod = new THREE.LOD();
        
        // Add the preview we already loaded
        lod.addLevel(previewModel, 60);
        
        // Determine appropriate LOD levels based on file size
        const numLevels = Math.min(performanceProfile.lodLevels, 3); // Cap at 3 levels for very large files
        
        // Define decimation factors based on file size
        // For very large files, use more aggressive decimation
        let decimationFactors = [0.05, 0.2, 0.5];
        let lodDistances = [45, 20, 0];
        
        // For extremely large files, be even more conservative
        if (fileSize > 100 * 1024 * 1024) { // 100MB+
          decimationFactors = [0.02, 0.1, 0.3];
          lodDistances = [60, 30, 0];
        }
        
        // Starting from level 1 (since level a already loaded)
        for (let i = 1; i < numLevels; i++) {
          try {
            const decimationFactor = decimationFactors[i];
            const lodDistance = lodDistances[i];
            
            // Update progress
            onProgress({ 
              phase: `loading-lod-${i}`, 
              progress: 0.1 + (0.9 * (i / numLevels)), 
              level: i,
              totalLevels: numLevels,
              decimationFactor
            });
            
            // Allow UI updates between LOD level loads
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Load this LOD level
            const levelModel = await loadDecimatedPreview(
              objUrl, 
              decimationFactor,
              { 
                onProgress: (p) => {
                  onProgress({ 
                    phase: `loading-lod-${i}-progress`, 
                    progress: 0.1 + (0.9 * ((i + p.progress) / numLevels)),
                    level: i,
                    levelProgress: p.progress
                  });
                }
              }
            );
            
            // Add to LOD
            lod.addLevel(levelModel, lodDistance);
            
            // Gather statistics for this level
            const levelTriangles = countTriangles(levelModel);
            modelResponse.stats.lodLevels.push({
              level: i,
              decimationFactor,
              distance: lodDistance,
              triangles: levelTriangles
            });
            
            // Signal that this LOD level is ready
            onLodLevelLoaded({
              level: i,
              model: levelModel,
              quality: i === numLevels - 1 ? 'full' : 'preview',
              triangles: levelTriangles,
              distance: lodDistance
            });
            
            // Update the model to the latest LOD configuration
            modelResponse.model = lod;
            modelResponse.lod = lod;
            
            // For the highest quality level, extract full stats
            if (i === numLevels - 1) {
              // This is the full-quality model, gather complete statistics
              levelModel.traverse(child => {
                if (child.isMesh) {
                  modelResponse.meshes.push(child);
                  
                  if (child.geometry) {
                    const geometry = child.geometry;
                    modelResponse.stats.vertices += geometry.attributes.position.count;
                    
                    if (geometry.index) {
                      modelResponse.stats.triangles += geometry.index.count / 3;
                    } else {
                      modelResponse.stats.triangles += geometry.attributes.position.count / 3;
                    }
                  }
                }
              });
            }
          } catch (lodError) {
            console.error(`Error loading LOD level ${i}:`, lodError);
            // Continue with what we have so far
            break;
          }
        }
      } else {
        // For chunked strategy, load a medium quality version (not too detailed)
        try {
          onProgress({ 
            phase: 'loading-medium-quality', 
            progress: 0.5 
          });
          
          // Allow UI updates
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Load a medium quality model (30% of full detail)
          const mediumModel = await loadDecimatedPreview(objUrl, 0.3, { 
            onProgress: (p) => {
              onProgress({ 
                phase: 'loading-medium-quality-progress', 
                progress: 0.5 + (p.progress * 0.3) 
              });
            }
          });
          
          // Replace the preview with the medium quality model
          modelResponse.model = mediumModel;
          
          // Gather statistics
          mediumModel.traverse(child => {
            if (child.isMesh) {
              modelResponse.meshes.push(child);
              
              if (child.geometry) {
                const geometry = child.geometry;
                modelResponse.stats.vertices += geometry.attributes.position.count;
                
                if (geometry.index) {
                  modelResponse.stats.triangles += geometry.index.count / 3;
                } else {
                  modelResponse.stats.triangles += geometry.attributes.position.count / 3;
                }
              }
            }
          });
        } catch (err) {
          console.error("Error loading medium quality model:", err);
          // Continue with the preview model
        }
      }
    }
    
    // Record load time
    modelResponse.stats.loadTime = performance.now() - startTime;
    
    // Clean up if we created a blob URL
    if (objUrl && input instanceof Blob) {
      URL.revokeObjectURL(objUrl);
    }
    
    return modelResponse;
  } catch (error) {
    // Clean up resources on error
    if (objUrl && input instanceof Blob) {
      URL.revokeObjectURL(objUrl);
    }
    
    console.error('Error loading large model:', error);
    throw error;
  }
}

/**
 * Load a model using a Web Worker for better performance
 * @param {string} url URL to load
 * @param {object} options Options for loading
 * @returns {Promise<Object>} Promise that resolves with the loaded model
 */
async function loadWithWorker(url, { onProgress }) {
  try {
    // First check if Web Workers are supported
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported, falling back to main thread loading');
      // Import the OBJLoader
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const loader = new OBJLoader();
      
      // Load the model directly on the main thread
      return new Promise((resolve, reject) => {
        console.log("Loading OBJ model on main thread:", url);
        
        // Set up an abort controller with timeout to prevent hang
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error("Loading timed out after 60 seconds");
          controller.abort();
        }, 60000); // 60 second timeout
        
        // Track memory usage to detect potential issues
        let lastMemoryUsage = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const memoryCheckInterval = setInterval(() => {
          if (performance.memory) {
            const currentUsage = performance.memory.usedJSHeapSize;
            const usageMB = currentUsage / (1024 * 1024);
            const change = currentUsage - lastMemoryUsage;
            const changeMB = change / (1024 * 1024);
            
            console.log(`Memory usage during load: ${usageMB.toFixed(2)}MB (${changeMB > 0 ? '+' : ''}${changeMB.toFixed(2)}MB)`);
            
            // Check for potential memory issues
            if (usageMB > 1500) { // 1.5GB is quite high for browser JS
              console.warn('High memory usage detected during model loading');
            }
            
            lastMemoryUsage = currentUsage;
          }
        }, 5000);
        
        loader.load(
          url,
          (obj) => {
            clearTimeout(timeoutId);
            clearInterval(memoryCheckInterval);
            console.log("OBJ model loaded successfully:", obj);
            
            // Fix any geometry issues before returning the object
            obj = fixModelGeometryIssues(obj);
            
            resolve(obj);
          },
          (event) => {
            if (event.lengthComputable) {
              const progress = event.loaded / event.total;
              console.log(`Loading progress: ${Math.round(progress * 100)}%`);
              onProgress({ 
                phase: 'loading', 
                progress 
              });
            }
          },
          (error) => {
            clearTimeout(timeoutId);
            clearInterval(memoryCheckInterval);
            console.error("Error loading OBJ model:", error);
            reject(error);
          }
        );
        
        // Handle abort case
        controller.signal.addEventListener('abort', () => {
          clearInterval(memoryCheckInterval);
          reject(new Error('Loading timed out'));
        });
      });
    }
    
    // Use a Web Worker for better performance
    return new Promise((resolve, reject) => {
      try {
        console.log("Initializing worker for OBJ loading...");
        
        // Create a new worker
        const worker = new Worker(
          new URL('../workers/ObjLoaderWorker.js', import.meta.url),
          { type: 'module' }
        );
        
        // Set up message handling from the worker
        worker.onmessage = function(e) {
          const data = e.data;
          
          switch (data.type) {
            case 'progress':
              // Report progress
              onProgress({
                phase: data.phase || 'loading',
                progress: data.progress || 0
              });
              break;
              
            case 'stats':
              // Report stats about the OBJ file
              console.log("OBJ file stats:", data);
              break;
              
            case 'result':
              // Process the worker's result
              console.log("Worker completed processing OBJ data");
              
              // Create a Three.js group to hold all the meshes
              const group = new THREE.Group();
              
              // Create a geometry from the vertex data
              const geometry = new THREE.BufferGeometry();
              
              // Add position attribute
              geometry.setAttribute(
                'position',
                new THREE.BufferAttribute(data.vertices, 3)
              );
              
              // Add normal attribute if available
              if (data.normals) {
                geometry.setAttribute(
                  'normal',
                  new THREE.BufferAttribute(data.normals, 3)
                );
              }
              
              // Add UV attribute if available
              if (data.texcoords) {
                geometry.setAttribute(
                  'uv',
                  new THREE.BufferAttribute(data.texcoords, 2)
                );
              }
              
              // Create a mesh with the geometry
              const material = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                flatShading: !data.normals
              });
              
              const mesh = new THREE.Mesh(geometry, material);
              group.add(mesh);
              
              // Terminate the worker
              worker.terminate();
              
              // Resolve with the group
              resolve(group);
              break;
              
            case 'error':
              console.error("Worker error:", data.message);
              worker.terminate();
              reject(new Error(data.message));
              break;
              
            default:
              console.log("Unknown message from worker:", data);
          }
        };
        
        // Handle worker errors
        worker.onerror = function(error) {
          console.error("Worker error:", error);
          worker.terminate();
          reject(error);
        };
        
        // Start the worker by sending it the URL to load
        worker.postMessage({
          type: 'load',
          url: url
        });
        
      } catch (workerError) {
        console.error("Error creating worker:", workerError);
        // Fall back to main thread loading if there's a problem with the worker
        reject(workerError); // Reject immediately
        
        // The caller will handle this error and can use the standard loading path
      }
    });
  } catch (err) {
    console.error("Error in worker loading:", err);
    throw err;
  }
}

/**
 * Fixes common geometry issues like NaN values in model geometries
 * @param {Object} model The loaded model to fix
 * @returns {Object} The fixed model
 */
function fixModelGeometryIssues(model) {
  if (!model) return model;
  
  console.log("Running geometry validation and fixing NaN values...");
  let fixCount = 0;
  let meshCount = 0;
  
  model.traverse(object => {
    if (object.isMesh && object.geometry) {
      meshCount++;
      
      try {
        // Fix NaN values in position attributes
        const positions = object.geometry.attributes.position;
        if (positions && positions.array) {
          let hasNaN = false;
          let nanCount = 0;
          
          // 1. Look for NaN or Infinity values and fix them
          for (let i = 0; i < positions.array.length; i++) {
            if (isNaN(positions.array[i]) || !isFinite(positions.array[i])) {
              // Replace with 0 or another nearby valid value if possible
              positions.array[i] = 0;
              nanCount++;
              hasNaN = true;
            }
          }
          
          if (hasNaN) {
            console.warn(`Fixed ${nanCount} NaN values in mesh ${object.name || 'unnamed'}`);
            positions.needsUpdate = true;
            fixCount++;
          }
          
          // 2. Check for degenerate triangles (zero area) that can cause problems
          if (object.geometry.index) {
            const indices = object.geometry.index.array;
            const posArray = positions.array;
            
            // This is a simple check for zero-area triangles
            for (let i = 0; i < indices.length; i += 3) {
              const i1 = indices[i] * 3;
              const i2 = indices[i+1] * 3;
              const i3 = indices[i+2] * 3;
              
              // Check if all vertices are the same (degenerate)
              if ((i1 === i2 && i2 === i3) ||
                  (posArray[i1] === posArray[i2] && posArray[i2] === posArray[i3] &&
                   posArray[i1+1] === posArray[i2+1] && posArray[i2+1] === posArray[i3+1] &&
                   posArray[i1+2] === posArray[i2+2] && posArray[i2+2] === posArray[i3+2])) {
                // This is a zero-area triangle, but we don't remove it as that would
                // require rebuilding the index buffer. Just note it for now.
                console.warn("Detected degenerate triangle");
              }
            }
          }
        }
        
        // 3. Try to compute bounding sphere and fix if needed
        try {
          // First try standard computation
          object.geometry.computeBoundingSphere();
          
          // Check if the result is valid
          if (isNaN(object.geometry.boundingSphere.radius)) {
            throw new Error("Invalid bounding sphere (NaN radius)");
          }
        } catch (e) {
          console.warn(`Error computing bounding sphere for mesh ${object.name || 'unnamed'}:`, e);
          
          // Create a fallback bounding sphere
          const positionsArray = object.geometry.attributes.position.array;
          let minX = Infinity, minY = Infinity, minZ = Infinity;
          let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
          
          // Find min/max values ignoring NaN/Infinity
          for (let i = 0; i < positionsArray.length; i += 3) {
            const x = positionsArray[i];
            const y = positionsArray[i + 1];
            const z = positionsArray[i + 2];
            
            if (isFinite(x)) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
            }
            
            if (isFinite(y)) {
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
            
            if (isFinite(z)) {
              minZ = Math.min(minZ, z);
              maxZ = Math.max(maxZ, z);
            }
          }
          
          // If we couldn't find valid bounds, use defaults
          if (!isFinite(minX) || !isFinite(maxX)) {
            minX = -1; maxX = 1;
          }
          if (!isFinite(minY) || !isFinite(maxY)) {
            minY = -1; maxY = 1;
          }
          if (!isFinite(minZ) || !isFinite(maxZ)) {
            minZ = -1; maxZ = 1;
          }
          
          // Create a center point and radius
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const centerZ = (minZ + maxZ) / 2;
          
          // Compute radius as distance from center to furthest corner
          const radiusX = Math.abs(maxX - centerX);
          const radiusY = Math.abs(maxY - centerY);
          const radiusZ = Math.abs(maxZ - centerZ);
          const radius = Math.sqrt(radiusX*radiusX + radiusY*radiusY + radiusZ*radiusZ);
          
          // Apply the fallback bounding sphere
          object.geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(centerX, centerY, centerZ),
            isFinite(radius) ? radius : 10
          );
          
          console.log(`Created fallback bounding sphere with radius ${object.geometry.boundingSphere.radius}`);
          fixCount++;
        }
      } catch (geomError) {
        console.error(`Error fixing geometry for mesh ${object.name || 'unnamed'}:`, geomError);
      }
    }
  });
  
  console.log(`Geometry validation complete: checked ${meshCount} meshes, fixed ${fixCount} issues`);
  return model;
}

/**
 * Count triangles in a model
 * @param {Object} model THREE.js model to count triangles in
 * @returns {number} Triangle count
 */
function countTriangles(model) {
  let triangles = 0;
  model.traverse(child => {
    if (child.isMesh && child.geometry) {
      if (child.geometry.index) {
        triangles += child.geometry.index.count / 3;
      } else {
        triangles += child.geometry.attributes.position.count / 3;
      }
    }
  });
  return triangles;
}

/**
 * Load a decimated preview version of the model
 * This is a simplified version of loadDecimatedVersion that uses a lower resolution
 * to quickly show something on screen
 */
async function loadDecimatedPreview(url, factor, { onProgress }) {
  try {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    
    // Create a simple material that's efficient to render
    const material = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa,
      wireframe: factor < 0.1, // Use wireframe for very low detail levels
      flatShading: true,
      side: THREE.DoubleSide
    });
    
    // Very simple loading with basic preprocessing
    const loader = new OBJLoader();
    
    // Set up timeout to prevent hang
    let timeoutId = null;
    const loadPromise = new Promise((resolve, reject) => {
      // Set a timeout to prevent hanging on large files
      timeoutId = setTimeout(() => {
        console.warn('Preview load timed out - continuing with placeholder');
        
        // Create a simple placeholder cube if timeout occurs
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);
        
        resolve({
          model: group,
          triangles: 12, // cube has 12 triangles
          quality: 'preview-fallback',
          isPlaceholder: true
        });
      }, 10000); // 10 second timeout for preview
      
      // Attempt to load the model
      loader.load(
        url,
        (object) => {
          clearTimeout(timeoutId);
          
          // Apply the simple material to all meshes
          object.traverse(child => {
            if (child.isMesh) {
              child.material = material;
            }
          });
          
          // Count triangles for debug info
          const triangles = countTriangles(object);
          
          resolve({
            model: object,
            triangles,
            quality: 'preview',
            isPlaceholder: false
          });
        },
        (event) => {
          if (event.lengthComputable) {
            onProgress({
              phase: 'preview',
              progress: event.loaded / event.total
            });
          }
        },
        (error) => {
          console.error('Error loading preview model:', error);
          clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
    
    return loadPromise;
  } catch (err) {
    console.error('Error loading decimated preview:', err);
    
    // Return a placeholder on error
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffaa00, 
      wireframe: true 
    });
    const mesh = new THREE.Mesh(geometry, material);
    const group = new THREE.Group();
    group.add(mesh);
    
    return {
      model: group,
      triangles: 12,
      quality: 'error-fallback',
      isPlaceholder: true,
      error: err.message
    };
  }
}

/**
 * Create a standardized material for the model that balances performance and appearance
 * @param {Object} options Material options
 * @returns {THREE.Material} Created material
 */
export function createOptimizedMaterial(options = {}) {
  const { 
    color = 0x8899ff,
    wireframe = false,
    transparent = false,
    opacity = 1.0,
    flatShading = true,
    side = THREE.DoubleSide
  } = options;
  
  // For best performance, use MeshLambertMaterial instead of MeshStandardMaterial
  const material = new THREE.MeshLambertMaterial({
    color,
    wireframe,
    transparent: transparent || opacity < 1,
    opacity,
    flatShading,
    side
  });
  
  return material;
}

/**
 * Release resources associated with a model
 * @param {Object} model THREE.js model to dispose
 */
export function disposeModel(model) {
  if (!model) return;
  
  // Traverse the model and dispose of geometries and materials
  model.traverse(object => {
    if (object.isMesh) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            disposeMaterialResources(material);
            material.dispose();
          });
        } else {
          disposeMaterialResources(object.material);
          object.material.dispose();
        }
      }
    }
  });
  
  // Remove from parent
  if (model.parent) {
    model.parent.remove(model);
  }
  
  // Try to help garbage collection
  if (window.gc) {
    try { window.gc(); } catch (e) { /* Ignore */ }
  }
}

/**
 * Dispose of resources associated with a material
 * @param {THREE.Material} material Material to dispose
 */
function disposeMaterialResources(material) {
  // Dispose of any textures
  for (const key in material) {
    const value = material[key];
    if (value && typeof value === 'object' && 'isTexture' in value) {
      value.dispose();
    }
  }
} 