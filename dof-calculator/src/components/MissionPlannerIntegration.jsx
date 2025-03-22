import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { Html, Sphere, Line } from '@react-three/drei';
import { sanitizeGeometry } from '../utils/geometryUtils';

// Component to visualize the drone's trajectory and provide playback controls
const MissionPlannerIntegration = ({ 
  trajectory,
  isVisible = false,
  cameraDetails,
  lensDetails
}) => {
  // State for visualization and playback
  const [playbackState, setPlaybackState] = useState('stopped'); // 'playing', 'paused', 'stopped'
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [cameraPosition, setCameraPosition] = useState(null);
  const [showFootprints, setShowFootprints] = useState(true);
  
  // References
  const droneRef = useRef();
  const timeRef = useRef(0);
  const pausedTimeRef = useRef(0);
  const { scene, camera } = useThree();
  
  // Calculate the total mission time and waypoint timings
  useEffect(() => {
    if (!trajectory || !trajectory.waypoints || trajectory.waypoints.length === 0) return;
    
    const { waypoints, params } = trajectory;
    const { speed } = params;
    
    // Calculate distances between waypoints
    let totalDistance = 0;
    let waypointDistances = [];
    
    for (let i = 1; i < waypoints.length; i++) {
      const prevPoint = waypoints[i-1];
      const currPoint = waypoints[i];
      const distance = prevPoint.distanceTo(currPoint);
      waypointDistances.push(distance);
      totalDistance += distance;
    }
    
    // Calculate estimated total time
    const estimatedTime = totalDistance / speed;
    setTotalTime(estimatedTime);
    
    // Reset playback state when trajectory changes
    setPlaybackState('stopped');
    setCurrentWaypointIndex(0);
    setProgressPercentage(0);
    timeRef.current = 0;
    pausedTimeRef.current = 0;
  }, [trajectory]);
  
  // Handle playback state changes
  useEffect(() => {
    if (playbackState === 'stopped') {
      timeRef.current = 0;
      pausedTimeRef.current = 0;
      setCurrentWaypointIndex(0);
      setProgressPercentage(0);
      setElapsedTime(0);
      
      // Reset drone position to the starting point
      if (trajectory && trajectory.waypoints && trajectory.waypoints.length > 0) {
        setCameraPosition(trajectory.waypoints[0]);
      }
    }
  }, [playbackState, trajectory]);
  
  // Animation loop for the playback
  useFrame((state, delta) => {
    if (!trajectory || !trajectory.waypoints || trajectory.waypoints.length < 2 || playbackState !== 'playing') return;
    
    // Update elapsed time
    timeRef.current += delta;
    const newElapsedTime = timeRef.current - pausedTimeRef.current;
    setElapsedTime(newElapsedTime);
    
    // Calculate progress along the trajectory
    const totalMissionTime = totalTime || 1; // Prevent division by zero
    const progress = Math.min(newElapsedTime / totalMissionTime, 1);
    setProgressPercentage(progress);
    
    // Calculate the current waypoint and position based on progress
    const totalPoints = trajectory.waypoints.length - 1;
    const pointIndex = Math.min(Math.floor(progress * totalPoints), totalPoints - 1);
    
    if (pointIndex !== currentWaypointIndex) {
      setCurrentWaypointIndex(pointIndex);
    }
    
    // Interpolate between waypoints for smooth motion
    const startPoint = trajectory.waypoints[pointIndex];
    const endPoint = trajectory.waypoints[Math.min(pointIndex + 1, totalPoints)];
    
    const pointProgress = (progress * totalPoints) - pointIndex;
    const interpolatedPosition = new THREE.Vector3().lerpVectors(
      startPoint,
      endPoint,
      Math.min(pointProgress, 1)
    );
    
    // Update drone position
    setCameraPosition(interpolatedPosition);
    
    // Check if we reached the end of the trajectory
    if (progress >= 1) {
      setPlaybackState('stopped');
    }
  });
  
  // Toggle playback state
  const togglePlayback = () => {
    if (playbackState === 'playing') {
      pausedTimeRef.current += performance.now() / 1000 - (timeRef.current - pausedTimeRef.current);
      setPlaybackState('paused');
    } else {
      if (playbackState === 'stopped') {
        timeRef.current = performance.now() / 1000;
        pausedTimeRef.current = 0;
      }
      setPlaybackState('playing');
    }
  };
  
  // Reset playback
  const resetPlayback = () => {
    setPlaybackState('stopped');
  };
  
  // Format time for display (mm:ss)
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate the camera footprint at the current position
  const calculateCameraFootprint = (position) => {
    if (!cameraDetails || !lensDetails || !position) return null;
    
    const { sensorWidth, sensorHeight } = cameraDetails;
    const { focalLength } = lensDetails;
    
    // Calculate the ground footprint (in meters)
    const altitude = position.z;
    const footprintWidth = (sensorWidth * altitude) / (focalLength / 1000);
    const footprintHeight = (sensorHeight * altitude) / (focalLength / 1000);
    
    // Create the corners of the footprint
    const halfWidth = footprintWidth / 2;
    const halfHeight = footprintHeight / 2;
    
    return [
      new THREE.Vector3(position.x - halfWidth, position.y - halfHeight, 0),
      new THREE.Vector3(position.x + halfWidth, position.y - halfHeight, 0),
      new THREE.Vector3(position.x + halfWidth, position.y + halfHeight, 0),
      new THREE.Vector3(position.x - halfWidth, position.y + halfHeight, 0),
      new THREE.Vector3(position.x - halfWidth, position.y - halfHeight, 0) // Close the loop
    ];
  };
  
  // Generate line points for the trajectory
  const trajectoryLinePoints = useMemo(() => {
    if (!trajectory || !trajectory.waypoints) return [];
    return trajectory.waypoints;
  }, [trajectory]);
  
  // Calculate camera footprint at current position
  const currentFootprint = useMemo(() => {
    return cameraPosition ? calculateCameraFootprint(cameraPosition) : null;
  }, [cameraPosition, cameraDetails, lensDetails]);
  
  // Don't render anything if the component is not visible
  if (!isVisible || !trajectory || !trajectory.waypoints) return null;
  
  return (
    <>
      {/* Trajectory line */}
      <Line
        points={trajectoryLinePoints}
        color="#4f88e3"
        lineWidth={2}
      />
      
      {/* Waypoint markers */}
      {trajectory.waypoints.map((point, index) => (
        <Sphere 
          key={`waypoint-${index}`} 
          position={point} 
          args={[0.2]} // radius
        >
          <meshBasicMaterial 
            color={index === currentWaypointIndex ? "#ff5722" : "#4f88e3"} 
            opacity={0.7} 
            transparent 
          />
        </Sphere>
      ))}
      
      {/* Current drone position */}
      {cameraPosition && (
        <group ref={droneRef} position={cameraPosition}>
          {/* Drone model (simplified) */}
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.2]} onUpdate={(geom) => sanitizeGeometry(geom)} />
            <meshBasicMaterial color="#ff5722" />
          </mesh>
          
          {/* Camera direction indicator */}
          <Line
            points={[
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0, 0, -2)
            ]}
            color="#ffcc00"
            lineWidth={2}
          />
        </group>
      )}
      
      {/* Camera footprint visualization */}
      {showFootprints && currentFootprint && (
        <Line
          points={currentFootprint}
          color="#ffcc00"
          lineWidth={1}
        />
      )}
      
      {/* Playback controls (HTML overlay) */}
      <Html position={[0, 0, 0]} center fullscreen>
        <div className="playback-controls">
          <button
            className={playbackState === 'playing' ? 'active' : ''}
            onClick={togglePlayback}
          >
            {playbackState === 'playing' ? 'Pause' : 'Play'}
          </button>
          
          <button
            className={playbackState === 'stopped' ? 'disabled' : ''}
            onClick={resetPlayback}
            disabled={playbackState === 'stopped'}
          >
            Reset
          </button>
          
          <div className="progress-bar">
            <div style={{ width: `${progressPercentage * 100}%` }}></div>
          </div>
          
          <span className="mission-stats">
            {formatTime(elapsedTime)} / {formatTime(totalTime)}
          </span>
          
          <button
            className={showFootprints ? 'active' : ''}
            onClick={() => setShowFootprints(!showFootprints)}
          >
            Footprints
          </button>
        </div>
      </Html>
    </>
  );
};

export default MissionPlannerIntegration;
