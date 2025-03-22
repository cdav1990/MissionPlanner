import React from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Drone model with improved details and navigation markers
function DroneModel({ position, rotation = [0, 0, 0], scale = 1.0 }) {
  const droneRef = useRef();
  
  // Convert rotation from degrees to radians
  const rotationRad = rotation.map(r => THREE.MathUtils.degToRad(r));
  
  return (
    <group ref={droneRef} position={position} rotation={rotationRad} scale={[scale, scale, scale]}>
      {/* Main drone body */}
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.15, 0.6]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      {/* Camera housing */}
      <mesh position={[0, -0.1, 0.2]} castShadow>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      
      {/* Camera lens */}
      <mesh position={[0, -0.12, 0.26]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
        <meshStandardMaterial color="#3f3f3f" />
      </mesh>
      
      {/* Arms */}
      <mesh position={[0.4, 0, 0.4]} rotation={[0, Math.PI/4, 0]} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.05]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      
      <mesh position={[-0.4, 0, 0.4]} rotation={[0, -Math.PI/4, 0]} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.05]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      
      <mesh position={[0.4, 0, -0.4]} rotation={[0, -Math.PI/4, 0]} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.05]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      
      <mesh position={[-0.4, 0, -0.4]} rotation={[0, Math.PI/4, 0]} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.05]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      
      {/* Motors */}
      <mesh position={[0.6, 0.05, 0.6]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.08]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      <mesh position={[-0.6, 0.05, 0.6]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.08]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      <mesh position={[0.6, 0.05, -0.6]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.08]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      <mesh position={[-0.6, 0.05, -0.6]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.08]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      {/* Propellers */}
      <mesh position={[0.6, 0.1, 0.6]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.01, 0.04]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      <mesh position={[0.6, 0.1, 0.6]} rotation={[0, Math.PI/2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.01, 0.04]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      <mesh position={[-0.6, 0.1, 0.6]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.01, 0.04]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      <mesh position={[-0.6, 0.1, 0.6]} rotation={[0, Math.PI/2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.01, 0.04]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      <mesh position={[0.6, 0.1, -0.6]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.01, 0.04]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      <mesh position={[0.6, 0.1, -0.6]} rotation={[0, Math.PI/2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.01, 0.04]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      <mesh position={[-0.6, 0.1, -0.6]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.01, 0.04]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      <mesh position={[-0.6, 0.1, -0.6]} rotation={[0, Math.PI/2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.01, 0.04]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      {/* Navigation lights - Right (Green) */}
      <pointLight position={[0.45, 0, 0]} intensity={0.2} color="#00ff00" />
      <mesh position={[0.45, 0, 0]} castShadow>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Navigation lights - Left (Red) */}
      <pointLight position={[-0.45, 0, 0]} intensity={0.2} color="#ff0000" />
      <mesh position={[-0.45, 0, 0]} castShadow>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Status light on top (white) */}
      <pointLight position={[0, 0.15, 0]} intensity={0.1} color="#ffffff" />
      <mesh position={[0, 0.15, 0]} castShadow>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

export default DroneModel; 