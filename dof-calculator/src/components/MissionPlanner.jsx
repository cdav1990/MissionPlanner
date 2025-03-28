import React, { useState, useEffect, Suspense, useRef, useReducer, useMemo, useCallback } from 'react';
import { Canvas, useThree, extend, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera, Line, Text, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { EffectComposer, SSAO, Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useWebGLContextHandler, forceContextRecovery } from '../utils/ThreeContextRecovery';
import { loadPointCloud, optimizePointCloud, potreeStatus, subscribeToPotreeStatus, checkSystemCapabilities } from '../utils/PotreeUtils';
import './MissionPlannerStyles.css'; // Import our new CSS file
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader'; // Add PLYLoader import
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader';
import { Matrix4, Vector3 } from 'three';
import { useRef as R3FuseRef } from 'react'; // Change this to import from React instead
import { createMetadataEnrichedBlobUrl as createBlobUrl, getUserFriendlyErrorMessage as getErrorMessage, detectFileFormat } from '../utils/FileImportUtils';
import { PointCloud } from './SimplePointCloud';
import PotreePointCloud from './PotreePointCloud';
import { createMetadataEnrichedBlobUrl, getUserFriendlyErrorMessage } from '../utils/ModelLoaderUtils';
// Import Button from Material-UI - needed for the views
import { Button } from '@mui/material';
import DroneModels from '../data/drone-models';
import { AxisArrows, UnitCube } from './UIHelpers';
import styled, { createGlobalStyle } from 'styled-components';
import DroneSelector from './DroneSelector'; // Import DroneSelector component
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import CameraModels from '../data/camera-models';
import DepthOfFieldCalculator from '../utils/depth-of-field';
import ReactSlider from 'react-slider';
// Import color picker components from react-color
import { ChromePicker } from 'react-color';

// Add new styled components for the menu
const LayoutContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #121212;
  color: white;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
`;

const MenuPane = styled.div`
  width: 320px;
  min-width: 320px;
  height: 100%;
  background-color: #181818;
  border-right: 1px solid #333333;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease, width 0.3s ease;
  overflow: hidden;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
  ${props => props.collapsed && `
    transform: translateX(-320px);
    width: 0;
    min-width: 0;
  `}
`;

const MenuHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #333333;
  background-color: #111111;
`;

const MenuTitle = styled.h2`
  font-size: 18px;
  margin: 0;
  color: #4f88e3;
  font-weight: 500;
`;

const CollapseButton = styled.button`
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 4px;
  
  &:hover {
    color: white;
    background-color: rgba(255, 255, 255, 0.05);
  }
`;

const ExpandButton = styled.button`
  position: absolute;
  left: 12px;
  top: 12px;
  background-color: rgba(18, 18, 18, 0.9);
  border: 1px solid #333333;
  border-radius: 8px;
  color: #cccccc;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  
  &:hover {
    color: white;
    background-color: #1a1a1a;
  }
`;

const MenuContent = styled.div`
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

// Add icons for import buttons
const ThreeDIcon = () => (
  <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 22L3 17V7L12 2L21 7V17L12 22Z M12 6.5L5 10L12 13.5L19 10L12 6.5Z" />
  </svg>
);

const PointCloudIcon = () => (
  <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 18.8C11.5 18.8 11 18.3 11 17.8C11 17.3 11.5 16.8 12 16.8C12.5 16.8 13 17.3 13 17.8C13 18.3 12.5 18.8 12 18.8M12 4.8C11.5 4.8 11 4.3 11 3.8C11 3.3 11.5 2.8 12 2.8C12.5 2.8 13 3.3 13 3.8C13 4.3 12.5 4.8 12 4.8M5 12.8C4.5 12.8 4 12.3 4 11.8C4 11.3 4.5 10.8 5 10.8C5.5 10.8 6 11.3 6 11.8C6 12.3 5.5 12.8 5 12.8M19 12.8C18.5 12.8 18 12.3 18 11.8C18 11.3 18.5 10.8 19 10.8C19.5 10.8 20 11.3 20 11.8C20 12.3 19.5 12.8 19 12.8M11.1 15C10.6 15 10.1 14.5 10.1 14C10.1 13.5 10.6 13 11.1 13C11.6 13 12.1 13.5 12.1 14C12.1 14.5 11.6 15 11.1 15M12.1 9C11.6 9 11.1 8.5 11.1 8C11.1 7.5 11.6 7 12.1 7C12.6 7 13.1 7.5 13.1 8C13.1 8.5 12.6 9 12.1 9M7 8.8C6.5 8.8 6 8.3 6 7.8C6 7.3 6.5 6.8 7 6.8C7.5 6.8 8 7.3 8 7.8C8 8.3 7.5 8.8 7 8.8M17 8.8C16.5 8.8 16 8.3 16 7.8C16 7.3 16.5 6.8 17 6.8C17.5 6.8 18 7.3 18 7.8C18 8.3 17.5 8.8 17 8.8M7 16.8C6.5 16.8 6 16.3 6 15.8C6 15.3 6.5 14.8 7 14.8C7.5 14.8 8 15.3 8 15.8C8 16.3 7.5 16.8 7 16.8M17 16.8C16.5 16.8 16 16.3 16 15.8C16 15.3 16.5 14.8 17 14.8C17.5 14.8 18 15.3 18 15.8C18 16.3 17.5 16.8 17 16.8" />
  </svg>
);

const InfoIcon = () => (
  <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 15c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1m1-8h-2V7h2v2z M13 16h-2v2h2v-2z M13 10h-2v4h2v-4z" />
  </svg>
);

const WarningIcon = () => (
  <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2z M13 16h-2v2h2v-2z M13 10h-2v4h2v-4z" />
  </svg>
);

// Styled components for model controls to match drone control UI
const ModelControlGroup = styled.div`
  margin-bottom: 15px;
`;

const ControlLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #ccc;
`;

const ModelControlItem = styled.div`
  display: grid;
  grid-template-columns: 75px 1fr 60px;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  width: 100%;
`;

// Enhanced slider components for all controls
const StyledSlider = styled(ReactSlider)`
  width: 100%;
  height: 20px;
  touch-action: none;
`;

// Define the thumb component
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

// Define the track component
const SliderTrack = styled.div`
  top: 6px;
  height: 8px;
  background: ${props => (props.index === 1 || props.index === undefined) ? '#333' : 'linear-gradient(to right, #1a5bb7, #4f88e3)'};
  border-radius: 4px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 1;
`;

const NumberInput = styled.input`
  width: 100%;
  background-color: #2a2a2a;
  border: 1px solid #4f88e3;
  border-radius: 4px;
  color: white;
  padding: 6px 8px;
  text-align: center;
  font-size: 0.9rem;
  
  &:focus {
    outline: none;
    border-color: #6fa0ff;
    box-shadow: 0 0 0 2px rgba(79, 136, 227, 0.3);
  }
  
  /* Remove spinner buttons for number inputs */
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  /* Firefox */
  -moz-appearance: textfield;
`;

const HelpText = styled.div`
  font-size: 11px;
  margin-top: 2px;
  color: #aaa;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  cursor: pointer;
  font-size: 0.95rem;
  color: #ddd;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  input {
    margin-right: 10px;
    width: 16px;
    height: 16px;
    accent-color: #4f88e3;
    cursor: pointer;
  }

  span {
    transition: color 0.2s ease;
  }

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
    
    span {
      color: white;
    }
  }
`;

const SliderContainer = styled.div`
  margin-bottom: 18px;
`;

const SliderLabel = styled.label`
  display: block;
  margin-bottom: 10px;
  font-size: 0.95rem;
  color: #ddd;
`;

const SliderInput = styled.input`
  width: 100%;
  height: 10px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(to right, #1a5bb7, #4f88e3);
  border-radius: 5px;
  outline: none;
  z-index: 1;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: 1px solid #4f88e3;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
    z-index: 2;
  }
  
  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: 1px solid #4f88e3;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
    z-index: 2;
  }
  
  &:focus {
    outline: none;
  }
`;

const SliderValue = styled.span`
  display: block;
  text-align: right;
  font-size: 0.9rem;
  color: #ccc;
`;

// Add styled buttons for the view controls
const ViewButton = styled(Button)`
  width: 100%;
  margin-bottom: 8px;
  text-transform: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border: 1px solid #4f88e3;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &.active {
    background-color: rgba(26, 91, 183, 0.4);
    box-shadow: 0 0 8px rgba(79, 136, 227, 0.3);
  }
  
  &:hover {
    background-color: rgba(79, 136, 227, 0.2);
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    border-color: #555;
  }
  
  .icon {
    margin-right: 8px;
  }
  
  .status {
    font-size: 0.8rem;
    opacity: 0.8;
    margin-left: auto;
    padding: 2px 6px;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }
`;

// Add styled section header
const ViewControlsHeader = styled.div`
  margin: 0;
  font-size: 1rem;
  color: #4f88e3;
  border-bottom: 1px solid #333;
  padding: 8px 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  transition: all 0.2s ease;
  
  &:hover {
    color: #6fa0ff;
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  &:not(:first-child) {
    margin-top: 12px;
  }
`;

// Add a styled section content container
const SectionContent = styled.div`
  margin: 8px 0;
  overflow: ${props => props.isExpanded ? 'visible' : 'hidden'};
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: ${props => props.isExpanded ? 'none' : '0px'};
  opacity: ${props => props.isExpanded ? '1' : '0'};
  padding-left: 4px;
`;

// Range Input styled component
const RangeInput = styled.input`
  width: 100%;
  height: 8px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(to right, #1a5bb7, #4f88e3);
  border-radius: 4px;
  outline: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: 1px solid #4f88e3;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
  }
  
  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: 1px solid #4f88e3;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
  }
`;

// Color Button for background color selection
const ColorButton = styled.button`
  background-color: ${props => props.color};
  border: 2px solid ${props => props.active ? '#ffffff' : '#444444'};
  color: ${props => props.color === '#000000' ? '#ffffff' : props.color === '#222222' ? '#ffffff' : '#ffffff'};
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
  font-size: 0.85rem;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #666666;
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
  }
`;

// Reset Button for drone positioning
const ResetButton = styled.button`
  background: linear-gradient(to bottom, #3a7bd5, #2b5698);
  border: none;
  color: white;
  padding: 10px 16px;
  border-radius: 5px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  
  &:hover {
    background: linear-gradient(to bottom, #4a8be5, #3b66a8);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
`;

// Color preview box to display current color and open picker
const ColorPreview = styled.div`
  width: 100%;
  height: 35px;
  background-color: ${props => props.color};
  border: 2px solid #444444;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  
  &:hover {
    border-color: #666666;
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
  }
`;

// Popover container for color picker
const Popover = styled.div`
  position: absolute;
  z-index: 100;
  margin-top: 8px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
`;

// Cover div to detect clicks outside of color picker
const Cover = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

// Add a styled import button
const ImportButton = styled(Button)`
  width: 100%;
  margin-bottom: 16px;
  text-transform: none;
  font-weight: 500;
  padding: 12px 16px;
  background-color: rgba(26, 91, 183, 0.15);
  border: 1px solid #4f88e3;
  border-radius: 8px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: rgba(79, 136, 227, 0.3);
    box-shadow: 0 0 10px rgba(79, 136, 227, 0.4);
    transform: translateY(-1px);
  }
  
  svg {
    margin-right: 12px;
    font-size: 1.2rem;
  }
`;

// Add or update the .hidden class definition to ensure it works correctly
const FileInputStyles = styled.div`
  .hidden {
    display: none !important;
  }

  input[type="file"] {
    display: none !important;
  }
`;

// Global styles for the slider dragging state
const GlobalStyle = createGlobalStyle`
  body.slider-dragging {
    cursor: grabbing;
    user-select: none;
  }
  
  body.slider-dragging * {
    cursor: grabbing !important;
  }
  
  .hidden {
    display: none !important;
  }

  input[type="file"] {
    display: none !important;
  }
`;

// Register THREE with React Three Fiber to avoid namespace issues
extend({ 
  ...THREE,
  OBJLoader,
  PLYLoader,
  PCDLoader, // Add PCDLoader for point cloud support
  // Explicitly register core THREE classes that might be used
  PerspectiveCamera: THREE.PerspectiveCamera,
  Scene: THREE.Scene,
  WebGLRenderer: THREE.WebGLRenderer,
  Mesh: THREE.Mesh,
  Group: THREE.Group,
  BoxGeometry: THREE.BoxGeometry, 
  SphereGeometry: THREE.SphereGeometry, 
  PlaneGeometry: THREE.PlaneGeometry, 
  ConeGeometry: THREE.ConeGeometry,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  LineBasicMaterial: THREE.LineBasicMaterial,
  BufferGeometry: THREE.BufferGeometry,
  Points: THREE.Points,
  Line: THREE.Line,
  LineSegments: THREE.LineSegments
});

// Instead of trying to modify the THREE namespace directly,
// create a local reference that's accessible to the component
const localThree = {
  M3: THREE.Matrix3
};

// Add debugging to check THREE namespace
console.log("THREE namespace in MissionPlanner:", {
  hasMatrix3: !!THREE.Matrix3,
  matrix3IsFunction: typeof THREE.Matrix3 === 'function',
  threeObjectKeys: Object.keys(THREE).filter(key => key.startsWith('M'))
});

// Create a hook to update background color in Three.js when it changes
function useBackgroundColor(color) {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    if (gl && scene && camera) {
      // Update the renderer clear color immediately
      gl.setClearColor(color, 1);
      
      // Also update the scene background
      scene.background = new THREE.Color(color);
      
      // Force a render to apply the change right away
      gl.render(scene, camera);
      
      console.log("Background color updated to:", color);
    }
  }, [color, gl, scene, camera]);
  
  // Also update on each frame to ensure the change sticks
  useFrame(() => {
    if (gl && scene && scene.background) {
      // Check if the current scene color matches our desired color
      const currentColor = scene.background.getHexString();
      const targetColor = color.replace('#', '').toLowerCase();
      
      if (currentColor !== targetColor) {
        scene.background = new THREE.Color(color);
        gl.setClearColor(color, 1);
      }
    }
  });
  
  return null;
}

// Create a component that applies the background color
function BackgroundColorUpdater({ color }) {
  useBackgroundColor(color);
  return null;
}

// Camera Frustum component to visualize field of view
function CameraFrustum({ cameraDetails, lensDetails, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1.0, distanceToObject = 30 }) {
  const frustumRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  
  // Use useEffect to directly update position and rotation for more reliable updates
  useEffect(() => {
    if (frustumRef.current) {
      frustumRef.current.position.set(position[0], position[1], position[2]);
    }
  }, [position]);
  
  useEffect(() => {
    if (frustumRef.current) {
      // Directly apply the rotation values that are already in radians
      frustumRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
  }, [rotation]);
  
  if (!cameraDetails || !lensDetails) return null;

  // Calculate FOV based on sensor size and focal length
  const { sensorWidth, sensorHeight } = cameraDetails;
  const { focalLength } = lensDetails;

  // Calculate horizontal and vertical FOV in radians
  const horizontalFOV = 2 * Math.atan(sensorWidth / (2 * focalLength));
  const verticalFOV = 2 * Math.atan(sensorHeight / (2 * focalLength));

  // Convert distance to object from feet to a scale that fits the scene
  // We'll use a scale factor to convert from feet to units in the scene
  const sceneScale = 0.3048; // 1 foot = 0.3048 meters, and assuming 1 unit = 1 meter in the scene
  const distanceInScene = distanceToObject * sceneScale;
  
  // Calculate width and height of coverage at the specified distance
  const coverageWidthFeet = 2 * distanceToObject * Math.tan(horizontalFOV / 2);
  const coverageHeightFeet = 2 * distanceToObject * Math.tan(verticalFOV / 2);
  
  // Calculate near and far planes
  const nearPlane = 0.5;
  const farPlane = distanceInScene;   // Use the distance to object as the far plane
  
  const nearHeight = 2 * Math.tan(verticalFOV / 2) * nearPlane;
  const nearWidth = 2 * Math.tan(horizontalFOV / 2) * nearPlane;
  const farHeight = 2 * Math.tan(verticalFOV / 2) * farPlane;
  const farWidth = 2 * Math.tan(horizontalFOV / 2) * farPlane;

  // Create points for the frustum
  const points = [
    // Near plane - clockwise from bottom-left
    new THREE.Vector3(-nearWidth/2, -nearHeight/2, -nearPlane),
    new THREE.Vector3(nearWidth/2, -nearHeight/2, -nearPlane),
    new THREE.Vector3(nearWidth/2, nearHeight/2, -nearPlane),
    new THREE.Vector3(-nearWidth/2, nearHeight/2, -nearPlane),
    // Far plane - clockwise from bottom-left
    new THREE.Vector3(-farWidth/2, -farHeight/2, -farPlane),
    new THREE.Vector3(farWidth/2, -farHeight/2, -farPlane),
    new THREE.Vector3(farWidth/2, farHeight/2, -farPlane),
    new THREE.Vector3(-farWidth/2, farHeight/2, -farPlane),
  ];

  // Lines to draw frustum edges
  const indices = [
    // Near plane
    0, 1, 1, 2, 2, 3, 3, 0,
    // Far plane
    4, 5, 5, 6, 6, 7, 7, 4,
    // Connecting near to far
    0, 4, 1, 5, 2, 6, 3, 7
  ];

  // Create geometry from points and indices
  const lineGeometry = new THREE.BufferGeometry();
  const vertices = [];
  
  for (let i = 0; i < indices.length; i++) {
    vertices.push(points[indices[i]].x, points[indices[i]].y, points[indices[i]].z);
  }

  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  // Create modern gradient material for the frustum lines
  const lineMaterial = new THREE.LineBasicMaterial({
    color: hovered ? 0x00ffff : 0x4080ff,
    linewidth: 1.5,
    transparent: true,
    opacity: 0.9
  });

  // Enhanced field of view visualization
  // Create a frustum shaped geometry instead of a cone for better accuracy
  const fovVertices = [];
  const fovIndices = [];
  
  // Create a more elegant frustum shape with multiple segments
  const segments = 24;
  const angleStep = (2 * Math.PI) / segments;
  
  // Create the near plane circle vertices
  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const x = (nearWidth / 2) * Math.cos(angle);
    const y = (nearHeight / 2) * Math.sin(angle);
    fovVertices.push(x, y, -nearPlane);
  }
  
  // Create the far plane circle vertices
  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const x = (farWidth / 2) * Math.cos(angle);
    const y = (farHeight / 2) * Math.sin(angle);
    fovVertices.push(x, y, -farPlane);
  }
  
  // Create triangles between the near and far planes
  for (let i = 0; i < segments; i++) {
    // First triangle
    fovIndices.push(i, i + 1, i + segments + 1);
    // Second triangle
    fovIndices.push(i, i + segments + 1, i + segments + 2);
  }
  
  const fovGeometry = new THREE.BufferGeometry();
  fovGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fovVertices, 3));
  fovGeometry.setIndex(fovIndices);
  fovGeometry.computeVertexNormals();
  
  // Create a modern semi-transparent gradient material
  const fovMaterial = new THREE.MeshPhongMaterial({
    color: 0x2060ff,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    shininess: 100,
    specular: 0x6090ff,
    emissive: 0x102040,
    flatShading: false
  });
  
  // Create a more visually appealing coverage box
  const coverageBoxGeometry = new THREE.BoxGeometry(farWidth, farHeight, 0.05);
  coverageBoxGeometry.translate(0, 0, -farPlane);
  
  // Create a more visually sophisticated material for the coverage box
  const coverageBoxMaterial = new THREE.MeshPhysicalMaterial({
    color: hovered ? 0x60b0ff : 0x4080ff,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    metalness: 0.2,
    roughness: 0.5,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2
  });
  
  // Create better outlines for the coverage box
  const coverageEdgesGeometry = new THREE.EdgesGeometry(coverageBoxGeometry);
  const coverageEdgesMaterial = new THREE.LineBasicMaterial({
    color: hovered ? 0x80d0ff : 0x60a0ff,
    linewidth: 2,
    transparent: true,
    opacity: 0.8
  });
  
  // Create grid pattern for coverage area visualization
  const gridSize = 10;
  const gridStep = 1.0;
  const gridGeometry = new THREE.BufferGeometry();
  const gridVertices = [];
  
  // Create horizontal and vertical grid lines
  for (let i = -gridSize / 2; i <= gridSize / 2; i += gridStep) {
    // Horizontal lines (keeping within the coverage box)
    const hLineExtent = Math.min(farWidth / 2, gridSize / 2);
    if (Math.abs(i) <= farHeight / 2) {
      gridVertices.push(-hLineExtent, i, -farPlane);
      gridVertices.push(hLineExtent, i, -farPlane);
    }
    
    // Vertical lines (keeping within the coverage box)
    const vLineExtent = Math.min(farHeight / 2, gridSize / 2);
    if (Math.abs(i) <= farWidth / 2) {
      gridVertices.push(i, -vLineExtent, -farPlane);
      gridVertices.push(i, vLineExtent, -farPlane);
    }
  }
  
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridVertices, 3));
  
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x80d0ff,
    transparent: true,
    opacity: 0.3,
    linewidth: 1
  });

  // Return modernized group with interactive elements
  return (
    <group 
      ref={frustumRef} 
      position={position} 
      rotation={rotation}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <lineSegments geometry={lineGeometry} material={lineMaterial} />
      <mesh geometry={fovGeometry} material={fovMaterial} />
      <mesh geometry={coverageBoxGeometry} material={coverageBoxMaterial} />
      <lineSegments geometry={coverageEdgesGeometry} material={coverageEdgesMaterial} />
      <lineSegments geometry={gridGeometry} material={gridMaterial} />
      
      {/* Display FOV values and coverage as text with modernized styling */}
      <Html position={[0, farHeight/2 + 1, -farPlane]}>
        <div style={{
          background: 'rgba(0,20,60,0.8)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          boxShadow: '0 0 10px rgba(32,96,255,0.6)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(96,144,255,0.6)',
          minWidth: '240px',
          transform: 'translate(-50%, -110%)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#80c0ff' }}>
            Field of View: {Math.round(horizontalFOV * 180 / Math.PI)}° × {Math.round(verticalFOV * 180 / Math.PI)}°
          </div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Coverage at {distanceToObject} ft:
          </div>
          <div style={{ fontSize: '16px', marginBottom: '4px', color: '#60d0ff' }}>
            {coverageWidthFeet.toFixed(1)} ft × {coverageHeightFeet.toFixed(1)} ft
          </div>
          <div style={{ fontSize: '0.9em', opacity: 0.8, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px', marginTop: '4px' }}>
            {cameraDetails.brand} {cameraDetails.model} + {lensDetails.brand} {lensDetails.focalLength}mm
          </div>
        </div>
      </Html>
    </group>
  );
}

// Create a Scene component to handle camera and controls setup
function SceneSetup({ children, ambientLightIntensity, mainLightIntensity, smallGridSize, gridDivisions, showAxis, backgroundColor }) {
  // Scene setup
  const { camera, scene, gl } = useThree();
  
  // Keep references to lights with useRef
  const lightsRef = useRef({
    ambient: null,
    directional: null,
    front: null,
    rim: null
  });
  
  // Update background color when backgroundColor changes
  useEffect(() => {
    if (scene && gl) {
      scene.background = new THREE.Color(backgroundColor);
      gl.setClearColor(backgroundColor, 1);
      console.log("Updated scene background color:", backgroundColor);
    }
  }, [backgroundColor, scene, gl]);
  
  // Update light intensities when they change
  useEffect(() => {
    if (!lightsRef.current.ambient || !lightsRef.current.directional) {
      return;
    }
    
    // Update ambient light intensity
    lightsRef.current.ambient.intensity = ambientLightIntensity;
    
    // Update directional light intensity
    lightsRef.current.directional.intensity = mainLightIntensity;
    
    console.log("Updated light intensities - Ambient:", ambientLightIntensity, "Main:", mainLightIntensity);
  }, [ambientLightIntensity, mainLightIntensity]);
  
  // Log WebGL capabilities to help with debugging
  useEffect(() => {
    try {
      console.log("WebGL context created successfully");
      console.log("WebGL info:", {
        renderer: gl.getContext(),
        version: gl.getContext().getParameter(gl.getContext().VERSION),
        vendor: gl.getContext().getParameter(gl.getContext().VENDOR),
        maxTextureSize: gl.getContext().getParameter(gl.getContext().MAX_TEXTURE_SIZE),
      });
      
      // Set up scene defaults with pure black background
      scene.background = new THREE.Color("#000000"); // Pure black background for CAD-like appearance
      scene.fog = null; // Remove fog for cleaner CAD-style look
      
      // Create a more professional CAD-style ground plane
      const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
      const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: "#000000", 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
        roughness: 0.7,
        metalness: 0.2
      });
      
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = Math.PI / 2;
      ground.position.y = -0.01; // Slightly below origin to avoid z-fighting
      ground.receiveShadow = true;
      ground.name = "GroundPlane";
      scene.add(ground);
      
      // Create a precision CAD-style grid overlay for the ground (using feet for scale)
      // Main grid with 1-foot divisions - use the provided gridSize and divisions
      const gridSize = smallGridSize || 200; // Default to 200 feet if not provided
      const divisions = gridDivisions || 200; // Default to 200 divisions if not provided
      const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x555555, 0x222222);
      gridHelper.position.y = 0.02;
      gridHelper.name = "GridHelper";
      scene.add(gridHelper);
      
      // Add a larger grid with 10-foot divisions (more prominent lines)
      const majorGridHelper = new THREE.GridHelper(gridSize, divisions / 10, 0x888888, 0x444444);
      majorGridHelper.position.y = 0.03; // Slightly above the minor grid
      majorGridHelper.name = "MajorGridHelper";
      scene.add(majorGridHelper);
      
      // Create custom axis lines that are more visible - only if showAxis is true
      if (showAxis) {
        const axisGroup = new THREE.Group();
        axisGroup.name = "AxisGroup";
        
        // Set a smaller size for the axes
        const axisLength = 15;
        const arrowSize = 1.5;
        
        // Create 3D axes with cylinders and cones for a modern CAD look
        
        // X-axis (red)
        const xAxisCylinder = new THREE.CylinderGeometry(0.15, 0.15, axisLength, 8);
        xAxisCylinder.rotateZ(Math.PI/2);
        xAxisCylinder.translate(axisLength/2, 0, 0);
        const xAxisMesh = new THREE.Mesh(xAxisCylinder, new THREE.MeshStandardMaterial({ color: 0xff2222 }));
        
        // X-axis arrow
        const xArrow = new THREE.ConeGeometry(0.5, arrowSize, 12);
        xArrow.rotateZ(-Math.PI/2);
        xArrow.translate(axisLength, 0, 0);
        const xArrowMesh = new THREE.Mesh(xArrow, new THREE.MeshStandardMaterial({ color: 0xff2222 }));
        
        // Y-axis (green)
        const yAxisCylinder = new THREE.CylinderGeometry(0.15, 0.15, axisLength, 8);
        yAxisCylinder.translate(0, axisLength/2, 0);
        const yAxisMesh = new THREE.Mesh(yAxisCylinder, new THREE.MeshStandardMaterial({ color: 0x22dd22 }));
        
        // Y-axis arrow
        const yArrow = new THREE.ConeGeometry(0.5, arrowSize, 12);
        yArrow.translate(0, axisLength, 0);
        const yArrowMesh = new THREE.Mesh(yArrow, new THREE.MeshStandardMaterial({ color: 0x22dd22 }));
        
        // Z-axis (blue)
        const zAxisCylinder = new THREE.CylinderGeometry(0.15, 0.15, axisLength, 8);
        zAxisCylinder.rotateX(Math.PI/2);
        zAxisCylinder.translate(0, 0, axisLength/2);
        const zAxisMesh = new THREE.Mesh(zAxisCylinder, new THREE.MeshStandardMaterial({ color: 0x2222dd }));
        
        // Z-axis arrow
        const zArrow = new THREE.ConeGeometry(0.5, arrowSize, 12);
        zArrow.rotateX(Math.PI/2);
        zArrow.translate(0, 0, axisLength);
        const zArrowMesh = new THREE.Mesh(zArrow, new THREE.MeshStandardMaterial({ color: 0x2222dd }));
        
        // Origin sphere
        const originSphere = new THREE.SphereGeometry(0.4, 16, 16);
        const originMesh = new THREE.Mesh(originSphere, new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        
        // Add all parts to the axis group
        axisGroup.add(xAxisMesh);
        axisGroup.add(xArrowMesh);
        axisGroup.add(yAxisMesh);
        axisGroup.add(yArrowMesh);
        axisGroup.add(zAxisMesh);
        axisGroup.add(zArrowMesh);
        axisGroup.add(originMesh);
        
        // Create text labels
        const createTextLabel = (text, position, color) => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = 64;
          canvas.height = 64;
          
          context.fillStyle = 'rgba(0,0,0,0)';
          context.fillRect(0, 0, canvas.width, canvas.height);
          
          context.font = 'Bold 40px Arial';
          context.textAlign = 'center';
          context.fillStyle = color;
          context.fillText(text, 32, 48);
          
          const texture = new THREE.Texture(canvas);
          texture.needsUpdate = true;
          
          const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
          const sprite = new THREE.Sprite(material);
          sprite.position.copy(position);
          sprite.scale.set(3, 3, 1);
          
          return sprite;
        };
        
        // Add text labels
        const xLabel = createTextLabel('X', new THREE.Vector3(axisLength + 2, 0, 0), '#ff2222');
        const yLabel = createTextLabel('Y', new THREE.Vector3(0, axisLength + 2, 0), '#22dd22');
        const zLabel = createTextLabel('Z', new THREE.Vector3(0, 0, axisLength + 2), '#2222dd');
        
        axisGroup.add(xLabel);
        axisGroup.add(yLabel);
        axisGroup.add(zLabel);
        
        // Position the axis in the corner of the scene
        axisGroup.position.set(-35, 0.1, -35);
        axisGroup.scale.set(0.6, 0.6, 0.6);
        scene.add(axisGroup);
      }
      
      // Enhanced lighting setup optimized for black theme
      // Subtle ambient light for minimal base illumination
      const ambientLight = new THREE.AmbientLight(0x111111, ambientLightIntensity);
      ambientLight.name = "AmbientLight";
      scene.add(ambientLight);
      lightsRef.current.ambient = ambientLight;
      
      // Main directional light (offset from overhead)
      const directionalLight = new THREE.DirectionalLight(0xffffff, mainLightIntensity);
      directionalLight.position.set(80, 150, 45); // Offset from directly overhead
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 10;
      directionalLight.shadow.camera.far = 250;
      directionalLight.shadow.camera.left = -100;
      directionalLight.shadow.camera.right = 100;
      directionalLight.shadow.camera.top = 100;
      directionalLight.shadow.camera.bottom = -100;
      directionalLight.name = "DirectionalLight";
      scene.add(directionalLight);
      lightsRef.current.directional = directionalLight;
      
      // Add a subtle fill light from the front
      const frontLight = new THREE.DirectionalLight(0xcccccc, 0.3);
      frontLight.position.set(0, 40, 100);
      frontLight.name = "FrontLight";
      scene.add(frontLight);
      lightsRef.current.front = frontLight;
      
      // Add a subtle rim light to highlight model edges
      const rimLight = new THREE.DirectionalLight(0x8888ff, 0.2);
      rimLight.position.set(-50, 20, -50);
      rimLight.name = "RimLight";
      scene.add(rimLight);
      lightsRef.current.rim = rimLight;
      
      // Configure renderer for better CAD-style visual quality
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
      gl.outputEncoding = THREE.sRGBEncoding;
      gl.physicallyCorrectLights = true;
      gl.gammaFactor = 2.2;
      gl.toneMappingExposure = 1.0;
      
      console.log("Enhanced CAD-style lighting setup complete");
      
    } catch (err) {
      console.error("Error setting up 3D scene:", err);
    }
    
    // Clean up function
    return () => {
      try {
        // Properly dispose of scene objects when component unmounts
        const ground = scene.getObjectByName("GroundPlane");
        const gridHelper = scene.getObjectByName("GridHelper");
        const majorGridHelper = scene.getObjectByName("MajorGridHelper");
        const axisGroup = scene.getObjectByName("AxisGroup");
        const ambientLight = scene.getObjectByName("AmbientLight");
        const directionalLight = scene.getObjectByName("DirectionalLight");
        const frontLight = scene.getObjectByName("FrontLight");
        const rimLight = scene.getObjectByName("RimLight");
        
        if (ground) {
          scene.remove(ground);
          ground.geometry.dispose();
          ground.material.dispose();
        }
        
        if (gridHelper) scene.remove(gridHelper);
        if (majorGridHelper) scene.remove(majorGridHelper);
        if (axisGroup) scene.remove(axisGroup);
        if (ambientLight) scene.remove(ambientLight);
        if (directionalLight) scene.remove(directionalLight);
        if (frontLight) scene.remove(frontLight);
        if (rimLight) scene.remove(rimLight);
        
        // Clear light references
        lightsRef.current = {
          ambient: null,
          directional: null,
          front: null,
          rim: null
        };
      } catch (err) {
        console.error("Error cleaning up scene:", err);
      }
    };
  }, [scene, gl, smallGridSize, gridDivisions, showAxis, backgroundColor]);
  
  return (
    <>
      {children}
      
      {/* Add pulsing lights for dynamic effect */}
      <PulsingLight 
        position={[30, 15, -20]} 
        color="#0066cc" 
        intensity={0.7} 
        distance={150} 
        frequency={1.2} 
      />
      <PulsingLight 
        position={[-25, 10, 30]} 
        color="#cc00aa" 
        intensity={0.6} 
        distance={120} 
        frequency={0.8} 
      />
    </>
  );
}

// A simplified version of DroneMissionWrapper that works as a fallback
const SimpleMissionPlanner = ({ cameraDetails, lensDetails, distanceToObject = 30 }) => {
  const { scene } = useThree();
  
  // Log scene information
  useEffect(() => {
    if (scene) {
      console.log("SimpleMissionPlanner scene:", {
        isThreeScene: scene instanceof THREE.Scene,
        childCount: scene.children?.length
      });
    }
  }, [scene]);
  
  // Return a simple placeholder that shows we're in fallback mode
  return (
    <group>
      <Html position={[0, 2, 0]}>
        <div style={{ 
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '12px',
          borderRadius: '4px',
          maxWidth: '300px',
          textAlign: 'center'
        }}>
          <h3>Simple Mission Planner</h3>
          {cameraDetails && lensDetails ? (
            <div>
              <p>Camera: {cameraDetails.brand} {cameraDetails.model}</p>
              <p>Lens: {lensDetails.brand} {lensDetails.model} {lensDetails.focalLength}mm</p>
              <p>Distance: {distanceToObject} ft</p>
            </div>
          ) : (
            <p>Please select drone, camera, and lens configuration</p>
          )}
        </div>
      </Html>
      
      {/* Removed CameraFrustum from here to avoid duplicates */}
    </group>
  );
};

// Define styled components for drone controls
const DroneControlWrapper = styled.div`
  background: rgba(30, 30, 30, 0.3);
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const DroneControlGroup = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DroneControlGroupLabel = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: #ddd;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
`;

const DroneControlItem = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DroneControlItemLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #ccc;
  
  span:first-child {
    font-weight: 500;
  }
  
  span:last-child {
    font-size: 0.85rem;
    color: #65b1ff;
    font-weight: 500;
    background: rgba(30, 60, 120, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    min-width: 50px;
    text-align: center;
    transition: background-color 0.2s ease;
  }
`;

const DroneControlRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 65px;
  align-items: center;
  gap: 12px;
`;

const EnhancedNumberInput = styled.input`
  width: 65px;
  height: 28px;
  padding: 4px 8px;
  background: rgba(20, 20, 20, 0.7);
  color: #fff;
  border: 1px solid rgba(80, 80, 80, 0.5);
  border-radius: 4px;
  font-size: 0.9rem;
  text-align: center;
  outline: none;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(100, 100, 100, 0.7);
  }

  &:focus {
    border-color: #2596ff;
    box-shadow: 0 0 0 2px rgba(0, 120, 255, 0.3);
  }

  /* Hide spin buttons */
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  /* Firefox */
  -moz-appearance: textfield;
`;

// Update the ManualDroneControls component
function ManualDroneControls({ position, setPosition, rotation, setRotation }) {
  // Convert degree value (0-359) to radians for rotation
  const degreesToRadians = (degrees) => {
    return THREE.MathUtils.degToRad(degrees);
  };

  // Get display rotation from radians (for UI display)
  const getDisplayRotation = (radians) => {
    let degrees = THREE.MathUtils.radToDeg(radians);
    degrees = (degrees + 360) % 360; // Normalize to 0-359
    return Math.round(degrees);
  };

  // Handle position change
  const handlePositionChange = (axis, value) => {
    const newPosition = [...position];
    newPosition[axis] = value;
    setPosition(newPosition);
    console.log(`Position updated: [${newPosition.join(', ')}]`);
  };
  
  // Handle rotation change
  const handleRotationChange = (axis, value) => {
    const newRotation = [...rotation];
    // Convert from degrees to radians
    newRotation[axis] = degreesToRadians(value);
    setRotation(newRotation);
    console.log(`Rotation updated: [${newRotation.map(rad => THREE.MathUtils.radToDeg(rad).toFixed(0)).join(', ')}]°`);
  };
  
  // Reset drone to default position and rotation
  const resetDrone = () => {
    // Default position is centered horizontally at Y=15
    setPosition([0, 15, 0]);
    // Default rotation is no rotation
    setRotation([0, 0, 0]);
    console.log("Drone reset to default position and rotation");
  };
  
  return (
    <DroneControlWrapper>
      <DroneControlGroup>
        <DroneControlGroupLabel>Position (feet)</DroneControlGroupLabel>
        
        {/* X Position */}
        <DroneControlItem>
          <DroneControlItemLabel>
            <span>X (Left/Right)</span>
            <span>{position[0].toFixed(2)}</span>
          </DroneControlItemLabel>
          <DroneControlRow>
            <StyledSlider
              value={position[0]}
              onChange={(value) => handlePositionChange(0, value)}
              min={-100}
              max={100}
              step={0.1}
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
            <EnhancedNumberInput
              type="number"
              min={-100}
              max={100}
              step={0.1}
              value={position[0]}
              onChange={(e) => handlePositionChange(0, parseFloat(e.target.value))}
            />
          </DroneControlRow>
        </DroneControlItem>
        
        {/* Y Position */}
        <DroneControlItem>
          <DroneControlItemLabel>
            <span>Y (Height)</span>
            <span>{position[1].toFixed(2)}</span>
          </DroneControlItemLabel>
          <DroneControlRow>
            <StyledSlider
              value={position[1]}
              onChange={(value) => handlePositionChange(1, value)}
              min={0}
              max={100}
              step={0.1}
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
            <EnhancedNumberInput
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={position[1]}
              onChange={(e) => handlePositionChange(1, parseFloat(e.target.value))}
            />
          </DroneControlRow>
        </DroneControlItem>
        
        {/* Z Position */}
        <DroneControlItem>
          <DroneControlItemLabel>
            <span>Z (Forward/Back)</span>
            <span>{position[2].toFixed(2)}</span>
          </DroneControlItemLabel>
          <DroneControlRow>
            <StyledSlider
              value={position[2]}
              onChange={(value) => handlePositionChange(2, value)}
              min={-100}
              max={100}
              step={0.1}
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
            <EnhancedNumberInput
              type="number"
              min={-100}
              max={100}
              step={0.1}
              value={position[2]}
              onChange={(e) => handlePositionChange(2, parseFloat(e.target.value))}
            />
          </DroneControlRow>
        </DroneControlItem>
      </DroneControlGroup>
      
      <DroneControlGroup>
        <DroneControlGroupLabel>Rotation (degrees)</DroneControlGroupLabel>
        
        {/* Pitch Rotation */}
        <DroneControlItem>
          <DroneControlItemLabel>
            <span>Pitch (X)</span>
            <span>{getDisplayRotation(rotation[0])}°</span>
          </DroneControlItemLabel>
          <DroneControlRow>
            <StyledSlider
              value={getDisplayRotation(rotation[0])}
              onChange={(value) => handleRotationChange(0, value)}
              min={0}
              max={359}
              step={1}
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
            <EnhancedNumberInput
              type="number"
              min={0}
              max={359}
              step={1}
              value={getDisplayRotation(rotation[0])}
              onChange={(e) => handleRotationChange(0, parseFloat(e.target.value))}
            />
          </DroneControlRow>
        </DroneControlItem>
        
        {/* Yaw Rotation */}
        <DroneControlItem>
          <DroneControlItemLabel>
            <span>Yaw (Y)</span>
            <span>{getDisplayRotation(rotation[1])}°</span>
          </DroneControlItemLabel>
          <DroneControlRow>
            <StyledSlider
              value={getDisplayRotation(rotation[1])}
              onChange={(value) => handleRotationChange(1, value)}
              min={0}
              max={359}
              step={1}
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
            <EnhancedNumberInput
              type="number"
              min={0}
              max={359}
              step={1}
              value={getDisplayRotation(rotation[1])}
              onChange={(e) => handleRotationChange(1, parseFloat(e.target.value))}
            />
          </DroneControlRow>
        </DroneControlItem>
        
        {/* Roll Rotation */}
        <DroneControlItem>
          <DroneControlItemLabel>
            <span>Roll (Z)</span>
            <span>{getDisplayRotation(rotation[2])}°</span>
          </DroneControlItemLabel>
          <DroneControlRow>
            <StyledSlider
              value={getDisplayRotation(rotation[2])}
              onChange={(value) => handleRotationChange(2, value)}
              min={0}
              max={359}
              step={1}
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
            <EnhancedNumberInput
              type="number"
              min={0}
              max={359}
              step={1}
              value={getDisplayRotation(rotation[2])}
              onChange={(e) => handleRotationChange(2, parseFloat(e.target.value))}
            />
          </DroneControlRow>
        </DroneControlItem>
      </DroneControlGroup>
      
      {/* Reset Button */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
        <ResetButton onClick={resetDrone}>
          Reset Drone Position
        </ResetButton>
      </div>
    </DroneControlWrapper>
  );
}

// Simple drone model representation as a colored box
function DroneModel({ position, rotation, scale = 1 }) {
  // Create a reference to the mesh
  const groupRef = useRef();
  
  // Update rotation when component mounts or rotation changes
  useEffect(() => {
    if (groupRef.current) {
      // Ensure we're working with the actual rotation values
      if (rotation) {
        groupRef.current.rotation.x = rotation[0];
        groupRef.current.rotation.y = rotation[1];
        groupRef.current.rotation.z = rotation[2];
      }
    }
  }, [rotation]);
  
  // Define colors
  const bodyColor = "#333333";
  const propellerColor = "#808080";
  const armColor = "#505050";
  const accentColor = "#3498db";
  const cameraColor = "#222222";
  
  return (
    <group ref={groupRef} position={position} scale={[scale, scale, scale]}>
      {/* Main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.15, 0.8]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      
      {/* Camera gimbal mount */}
      <mesh position={[0, -0.1, 0.3]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 0.1, 0.25]} />
        <meshStandardMaterial color={cameraColor} />
      </mesh>
      
      {/* Camera lens */}
      <mesh position={[0, -0.15, 0.3]} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.1, 16]} />
        <meshStandardMaterial color={"black"} />
      </mesh>
      
      {/* Arms and propellers */}
      {[
        { x: 0.5, z: 0.5, rotation: 0 },
        { x: -0.5, z: 0.5, rotation: Math.PI / 4 },
        { x: -0.5, z: -0.5, rotation: Math.PI / 2 },
        { x: 0.5, z: -0.5, rotation: Math.PI * 3 / 4 }
      ].map((prop, index) => (
        <group key={index} position={[prop.x, 0, prop.z]}>
          {/* Arm */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.1, 0.05, 0.5]} />
            <meshStandardMaterial color={armColor} />
          </mesh>
          
          {/* Motor housing */}
          <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          
          {/* Propeller */}
          <mesh position={[0, 0.12, 0]} rotation={[0, prop.rotation, 0]} castShadow>
            <boxGeometry args={[0.6, 0.02, 0.05]} />
            <meshStandardMaterial color={propellerColor} />
          </mesh>
          
          {/* Propeller (perpendicular) */}
          <mesh position={[0, 0.12, 0]} rotation={[0, prop.rotation + Math.PI/2, 0]} castShadow>
            <boxGeometry args={[0.6, 0.02, 0.05]} />
            <meshStandardMaterial color={propellerColor} />
          </mesh>
        </group>
      ))}
      
      {/* Status light */}
      <pointLight position={[0, 0.2, 0]} intensity={0.5} color="#ff0000" distance={2} />
      
      {/* Accent lights */}
      <mesh position={[0, 0, -0.35]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.05, 0.05]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// Reducer for drone state
function droneStateReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_POSITION':
      // Create a completely new position array to ensure React detects the state change
      return { 
        ...state, 
        position: action.payload 
      };
    case 'UPDATE_ROTATION':
      // Create a completely new rotation array to ensure React detects the state change
      return { 
        ...state, 
        rotation: action.payload 
      };
    case 'UPDATE_POSITION_AXIS':
      // Update a single axis of position
      const newPosition = [...state.position];
      newPosition[action.payload.axis] = action.payload.value;
      return {
        ...state,
        position: newPosition
      };
    case 'UPDATE_ROTATION_AXIS':
      // Update a single axis of rotation
      const newRotation = [...state.rotation];
      newRotation[action.payload.axis] = action.payload.value;
      return {
        ...state,
        rotation: newRotation
      };
    default:
      return state;
  }
}

// Add a customized camera control component that preserves state when following the drone
function CameraControls({ dronePosition, followDrone, centerOnMap, cameraOffset = [5, 5, 5], moveCamera = true, viewMode = 'perspective' }) {
  const camera = useThree((state) => state.camera);
  const controls = useRef(null);
  const prevPositionRef = useRef(dronePosition);
  const mapCenterPosition = [0, 0, 0];
  
  // Keep track of initial camera position and target for smooth transitions
  const initialPositionRef = useRef(null);
  const initialTargetRef = useRef(null);
  const isInitializedRef = useRef(false);
  
  // Store camera offset for position calculations
  const offset = useMemo(() => {
    return new THREE.Vector3(...cameraOffset);
  }, [cameraOffset]);

  // Initialize camera controls on first render
  useEffect(() => {
    if (controls.current && !isInitializedRef.current) {
      initialPositionRef.current = camera.position.clone();
      initialTargetRef.current = controls.current.target.clone();
      isInitializedRef.current = true;
      console.log("Camera controls initialized");
    }
  }, [camera]);

  // Effect to handle view mode changes
  useEffect(() => {
    if (!controls.current) return;
    
    // Create target vectors for smooth animation
    let targetPosition = new THREE.Vector3();
    let targetLookAt = new THREE.Vector3();
    
    // Set camera position based on view mode
    switch (viewMode) {
      case 'top':
        // Position camera directly above the scene looking down
        targetPosition.set(0, 150, 0);
        targetLookAt.set(0, 0, 0);
        break;
      case 'front':
        // Position camera in front of the scene
        targetPosition.set(0, 20, 120);
        targetLookAt.set(0, 20, 0);
        break;
      case 'side':
        // Position camera to the side of the scene
        targetPosition.set(120, 20, 0);
        targetLookAt.set(0, 20, 0);
        break;
      case 'perspective':
      default:
        // Use a better default perspective view
        targetPosition.set(60, 40, 60);
        targetLookAt.set(0, 15, 0);
        break;
    }
    
    // Animate to the new position
    const currentPosition = camera.position.clone();
    const currentLookAt = controls.current.target.clone();
    
    // Animation duration in milliseconds
    const duration = 800;
    const startTime = Date.now();
    
    // Animation function
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easing function for smoother transition
      const easeProgress = 1 - Math.cos(progress * Math.PI / 2);
      
      // Interpolate position and target
      camera.position.lerpVectors(currentPosition, targetPosition, easeProgress);
      controls.current.target.lerpVectors(currentLookAt, targetLookAt, easeProgress);
      
      // Update controls
      controls.current.update();
      
      // Continue animation if not complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    // Start animation
    animate();
    
  }, [viewMode, camera]);

  // Update camera target based on the selected mode
  useEffect(() => {
    try {
      if (!controls.current || !isInitializedRef.current) return;
      
      // Don't follow drone when in fixed views unless in perspective mode
      if (viewMode !== 'perspective') return;
      
      // Position to focus on
      let targetPosition;
      
      if (followDrone) {
        // Follow the drone
        targetPosition = new THREE.Vector3(...dronePosition);
      } else if (centerOnMap) {
        // Center on map
        targetPosition = new THREE.Vector3(...mapCenterPosition);
      } else {
        // Free mode - do nothing
        return;
      }
      
      // Update the orbit controls target
      if (moveCamera) {
        controls.current.target.copy(targetPosition);
        
        // If following drone, adjust camera position to maintain relative position
        if (followDrone) {
          const pos = prevPositionRef.current;
          const delta = [
            dronePosition[0] - pos[0],
            dronePosition[1] - pos[1],
            dronePosition[2] - pos[2]
          ];
          
          camera.position.x += delta[0];
          camera.position.y += delta[1];
          camera.position.z += delta[2];
        }
      }
      
      prevPositionRef.current = dronePosition;
    } catch (err) {
      console.error("Error updating camera target:", err);
    }
  }, [dronePosition, followDrone, centerOnMap, moveCamera, camera, viewMode]);

  return (
    <OrbitControls
      ref={controls}
      enableDamping={true}
      dampingFactor={0.1}
      rotateSpeed={0.7}
      minDistance={1}
      maxDistance={200}
    />
  );
}

// Create a Model component that can handle different 3D model types
const Model = ({ modelPath, modelFormat, scale = 1, opacity = 1, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const modelRef = useRef();
  const modelType = modelFormat || modelPath?.split('.')?.pop()?.toLowerCase() || 'obj';

  // Handle successful load
  const handleLoad = useCallback((loadedModel) => {
    console.log("Model loaded successfully:", loadedModel);
    setModel(loadedModel);
    setLoading(false);
    
    // Analyze the model to ensure it's valid
    if (loadedModel) {
      analyzeModel(loadedModel, modelPath);
    }
    
    // Apply materials and transformations
    try {
      // Set material properties
      if (loadedModel && loadedModel.traverse) {
        loadedModel.traverse((child) => {
          if (child.isMesh) {
            // Create a new material to avoid shared materials
            const newMaterial = child.material.clone();
            newMaterial.transparent = opacity < 1;
            newMaterial.opacity = opacity;
            newMaterial.needsUpdate = true;
            child.material = newMaterial;
          }
        });
      }
    } catch (err) {
      console.error("Error processing loaded model:", err);
      setError(`Error processing model: ${err.message}`);
    }
  }, [opacity, modelPath]);
  
  // Handle loading error
  const handleError = useCallback((err) => {
    console.error("Error loading model:", err);
    setError(`Failed to load model: ${err.message || "Unknown error"}`);
  }, []);
  
  // If error occurred, show error message
  if (error) {
    return (
      <mesh position={position}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="red" wireframe />
        <Html center>
          <div style={{ 
            background: 'rgba(255,0,0,0.8)', 
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            maxWidth: '200px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        </Html>
      </mesh>
    );
  }
  
  // Show loading indicator
  if (loading) {
    return (
      <mesh position={position}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="blue" wireframe />
        <Html center>
          <div style={{ 
            background: 'rgba(0,0,255,0.7)', 
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            maxWidth: '200px',
            textAlign: 'center'
          }}>
            <div>Loading model...</div>
            <div style={{ fontSize: '0.8em', marginTop: '5px', opacity: 0.8 }}>
              {modelFormat ? `Format: ${modelFormat.toUpperCase()}` : 'Detecting format...'}
            </div>
          </div>
        </Html>
      </mesh>
    );
  }
  
  return (
    <group ref={modelRef} position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {modelType === 'obj' && (
        <Suspense fallback={<mesh><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#4488ff" wireframe /></mesh>}>
          <OBJLoader 
            url={modelPath}
            onLoad={handleLoad}
            onError={handleError}
          />
        </Suspense>
      )}
      {modelType === 'ply' && (
        <Suspense fallback={<mesh><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#4488ff" wireframe /></mesh>}>
          <PLYLoader 
            url={modelPath}
            onLoad={handleLoad}
            onError={handleError}
          />
        </Suspense>
      )}
    </group>
  );
};

// Helper function to analyze a loaded model for debugging
function analyzeModel(model, url) {
  if (!model) {
    console.error("Model is null or undefined");
    return;
  }
  
  let totalVertices = 0;
  let totalFaces = 0;
  let meshCount = 0;
  let geometryIssues = 0;
  
  // Walk the model hierarchy
  model.traverse(child => {
    if (child.isMesh) {
      meshCount++;
      
      if (child.geometry) {
        const geometry = child.geometry;
        
        // Check position attribute
        if (geometry.attributes && geometry.attributes.position) {
          const vertices = geometry.attributes.position.count;
          totalVertices += vertices;
          
          // Check for NaN/invalid values
          const positions = geometry.attributes.position.array;
          let nanCount = 0;
          for (let i = 0; i < positions.length; i++) {
            if (isNaN(positions[i]) || !isFinite(positions[i])) {
              nanCount++;
            }
          }
          
          if (nanCount > 0) {
            console.warn(`Mesh ${meshCount} has ${nanCount} NaN values in positions`);
            geometryIssues++;
          }
          
          // Check face count
          if (geometry.index) {
            const faces = geometry.index.count / 3;
            totalFaces += faces;
            
            if (faces === 0) {
              console.warn(`Mesh ${meshCount} has 0 faces despite having ${vertices} vertices`);
              geometryIssues++;
            }
          } else {
            const faces = vertices / 3;
            totalFaces += faces;
            
            if (faces === 0) {
              console.warn(`Mesh ${meshCount} has 0 faces (non-indexed) despite having ${vertices} vertices`);
              geometryIssues++;
            }
          }
        } else {
          console.warn(`Mesh ${meshCount} has no position attribute`);
          geometryIssues++;
        }
        
        // Check bounding sphere
        if (!geometry.boundingSphere || isNaN(geometry.boundingSphere.radius)) {
          console.warn(`Mesh ${meshCount} has invalid bounding sphere`);
          geometryIssues++;
        }
      } else {
        console.warn(`Mesh ${meshCount} has no geometry`);
        geometryIssues++;
      }
    }
  });
  
  console.log(`Model analysis complete for ${url.substring(0, 100)}...`, {
    meshCount,
    totalVertices,
    totalFaces,
    geometryIssues,
    modelType: model.type || 'unknown',
    hasChildren: model.children?.length > 0
  });
  
  // Check if the model seems valid
  if (totalVertices === 0 || totalFaces === 0) {
    console.error("Model appears to have no geometry content - rendering will likely fail");
  } else if (geometryIssues > 0) {
    console.warn(`Model has ${geometryIssues} geometry issues that may affect rendering`);
  } else {
    console.log("Model appears valid and should render correctly");
  }
}

// Point Cloud component for LiDAR data
const LocalPointCloud = ({ url, scale = 1, opacity = 1, pointSize = 0.01, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
  const [error, setError] = useState(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [pointCloudInfo, setPointCloudInfo] = useState(null);
  
  // Extract any metadata from the URL if available
  const metadata = useMemo(() => {
    try {
      if (url && url.includes('?')) {
        const [baseUrl, queryString] = url.split('?');
        const params = new URLSearchParams(queryString);
        
        return {
          filename: params.get('filename'),
          size: parseInt(params.get('size') || '0', 10),
          type: params.get('type'),
          extension: params.get('extension') || '',
          lastModified: params.get('lastModified')
        };
      }
      return null;
    } catch (e) {
      console.warn('Error parsing URL metadata:', e);
      return null;
    }
  }, [url]);
  
  // Handle progress updates
  const handleProgress = (progress) => {
    setLoadProgress(progress);
    console.log(`Point cloud loading progress: ${Math.round(progress * 100)}%`);
  };
  
  // Handle successful load
  const handleLoad = (cloud) => {
    // Store information about the point cloud for display
    setPointCloudInfo({
      pointCount: cloud.pointCount || (cloud.geometry?.attributes?.position?.count || 0),
      boundingSize: cloud.boundingSize || 0,
      scale: cloud.autoScale || 1,
      autoScaled: cloud.autoScaleEnabled || false
    });
    
    console.log(`Point cloud loaded successfully with ${pointCloudInfo?.pointCount?.toLocaleString() || 'unknown'} points`);
    setLoadProgress(1); // Set to 100%
  };
  
  // Handle errors
  const handleError = (err) => {
    console.error('Error in PointCloud component:', err);
    setError(err.message || 'Failed to load point cloud');
  };
  
  // Always use PotreePointCloud for all point cloud types
  // Log detailed info about what we're trying to load
  console.log('PointCloud render with:', {
    url,
    hasMetadata: !!metadata,
    filename: metadata?.filename,
    extension: metadata?.extension,
    size: metadata?.size ? `${(metadata.size / 1024 / 1024).toFixed(2)}MB` : 'unknown',
    pointSize,
    opacity
  });
  
  // If we have a URL, render using PotreePointCloud component
  if (url) {
  return (
      <>
        <PotreePointCloud
          url={url}
          pointSize={pointSize}
          opacity={opacity}
          maxPoints={200_000}
          maxLod={10}
          enableEDL={false}
          enableClipping={false}
      position={position} 
      rotation={rotation}
          scale={scale}
          onProgress={handleProgress}
          onError={handleError}
          onLoad={handleLoad}
        />
        
        {/* Loading progress indicator */}
        {loadProgress < 1 && (
          <Html position={[0, 1, 0]} center>
            <div style={{
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '10px',
              borderRadius: '4px',
              textAlign: 'center',
              width: '220px'
            }}>
              <div>Loading {metadata?.filename || 'point cloud'}</div>
              <div style={{
                width: '100%', 
                height: '10px', 
                background: '#333', 
                marginTop: '8px',
                borderRadius: '5px',
                overflow: 'hidden' 
              }}>
                <div style={{
                  width: `${Math.round(loadProgress * 100)}%`,
                  height: '100%',
                  background: 'lime',
                  transition: 'width 0.3s ease-in-out'
                }}></div>
              </div>
              <div style={{ marginTop: '5px', fontSize: '0.8em' }}>
                {Math.round(loadProgress * 100)}%
              </div>
            </div>
          </Html>
        )}
        
        {/* Display point cloud info after loading */}
        {loadProgress === 1 && pointCloudInfo && (
          <Html position={[0, 1, 0]} center>
            <div style={{
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '0.8em',
              textAlign: 'center',
              maxWidth: '180px',
              opacity: 0.8
            }}>
              <div>{metadata?.filename || 'Point Cloud'}</div>
              <div>Points: {pointCloudInfo.pointCount.toLocaleString()}</div>
              {pointCloudInfo.autoScaled && (
                <div>Auto-scaled: {pointCloudInfo.scale.toFixed(2)}x</div>
              )}
            </div>
          </Html>
        )}
      </>
    );
  }
  
  // For completeness, handle errors
  if (error) {
    return (
      <Text position={[0, 1, 0]} color="red" fontSize={0.2} anchorX="center" anchorY="middle">
        {error}
      </Text>
    );
  }
  
  return null;
};

// Add this new component for Potree status notification
const PotreeStatusNotification = () => {
  const [potreeStatus, setPotreeStatus] = useState({
    checked: false,
    available: false,
    message: "Checking Potree availability..."
  });

  useEffect(() => {
    // Check if Potree exists in the window object
    const checkPotree = () => {
      const isPotreeAvailable = typeof window.Potree !== 'undefined';
      
      setPotreeStatus({
        checked: true,
        available: isPotreeAvailable,
        message: isPotreeAvailable 
          ? "✓ Potree advanced visualization library available" 
          : "⚠️ Potree advanced visualization library not found - using basic mode"
      });
    };

    // Wait a bit to ensure Potree had time to load
    const timer = setTimeout(checkPotree, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Only show if we've checked and Potree is not available
  if (!potreeStatus.checked || potreeStatus.available) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(255, 165, 0, 0.9)',
      color: '#000',
      padding: '6px 15px',
      borderRadius: '4px',
      fontSize: '13px',
      zIndex: 1000,
      textAlign: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      maxWidth: '500px'
    }}>
      <div style={{ fontWeight: 'bold' }}>{potreeStatus.message}</div>
      <div style={{ fontSize: '11px', marginTop: '3px' }}>
        LiDAR and large point cloud files will use simplified visualization.
        For best results, convert to PLY or PCD format.
      </div>
    </div>
  );
};

// Add the DebugModelComponent function
const DebugModelComponent = () => {
  // Create a simple test model with primitive geometry to verify rendering pipeline
  useEffect(() => {
    console.log("Debug model mounted - verifying Three.js rendering pipeline");
    return () => console.log("Debug model unmounted");
  }, []);
  
  return (
    <group position={[0, 0, 0]}>
      {/* Create a composite test object to verify rendering */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="blue" />
      </mesh>
      <mesh position={[1, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="red" />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.5, 16]} />
        <meshStandardMaterial color="green" />
      </mesh>
    </group>
  );
};

// Add a function to validate OBJ files
function validateObjFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const objText = event.target.result;
        const objLines = objText.split('\n');
        const objData = {
          vertices: [],
          faces: []
        };

        for (let line of objLines) {
          line = line.trim();
          if (line.startsWith('v ')) {
            const [, x, y, z] = line.split(' ').map(parseFloat);
            objData.vertices.push(new THREE.Vector3(x, y, z));
          } else if (line.startsWith('f ')) {
            const [, ...indices] = line.split(' ').map(parseFloat);
            objData.faces.push(indices.map(index => index - 1));
          }
        }

        resolve(objData);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Add a function to detect performance profile for resource allocation
function detectPerformanceProfile() {
  // Check for GPU and CPU capabilities
  const isAppleSilicon = 
    navigator.userAgent.includes('Mac') && 
    (navigator.userAgent.includes('Apple M1') || 
     navigator.userAgent.includes('Apple M2') || 
     navigator.userAgent.includes('Apple M3'));
  
  const isHighEndDevice = 
    window.navigator.hardwareConcurrency >= 8 || 
    isAppleSilicon;
  
  const isLowEndDevice = 
    window.navigator.deviceMemory < 4 || 
    window.navigator.hardwareConcurrency <= 2;
  
  return {
    isAppleSilicon,
    isHighEnd: isHighEndDevice,
    isLowEnd: isLowEndDevice,
    maxPointBudget: isHighEndDevice ? 2000000 : 
                   (isLowEndDevice ? 100000 : 500000),
    maxTextures: isHighEndDevice ? 16 : 8,
    recommendedPointSize: isHighEndDevice ? 0.5 : 1.0
  };
}

const ViewerContainer = styled.div`
  flex: 1;
  position: relative;
  height: 100%;
  background-color: #222222;
  transition: padding-left 0.3s ease;
`;

const MenuSection = styled.div`
  margin-bottom: 0;
`;

const SectionTitle = styled.h3`
  font-size: 15px;
  color: #4f88e3;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
  font-weight: 500;
`;

const ViewControls = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 150px;
  background-color: rgba(18, 18, 18, 0.85);
  border: 1px solid #333333;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
`;

const FileInput = styled.input`
  display: none;
`;

const ImportStatusMessage = styled.div`
  display: flex;
  align-items: center;
  padding: 12px;
  margin-top: 12px;
  border-radius: 6px;
  font-size: 0.95rem;
  background-color: ${props => props.error ? 'rgba(255, 80, 80, 0.15)' : 'rgba(80, 255, 120, 0.15)'};
  color: ${props => props.error ? '#ff6b6b' : '#6bff9e'};
  border: 1px solid ${props => props.error ? 'rgba(255, 80, 80, 0.3)' : 'rgba(80, 255, 120, 0.3)'};
`;

// Create a PostProcessingEffects component
function PostProcessingEffects() {
  return (
    <EffectComposer>
      {/* Bloom effect for light glow */}
      <Bloom 
        intensity={0.4} 
        luminanceThreshold={0.2} 
        luminanceSmoothing={0.9}
        height={300}
      />
      
      {/* Subtle chromatic aberration for sci-fi look */}
      <ChromaticAberration
        offset={[0.0015, 0.0015]}
        blendFunction={BlendFunction.NORMAL}
        opacity={0.7}
      />
      
      {/* Add a subtle noise grain */}
      <Noise 
        opacity={0.04}
        blendFunction={BlendFunction.OVERLAY}
      />
      
      {/* Add vignette for dramatic feel */}
      <Vignette
        eskil={false}
        offset={0.1}
        darkness={0.7}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}

// Create a custom animated light component
function PulsingLight({ position, color, intensity, distance, frequency = 1.5 }) {
  const light = useRef();
  
  // Animate the light intensity
  useFrame(({ clock }) => {
    if (light.current) {
      // Create a pulsing effect with sine wave
      light.current.intensity = intensity * (0.8 + Math.sin(clock.getElapsedTime() * frequency) * 0.2);
    }
  });
  
  return (
    <pointLight
      ref={light}
      position={position}
      color={color}
      intensity={intensity}
      distance={distance}
      castShadow
    />
  );
}

// Helper function to calculate contrast text color
function getContrastTextColor(hexColor) {
  // Remove the # if it exists
  const hex = hexColor.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  
  // Calculate luminance - using the relative luminance formula
  // See: https://www.w3.org/TR/WCAG20-TECHS/G17.html
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light colors and white for dark colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Main MissionPlanner component
function MissionPlanner() {
  // Add all necessary state variables
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('perspective');
  const [loadError, setLoadError] = useState(null);
  const [loadInfo, setLoadInfo] = useState(null);
  const [manualControlsExpanded, setManualControlsExpanded] = useState(false);
  const [advancedControlsExpanded, setAdvancedControlsExpanded] = useState(false);
  const [sceneOptionsExpanded, setSceneOptionsExpanded] = useState(true); // Set to true to show by default
  const [visualStyleExpanded, setVisualStyleExpanded] = useState(true); // State for Visual Style section
  const [dronePosition, setDronePosition] = useState([0, 15, 0]); // Set default Y to 15
  const [droneRotation, setDroneRotation] = useState([0, 0, 0]);
  const [showFrustum, setShowFrustum] = useState(true);
  const [followDrone, setFollowDrone] = useState(false);
  const [modelVisible, setModelVisible] = useState(true);
  const [modelScale, setModelScale] = useState(1.0);
  const [modelOpacity, setModelOpacity] = useState(1.0);
  const [loadedModelPath, setLoadedModelPath] = useState(null);
  const [loadedPointCloudPath, setLoadedPointCloudPath] = useState(null);
  const [distanceToObject, setDistanceToObject] = useState(30);
  const [frustumScale, setFrustumScale] = useState(1.0);
  const [showStats, setShowStats] = useState(false);
  
  // Scene options state
  const [smallGridSize, setSmallGridSize] = useState(200);
  const [gridDivisions, setGridDivisions] = useState(200);
  const [ambientLightIntensity, setAmbientLightIntensity] = useState(0.3);
  const [mainLightIntensity, setMainLightIntensity] = useState(0.7);
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [enablePostprocessing, setEnablePostprocessing] = useState(true);
  const [showAxis, setShowAxis] = useState(true);
  
  // Camera and lens information for frustum visualization
  const [cameraDetails, setCameraDetails] = useState({
    brand: "Phase One",
    model: "iXM-100",
    sensorWidth: 53.4,
    sensorHeight: 40.0
  });
  
  const [lensDetails, setLensDetails] = useState({
    brand: "Phase One",
    model: "RSM 80mm f/2.8",
    focalLength: 80
  });
  
  // Default drone configuration
  const [defaultDroneSelected, setDefaultDroneSelected] = useState(false);
  
  // Refs for file inputs
  const fileInputRef = useRef(null);
  const pointCloudInputRef = useRef(null);
  
  // Auto-select default drone configuration on mount
  useEffect(() => {
    if (!defaultDroneSelected) {
      // Create default configuration for Freefly Alta with Phase One iXM-100 and 80mm lens
      const defaultConfig = {
        drone: {
          brand: "Freefly",
          model: "Alta"
        },
        camera: {
          brand: "Phase One",
          model: "iXM-100",
          sensorWidth: 53.4,
          sensorHeight: 40.0
        },
        lens: {
          brand: "Phase One",
          model: "RSM 80mm f/2.8",
          focalLength: 80
        },
        distanceToObject: 30
      };
      
      // Update state with default configuration
      setCameraDetails(defaultConfig.camera);
      setLensDetails(defaultConfig.lens);
      setDistanceToObject(defaultConfig.distanceToObject);
      setDefaultDroneSelected(true);
      
      console.log("Default drone configuration set:", defaultConfig);
    }
  }, [defaultDroneSelected]);
  
  // Handler functions
  const handleImportModel = () => {
    fileInputRef.current?.click();
  };
  
  const handleImportPointCloud = () => {
    pointCloudInputRef.current?.click();
  };
  
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setLoadInfo(`Loading model: ${file.name}`);
    setLoadedModelPath(URL.createObjectURL(file));
  };
  
  const handlePointCloudFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setLoadInfo(`Loading point cloud: ${file.name}`);
    setLoadedPointCloudPath(URL.createObjectURL(file));
  };
  
  const handleDroneConfigSelected = (config) => {
    console.log("Drone config selected:", config);
    if (config) {
      // Update camera and lens details
      setCameraDetails(config.camera || cameraDetails);
      setLensDetails(config.lens || lensDetails);
      setDistanceToObject(config.distanceToObject || 30);
      
      // Ensure we have valid data
      if (!config.camera || !config.lens) {
        console.warn("Incomplete camera/lens data in drone config:", config);
      } else {
        console.log("Updated camera frustum with:", {
          camera: config.camera.model,
          lens: `${config.lens.focalLength}mm`,
          distance: config.distanceToObject
        });
      }
    }
  };
  
  // Return the main component
  return (
    <>
      <GlobalStyle />
      <LayoutContainer>
        {/* Left side menu pane */}
        <MenuPane collapsed={menuCollapsed}>
          <MenuHeader>
            <MenuTitle>Mission Planner</MenuTitle>
            <CollapseButton onClick={() => setMenuCollapsed(!menuCollapsed)}>
              <FiChevronLeft />
            </CollapseButton>
          </MenuHeader>

          <MenuContent>
            {/* Import section */}
            <MenuSection>
              <SectionTitle>Import</SectionTitle>
              
              {/* OBJ Model Import */}
              <ImportButton onClick={handleImportModel}>
                <ThreeDIcon />
                Import 3D Model (OBJ)
              </ImportButton>
              <FileInput
                type="file"
                accept=".obj,.mtl"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              
              {/* LiDAR Point Cloud Import */}
              <ImportButton onClick={handleImportPointCloud}>
                <PointCloudIcon />
                Import Point Cloud (PLY/PCD)
              </ImportButton>
              <FileInput
                type="file"
                accept=".ply,.pcd,.las,.laz"
                ref={pointCloudInputRef}
                onChange={handlePointCloudFileChange}
              />
              
              {/* Show import status if available */}
              {loadInfo && (
                <ImportStatusMessage error={false}>
                  <InfoIcon />
                  {loadInfo}
                </ImportStatusMessage>
              )}
              
              {/* Show error if available */}
              {loadError && (
                <ImportStatusMessage error={true}>
                  <WarningIcon />
                  {loadError}
                </ImportStatusMessage>
              )}
            </MenuSection>
            
            {/* Drone Configuration Section */}
            <MenuSection>
              <SectionTitle>Drone Configuration</SectionTitle>
              <DroneSelector
                dronePosition={dronePosition}
                droneRotation={droneRotation}
                onPositionChange={setDronePosition}
                onRotationChange={setDroneRotation}
                onDroneConfigSelected={handleDroneConfigSelected}
              />
            </MenuSection>
            
            {/* Model Controls Section */}
            {(loadedModelPath || loadedPointCloudPath) && (
              <MenuSection>
                <SectionTitle>Model Controls</SectionTitle>
                
                <div style={{ background: 'rgba(30, 30, 30, 0.3)', padding: '16px', borderRadius: '8px' }}>
                  <CheckboxLabel>
                    <input
                      type="checkbox"
                      checked={modelVisible}
                      onChange={(e) => setModelVisible(e.target.checked)}
                    />
                    <span>Model Visible</span>
                  </CheckboxLabel>
                  
                  <SliderContainer>
                    <SliderLabel>Scale</SliderLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px', alignItems: 'center', gap: '12px' }}>
                      <RangeInput
                        type="range"
                        min="0.01"
                        max="10"
                        step="0.01"
                        value={modelScale}
                        onChange={(e) => setModelScale(parseFloat(e.target.value))}
                      />
                      <NumberInput
                        type="number"
                        min="0.01"
                        max="10"
                        step="0.01"
                        value={modelScale}
                        onChange={(e) => setModelScale(parseFloat(e.target.value))}
                        style={{ justifySelf: 'end' }}
                      />
                    </div>
                  </SliderContainer>
                  
                  <SliderContainer style={{ marginBottom: 0 }}>
                    <SliderLabel>Opacity</SliderLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px', alignItems: 'center', gap: '12px' }}>
                      <RangeInput
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={modelOpacity}
                        onChange={(e) => setModelOpacity(parseFloat(e.target.value))}
                      />
                      <NumberInput
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={modelOpacity}
                        onChange={(e) => setModelOpacity(parseFloat(e.target.value))}
                        style={{ justifySelf: 'end' }}
                      />
                    </div>
                  </SliderContainer>
                </div>
              </MenuSection>
            )}
            
            {/* Manual Drone Positioning - keep only this one instance */}
            <MenuSection>
              <ViewControlsHeader onClick={() => setManualControlsExpanded(!manualControlsExpanded)}>
                Manual Drone Positioning
                <span>{manualControlsExpanded ? '▲' : '▼'}</span>
              </ViewControlsHeader>
              
              <SectionContent isExpanded={manualControlsExpanded}>
                <ManualDroneControls 
                  position={dronePosition}
                  setPosition={setDronePosition}
                  rotation={droneRotation}
                  setRotation={setDroneRotation}
                />
              </SectionContent>
            </MenuSection>
            
            {/* Advanced Controls Section */}
            <MenuSection>
              <ViewControlsHeader onClick={() => setAdvancedControlsExpanded(!advancedControlsExpanded)}>
                Advanced Controls
                <span>{advancedControlsExpanded ? '▲' : '▼'}</span>
              </ViewControlsHeader>
              
              <SectionContent isExpanded={advancedControlsExpanded} style={{ background: 'rgba(30, 30, 30, 0.3)', padding: '12px', borderRadius: '8px' }}>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={showFrustum}
                    onChange={(e) => setShowFrustum(e.target.checked)}
                  />
                  <span>Show Camera Frustum</span>
                </CheckboxLabel>
                
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={followDrone}
                    onChange={(e) => setFollowDrone(e.target.checked)}
                  />
                  <span>Follow Drone</span>
                </CheckboxLabel>
                
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={showStats}
                    onChange={(e) => setShowStats(e.target.checked)}
                  />
                  <span>Show Performance Stats</span>
                </CheckboxLabel>
                
                {/* Add Scene Options Sub-Section */}
                <ViewControlsHeader 
                  onClick={() => setSceneOptionsExpanded(!sceneOptionsExpanded)}
                  style={{ 
                    marginTop: '16px', 
                    fontSize: '0.9rem', 
                    color: '#65b1ff',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    paddingBottom: '8px'
                  }}
                >
                  Scene Options
                  <span>{sceneOptionsExpanded ? '▲' : '▼'}</span>
                </ViewControlsHeader>
                
                <SectionContent isExpanded={sceneOptionsExpanded} style={{ 
                  background: 'rgba(20, 20, 30, 0.4)', 
                  padding: '10px', 
                  borderRadius: '6px',
                  marginTop: '8px'
                }}>
                  {/* Grid Size Controls */}
                  <DroneControlItem>
                    <DroneControlItemLabel>
                      <span>Small Grid Size (feet)</span>
                      <span>{smallGridSize}</span>
                    </DroneControlItemLabel>
                    <DroneControlRow>
                      <StyledSlider
                        value={smallGridSize}
                        onChange={(value) => setSmallGridSize(value)}
                        min={50}
                        max={500}
                        step={10}
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
                      <EnhancedNumberInput
                        type="number"
                        min={50}
                        max={500}
                        step={10}
                        value={smallGridSize}
                        onChange={(e) => setSmallGridSize(parseInt(e.target.value))}
                      />
                    </DroneControlRow>
                  </DroneControlItem>
                  
                  <DroneControlItem>
                    <DroneControlItemLabel>
                      <span>Grid Divisions</span>
                      <span>{gridDivisions}</span>
                    </DroneControlItemLabel>
                    <DroneControlRow>
                      <StyledSlider
                        value={gridDivisions}
                        onChange={(value) => setGridDivisions(value)}
                        min={10}
                        max={200}
                        step={10}
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
                      <EnhancedNumberInput
                        type="number"
                        min={10}
                        max={200}
                        step={10}
                        value={gridDivisions}
                        onChange={(e) => setGridDivisions(parseInt(e.target.value))}
                      />
                    </DroneControlRow>
                  </DroneControlItem>
                  
                  <div style={{ 
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                    margin: '10px 0', 
                    paddingTop: '10px' 
                  }}>
                    <h4 style={{ 
                      margin: '0 0 10px 0', 
                      fontSize: '0.85rem', 
                      color: '#65b1ff',
                      fontWeight: 'normal' 
                    }}>
                      Lighting Controls
                    </h4>
                  </div>
                  
                  {/* Lighting Controls */}
                  <DroneControlItem>
                    <DroneControlItemLabel>
                      <span>Ambient Light</span>
                      <span>{ambientLightIntensity.toFixed(1)}</span>
                    </DroneControlItemLabel>
                    <DroneControlRow>
                      <StyledSlider
                        value={ambientLightIntensity}
                        onChange={(value) => setAmbientLightIntensity(value)}
                        min={0}
                        max={1}
                        step={0.1}
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
                      <EnhancedNumberInput
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={ambientLightIntensity}
                        onChange={(e) => setAmbientLightIntensity(parseFloat(e.target.value))}
                      />
                    </DroneControlRow>
                  </DroneControlItem>
                  
                  <DroneControlItem>
                    <DroneControlItemLabel>
                      <span>Main Light</span>
                      <span>{mainLightIntensity.toFixed(1)}</span>
                    </DroneControlItemLabel>
                    <DroneControlRow>
                      <StyledSlider
                        value={mainLightIntensity}
                        onChange={(value) => setMainLightIntensity(value)}
                        min={0}
                        max={1}
                        step={0.1}
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
                      <EnhancedNumberInput
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={mainLightIntensity}
                        onChange={(e) => setMainLightIntensity(parseFloat(e.target.value))}
                      />
                    </DroneControlRow>
                  </DroneControlItem>
                  
                  {/* Enhanced Lighting Effects checkbox - moved to lighting controls section */}
                  <CheckboxLabel style={{ marginTop: '10px' }}>
                    <input
                      type="checkbox"
                      checked={enablePostprocessing}
                      onChange={(e) => setEnablePostprocessing(e.target.checked)}
                    />
                    <span>Enhanced Lighting Effects</span>
                  </CheckboxLabel>
                </SectionContent>
                
                {/* Visual Style as a collapsable section */}
                <ViewControlsHeader 
                  onClick={() => setVisualStyleExpanded(!visualStyleExpanded)}
                  style={{ 
                    marginTop: '16px', 
                    fontSize: '0.9rem', 
                    color: '#65b1ff',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    paddingBottom: '8px'
                  }}
                >
                  Visual Style
                  <span>{visualStyleExpanded ? '▲' : '▼'}</span>
                </ViewControlsHeader>
                
                <SectionContent isExpanded={visualStyleExpanded} style={{ 
                  background: 'rgba(20, 20, 30, 0.4)', 
                  padding: '10px', 
                  borderRadius: '6px',
                  marginTop: '8px'
                }}>
                  {/* Background Color */}
                  <DroneControlItem>
                    <DroneControlItemLabel>
                      <span>Background</span>
                      <span>{backgroundColor}</span>
                    </DroneControlItemLabel>
                    <div style={{ position: 'relative' }}>
                      {/* Current color preview - clicking opens the picker */}
                      <ColorPreview 
                        color={backgroundColor} 
                        onClick={() => setShowColorPicker(!showColorPicker)}
                      >
                        <span style={{ 
                          color: getContrastTextColor(backgroundColor),
                          fontSize: '0.9rem',
                          fontWeight: '500',
                          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }}>
                          Select Color
                        </span>
                      </ColorPreview>
                      
                      {/* Color picker popup */}
                      {showColorPicker && (
                        <div style={{ position: 'relative', zIndex: 10 }}>
                          <Cover onClick={() => setShowColorPicker(false)} />
                          <Popover>
                            <ChromePicker 
                              color={backgroundColor}
                              onChange={(color) => setBackgroundColor(color.hex)}
                              disableAlpha={true}
                            />
                          </Popover>
                        </div>
                      )}
                      
                      {/* Quick selection presets */}
                      <div style={{ display: 'flex', marginTop: '8px', gap: '8px' }}>
                        <ColorButton 
                          active={backgroundColor === "#000000"} 
                          color="#000000" 
                          onClick={() => setBackgroundColor("#000000")}
                        >
                          Black
                        </ColorButton>
                        <ColorButton 
                          active={backgroundColor === "#111133"} 
                          color="#111133" 
                          onClick={() => setBackgroundColor("#111133")}
                        >
                          Dark Blue
                        </ColorButton>
                        <ColorButton 
                          active={backgroundColor === "#222222"} 
                          color="#222222" 
                          onClick={() => setBackgroundColor("#222222")}
                        >
                          Dark Gray
                        </ColorButton>
                      </div>
                    </div>
                  </DroneControlItem>
                  
                  {/* Show Coordinate Axes checkbox */}
                  <CheckboxLabel style={{ marginTop: '10px' }}>
                    <input
                      type="checkbox"
                      checked={showAxis}
                      onChange={(e) => setShowAxis(e.target.checked)}
                    />
                    <span>Show Coordinate Axes</span>
                  </CheckboxLabel>
                </SectionContent>
              </SectionContent>
            </MenuSection>
          </MenuContent>
        </MenuPane>
        
        {/* Right side 3D viewer with expand/collapse button */}
        <ViewerContainer expanded={menuCollapsed}>
          {menuCollapsed && (
            <ExpandButton onClick={() => setMenuCollapsed(false)}>
              <FiChevronRight />
            </ExpandButton>
          )}
          
          <ViewControls>
            <ViewButton 
              active={viewMode === 'perspective'}
              onClick={() => setViewMode('perspective')}
            >
              Perspective
            </ViewButton>
            <ViewButton 
              active={viewMode === 'top'}
              onClick={() => setViewMode('top')}
            >
              Top View
            </ViewButton>
            <ViewButton 
              active={viewMode === 'front'}
              onClick={() => setViewMode('front')}
            >
              Front View
            </ViewButton>
            <ViewButton 
              active={viewMode === 'side'}
              onClick={() => setViewMode('side')}
            >
              Side View
            </ViewButton>
          </ViewControls>
          
          <Canvas
            shadows 
            dpr={[1, 2]}
            camera={{ position: [0, 25, 50], fov: 50 }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: "high-performance",
              stencil: false,
              depth: true,
              physicallyCorrectLights: true
            }}
            onCreated={({ gl, scene }) => {
              // Configure renderer with current backgroundColor
              gl.setClearColor(backgroundColor, 1);
              scene.background = new THREE.Color(backgroundColor);
              gl.physicallyCorrectLights = true;
              
              // Limit memory usage (may help prevent context loss)
              gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
              
              // Disable automatic clearing to improve performance
              if (window.performance && window.performance.memory && window.performance.memory.totalJSHeapSize > 500000000) {
                gl.autoClear = false;
              }
              
              // Log WebGL context creation
              console.log('WebGL context created:', gl);
            }}
          >
            <Suspense fallback={<Html center><div className="loading">Loading...</div></Html>}>
              <SceneSetup 
                ambientLightIntensity={ambientLightIntensity}
                mainLightIntensity={mainLightIntensity}
                smallGridSize={smallGridSize}
                gridDivisions={gridDivisions}
                showAxis={showAxis}
                backgroundColor={backgroundColor}
              >
                {/* Background color updater - ensures color changes are applied */}
                <BackgroundColorUpdater color={backgroundColor} />
                
                {/* Camera controls for navigation */}
                <CameraControls 
                  dronePosition={dronePosition} 
                  followDrone={followDrone} 
                  centerOnMap={true}
                  viewMode={viewMode}
                />
                
                {/* Imported model or point cloud */}
                {loadedModelPath && modelVisible && (
                  <Model 
                    modelPath={loadedModelPath} 
                    modelFormat={loadedModelPath?.split('.')?.pop()?.toLowerCase()}
                    scale={modelScale}
                    opacity={modelOpacity}
                    position={[0, 0, 0]}
                  />
                )}
                
                {/* Point cloud if loaded */}
                {loadedPointCloudPath && modelVisible && (
                  <Suspense fallback={null}>
                    <PotreePointCloud
                      url={loadedPointCloudPath}
                      position={[0, 0, 0]}
                      scale={modelScale}
                      opacity={modelOpacity}
                    />
                  </Suspense>
                )}
                
                {/* Drone model with camera frustum */}
                <DroneModel 
                  position={dronePosition} 
                  rotation={[droneRotation[0], droneRotation[1] + Math.PI, droneRotation[2]]} // Rotate 180 degrees around Y axis
                />
                
                {/* Show camera frustum if enabled */}
                {showFrustum && cameraDetails && lensDetails && (
                  <CameraFrustum 
                    cameraDetails={cameraDetails}
                    lensDetails={lensDetails}
                    position={[dronePosition[0], dronePosition[1] - 0.5, dronePosition[2]]} // Offset downward by ~6 inches
                    rotation={droneRotation}
                    scale={frustumScale || 1.0}
                    distanceToObject={distanceToObject}
                    key={`frustum-${cameraDetails.model}-${lensDetails.focalLength}-${distanceToObject}`} 
                  />
                )}
                
                {/* FPS stats in development mode */}
                {process.env.NODE_ENV === 'development' && showStats && (
                  <Stats />
                )}
              </SceneSetup>
              
              {/* Add the post-processing effects only if enabled */}
              {enablePostprocessing && <PostProcessingEffects />}
            </Suspense>
          </Canvas>
        </ViewerContainer>
      </LayoutContainer>
    </>
  );
}

export default MissionPlanner; 