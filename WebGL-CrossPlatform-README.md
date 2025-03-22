# WebGL Cross-Platform Compatibility 

This README explains the changes made to fix WebGL context loss issues and improve cross-platform compatibility between Mac M3, other Apple Silicon devices, and Windows machines.

## Overview of Changes

1. **Platform Detection (PlatformDetection.js)**
   - Enhanced to specifically detect M3 Macs vs other Apple Silicon
   - Added Windows detection
   - Provides optimized settings for each platform type
   - Differentiates between high-end and low-end systems

2. **WebGL Context Manager (WebGLContextManager.js)** 
   - New centralized system for handling WebGL contexts
   - Automatic recovery from context loss
   - Memory monitoring to prevent context loss
   - Platform-specific optimizations for each device type

3. **Potree Optimizations (PotreeUtils.js)**
   - Modified to use different point budgets based on platform
   - More aggressive memory management for Apple Silicon
   - Optimized material properties for each platform
   - Better geometry optimization to reduce memory use

4. **ThreeContextRecovery.js Updates**
   - Improved context recovery mechanisms
   - Better memory cleanup during recovery
   - More robust context restoration

5. **UI Improvements**
   - Added WebGL context loss overlay with recovery button
   - Enhanced error messaging for users
   - Platform-specific rendering settings

## How to Use

### WebGLContextManager

The new `WebGLContextManager` provides a centralized way to manage WebGL contexts:

```jsx
// Import the manager
import WebGLContextManager from '../utils/WebGLContextManager';

// In your component:
const MyComponent = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Register with the WebGL context manager
    const unregister = WebGLContextManager.registerCanvas(canvasRef.current, {
      onContextLost: () => console.log('Context lost'),
      onContextRestored: () => console.log('Context restored'),
      autoRecover: true
    });
    
    return () => unregister();
  }, [canvasRef.current]);
  
  return <canvas ref={canvasRef} />;
};
```

### React Integration with React Three Fiber

When using with React Three Fiber:

```jsx
// In your component:
const ThreeScene = () => {
  const canvasRef = useRef(null);
  const [isContextLost, setIsContextLost] = useState(false);
  
  // Platform detection
  const isAppleSiliconDevice = useMemo(() => isAppleSilicon(), []);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const unregister = WebGLContextManager.registerCanvas(canvasRef.current, {
      onContextLost: () => setIsContextLost(true),
      onContextRestored: () => setIsContextLost(false)
    });
    
    return () => unregister();
  }, [canvasRef.current]);
  
  return (
    <>
      <Canvas
        ref={canvasRef}
        gl={{
          powerPreference: isAppleSiliconDevice ? 'low-power' : 'high-performance',
          antialias: !isAppleSiliconDevice,
          alpha: false,
          depth: true,
          stencil: false
        }}
        dpr={isAppleSiliconDevice ? Math.min(window.devicePixelRatio, 1.0) : window.devicePixelRatio}
        shadows={!isAppleSiliconDevice}
      >
        {/* Your scene */}
      </Canvas>
      
      {isContextLost && (
        <div className="context-lost-overlay">
          <h3>WebGL Context Lost</h3>
          <button onClick={() => WebGLContextManager.attemptRecovery(canvasRef.current.id)}>
            Recover
          </button>
        </div>
      )}
    </>
  );
};
```

### Potree Integration

When using Potree for point clouds:

```jsx
import * as PotreeUtils from '../utils/PotreeUtils';

// Initialize Potree with platform optimizations
useEffect(() => {
  PotreeUtils.initPotree().then(result => {
    console.log('Potree initialization result:', result);
  });
}, []);

// Load a point cloud with cross-platform optimizations
const loadPointCloud = async (url) => {
  try {
    const cloud = await PotreeUtils.loadPointCloud(url);
    scene.add(cloud);
  } catch (e) {
    console.error('Error loading point cloud:', e);
  }
};
```

## Platform-Specific Optimizations

### Apple Silicon (M3)
- Uses higher point budgets than other Apple Silicon
- Enables more advanced rendering features
- Optimizes for performance and memory usage

### Other Apple Silicon
- Reduces point budget to prevent memory issues
- Disables expensive rendering features
- Uses low-power mode to conserve energy

### Windows
- Detects high-end vs. low-end systems
- Scales rendering quality accordingly
- Optimizes for available GPU capabilities

## Troubleshooting

If you still experience WebGL context loss:

1. Try reducing the maximum point count in large point clouds
2. Disable any post-processing effects
3. Reduce the canvas resolution in high-DPI displays
4. Ensure your graphics drivers are up to date
5. Close memory-intensive applications running in the background

## Performance Monitoring

The system includes memory monitoring to detect pressure before context loss occurs:

```jsx
// Force a cleanup if you detect performance issues
WebGLContextManager.preventiveCleanup();
``` 