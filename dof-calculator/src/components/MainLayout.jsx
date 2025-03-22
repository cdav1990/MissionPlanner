import React, { useState, useRef, useEffect, Suspense, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid as DreiGrid, Environment, useBounds, Stats, AdaptiveDpr, AdaptiveEvents, Loader, useHelper, GizmoHelper, GizmoViewport, Plane, Line, Html, Text } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom, DepthOfField, Outline } from '@react-three/postprocessing';
import { Perf } from 'r3f-perf';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import DOFCalculator from './DOFCalculator'; // Import the original DOFCalculator component
import DroneMissionEnhanced from './DroneMissionEnhanced'; // Import drone mission planner
import MissionPlannerIntegration from './MissionPlannerIntegration'; // Import mission visualization
import MissionPlanner from './MissionPlanner'; // Import the extracted MissionPlanner component
import ModelLoader from './ModelLoader'; // Import ModelLoader component
import ModelLoaderUtils from './ModelLoaderUtils'; // Import ModelLoaderUtils separately
// Remove import PotreeExample - we'll fall back to standard Three.js
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { FiChevronLeft, FiChevronRight, FiMenu } from 'react-icons/fi';
import { IoWarningOutline, IoCheckmarkCircleOutline, IoInformationCircleOutline, IoAirplane } from 'react-icons/io5';
import { 
  useWebGLContextHandler, 
  forceContextRecovery, 
  assessDeviceWebGLCapability, 
  setupContextLossHandling,
  setupWebGLRecoveryHandler
} from '../utils/ThreeContextRecovery'; // Import the context recovery handler
import * as PotreeUtils from '../utils/PotreeUtils'; // Import fixed PotreeUtils
// Import our shared error boundary components
import { ModelErrorBoundary, CanvasErrorBoundary, ErrorBoundary } from './ErrorBoundaries.jsx';

// Define a robust OusterPcapProcessor to prevent crashes
const OusterPcapProcessor = function(options) {
  console.log('Using enhanced mock OusterPcapProcessor with options:', options);
  
  // Store options safely
  this.options = {
    sensorType: options?.sensorType || 'OS1-64',
    frameCount: parseInt(options?.frameCount || 1),
    skipFrames: parseInt(options?.skipFrames || 0),
    pointLimit: 2000000
  };
  
  // Process file method with proper error handling
  this.processFile = function(file, onProgress) {
    console.log('OusterPcapProcessor.processFile called with:', file);
    
    if (!file) {
      return Promise.reject(new Error('No file provided'));
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Simulate progress updates
        let processed = 0;
        const total = 100;
        const interval = setInterval(() => {
          processed += 10;
          if (processed > total) {
            clearInterval(interval);
            return;
          }
          
          if (typeof onProgress === 'function') {
            onProgress({ processed, total });
          }
        }, 300);
        
        // Simulate completion after 3 seconds
        setTimeout(() => {
          clearInterval(interval);
          
          // Generate sample point cloud data
          const pointCount = 10000;
          const positions = new Array(pointCount * 3).fill(0).map(() => (Math.random() - 0.5) * 10);
          const colors = new Array(pointCount * 3).fill(0).map(() => Math.random());
          const intensity = new Array(pointCount).fill(0).map(() => Math.random());
          
          resolve({
            positions,
            colors,
            intensity,
            metadata: { 
              pointCount, 
              fileName: file.name,
              sensorType: this.options.sensorType,
              frameCount: this.options.frameCount,
              processingTime: 3000
            }
          });
        }, 3000);
      } catch (error) {
        console.error("Error in mock PCAP processing:", error);
        reject(error);
      }
    });
  };
};

// Define CSS variables 
const StyledVars = styled.div`
  --bg-light: #232323;
  --bg-medium: #1e1e1e;
  --text-light: #ffffff;
  --text-dim: #a0a0a0;
  --border-color: #333333;
  --highlight-color: #2c2c2c;
  --accent-color: #4f88e3;
  --border-radius: 8px;
  --border-radius-sm: 4px;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
`;

// Styled components for layout
const LayoutContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const TabBar = styled.div`
  display: flex;
  width: 100%;
  background-color: #131313;
  height: 50px;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
`;

const TabButton = styled(motion.button)`
  background-color: ${props => props.active ? 'var(--highlight-color)' : 'transparent'};
  color: ${props => props.active ? 'var(--accent-color)' : 'var(--text-dim)'};
  border: none;
  padding: 0 20px;
  height: 100%;
  cursor: pointer;
  font-size: 14px;
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: var(--accent-color);
    transform: scaleX(${props => props.active ? 1 : 0});
    transition: transform 0.2s ease;
  }
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100% - 50px);
  overflow: hidden;
`;

const MenuPane = styled(motion.div)`
  width: ${props => props.collapsed ? '0%' : '30%'};
  min-width: ${props => props.collapsed ? '0' : '280px'};
  height: 100%;
  background-color: #1a1a1a;
  color: white;
  padding: ${props => props.collapsed ? '0' : '0'};
  box-shadow: ${props => props.collapsed ? 'none' : '2px 0 5px rgba(0, 0, 0, 0.2)'};
  overflow: ${props => props.collapsed ? 'hidden' : 'hidden'};
  position: relative;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  opacity: ${props => props.collapsed ? 0 : 1};
  visibility: ${props => props.collapsed ? 'hidden' : 'visible'};
  flex-shrink: 0;
`;

const ViewerContainer = styled(motion.div)`
  width: ${props => props.expanded ? '100%' : '70%'};
  height: 100%;
  background-color: #2a2a2a;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
`;

const MenuSection = styled.div`
  background-color: var(--bg-light);
  border-radius: var(--border-radius);
  padding: 15px;
  border: 1px solid var(--border-color);
  margin-bottom: 15px;
`;

// Rename the MenuTitle to avoid redeclaration
const SectionTitle = styled.h2`
  color: var(--text-light);
  font-size: 1.2rem;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
`;

const MenuItem = styled(motion.button)`
  width: 100%;
  padding: 10px;
  margin: 5px 0;
  background-color: var(--bg-medium);
  color: var(--text-light);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;

  &:hover {
    background-color: var(--highlight-color);
    transform: translateX(5px);
  }

  &.active {
    background-color: var(--highlight-color);
    border-color: var(--accent-color);
  }
`;

const DroneIcon = styled.span`
  font-size: 1.2rem;
`;

const ViewControls = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 5px;
  z-index: 10;
`;

const ViewButton = styled.button`
  background-color: var(--bg-medium);
  color: ${props => props.active ? 'var(--accent-color)' : 'var(--text-light)'};
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  padding: 5px 10px;
  cursor: pointer;
  font-size: 12px;
  
  &:hover {
    background-color: var(--highlight-color);
  }
  
  &.active {
    border-color: var(--accent-color);
    font-weight: bold;
  }
`;

const WaypointList = styled.div`
  margin-top: 10px;
`;

const WaypointItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background-color: var(--bg-medium);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  margin-bottom: 5px;
  
  span {
    color: var(--text-light);
  }
  
  button {
    background: none;
    border: none;
    color: #ff5555;
    cursor: pointer;
    font-size: 14px;
  }
`;

// Import file input component
const FileInput = styled.input`
  display: none;
`;

const FileInputLabel = styled.label`
  width: 100%;
  padding: 10px;
  margin: 5px 0;
  background-color: var(--bg-medium);
  color: var(--text-light);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  &:hover {
    background-color: var(--highlight-color);
  }
`;

const ImportStatusMessage = styled.div`
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--border-radius-sm);
  font-size: 12px;
  background-color: ${props => props.error ? '#662222' : '#226622'};
  color: white;
`;

const OriginPointInputs = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
`;

const CoordinateInput = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  
  label {
    width: 30px;
    text-align: right;
    color: var(--text-dim);
  }
  
  input {
    flex: 1;
    background-color: var(--bg-medium);
    color: var(--text-light);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 5px;
    
    &:focus {
      border-color: var(--accent-color);
      outline: none;
    }
  }
`;

const VerifyButton = styled(MenuItem)`
  margin-top: 10px;
  background-color: var(--accent-color);
  color: white;
  
  &:hover {
    background-color: var(--accent-color);
    filter: brightness(1.1);
  }
`;

const ModelControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
`;

const ScaleControl = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  
  label {
    color: var(--text-dim);
    font-size: 12px;
  }
  
  input {
    width: 100%;
  }
  
  .scale-value {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-dim);
    
    span:nth-child(2) {
      color: var(--text-light);
    }
  }
`;

// Camera controls for different views
function CameraControls({ viewMode }) {
  const { camera } = useThree();
  
  useEffect(() => {
    switch(viewMode) {
      case 'top':
        camera.position.set(0, 15, 0);
        camera.lookAt(0, 0, 0);
        break;
      case 'side':
        camera.position.set(15, 2, 0);
        camera.lookAt(0, 0, 0);
        break;
      case 'front':
        camera.position.set(0, 2, 15);
        camera.lookAt(0, 0, 0);
        break;
      case 'perspective':
      default:
        camera.position.set(8, 8, 8);
        camera.lookAt(0, 0, 0);
        break;
    }
  }, [viewMode, camera]);
  
  return null;
}

// Simple grid implementation as a fallback
function SimpleGrid() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[30, 30]} />
      <meshBasicMaterial color="#333333" wireframe />
    </mesh>
  );
}

// Custom grid component that should work more reliably
function CustomGrid() {
  const size = 30;
  const divisions = 30;
  const colorCenterLine = new THREE.Color(0x888888);
  const colorGrid = new THREE.Color(0x444444);
  
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <gridHelper 
        args={[size, divisions, colorCenterLine, colorGrid]} 
        position={[0, 0, 0]}
      />
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#264026" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// Ground plane
function Ground() {
  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.5, 0]} 
      receiveShadow
    >
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#264026" />
    </mesh>
  );
}

// Coordinate axes
function CoordinateAxes() {
  return (
    <group>
      {/* X-axis (red) */}
      <mesh position={[5, 0, 0]}>
        <boxGeometry args={[10, 0.1, 0.1]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Y-axis (green) */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[0.1, 10, 0.1]} />
        <meshStandardMaterial color="#22ff22" emissive="#00ff00" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Z-axis (blue) */}
      <mesh position={[0, 0, 5]}>
        <boxGeometry args={[0.1, 0.1, 10]} />
        <meshStandardMaterial color="#2222ff" emissive="#0000ff" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// Drone model with improved details
function Drone({ position }) {
  const droneRef = useRef();
  
  useFrame(() => {
    if (droneRef.current) {
      droneRef.current.rotation.y += 0.01;
    }
  });
  
  return (
    <group ref={droneRef} position={position}>
      {/* Main drone body */}
      <mesh>
        <boxGeometry args={[0.5, 0.1, 0.5]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      
      {/* Camera housing */}
      <mesh position={[0, -0.1, 0.15]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      
      {/* Camera lens */}
      <mesh position={[0, -0.12, 0.2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
        <meshStandardMaterial color="#3f3f3f" />
      </mesh>
      
      {/* Arms */}
      <mesh position={[0.25, 0, 0.25]} rotation={[0, Math.PI/4, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.05]} />
        <meshStandardMaterial color="#cc3333" />
      </mesh>
      
      <mesh position={[-0.25, 0, 0.25]} rotation={[0, -Math.PI/4, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.05]} />
        <meshStandardMaterial color="#cc3333" />
      </mesh>
      
      <mesh position={[0.25, 0, -0.25]} rotation={[0, -Math.PI/4, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.05]} />
        <meshStandardMaterial color="#cc3333" />
      </mesh>
      
      <mesh position={[-0.25, 0, -0.25]} rotation={[0, Math.PI/4, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.05]} />
        <meshStandardMaterial color="#cc3333" />
      </mesh>
      
      {/* Motors */}
      <mesh position={[0.4, 0.05, 0.4]}>
        <cylinderGeometry args={[0.05, 0.05, 0.08]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      <mesh position={[-0.4, 0.05, 0.4]}>
        <cylinderGeometry args={[0.05, 0.05, 0.08]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      <mesh position={[0.4, 0.05, -0.4]}>
        <cylinderGeometry args={[0.05, 0.05, 0.08]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      <mesh position={[-0.4, 0.05, -0.4]}>
        <cylinderGeometry args={[0.05, 0.05, 0.08]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      {/* Propellers - spinning animation */}
      <group position={[0.4, 0.1, 0.4]}>
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[0.25, 0.01, 0.025]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
        <mesh rotation={[0, Math.PI/2, 0]}>
          <boxGeometry args={[0.25, 0.01, 0.025]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      </group>
      
      <group position={[-0.4, 0.1, 0.4]}>
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[0.25, 0.01, 0.025]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
        <mesh rotation={[0, Math.PI/2, 0]}>
          <boxGeometry args={[0.25, 0.01, 0.025]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      </group>
      
      <group position={[0.4, 0.1, -0.4]}>
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[0.25, 0.01, 0.025]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
        <mesh rotation={[0, Math.PI/2, 0]}>
          <boxGeometry args={[0.25, 0.01, 0.025]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      </group>
      
      <group position={[-0.4, 0.1, -0.4]}>
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[0.25, 0.01, 0.025]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
        <mesh rotation={[0, Math.PI/2, 0]}>
          <boxGeometry args={[0.25, 0.01, 0.025]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      </group>
      
      {/* LED lights */}
      <mesh position={[0.25, 0.03, 0.25]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
      </mesh>
      
      <mesh position={[-0.25, 0.03, 0.25]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// Point cloud loader component with improved robustness
function PointCloudLoader({ 
  cloudUrl, 
  pointSize = 0.05, 
  color = '#4f88e3', 
  scale = 1, 
  position = [0, 0, 0], 
  opacity = 1, 
  metadata = null, 
  onLoaded 
}) {
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedGeometry, setLoadedGeometry] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const pointsRef = useRef();
  
  // Use a custom loader pattern instead of useLoader to handle errors better
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    console.log("PointCloudLoader: Starting to load file:", cloudUrl);
    console.log("PointCloudLoader: Using metadata:", metadata);
    
    // First try to use PotreeUtils if available
    try {
      if (PotreeUtils && typeof PotreeUtils.loadPointCloud === 'function') {
        console.log("PointCloudLoader: Attempting to use PotreeUtils loader");
        
        PotreeUtils.loadPointCloud(cloudUrl, (progress) => {
          console.log(`Loading point cloud: ${progress}%`);
        }).then(pointCloud => {
          if (!isMounted) return;
          
          console.log("PointCloudLoader: Loaded successfully with PotreeUtils:", pointCloud);
          
          // Optimize if needed
          if (PotreeUtils.optimizePointCloud) {
            PotreeUtils.optimizePointCloud(pointCloud);
          }
          
          // Create a wrapper geometry for compatibility
          const dummyGeometry = new THREE.BufferGeometry();
          setLoadedGeometry(dummyGeometry);
          setIsLoading(false);
          
          // Add the point cloud to our points ref
          if (pointsRef.current) {
            // Clear any existing children
            while (pointsRef.current.children.length > 0) {
              pointsRef.current.remove(pointsRef.current.children[0]);
            }
            
            // Add the new point cloud
            pointsRef.current.add(pointCloud);
          }
          
          // Set debug info
          setDebugInfo({
            vertices: pointCloud.pointCount || 'unknown',
            hasColors: true,
            dimensions: pointCloud.boundingBox 
              ? {
                  x: pointCloud.boundingBox.max.x - pointCloud.boundingBox.min.x,
                  y: pointCloud.boundingBox.max.y - pointCloud.boundingBox.min.y,
                  z: pointCloud.boundingBox.max.z - pointCloud.boundingBox.min.z
                }
              : {},
            metadata: metadata || {},
            loaderType: 'PotreeUtils'
          });
          
          // Call onLoaded callback
          if (onLoaded && typeof onLoaded === 'function') {
            onLoaded({ pointCloud, debugInfo });
          }
          
        }).catch(error => {
          console.error("PointCloudLoader: PotreeUtils loader failed, falling back to legacy loaders:", error);
    
    // Check if it's a PCAP-derived point cloud (special handling)
    const isPcapDerived = metadata && metadata.fileType === 'pcap';
    
    if (isPcapDerived) {
      // For PCAP-derived point clouds, load the data from the blob URL
      loadPcapDerivedPointCloud(cloudUrl);
    } else {
      // For regular PLY files, use the PLYLoader
      loadPlyFile(cloudUrl);
          }
        });
      } else {
        // Check if it's a PCAP-derived point cloud (special handling)
        const isPcapDerived = metadata && metadata.fileType === 'pcap';
        
        if (isPcapDerived) {
          // For PCAP-derived point clouds, load the data from the blob URL
          loadPcapDerivedPointCloud(cloudUrl);
        } else {
          // For regular PLY files, use the PLYLoader
          loadPlyFile(cloudUrl);
        }
      }
    } catch (err) {
      console.error("PointCloudLoader: Error with PotreeUtils, falling back to legacy loaders:", err);
      
      // Check if it's a PCAP-derived point cloud (special handling)
      const isPcapDerived = metadata && metadata.fileType === 'pcap';
      
      if (isPcapDerived) {
        // For PCAP-derived point clouds, load the data from the blob URL
        loadPcapDerivedPointCloud(cloudUrl);
      } else {
        // For regular PLY files, use the PLYLoader
        loadPlyFile(cloudUrl);
      }
    }
    
    // Load a PCAP-derived point cloud from a blob URL
    function loadPcapDerivedPointCloud(url) {
      console.log("PointCloudLoader: Loading PCAP-derived point cloud");
      
      if (!url || typeof url !== 'string') {
        const error = new Error("Invalid URL provided for PCAP point cloud");
        console.error(error);
        setLoadError(error);
        setIsLoading(false);
        return;
      }
      
      try {
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
            }
            return response.json();
          })
          .then(data => {
            if (!isMounted) return;
            
            try {
              if (!data || typeof data !== 'object') {
                throw new Error("Invalid point cloud data format");
              }
              
              console.log("PointCloudLoader: PCAP data loaded successfully", {
                hasPositions: !!data.positions,
                positionsLength: data.positions?.length || 0,
                hasColors: !!data.colors,
                hasMetadata: !!data.metadata
              });
              
              // Create a new geometry from the serialized data
              const geometry = new THREE.BufferGeometry();
              
              // Add position attribute
              if (data.positions && Array.isArray(data.positions) && data.positions.length > 0) {
                try {
                  if (data.positions.length % 3 !== 0) {
                    console.warn("Position array length not divisible by 3, truncating...");
                    // Truncate to ensure it's divisible by 3
                    const truncLength = Math.floor(data.positions.length / 3) * 3;
                    data.positions = data.positions.slice(0, truncLength);
                  }
                  
                  const positions = new Float32Array(data.positions);
                  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                } catch (posError) {
                  console.error("Error creating position attribute:", posError);
                  throw new Error("Failed to create position attribute");
                }
              } else {
                throw new Error("Invalid point cloud data: missing or invalid positions array");
              }
              
              // Add color attribute if available
              if (data.colors && Array.isArray(data.colors) && data.colors.length > 0) {
                try {
                  if (data.colors.length % 3 !== 0) {
                    console.warn("Color array length not divisible by 3, truncating...");
                    const truncLength = Math.floor(data.colors.length / 3) * 3;
                    data.colors = data.colors.slice(0, truncLength);
                  }
                  
                  // Ensure the color array is not longer than the position array
                  const maxColorLength = (geometry.attributes.position.count * 3);
                  if (data.colors.length > maxColorLength) {
                    console.warn(`Color array too long (${data.colors.length}), truncating to ${maxColorLength}`);
                    data.colors = data.colors.slice(0, maxColorLength);
                  }
                  
                  const colors = new Float32Array(data.colors);
                  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                } catch (colorError) {
                  console.warn("Warning: Could not add color attribute:", colorError);
                  // Don't throw - colors are optional
                }
              }
              
              // Add intensity attribute if available
              if (data.intensity && Array.isArray(data.intensity) && data.intensity.length > 0) {
                try {
                  const intensity = new Float32Array(data.intensity);
                  geometry.setAttribute('intensity', new THREE.BufferAttribute(intensity, 1));
                } catch (intensityError) {
                  console.warn("Warning: Could not add intensity attribute:", intensityError);
                  // Don't throw - intensity is optional
                }
              }
              
              // Compute bounding box
              try {
                geometry.computeBoundingBox();
              } catch (boxError) {
                console.warn("Warning: Could not compute bounding box:", boxError);
                // Create default bounding box
                geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
              }
              
              // Set the loaded geometry
              setLoadedGeometry(geometry);
              setIsLoading(false);
              
              // Create debug info
              const vertexCount = geometry.attributes.position.count;
              const hasColors = geometry.attributes.color !== undefined;
              const size = new THREE.Vector3();
              geometry.boundingBox.getSize(size);
              
              setDebugInfo({
                vertices: vertexCount,
                hasColors: hasColors,
                dimensions: {
                  x: size.x.toFixed(2),
                  y: size.y.toFixed(2),
                  z: size.z.toFixed(2)
                },
                metadata: metadata || {}
              });
              
              // Call onLoaded callback
              if (onLoaded && typeof onLoaded === 'function') {
                try {
                  onLoaded({ 
                    geometry, 
                    size, 
                    debugInfo: { 
                      vertices: vertexCount, 
                      hasColors, 
                      size,
                      metadata: metadata || {}
                    } 
                  });
                } catch (callbackError) {
                  console.error("Error in onLoaded callback:", callbackError);
                }
              }
            } catch (error) {
              console.error("PointCloudLoader: Error processing PCAP-derived point cloud:", error);
              setLoadError(error);
              setIsLoading(false);
            }
          })
          .catch(error => {
            if (!isMounted) return;
            console.error("PointCloudLoader: Error loading PCAP-derived point cloud:", error);
            setLoadError(error);
            setIsLoading(false);
          });
      } catch (fetchError) {
        console.error("PointCloudLoader: Failed to initiate fetch:", fetchError);
        setLoadError(fetchError);
        setIsLoading(false);
      }
    }
    
    // Load a regular PLY file
    function loadPlyFile(url) {
      const loader = new PLYLoader();
      
      try {
        loader.load(
          url,
          // Success callback
          (geometry) => {
            if (!isMounted) return;
            console.log("PointCloudLoader: PLY file loaded successfully", geometry);
            
            try {
              // Ensure geometry has attributes
              if (!geometry.attributes || !geometry.attributes.position) {
                console.error("PointCloudLoader: Invalid geometry - missing position attribute");
                setLoadError(new Error("Invalid PLY file - missing position data"));
                setIsLoading(false);
                return;
              }
              
              // Log detailed information about the geometry
              const vertexCount = geometry.attributes.position.count;
              console.log(`PointCloudLoader: Point cloud has ${vertexCount} vertices`);
              
              // Check if color attributes exist
              const hasColors = geometry.attributes.color !== undefined;
              console.log(`PointCloudLoader: Point cloud has colors: ${hasColors}`);
              
              // Scale down the geometry if it's too large
              const maxPoints = 1000000; // Increased limit for performance
              if (geometry.attributes.position.count > maxPoints) {
                console.warn(`PointCloudLoader: Point cloud has ${geometry.attributes.position.count} points, which may affect performance.`);
                // We could implement a decimation algorithm here if needed
              }
              
              // Apply transformations based on metadata
              if (metadata) {
                // Handle unit conversion if needed (adjust scale in the parent component)
                console.log(`PointCloudLoader: Using unit type: ${metadata.units} with scale factor: ${metadata.scaleFactor}`);
                
                // Apply Y-axis inversion if needed
                if (metadata.invertY) {
                  console.log("PointCloudLoader: Inverting Y-axis");
                  const positionAttr = geometry.attributes.position;
                  for (let i = 0; i < positionAttr.count; i++) {
                    const index = i * 3 + 1; // Y is the second component (index 1)
                    positionAttr.array[index] = -positionAttr.array[index];
                  }
                  positionAttr.needsUpdate = true;
                }
                
                // If using custom coloring modes, we may need to prepare for that
                if (metadata.colorMode && metadata.colorMode !== 'default') {
                  console.log(`PointCloudLoader: Using custom color mode: ${metadata.colorMode}`);
                  
                  // For height-based coloring, we need to compute the height range
                  if (metadata.colorMode === 'height') {
                    const positionAttr = geometry.attributes.position;
                    let minY = Infinity;
                    let maxY = -Infinity;
                    
                    // Find min/max Y values
                    for (let i = 0; i < positionAttr.count; i++) {
                      const y = positionAttr.array[i * 3 + 1];
                      minY = Math.min(minY, y);
                      maxY = Math.max(maxY, y);
                    }
                    
                    // Create color attribute if it doesn't exist
                    if (!geometry.attributes.color) {
                      const colorArray = new Float32Array(positionAttr.count * 3);
                      geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
                    }
                    
                    // Set colors based on height
                    const colorAttr = geometry.attributes.color;
                    const heightRange = maxY - minY;
                    
                    for (let i = 0; i < positionAttr.count; i++) {
                      const y = positionAttr.array[i * 3 + 1];
                      const normalizedHeight = heightRange > 0 ? (y - minY) / heightRange : 0.5;
                      
                      // Create a simple blue-to-red gradient based on height
                      colorAttr.array[i * 3] = normalizedHeight; // Red (increases with height)
                      colorAttr.array[i * 3 + 1] = 0.2 + normalizedHeight * 0.6; // Green (mid-range)
                      colorAttr.array[i * 3 + 2] = 1.0 - normalizedHeight; // Blue (decreases with height)
                    }
                    
                    colorAttr.needsUpdate = true;
                  }
                }
              }
              
              // Compute bounding box if not already computed
              if (!geometry.boundingBox) {
                geometry.computeBoundingBox();
              }
              
              // Optional centering of geometry based on bounding box
              if (geometry.boundingBox) {
                const size = new THREE.Vector3();
                geometry.boundingBox.getSize(size);
                
                // Log size information
                console.log(`PointCloudLoader: Point cloud dimensions: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
                
                // Center the geometry if it's not centered
                if (Math.abs(geometry.boundingBox.min.x) > 0.001 || 
                    Math.abs(geometry.boundingBox.min.y) > 0.001 || 
                    Math.abs(geometry.boundingBox.min.z) > 0.001) {
                  const center = new THREE.Vector3();
                  geometry.boundingBox.getCenter(center);
                  console.log(`PointCloudLoader: Centering point cloud from ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`);
                  geometry.translate(-center.x, -center.y, -center.z);
                }
                
                // Store debug information
                setDebugInfo({
                  vertices: vertexCount,
                  hasColors: hasColors,
                  dimensions: {
                    x: size.x.toFixed(2),
                    y: size.y.toFixed(2),
                    z: size.z.toFixed(2)
                  },
                  metadata: metadata
                });
                
                // Notify about size and completion
                if (onLoaded) {
                  onLoaded({ 
                    geometry, 
                    size, 
                    debugInfo: { 
                      vertices: vertexCount, 
                      hasColors, 
                      size,
                      metadata 
                    } 
                  });
                }
              }
              
              setLoadedGeometry(geometry);
              setIsLoading(false);
              
            } catch (error) {
              console.error("PointCloudLoader: Error processing point cloud geometry:", error);
              setLoadError(error);
              setIsLoading(false);
            }
          },
          // Progress callback
          (xhr) => {
            const progress = Math.round(xhr.loaded / xhr.total * 100);
            console.log(`PointCloudLoader: ${progress}% loaded`);
          },
          // Error callback
          (error) => {
            if (!isMounted) return;
            console.error("PointCloudLoader: Error loading PLY file:", error);
            setLoadError(error);
            setIsLoading(false);
          }
        );
      } catch (error) {
        if (isMounted) {
          console.error("PointCloudLoader: Error initializing PLY loader:", error);
          setLoadError(error);
          setIsLoading(false);
        }
      }
    }
    
    return () => {
      isMounted = false;
    };
  }, [cloudUrl, metadata]);
  
  // Skip rendering if there's an error or still loading
  if (loadError) {
    console.error("PointCloudLoader: Error rendering point cloud:", loadError);
    return (
      <Html position={[0, 2, 0]}>
        <div style={{ 
          background: 'rgba(255,50,50,0.8)', 
          color: 'white', 
          padding: '10px',
          borderRadius: '5px',
          maxWidth: '200px',
          textAlign: 'center'
        }}>
          Error loading point cloud:<br />
          {loadError.message || 'Unknown error'}
        </div>
      </Html>
    );
  }
  
  if (isLoading || !loadedGeometry) {
    return (
      <Html position={[0, 2, 0]}>
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          color: 'white', 
          padding: '10px',
          borderRadius: '5px',
          maxWidth: '200px',
          textAlign: 'center'
        }}>
          Loading point cloud...
        </div>
      </Html>
    );
  }
  
  // Check if the geometry has a valid position attribute
  if (!loadedGeometry.attributes || !loadedGeometry.attributes.position) {
    console.error("PointCloudLoader: Invalid PLY geometry: missing position attribute");
    return null;
  }
  
  // Determine if we should use custom colors or vertex colors
  const useVertexColors = loadedGeometry.hasAttribute('color');
  const useCustomColorMode = metadata && metadata.colorMode && metadata.colorMode !== 'default';
  
  console.log("PointCloudLoader: Rendering point cloud with", 
    loadedGeometry.attributes.position.count, "points, size:", pointSize, 
    "opacity:", opacity, "position:", position, "scale:", scale,
    "using vertex colors:", useVertexColors);
  
  return (
    <group>
      <points ref={pointsRef} position={position} scale={[scale, scale, scale]}>
        <primitive object={loadedGeometry} attach="geometry" />
        <pointsMaterial 
          size={pointSize} 
          color={useVertexColors || useCustomColorMode ? 'white' : color} 
          sizeAttenuation 
          transparent={opacity < 1}
          opacity={opacity}
          vertexColors={useVertexColors || useCustomColorMode}
          alphaTest={0.1}
          precision="highp"
        />
      </points>
      
      {/* Scale indicator for debugging */}
      <Html position={[0, -1, 0]} style={{ display: 'none' }}> {/* Hidden by default */}
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px'
        }}>
          Scale: {scale.toFixed(3)}x
        </div>
      </Html>
      
      {/* Metadata display for debugging (hidden by default) */}
      {debugInfo && metadata && (
        <Html position={[0, 5, 0]}>
          <div style={{ 
            background: 'rgba(0,0,0,0.7)', 
            color: 'white', 
            padding: '5px',
            borderRadius: '3px',
            fontSize: '10px',
            maxWidth: '150px',
            display: 'none' // Hidden by default, set to 'block' to show
          }}>
            Points: {debugInfo.vertices}<br/>
            Colors: {debugInfo.hasColors ? 'Yes' : 'No'}<br/>
            Size: {debugInfo.dimensions.x} x {debugInfo.dimensions.y} x {debugInfo.dimensions.z}<br/>
            Units: {metadata.units}<br/>
            Scale: {metadata.scaleFactor}<br/>
            Color Mode: {metadata.colorMode}
          </div>
        </Html>
      )}
    </group>
  );
}

function BoundsControl({ children }) {
  const api = useBounds();
  
  useEffect(() => {
    // Fit all objects into view
    api.refresh().fit();
  }, [api, children]);
  
  return children;
}

// Update the PerformanceOptimizer component to use platform detection
function PerformanceOptimizer() {
  const { gl, camera } = useThree();
  const [optimizerInitialized, setOptimizerInitialized] = useState(false);
  
  useEffect(() => {
    if (optimizerInitialized) return;
    
    // Import platform detection utils dynamically to avoid circular dependencies
    import('../utils/PlatformDetection').then(({ isAppleSilicon, isHighEndSystem, getOptimalRenderSettings }) => {
      // Get optimal settings based on platform
      const settings = getOptimalRenderSettings();
      console.log('Applying performance settings:', settings);
      
      // Apply pixel ratio based on platform
      gl.setPixelRatio(settings.pixelRatio);
      
      // Configure renderer based on platform capabilities
      gl.physicallyCorrectLights = settings.useHighPrecision;
      gl.outputEncoding = THREE.sRGBEncoding;
      
      // Disable shadows on lower-end systems
      gl.shadowMap.enabled = settings.useShadows;
      if (settings.useShadows) {
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      
      // Reduce memory usage
      gl.powerPreference = settings.powerPreference;
      
      // On Apple Silicon, clean up memory more frequently
      if (isAppleSilicon()) {
        // Set up memory cleanup interval
        const memoryCleanupInterval = setInterval(() => {
          // Clear unneeded resources
          THREE.Cache.clear();
          
          // Manually clean renderer's internal caches
          gl.dispose();
          
          console.log('Memory cleanup performed');
        }, 30000); // Clean every 30 seconds
        
        return () => clearInterval(memoryCleanupInterval);
      }
      
      // Initialize worker pool for high-end systems
      if (isHighEndSystem() && !window.pointCloudWorkerPool) {
        import('../utils/WorkerPool').then(({ getPointCloudWorkerPool }) => {
          window.pointCloudWorkerPool = getPointCloudWorkerPool();
          console.log('Worker pool initialized for point cloud processing');
        });
      }
      
      setOptimizerInitialized(true);
    });
  }, [gl, optimizerInitialized]);
  
  // Monitor for WebGL context issues
  useEffect(() => {
    // Import ThreeContextRecovery utilities
    import('../utils/ThreeContextRecovery').then(({ initMemoryMonitoring }) => {
      // Start memory monitoring
      const cleanup = initMemoryMonitoring();
      return cleanup;
    });
  }, []);
  
  return (
    <>
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </>
  );
}

// Add a distance measurement tool component
function DistanceMeasure({ start, end, label }) {
  if (!start || !end) return null;
  
  const points = [start, end];
  
  // Calculate distance
  const distance = Math.sqrt(
    Math.pow(end[0] - start[0], 2) + 
    Math.pow(end[1] - start[1], 2) + 
    Math.pow(end[2] - start[2], 2)
  ).toFixed(2);
  
  // Calculate midpoint for label
  const midpoint = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2
  ];
  
  return (
    <>
      <Line 
        points={points} 
        color="yellow" 
        lineWidth={2} 
        dashed={true}
      />
      <Html position={midpoint}>
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          color: 'yellow', 
          padding: '4px 8px', 
          borderRadius: '4px', 
          fontSize: '12px',
          pointerEvents: 'none'
        }}>
          {label || `${distance}m`}
        </div>
      </Html>
    </>
  );
}

// Add a volume measurement component
function VolumeMeasure({ bounds, color = "#44aaff" }) {
  if (!bounds) return null;
  
  const { min, max } = bounds;
  const width = max.x - min.x;
  const height = max.y - min.y;
  const depth = max.z - min.z;
  const center = [
    (min.x + max.x) / 2,
    (min.y + max.y) / 2,
    (min.z + max.z) / 2
  ];
  
  const volume = (width * height * depth).toFixed(2);
  
  return (
    <>
      <mesh position={center}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} wireframe />
      </mesh>
      <Html position={[center[0], max.y + 0.5, center[2]]}>
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          color: color, 
          padding: '4px 8px', 
          borderRadius: '4px', 
          fontSize: '12px',
          pointerEvents: 'none',
          whiteSpace: 'pre-line'
        }}>
          {`Volume: ${volume}m³\nW: ${width.toFixed(2)}m\nH: ${height.toFixed(2)}m\nD: ${depth.toFixed(2)}m`}
        </div>
      </Html>
    </>
  );
}

// Add advanced post-processing effects
function PostProcessingEffects({ enabled = true }) {
  if (!enabled) return null;
  
  return (
    <EffectComposer>
      <SSAO radius={0.05} intensity={0.2} luminanceInfluence={0.5} />
      <Bloom intensity={0.1} luminanceThreshold={0.8} luminanceSmoothing={0.9} />
      <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={1} height={480} />
    </EffectComposer>
  );
}

// DOF Calculator wrapper to restore original styling and spacing
const DOFWrapperContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`;

// Add a little CSS at the bottom of the file for toggle switches
const GlobalStyle = styled.div`
  .switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 20px;
  }
  
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
    background-color: #333;
    transition: .4s;
    border-radius: 20px;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
  
  input:checked + .slider {
    background-color: var(--accent-color);
  }
  
  input:checked + .slider:before {
    transform: translateX(20px);
  }
`;

// Create a WebGL context recovery handler component that will be used across the app
function WebGLContextRecoveryHandler() {
  const { gl, scene, camera } = useThree();
  const [hasLostContext, setHasLostContext] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  
  // Function to handle context loss
  const handleContextLoss = useCallback((event) => {
    console.log('R3F detected WebGL context loss:', event);
    setHasLostContext(true);
    setRecoveryMessage('WebGL context lost. Attempting recovery...');
    
    // Dispatch custom event that our utils can listen for
    window.dispatchEvent(new CustomEvent('webgl-context-lost'));
    
    // Force Potree disable via PotreeUtils
    if (PotreeUtils.forceDisablePotree) {
      PotreeUtils.forceDisablePotree();
    }
    
    // Try clearing the scene to help recovery
    if (scene) {
      try {
        // Safely dispose of resources
        scene.traverse(object => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
              });
            } else {
              if (object.material.map) object.material.map.dispose();
              object.material.dispose();
            }
          }
        });
      } catch (e) {
        console.error('Error cleaning up scene during context loss:', e);
      }
    }
  }, [scene]);
  
  // Function to handle context restoration
  const handleContextRestored = useCallback((event) => {
    console.log('R3F detected WebGL context restored:', event);
    
    // Increment recovery counter
    setRecoveryAttempts(prev => prev + 1);
    
    // Try to recover Potree
    if (PotreeUtils.handleWebGLContextRecovery) {
      const success = PotreeUtils.handleWebGLContextRecovery();
      if (success) {
        setRecoveryMessage('WebGL context and Potree successfully recovered');
      } else {
        setRecoveryMessage('WebGL context recovered, but Potree may be limited');
      }
    } else {
      setRecoveryMessage('WebGL context recovered');
    }
    
    setHasLostContext(false);
    
    // Dispatch custom event that our utils can listen for
    window.dispatchEvent(new CustomEvent('webgl-context-recovered'));
    
    // After a delay, clear the recovery message
    setTimeout(() => {
      setRecoveryMessage('');
    }, 5000);
  }, []);
  
  // Register the context recovery handler via the ThreeContextRecovery utility
  useEffect(() => {
    const recoveryHandler = (canvas) => {
      console.log('Global WebGL context recovery handler triggered');
      if (gl && gl.canvas) {
        return forceContextRecovery(gl.canvas);
      }
      return false;
    };
    
    // Register our recovery handler globally
    setupWebGLRecoveryHandler(recoveryHandler);
    
    return () => {
      // Clean up by setting a dummy handler
      setupWebGLRecoveryHandler(() => false);
    };
  }, [gl]);
  
  // Use the WebGL context handler hook from ThreeContextRecovery
  useWebGLContextHandler(handleContextLoss, handleContextRestored);
  
  // Render recovery UI if context is lost
  return recoveryMessage ? (
    <Html fullscreen>
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 1000
      }}>
        {hasLostContext ? (
          <IoWarningOutline size={24} color="#ff9800" />
        ) : (
          <IoCheckmarkCircleOutline size={24} color="#4caf50" />
        )}
        <span>{recoveryMessage}</span>
      </div>
    </Html>
  ) : null;
}

// Update the Scene component to include our recovery handler
function Scene({ activeTab, performanceSettings, enableEffects, displayStats }) {
  // ... existing code ...
  
  return (
    <>
      {/* Add WebGL context recovery handler */}
      <WebGLContextRecoveryHandler />
      
      {/* Existing Scene content */}
      {/* ... */}
    </>
  );
}

// Add this simple 2D fallback component
const SimplifiedDOFCalculator = ({ theme = 'dark' }) => {
  const [focalLength, setFocalLength] = useState(50);
  const [aperture, setAperture] = useState(1.8);
  const [distance, setDistance] = useState(10);
  const [sensor, setSensor] = useState("full");
  const [results, setResults] = useState({
    nearFocusPlane: 0,
    farFocusPlane: 0,
    depthOfField: 0,
    hyperfocalDistance: 0
  });
  
  // Sensor sizes (in mm)
  const sensorSizes = {
    full: 43.27, // diagonal of 36x24mm
    apsc: 28.2,  // diagonal of 23.5x15.6mm
    mft: 21.64   // diagonal of 17.3x13mm
  };
  
  // Calculate DOF
  useEffect(() => {
    try {
      const circleOfConfusion = sensorSizes[sensor] / 1500; // CoC depends on sensor size
      const hyperFocal = (focalLength * focalLength) / (aperture * circleOfConfusion) + focalLength;
      const nearFocusPlane = (distance * (hyperFocal - focalLength)) / (hyperFocal + distance - (2 * focalLength));
      const farFocusPlane = (distance * (hyperFocal - focalLength)) / (hyperFocal - distance);
      
      setResults({
        nearFocusPlane: nearFocusPlane > 0 ? nearFocusPlane : 0,
        farFocusPlane: farFocusPlane > 0 ? farFocusPlane : 0,
        depthOfField: farFocusPlane - nearFocusPlane,
        hyperfocalDistance: hyperFocal
      });
    } catch (e) {
      console.error("Error calculating DOF:", e);
    }
  }, [focalLength, aperture, distance, sensor]);
  
  const labelStyle = {
    color: theme === 'dark' ? '#ccc' : '#333',
    marginBottom: '8px',
    fontWeight: 'bold'
  };
  
  const containerStyle = {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: theme === 'dark' ? '#222' : '#f5f5f5',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    color: theme === 'dark' ? '#eee' : '#222'
  };
  
  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    margin: '8px 0 20px',
    backgroundColor: theme === 'dark' ? '#333' : '#fff',
    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
    borderRadius: '4px',
    color: theme === 'dark' ? '#fff' : '#333'
  };
  
  const resultStyle = {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f0f0f0',
    borderRadius: '4px',
    borderLeft: `4px solid ${theme === 'dark' ? '#4f88e3' : '#3f77cf'}`
  };
  
  const visualizationStyle = {
    width: '100%',
    height: '100px',
    backgroundColor: theme === 'dark' ? '#333' : '#eee',
    margin: '20px 0',
    position: 'relative',
    borderRadius: '4px',
    overflow: 'hidden'
  };
  
  // Calculate positions for visualization
  const zoneWidths = useMemo(() => {
    const total = 100;
    const mid = (distance / results.farFocusPlane) * total;
    const near = Math.max(0, (results.nearFocusPlane / results.farFocusPlane) * total);
    
    return {
      beforeNear: `${near}%`,
      dof: `${Math.min(100 - near, 100)}%`,
      subjectPos: `${mid}%`
    };
  }, [distance, results]);
  
  return (
    <div style={containerStyle}>
      <h2 style={{ color: theme === 'dark' ? '#fff' : '#333', marginBottom: '20px', textAlign: 'center' }}>
        DOF Calculator (2D Mode)
      </h2>
      
      <div>
        <label style={labelStyle}>Focal Length (mm)</label>
        <input 
          type="range" 
          min="8" 
          max="400" 
          value={focalLength} 
          onChange={(e) => setFocalLength(Number(e.target.value))}
          style={inputStyle}
        />
        <div style={{ textAlign: 'center', marginTop: '-10px', marginBottom: '10px' }}>{focalLength}mm</div>
        
        <label style={labelStyle}>Aperture (f/)</label>
        <input 
          type="range" 
          min="1.0" 
          max="22" 
          step="0.1" 
          value={aperture} 
          onChange={(e) => setAperture(Number(e.target.value))}
          style={inputStyle}
        />
        <div style={{ textAlign: 'center', marginTop: '-10px', marginBottom: '10px' }}>f/{aperture.toFixed(1)}</div>
        
        <label style={labelStyle}>Subject Distance (m)</label>
        <input 
          type="range" 
          min="0.1" 
          max="100" 
          step="0.1" 
          value={distance} 
          onChange={(e) => setDistance(Number(e.target.value))}
          style={inputStyle}
        />
        <div style={{ textAlign: 'center', marginTop: '-10px', marginBottom: '10px' }}>{distance.toFixed(1)}m</div>
        
        <label style={labelStyle}>Sensor Size</label>
        <select 
          value={sensor} 
          onChange={(e) => setSensor(e.target.value)}
          style={inputStyle}
        >
          <option value="full">Full Frame</option>
          <option value="apsc">APS-C</option>
          <option value="mft">Micro Four Thirds</option>
        </select>
      </div>
      
      <div style={visualizationStyle}>
        <div style={{
          position: 'absolute',
          left: 0,
          width: zoneWidths.beforeNear,
          height: '100%',
          backgroundColor: theme === 'dark' ? '#444' : '#ddd',
          transition: 'width 0.3s'
        }}></div>
        <div style={{
          position: 'absolute',
          left: zoneWidths.beforeNear,
          width: zoneWidths.dof,
          height: '100%',
          backgroundColor: theme === 'dark' ? '#4f88e3' : '#3f77cf',
          transition: 'left 0.3s, width 0.3s'
        }}></div>
        <div style={{
          position: 'absolute',
          left: zoneWidths.subjectPos,
          top: '20%',
          width: '2px',
          height: '60%',
          backgroundColor: '#f44336',
          transform: 'translateX(-50%)',
          transition: 'left 0.3s'
        }}></div>
      </div>
      
      <div style={resultStyle}>
        <p><strong>Near Focus Plane:</strong> {results.nearFocusPlane.toFixed(2)}m</p>
        <p><strong>Far Focus Plane:</strong> {results.farFocusPlane > 9999 ? "∞" : results.farFocusPlane.toFixed(2) + "m"}</p>
        <p><strong>Depth of Field:</strong> {results.depthOfField > 9999 ? "∞" : results.depthOfField.toFixed(2) + "m"}</p>
        <p><strong>Hyperfocal Distance:</strong> {results.hyperfocalDistance.toFixed(2)}m</p>
      </div>
      
      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: theme === 'dark' ? '#999' : '#666' }}>
        Running in simplified 2D mode due to WebGL issues.
      </div>
    </div>
  );
};

// Add this simplified 2D mode layout component
const SimplifiedLayout = () => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '900px',
        width: '100%'
      }}>
        <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '30px' }}>DOF Calculator (2D Mode)</h1>
        <p style={{ color: '#ccc', textAlign: 'center', marginBottom: '30px' }}>
          Running in 2D mode due to WebGL compatibility issues. 
          This mode uses standard HTML elements instead of 3D rendering.
        </p>
        
        <SimplifiedDOFCalculator theme="dark" />
      </div>
      
      <div style={{
        marginTop: '40px',
        padding: '15px',
        backgroundColor: '#333',
        borderRadius: '8px',
        maxWidth: '800px'
      }}>
        <h3 style={{ color: 'white', marginBottom: '10px' }}>WebGL Issues Detected</h3>
        <p style={{ color: '#ccc' }}>
          Your browser reported WebGL compatibility issues that prevented the use of 3D rendering.
          This could be due to:
        </p>
        <ul style={{ color: '#ccc', marginLeft: '20px' }}>
          <li>Graphics drivers that need updating</li>
          <li>Hardware acceleration being disabled in your browser</li>
          <li>Limited GPU resources or memory</li>
          <li>Incompatible graphics hardware</li>
        </ul>
        <p style={{ color: '#ccc', marginTop: '10px' }}>
          You can try <a href="/" style={{ color: '#4f88e3' }}>refreshing the page</a> to attempt 3D mode again.
        </p>
      </div>
    </div>
  );
};

// Main layout for the application
function MainLayout() {
  const [activeTab, setActiveTab] = useState('mission');
  const [contextLost, setContextLost] = useState(false);
  const [contextLostCount, setContextLostCount] = useState(0);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [deviceCapabilities, setDeviceCapabilities] = useState(null);
  const [memoryWarning, setMemoryWarning] = useState(false);
  const [is2DMode, setIs2DMode] = useState(false);
  
  // Check for 2D mode on component mount
  useEffect(() => {
    if (window.__FORCE_2D_MODE) {
      console.log('Running app in 2D mode due to WebGL issues');
      setIs2DMode(true);
    }
  }, []);
  
  // If in 2D mode, render simplified layout
  if (is2DMode) {
    return <SimplifiedLayout />;
  }
  
  // Assess device capabilities on mount
  useEffect(() => {
    // Assess WebGL capabilities
    const capabilities = assessDeviceWebGLCapability();
    setDeviceCapabilities(capabilities);
    
    console.log('Device WebGL capabilities:', capabilities);
    
    // Set up memory monitoring if available
    if (window.performance && window.performance.memory) {
      const memoryMonitor = setInterval(() => {
        const memory = window.performance.memory;
        const memoryUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        // If memory usage is high, show a warning
        if (memoryUsagePercent > 80 && !memoryWarning) {
          console.warn(`Memory usage high: ${memoryUsagePercent.toFixed(1)}%`);
          setMemoryWarning(true);
          
          // Attempt to free memory
          THREE.Cache.clear();
          ModelLoaderUtils.cleanupAllModelLoader();
          
          // Try to trigger garbage collection
          if (window.gc) {
            try {
              window.gc();
            } catch (e) {
              // Ignore if not available
            }
          }
        } else if (memoryUsagePercent < 70 && memoryWarning) {
          setMemoryWarning(false);
        }
      }, 10000);
      
      return () => clearInterval(memoryMonitor);
    }
  }, []);
  
  // Use the WebGL context handler to detect and respond to context loss
  useWebGLContextHandler(
    // On context lost
    (event) => {
      console.warn('WebGL context lost in MainLayout:', event);
      setContextLost(true);
      setContextLostCount(prev => prev + 1);
      
      // Immediately try to clean up resources
      try {
        THREE.Cache.clear();
        ModelLoaderUtils.cleanupAllModelLoader();
      } catch (e) {
        console.error('Error cleaning up after context loss:', e);
      }
    },
    // On context restored
    () => {
      console.log('WebGL context restored in MainLayout');
      setContextLost(false);
      setRecoveryAttempted(false);
      
      // When context is restored, we need to reload components
      // This is handled by the key prop on MissionPlanner and DOFCalculator
    }
  );

  // Effect to attempt recovery if context is lost
  useEffect(() => {
    if (contextLost && !recoveryAttempted) {
      console.log("Context loss detected, attempting recovery...");
      setRecoveryAttempted(true);
      
      // Schedule progressive recovery attempts
      const attemptRecovery = async () => {
        // Wait a moment for things to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Step 1: Force garbage collection if possible
        if (window.gc) {
          try {
            window.gc();
            console.log("Forced garbage collection");
          } catch (e) {
            console.warn("Could not force garbage collection:", e);
          }
        }
        
        // Step 2: Clear any cached resources
        try {
          THREE.Cache.clear();
          console.log("Cleared THREE.js cache");
        } catch (e) {
          console.warn("Could not clear THREE.js cache:", e);
        }
        
        try {
          ModelLoaderUtils.cleanupAllModelLoader();
          console.log("Cleaned up model loader resources");
        } catch (e) {
          console.warn("Could not clean up model loader:", e);
        }
        
        // Step 3: Try to force context recovery after a delay
        await new Promise(resolve => setTimeout(resolve, 700));
        
        try {
          const canvas = document.querySelector('canvas');
          if (canvas) {
            // Use our improved recovery function
            const success = forceContextRecovery(canvas);
            console.log("Manual recovery attempt result:", success);
          }
        } catch (e) {
          console.error("Error trying to force recovery:", e);
        }
      };
      
      attemptRecovery();
    }
  }, [contextLost, recoveryAttempted]);
  
  // Function to render context loss UI with more detailed information
  const renderContextLossUI = () => {
    if (!contextLost) return null;
    
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <h2>WebGL Context Lost</h2>
        <p>The 3D rendering context has been lost. This may be due to a driver issue or memory constraints.</p>
        <p>Lost count: {contextLostCount}</p>
        
        {deviceCapabilities && (
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            border: '1px solid #333', 
            borderRadius: '4px',
            backgroundColor: 'rgba(0,0,0,0.4)',
            maxWidth: '500px',
            fontSize: '14px'
          }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Device Capabilities</h4>
            <p style={{ margin: '5px 0' }}>
              GPU: {deviceCapabilities.rendererInfo?.renderer || 'Unknown'}
            </p>
            <p style={{ margin: '5px 0' }}>
              WebGL 2.0: {deviceCapabilities.webgl2Supported ? 'Supported' : 'Not supported'}
            </p>
            <p style={{ margin: '5px 0' }}>
              Risk Level: {deviceCapabilities.riskOfContextLoss}
            </p>
            {deviceCapabilities.recommendations.length > 0 && (
              <>
                <h4 style={{ margin: '10px 0 5px 0' }}>Recommendations:</h4>
                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                  {deviceCapabilities.recommendations.map((rec, i) => (
                    <li key={i} style={{ margin: '3px 0' }}>{rec}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        
        {contextLostCount > 2 && (
          <p style={{ color: '#ff9900' }}>
            Multiple context losses detected. Try reducing the complexity of your scene
            or closing other applications using WebGL.
          </p>
        )}
        
        {memoryWarning && (
          <p style={{ color: '#ff5555' }}>
            Warning: High memory usage detected. Consider closing other applications
            or browser tabs to free up resources.
          </p>
        )}
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4f88e3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
          <button 
            onClick={() => {
              try {
                // Get the current canvas
                const canvas = document.querySelector('canvas');
                if (canvas) {
                  // Use our improved recovery function
                  const success = forceContextRecovery(canvas);
                  console.log("Manual recovery attempt result:", success);
                }
              } catch (e) {
                console.error("Error trying to restore context:", e);
              }
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#333333',
              color: 'white',
              border: '1px solid #666666',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Force Recovery
          </button>
          <button 
            onClick={() => {
              // Attempt a more aggressive cleanup
              try {
                THREE.Cache.clear();
                ModelLoaderUtils.cleanupAllModelLoader();
                
                // Force garbage collection if available
                if (window.gc) {
                  try { window.gc(); } catch (e) {}
                }
                
                // Reset state to normal
                setContextLost(false);
                setRecoveryAttempted(false);
              } catch (e) {
                console.error("Error during cleanup:", e);
              }
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#333333',
              color: 'white',
              border: '1px solid #666666',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clean Resources
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <StyledVars>
      <TabBar>
        <TabButton
          active={activeTab === 'mission'}
          onClick={() => setActiveTab('mission')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Drone Mission Planner
        </TabButton>
        <TabButton
          active={activeTab === 'dof'}
          onClick={() => setActiveTab('dof')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          DOF Calculator
        </TabButton>
        <TabButton
          active={activeTab === 'potree'}
          onClick={() => setActiveTab('potree')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Large Point Clouds
        </TabButton>
      </TabBar>
      
      <ContentContainer>
        {renderContextLossUI()}
        
        <AnimatePresence mode="wait">
        {activeTab === 'mission' ? (
            <motion.div
              key="mission"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ width: '100%', height: '100%' }}
            >
              <React.Suspense fallback={
                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1a1a1a', color: 'white' }}>
                  Loading Mission Planner...
                </div>
              }>
                <ErrorBoundary fallback={
                  <div style={{ padding: '20px', backgroundColor: '#2a2a2a', color: 'white' }}>
                    <h3>Error loading Mission Planner</h3>
                    <p>There was a problem loading the Mission Planner component.</p>
                    <button onClick={() => window.location.reload()}>Reload Page</button>
                  </div>
                }>
                  <MissionPlanner 
                    key={`mission-planner-${contextLostCount}`} 
                    contextLostCount={contextLostCount}
                    deviceCapabilities={deviceCapabilities}
                  />
                </ErrorBoundary>
              </React.Suspense>
            </motion.div>
          ) : activeTab === 'dof' ? (
            <motion.div
              key="dof"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ 
                width: '100%', 
                height: '100%',
                padding: 0,
                overflow: 'hidden'
              }}
            >
              <DOFWrapperContainer>
                <React.Suspense fallback={
                  <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1a1a1a', color: 'white' }}>
                    Loading DOF Calculator...
                  </div>
                }>
                  <ErrorBoundary fallback={
                    <div style={{ padding: '20px', backgroundColor: '#2a2a2a', color: 'white' }}>
                      <h3>Error loading DOF Calculator</h3>
                      <p>There was a problem loading the DOF Calculator component.</p>
                      <button onClick={() => window.location.reload()}>Reload Page</button>
                    </div>
                  }>
                    <DOFCalculator 
                      key={`dof-calculator-${contextLostCount}`}
                      deviceCapabilities={deviceCapabilities}
                    />
                  </ErrorBoundary>
                </React.Suspense>
              </DOFWrapperContainer>
            </motion.div>
          ) : (
            <motion.div
              key="potree"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ 
                width: '100%', 
                height: '100%',
                padding: 0,
                overflow: 'hidden'
              }}
            >
              <React.Suspense fallback={
                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1a1a1a', color: 'white' }}>
                  Loading Point Cloud Viewer...
                </div>
              }>
                <ErrorBoundary fallback={
                  <div style={{ padding: '20px', backgroundColor: '#2a2a2a', color: 'white' }}>
                    <h3>Error loading Point Cloud Viewer</h3>
                    <p>There was a problem loading the Point Cloud Viewer component.</p>
                    <button onClick={() => window.location.reload()}>Reload Page</button>
                  </div>
                }>
                  <PotreeExample 
                    key={`potree-example-${contextLostCount}`}
                    deviceCapabilities={deviceCapabilities}
                  />
                </ErrorBoundary>
              </React.Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </ContentContainer>
    </StyledVars>
  );
}

export default MainLayout; 