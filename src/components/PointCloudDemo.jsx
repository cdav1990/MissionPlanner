import React, { useState, useCallback, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Stats } from '@react-three/drei';
import EnhancedPointCloud from './EnhancedPointCloud';
import { applyGeometrySanitization } from '../utils/geometryUtils';
import styled from 'styled-components';

// Apply global sanitization to prevent NaN errors
applyGeometrySanitization();

// Styled components for the UI
const Container = styled.div`
  width: 100%;
  height: 100vh;
  position: relative;
  background: #111;
`;

const Controls = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 4px;
  z-index: 100;
  width: 200px;
`;

const Label = styled.label`
  display: block;
  margin: 5px 0;
`;

// Default point cloud samples
const SAMPLE_POINT_CLOUDS = [
  { name: 'Bunny (PLY)', url: '/samples/bunny.ply', type: 'standard' },
  { name: 'Test Cube (PLY)', url: '/samples/test-cube.ply', type: 'standard' },
  { name: 'Potree Example (Forest)', url: '/potree-data/forest/metadata.json', type: 'potree' },
];

// Default color options
const COLOR_OPTIONS = [
  { name: 'White', value: '#ffffff' },
  { name: 'RGB Points (from file)', value: 'rgb' },
  { name: 'Height-based', value: 'height' },
  { name: 'Red', value: '#ff0000' },
  { name: 'Green', value: '#00ff00' },
  { name: 'Blue', value: '#0088ff' },
];

// Performance profile options
const PERFORMANCE_PROFILES = [
  { name: 'Auto-detect', value: null },
  { name: 'Low', value: 'low' },
  { name: 'Medium', value: 'medium' },
  { name: 'High', value: 'high' },
  { name: 'Ultra', value: 'ultra' },
];

function PointCloudDemo() {
  // State
  const [selectedSample, setSelectedSample] = useState(SAMPLE_POINT_CLOUDS[0].url);
  const [sampleType, setSampleType] = useState(SAMPLE_POINT_CLOUDS[0].type);
  const [customFile, setCustomFile] = useState(null);
  const [pointSize, setPointSize] = useState(0.01);
  const [colorOption, setColorOption] = useState(COLOR_OPTIONS[0].value);
  const [autoScale, setAutoScale] = useState(true);
  const [usePotree, setUsePotree] = useState(true);
  const [performanceProfile, setPerformanceProfile] = useState(null);
  const [potreeAvailable, setPotreeAvailable] = useState(false);
  
  // Check for Potree availability
  useEffect(() => {
    const isPotreeAvailable = 
      typeof window !== 'undefined' && 
      window.Potree && 
      window.Potree.PointCloudOctreeLoader;
    
    setPotreeAvailable(isPotreeAvailable);
    console.log('Potree availability checked:', isPotreeAvailable);
  }, []);
  
  // Handle file upload
  const handleFileChange = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Create URL for the file
    const fileUrl = URL.createObjectURL(file);
    setCustomFile(fileUrl);
    setSelectedSample(fileUrl);
    
    // Determine if this could be a Potree file
    const isPotreeFile = file.name.includes('metadata.json') || 
                         file.name.includes('cloud.js');
    
    // Set file type based on name
    setSampleType(isPotreeFile ? 'potree' : 'standard');
    
    // Reset other settings to appropriate defaults
    setPointSize(0.01);
    setAutoScale(true);
    setColorOption(COLOR_OPTIONS[0].value);
  }, []);
  
  // Handle sample selection
  const handleSampleChange = useCallback((event) => {
    const selectedUrl = event.target.value;
    setSelectedSample(selectedUrl);
    
    // Find the sample type
    const sample = SAMPLE_POINT_CLOUDS.find(s => s.url === selectedUrl);
    setSampleType(sample ? sample.type : 'standard');
    
    // Clear custom file when selecting a sample
    if (customFile) {
      URL.revokeObjectURL(customFile);
      setCustomFile(null);
    }
  }, [customFile]);
  
  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any object URLs
      if (customFile) {
        URL.revokeObjectURL(customFile);
      }
    };
  }, [customFile]);
  
  // Handle point cloud loading errors
  const handleError = useCallback((error) => {
    console.error('Point cloud error:', error);
    alert(`Error loading point cloud: ${error.message || 'Unknown error'}`);
  }, []);
  
  // Renderer settings based on file type
  const shouldUsePotree = potreeAvailable && usePotree && (
    sampleType === 'potree' || 
    selectedSample.includes('metadata.json') || 
    selectedSample.includes('cloud.js')
  );
  
  // Calculate color by height
  const colorByHeight = colorOption === 'height';
  
  return (
    <Container>
      <Controls>
        <h3>Point Cloud Controls</h3>
        
        <Label>
          Sample Point Cloud:
          <select value={selectedSample} onChange={handleSampleChange}>
            {SAMPLE_POINT_CLOUDS.map((sample) => (
              <option key={sample.url} value={sample.url}>
                {sample.name} {sample.type === 'potree' ? '(Potree)' : ''}
              </option>
            ))}
          </select>
        </Label>
        
        <Label>
          Upload Point Cloud:
          <input 
            type="file" 
            accept=".ply,.pcd,.las,.laz,metadata.json,cloud.js" 
            onChange={handleFileChange} 
          />
          <small>
            Supported formats: PLY, PCD, LAS/LAZ, Potree (metadata.json/cloud.js)
          </small>
        </Label>
        
        <Label>
          Point Size: {pointSize.toFixed(3)}
          <input 
            type="range" 
            min="0.001" 
            max="0.05" 
            step="0.001" 
            value={pointSize} 
            onChange={(e) => setPointSize(parseFloat(e.target.value))} 
          />
        </Label>
        
        <Label>
          Color Mode:
          <select 
            value={colorOption} 
            onChange={(e) => setColorOption(e.target.value)}
          >
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
        </Label>
        
        <Label>
          <input 
            type="checkbox" 
            checked={autoScale} 
            onChange={(e) => setAutoScale(e.target.checked)} 
          />
          Auto Scale
        </Label>
        
        <Label>
          Performance Profile:
          <select 
            value={performanceProfile || ''} 
            onChange={(e) => setPerformanceProfile(e.target.value || null)}
          >
            {PERFORMANCE_PROFILES.map((profile) => (
              <option key={profile.name} value={profile.value || ''}>
                {profile.name}
              </option>
            ))}
          </select>
        </Label>
        
        <Label>
          <input 
            type="checkbox" 
            checked={usePotree} 
            onChange={(e) => setUsePotree(e.target.checked)}
            disabled={!potreeAvailable}
          />
          Use Potree for LOD (when available)
        </Label>
        
        {!potreeAvailable && (
          <small className="potree-status error">
            Potree library not detected! Add it to index.html to enable LOD support.
          </small>
        )}
        {potreeAvailable && (
          <small className="potree-status success">
            Potree library detected and ready for large point clouds.
          </small>
        )}
      </Controls>
      
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 2]} // Adjust based on device pixel ratio
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#111']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        
        <Suspense fallback={
          <Html center>
            <div style={{ color: 'white' }}>Loading scene...</div>
          </Html>
        }>
          <EnhancedPointCloud
            url={selectedSample}
            pointSize={pointSize}
            colorByHeight={colorByHeight}
            color={colorOption !== 'rgb' && colorOption !== 'height' ? colorOption : '#ffffff'}
            autoScale={autoScale}
            onError={handleError}
            forceProfile={performanceProfile}
            usePotree={usePotree}
            potreeMaxPoints={5_000_000}
          />
        </Suspense>
        
        <OrbitControls 
          target={[0, 0, 0]}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
        />
        
        <axesHelper args={[1]} />
        <Stats />
      </Canvas>
      
      <style jsx>{`
        .point-cloud-demo {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e2e;
          color: #fff;
          padding: 16px;
          border-radius: 8px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .controls-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          grid-gap: 16px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          margin-bottom: 16px;
        }
        
        .form-group {
          margin-bottom: 12px;
        }
        
        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #ccc;
        }
        
        select, input[type="range"] {
          width: 100%;
          padding: 8px;
          background: #333;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
        }
        
        input[type="file"] {
          width: 100%;
          padding: 8px 0;
        }
        
        .checkbox {
          display: flex;
          align-items: center;
        }
        
        .checkbox label {
          display: flex;
          align-items: center;
          margin-bottom: 0;
        }
        
        .checkbox input {
          margin-right: 8px;
        }
        
        small {
          display: block;
          margin-top: 4px;
          color: #aaa;
          font-size: 0.8em;
        }
        
        .canvas-container {
          flex: 1;
          position: relative;
          min-height: 500px;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
        }
        
        .render-info {
          grid-column: 1 / -1;
          background: rgba(0, 0, 0, 0.2);
          padding: 8px 12px;
          border-radius: 4px;
          margin-top: 8px;
        }
        
        .render-info p {
          margin: 4px 0;
          font-size: 0.9em;
          color: #ccc;
        }
        
        .potree-status {
          padding: 4px 8px;
          margin-top: 4px;
          border-radius: 4px;
        }
        
        .potree-status.error {
          background: rgba(255, 0, 0, 0.2);
          color: #ff8080;
        }
        
        .potree-status.success {
          background: rgba(0, 255, 0, 0.2);
          color: #80ff80;
        }
      `}</style>
    </Container>
  );
}

export default PointCloudDemo; 