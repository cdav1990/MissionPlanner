import React, { useState, useEffect, Suspense, useRef, useReducer, useMemo, useCallback } from 'react';
import { Canvas, useThree, extend } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader';
import { applyGeometrySanitization, sanitizeGeometry } from '../utils/geometryUtils';
import DroneMissionEnhanced from './DroneMissionEnhanced';
import MissionPlannerIntegration from './MissionPlannerIntegration';
import ModelLoader from './ModelLoader';
import DroneSelector from './DroneSelector';
import SelectableModel from './SelectableModel';
import SelectionControls from './SelectionControls';
import PotreePointCloud from './PotreePointCloud';
import SimplePointCloud from './SimplePointCloud';
import MultiPointCloudManager from './MultiPointCloudManager';
import PointCloudControls from './PointCloudControls';
import styled from 'styled-components';
import ReactSlider from 'react-slider';
import { Button } from '@mui/material';
import { FiChevronDown, FiChevronUp, FiCamera, FiCrosshair, FiMap, FiTarget, FiBox, FiSettings, FiMaximize, FiZoomIn } from 'react-icons/fi';
import { ModelErrorBoundary, CanvasErrorBoundary, ErrorBoundary } from './ErrorBoundaries.jsx';
import SidebarPerformanceControls from './SidebarPerformanceControls';
import ThreeCanvas from './ThreeCanvas';

// Apply the sanitization to THREE.BufferGeometry early
// This will prevent NaN errors in all geometries
applyGeometrySanitization();

// Define styled components for ReactSlider
const StyledSlider = styled(ReactSlider)`
  width: 100%;
  height: 20px;
  touch-action: none;
`;

const SliderThumb = styled.div`
  height: 20px;
  width: 20px;
  background-color: white;
  border-radius: 50%;
  border: 2px solid #4f88e3;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: grab;
  top: -6px;
  outline: none;
  touch-action: none;
  position: relative;
  z-index: 2;
  transition: transform 0.1s ease, background-color 0.1s ease;
  user-select: none;
  -webkit-user-select: none;
  
  &:hover {
    background-color: #f0f8ff;
    transform: scale(1.1);
  }
  
  &:active {
    cursor: grabbing;
    background-color: #e6f0ff;
    transform: scale(1.15);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
  }
`;

const SliderTrack = styled.div`
  top: 6px;
  height: 8px;
  background: ${props => (props.index === 1 || props.index === undefined) ? '#333' : 'linear-gradient(to right, #1a5bb7, #4f88e3)'};
  border-radius: 4px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 1;
`;

// Styled components for the MissionPlanner layout
const MissionPlannerContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #1a1a1a;
  color: white;
`;

const ControlsPanel = styled.div`
  width: 320px;
  padding: 20px;
  background-color: rgba(0, 0, 0, 0.7);
  border-right: 1px solid #333;
  overflow-y: auto;
  z-index: 10;
`;

const FileControls = styled.div`
  margin-bottom: 20px;
`;

const CanvasContainer = styled.div`
  flex: 1;
  position: relative;
`;

const ToggleButton = styled.button`
  position: absolute;
  top: 10px;
  left: ${props => props.isCollapsed ? '10px' : '330px'};
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  z-index: 20;
  transition: left 0.3s ease;
  
  &:hover {
    background: rgba(30, 30, 30, 0.9);
  }
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #333;
`;

const Tab = styled.button`
  background: ${props => props.active ? 'rgba(50, 120, 200, 0.3)' : 'transparent'};
  color: white;
  border: none;
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? '#4c9ce0' : 'transparent'};
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(50, 120, 200, 0.2);
  }
`;

/**
 * Enhanced MissionPlanner component with integrated point cloud support
 */
function MissionPlanner({ 
  initialCameraDetails, 
  initialLensDetails, 
  initialDofCalculations,
  contextLostCount = 0,
  deviceCapabilities = null // Make it optional with default
}) {
  // Basic state for mission planning
  const [waypoints, setWaypoints] = useState([]);
  
  // Drone position and rotation state
  const [dronePosition, setDronePosition] = useState([0, 10, 0]);
  const [droneRotation, setDroneRotation] = useState([0, 0, 0]);
  
  // Camera/scene navigation controls
  const [followDrone, setFollowDrone] = useState(false);
  const [centerOnMap, setCenterOnMap] = useState(true);
  const [showFrustum, setShowFrustum] = useState(true);
  
  // Add model and scene states
  const [cameraDetails, setCameraDetails] = useState(initialCameraDetails || {});
  const [lensDetails, setLensDetails] = useState(initialLensDetails || {});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [importedModel, setImportedModel] = useState(null);
  const [modelVisible, setModelVisible] = useState(true);
  const [modelScale, setModelScale] = useState(1.0);
  const [modelOpacity, setModelOpacity] = useState(1.0);
  const [frustumScale, setFrustumScale] = useState(1.0);
  
  // UI state
  const [activeTab, setActiveTab] = useState('drone');
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  
  // Performance settings
  const [performanceSettings, setPerformanceSettings] = useState({
    lowPowerMode: false,
    prioritizePerformance: true,
    adaptiveQuality: true,
    pointSize: 0.01,
    maxPointsPerModel: 2000000
  });
  
  // Point cloud state
  const [pointClouds, setPointClouds] = useState([]);
  const [pointCloudLoading, setPointCloudLoading] = useState(false);
  
  // Reference to track created object URLs for cleanup
  const objectUrlsRef = useRef([]);
  
  // Handle adding a new point cloud
  const handleAddPointCloud = useCallback((pointCloud) => {
    // Add the point cloud to state
    setPointClouds(prev => [...prev, pointCloud]);
    
    // Track the object URL for cleanup
    if (pointCloud.url && pointCloud.url.startsWith('blob:')) {
      objectUrlsRef.current.push(pointCloud.url);
    }
  }, []);
  
  // Handle removing a point cloud
  const handleRemovePointCloud = useCallback((id) => {
    // Find the point cloud to remove
    const cloudToRemove = pointClouds.find(pc => pc.id === id);
    
    // Remove it from state
    setPointClouds(prev => prev.filter(pc => pc.id !== id));
    
    // Revoke the object URL if it was created from a file
    if (cloudToRemove && cloudToRemove.url && cloudToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(cloudToRemove.url);
      objectUrlsRef.current = objectUrlsRef.current.filter(url => url !== cloudToRemove.url);
    }
  }, [pointClouds]);
  
  // Handle toggling point cloud visibility
  const handleTogglePointCloud = useCallback((id) => {
    setPointClouds(prev => prev.map(pc => 
      pc.id === id ? { ...pc, visible: !pc.visible } : pc
    ));
  }, []);
  
  // Handle updating point cloud properties
  const handleUpdatePointCloud = useCallback((id, updates) => {
    setPointClouds(prev => prev.map(pc => 
      pc.id === id ? { ...pc, ...updates } : pc
    ));
  }, []);
  
  // Handle selecting a sample point cloud
  const handleSelectSample = useCallback((sample) => {
    setPointCloudLoading(true);
    
    // Generate a unique ID
    const id = `sample-${Date.now()}`;
    
    // Add the sample point cloud
    handleAddPointCloud({
      id,
      name: sample.split('.')[0],
      url: `/point-clouds/${sample}`,
      pointSize: performanceSettings.pointSize,
      visible: true,
      colorByHeight: false,
      autoScale: true
    });
    
    setPointCloudLoading(false);
  }, [handleAddPointCloud, performanceSettings.pointSize]);
  
  // Handle point cloud load
  const handlePointCloudLoad = useCallback((id, pointCloud) => {
    console.log(`Point cloud ${id} loaded successfully`, pointCloud);
    setPointCloudLoading(false);
  }, []);
  
  // Handle point cloud error
  const handlePointCloudError = useCallback((id, error) => {
    console.error(`Error loading point cloud ${id}:`, error);
    setPointCloudLoading(false);
  }, []);
  
  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      // Revoke all created object URLs
      objectUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('Error revoking URL:', error);
        }
      });
    };
  }, []);
  
  const renderPerformanceControls = () => {
    return (
      <div>
        <SidebarPerformanceControls 
          deviceInfo={deviceCapabilities || { 
            rendererInfo: { renderer: 'Unknown' },
            webgl2Supported: true,
            riskOfContextLoss: 'unknown', 
            recommendations: []
          }}
          settings={performanceSettings}
          onSettingsChange={setPerformanceSettings}
        />
      </div>
    );
  }
  
  // Custom Slider component using the styled components
  const CustomSlider = ({ value, onChange, min, max, step, label }) => {
    // Handle undefined value
    const safeValue = value !== undefined ? value : min || 0;
    const displayMin = min || 0;
    const displayMax = max || 100;
    const displayStep = step || 1;
    
    return (
      <div style={{ margin: '10px 0' }}>
        {label && <div style={{ marginBottom: '5px', fontSize: '14px' }}>{label}</div>}
        <div style={{ padding: '10px 0' }}>
          <StyledSlider
            value={safeValue}
            onChange={onChange}
            min={displayMin}
            max={displayMax}
            step={displayStep}
            renderTrack={(props, state) => (
              <div
                {...props}
                style={{
                  ...props.style,
                  height: '8px',
                  borderRadius: '4px',
                  background: 'linear-gradient(to right, #1a5bb7, #4f88e3)',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)'
                }}
              />
            )}
            renderThumb={(props) => (
              <div
                {...props}
                style={{
                  ...props.style,
                  height: '20px',
                  width: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  border: '2px solid #4f88e3',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'grab',
                  outline: 'none',
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}
              />
            )}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span>{displayMin}</span>
          <span>{typeof safeValue === 'number' ? safeValue.toFixed(2) : safeValue}</span>
          <span>{displayMax}</span>
        </div>
      </div>
    );
  };
  
  // Drone position and rotation controls
  const ManualDroneControls = () => {
    const handlePositionChange = (axis, value) => {
      const newPosition = [...dronePosition];
      newPosition[axis] = value;
      setDronePosition(newPosition);
    };
    
    const handleRotationChange = (axis, value) => {
      const newRotation = [...droneRotation];
      newRotation[axis] = value;
      setDroneRotation(newRotation);
    };
    
    return (
      <div style={{ marginTop: '20px' }}>
        <h4>Drone Position</h4>
        <CustomSlider 
          label="X Position" 
          value={dronePosition[0]} 
          onChange={(val) => handlePositionChange(0, val)} 
          min={-20} 
          max={20} 
          step={0.1} 
        />
        <CustomSlider 
          label="Y Position (Height)" 
          value={dronePosition[1]} 
          onChange={(val) => handlePositionChange(1, val)} 
          min={0.5} 
          max={50} 
          step={0.1} 
        />
        <CustomSlider 
          label="Z Position" 
          value={dronePosition[2]} 
          onChange={(val) => handlePositionChange(2, val)} 
          min={-20} 
          max={20} 
          step={0.1} 
        />
        
        <h4>Drone Rotation</h4>
        <CustomSlider 
          label="X Rotation (Pitch)" 
          value={droneRotation[0]} 
          onChange={(val) => handleRotationChange(0, val)} 
          min={-Math.PI / 2} 
          max={Math.PI / 2} 
          step={0.01} 
        />
        <CustomSlider 
          label="Y Rotation (Yaw)" 
          value={droneRotation[1]} 
          onChange={(val) => handleRotationChange(1, val)} 
          min={-Math.PI} 
          max={Math.PI} 
          step={0.01} 
        />
        <CustomSlider 
          label="Z Rotation (Roll)" 
          value={droneRotation[2]} 
          onChange={(val) => handleRotationChange(2, val)} 
          min={-Math.PI / 2} 
          max={Math.PI / 2} 
          step={0.01} 
        />
      </div>
    );
  };
  
  return (
    <MissionPlannerContainer>
      {/* Toggle button for collapsing/expanding the controls panel */}
      <ToggleButton 
        isCollapsed={isMenuCollapsed}
        onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
      >
        {isMenuCollapsed ? <FiChevronUp /> : <FiChevronDown />}
      </ToggleButton>
      
      {/* Controls panel (sidebar) */}
      <ControlsPanel style={{ transform: isMenuCollapsed ? 'translateX(-320px)' : 'translateX(0)', transition: 'transform 0.3s ease' }}>
        <TabContainer>
          <Tab 
            active={activeTab === 'drone'} 
            onClick={() => setActiveTab('drone')}
          >
            Drone Mission
          </Tab>
          <Tab 
            active={activeTab === 'model'} 
            onClick={() => setActiveTab('model')}
          >
            3D Models
          </Tab>
          <Tab 
            active={activeTab === 'pointcloud'} 
            onClick={() => setActiveTab('pointcloud')}
          >
            Point Clouds
          </Tab>
        </TabContainer>
        
        {/* Drone mission controls */}
        {activeTab === 'drone' && (
          <div>
            {/* Drone mission controls content */}
            <h3>Drone Mission Planner</h3>
            <ManualDroneControls />
          </div>
        )}
        
        {/* 3D model controls */}
        {activeTab === 'model' && (
          <div>
            {/* 3D model controls content */}
            <h3>3D Model Controls</h3>
            {/* Add your 3D model controls here */}
          </div>
        )}
        
        {/* Point cloud controls */}
        {activeTab === 'pointcloud' && (
          <PointCloudControls
            pointClouds={pointClouds}
            onAddPointCloud={handleAddPointCloud}
            onRemovePointCloud={handleRemovePointCloud}
            onTogglePointCloud={handleTogglePointCloud}
            onUpdatePointCloud={handleUpdatePointCloud}
            onSelectSample={handleSelectSample}
          />
        )}
        
        {/* Performance controls shared across all tabs */}
        {renderPerformanceControls()}
      </ControlsPanel>
      
      {/* Main canvas container */}
      <CanvasContainer>
        <CanvasErrorBoundary>
          <Canvas
            shadows
            gl={{ antialias: true, alpha: false }}
            camera={{ position: [0, 5, 10], fov: 50 }}
          >
            {/* Scene setup */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
            <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
            
            {/* Grid and coordinate axes */}
            <group>
              <gridHelper args={[100, 100, '#444444', '#222222']} position={[0, 0.01, 0]} />
              
              {/* Coordinate axes */}
              <group>
                {/* X-axis (red) */}
                <mesh position={[5, 0.02, 0]}>
                  <boxGeometry args={[10, 0.03, 0.03]} onUpdate={(geom) => sanitizeGeometry(geom)} />
                  <meshBasicMaterial color="#ff4444" />
                </mesh>
                
                {/* Y-axis (green) */}
                <mesh position={[0, 5, 0]}>
                  <boxGeometry args={[0.03, 10, 0.03]} onUpdate={(geom) => sanitizeGeometry(geom)} />
                  <meshBasicMaterial color="#44ff44" />
                </mesh>
                
                {/* Z-axis (blue) */}
                <mesh position={[0, 0.02, 5]}>
                  <boxGeometry args={[0.03, 0.03, 10]} onUpdate={(geom) => sanitizeGeometry(geom)} />
                  <meshBasicMaterial color="#4444ff" />
                </mesh>
              </group>
            </group>
            
            {/* Orbit controls */}
            <OrbitControls 
              enableDamping 
              dampingFactor={0.1} 
              rotateSpeed={0.5}
            />
            
            {/* Point cloud manager */}
            <ErrorBoundary>
              <Suspense fallback={
                <Html center>
                  <div style={{ color: 'white', background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '4px' }}>
                    Loading point clouds...
                  </div>
                </Html>
              }>
                <MultiPointCloudManager
                  pointClouds={pointClouds}
                  onPointCloudLoad={handlePointCloudLoad}
                  onPointCloudError={handlePointCloudError}
                  performanceSettings={performanceSettings}
                />
              </Suspense>
            </ErrorBoundary>
            
            {/* Add your drone model and other scene elements here */}
          </Canvas>
        </CanvasErrorBoundary>
      </CanvasContainer>
    </MissionPlannerContainer>
  );
}

export default MissionPlanner; 