import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Select, useSelect, Html } from '@react-three/drei';
import { useWebGLContextHandler } from '../utils/ThreeContextRecovery';

/**
 * SimplePointCloud component that renders point clouds without requiring Potree
 * Works with PLY and PCD files through THREE.js native loaders
 * 
 * @param {object} props - Component props
 * @param {string} props.url - URL to the point cloud data
 * @param {string} props.format - Format of the point cloud ('ply', 'pcd', etc.)
 * @param {number} props.pointSize - Size of points
 * @param {number} props.opacity - Opacity of points
 * @param {array} props.position - Position of the point cloud [x, y, z]
 * @param {boolean} props.selectable - Whether the point cloud can be selected
 * @param {function} props.onSelect - Callback when the point cloud is selected
 */
const SimplePointCloud = ({
  url,
  format = 'auto',
  pointSize = 0.05,
  opacity = 1.0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color = '#ffffff',
  selectable = true,
  onSelect,
  onLoad,
  onError,
  onProgress,
  maxPoints = 100_000, // Reduced from 250,000
  ...props
}) => {
  const [points, setPoints] = useState(null);
  const [geometry, setGeometry] = useState(null);
  const [material, setMaterial] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boundingBox, setBoundingBox] = useState(null);
  const [contextLost, setContextLost] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [lastRecoveryTime, setLastRecoveryTime] = useState(0);
  
  const groupRef = useRef();
  const pointsRef = useRef();
  
  // Get selection state from drei
  const selected = useSelect().indexOf(groupRef.current) > -1;
  
  // Add WebGL context loss handling
  useWebGLContextHandler(
    // Context loss handler
    (event) => {
      console.warn("WebGL context lost in SimplePointCloud component:", event);
      setContextLost(true);
      
      // Hide point cloud to reduce GPU load
      if (groupRef.current) {
        groupRef.current.visible = false;
      }
      
      // Dispose resources to help with recovery
      if (geometry) {
        geometry.dispose();
      }
      if (material) {
        material.dispose();
      }
    },
    // Context restored handler
    (event) => {
      console.log("WebGL context restored in SimplePointCloud");
      setContextLost(false);
      
      // Wait before trying to restore/reload
      setTimeout(() => {
        // Only attempt reload if we haven't exceeded the limit
        if (recoveryAttempts < 3) {
          setLoading(true);
          loadPointCloud(url, format, recoveryAttempts + 1);
        } else {
          setError("Maximum recovery attempts reached. Please reload the page.");
        }
      }, 5000); // Wait 5 seconds before attempting reload
    }
  );
  
  // Function to load the point cloud
  const loadPointCloud = (url, format, retryCount = 0) => {
    if (!url) return;
    
    // Check if we've tried to reload too recently or too many times
    const currentTime = Date.now();
    const cooldownPeriod = 10000; // 10 seconds cooldown between loads
    const maxRecoveryAttempts = 3; // Maximum number of automatic recoveries
    
    if (retryCount > 0) {
      if (currentTime - lastRecoveryTime < cooldownPeriod) {
        console.warn(`Skipping reload attempt - within cooldown period (${Math.round((currentTime - lastRecoveryTime) / 1000)}s < ${cooldownPeriod / 1000}s)`);
        setError("Too many reload attempts. Please try manually reloading the page.");
        setLoading(false);
        
        if (onError) onError(new Error("Too many reload attempts"));
        return;
      }
      
      if (recoveryAttempts >= maxRecoveryAttempts) {
        console.warn(`Maximum recovery attempts reached (${recoveryAttempts}). Please reload the page.`);
        setError("Maximum recovery attempts reached. Please reload the page.");
        setLoading(false);
        
        if (onError) onError(new Error("Maximum recovery attempts reached"));
        return;
      }
      
      // Update recovery tracking
      setRecoveryAttempts(prev => prev + 1);
      setLastRecoveryTime(currentTime);
    }
    
    let fileFormat = format;
    if (format === 'auto') {
      // Try to determine format from URL extension
      const extension = url.split('.').pop().toLowerCase();
      fileFormat = extension;
    }
    
    console.log(`Attempting to load point cloud with format: ${fileFormat}`);
    
    // Create appropriate loader based on format
    let loader;
    try {
      switch (fileFormat) {
        case 'ply':
          const { PLYLoader } = require('three/examples/jsm/loaders/PLYLoader');
          loader = new PLYLoader();
          break;
        case 'pcd':
          const { PCDLoader } = require('three/examples/jsm/loaders/PCDLoader');
          loader = new PCDLoader();
          break;
        default:
          // If format is not directly supported, try PLY as a default fallback
          console.warn(`Format '${fileFormat}' not directly supported. Attempting to load as PLY.`);
          const { PLYLoader: FallbackLoader } = require('three/examples/jsm/loaders/PLYLoader');
          loader = new FallbackLoader();
          fileFormat = 'ply'; // Force format to PLY for loading attempt
      }
      
      setLoading(true);
      
      // Track load start time
      const loadStartTime = performance.now();
      
      // Load the point cloud
      loader.load(
        url,
        (loadedGeometry) => {
          console.log(`Loaded ${fileFormat} point cloud:`, loadedGeometry);
          
          // Check if there are too many points and downsample if needed
          const effectiveMaxPoints = retryCount > 0 ? maxPoints / 2 : maxPoints; // Even fewer points on retry
          
          if (loadedGeometry.attributes.position.count > effectiveMaxPoints) {
            console.warn(`Point cloud has ${loadedGeometry.attributes.position.count} points, which exceeds the limit of ${effectiveMaxPoints}. Downsampling.`);
            const decimatedGeometry = downsampleGeometry(loadedGeometry, effectiveMaxPoints);
            loadedGeometry.dispose();
            loadedGeometry = decimatedGeometry;
          }
          
          // Create material with more conservative settings
          const newMaterial = new THREE.PointsMaterial({
            size: pointSize * (retryCount > 0 ? 2 : 1), // Increase point size on retry
            opacity: opacity,
            transparent: opacity < 1,
            vertexColors: true,
            sizeAttenuation: true,
            precision: 'lowp', // Use low precision for better performance
            depthWrite: true,
            depthTest: true
          });
          
          // If no vertex colors, use specified color
          if (!loadedGeometry.attributes.color) {
            newMaterial.vertexColors = false;
            newMaterial.color = new THREE.Color(color);
          }
          
          setGeometry(loadedGeometry);
          setMaterial(newMaterial);
          
          // Create points
          const pointsObject = new THREE.Points(loadedGeometry, newMaterial);
          setPoints(pointsObject);
          
          // Calculate bounding box
          const box = new THREE.Box3().setFromObject(pointsObject);
          setBoundingBox(box);
          
          setLoading(false);
          
          // Report success to parent component
          if (onLoad) {
            const loadTime = performance.now() - loadStartTime;
            onLoad({
              success: true,
              pointCount: loadedGeometry.attributes.position.count,
              format: fileFormat,
              loadTime: loadTime,
              boundingBox: box,
              isSimplePointCloud: true
            });
          }
        },
        // Progress callback
        (xhr) => {
          const progressValue = xhr.loaded / (xhr.total || xhr.loaded + 1);
          console.log(`${fileFormat} ${(progressValue * 100).toFixed(2)}% loaded`);
          if (onProgress) onProgress(progressValue);
        },
        // Error callback
        (err) => {
          console.error(`Error loading ${fileFormat} point cloud:`, err);
          const errorMessage = `Error loading point cloud: ${err.message || 'Unknown error'}`;
          setError(errorMessage);
          setLoading(false);
          
          // If this was an attempt with a non-native format, try a different format
          if (fileFormat !== format && format !== 'auto' && format !== 'ply' && format !== 'pcd') {
            console.warn(`Failed to load as ${fileFormat}, attempting to create a placeholder visualization`);
            createPlaceholderPointCloud();
          } else if (onError) {
            onError(new Error(errorMessage));
          }
        }
      );
    } catch (err) {
      console.error('Error setting up point cloud loader:', err);
      const errorMessage = `Failed to initialize point cloud loader: ${err.message || 'Unknown error'}`;
      setError(errorMessage);
      setLoading(false);
      
      // Create a placeholder for unsupported formats
      if (format !== 'ply' && format !== 'pcd') {
        console.warn('Creating placeholder visualization for unsupported format');
        createPlaceholderPointCloud();
      } else if (onError) {
        onError(new Error(errorMessage));
      }
    }
  };
  
  // Create a placeholder point cloud for unsupported formats
  const createPlaceholderPointCloud = () => {
    console.log('Creating placeholder point cloud visualization');
    
    // Special handling for OBJ files
    if (format === 'obj') {
      console.log(
        '%c🛈 OBJ files need to be loaded through the ModelLoader component %c\n' +
        'Point cloud visualization is for PLY/PCD formats. For OBJ/FBX/GLTF models, use:\n' +
        '- "Import 3D Model" tool instead of "Import Point Cloud"\n' +
        '- Or convert your OBJ to PLY format for point cloud visualization',
        'background: #4285F4; color: white; font-size: 12px; padding: 4px 8px; border-radius: 4px;',
        'font-size: 11px; color: #666;'
      );
    }
    
    // Create a more interesting placeholder with some organized points
    const placeholderGeometry = new THREE.BufferGeometry();
    const numPoints = 8000; // Increase point count for better visualization
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);
    
    // Create multiple shapes to help visualize 3D space
    // 1. Create a sphere of points (1/3 of points)
    const spherePoints = Math.floor(numPoints / 3);
    for (let i = 0; i < spherePoints; i++) {
      // Use spherical coordinates for even distribution
      const theta = Math.random() * Math.PI * 2; // around the equator
      const phi = Math.acos(2 * Math.random() - 1); // from pole to pole
      const radius = 5; // sphere radius
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      
      // Blue gradient colors for sphere
      colors[i * 3] = 0.2 + 0.3 * Math.cos(phi); // R
      colors[i * 3 + 1] = 0.2 + 0.3 * Math.sin(theta); // G
      colors[i * 3 + 2] = 0.5 + 0.5 * Math.sin(phi); // B (more blue)
    }
    
    // 2. Create a grid on the ground plane (1/3 of points)
    const gridPoints = Math.floor(numPoints / 3);
    const gridSize = 10;
    const gridDensity = Math.sqrt(gridPoints);
    const gridStep = gridSize / gridDensity;
    
    for (let i = 0; i < gridPoints; i++) {
      const x = (i % gridDensity) * gridStep - gridSize/2;
      const z = Math.floor(i / gridDensity) * gridStep - gridSize/2;
      
      positions[(spherePoints + i) * 3] = x;
      positions[(spherePoints + i) * 3 + 1] = -5; // Place grid below the sphere
      positions[(spherePoints + i) * 3 + 2] = z;
      
      // Green-ish colors for grid
      colors[(spherePoints + i) * 3] = 0.2;
      colors[(spherePoints + i) * 3 + 1] = 0.6 + 0.4 * (x / gridSize + 0.5);
      colors[(spherePoints + i) * 3 + 2] = 0.2;
    }
    
    // 3. Create a 3D axis visualization with the remaining points
    const remainingPoints = numPoints - spherePoints - gridPoints;
    const axisLength = 8;
    const pointsPerAxis = Math.floor(remainingPoints / 3);
    
    // X axis (red)
    for (let i = 0; i < pointsPerAxis; i++) {
      const t = (i / pointsPerAxis) * axisLength;
      const baseIndex = (spherePoints + gridPoints + i) * 3;
      
      positions[baseIndex] = t - axisLength/2;
      positions[baseIndex + 1] = 0;
      positions[baseIndex + 2] = 0;
      
      colors[baseIndex] = 1.0; // Red
      colors[baseIndex + 1] = 0.2;
      colors[baseIndex + 2] = 0.2;
    }
    
    // Y axis (green)
    for (let i = 0; i < pointsPerAxis; i++) {
      const t = (i / pointsPerAxis) * axisLength;
      const baseIndex = (spherePoints + gridPoints + pointsPerAxis + i) * 3;
      
      positions[baseIndex] = 0;
      positions[baseIndex + 1] = t - axisLength/2;
      positions[baseIndex + 2] = 0;
      
      colors[baseIndex] = 0.2;
      colors[baseIndex + 1] = 1.0; // Green
      colors[baseIndex + 2] = 0.2;
    }
    
    // Z axis (blue)
    for (let i = 0; i < pointsPerAxis; i++) {
      const t = (i / pointsPerAxis) * axisLength;
      const baseIndex = (spherePoints + gridPoints + 2 * pointsPerAxis + i) * 3;
      
      positions[baseIndex] = 0;
      positions[baseIndex + 1] = 0;
      positions[baseIndex + 2] = t - axisLength/2;
      
      colors[baseIndex] = 0.2;
      colors[baseIndex + 1] = 0.2;
      colors[baseIndex + 2] = 1.0; // Blue
    }
    
    placeholderGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    placeholderGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create material
    const placeholderMaterial = new THREE.PointsMaterial({
      size: pointSize * 3,
      vertexColors: true,
      opacity: 0.8,
      transparent: true,
      sizeAttenuation: true
    });
    
    setGeometry(placeholderGeometry);
    setMaterial(placeholderMaterial);
    
    // Create points
    const placeholderPoints = new THREE.Points(placeholderGeometry, placeholderMaterial);
    setPoints(placeholderPoints);
    
    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(placeholderPoints);
    setBoundingBox(box);
    
    setLoading(false);
    setError(null);
    
    // Report success with placeholder to parent component
    if (onLoad) {
      onLoad({
        success: true,
        pointCount: numPoints,
        format: format,
        isPlaceholder: true,
        isSimplePointCloud: true,
        boundingBox: box,
        message: "Using placeholder visualization - original format not directly supported"
      });
    }
  };
  
  // Simple point cloud downsampling function
  const downsampleGeometry = (geometry, targetCount) => {
    const sourcePositions = geometry.attributes.position;
    const sourceColors = geometry.attributes.color;
    const totalPoints = sourcePositions.count;
    
    // Calculate sampling rate
    const samplingRate = Math.max(1, Math.floor(totalPoints / targetCount));
    const sampledCount = Math.floor(totalPoints / samplingRate);
    
    // Create new arrays for downsampled points
    const newPositions = new Float32Array(sampledCount * 3);
    const hasColors = sourceColors !== undefined;
    let newColors = null;
    if (hasColors) {
      newColors = new Float32Array(sampledCount * 3);
    }
    
    // Sample the points
    let targetIndex = 0;
    for (let i = 0; i < totalPoints; i += samplingRate) {
      if (targetIndex >= sampledCount) break;
      
      // Copy position
      newPositions[targetIndex * 3] = sourcePositions.getX(i);
      newPositions[targetIndex * 3 + 1] = sourcePositions.getY(i);
      newPositions[targetIndex * 3 + 2] = sourcePositions.getZ(i);
      
      // Copy color if available
      if (hasColors) {
        newColors[targetIndex * 3] = sourceColors.getX(i);
        newColors[targetIndex * 3 + 1] = sourceColors.getY(i);
        newColors[targetIndex * 3 + 2] = sourceColors.getZ(i);
      }
      
      targetIndex++;
    }
    
    // Create new geometry with downsampled points
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    if (hasColors) {
      newGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
    }
    
    console.log(`Downsampled point cloud from ${totalPoints} to ${sampledCount} points`);
    return newGeometry;
  };
  
  // Initial load
  useEffect(() => {
    loadPointCloud(url, format);
    
    return () => {
      // Cleanup
      if (geometry) {
        geometry.dispose();
      }
      if (material) {
        material.dispose();
      }
    };
  }, [url, format]);
  
  // Update point size and opacity when props change
  useEffect(() => {
    if (material) {
      material.size = pointSize;
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    }
  }, [pointSize, opacity, material]);
  
  // Handle selection
  useEffect(() => {
    if (selected && onSelect) {
      onSelect(groupRef.current);
    }
  }, [selected, onSelect]);
  
  // Show context loss message
  if (contextLost) {
    return (
      <mesh position={position}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="orange" wireframe />
        <Html center>
          <div style={{ 
            background: 'rgba(255,165,0,0.8)', 
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            textAlign: 'center'
          }}>
            WebGL context lost. Attempting recovery...
            <br/>
            <small>Attempt {recoveryAttempts + 1}/3</small>
          </div>
        </Html>
      </mesh>
    );
  }
  
  // Loading state
  if (loading) {
    return (
      <mesh position={position}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="blue" wireframe />
        <Html center>
          <div style={{ 
            background: 'rgba(0,0,255,0.7)', 
            color: 'white',
            padding: '10px',
            borderRadius: '5px'
          }}>
            Loading point cloud...
            {recoveryAttempts > 0 && (
              <div style={{fontSize: '0.8em', marginTop: '5px'}}>
                Recovery attempt: {recoveryAttempts}/3
              </div>
            )}
          </div>
        </Html>
      </mesh>
    );
  }
  
  // Error state
  if (error) {
    // Special error handling for different file formats
    let errorDetails = error;
    let errorActions = null;
    
    if (format === 'obj') {
      errorDetails = "OBJ files are not supported in point cloud mode";
      errorActions = (
        <div style={{marginTop: '10px', fontSize: '11px', lineHeight: '1.4'}}>
          <div>OBJ files should be loaded with the 3D Model importer instead.</div>
          <div>If you want to view this as a point cloud, convert it to PLY format first.</div>
        </div>
      );
    } else if (format === 'potree' || format === 'laz' || format === 'las') {
      errorDetails = `${format.toUpperCase()} files require the Potree library`;
      errorActions = (
        <div style={{marginTop: '10px', fontSize: '11px', lineHeight: '1.4'}}>
          <div>This server doesn't have Potree installed.</div>
          <div>For LiDAR visualization, convert to PLY or PCD format first.</div>
        </div>
      );
    }
    
    return (
      <mesh position={position}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="red" wireframe />
        <Html center>
          <div style={{ 
            background: 'rgba(255,0,0,0.7)', 
            color: 'white',
            padding: '15px',
            borderRadius: '5px',
            maxWidth: '300px',
            textAlign: 'center'
          }}>
            <div style={{fontWeight: 'bold', marginBottom: '8px'}}>
              {errorDetails}
            </div>
            
            {errorActions}
            
            {recoveryAttempts > 0 && (
              <div style={{marginTop: '15px'}}>
                <button 
                  onClick={() => {
                    setRecoveryAttempts(0);
                    setLastRecoveryTime(0);
                    loadPointCloud(url, format);
                  }}
                  style={{
                    background: '#fff',
                    color: '#333',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </Html>
      </mesh>
    );
  }
  
  // Render the point cloud
  return (
    <Select enabled={selectable}>
      <group 
        ref={groupRef} 
        position={position} 
        rotation={rotation}
        scale={scale}
        {...props}
      >
        {points && (
          <primitive ref={pointsRef} object={points} />
        )}
        {selected && boundingBox && (
          <mesh>
            <boxGeometry 
              args={[
                boundingBox.max.x - boundingBox.min.x,
                boundingBox.max.y - boundingBox.min.y,
                boundingBox.max.z - boundingBox.min.z
              ]} 
            />
            <meshBasicMaterial color="white" opacity={0.2} transparent wireframe />
          </mesh>
        )}
      </group>
    </Select>
  );
};

// Export SimplePointCloud as the default
export default SimplePointCloud;

// Also provide a named export for backwards compatibility
export const PointCloud = SimplePointCloud; 