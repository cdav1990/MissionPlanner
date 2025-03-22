/**
 * Helper components for UI visualization and spatial reference in 3D space
 */

import React, { useEffect } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Component that renders colored arrows along each axis for spatial reference
 * @param {Object} props - Component props
 * @param {Array} props.position - [x, y, z] position coordinates
 * @param {number} props.size - Size of the arrows
 * @param {boolean} props.showLabels - Whether to show X, Y, Z labels
 */
export const AxisArrows = ({ position = [0, 0, 0], size = 1, showLabels = true }) => {
  return (
    <group position={position}>
      {/* X Axis - Red */}
      <arrowHelper 
        args={[
          new THREE.Vector3(1, 0, 0), // Direction
          new THREE.Vector3(0, 0, 0), // Origin
          size,                       // Length
          0xff0000,                   // Color (red)
          size * 0.2,                 // Head length
          size * 0.1                  // Head width
        ]}
      />
      
      {/* Y Axis - Green */}
      <arrowHelper 
        args={[
          new THREE.Vector3(0, 1, 0), // Direction
          new THREE.Vector3(0, 0, 0), // Origin
          size,                       // Length
          0x00ff00,                   // Color (green)
          size * 0.2,                 // Head length
          size * 0.1                  // Head width
        ]}
      />
      
      {/* Z Axis - Blue */}
      <arrowHelper 
        args={[
          new THREE.Vector3(0, 0, 1), // Direction
          new THREE.Vector3(0, 0, 0), // Origin
          size,                       // Length
          0x0000ff,                   // Color (blue)
          size * 0.2,                 // Head length
          size * 0.1                  // Head width
        ]}
      />
      
      {/* Axis labels */}
      {showLabels && (
        <>
          <Html position={[size * 1.1, 0, 0]}>
            <div style={{ color: 'red', fontWeight: 'bold' }}>X</div>
          </Html>
          <Html position={[0, size * 1.1, 0]}>
            <div style={{ color: 'green', fontWeight: 'bold' }}>Y</div>
          </Html>
          <Html position={[0, 0, size * 1.1]}>
            <div style={{ color: 'blue', fontWeight: 'bold' }}>Z</div>
          </Html>
        </>
      )}
    </group>
  );
};

/**
 * Component that renders a unit cube for scale reference
 * @param {Object} props - Component props
 * @param {Array} props.position - [x, y, z] position coordinates
 * @param {number} props.size - Size of the cube (1 = 1 unit)
 * @param {string} props.color - Color of the cube
 * @param {number} props.opacity - Opacity of the cube (0-1)
 * @param {boolean} props.showLabel - Whether to show a label
 */
export const UnitCube = ({ 
  position = [0, 0, 0], 
  size = 1, 
  color = '#888888', 
  opacity = 0.3,
  showLabel = true 
}) => {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshBasicMaterial 
          color={color} 
          transparent={opacity < 1} 
          opacity={opacity} 
          wireframe
        />
      </mesh>
      
      {showLabel && (
        <Html position={[0, size / 2 + 0.2, 0]} center>
          <div style={{ 
            color: 'white', 
            fontSize: '12px',
            padding: '2px 5px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '3px',
            whiteSpace: 'nowrap'
          }}>
            1 unit³
          </div>
        </Html>
      )}
    </group>
  );
}; 