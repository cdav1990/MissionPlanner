import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import * as THREE from 'three';
import PotreePointCloud from './PotreePointCloud';
import { 
  checkSystemCapabilities, 
  optimizeMemoryUsage,
  isPotreeAvailable
} from '../utils/PotreeUtils';
import { setupWebGLRecoveryHandler } from '../utils/ThreeContextRecovery';

/**
 * LargePointCloudViewer - A specialized component for visualizing extremely large point clouds
 * with Potree integration, memory management, and error recovery
 * 
 * @param {Object} props Component props
 * @param {string} props.url URL to the point cloud data
 * @param {Object} props.viewerOptions Options for the viewer
 * @param {Object} props.pointCloudOptions Options for the point cloud
 * @param {Function} props.onLoad Callback when point cloud is loaded
 * @param {Function} props.onError Callback when an error occurs
 * @param {Function} props.onProgress Callback for load progress
 */
const LargePointCloudViewer = ({
  url,
  viewerOptions = {},
  pointCloudOptions = {},
  onLoad,
  onError,
  onProgress,
  children
}) => {
  // Default viewer options
  const {
    width = '100%',
    height = '100%',
    backgroundColor = '#000000',
    showStats = false,
    showMemoryWarnings = true,
    autoOptimize = true,
    optimizationInterval = 30000, // Auto-optimize every 30 seconds
    pixelRatio = window.devicePixelRatio
  } = viewerOptions;

  // Default point cloud options
  const {
    pointSize = 1.0,
    opacity = 1.0,
    maxPoints = 5000000,
    pointSizeMode = 'adaptive',
    quality = 'high', // high, medium, low
    maxLOD = 10,
    edlEnabled = true,
    material = null
  } = pointCloudOptions;

  // State for the viewer
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [systemCapabilities, setSystemCapabilities] = useState(null);
  const [performanceMode, setPerformanceMode] = useState('auto'); // auto, high, medium, low
  const [memoryStats, setMemoryStats] = useState({
    usage: 0,
    limit: 0,
    warningLevel: false
  });

  // Refs
  const canvasRef = useRef(null);
  const pointcloudRef = useRef(null);
  const optimizationTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Effect to check system capabilities and set performance mode
  useEffect(() => {
    const capabilities = checkSystemCapabilities();
    setSystemCapabilities(capabilities);

    // Determine performance mode based on capabilities
    let mode = 'medium';
    if (capabilities.overallCapability.canRunFull) {
      mode = 'high';
    } else if (!capabilities.overallCapability.canRunBasic) {
      mode = 'low';
    }

    setPerformanceMode(mode);
    console.log(`LargePointCloudViewer: System check complete. Running in ${mode} mode.`);
    console.log('System capabilities:', capabilities);

    // If Potree is not available, set an error
    if (!isPotreeAvailable) {
      setError('Potree library not found. Large point clouds cannot be loaded.');
      if (onError) onError(new Error('Potree library not available'));
    }
  }, [onError]);

  // Handle component mount/unmount
  useEffect(() => {
    isMountedRef.current = true;

    // Setup WebGL context recovery
    if (canvasRef.current) {
      setupWebGLRecoveryHandler(canvasRef.current, {
        onContextLost: handleContextLost,
        onContextRestored: handleContextRestored
      });
    }

    return () => {
      isMountedRef.current = false;
      
      // Clear optimization timer
      if (optimizationTimerRef.current) {
        clearInterval(optimizationTimerRef.current);
      }
    };
  }, []);

  // Handle context loss
  const handleContextLost = useCallback((event) => {
    console.warn('LargePointCloudViewer: WebGL context lost', event);
    
    // If we're already loading, don't do anything
    if (isLoading) return;

    if (isMountedRef.current) {
      setError('WebGL context lost. Attempting to recover...');
    }
  }, [isLoading]);

  // Handle context restoration
  const handleContextRestored = useCallback((event) => {
    console.log('LargePointCloudViewer: WebGL context restored', event);
    
    if (isMountedRef.current) {
      setError(null);
      
      // If we have a point cloud loaded, we need to reload it
      if (isLoaded && url) {
        setIsLoaded(false);
        setIsLoading(true);
        setLoadProgress(0);
      }
    }
  }, [isLoaded, url]);

  // Handle point cloud loading
  const handlePointCloudLoad = useCallback((loadedPointcloud) => {
    console.log('Point cloud loaded:', loadedPointcloud);
    
    if (!isMountedRef.current) return;
    
    setIsLoaded(true);
    setIsLoading(false);
    setLoadProgress(100);
    
    // Reference to the point cloud for later optimization
    pointcloudRef.current = loadedPointcloud;
    
    // Start the optimization timer if auto-optimize is enabled
    if (autoOptimize && optimizationInterval > 0) {
      if (optimizationTimerRef.current) {
        clearInterval(optimizationTimerRef.current);
      }
      
      optimizationTimerRef.current = setInterval(() => {
        if (pointcloudRef.current) {
          try {
            const stats = optimizeMemoryUsage(pointcloudRef.current);
            if (stats.success) {
              setMemoryStats(prev => ({
                ...prev,
                usage: stats.memoryUsage || 0,
                nodesUnloaded: stats.nodesUnloaded || 0
              }));
            }
          } catch (err) {
            console.warn('Error during auto-optimization:', err);
          }
        }
      }, optimizationInterval);
    }
    
    // Invoke the onLoad callback
    if (onLoad) {
      onLoad(loadedPointcloud);
    }
  }, [autoOptimize, optimizationInterval, onLoad]);

  // Handle point cloud loading progress
  const handleProgress = useCallback((progress) => {
    if (!isMountedRef.current) return;
    
    setLoadProgress(progress.percentage || 0);
    
    if (onProgress) {
      onProgress(progress);
    }
  }, [onProgress]);

  // Handle point cloud loading error
  const handleError = useCallback((err) => {
    console.error('Error loading point cloud:', err);
    
    if (!isMountedRef.current) return;
    
    setError(err.message || 'Failed to load point cloud');
    setIsLoading(false);
    
    if (onError) {
      onError(err);
    }
  }, [onError]);

  // Handle user starting to load a point cloud
  useEffect(() => {
    if (url && !isLoaded && !isLoading && !error) {
      setIsLoading(true);
      setLoadProgress(0);
      setError(null);
    }
  }, [url, isLoaded, isLoading, error]);

  // Compute adjusted settings based on performance mode
  const computedPointSize = useMemo(() => {
    switch (performanceMode) {
      case 'low': return Math.max(1.2, pointSize * 1.5);
      case 'medium': return pointSize;
      case 'high': return Math.min(0.8, pointSize * 0.8);
      default: return pointSize;
    }
  }, [performanceMode, pointSize]);

  const computedMaxPoints = useMemo(() => {
    switch (performanceMode) {
      case 'low': return Math.min(1000000, maxPoints / 5);
      case 'medium': return Math.min(3000000, maxPoints);
      case 'high': return maxPoints;
      default: return maxPoints;
    }
  }, [performanceMode, maxPoints]);

  const computedMaxLOD = useMemo(() => {
    switch (performanceMode) {
      case 'low': return Math.min(5, maxLOD);
      case 'medium': return Math.min(8, maxLOD);
      case 'high': return maxLOD;
      default: return maxLOD;
    }
  }, [performanceMode, maxLOD]);

  // Render error message overlay
  const renderError = () => {
    if (!error) return null;
    
    return (
      <div 
        style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,0,0,0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          zIndex: 1000,
          maxWidth: '80%',
          textAlign: 'center'
        }}
      >
        <h3>Error</h3>
        <p>{error}</p>
        {systemCapabilities && !systemCapabilities.overallCapability.canRunBasic && (
          <div>
            <p><strong>Your system may not meet the minimum requirements:</strong></p>
            <ul style={{ textAlign: 'left' }}>
              {!systemCapabilities.webglSupport && <li>WebGL not supported</li>}
              {systemCapabilities.gpu && !systemCapabilities.gpu.isGoodEnough && (
                <li>GPU: {systemCapabilities.gpu.name} may not be powerful enough</li>
              )}
              {systemCapabilities.memory && !systemCapabilities.memory.isGoodEnough && (
                <li>Memory: {systemCapabilities.memory.deviceMemory}GB is less than recommended 4GB</li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Render loading indicator
  const renderLoading = () => {
    if (!isLoading) return null;
    
    return (
      <div 
        style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          zIndex: 1000,
          maxWidth: '80%',
          textAlign: 'center'
        }}
      >
        <h3>Loading Point Cloud</h3>
        <div style={{ margin: '10px 0' }}>
          <div style={{ width: '100%', background: '#444', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${loadProgress}%`, 
                background: '#4CAF50', 
                height: '100%',
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
          <div style={{ marginTop: '5px' }}>{loadProgress.toFixed(0)}%</div>
        </div>
        {systemCapabilities && performanceMode && (
          <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.8 }}>
            Running in {performanceMode} quality mode
          </div>
        )}
      </div>
    );
  };

  // Render memory warning
  const renderMemoryWarning = () => {
    if (!showMemoryWarnings || !memoryStats.warningLevel) return null;
    
    return (
      <div 
        style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px',
          background: 'rgba(255,140,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          zIndex: 900,
          fontSize: '12px'
        }}
      >
        <strong>High Memory Usage</strong>
        <div>
          {memoryStats.usage.toFixed(0)} MB used
        </div>
        <div style={{ fontSize: '10px', marginTop: '5px' }}>
          Quality has been reduced
        </div>
      </div>
    );
  };

  return (
    <div 
      style={{ 
        position: 'relative', 
        width: width, 
        height: height,
        overflow: 'hidden',
        backgroundColor: backgroundColor
      }}
    >
      {renderError()}
      {renderLoading()}
      {renderMemoryWarning()}
      
      <Canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        gl={{
          antialias: performanceMode === 'high',
          alpha: false,
          depth: true,
          stencil: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false
        }}
        camera={{
          fov: 60,
          near: 0.1,
          far: 1000000,
          position: [0, 0, 50]
        }}
        dpr={pixelRatio}
        shadows={false}
      >
        {/* Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={1.0}
        />
        
        {/* Environment lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={0.5} />
        
        {/* Point cloud */}
        {url && (
          <PotreePointCloud
            url={url}
            pointSize={computedPointSize}
            opacity={opacity}
            maxPoints={computedMaxPoints}
            maxLod={computedMaxLOD}
            enableEDL={edlEnabled && performanceMode !== 'low'}
            onLoad={handlePointCloudLoad}
            onProgress={handleProgress}
            onError={handleError}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            scale={1}
          />
        )}
        
        {/* Additional content */}
        {children}
        
        {/* Performance stats */}
        {showStats && <Stats className="stats" />}
      </Canvas>
    </div>
  );
};

export default LargePointCloudViewer; 