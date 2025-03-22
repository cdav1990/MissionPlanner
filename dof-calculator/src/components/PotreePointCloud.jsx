import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Select, useSelect, Html } from '@react-three/drei';
import { 
  loadPointCloud, 
  optimizePointCloud, 
  updatePointCloudSettings, 
  checkSystemCapabilities, 
  extractMetadataFromUrl, 
  analyzePointCloudScale 
} from '../utils/PotreeUtils';
import { 
  useWebGLContextHandler, 
  registerPotreeDisposalHandler,
  isPotreeCausingMemoryPressure 
} from '../utils/ThreeContextRecovery';
import { sanitizeGeometry } from '../utils/geometryUtils';

/**
 * PotreePointCloud component for rendering large point clouds with selection support
 * Enhanced with better performance monitoring and user feedback
 * 
 * @param {object} props - Component props
 * @param {string} props.url - URL to the point cloud data
 * @param {number} props.pointSize - Size of points
 * @param {number} props.opacity - Opacity of points
 * @param {number} props.maxPoints - Maximum points to render (point budget)
 * @param {number} props.maxLod - Maximum LOD level to load
 * @param {boolean} props.enableEDL - Whether to enable Eye-Dome Lighting
 * @param {boolean} props.enableClipping - Whether to enable clipping planes
 * @param {array} props.position - Position of the point cloud [x, y, z]
 * @param {number} props.scale - Scale factor for the point cloud
 * @param {array} props.rotation - Rotation of the point cloud
 * @param {boolean} props.selectable - Whether the point cloud can be selected
 * @param {function} props.onSelect - Callback when the point cloud is selected
 * @param {function} props.onProgress - Callback for progress updates
 * @param {function} props.onLoad - Callback when the point cloud is loaded
 * @param {function} props.onError - Callback for error handling
 */
const PotreePointCloud = ({
  url,
  pointSize = 0.05,
  opacity = 1.0,
  maxPoints = 50_000_000,
  maxLod = 10,
  enableEDL = false,
  enableClipping = false,
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
  selectable = true,
  onSelect,
  onProgress,
  onLoad,
  onError,
  ...props
}) => {
  const [pointcloud, setPointcloud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPotreeCloud, setIsPotreeCloud] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 0,
    pointCount: 0,
    memoryUsage: 0,
    lastUpdate: null
  });
  const [retryCount, setRetryCount] = useState(0);
  const [memoryWarning, setMemoryWarning] = useState(false);
  
  // Extract metadata from URL
  const metadata = useMemo(() => {
    if (!url) return null;
    return extractMetadataFromUrl(url);
  }, [url]);
  
  const pointcloudRef = useRef();
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const lastUpdateRef = useRef(Date.now());
  const isMountedRef = useRef(true);
  
  // Enhanced settings state with performance monitoring
  const [settings, setSettings] = useState({
    pointBudget: maxPoints,
    maxLod: maxLod,
    enableEDL: enableEDL,
    clipping: enableClipping,
    lowMemoryMode: true,
    preferHighQuality: false
  });
  
  // Added state for auto-scale handling
  const [autoScaleConfig, setAutoScaleConfig] = useState({
    scale: 1,
    centerOffset: [0, 0, 0],
    enabled: false,
    analyzed: false
  });
  
  // Get THREE.js environment
  const { scene, camera } = useThree();
  
  // Register a handler for WebGL context loss
  const handleContextLoss = useCallback(() => {
    console.log('PotreePointCloud: Handling WebGL context loss');
    
    // Release pointcloud resources if possible
    if (pointcloud) {
      try {
        if (pointcloud.dispose) {
          pointcloud.dispose();
        }
        
        // If it's a Potree cloud with specific disposal needs
        if (pointcloud.potree && pointcloud.potree.dispose) {
          pointcloud.potree.dispose();
        }
      } catch (err) {
        console.error('Error disposing point cloud during context loss:', err);
      }
    }
    
    // Clear the point cloud reference
    setPointcloud(null);
    
    // Mark as not loaded so we can reload
    setLoading(false);
  }, [pointcloud]);
  
  // Register the disposal handler with the context recovery system
  useEffect(() => {
    const unregister = registerPotreeDisposalHandler(handleContextLoss);
    return unregister;
  }, [handleContextLoss]);
  
  // Track component mounting state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Handle memory warnings for large point clouds
  useEffect(() => {
    // Check for memory pressure periodically
    const memoryCheckInterval = setInterval(() => {
      if (isPotreeCausingMemoryPressure()) {
        setMemoryWarning(true);
        
        // Reduce point budget if we're not already in low memory mode
        if (!settings.lowMemoryMode) {
          console.warn('High memory usage detected - reducing point budget');
          setSettings(prev => ({
            ...prev,
            lowMemoryMode: true,
            pointBudget: Math.min(prev.pointBudget, 1_000_000)
          }));
          
          // Update the pointcloud if it exists
          if (pointcloud && pointcloud.potree) {
            try {
              pointcloud.potree.pointBudget = Math.min(settings.pointBudget, 1_000_000);
            } catch (err) {
              console.error('Error updating point budget:', err);
            }
          }
        }
      } else {
        setMemoryWarning(false);
      }
    }, 5000);
    
    return () => clearInterval(memoryCheckInterval);
  }, [settings]);
  
  // Performance monitoring effect
  useEffect(() => {
    if (!pointcloud || !isPotreeCloud) return;
    
    const interval = setInterval(() => {
      if (pointcloud.potree) {
        const metrics = {
          fps: frameCountRef.current,
          pointCount: pointcloud.potree.numVisiblePoints || 0,
          memoryUsage: performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0,
          lastUpdate: new Date().toISOString()
        };
        
        setPerformanceMetrics(metrics);
        
        // Adjust settings based on performance
        if (metrics.fps < 20 && !settings.lowMemoryMode) {
          console.warn('Low FPS detected, switching to low memory mode');
          setSettings(prev => ({ ...prev, lowMemoryMode: true }));
        }
      }
      
      frameCountRef.current = 0;
    }, 1000);
    
    return () => clearInterval(interval);
  }, [pointcloud, isPotreeCloud, settings.lowMemoryMode]);
  
  // Function to load point cloud data with retry capability
  const loadPointCloudData = useCallback((url) => {
    console.log(`Loading point cloud data (attempt ${retryCount + 1}): ${url}`);
    
    // Reset error state
    setError(null);
    
    // Check system capabilities first
    const systemCaps = checkSystemCapabilities();
    console.log('System capabilities:', systemCaps);
    
    if (!systemCaps.webglSupport) {
      setError('WebGL not supported by your browser. Please try a different browser.');
      if (onError) onError(new Error('WebGL not supported'));
      return;
    }
    
    setPointcloud(null);
    
    // Performance diagnostics
    const startTime = performance.now();
    
    // Use the imported extractMetadataFromUrl function
    const metadata = extractMetadataFromUrl(url);
    console.log('URL metadata:', metadata);
    
    loadPointCloud(url, (progress) => {
      // Report progress - check if component is still mounted
      if (isMountedRef.current && onProgress) {
        onProgress(progress);
      }
    })
    .then(loadedPointcloud => {
      console.log('Point cloud loaded successfully:', loadedPointcloud);

      // Check if component is still mounted
      if (!isMountedRef.current) {
        console.warn('Component unmounted during point cloud load');
        if (loadedPointcloud && loadedPointcloud.dispose) {
          loadedPointcloud.dispose();
        }
        return;
      }
      
      // If the pointcloud has a geometry, apply sanitization
      if (loadedPointcloud.geometry) {
        try {
          sanitizeGeometry(loadedPointcloud.geometry);
        } catch (err) {
          console.warn('Error sanitizing point cloud geometry:', err);
        }
      }
      
      // Set isPotree flag based on the type of point cloud
      const isPotreeType = !!loadedPointcloud.isPotreePointCloud;
      setIsPotreeCloud(isPotreeType);
      
      // Check for auto-scaling config and apply if needed
      if (loadedPointcloud.autoScaleEnabled) {
        const autoScaleSettings = {
          scale: loadedPointcloud.autoScale || 1,
          centerOffset: loadedPointcloud.centerOffset || [0, 0, 0],
          boundingSize: loadedPointcloud.boundingSize || 1,
          enabled: true,
          analyzed: true
        };
        
        console.log('Auto-scaling point cloud with settings:', autoScaleSettings);
        setAutoScaleConfig(autoScaleSettings);
      } else if (!autoScaleConfig.analyzed) {
        // If not already auto-scaled, analyze to see if we should
        try {
          // Use the imported analyzePointCloudScale function
          const analysisResult = analyzePointCloudScale(loadedPointcloud);
          if (analysisResult.shouldAutoScale) {
            console.log('Analysis suggests auto-scaling:', analysisResult);
            setAutoScaleConfig({
              scale: analysisResult.suggestedScale,
              centerOffset: analysisResult.centerOffset || [0, 0, 0],
              boundingSize: analysisResult.boundingSize || 1,
              enabled: true,
              analyzed: true
            });
          } else {
            setAutoScaleConfig(prev => ({ ...prev, analyzed: true }));
          }
        } catch (err) {
          console.warn('Error analyzing point cloud scale:', err);
        }
      }
      
      // Store the loaded point cloud
      setPointcloud(loadedPointcloud);
      setLoading(false);
      
      // Apply optimizations
      optimizePointCloud(loadedPointcloud, Math.min(maxPoints, settings.lowMemoryMode ? 2_000_000 : 10_000_000));
      
      // Update performance metrics
      const pointCount = loadedPointcloud.pointCount || 
                       (loadedPointcloud.geometry?.attributes?.position?.count || 0);
      
      setPerformanceMetrics(prev => ({
        ...prev,
        pointCount: pointCount,
        lastUpdate: new Date().toISOString()
      }));
      
      // Invoke onLoad callback if provided
      if (onLoad && typeof onLoad === 'function') {
        onLoad({
          ...loadedPointcloud,
          pointCount,
          autoScale: autoScaleConfig.enabled ? autoScaleConfig.scale : 1,
          autoScaleEnabled: autoScaleConfig.enabled,
          boundingSize: autoScaleConfig.boundingSize
        });
      }
      
      // Log timing information
      const loadTime = performance.now() - startTime;
      console.log(`Point cloud loaded and processed in ${loadTime.toFixed(2)}ms`);
    })
    .catch(err => {
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      console.error('Error loading point cloud:', err);
      setError(err.message || 'Failed to load point cloud');
      setLoading(false);
      
      // Report error to parent
      if (onError) {
        onError(err);
      }
    });
  }, [retryCount, onProgress, onError, onLoad, autoScaleConfig, settings.lowMemoryMode, maxPoints]);
  
  // Initial load
  useEffect(() => {
    // Only load if we have a URL
    if (url) {
      loadPointCloudData(url);
    }
    
    // Cleanup function
    return () => {
      // Dispose of the point cloud if it exists
      if (pointcloud) {
        try {
          if (pointcloud.dispose) {
            pointcloud.dispose();
          }
          
          // If it's a Potree cloud, perform Potree-specific disposal
          if (pointcloud.potree && pointcloud.potree.dispose) {
            pointcloud.potree.dispose();
          }
          
          // Set to null to help garbage collection
          setPointcloud(null);
        } catch (err) {
          console.warn('Error disposing point cloud:', err);
        }
      }
    };
  }, [url, loadPointCloudData]);
  
  // Update pointcloud settings when they change
  useEffect(() => {
    if (!pointcloud) return;
    
    // Update Potree settings if available
    if (isPotreeCloud && pointcloud) {
      try {
        // Update settings based on current state
        updatePointCloudSettings(pointcloud, {
          pointBudget: settings.lowMemoryMode ? Math.min(maxPoints, 2_000_000) : maxPoints,
          pointSize: pointSize,
          opacity: opacity,
          maxLod: settings.lowMemoryMode ? Math.min(maxLod, 6) : maxLod,
          edlEnabled: settings.enableEDL && !settings.lowMemoryMode
        });
      } catch (err) {
        console.error('Error updating point cloud settings:', err);
      }
    } else if (pointcloud && pointcloud.material) {
      // For non-Potree point clouds, update material directly
      try {
        pointcloud.material.size = pointSize;
        pointcloud.material.opacity = opacity;
        pointcloud.material.transparent = opacity < 1.0;
        pointcloud.material.needsUpdate = true;
      } catch (err) {
        console.error('Error updating point cloud material:', err);
      }
    }
  }, [
    pointcloud, 
    isPotreeCloud, 
    settings, 
    pointSize, 
    opacity, 
    maxPoints, 
    maxLod
  ]);
  
  // Handle frame updates for Potree
  useFrame(() => {
    if (!pointcloud) return;
    
    // Increment frame counter for FPS calculation
    frameCountRef.current++;
    
    // For Potree point clouds, handle automatic updates 
    // (required for proper LOD and visible nodes management)
    if (isPotreeCloud && pointcloud.potree) {
      try {
        const now = Date.now();
        const updateInterval = settings.lowMemoryMode ? 2000 : 1000;
        
        // Only update every second (or 2 seconds in low memory mode) to reduce CPU/GPU load
        if (now - lastUpdateRef.current > updateInterval) {
          pointcloud.potree.updateVisibility();
          lastUpdateRef.current = now;
        }
      } catch (err) {
        // Don't log errors here as they could spam the console
      }
    }
  });
  
  // Retry handler for failed loads
  const handleRetry = () => {
    if (retryCount < 3 && url) {
      setRetryCount(prev => prev + 1);
      setError(null);
      setLoading(true);
      loadPointCloudData(url);
    }
  };
  
  // Select handling for interactivity
  const isSelected = useSelect().find(obj => obj === pointcloudRef.current);
  
  // Handle selection
  useEffect(() => {
    if (isSelected && onSelect && pointcloud) {
      onSelect({
        pointcloud,
        pointCount: performanceMetrics.pointCount,
        ...metadata
      });
    }
  }, [isSelected, onSelect, pointcloud, performanceMetrics.pointCount, metadata]);
  
  // Memory warning component
  const MemoryWarning = () => (
    <Html center position={[0, 0, 0]}>
      <div style={{
        background: 'rgba(255,100,0,0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        textAlign: 'center',
        fontSize: '14px',
        maxWidth: '250px',
        pointerEvents: 'none'
      }}>
        <strong>Warning:</strong> High memory usage detected.<br/>
        Point cloud quality has been reduced.
      </div>
    </Html>
  );
  
  // Loader component
  const Loader = () => (
    <Html center position={[0, 0, 0]}>
      <div style={{
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '15px',
        borderRadius: '5px',
        textAlign: 'center',
        maxWidth: '250px'
      }}>
        <div style={{ marginBottom: '10px' }}>Loading Point Cloud...</div>
        <div style={{ 
          width: '100%', 
          height: '6px', 
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{ 
            width: `${performanceMetrics.loadProgress || 0}%`, 
            height: '100%', 
            background: '#4CAF50',
            transition: 'width 0.3s ease'
          }}></div>
        </div>
        {metadata && metadata.filename && (
          <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
            {metadata.filename}
            {metadata.size > 0 && ` (${(metadata.size / 1048576).toFixed(1)} MB)`}
          </div>
        )}
      </div>
    </Html>
  );
  
  // Error display component
  const ErrorDisplay = () => (
    <Html center position={[0, 0, 0]}>
      <div style={{
        background: 'rgba(255,0,0,0.7)',
        color: 'white',
        padding: '12px',
        borderRadius: '5px',
        textAlign: 'center',
        maxWidth: '300px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          Error Loading Point Cloud
        </div>
        <div style={{ fontSize: '13px', marginBottom: '10px' }}>
          {error}
        </div>
        {retryCount < 3 && (
          <button 
            onClick={handleRetry}
            style={{
              background: 'white',
              color: 'black',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            Retry Loading
          </button>
        )}
      </div>
    </Html>
  );
  
  // Placeholder component when no pointcloud is loaded
  const Placeholder = () => (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} onUpdate={(geom) => sanitizeGeometry(geom)} />
      <meshBasicMaterial color="#4477ff" wireframe opacity={0.6} transparent />
    </mesh>
  );
  
  // Performance metrics display (for development)
  const PerformanceDisplay = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return (
      <Html position={[0, 2, 0]}>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          color: '#00ff00',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace',
          width: '180px',
          pointerEvents: 'none'
        }}>
          <div>FPS: {performanceMetrics.fps}</div>
          <div>Points: {(performanceMetrics.pointCount || 0).toLocaleString()}</div>
          <div>Memory: {performanceMetrics.memoryUsage.toFixed(0)} MB</div>
          <div>Mode: {settings.lowMemoryMode ? 'Low Memory' : 'High Quality'}</div>
        </div>
      </Html>
    );
  };
  
  // Wrap the point cloud in a selectable group if enabled
  const content = (
    <group 
      ref={pointcloudRef} 
      position={position}
      rotation={rotation}
      scale={[
        scale * (autoScaleConfig.enabled ? autoScaleConfig.scale : 1),
        scale * (autoScaleConfig.enabled ? autoScaleConfig.scale : 1),
        scale * (autoScaleConfig.enabled ? autoScaleConfig.scale : 1)
      ]}
    >
      {/* When loading, show loader */}
      {loading && <Loader />}
      
      {/* When error, show error message */}
      {error && <ErrorDisplay />}
      
      {/* Show placeholder or actual pointcloud */}
      {!loading && !error && !pointcloud && <Placeholder />}
      
      {/* When loaded, show the actual point cloud as a primitive */}
      {!loading && !error && pointcloud && (
        <>
          <primitive object={pointcloud} />
          {process.env.NODE_ENV === 'development' && <PerformanceDisplay />}
          {memoryWarning && <MemoryWarning />}
        </>
      )}
    </group>
  );
  
  // Return wrapped in Select if selectable, otherwise return as is
  return selectable ? (
    <Select enabled={!loading && !error && !!pointcloud}>
      {content}
    </Select>
  ) : content;
};

export default PotreePointCloud; 