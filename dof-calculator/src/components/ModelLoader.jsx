import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { Html } from '@react-three/drei';

/**
 * Enhanced ModelLoader that handles OBJ and PLY files with better diagnostics
 * Optimized for large files (100MB+) using blob URLs
 * @param {object} props Component props
 * @param {string} props.url URL to load the model from (blob URL with filename query param preferred)
 * @param {string} props.format Format of the model ('obj', 'ply', or auto-detect)
 * @param {number} props.scale Scale factor for the model
 * @param {number} props.opacity Opacity for the model material
 * @param {Function} props.onLoad Callback when model is loaded successfully
 * @param {Function} props.onError Callback when an error occurs
 */
const ModelLoader = ({ 
  url, 
  format = null, 
  scale = 1, 
  opacity = 1, 
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  onLoad = () => {}, 
  onError = () => {}
}) => {
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [debugInfo, setDebugInfo] = useState({});
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const groupRef = useRef();
  const timeoutRef = useRef(null);
  
  // Store references to geometries and materials for cleanup
  const geometriesRef = useRef([]);
  const materialsRef = useRef([]);
  
  // Clean up any timeout when component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Load model on mount or URL change
  useEffect(() => {
    if (!url) {
      setError("No URL provided");
      setLoading(false);
      onError(new Error("No URL provided"));
      return;
    }
    
    let modelFormat = format;
    let fileNameFromUrl = '';
    let cleanUrl = url;
    
    console.log(`ModelLoader: Starting to process URL: ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
    
    // Extract file metadata from URL params if available
    try {
      // Check for blob URL with query parameters
      if (url.includes('?')) {
        const urlParts = url.split('?');
        cleanUrl = urlParts[0]; // Remove query params for loading
        
        // Parse the query parameters to extract metadata
        const params = new URLSearchParams(urlParts[1]);
        fileNameFromUrl = params.get('filename') || '';
        
        console.log(`Found metadata in URL - filename: ${fileNameFromUrl}`);
        
        // Try to determine format from filename if not specified
        if (!modelFormat && fileNameFromUrl) {
          const ext = fileNameFromUrl.split('.').pop()?.toLowerCase();
          if (ext) {
            modelFormat = ext;
            console.log(`Detected format from filename parameter: ${modelFormat}`);
          }
        }
      }
    } catch (urlError) {
      console.warn("Error parsing URL params:", urlError);
    }
    
    // If still no format, try to determine from the URL path
    if (!modelFormat) {
      try {
        const pathParts = cleanUrl.split('/').pop().split('.');
        if (pathParts.length > 1) {
          modelFormat = pathParts.pop().toLowerCase();
          console.log(`Detected format from URL path: ${modelFormat}`);
        }
      } catch (pathError) {
        console.warn("Error determining format from path:", pathError);
      }
    }
    
    console.log(`ModelLoader: Loading model - Format: ${modelFormat}, URL: ${cleanUrl.substring(0, 100)}${cleanUrl.length > 100 ? '...' : ''}`);
    
    // Reset state
    setModel(null);
    setError(null);
    setLoading(true);
    setProgress(0);
    setLoadingTimeout(false);
    setDebugInfo({
      originalUrl: url,
      cleanUrl,
      format: modelFormat,
      fileName: fileNameFromUrl,
      loadStarted: new Date().toISOString()
    });
    
    // Clean up previous model resources
    geometriesRef.current.forEach(geo => {
      if (geo && geo.dispose) geo.dispose();
    });
    
    materialsRef.current.forEach(mat => {
      if (mat) {
        if (mat.map) mat.map.dispose();
        if (mat.dispose) mat.dispose();
      }
    });
    
    geometriesRef.current = [];
    materialsRef.current = [];
    
    // Set up a timeout to detect if loading gets stuck
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      // If we're still loading after 30 seconds, something may be wrong
      if (loading) {
        console.warn('Model loading taking longer than expected - may be stuck');
        setLoadingTimeout(true);
      }
    }, 30000); // 30 second timeout
    
    try {
      // Choose loader based on format
      let loader;
      let processResult;
      
      if (modelFormat === 'obj') {
        // OBJ format - Create a new loader instance each time to avoid stale state
        loader = new OBJLoader();
        console.log("Created new OBJLoader instance");
        
        processResult = (object) => {
          console.log("OBJ loaded successfully:", object);
          
          if (!object || !object.children || object.children.length === 0) {
            throw new Error("OBJ file contains no valid meshes");
          }
          
          // Apply transformations
          object.scale.set(scale, scale, scale);
          
          // Track vertices and faces for debugging
          let totalVertices = 0;
          let totalFaces = 0;
          
          // Store geometries and materials, and set opacity
          object.traverse(child => {
            if (child.isMesh) {
              if (child.geometry) {
                geometriesRef.current.push(child.geometry);
                
                // Fix NaN values in position attributes that cause bounding sphere errors
                if (child.geometry.attributes && child.geometry.attributes.position) {
                  const positions = child.geometry.attributes.position;
                  let hasNaN = false;
                  let nanCount = 0;
                  
                  // Check for and fix NaN values
                  for (let i = 0; i < positions.array.length; i++) {
                    if (isNaN(positions.array[i]) || !isFinite(positions.array[i])) {
                      positions.array[i] = 0; // Replace NaN with 0
                      hasNaN = true;
                      nanCount++;
                    }
                  }
                  
                  if (hasNaN) {
                    console.warn(`Fixed ${nanCount} NaN values in OBJ geometry positions`);
                    positions.needsUpdate = true;
                  }
                  
                  // Try to safely compute bounding sphere
                  try {
                    child.geometry.computeBoundingSphere();
                    
                    // Check if computation resulted in NaN radius
                    if (isNaN(child.geometry.boundingSphere.radius)) {
                      throw new Error("Computed radius is NaN");
                    }
                  } catch (err) {
                    console.warn("Error computing bounding sphere, creating fallback:", err);
                    
                    // Create fallback bounding sphere based on geometry extent
                    const box = new THREE.Box3();
                    box.setFromBufferAttribute(positions);
                    
                    const center = new THREE.Vector3();
                    box.getCenter(center);
                    
                    // Use diagonal of box as sphere radius
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    const radius = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z) / 2;
                    
                    child.geometry.boundingSphere = new THREE.Sphere(center, isFinite(radius) ? radius : 10);
                    console.log(`Created fallback bounding sphere with radius ${radius}`);
                  }
                  
                  // Count vertices
                  totalVertices += positions.count;
                }
                
                // Count faces for indexed geometries
                if (child.geometry.index) {
                  totalFaces += child.geometry.index.count / 3;
                } else if (child.geometry.attributes.position) {
                  totalFaces += child.geometry.attributes.position.count / 3;
                }
              }
              
              // Handle materials
              if (child.material) {
                // Apply opacity to all materials
                if (Array.isArray(child.material)) {
                  child.material.forEach(mat => {
                    materialsRef.current.push(mat);
                    mat.transparent = opacity < 1;
                    mat.opacity = opacity;
                    mat.side = THREE.DoubleSide; // Better visibility
                    mat.needsUpdate = true;
                  });
                } else {
                  materialsRef.current.push(child.material);
                  child.material.transparent = opacity < 1;
                  child.material.opacity = opacity;
                  child.material.side = THREE.DoubleSide;
                  child.material.needsUpdate = true;
                }
              }
              
              // Enable shadows
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          console.log(`OBJ model processed: ${totalVertices} vertices, ${totalFaces} triangles`);
          
          // Update debug info
          setDebugInfo(prev => ({
            ...prev,
            totalVertices,
            totalFaces,
            meshCount: object.children.filter(c => c.isMesh).length,
            loadCompleted: new Date().toISOString()
          }));
          
          return object;
        };
      } else if (modelFormat === 'ply') {
        // PLY format - Create a new loader instance each time
        loader = new PLYLoader();
        console.log("Created new PLYLoader instance");
        
        processResult = (geometry) => {
          console.log("PLY geometry loaded successfully:", geometry);
          
          if (!geometry || !geometry.attributes || !geometry.attributes.position) {
            throw new Error("PLY file contains no valid geometry");
          }
          
          try {
            // Compute vertex normals if they don't exist
            if (!geometry.attributes.normal) {
              geometry.computeVertexNormals();
            }
            
            // Fix for NaN values in positions that cause bounding sphere errors
            const positions = geometry.attributes.position.array;
            let hasNaN = false;
            let nanCount = 0;
            
            // More thorough NaN check and fix
            for (let i = 0; i < positions.length; i++) {
              if (isNaN(positions[i]) || !isFinite(positions[i])) {
                positions[i] = 0;
                hasNaN = true;
                nanCount++;
              }
            }
            
            if (hasNaN) {
              console.warn(`Fixed ${nanCount} NaN/infinite values in PLY geometry positions`);
              geometry.attributes.position.needsUpdate = true;
            }
            
            // Compute bounding box and sphere for proper rendering
            try {
              geometry.computeBoundingBox();
            } catch (e) {
              console.warn("Error computing bounding box, creating default", e);
              geometry.boundingBox = new THREE.Box3(
                new THREE.Vector3(-1, -1, -1),
                new THREE.Vector3(1, 1, 1)
              );
            }
            
            // Center geometry if it's not centered
            if (geometry.boundingBox) {
              const center = new THREE.Vector3();
              geometry.boundingBox.getCenter(center);
              if (center.length() > 0.01) { // If not already at origin
                console.log("Centering PLY geometry at origin");
                const positionAttr = geometry.attributes.position;
                for (let i = 0; i < positionAttr.count; i++) {
                  const x = positionAttr.getX(i) - center.x;
                  const y = positionAttr.getY(i) - center.y;
                  const z = positionAttr.getZ(i) - center.z;
                  positionAttr.setXYZ(i, x, y, z);
                }
                positionAttr.needsUpdate = true;
                // Recompute after centering
                try {
                  geometry.computeBoundingBox();
                } catch (e) {
                  console.warn("Error recomputing bounding box after centering", e);
                }
              }
            }
            
            // Safely compute bounding sphere with multiple fallbacks
            try {
              geometry.computeBoundingSphere();
            } catch (e) {
              console.warn("Error computing bounding sphere, trying alternative method", e);
              
              try {
                // Alternative method to compute bounding sphere
                if (geometry.boundingBox) {
                  const boundingBox = geometry.boundingBox;
                  const center = new THREE.Vector3();
                  boundingBox.getCenter(center);
                  
                  // Calculate radius from bounding box
                  const maxRadiusSq = Math.max(
                    boundingBox.max.x - center.x,
                    boundingBox.max.y - center.y,
                    boundingBox.max.z - center.z
                  );
                  const radius = Math.sqrt(maxRadiusSq * maxRadiusSq * 3);
                  
                  geometry.boundingSphere = new THREE.Sphere(center, radius);
                  console.log("Created bounding sphere from bounding box", geometry.boundingSphere);
                } else {
                  // Last resort fallback
                  console.warn("No bounding box available, using default sphere");
                  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
                }
              } catch (fallbackError) {
                console.error("All bounding sphere computation methods failed", fallbackError);
                geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
              }
            }
            
            // Create material
            const hasVertexColors = !!geometry.attributes.color;
            const material = new THREE.MeshStandardMaterial({
              vertexColors: hasVertexColors,
              flatShading: true,
              side: THREE.DoubleSide,
              transparent: opacity < 1,
              opacity: opacity,
              roughness: 0.8,
              metalness: 0.2
            });
            
            // If no vertex colors, use a default color
            if (!hasVertexColors) {
              material.color.set(0x8866ff);
            }
            
            materialsRef.current.push(material);
            geometriesRef.current.push(geometry);
            
            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(scale, scale, scale);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Add a wireframe overlay for better visualization of the geometry
            if (geometry.index && geometry.index.count > 0) {
              const wireframeMaterial = new THREE.LineBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.15,
                depthTest: true
              });

              // If we have too many edges, skip wireframe for performance
              if (geometry.index.count < 500000) {
                const wireframe = new THREE.LineSegments(
                  new THREE.WireframeGeometry(geometry),
                  wireframeMaterial
                );
                mesh.add(wireframe);
              } else {
                console.log("Skipping wireframe for large geometry (performance optimization)");
              }
            }
            
            // For PLY, we need to create a group to match OBJ output
            const group = new THREE.Group();
            group.add(mesh);
            
            // Update debug info
            setDebugInfo(prev => ({
              ...prev,
              totalVertices: geometry.attributes.position.count,
              totalFaces: geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3,
              hasVertexColors,
              loadCompleted: new Date().toISOString()
            }));
            
            return group;
          } catch (e) {
            console.error("Error processing PLY geometry:", e);
            throw new Error(`Failed to process PLY: ${e.message}`);
          }
        };
      } else {
        throw new Error(`Unsupported model format: ${modelFormat || 'unknown'}`);
      }
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Progress handler with additional debugging
      const onProgress = (event) => {
        if (event.lengthComputable) {
          const progressPercent = Math.round((event.loaded / event.total) * 100);
          setProgress(progressPercent);
          console.log(`Loading progress: ${progressPercent}%, Loaded: ${(event.loaded / 1024 / 1024).toFixed(2)}MB of ${(event.total / 1024 / 1024).toFixed(2)}MB`);
          
          // Reset timeout on progress
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          // Set a new timeout in case loading stalls
          timeoutRef.current = setTimeout(() => {
            console.warn('Model loading might be stuck - no progress updates');
            setLoadingTimeout(true);
          }, 30000); // 30 second timeout between progress updates
        }
      };
      
      // Error handler with enhanced logging
      const onLoadError = (err) => {
        console.error('Error loading model:', err);
        setError(err.message || 'Error loading model');
        setLoading(false);
        
        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        onError(err);
        
        // Update debug info with error
        setDebugInfo(prev => ({
          ...prev,
          error: err.message || 'Unknown error',
          loadFailed: new Date().toISOString()
        }));
      };
      
      // Set correct path to ensure relative resources like MTL files can be found
      try {
        // Check if blob URL
        if (cleanUrl.startsWith('blob:')) {
          // For blob URLs, we can't set a path
          loader.setPath('');
          console.log("Using empty path for blob URL");
        } else {
          // Extract path from URL for relative resources
          const urlPath = new URL(cleanUrl, window.location.href).pathname;
          const lastSlashIndex = urlPath.lastIndexOf('/');
          if (lastSlashIndex > 0) {
            const path = urlPath.substring(0, lastSlashIndex + 1);
            loader.setPath(path);
            console.log(`Set loader path to: ${path}`);
          } else {
            console.log("No path component found in URL");
            loader.setPath('');
          }
        }
      } catch (pathErr) {
        console.warn('Error setting loader path:', pathErr);
        // Fallback to simple string parsing
        try {
          const lastSlashIndex = cleanUrl.lastIndexOf('/');
          if (lastSlashIndex > 0) {
            const path = cleanUrl.substring(0, lastSlashIndex + 1);
            loader.setPath(path);
            console.log(`Fallback: Set loader path to: ${path}`);
          }
        } catch (fallbackErr) {
          console.error('Fallback path setting failed:', fallbackErr);
        }
      }
      
      // Set more detailed logging and diagnostic information
      console.log(`Starting OBJ loading process for ${cleanUrl.substring(0, 50)}...`);

      // Calculate estimated file size from metadata or use a large default for OBJ files
      let estimatedFileSize = 50 * 1024 * 1024; // Default to 50MB for safety
      try {
        // Try to get file size from URL parameters
        if (url.includes('?')) {
          const params = new URLSearchParams(url.split('?')[1]);
          const sizeParam = params.get('size');
          if (sizeParam) {
            estimatedFileSize = parseInt(sizeParam, 10) || 50 * 1024 * 1024;
          }
          
          // Also check for filename to estimate size from extension
          const filename = params.get('filename');
          if (filename && filename.toLowerCase().includes('.obj')) {
            // For OBJ files, ensure we have a generous default
            estimatedFileSize = Math.max(estimatedFileSize, 50 * 1024 * 1024);
          }
        }
        
        console.log(`Estimated file size: ${(estimatedFileSize / (1024 * 1024)).toFixed(2)}MB`);
      } catch (e) {
        console.warn("Error estimating file size:", e);
      }

      // Add a special check and preprocessing for OBJ files
      if (modelFormat === 'obj') {
        try {
          // For OBJ files, always use our robust custom loading approach
          // This is much more resilient to malformed or problematic OBJ files
          console.log(`Using robust custom loading for OBJ file`);
          
          // Try a streaming approach for all OBJ files
          fetch(cleanUrl)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Network error: ${response.status} ${response.statusText}`);
              }
              
              console.log(`Got response from server, beginning to process OBJ file`);
              // Get the size from the response if available
              const contentLength = response.headers.get('content-length');
              if (contentLength) {
                console.log(`Server reports file size: ${(parseInt(contentLength, 10) / (1024 * 1024)).toFixed(2)}MB`);
                estimatedFileSize = parseInt(contentLength, 10);
              }
              
              return response.text();
            })
            .then(text => {
              console.log(`OBJ file fully downloaded, length: ${text.length} chars`);
              
              try {
                // Check for common OBJ file issues
                if (text.length < 100) {
                  throw new Error("OBJ file too small, likely corrupted");
                }
                
                // Skip the standard parser and go straight to our custom one
                // This is more reliable for problematic files
                console.log("Using robust custom OBJ parser");
                
                // Simple custom parser that's extremely tolerant of bad data
                const lines = text.split('\n');
                const vertices = [];
                const faces = [];
                
                console.log(`Processing OBJ with ${lines.length} lines`);
                
                // First pass: collect all vertices
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i].trim();
                  
                  // Report progress periodically
                  if (i % 100000 === 0) {
                    console.log(`Parsing OBJ file: ${Math.round((i / lines.length) * 100)}% complete`);
                    // Update progress in UI
                    setProgress(Math.min(90, Math.round((i / lines.length) * 90)));
                  }
                  
                  // Only process vertex lines
                  if (line.startsWith('v ')) {
                    const parts = line.split(/\s+/);
                    if (parts.length >= 4) {
                      // Extract and validate x, y, z coordinates
                      const x = parseFloat(parts[1]);
                      const y = parseFloat(parts[2]);
                      const z = parseFloat(parts[3]);
                      
                      // Only add valid coordinates (reject NaN and infinity)
                      if (!isNaN(x) && !isNaN(y) && !isNaN(z) && 
                          isFinite(x) && isFinite(y) && isFinite(z)) {
                        vertices.push(x, y, z);
                      }
                    }
                  }
                }
                
                console.log(`Found ${vertices.length / 3} valid vertices`);
                
                if (vertices.length === 0) {
                  throw new Error("No valid vertices found in OBJ file");
                }
                
                // Second pass: collect faces - only process if we have reasonable number of vertices
                if (vertices.length / 3 > 3) {
                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    // Report progress periodically
                    if (i % 100000 === 0) {
                      console.log(`Parsing faces: ${Math.round((i / lines.length) * 100)}% complete`);
                      // Update progress in UI
                      setProgress(Math.min(95, 90 + Math.round((i / lines.length) * 5)));
                    }
                    
                    if (line.startsWith('f ')) {
                      const parts = line.split(/\s+/);
                      if (parts.length >= 4) {
                        try {
                          // Extract vertex indices - handle various OBJ face formats
                          const getVertexIndex = (str) => {
                            // Handle vertex format variants: v, v/vt, v/vt/vn, v//vn
                            const indexStr = str.split('/')[0];
                            const index = parseInt(indexStr, 10);
                            
                            if (isNaN(index)) return -1;
                            
                            // OBJ indices are 1-based, convert to 0-based
                            return index > 0 ? index - 1 : index + vertices.length / 3 - 1;
                          };
                          
                          // Parse the face indices
                          const indices = [];
                          for (let j = 1; j < parts.length; j++) {
                            const index = getVertexIndex(parts[j]);
                            if (index >= 0 && index < vertices.length / 3) {
                              indices.push(index);
                            }
                          }
                          
                          // Create triangles from the face (handle polygons)
                          if (indices.length >= 3) {
                            // Triangulate the face
                            for (let j = 0; j < indices.length - 2; j++) {
                              faces.push(indices[0], indices[j+1], indices[j+2]);
                            }
                          }
                        } catch (e) {
                          // Silently ignore bad faces
                        }
                      }
                    }
                  }
                } else {
                  console.warn("Too few vertices found, skipping face parsing");
                }
                
                console.log(`Found ${faces.length / 3} valid triangles`);
                
                // Create a Three.js geometry
                const geometry = new THREE.BufferGeometry();
                
                // Add vertices
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                
                // Add faces if we found any
                if (faces.length > 0) {
                  geometry.setIndex(faces);
                }
                
                // Compute vertex normals
                geometry.computeVertexNormals();
                
                // Fix geometry bounds
                try {
                  geometry.computeBoundingBox();
                  geometry.computeBoundingSphere();
                  
                  // Verify bounding sphere is valid
                  if (isNaN(geometry.boundingSphere.radius)) {
                    console.warn("Invalid bounding sphere radius, creating a fallback");
                    
                    // Create a fallback bounding sphere based on bounding box
                    const boundingBox = geometry.boundingBox;
                    const center = new THREE.Vector3();
                    boundingBox.getCenter(center);
                    
                    // Use diagonal length as radius
                    const size = new THREE.Vector3();
                    boundingBox.getSize(size);
                    let radius = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z) / 2;
                    
                    // Ensure radius is valid
                    if (isNaN(radius) || !isFinite(radius) || radius <= 0) {
                      radius = 10; // Default fallback
                    }
                    
                    geometry.boundingSphere = new THREE.Sphere(center, radius);
                  }
                } catch (e) {
                  console.warn("Error computing geometry bounds:", e);
                  
                  // Create a default bounding sphere
                  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
                  
                  // Create a default bounding box
                  geometry.boundingBox = new THREE.Box3(
                    new THREE.Vector3(-10, -10, -10),
                    new THREE.Vector3(10, 10, 10)
                  );
                }
                
                // Create a basic material
                const material = new THREE.MeshStandardMaterial({
                  color: 0x8866ff,
                  flatShading: true,
                  side: THREE.DoubleSide,
                  transparent: opacity < 1,
                  opacity: opacity
                });
                
                // Create a mesh and add to a group
                const mesh = new THREE.Mesh(geometry, material);
                const group = new THREE.Group();
                group.add(mesh);
                
                // Enable shadows
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // Process using our standard handler
                const processedModel = processResult(group);
                setModel(processedModel);
                setLoading(false);
                setLoadingTimeout(false);
                
                // Call the onLoad callback
                onLoad(processedModel);
                
                console.log('Model loading completed with robust custom parser');
              } catch (parseError) {
                console.error("Error in custom OBJ parser:", parseError);
                
                // Fall back to a simple primitive if all else fails
                try {
                  console.log("Creating fallback model");
                  
                  // Create a simple box as fallback
                  const geometry = new THREE.BoxGeometry(1, 1, 1);
                  const material = new THREE.MeshStandardMaterial({
                    color: 0xff0000,
                    wireframe: true
                  });
                  
                  const mesh = new THREE.Mesh(geometry, material);
                  const group = new THREE.Group();
                  group.add(mesh);
                  
                  // Add a text label to indicate error
                  const textGeometry = new THREE.PlaneGeometry(2, 0.5);
                  const textMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide
                  });
                  
                  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                  textMesh.position.set(0, 1.5, 0);
                  group.add(textMesh);
                  
                  // Process model
                  setModel(group);
                  setLoading(false);
                  setLoadingTimeout(false);
                  
                  // Call onLoad with fallback model
                  onLoad(group);
                  
                  // Also report the error
                  setError("Failed to load model: " + parseError.message);
                  onError(parseError);
                } catch (fallbackError) {
                  console.error("Even fallback creation failed:", fallbackError);
                  setError("Failed to load model: " + fallbackError.message);
                  setLoading(false);
                  onError(fallbackError);
                }
              }
            })
            .catch(networkError => {
              console.error("Network error loading OBJ file:", networkError);
              setError(`Network error: ${networkError.message}`);
              setLoading(false);
              onError(networkError);
            });
          
          // Return early since we're handling loading with fetch
          return;
        } catch (preprocessingError) {
          console.warn("Error in OBJ preprocessing:", preprocessingError);
          // Continue with standard loading
        }
      }
      
      // Standard loading approach if special handling wasn't used
      loader.load(
        cleanUrl,
        (result) => {
          try {
            // Clear timeout
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            
            // Process the loaded model
            const processedModel = processResult(result);
            setModel(processedModel);
            setLoading(false);
            setLoadingTimeout(false);
            
            // Call the onLoad callback
            onLoad(processedModel);
            
            console.log('Model loading completed successfully via standard loader');
          } catch (processError) {
            console.error('Error processing loaded model:', processError);
            setError(processError.message || 'Error processing model after load');
            setLoading(false);
            onError(processError);
          }
        },
        onProgress,
        onLoadError
      );
    } catch (initError) {
      console.error('Error initializing model loader:', initError);
      setError(initError.message || 'Error initializing model loader');
      setLoading(false);
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      onError(initError);
    }
    
    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [url, format, scale, opacity, onLoad, onError]);
  
  // Render timeout warning
  const renderLoadingTimeout = () => {
    if (!loadingTimeout) return null;
    
    return (
      <Html center>
        <div style={{ 
          background: 'rgba(255, 160, 0, 0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '5px',
          maxWidth: '300px',
          textAlign: 'center',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)'
        }}>
          <h3 style={{ marginTop: 0 }}>Loading Taking Longer Than Expected</h3>
          <p>The model may be very large or there might be issues with the file. Loading will continue in the background.</p>
          <p>Progress: {progress}%</p>
        </div>
      </Html>
    );
  };
  
  // Update model position and rotation 
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...position);
      groupRef.current.rotation.set(...rotation);
    }
  }, [position, rotation]);
  
  // Render the model
  if (error) {
    return (
      <group position={position} rotation={rotation}>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="red" wireframe />
        </mesh>
        <Html center>
          <div style={{ 
            background: 'rgba(255,0,0,0.8)', 
            color: 'white', 
            padding: '10px', 
            borderRadius: '5px',
            maxWidth: '250px',
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              Error Loading Model
            </div>
            <div style={{ fontSize: '12px' }}>
              {error}
            </div>
          </div>
        </Html>
      </group>
    );
  }
  
  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {model ? (
        <primitive object={model} scale={[scale, scale, scale]} />
      ) : loading ? (
        <>
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#4444ff" wireframe />
          </mesh>
          <Html center>
            <div style={{ 
              background: 'rgba(0,0,0,0.7)', 
              color: 'white', 
              padding: '10px',
              borderRadius: '5px',
              textAlign: 'center'
            }}>
              <div>Loading Model: {Math.round(progress)}%</div>
            </div>
          </Html>
          {renderLoadingTimeout()}
        </>
      ) : null}
    </group>
  );
};

export default ModelLoader;