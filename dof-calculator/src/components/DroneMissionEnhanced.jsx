import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line, Text } from '@react-three/drei';
import { extend, useFrame } from '@react-three/fiber';

// Import specific THREE classes we need to reference
const { Matrix3, Vector3, Box3, Quaternion, MathUtils } = THREE;

// Explicitly register THREE classes with React Three Fiber
// This approach is more reliable than general namespace extension
extend({
  Matrix3: THREE.Matrix3,
  Vector3: THREE.Vector3,
  Box3: THREE.Box3,
  Quaternion: THREE.Quaternion
});

// Add debugging to check THREE namespace at runtime
console.log("THREE namespace in DroneMissionEnhanced:", {
  hasMatrix3: !!THREE.Matrix3,
  matrix3IsFunction: typeof THREE.Matrix3 === 'function',
  threeObjectKeys: Object.keys(THREE).filter(key => key.startsWith('M'))
});

// Add new constants for mission planning algorithms
const MISSION_TYPES = {
  GRID: 'grid',
  PERIMETER: 'perimeter',
  ORBIT: 'orbit',
  TERRAIN_FOLLOWING: 'terrainFollowing'
};

// Component for selecting 3D objects and planning drone missions
const DroneMissionEnhanced = ({ 
  cameraDetails, 
  lensDetails, 
  dofCalculations,
  sceneObjects = [],
  onUpdateTrajectory,
  scene // Pass scene as a prop instead of using useThree
}) => {
  // Remove useThree hook, scene should be passed as prop
  // const { scene } = useThree();
  
  // State for UI components
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
  const [selectedFaces, setSelectedFaces] = useState([]);
  const [hoveredFace, setHoveredFace] = useState(null);
  
  // Add new state for Phase 2 functionality
  const [missionType, setMissionType] = useState(MISSION_TYPES.GRID);
  const [coverageMap, setCoverageMap] = useState(null);
  const [coverageOverlay, setCoverageOverlay] = useState(null);
  const [previewTrajectory, setPreviewTrajectory] = useState(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [optimalAltitude, setOptimalAltitude] = useState(null);
  
  // Enhanced mission planning parameters
  const [missionParams, setMissionParams] = useState({
    altitude: 20, // meters
    speed: 5, // m/s
    overlap: 70, // percent
    sideOverlap: 60, // percent
    gridAngle: 0, // degrees
    gsd: 0, // cm/pixel (calculated)
    captureRate: 2, // seconds
    safetyBuffer: 2, // meters from obstacles
    terrainFollowDistance: 5, // meters above terrain
    orbitRadius: 10, // meters for orbit missions
    orbitAltitude: 15, // meters for orbit height
    capturePoints: true, // enable/disable photo capture points
    followTerrain: false, // enable terrain following
    optimizeForDOF: true, // integrate DoF in planning
    coverageDisplay: true, // show coverage visualization
  });
  
  // Current workflow step
  const [workflowStep, setWorkflowStep] = useState(0);
  const workflowSteps = [
    "Select Surface",
    "Choose Mission Type",
    "Set Parameters",
    "Review & Generate"
  ];
  
  // References
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const coverageMapRef = useRef(null);
  
  // Calculate GSD based on camera parameters and altitude
  useEffect(() => {
    if (cameraDetails && lensDetails && missionParams.altitude) {
      // GSD calculation formula: (sensor width * altitude * 100) / (focal length * image width)
      // Result is in cm/pixel
      const gsd = (cameraDetails.sensorWidth * missionParams.altitude * 100) / 
                 (lensDetails.focalLength * cameraDetails.imageWidth);
      
      setMissionParams(prev => ({
        ...prev,
        gsd: gsd.toFixed(2)
      }));
      
      // Calculate optimal altitude based on DoF if enabled
      if (missionParams.optimizeForDOF && dofCalculations) {
        calculateOptimalAltitude();
      }
    }
  }, [cameraDetails, lensDetails, missionParams.altitude, dofCalculations, missionParams.optimizeForDOF]);
  
  // Calculate the optimal altitude based on depth of field
  const calculateOptimalAltitude = () => {
    if (!dofCalculations || !cameraDetails || !lensDetails) return;
    
    // Extract DoF calculations
    const { nearFocusPlane, farFocusPlane, hyperfocalDistance } = dofCalculations;
    
    // Calculate the desired GSD in meters/pixel
    const desiredGsdMeters = missionParams.gsd / 100; // convert from cm to meters
    
    // Calculate the optimal altitude based on desired GSD and camera specs
    const optimalHeight = (desiredGsdMeters * lensDetails.focalLength * cameraDetails.imageWidth) / 
                          cameraDetails.sensorWidth;
    
    // Adjust for depth of field - try to get the entire scene in focus
    let adjustedAltitude = optimalHeight;
    
    // If we have terrain variation, try to ensure everything is in focus
    if (selectedFaces.length > 0) {
      // Find the elevation range of selected faces
      const elevations = selectedFaces.map(face => face.point.z);
      const minElevation = Math.min(...elevations);
      const maxElevation = Math.max(...elevations);
      const terrainRange = maxElevation - minElevation;
      
      // Calculate focus distance for maximum DOF
      // When focusing at hyperfocal distance, everything from half that distance to infinity is in focus
      if (hyperfocalDistance) {
        // Set altitude so that the nearest part of the terrain is at least at half the hyperfocal distance
        adjustedAltitude = Math.max(optimalHeight, hyperfocalDistance / 2 + terrainRange);
      } else if (nearFocusPlane && farFocusPlane) {
        // Try to fit the terrain range within the DOF
        const currentDofRange = farFocusPlane - nearFocusPlane;
        if (currentDofRange < terrainRange) {
          // Need to increase altitude to get more DOF
          adjustedAltitude = optimalHeight * (terrainRange / currentDofRange) * 1.2; // Add 20% safety margin
        }
      }
    }
    
    // Update the optimal altitude
    setOptimalAltitude(adjustedAltitude.toFixed(1));
    
    // Suggest this altitude if it's significantly different
    if (Math.abs(adjustedAltitude - missionParams.altitude) > 5) {
      console.log(`Suggesting optimal altitude of ${adjustedAltitude.toFixed(1)}m for best DoF coverage`);
    }
  };
  
  // Generate preview trajectory whenever parameters change
  useEffect(() => {
    if (selectedFaces.length > 0 && isWorkflowOpen && workflowStep >= 2) {
      const trajectory = generateTrajectory(true); // Generate preview
      setPreviewTrajectory(trajectory);
      
      if (missionParams.coverageDisplay) {
        generateCoverageMap(trajectory);
      }
    }
  }, [missionParams, selectedFaces, missionType, workflowStep, isWorkflowOpen]);
  
  // Generate a coverage map visualization based on camera footprints
  const generateCoverageMap = (trajectory) => {
    if (!trajectory || !trajectory.capturePoints || !cameraDetails || !lensDetails) return;
    
    // Create a coverage map as a grid of points
    const { capturePoints } = trajectory;
    const coveragePoints = [];
    const gridSize = 0.5; // meters between sample points
    
    // Find the bounds of the selected area
    const selectedPoints = selectedFaces.map(face => face.point);
    const bbox = new THREE.Box3().setFromPoints(selectedPoints);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    // Create a ground plane grid for coverage testing
    const xCount = Math.ceil(size.x / gridSize) + 5; // Add padding
    const yCount = Math.ceil(size.y / gridSize) + 5;
    
    // Calculate camera parameters
    const altitude = missionParams.altitude;
    const halfFovRadiansH = Math.atan((cameraDetails.sensorWidth / 2) / lensDetails.focalLength);
    const halfFovRadiansV = Math.atan((cameraDetails.sensorHeight / 2) / lensDetails.focalLength);
    
    // Calculate footprint size at the given altitude
    const footprintWidthHalf = Math.tan(halfFovRadiansH) * altitude;
    const footprintHeightHalf = Math.tan(halfFovRadiansV) * altitude;
    
    // Sample grid points
    const gridPoints = [];
    const coverage = [];
    
    for (let x = 0; x < xCount; x++) {
      for (let y = 0; y < yCount; y++) {
        const xPos = (x - xCount/2) * gridSize + center.x;
        const yPos = (y - yCount/2) * gridSize + center.y;
        const zPos = center.z; // Assume flat ground for simplicity
        
        const point = new THREE.Vector3(xPos, yPos, zPos);
        gridPoints.push(point);
        coverage.push(0); // 0 = not covered yet
      }
    }
    
    // Check coverage for each capture point
    capturePoints.forEach(capture => {
      const camPosition = capture.position;
      const lookAt = capture.lookAt || new THREE.Vector3(camPosition.x, camPosition.y, 0); // Default look down
      
      // Calculate camera viewing direction
      const direction = new THREE.Vector3().subVectors(lookAt, camPosition).normalize();
      
      // Create camera right and up vectors
      const right = new THREE.Vector3(1, 0, 0);
      right.applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(direction.y, direction.x));
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      
      // Check which grid points are covered by this camera position
      gridPoints.forEach((point, index) => {
        // Vector from camera to point
        const toPoint = new THREE.Vector3().subVectors(point, camPosition);
        
        // Check if point is in front of camera
        const dotProduct = toPoint.dot(direction);
        if (dotProduct <= 0) return; // Behind camera
        
        // Project point onto camera plane
        const distanceToPlane = toPoint.dot(direction);
        const projectedPoint = new THREE.Vector3().addVectors(
          camPosition,
          new THREE.Vector3().copy(direction).multiplyScalar(distanceToPlane)
        );
        
        // Get offset from center of projection
        const offset = new THREE.Vector3().subVectors(projectedPoint, point);
        
        // Get right/up components
        const rightComponent = offset.dot(right);
        const upComponent = offset.dot(up);
        
        // Check if point is within footprint
        const inFootprintH = Math.abs(rightComponent) <= footprintWidthHalf;
        const inFootprintV = Math.abs(upComponent) <= footprintHeightHalf;
        
        if (inFootprintH && inFootprintV) {
          coverage[index] += 1; // Increase coverage count
        }
      });
    });
    
    // Create visualization objects
    setCoverageMap({
      points: gridPoints,
      coverage: coverage,
      maxCoverage: Math.max(...coverage)
    });
  };
  
  // Generate trajectory based on mission type and parameters
  const generateTrajectory = (isPreview = false) => {
    if (selectedFaces.length === 0) return null;
    
    let trajectory;
    
    switch (missionType) {
      case MISSION_TYPES.PERIMETER:
        trajectory = generatePerimeterTrajectory(isPreview);
        break;
      case MISSION_TYPES.ORBIT:
        trajectory = generateOrbitTrajectory(isPreview);
        break;
      case MISSION_TYPES.TERRAIN_FOLLOWING:
        trajectory = generateTerrainFollowingTrajectory(isPreview);
        break;
      case MISSION_TYPES.GRID:
      default:
        trajectory = generateGridTrajectory(isPreview);
        break;
    }
    
    // If this is a final generation (not preview), send to parent
    if (!isPreview && onUpdateTrajectory) {
      onUpdateTrajectory(trajectory);
    }
    
    return trajectory;
  };
  
  // Grid pattern trajectory generation (original algorithm, enhanced)
  const generateGridTrajectory = (isPreview = false) => {
    // Extract geometry information from selected faces
    const selectedPoints = selectedFaces.map(face => face.point);
    
    // Find the bounding box of selected points
    const bbox = new THREE.Box3().setFromPoints(selectedPoints);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    // Calculate flight parameters based on mission settings
    const altitude = missionParams.altitude;
    const overlap = missionParams.overlap / 100;
    const sideOverlap = missionParams.sideOverlap / 100;
    
    // Calculate camera footprint at the given altitude
    const cameraFootprintWidth = cameraDetails?.sensorWidth * altitude / lensDetails?.focalLength * 1000 || 10;
    const cameraFootprintHeight = cameraDetails?.sensorHeight * altitude / lensDetails?.focalLength * 1000 || 7.5;
    
    // Calculate distance between flight lines based on overlap
    const lineSpacing = cameraFootprintWidth * (1 - sideOverlap);
    const captureSpacing = cameraFootprintHeight * (1 - overlap);
    
    // Generate grid pattern
    const gridAngleRad = missionParams.gridAngle * Math.PI / 180;
    const rotationMatrix = new THREE.Matrix4().makeRotationZ(gridAngleRad);
    
    // Calculate number of lines needed
    const lines = Math.ceil(size.x / lineSpacing) + 1;
    
    // Generate waypoints
    const waypoints = [];
    let lineDirection = 1;
    
    for (let i = 0; i < lines; i++) {
      const lineOffset = (i * lineSpacing) - (size.x / 2);
      const lineStart = new THREE.Vector3(
        lineOffset,
        -size.y / 2,
        altitude
      );
      const lineEnd = new THREE.Vector3(
        lineOffset,
        size.y / 2,
        altitude
      );
      
      // Apply rotation to the line
      lineStart.applyMatrix4(rotationMatrix);
      lineEnd.applyMatrix4(rotationMatrix);
      
      // Add center offset
      lineStart.add(center);
      lineEnd.add(center);
      
      // Add waypoints along the line
      if (lineDirection === 1) {
        // Forward along the line
        const pointsOnLine = Math.ceil(size.y / captureSpacing) + 1;
        for (let j = 0; j < pointsOnLine; j++) {
          const t = j / (pointsOnLine - 1);
          const point = new THREE.Vector3().lerpVectors(lineStart, lineEnd, t);
          waypoints.push(point);
        }
      } else {
        // Backward along the line
        const pointsOnLine = Math.ceil(size.y / captureSpacing) + 1;
        for (let j = pointsOnLine - 1; j >= 0; j--) {
          const t = j / (pointsOnLine - 1);
          const point = new THREE.Vector3().lerpVectors(lineStart, lineEnd, t);
          waypoints.push(point);
        }
      }
      
      // Alternate direction for each line (lawnmower pattern)
      lineDirection *= -1;
    }
    
    // Generate the trajectory object
    const trajectory = {
      type: MISSION_TYPES.GRID,
      waypoints,
      params: { ...missionParams },
      capturePoints: waypoints.map(point => ({
        position: point.clone(),
        lookAt: new THREE.Vector3(point.x, point.y, 0) // Point camera down
      }))
    };
    
    return trajectory;
  };
  
  // Perimeter trajectory - follows the boundary of the selected area
  const generatePerimeterTrajectory = (isPreview = false) => {
    // Extract geometry information from selected faces
    const selectedPoints = selectedFaces.map(face => face.point);
    
    // Find the bounding box of selected points
    const bbox = new THREE.Box3().setFromPoints(selectedPoints);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    const altitude = missionParams.altitude;
    const safety = missionParams.safetyBuffer;
    
    // Generate perimeter waypoints
    const waypoints = [];
    
    // Add corner points with safety buffer
    waypoints.push(new THREE.Vector3(center.x - (size.x/2) + safety, center.y - (size.y/2) + safety, altitude));
    waypoints.push(new THREE.Vector3(center.x + (size.x/2) - safety, center.y - (size.y/2) + safety, altitude));
    waypoints.push(new THREE.Vector3(center.x + (size.x/2) - safety, center.y + (size.y/2) - safety, altitude));
    waypoints.push(new THREE.Vector3(center.x - (size.x/2) + safety, center.y + (size.y/2) - safety, altitude));
    
    // Close the loop
    waypoints.push(waypoints[0].clone());
    
    // Generate the trajectory object
    const trajectory = {
      type: MISSION_TYPES.PERIMETER,
      waypoints,
      params: { ...missionParams },
      capturePoints: waypoints.map(point => ({
        position: point.clone(),
        lookAt: center.clone().setZ(center.z), // Point camera toward center of area
      }))
    };
    
    return trajectory;
  };
  
  // Orbit trajectory - creates a circular path around the selected area
  const generateOrbitTrajectory = (isPreview = false) => {
    // Extract geometry information from selected faces
    const selectedPoints = selectedFaces.map(face => face.point);
    
    // Find the bounding box of selected points
    const bbox = new THREE.Box3().setFromPoints(selectedPoints);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    const radius = missionParams.orbitRadius;
    const altitude = missionParams.orbitAltitude;
    const segments = 16; // Number of points in the orbit
    
    // Generate orbit waypoints
    const waypoints = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      waypoints.push(new THREE.Vector3(x, y, altitude));
    }
    
    // Generate the trajectory object
    const trajectory = {
      type: MISSION_TYPES.ORBIT,
      waypoints,
      params: { ...missionParams },
      capturePoints: waypoints.map(point => ({
        position: point.clone(),
        lookAt: center.clone(), // Point camera toward center
      }))
    };
    
    return trajectory;
  };
  
  // Terrain following trajectory - adjusts altitude based on terrain
  const generateTerrainFollowingTrajectory = (isPreview = false) => {
    // First generate a grid trajectory
    const baseTrajectory = generateGridTrajectory(true);
    
    if (!baseTrajectory) return null;
    
    const { waypoints } = baseTrajectory;
    const followDistance = missionParams.terrainFollowDistance;
    
    // Validate scene before using it
    const isValidScene = scene && (scene instanceof THREE.Scene) && Array.isArray(scene.children);
    if (!isValidScene) {
      console.warn("Cannot generate terrain following trajectory - invalid scene object");
      return baseTrajectory; // Return normal grid pattern if scene is invalid
    }
    
    try {
      // Get terrain heights - would normally use actual terrain data
      // Here we'll simulate it by raytracing down from each waypoint
      const adjustedWaypoints = waypoints.map(point => {
        // Create a raycaster pointing downward from this waypoint
        const origin = point.clone();
        origin.z += 100; // Start high above to ensure we hit terrain
        
        const direction = new THREE.Vector3(0, 0, -1); // Downward
        const raycaster = new THREE.Raycaster(origin, direction);
        
        // Intersect with all scene objects (terrain)
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        if (intersects.length > 0) {
          // Found terrain below, adjust altitude
          const terrainHeight = intersects[0].point.z;
          return new THREE.Vector3(point.x, point.y, terrainHeight + followDistance);
        }
        
        // If no terrain found, use original altitude
        return point.clone();
      });
      
      // Generate the trajectory object with adjusted waypoints
      const trajectory = {
        type: MISSION_TYPES.TERRAIN_FOLLOWING,
        waypoints: adjustedWaypoints,
        params: { ...missionParams },
        capturePoints: adjustedWaypoints.map(point => ({
          position: point.clone(),
          lookAt: new THREE.Vector3(point.x, point.y, point.z - followDistance), // Look at terrain
        }))
      };
      
      return trajectory;
    } catch (error) {
      console.error("Error generating terrain following trajectory:", error);
      return baseTrajectory; // Return normal grid pattern on error
    }
  };
    
  // Add components for coverage visualization
  const CoverageVisualization = () => {
    if (!coverageMap || !missionParams.coverageDisplay) return null;
    
    const { points, coverage, maxCoverage } = coverageMap;
    
    // Create visualization points
    return (
      <group>
        {points.map((point, index) => {
          // Skip uncovered points
          if (coverage[index] === 0) return null;
          
          // Color based on coverage intensity
          const intensity = coverage[index] / maxCoverage;
          const color = new THREE.Color(
            0.2 + 0.8 * (1 - intensity), // Less red with more coverage
            0.2 + 0.8 * intensity,      // More green with more coverage
            0.5                         // Constant blue component
          );
          
          return (
            <mesh key={`cov-${index}`} position={point}>
              <sphereGeometry args={[0.2, 4, 4]} />
              <meshBasicMaterial color={color} transparent opacity={0.7} />
            </mesh>
          );
        })}
      </group>
    );
  };
  
  // Preview for the mission trajectory
  const TrajectoryPreview = () => {
    if (!previewTrajectory || !isPreviewVisible) return null;
    
    const { waypoints } = previewTrajectory;
    const points = waypoints.map(p => [p.x, p.y, p.z]);
    
    return (
      <group>
        <Line
          points={points}
          color="#ffff00"
          lineWidth={2}
          dashed={false}
        />
        {waypoints.map((point, index) => (
          <mesh key={`wp-${index}`} position={point}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color="#ffff00" />
          </mesh>
        ))}
      </group>
    );
  };
  
  // Render camera footprints for capture points
  const CameraFootprints = () => {
    if (!previewTrajectory || !previewTrajectory.capturePoints || !isPreviewVisible) return null;
    
    const { capturePoints } = previewTrajectory;
    const altitude = missionParams.altitude;
    
    // Calculate footprint dimensions based on camera and lens properties
    const halfFovRadiansH = Math.atan((cameraDetails?.sensorWidth / 2) / lensDetails?.focalLength);
    const halfFovRadiansV = Math.atan((cameraDetails?.sensorHeight / 2) / lensDetails?.focalLength);
    
    const footprintWidthHalf = Math.tan(halfFovRadiansH) * altitude;
    const footprintHeightHalf = Math.tan(halfFovRadiansV) * altitude;
    
    return (
      <group>
        {capturePoints.map((point, index) => {
          const position = point.position;
          const lookAt = point.lookAt || new THREE.Vector3(position.x, position.y, 0);
          
          // Calculate direction vectors
          const direction = new THREE.Vector3().subVectors(lookAt, position).normalize();
          const right = new THREE.Vector3(1, 0, 0);
          right.applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(direction.y, direction.x));
          const up = new THREE.Vector3().crossVectors(direction, right).normalize();
          
          // Calculate corners of footprint on the ground
          const groundZ = 0; // Assumed ground plane
          const rayLength = (position.z - groundZ) / direction.z;
          const rayCenter = new THREE.Vector3().copy(position).add(
            new THREE.Vector3().copy(direction).multiplyScalar(rayLength)
          );
          
          // Calculate the four corners
          const cornerPoints = [
            new THREE.Vector3().copy(rayCenter)
              .add(new THREE.Vector3().copy(right).multiplyScalar(footprintWidthHalf))
              .add(new THREE.Vector3().copy(up).multiplyScalar(footprintHeightHalf)),
            
            new THREE.Vector3().copy(rayCenter)
              .add(new THREE.Vector3().copy(right).multiplyScalar(-footprintWidthHalf))
              .add(new THREE.Vector3().copy(up).multiplyScalar(footprintHeightHalf)),
              
            new THREE.Vector3().copy(rayCenter)
              .add(new THREE.Vector3().copy(right).multiplyScalar(-footprintWidthHalf))
              .add(new THREE.Vector3().copy(up).multiplyScalar(-footprintHeightHalf)),
              
            new THREE.Vector3().copy(rayCenter)
              .add(new THREE.Vector3().copy(right).multiplyScalar(footprintWidthHalf))
              .add(new THREE.Vector3().copy(up).multiplyScalar(-footprintHeightHalf)),
          ];
          
          // Add the first point again to close the loop
          cornerPoints.push(cornerPoints[0].clone());
          
          // Convert to array format for Line component
          const linePoints = cornerPoints.map(p => [p.x, p.y, p.z]);
          
          return (
            <group key={`footprint-${index}`}>
              <Line
                points={linePoints}
                color="#00ffff"
                lineWidth={1}
                transparent
                opacity={0.3}
              />
              {/* Line from camera to center of footprint */}
              <Line
                points={[[position.x, position.y, position.z], [rayCenter.x, rayCenter.y, rayCenter.z]]}
                color="#ffffff"
                lineWidth={0.5}
                transparent
                opacity={0.2}
              />
            </group>
          );
        })}
      </group>
    );
  };
  
  // Handle face selection in the 3D scene
  const handleSceneClick = (event, camera) => {
    // Validate scene before attempting to use it
    if (!scene) {
      console.warn("Cannot handle click - scene is not available");
      return;
    }
    
    if (!(scene instanceof THREE.Scene)) {
      console.warn("Cannot handle click - invalid scene object type:", scene);
      return;
    }
    
    if (!Array.isArray(scene.children)) {
      console.warn("Cannot handle click - scene.children is not an array");
      return;
    }
    
    // Calculate mouse position in normalized device coordinates
    mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Validate camera
    if (!camera) {
      console.warn("Cannot handle click - camera is not available");
      return;
    }
    
    try {
      // Update the picking ray with the camera and mouse position
      raycaster.current.setFromCamera(mouse.current, camera);
      
      // Find intersected objects
      const intersects = raycaster.current.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        // Check if we hit a mesh with faces
        const intersectedObject = intersects[0].object;
        if (intersectedObject?.isMesh && intersectedObject.geometry) {
          // Get the face index
          const faceIndex = intersects[0].faceIndex;
          
          // Toggle selection of the face
          if (selectedFaces.some(f => 
            f.objectId === intersectedObject.id && f.faceIndex === faceIndex)) {
            // Deselect the face
            setSelectedFaces(selectedFaces.filter(f => 
              !(f.objectId === intersectedObject.id && f.faceIndex === faceIndex)
            ));
          } else {
            // Select the face
            setSelectedFaces([...selectedFaces, {
              objectId: intersectedObject.id,
              faceIndex,
              object: intersectedObject,
              point: intersects[0].point.clone(),
              normal: intersects[0].face?.normal?.clone() || new THREE.Vector3(0, 1, 0)
            }]);
          }
        }
      }
    } catch (error) {
      console.error("Error in handleSceneClick:", error);
    }
  };
  
  // Handle mouse move for highlighting faces
  const handleMouseMove = (event, camera) => {
    // Validate scene before attempting to use it
    if (!scene) {
      console.warn("Cannot handle mouse move - scene is not available");
      return;
    }
    
    if (!(scene instanceof THREE.Scene)) {
      console.warn("Cannot handle mouse move - invalid scene object type:", scene);
      return;
    }
    
    if (!Array.isArray(scene.children)) {
      console.warn("Cannot handle mouse move - scene.children is not an array");
      return;
    }
    
    // Calculate mouse position
    mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Validate camera
    if (!camera) {
      console.warn("Cannot handle mouse move - camera is not available");
      return;
    }
    
    try {
      // Update the picking ray
      raycaster.current.setFromCamera(mouse.current, camera);
      
      // Find intersected objects
      const intersects = raycaster.current.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        if (intersectedObject?.isMesh && intersectedObject.geometry) {
          const faceIndex = intersects[0].faceIndex;
          setHoveredFace({
            objectId: intersectedObject.id,
            faceIndex,
            point: intersects[0].point.clone()
          });
        }
      } else {
        setHoveredFace(null);
      }
    } catch (error) {
      console.error("Error in handleMouseMove:", error);
    }
  };
  
  // Handle changes to mission parameters
  const handleParamChange = (param, value) => {
    setMissionParams(prev => ({
      ...prev,
      [param]: value
    }));
  };
  
  // Handle mission type change
  const handleMissionTypeChange = (type) => {
    setMissionType(type);
  };
  
  // Step through the workflow
  const nextWorkflowStep = () => {
    if (workflowStep === workflowSteps.length - 1) {
      // Generate the mission in the final step
      generateTrajectory();
      setIsWorkflowOpen(false);
      setWorkflowStep(0);
    } else {
      setWorkflowStep(workflowStep + 1);
    }
  };
  
  const prevWorkflowStep = () => {
    if (workflowStep === 0) {
      setIsWorkflowOpen(false);
    } else {
      setWorkflowStep(workflowStep - 1);
    }
  };
  
  // Start the mission planning workflow
  const startMissionPlanning = () => {
    setSelectedFaces([]);
    setWorkflowStep(0);
    setIsWorkflowOpen(true);
  };
  
  // The mission planning workflow popup
  const renderWorkflowPopup = () => {
    if (!isWorkflowOpen) return null;
    
    return (
      <div className="popup-container">
        <h2>Drone Mission Planning</h2>
        <p>Step {workflowStep + 1} of {workflowSteps.length}: {workflowSteps[workflowStep]}</p>
        
        {workflowStep === 0 && (
          <div>
            <div className="info-box">
              Click on surfaces in the 3D model to select areas for the drone to cover.
              You can select multiple faces to create a complex mission area.
            </div>
            <div>
              Selected faces: {selectedFaces.length}
            </div>
          </div>
        )}
        
        {workflowStep === 1 && (
          <div>
            <div className="form-group">
              <label className="label">Flight Altitude (m)</label>
              <input 
                type="number" 
                value={missionParams.altitude}
                onChange={(e) => handleParamChange('altitude', parseFloat(e.target.value))}
                min="1"
                max="500"
              />
            </div>
            
            <div className="form-group">
              <label className="label">Flight Speed (m/s)</label>
              <input 
                type="number" 
                value={missionParams.speed}
                onChange={(e) => handleParamChange('speed', parseFloat(e.target.value))}
                min="0.5"
                max="20"
                step="0.5"
              />
            </div>
            
            <div className="form-group">
              <label className="label">Forward Overlap (%)</label>
              <input 
                type="number" 
                value={missionParams.overlap}
                onChange={(e) => handleParamChange('overlap', parseFloat(e.target.value))}
                min="50"
                max="95"
              />
            </div>
            
            <div className="form-group">
              <label className="label">Side Overlap (%)</label>
              <input 
                type="number" 
                value={missionParams.sideOverlap}
                onChange={(e) => handleParamChange('sideOverlap', parseFloat(e.target.value))}
                min="40"
                max="90"
              />
            </div>
            
            <div className="form-group">
              <label className="label">Grid Angle (degrees)</label>
              <input 
                type="number" 
                value={missionParams.gridAngle}
                onChange={(e) => handleParamChange('gridAngle', parseFloat(e.target.value))}
                min="0"
                max="359"
              />
            </div>
            
            <div className="info-box">
              Calculated GSD: {missionParams.gsd} cm/pixel
              {cameraDetails && lensDetails ? (
                <div>
                  Using {cameraDetails.brand} {cameraDetails.model} with {lensDetails.focalLength}mm lens
                </div>
              ) : 'No camera selected'}
            </div>
          </div>
        )}
        
        {workflowStep === 2 && (
          <div>
            <h3 className="section-title">Mission Summary</h3>
            <div>
              <p>Selected area: {selectedFaces.length} surfaces</p>
              <p>Flight altitude: {missionParams.altitude} m</p>
              <p>Forward overlap: {missionParams.overlap}%</p>
              <p>Side overlap: {missionParams.sideOverlap}%</p>
              <p>Expected GSD: {missionParams.gsd} cm/pixel</p>
              <p>Camera: {cameraDetails ? `${cameraDetails.brand} ${cameraDetails.model}` : 'None selected'}</p>
              <p>Lens: {lensDetails ? `${lensDetails.focalLength}mm f/${lensDetails.maxAperture}` : 'None selected'}</p>
            </div>
            
            <div className="info-box">
              This will generate a flight plan with waypoints optimized for photogrammetry
              coverage of the selected area.
            </div>
          </div>
        )}
        
        <div className="button-group">
          <button onClick={prevWorkflowStep}>
            {workflowStep === 0 ? 'Cancel' : 'Back'}
          </button>
          <button onClick={nextWorkflowStep}>
            {workflowStep === workflowSteps.length - 1 ? 'Generate Mission' : 'Next'}
          </button>
        </div>
      </div>
    );
  };
  
  // Render the object selection highlight in the scene
  const renderSelectionHighlight = ({ scene }) => {
    // Implementation will depend on the Three.js scene structure
    // This would typically involve shader materials or outline effects
    return null;
  };
  
  return (
    <>
      {/* Mission planner sidebar */}
      <div className={`mission-planner-container ${isPlannerOpen ? '' : 'closed'}`}>
        <h3>Drone Mission Planner</h3>
        <button onClick={startMissionPlanning}>
          Create New Mission
        </button>
        
        {/* Mission statistics would go here */}
      </div>
      
      {/* Workflow popup */}
      {renderWorkflowPopup()}
      
      {/* Button to toggle the mission planner sidebar */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 100 }}>
        <button onClick={() => setIsPlannerOpen(!isPlannerOpen)}>
          {isPlannerOpen ? 'Hide Mission Planner' : 'Show Mission Planner'}
        </button>
      </div>
    </>
  );
};

export default DroneMissionEnhanced;
