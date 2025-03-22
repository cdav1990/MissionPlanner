import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { 
  loadLargeObjModel, 
  createOptimizedMaterial, 
  disposeModel, 
  detectPerformanceProfile 
} from '../utils/LargeModelLoader';

/**
 * Component for efficiently loading and displaying large 3D models
 * Handles LOD, chunking, and progressive loading for improved UX
 * 
 * @param {Object} props Component properties
 * @param {string} props.url URL or blob URL to load the model from
 * @param {string} props.format Model format (e.g., 'obj', 'ply')
 * @param {number} props.scale Scale factor for the model
 * @param {number} props.opacity Opacity for model rendering
 * @param {Array<number>} props.position Position [x, y, z]
 * @param {Array<number>} props.rotation Rotation [x, y, z] in radians
 * @param {Function} props.onLoad Callback when model is fully loaded
 * @param {Function} props.onError Callback when an error occurs
 * @param {Function} props.onProgress Progress callback during loading
 * @param {Object} props.materialOptions Options for the material
 */
const LargeModelViewer = ({
  url,
  format = 'obj',
  scale = 1,
  opacity = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  onLoad = () => {},
  onError = () => {},
  onProgress = () => {},
  materialOptions = {},
  showStats = false
}) => {
  // Refs and state
  const groupRef = useRef();
  const modelRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState('initializing');
  const [loadingStats, setLoadingStats] = useState(null);
  const [error, setError] = useState(null);
  const [modelStats, setModelStats] = useState(null);
  const mountedRef = useRef(true);
  
  // Track cleanup for unmount 
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Clean up model resources
      if (modelRef.current) {
        disposeModel(modelRef.current);
        modelRef.current = null;
      }
    };
  }, []);
  
  // Load the model whenever URL changes
  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      return;
    }
    
    // Reset state for new load
    setLoading(true);
    setLoadingProgress(0);
    setLoadingPhase('initializing');
    setLoadingStats(null);
    setError(null);
    setModelStats(null);
    
    // Clean up previous model if any
    if (modelRef.current) {
      disposeModel(modelRef.current);
      modelRef.current = null;
    }
    
    console.log(`LargeModelViewer: Loading model from ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
    
    // Create optimized material with settings
    const material = createOptimizedMaterial({
      color: 0x8899ff,
      wireframe: false,
      transparent: opacity < 1,
      opacity: opacity,
      flatShading: true,
      side: THREE.DoubleSide,
      ...materialOptions
    });
    
    // Start loading the model
    let loadStartTime = performance.now();
    let initialModelLoaded = false;
    let currentLodLevel = -1;
    
    loadLargeObjModel(url, {
      material,
      onProgress: (progress) => {
        if (!mountedRef.current) return;
        
        // Update loading stats
        setLoadingProgress(progress.progress * 100);
        setLoadingPhase(progress.phase);
        
        // Update loading stats for UI
        setLoadingStats(prev => ({
          ...prev,
          ...progress,
          timeElapsed: ((performance.now() - loadStartTime) / 1000).toFixed(1)
        }));
        
        // Call external progress handler
        onProgress(progress);
      },
      onLodLevelLoaded: (lodInfo) => {
        if (!mountedRef.current) return;
        
        // If we already have a higher level loaded, ignore lower levels
        if (lodInfo.level < currentLodLevel) return;
        
        currentLodLevel = lodInfo.level;
        
        // If this is the first model loaded, update our refs
        if (!initialModelLoaded) {
          initialModelLoaded = true;
          
          // Save the model to our scene
          if (groupRef.current) {
            // Remove any existing children first
            while (groupRef.current.children.length > 0) {
              const child = groupRef.current.children[0];
              groupRef.current.remove(child);
            }
            
            // Add the new model
            groupRef.current.add(lodInfo.model);
            modelRef.current = lodInfo.model;
          }
        }
        
        // Update stats for display
        setLoadingStats(prev => ({
          ...prev,
          currentLodLevel: lodInfo.level,
          triangles: lodInfo.triangles,
          quality: lodInfo.quality
        }));
      }
    })
    .then(result => {
      if (!mountedRef.current) return;
      
      // Update complete stats
      setModelStats({
        triangles: result.stats.triangles,
        vertices: result.stats.vertices,
        loadTime: result.stats.loadTime,
        fileSize: result.stats.fileSize,
        lodLevels: result.stats.lodLevels
      });
      
      // Stop loading state
      setLoading(false);
      
      // Replace any preview model with the final result
      if (groupRef.current) {
        // Remove any existing children first
        while (groupRef.current.children.length > 0) {
          const child = groupRef.current.children[0];
          groupRef.current.remove(child);
        }
        
        // Add the new model
        groupRef.current.add(result.model);
        modelRef.current = result.model;
      }
      
      // Call the load callback
      onLoad(result);
    })
    .catch(err => {
      if (!mountedRef.current) return;
      
      console.error('Error loading model:', err);
      setError(err.message || 'Failed to load model');
      setLoading(false);
      onError(err);
    });
  }, [url, format, opacity, onLoad, onError, onProgress, materialOptions]);
  
  // Update position and rotation
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...position);
      groupRef.current.rotation.set(...rotation);
      groupRef.current.scale.set(scale, scale, scale);
    }
  }, [position, rotation, scale]);
  
  // Update opacity when it changes
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.traverse(child => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.transparent = opacity < 1;
              mat.opacity = opacity;
              mat.needsUpdate = true;
            });
          } else {
            child.material.transparent = opacity < 1;
            child.material.opacity = opacity;
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }, [opacity]);
  
  // If error, show error message
  if (error) {
    return (
      <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
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
  
  // If loading, show progress
  if (loading) {
    return (
      <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
        <mesh visible={loadingProgress < 30}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#4488ff" wireframe />
        </mesh>
        <mesh visible={loadingProgress >= 30}>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshBasicMaterial color="#44aaff" wireframe={true} />
        </mesh>
        <Html center position={[0, 1.5, 0]}>
          <div style={{ 
            background: 'rgba(0,0,0,0.8)', 
            color: 'white', 
            padding: '10px', 
            borderRadius: '5px',
            width: '200px',
            textAlign: 'center'
          }}>
            <div>Loading {format.toUpperCase()} model...</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '3px' }}>
              {loadingPhase}
            </div>
            
            <div style={{ marginTop: '5px' }}>
              <div style={{ 
                width: '100%', 
                height: '8px', 
                background: '#222',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${loadingProgress}%`, 
                  height: '100%', 
                  background: '#4488ff',
                  transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>{Math.round(loadingProgress)}%</div>
            </div>
            
            {loadingStats && showStats && (
              <div style={{ 
                fontSize: '10px', 
                marginTop: '8px', 
                textAlign: 'left',
                opacity: 0.8,
                fontFamily: 'monospace'
              }}>
                {loadingStats.timeElapsed && <div>Time: {loadingStats.timeElapsed}s</div>}
                {loadingStats.currentLodLevel !== undefined && (
                  <div>LOD: {loadingStats.currentLodLevel} ({loadingStats.quality || 'loading'})</div>
                )}
                {loadingStats.triangles && <div>Tris: {(loadingStats.triangles / 1000).toFixed(1)}k</div>}
                {loadingStats.fileSize && (
                  <div>Size: {(loadingStats.fileSize / (1024 * 1024)).toFixed(1)} MB</div>
                )}
              </div>
            )}
          </div>
        </Html>
      </group>
    );
  }
  
  // Render the model
  return (
    <group 
      ref={groupRef} 
      position={position} 
      rotation={rotation} 
      scale={[scale, scale, scale]}
    >
      {/* Model will be added here when loaded */}
      
      {/* Stats overlay if enabled */}
      {showStats && modelStats && (
        <Html position={[0, 1.5, 0]} center>
          <div style={{ 
            background: 'rgba(0,0,0,0.6)', 
            color: 'white', 
            padding: '5px', 
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'monospace',
            pointerEvents: 'none'
          }}>
            <div>Triangles: {(modelStats.triangles / 1000).toFixed(1)}k</div>
            <div>Vertices: {(modelStats.vertices / 1000).toFixed(1)}k</div>
            <div>Load time: {(modelStats.loadTime / 1000).toFixed(2)}s</div>
            {modelStats.fileSize && (
              <div>File size: {(modelStats.fileSize / (1024 * 1024)).toFixed(2)} MB</div>
            )}
            {modelStats.lodLevels && modelStats.lodLevels.length > 0 && (
              <div>LOD levels: {modelStats.lodLevels.length}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default LargeModelViewer; 