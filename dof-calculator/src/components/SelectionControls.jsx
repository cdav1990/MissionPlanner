import React, { useState, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls, Box, Sphere, Line, Html } from '@react-three/drei';
import styled from 'styled-components';
import * as THREE from 'three';

// Styled components for UI
const ControlsOverlay = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ControlButton = styled.button`
  padding: 8px 12px;
  background-color: rgba(26, 91, 183, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background-color: rgba(79, 136, 227, 0.9);
  }
  
  &.active {
    background-color: rgba(79, 136, 227, 1);
    box-shadow: 0 0 8px rgba(79, 136, 227, 0.8);
  }
  
  svg {
    font-size: 16px;
  }
`;

const MeasurementText = styled.div`
  position: absolute;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  transform: translate(-50%, -50%);
`;

/**
 * Measurement line component
 */
const MeasurementLine = ({ start, end, color = '#ffff00' }) => {
  const points = [start, end];
  const distance = start.distanceTo(end);
  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  
  return (
    <>
      <Line points={points} color={color} lineWidth={2} />
      <Html position={midPoint}>
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          color: 'white', 
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          transform: 'translate(-50%, -50%)',
          whiteSpace: 'nowrap'
        }}>
          {distance.toFixed(2)} units
        </div>
      </Html>
    </>
  );
};

/**
 * Selection controls component for interacting with 3D objects and point clouds
 */
const SelectionControls = ({ 
  selectedObject, 
  onModeChange, 
  onClearSelection 
}) => {
  const [mode, setMode] = useState('translate'); // translate, rotate, scale, measure
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measureActive, setMeasureActive] = useState(false);
  const { scene, camera, raycaster, mouse, gl } = useThree();
  
  // Handle mode change
  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    
    if (newMode === 'measure') {
      setMeasureActive(true);
      setMeasurePoints([]);
    } else {
      setMeasureActive(false);
    }
    
    if (onModeChange) {
      onModeChange(newMode);
    }
  }, [onModeChange]);
  
  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    if (onClearSelection) {
      onClearSelection();
    }
    
    setMeasurePoints([]);
    setMeasureActive(false);
  }, [onClearSelection]);
  
  // Handle canvas click for measurements
  useEffect(() => {
    if (!measureActive) return;
    
    const handleClick = (event) => {
      // Calculate normalized device coordinates
      const x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
      const y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;
      
      // Update raycaster
      raycaster.setFromCamera({ x, y }, camera);
      
      // Get intersections with all objects
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        // Get intersection point
        const point = intersects[0].point.clone();
        
        // Add point to measurement
        setMeasurePoints(prev => {
          if (prev.length >= 2) {
            return [point]; // Start new measurement
          }
          return [...prev, point];
        });
      }
    };
    
    // Add event listener
    gl.domElement.addEventListener('click', handleClick);
    
    // Cleanup
    return () => {
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [measureActive, gl, raycaster, camera, scene]);
  
  return (
    <>
      {/* Canvas overlay UI */}
      <ControlsOverlay>
        <ControlButton 
          onClick={() => handleModeChange('translate')}
          className={mode === 'translate' ? 'active' : ''}
        >
          Move
        </ControlButton>
        
        <ControlButton 
          onClick={() => handleModeChange('rotate')}
          className={mode === 'rotate' ? 'active' : ''}
        >
          Rotate
        </ControlButton>
        
        <ControlButton 
          onClick={() => handleModeChange('scale')}
          className={mode === 'scale' ? 'active' : ''}
        >
          Scale
        </ControlButton>
        
        <ControlButton 
          onClick={() => handleModeChange('measure')}
          className={mode === 'measure' ? 'active' : ''}
        >
          Measure
        </ControlButton>
        
        <ControlButton onClick={handleClearSelection}>
          Clear
        </ControlButton>
      </ControlsOverlay>
      
      {/* Transform controls for selected object */}
      {selectedObject && mode !== 'measure' && (
        <TransformControls
          object={selectedObject}
          mode={mode}
          size={1}
          onMouseUp={() => {
            // Update the scene when transformation is complete
            scene.updateMatrixWorld();
          }}
        />
      )}
      
      {/* Measurement points */}
      {measurePoints.map((point, index) => (
        <Sphere key={`point-${index}`} args={[0.1, 16, 16]} position={point}>
          <meshBasicMaterial color="#ffff00" />
        </Sphere>
      ))}
      
      {/* Measurement line */}
      {measurePoints.length === 2 && (
        <MeasurementLine start={measurePoints[0]} end={measurePoints[1]} />
      )}
    </>
  );
};

export default SelectionControls; 