import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera, EffectComposer, Bloom, Noise } from '@react-three/drei';
import * as THREE from 'three';
import { CanvasErrorBoundary, ModelErrorBoundary } from './ErrorBoundaries.jsx';
import PotreePointCloud from './PotreePointCloud.jsx';
import ModelLoader from './ModelLoader.jsx';
import LargeModelViewer from './LargeModelViewer.jsx';
import DroneModel from './DroneModel.jsx';

// Simple Grid component
function SimpleGrid() {
  return (
    <group>
      <gridHelper args={[100, 100, '#444444', '#222222']} position={[0, 0.01, 0]} />
      
      {/* Add coordinate axes */}
      <group>
        {/* X-axis (red) */}
        <mesh position={[5, 0.02, 0]}>
          <boxGeometry args={[10, 0.03, 0.03]} />
          <meshBasicMaterial color="#ff4444" />
        </mesh>
        
        {/* Y-axis (green) */}
        <mesh position={[0, 5, 0]}>
          <boxGeometry args={[0.03, 10, 0.03]} />
          <meshBasicMaterial color="#44ff44" />
        </mesh>
        
        {/* Z-axis (blue) */}
        <mesh position={[0, 0.02, 5]}>
          <boxGeometry args={[0.03, 0.03, 10]} />
          <meshBasicMaterial color="#4444ff" />
        </mesh>
      </group>
    </group>
  );
}

// Camera controls component
function CameraControls({ target = [0, 0, 0], enabled = true }) {
  const { camera } = useThree();
  
  useEffect(() => {
    if (target && enabled) {
      camera.lookAt(new THREE.Vector3(...target));
    }
  }, [camera, target, enabled]);
  
  return <OrbitControls enableDamping dampingFactor={0.1} rotateSpeed={0.5} enabled={enabled} />;
}

// Scene setup component
function SceneSetup({ children }) {
  const { scene } = useThree();
  
  // Set up advanced lighting when the component mounts
  useEffect(() => {
    // Scene environment settings for more realistic rendering
    scene.environment = new THREE.Color(0x000000);
    
    // Add deeper fog for atmosphere
    scene.fog = new THREE.FogExp2(0x000822, 0.02);
    
    // Add console log to confirm this effect is running
    console.log("Enhanced futuristic lighting activated in SceneSetup");
    
    return () => {
      // Clean up when component unmounts
      scene.environment = null;
      scene.fog = null;
    };
  }, [scene]);
  
  // Add a pulsing light effect
  const pulsingLightRef = useRef();
  useFrame(({ clock }) => {
    if (pulsingLightRef.current) {
      // Pulsing intensity effect
      pulsingLightRef.current.intensity = 0.5 + Math.sin(clock.getElapsedTime() * 2) * 0.25;
    }
  });
  
  return (
    <>
      {/* Base ambient light for general illumination */}
      <ambientLight intensity={0.15} color="#1144ff" />
      
      {/* Main directional light (sun-like) */}
      <directionalLight 
        position={[15, 25, 15]} 
        intensity={0.7}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      {/* Dramatic accent lights for futuristic feel */}
      <spotLight
        position={[-15, 8, -10]}
        angle={0.3}
        penumbra={0.8}
        intensity={0.8}
        color="#00ffff"
        castShadow
        distance={40}
      />
      
      <spotLight
        position={[15, 2, -10]}
        angle={0.5}
        penumbra={0.6}
        intensity={0.6}
        color="#ff00aa"
        distance={30}
      />
      
      {/* Pulsing rim light for edge definition and futuristic effect */}
      <pointLight
        ref={pulsingLightRef}
        position={[0, 15, -20]}
        intensity={0.5}
        color="#8866ff"
        distance={40}
      />
      
      {/* Ground highlight */}
      <spotLight
        position={[0, 10, 0]}
        angle={0.8}
        penumbra={0.5}
        intensity={0.3}
        color="#0033ff"
        distance={20}
      />
      
      {/* Camera setup */}
      <PerspectiveCamera 
        makeDefault 
        position={[5, 5, 5]} 
        fov={50}
      />
      
      {/* Post-processing effects for a more dramatic look */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} />
        <Noise opacity={0.02} />
      </EffectComposer>
      
      {children}
    </>
  );
}

// Add WebGLContextRecovery component
const WebGLContextRecovery = ({ visible, onReload, onClearResources, count }) => {
  if (!visible) return null;
  
  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        textAlign: 'center'
      }}
    >
      <h2>WebGL Context Lost</h2>
      <p>The 3D rendering context has been lost. This may be due to a driver issue or memory constraints.</p>
      <p>Lost count: {count}</p>
      
      <div style={{ margin: '20px 0', padding: '10px', backgroundColor: 'rgba(40,40,40,0.6)', borderRadius: '5px', maxWidth: '500px' }}>
        <h3>Device Capabilities</h3>
        <p style={{ fontSize: '0.9em', textAlign: 'left', margin: '5px 0' }}>
          GPU: {window.navigator.userAgent.includes('Apple') ? 'APPLE' : 'Standard'} / 
          {window.navigator.userAgent.includes('Mac') ? ' Apple M-series, ' : ' '}
          Unspecified
        </p>
        <p style={{ fontSize: '0.9em', textAlign: 'left', margin: '5px 0' }}>
          WebGL: {window.WebGLRenderingContext ? '2.0 Supported' : 'Limited Support'}
        </p>
        <p style={{ fontSize: '0.9em', textAlign: 'left', margin: '5px 0' }}>
          Risk Level: {count > 2 ? 'High - repeated crashes' : 'Medium - try recovery'}
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={onReload}
          style={{
            backgroundColor: '#4477ee',
            border: 'none',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reload Application
        </button>
        
        <button 
          onClick={onClearResources}
          style={{
            backgroundColor: '#44aa44',
            border: 'none',
            color: 'white',
            padding: '10px 20px', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clean Resources
        </button>
      </div>
      
      <p style={{ marginTop: '20px', fontSize: '0.8em', maxWidth: '500px' }}>
        If the issue persists, try closing other applications to free memory, 
        or try a smaller 3D model file. Very large models may require more GPU memory than is available on your device.
      </p>
    </div>
  );
};

// Main ThreeCanvas component
const ThreeCanvas = ({
  // Model props
  selectedModel,
  modelVisible = true,
  modelScale = 1.0,
  modelOpacity = 1.0,
  pointSize = 0.01,

  // Drone props
  dronePosition = [0, 2, 0],
  droneRotation = [0, 0, 0],
  showFrustum = true,
  cameraDetails = {},
  lensDetails = {},
  followDrone = false,
  centerOnMap = true,
  frustumScale = 1.0,
  uploadedFile = null,

  // Camera props
  cameraTarget,
  
  // Performance settings
  performanceSettings = {
    lowPowerMode: false,
    prioritizePerformance: true,
    adaptiveQuality: true,
    maxPointsPerModel: 2000000,
    pointSize: 0.01
  },
  
  // Callbacks
  onMemoryUsageChange = () => {},
  onFpsChange = () => {},
  onGpuInfoUpdate = () => {},
  onError = () => {},

  // Add extra prop for model unloading
  onUnloadModel = () => {},
}) => {
  // State for performance monitoring
  const [lowPerformanceMode, setLowPerformanceMode] = useState(performanceSettings.lowPowerMode);
  const [memoryWarning, setMemoryWarning] = useState(false);
  const [fpsMonitor, setFpsMonitor] = useState({ fps: 60, history: [] });
  const [webglContextInfo, setWebglContextInfo] = useState(null);
  
  // For context loss tracking
  const contextLossCountRef = useRef(0);
  const lastContextLossTimeRef = useRef(0);
  const canvasRef = useRef(null);
  
  // Add contextLoss state
  const [contextLost, setContextLost] = useState(false);
  const [contextLossCount, setContextLossCount] = useState(0);
  
  // Update low performance mode when settings change
  useEffect(() => {
    setLowPerformanceMode(performanceSettings.lowPowerMode);
  }, [performanceSettings.lowPowerMode]);
  
  // Get WebGL context info
  useEffect(() => {
    // Function to safely determine WebGL capabilities
    const getWebGLInfo = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || 
                 canvas.getContext('webgl') || 
                 canvas.getContext('experimental-webgl');
                 
        if (!gl) return { supported: false, version: 'none' };
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
        const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
        const isAppleSilicon = vendor.includes('Apple') && 
                              (renderer.includes('Apple M') || renderer.includes('Apple GPU'));
        
        // Check if we're running on an M-series chip
        const isM3 = isAppleSilicon && renderer.includes('M3');
        
        // Get max texture size
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        
        const extensions = [];
        const exts = gl.getSupportedExtensions();
        if (exts) {
          exts.forEach(ext => extensions.push(ext));
        }
        
        const gpuInfoData = { 
          vendor, renderer, extensions,
          isAppleSilicon, isM3, maxTextureSize,
          version: gl.getParameter(gl.VERSION)
        };
        
        console.log('WebGL Info:', gpuInfoData);
        
        // Notify parent component of GPU info
        onGpuInfoUpdate(gpuInfoData);
        
        return {
          supported: true,
          version: gl instanceof WebGL2RenderingContext ? '2.0' : '1.0',
          vendor,
          renderer,
          isAppleSilicon,
          isM3,
          maxTextureSize,
          extensions: extensions.slice(0, 10) // Just show a few for brevity
        };
      } catch (e) {
        console.error('Error getting WebGL info:', e);
        return { supported: false, error: e.message };
      }
    };
    
    setWebglContextInfo(getWebGLInfo());
  }, [onGpuInfoUpdate]);
  
  // Check for memory pressure and monitor FPS
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId;
    
    const monitorPerformance = () => {
      // Count frames
      frameCount++;
      
      // Calculate FPS every second
      const currentTime = performance.now();
      const elapsed = currentTime - lastTime;
      
      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        
        // Keep a history of FPS values
        setFpsMonitor(prev => {
          const newHistory = [...prev.history, fps].slice(-30); // Keep last 30 values
          const avgFps = newHistory.reduce((sum, val) => sum + val, 0) / newHistory.length;
          
          // If average FPS drops below 30 and adaptive quality is enabled, enable low performance mode
          if (avgFps < 30 && !lowPerformanceMode && performanceSettings.adaptiveQuality) {
            console.warn('Low FPS detected, enabling low performance mode');
            setLowPerformanceMode(true);
          }
          
          // Report FPS to parent
          onFpsChange(avgFps);
          
          return { fps, history: newHistory };
        });
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      // Also check memory if available
      if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        // Report memory usage to parent
        onMemoryUsageChange(usageRatio);
        
        // Set thresholds based on hardware
        const warningThreshold = webglContextInfo?.isM3 ? 0.7 : 0.6;
        const criticalThreshold = webglContextInfo?.isM3 ? 0.85 : 0.75;
        
        // If memory usage is critically high, enable low performance mode
        if (usageRatio > criticalThreshold) {
          console.warn('Critical memory usage detected:', usageRatio.toFixed(2), 'enabling low performance mode');
          setMemoryWarning(true);
          setLowPerformanceMode(true);
        } else if (usageRatio > warningThreshold) {
          console.warn('High memory usage detected:', usageRatio.toFixed(2));
          setMemoryWarning(true);
          
          // Only enable low performance if needed and adaptive quality is enabled
          if (!lowPerformanceMode && usageRatio > 0.8 && performanceSettings.adaptiveQuality) {
            setLowPerformanceMode(true);
          }
        } else if (memoryWarning && usageRatio < warningThreshold - 0.1) {
          // Clear warning once memory drops sufficiently
          setMemoryWarning(false);
        }
      }
      
      // Continue the loop
      animationFrameId = requestAnimationFrame(monitorPerformance);
    };
    
    // Start monitoring
    animationFrameId = requestAnimationFrame(monitorPerformance);
    
    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    lowPerformanceMode, 
    memoryWarning, 
    webglContextInfo, 
    performanceSettings.adaptiveQuality, 
    onFpsChange, 
    onMemoryUsageChange
  ]);

  // Add WebGL context loss detection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let contextLostCount = 0;
    
    // Handler for WebGL context loss
    const handleContextLost = (event) => {
      event.preventDefault(); // Necessary to allow context restoration
      contextLostCount++;
      console.error(`WebGL context lost (${contextLostCount} times) in ThreeCanvas`);
      
      // Inform parent component
      if (onError) {
        onError({
          type: 'contextLost',
          count: contextLostCount,
          message: 'WebGL context lost. This is often caused by complex models or memory constraints.'
        });
      }
      
      // Display UI message for users
      const displayContextLostMessage = () => {
        // Check if message already exists
        if (document.getElementById('webgl-context-message')) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.id = 'webgl-context-message';
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '10px';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translateX(-50%)';
        messageDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
        messageDiv.style.color = 'white';
        messageDiv.style.padding = '10px 20px';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.zIndex = '9999';
        messageDiv.style.fontFamily = 'sans-serif';
        messageDiv.style.fontSize = '14px';
        messageDiv.style.textAlign = 'center';
        
        messageDiv.innerHTML = `
          <div>WebGL context lost. Attempting recovery...</div>
          <div style="font-size: 12px; margin-top: 5px;">Try disabling camera frustum before loading models</div>
        `;
        
        document.body.appendChild(messageDiv);
      };
      
      displayContextLostMessage();
      
      // Auto-cleanup for imported model if context is repeatedly lost
      if (contextLostCount >= 2 && selectedModel) {
        // Trigger unload after a short delay
        setTimeout(() => {
          if (onUnloadModel) onUnloadModel();
        }, 1000);
      }
    };
    
    // Handler for context restoration
    const handleContextRestored = () => {
      console.log('WebGL context restored in ThreeCanvas');
      
      // Inform parent
      if (onError) {
        onError({
          type: 'contextRestored',
          message: 'WebGL context restored. You may need to reload your model.'
        });
      }
      
      // Remove the message if it exists
      const messageDiv = document.getElementById('webgl-context-message');
      if (messageDiv) {
        messageDiv.remove();
      }
    };
    
    // Add event listeners to catch WebGL context events
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    // Cleanup
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      
      const messageDiv = document.getElementById('webgl-context-message');
      if (messageDiv) {
        messageDiv.remove();
      }
    };
  }, [onError, onUnloadModel, selectedModel]);
  
  // Handle reload application
  const handleReloadApplication = useCallback(() => {
    // Force a complete reload of the application
    window.location.reload();
  }, []);
  
  // Handle clear resources
  const handleClearResources = useCallback(() => {
    // Clean up memory aggressively
    THREE.Cache.clear();
    
    // Unload models
    onUnloadModel();
    
    // Clear context loss state to try rendering again
    setContextLost(false);
    
    // Force garbage collection if available
    if (window.gc) {
      try { window.gc(); } catch (e) { /* Ignore */ }
    }
    
    // Optional: reload the page after a delay
    if (contextLossCount > 2) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [onUnloadModel, contextLossCount]);
  
  // Main canvas content component
  const CanvasContent = React.memo(({ 
    performanceSettings, 
    memoryWarning, 
    lowPerformanceMode, 
    fpsMonitor, 
    webglContextInfo,
    // Model props
    selectedModel,
    modelVisible,
    modelScale,
    modelOpacity,
    pointSize,
    // Drone props
    dronePosition,
    droneRotation,
    showFrustum,
    cameraDetails,
    lensDetails,
    frustumScale
  }) => {
    return (
      <>
        {/* Performance monitoring */}
        {process.env.NODE_ENV === 'development' && (
          <Html position={[-5, 4, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{ 
              background: 'rgba(0,0,0,0.7)', 
              color: '#00ff00', 
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'monospace',
              lineHeight: '1.2'
            }}>
              FPS: {fpsMonitor.fps}<br/>
              Mode: {lowPerformanceMode ? 'Low' : 'High'}<br/>
              GPU: {webglContextInfo?.isM3 ? 'M3' : webglContextInfo?.isAppleSilicon ? 'Apple Silicon' : 'Standard'}
            </div>
          </Html>
        )}
        
        {/* Memory warning */}
        {memoryWarning && (
          <Html position={[0, 2, 0]} center>
            <div style={{ 
              background: 'rgba(255,165,0,0.8)', 
              color: 'white', 
              padding: '8px',
              borderRadius: '4px',
              fontSize: '12px',
              maxWidth: '200px',
              textAlign: 'center',
              zIndex: 1000
            }}>
              {lowPerformanceMode ? 
                'High memory usage detected. Performance has been automatically reduced.' : 
                'Memory usage is getting high. Consider closing other applications.'}
            </div>
          </Html>
        )}
        
        {/* Grid and scene elements */}
        <SimpleGrid />
        
        {/* Render the drone with custom model */}
        <DroneModel position={dronePosition} rotation={droneRotation} scale={1.0} />

        {/* Render camera frustum if enabled with adjusted scale to 25% */}
        {showFrustum && cameraDetails && lensDetails && (
          <group position={dronePosition} rotation={droneRotation.map(r => THREE.MathUtils.degToRad(r))}>
            {/* Calculate FOV based on sensor size and focal length */}
            {(() => {
              const { sensorWidth, sensorHeight } = cameraDetails;
              const { focalLength } = lensDetails;
              // Apply 25% scale adjustment to the frustum
              const scale = (frustumScale || 1.0) * 0.25;

              // Calculate horizontal and vertical FOV in radians
              const horizontalFOV = 2 * Math.atan(sensorWidth / (2 * focalLength));
              const verticalFOV = 2 * Math.atan(sensorHeight / (2 * focalLength));

              // Calculate dimensions at near and far planes
              const nearPlane = 0.5;
              const farPlane = 30.0 * scale;
              
              const nearHeight = 2 * Math.tan(verticalFOV / 2) * nearPlane;
              const nearWidth = 2 * Math.tan(horizontalFOV / 2) * nearPlane;
              const farHeight = 2 * Math.tan(verticalFOV / 2) * farPlane;
              const farWidth = 2 * Math.tan(horizontalFOV / 2) * farPlane;

              // Create points for the frustum
              const points = [
                // Near plane
                new THREE.Vector3(-nearWidth/2, -nearHeight/2, -nearPlane),
                new THREE.Vector3(nearWidth/2, -nearHeight/2, -nearPlane),
                new THREE.Vector3(nearWidth/2, nearHeight/2, -nearPlane),
                new THREE.Vector3(-nearWidth/2, nearHeight/2, -nearPlane),
                // Far plane
                new THREE.Vector3(-farWidth/2, -farHeight/2, -farPlane),
                new THREE.Vector3(farWidth/2, -farHeight/2, -farPlane),
                new THREE.Vector3(farWidth/2, farHeight/2, -farPlane),
                new THREE.Vector3(-farWidth/2, farHeight/2, -farPlane),
              ];

              // Create indices for lines
              const indices = [
                // Near plane
                0, 1, 1, 2, 2, 3, 3, 0,
                // Far plane
                4, 5, 5, 6, 6, 7, 7, 4,
                // Connecting lines
                0, 4, 1, 5, 2, 6, 3, 7
              ];

              // Create positions array for buffer geometry
              const positions = [];
              for (let i = 0; i < indices.length; i++) {
                const point = points[indices[i]];
                positions.push(point.x, point.y, point.z);
              }

              return (
                <>
                  <line>
                    <bufferGeometry>
                      <bufferAttribute
                        attach="attributes-position"
                        count={positions.length / 3}
                        array={new Float32Array(positions)}
                        itemSize={3}
                      />
                    </bufferGeometry>
                    <lineBasicMaterial color="#00ffff" opacity={0.6} transparent />
                  </line>
                  <mesh position={[0, 0, -farPlane/2]} rotation={[Math.PI / 2, 0, 0]}>
                    <coneGeometry args={[farWidth * 0.7, farPlane, 32]} />
                    <meshBasicMaterial color="#00ffff" opacity={0.1} transparent side={THREE.DoubleSide} />
                  </mesh>
                  <Html position={[0, 2, -5 * scale]}>
                    <div style={{
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      padding: '6px',
                      borderRadius: '4px',
                      fontSize: `${Math.max(12, 12 * Math.sqrt(scale))}px`,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 0 5px rgba(0,255,255,0.5)'
                    }}>
                      FOV: {Math.round(horizontalFOV * 180 / Math.PI)}° × {Math.round(verticalFOV * 180 / Math.PI)}°
                      <br />
                      {cameraDetails.brand} {cameraDetails.model}
                      <br />
                      {lensDetails.brand} {lensDetails.model}
                      <br />
                      <span style={{ fontSize: '0.8em', opacity: 0.8 }}>Scale: {(scale * 4).toFixed(1)}x</span>
                    </div>
                  </Html>
                </>
              );
            })()}
          </group>
        )}
        
        {/* Render 3D model if provided */}
        {selectedModel && modelVisible && (
          <ModelErrorBoundary>
            {selectedModel.importType === 'lidar' ? (
              // Always use Potree for all point cloud types
              <PotreePointCloud
                url={selectedModel.url}
                pointSize={selectedModel.pointSize || pointSize}
                opacity={modelOpacity}
                maxPoints={performanceSettings.maxPointsPerModel}
                maxLod={10}
                enableEDL={false}
                enableClipping={false}
                position={[0, 0, 0]}
                scale={modelScale}
                selectable={true}
                onProgress={(progress) => {
                  console.log(`Point cloud loading progress: ${Math.round(progress * 100)}%`);
                }}
              />
            ) : (
              // Use the appropriate loader based on file size and format
              selectedModel.useEnhancedLoading ? (
                // Use enhanced loader for large OBJ models
                <LargeModelViewer
                  url={selectedModel.url}
                  format={selectedModel.type}
                  scale={modelScale}
                  opacity={modelOpacity}
                  position={[0, 0, 0]}
                  rotation={[0, 0, 0]}
                  showStats={process.env.NODE_ENV === 'development'}
                  onLoad={(result) => {
                    console.log("Large model loaded successfully:", result);
                  }}
                  onError={(err) => {
                    console.error("Error loading large model:", err.message || err);
                    onError(err);
                  }}
                  onProgress={(progress) => {
                    console.log(`Large model loading progress: ${progress.phase} - ${Math.round(progress.progress * 100)}%`);
                  }}
                />
              ) : (
                // Use standard loader for smaller models
                <ModelLoader
                  url={selectedModel.url}
                  format={selectedModel.type}
                  scale={modelScale}
                  opacity={modelOpacity}
                  position={[0, 0, 0]}
                  rotation={[0, 0, 0]}
                  onLoad={(loadedModel) => {
                    console.log("Model loaded successfully:", loadedModel);
                  }}
                  onError={(err) => {
                    console.error("Error loading model:", err.message || err);
                    onError(err);
                  }}
                />
              )
            )}
          </ModelErrorBoundary>
        )}
      </>
    );
  }, [
    performanceSettings, 
    memoryWarning, 
    lowPerformanceMode, 
    fpsMonitor, 
    webglContextInfo,
    selectedModel,
    modelVisible,
    modelScale,
    modelOpacity,
    pointSize,
    dronePosition,
    droneRotation,
    showFrustum,
    cameraDetails,
    lensDetails,
    frustumScale,
    onError
  ]);
  
  // Return the actual Canvas component with proper configuration for M3 MacBook
  return (
    <CanvasErrorBoundary>
      {/* Add WebGL context recovery UI */}
      <WebGLContextRecovery 
        visible={contextLost} 
        onReload={handleReloadApplication}
        onClearResources={handleClearResources}
        count={contextLossCount}
      />
      
      <Canvas
        shadows={!lowPerformanceMode} // Disable shadows in low performance mode
        gl={{ 
          antialias: !lowPerformanceMode, // Disable antialiasing in low performance mode
          alpha: false, // No need for alpha in most 3D scenes
          stencil: false, // Disable stencil buffer to save memory
          depth: true, // Keep depth buffer
          powerPreference: performanceSettings.prioritizePerformance ? "high-performance" : "default",
          failIfMajorPerformanceCaveat: false, // Don't fail even if performance is poor
          preserveDrawingBuffer: false, // Don't preserve drawing buffer for better performance
          premultipliedAlpha: false, // Disable premultiplied alpha for better performance
          logarithmicDepthBuffer: false // Disable logarithmic depth buffer unless needed
        }}
        // Reduce DPR more for low-performance mode
        dpr={lowPerformanceMode ? 0.75 : (window.devicePixelRatio > 1.5 ? 1.5 : window.devicePixelRatio || 1)} 
        frameloop={lowPerformanceMode ? "demand" : "always"} // Only render on demand in low performance mode
        camera={{ position: [5, 5, 5], fov: 50 }}
        onCreated={({ gl }) => {
          // Configure renderer
          gl.setClearColor('#111133', 1);  // Slightly blue-tinted background
          gl.physicallyCorrectLights = true;
          
          // Limit memory usage (may help prevent context loss)
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          
          // Disable automatic clearing to improve performance
          if (lowPerformanceMode) {
            gl.autoClear = false;
          }
          
          // Log WebGL context creation
          console.log('WebGL context created:', gl);
        }}
      >
        {!contextLost && (
          <SceneSetup>
            <CameraControls target={cameraTarget} />
            <CanvasContent 
              performanceSettings={performanceSettings} 
              memoryWarning={memoryWarning} 
              lowPerformanceMode={lowPerformanceMode} 
              fpsMonitor={fpsMonitor} 
              webglContextInfo={webglContextInfo}
              selectedModel={selectedModel}
              modelVisible={modelVisible}
              modelScale={modelScale}
              modelOpacity={modelOpacity}
              pointSize={pointSize}
              dronePosition={dronePosition}
              droneRotation={droneRotation}
              showFrustum={showFrustum}
              cameraDetails={cameraDetails}
              lensDetails={lensDetails}
              frustumScale={frustumScale}
            />
          </SceneSetup>
        )}
      </Canvas>
    </CanvasErrorBoundary>
  );
};

export default ThreeCanvas; 