import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useBounds, Html } from '@react-three/drei';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader';
import { LASLoader } from 'three/examples/jsm/loaders/LASLoader';
import { sanitizeGeometry, fixBoundingSphere } from '../utils/geometryUtils';

// Performance profiles for different hardware capabilities
const PERFORMANCE_PROFILES = {
  low: {
    maxPoints: 500_000,
    pointSize: 0.02,
    octreeDepth: 5,
    sizeAttenuation: true,
    highPrecision: false,
    edlStrength: 0.8,
    edlRadius: 1.2,
    updateInterval: 500,
    enableEDL: false,
    minNodePixelSize: 150
  },
  medium: {
    maxPoints: 2_000_000,
    pointSize: 0.01,
    octreeDepth: 6, 
    sizeAttenuation: true,
    highPrecision: true,
    edlStrength: 1.0,
    edlRadius: 1.4,
    updateInterval: 250,
    enableEDL: true,
    minNodePixelSize: 100
  },
  high: {
    maxPoints: 5_000_000,
    pointSize: 0.005,
    octreeDepth: 8,
    sizeAttenuation: true,
    highPrecision: true,
    edlStrength: 1.2,
    edlRadius: 1.4,
    updateInterval: 100,
    enableEDL: true,
    minNodePixelSize: 50
  },
  ultra: {
    maxPoints: 10_000_000,
    pointSize: 0.003,
    octreeDepth: 10,
    sizeAttenuation: true,
    highPrecision: true,
    edlStrength: 1.2,
    edlRadius: 1.4,
    updateInterval: 50,
    enableEDL: true,
    minNodePixelSize: 30
  }
};

// Check for Potree availability - global variable
const isPotreeAvailable = () => {
  return typeof window !== 'undefined' && 
         window.Potree && 
         window.Potree.PointCloudOctreeLoader;
};

// Helper function to detect system capabilities
const detectSystemCapabilities = () => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  
  // Default to medium if we can't detect capabilities
  if (!gl) return 'medium';
  
  // Simple benchmark based on available VRAM
  try {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
    const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : '';
    
    console.log('WebGL Renderer:', renderer);
    console.log('WebGL Vendor:', vendor);
    
    // Detect high-end GPUs
    if (
      /RTX\s*(20|30|40)/i.test(renderer) || 
      /Quadro/i.test(renderer) ||
      /Radeon(\s*RX)?\s*\d{4}/i.test(renderer)
    ) {
      return 'ultra';
    }
    
    // Detect mid-range GPUs 
    if (
      /GTX\s*\d{4}/i.test(renderer) || 
      /Radeon(\s*RX)?\s*/i.test(renderer)
    ) {
      return 'high';
    }
    
    // Detect mobile or integrated GPUs
    if (
      /Intel/i.test(renderer) || 
      /Mobile/i.test(renderer) ||
      /Apple/i.test(renderer)
    ) {
      return 'medium';
    }
    
    // Default to medium
    return 'medium';
  } catch (err) {
    console.warn('Error detecting GPU capabilities:', err);
    return 'medium';
  }
};

/**
 * Enhanced Point Cloud component with automatic optimization
 * Handles large point clouds with proper error handling and performance tuning
 * Uses Potree for large point clouds if available
 */
const EnhancedPointCloud = ({
  url,
  pointSize = 0.01,
  opacity = 1.0,
  color = '#ffffff',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  autoScale = true,
  colorByHeight = false,
  enableEDL = true,
  onLoad,
  onProgress,
  onError,
  forceProfile,
  selectable = false,
  visible = true,
  usePotree = true, // New parameter to toggle Potree usage
  potreeMaxPoints = 5_000_000, // Threshold for using Potree
  ...props
}) => {
  const [pointcloud, setPointcloud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('Preparing to load point cloud...');
  const [performanceProfile, setPerformanceProfile] = useState(forceProfile || detectSystemCapabilities());
  const [usesPotree, setUsesPotree] = useState(false);
  
  // Track mounts to prevent memory leaks
  const isMountedRef = useRef(true);
  const groupRef = useRef();
  const pointsRef = useRef();
  const boundsRef = useRef(new THREE.Box3());
  const scaleRef = useRef(scale);
  
  // Get access to three.js primitives
  const { camera, gl, scene } = useThree();
  
  // Performance metrics
  const [metrics, setMetrics] = useState({
    pointCount: 0,
    fps: 0,
    renderTime: 0,
    visibleNodes: 0,
    lastUpdate: null
  });
  
  // Memoize performance profile
  const profile = useMemo(() => {
    return PERFORMANCE_PROFILES[performanceProfile] || PERFORMANCE_PROFILES.medium;
  }, [performanceProfile]);
  
  // Check if Potree is available and should be used
  const shouldUsePotree = useMemo(() => {
    const potreeAvailable = isPotreeAvailable();
    console.log('Potree availability check:', {
      available: potreeAvailable,
      requested: usePotree,
      willUse: potreeAvailable && usePotree
    });
    return potreeAvailable && usePotree;
  }, [usePotree]);
  
  // Create a safe version of the point cloud material based on color
  const createMaterial = useCallback((hasVertexColors = false) => {
    return new THREE.PointsMaterial({
      size: pointSize,
      sizeAttenuation: profile.sizeAttenuation,
      transparent: opacity < 1.0,
      opacity: opacity,
      vertexColors: hasVertexColors,
      color: hasVertexColors ? 0xffffff : new THREE.Color(color),
    });
  }, [pointSize, opacity, color, profile.sizeAttenuation]);
  
  // Auto-scale point cloud based on bounding box
  const autoScalePointCloud = useCallback((points) => {
    if (!points || !autoScale) return { scale: 1, offset: [0, 0, 0] };
    
    try {
      // Try to get bounding box from geometry
      let boundingBox = null;
      if (points.geometry && points.geometry.boundingBox) {
        boundingBox = points.geometry.boundingBox;
      } else if (points.geometry && points.geometry.attributes && points.geometry.attributes.position) {
        // Compute from position attribute if available
        boundingBox = new THREE.Box3().setFromBufferAttribute(
          points.geometry.attributes.position
        );
      } else {
        // Try to compute directly from the object
        boundingBox = new THREE.Box3().setFromObject(points);
      }
      
      if (!boundingBox) {
        console.warn('Could not compute bounding box for auto-scaling');
        return { scale: 1, offset: [0, 0, 0] };
      }
      
      // Get size and center
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      
      // Get largest dimension
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Calculate appropriate scale
      let scaleValue = 1;
      if (maxDim < 1) {
        // Very small point cloud, scale up
        scaleValue = 5 / maxDim;
      } else if (maxDim > 100) {
        // Very large point cloud, scale down
        scaleValue = 10 / maxDim;
      }
      
      console.log(`Auto-scaling point cloud by ${scaleValue.toFixed(4)}x`);
      
      // Update references
      boundsRef.current = boundingBox;
      scaleRef.current = scaleValue;
      
      return {
        scale: scaleValue,
        offset: [-center.x, -center.y, -center.z]
      };
    } catch (err) {
      console.error('Error during auto-scaling:', err);
      return { scale: 1, offset: [0, 0, 0] };
    }
  }, [autoScale]);
  
  // Load and prepare the point cloud
  useEffect(() => {
    if (!url) return;
    
    let loader;
    const fileExtension = url.split('.').pop().toLowerCase();
    
    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage(`Initializing ${fileExtension} loader...`);
    
    const loadPointCloud = async () => {
      try {
        // Check if we should use Potree for this point cloud
        const usePotreeForThisCloud = shouldUsePotree;
        
        // If we're using Potree, try to use it first
        if (usePotreeForThisCloud) {
          try {
            setLoadingMessage('Initializing Potree loader...');
            setUsesPotree(true);
            
            // Check if Potree loader exists
            if (!window.Potree || !window.Potree.PointCloudOctreeLoader) {
              throw new Error('Potree is not available');
            }
            
            // Create a Potree loader
            const potreeLoader = new window.Potree.PointCloudOctreeLoader();
            potreeLoader.setPath('/potree-data/');
            
            // Load the point cloud using Potree
            setLoadingMessage(`Loading point cloud with Potree: ${url}`);
            
            // Create a promise-based wrapper for the Potree loader
            const loadPotreePointCloud = () => {
              return new Promise((resolve, reject) => {
                potreeLoader.load(url, resolve, 
                  (progress) => {
                    const percent = Math.round(progress * 100);
                    setLoadingProgress(percent);
                    setLoadingMessage(`Loading point cloud with Potree: ${percent}%`);
                    if (onProgress) onProgress(progress);
                  }, 
                  reject
                );
              });
            };
            
            // Load the point cloud
            const potreePointCloud = await loadPotreePointCloud();
            
            if (!isMountedRef.current) return;
            
            console.log('Potree point cloud loaded:', potreePointCloud);
            
            // Configure Potree-specific settings
            if (potreePointCloud.material) {
              potreePointCloud.material.size = pointSize;
              potreePointCloud.material.pointSizeType = 0; // Fixed
              potreePointCloud.material.shape = 0; // Square
              potreePointCloud.material.opacity = opacity;
              potreePointCloud.material.transparent = opacity < 1.0;
            }
            
            // Set up LOD
            if (typeof potreePointCloud.pointBudget !== 'undefined') {
              potreePointCloud.pointBudget = potreeMaxPoints;
            }
            
            if (typeof potreePointCloud.showBoundingBox !== 'undefined') {
              potreePointCloud.showBoundingBox = false;
            }
            
            // Auto-scale
            const { scale: autoScaleValue, offset } = autoScalePointCloud(potreePointCloud);
            
            // Apply the offset to center the point cloud
            if (groupRef.current) {
              groupRef.current.position.set(
                position[0] + offset[0],
                position[1] + offset[1],
                position[2] + offset[2]
              );
              
              groupRef.current.scale.set(
                autoScaleValue,
                autoScaleValue,
                autoScaleValue
              );
            }
            
            // Store point cloud
            pointsRef.current = potreePointCloud;
            setPointcloud(potreePointCloud);
            
            // Update metrics
            setMetrics(prev => ({
              ...prev,
              pointCount: potreePointCloud.geometry?.attributes?.position?.count || 0,
              lastUpdate: new Date().toISOString()
            }));
            
            setLoadingMessage('Potree point cloud ready');
            setLoading(false);
            
            // Call onLoad callback
            if (onLoad) onLoad(potreePointCloud);
            
            return;
          } catch (potreeError) {
            // If Potree loading fails, fall back to regular loaders
            console.warn('Potree loading failed, falling back to standard loaders:', potreeError);
            setUsesPotree(false);
          }
        }
        
        // If we reach here, Potree didn't load or isn't available, so use standard loaders
        
        // Pick appropriate loader based on file extension
        switch (fileExtension) {
          case 'ply':
            loader = new PLYLoader();
            break;
          case 'pcd':
            loader = new PCDLoader();
            break;
          case 'las':
          case 'laz':
            // Check if LASLoader is available
            if (!LASLoader) {
              throw new Error('LASLoader is not available. Please install three-stdlib package');
            }
            loader = new LASLoader();
            break;
          default:
            throw new Error(`Unsupported file format: ${fileExtension}`);
        }
        
        setLoadingMessage(`Loading point cloud data from ${url}...`);
        
        // Load the data
        const onProgressCallback = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setLoadingProgress(progress);
            setLoadingMessage(`Loading point cloud: ${progress}%`);
            
            if (onProgress) {
              onProgress(progress / 100);
            }
          }
        };
        
        // Use Promise to handle loaders
        const loadData = () => {
          return new Promise((resolve, reject) => {
            try {
              loader.load(
                url,
                resolve,
                onProgressCallback,
                (error) => reject(new Error(`Failed to load point cloud: ${error.message}`))
              );
            } catch (err) {
              reject(err);
            }
          });
        };
        
        // Load the data
        const data = await loadData();
        
        if (!isMountedRef.current) return;
        
        setLoadingMessage('Processing point cloud data...');
        
        let pointsGeometry, pointsMaterial, points;
        
        // Process the loaded data based on file type
        if (fileExtension === 'ply' || fileExtension === 'las' || fileExtension === 'laz') {
          // PLY and LAS files load as BufferGeometry
          pointsGeometry = data;
          
          // Check for NaN values in positions and fix bounding sphere issues
          sanitizeGeometry(pointsGeometry);
          
          // Create material based on whether vertex colors exist
          const hasColors = !!pointsGeometry.attributes.color;
          pointsMaterial = createMaterial(hasColors);
          
          // Create points object
          points = new THREE.Points(pointsGeometry, pointsMaterial);
        } else if (fileExtension === 'pcd') {
          // PCD loader might return Points or BufferGeometry
          if (data.isPoints) {
            points = data;
            pointsGeometry = data.geometry;
            
            // Update material with our settings
            points.material.dispose();
            points.material = createMaterial(!!pointsGeometry.attributes.color);
          } else {
            // It's a geometry
            pointsGeometry = data;
            sanitizeGeometry(pointsGeometry);
            
            const hasColors = !!pointsGeometry.attributes.color;
            pointsMaterial = createMaterial(hasColors);
            
            points = new THREE.Points(pointsGeometry, pointsMaterial);
          }
        }
        
        if (!points) {
          throw new Error('Failed to create points object from loaded data');
        }
        
        // Store point count
        const pointCount = pointsGeometry.attributes.position.count;
        console.log(`Loaded point cloud with ${pointCount.toLocaleString()} points`);
        
        setMetrics(prev => ({
          ...prev,
          pointCount,
          lastUpdate: new Date().toISOString()
        }));
        
        // Apply auto-scaling if enabled
        if (autoScale) {
          const { scale: autoScaleValue, offset } = autoScalePointCloud(points);
          
          // Apply the offset to center the point cloud
          if (groupRef.current) {
            groupRef.current.position.set(
              position[0] + offset[0],
              position[1] + offset[1],
              position[2] + offset[2]
            );
            
            groupRef.current.scale.set(
              autoScaleValue,
              autoScaleValue,
              autoScaleValue
            );
          }
        }
        
        // Apply color by height if requested
        if (colorByHeight && pointsGeometry.attributes.position) {
          applyHeightColoring(pointsGeometry);
        }
        
        // Store point cloud for later reference
        pointsRef.current = points;
        setPointcloud(points);
        
        // Apply performance optimizations based on system capabilities
        applyPerformanceOptimizations(points, pointsGeometry, pointCount);
        
        setLoadingMessage('Point cloud ready');
        setLoading(false);
        
        // Call onLoad callback
        if (onLoad) onLoad(points);
      } catch (err) {
        console.error('Error loading point cloud:', err);
        setError(err.message || 'Failed to load point cloud');
        setLoading(false);
        if (onError) onError(err);
      }
    };
    
    // Performance optimizations for the point cloud
    const applyPerformanceOptimizations = (points, geometry, pointCount) => {
      // Apply point size based on profile
      if (points.material) {
        points.material.size = profile.pointSize;
      }
      
      // If point count exceeds maximum, use frustum culling
      if (pointCount > profile.maxPoints) {
        console.log(`Point cloud exceeds max points (${pointCount} > ${profile.maxPoints}). Optimizing...`);
        
        // Enable frustum culling
        points.frustumCulled = true;
      } else {
        // Smaller point clouds can be rendered in full
        points.frustumCulled = false;
      }
    };
    
    // Function to apply height-based coloring
    const applyHeightColoring = (geometry) => {
      if (!geometry.attributes.position) return;
      
      const positions = geometry.attributes.position.array;
      const count = positions.length / 3;
      
      // Create color attribute if it doesn't exist
      if (!geometry.attributes.color) {
        geometry.setAttribute(
          'color',
          new THREE.BufferAttribute(new Float32Array(count * 3), 3)
        );
      }
      
      const colors = geometry.attributes.color.array;
      
      // Find min/max heights (y-coordinate)
      let minY = Infinity;
      let maxY = -Infinity;
      
      for (let i = 0; i < count; i++) {
        const y = positions[i * 3 + 1];
        if (isFinite(y)) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
      
      // Apply colors based on height
      for (let i = 0; i < count; i++) {
        const y = positions[i * 3 + 1];
        const normalizedHeight = (y - minY) / (maxY - minY || 1);
        
        // Generate color (rainbow scale)
        const hue = (1 - normalizedHeight) * 0.6; // Blue to red
        const color = new THREE.Color().setHSL(hue, 1, 0.5);
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      
      geometry.attributes.color.needsUpdate = true;
    };
    
    loadPointCloud();
    
    return () => {
      // Clean up resources when component unmounts
      isMountedRef.current = false;
      
      if (loader && loader.dispose) {
        loader.dispose();
      }
    };
  }, [url, profile, createMaterial, fixBoundingSphere, autoScalePointCloud, colorByHeight, onError, onLoad, onProgress, shouldUsePotree, potreeMaxPoints]);
  
  // Update frame metrics for performance monitoring
  useFrame((state, delta) => {
    if (!pointcloud || !pointsRef.current) return;
    
    // Update every 1 second to avoid excessive updates
    if (performance.now() % 1000 < 16) {
      setMetrics(prev => ({
        ...prev,
        fps: Math.round(1 / delta),
        renderTime: Math.round(delta * 1000),
        lastUpdate: new Date().toISOString()
      }));
    }
    
    // If using Potree, update the point cloud
    if (usesPotree && pointcloud.potree && pointcloud.potree.updatePointClouds) {
      pointcloud.potree.updatePointClouds([pointcloud], camera);
    }
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Dispose of resources
      if (pointcloud) {
        if (pointcloud.geometry) pointcloud.geometry.dispose();
        if (pointcloud.material) pointcloud.material.dispose();
      }
    };
  }, [pointcloud]);
  
  // Create loading overlay if needed
  const loadingOverlay = useMemo(() => {
    if (!loading) return null;
    
    return (
      <Html center>
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          width: '300px',
          textAlign: 'center'
        }}>
          <div>{loadingMessage}</div>
          <div style={{
            marginTop: '10px',
            width: '100%',
            height: '4px',
            background: 'rgba(255,255,255,0.2)'
          }}>
            <div style={{
              width: `${loadingProgress}%`,
              height: '100%',
              background: '#0088ff'
            }} />
          </div>
        </div>
      </Html>
    );
  }, [loading, loadingMessage, loadingProgress]);
  
  // Create error overlay if needed
  const errorOverlay = useMemo(() => {
    if (!error) return null;
    
    return (
      <Html center>
        <div style={{
          background: 'rgba(255,0,0,0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          width: '300px',
          textAlign: 'center'
        }}>
          <div>Error loading point cloud:</div>
          <div style={{ marginTop: '10px' }}>{error}</div>
        </div>
      </Html>
    );
  }, [error]);
  
  // Create info overlay for performance metrics
  const infoOverlay = useMemo(() => {
    if (loading || error || !pointcloud) return null;
    
    return (
      <Html position={[0, 1, 0]}>
        <div style={{
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '0.8em',
          pointerEvents: 'none'
        }}>
          <div>Points: {metrics.pointCount.toLocaleString()}</div>
          <div>FPS: {metrics.fps}</div>
          <div>Renderer: {usesPotree ? 'Potree (LOD)' : 'Standard'}</div>
        </div>
      </Html>
    );
  }, [loading, error, pointcloud, metrics, usesPotree]);
  
  return (
    <group 
      ref={groupRef}
      position={position}
      rotation={rotation.map(r => r * Math.PI / 180)}
      scale={autoScale ? 1 : scale}
      visible={visible}
      {...props}
    >
      {pointcloud && (
        <primitive 
          object={pointcloud}
          ref={pointsRef}
        />
      )}
      {loadingOverlay}
      {errorOverlay}
      {infoOverlay}
    </group>
  );
};

export default EnhancedPointCloud; 