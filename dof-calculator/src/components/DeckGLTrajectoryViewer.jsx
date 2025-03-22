import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DeckGL from 'deck.gl';
import { OrbitView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { getOptimizedDeckSettings, registerDeckInstance, unregisterDeckInstance } from '../utils/DeckGLManager';
import { isAppleSilicon, isM3Mac } from '../utils/PlatformDetection';
import styled from 'styled-components';

const ControlsContainer = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const StyledButton = styled.button`
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }
  
  &.active {
    background-color: rgba(0, 100, 255, 0.6);
  }
`;

const AnimationControls = styled.div`
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 5px 10px;
  border-radius: 4px;
  z-index: 1;
`;

/**
 * DeckGLTrajectoryViewer component
 * Visualization of drone trajectories using deck.gl
 * 
 * @param {object} props - Component props
 * @param {array} props.trajectories - Array of trajectory data
 * @param {array} props.waypoints - Array of waypoint data
 * @param {boolean} props.animate - Whether to animate the trajectory
 * @param {array} props.position - Position of the trajectory [x, y, z]
 * @param {number} props.scale - Scale factor for the trajectory
 * @param {function} props.onSelect - Callback when a waypoint is selected
 */
const DeckGLTrajectoryViewer = ({
  trajectories = [],
  waypoints = [],
  animate = false,
  position = [0, 0, 0],
  scale = 1,
  onSelect,
  onHover,
  ...props
}) => {
  const [animationTime, setAnimationTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [deckInstance, setDeckInstance] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const containerRef = useRef(null);
  const instanceId = useRef(`deck-traj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const animationRef = useRef(null);
  
  // Get settings based on platform
  const deckSettings = useMemo(() => getOptimizedDeckSettings(), []);
  
  // Normalize and prepare data
  const { normalizedTrajectories, normalizedWaypoints, timeRange } = useMemo(() => {
    if (!trajectories.length) {
      return {
        normalizedTrajectories: [],
        normalizedWaypoints: [],
        timeRange: [0, 1]
      };
    }
    
    // Find data bounds for normalization
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let minTime = Infinity, maxTime = -Infinity;
    
    // Process trajectories
    trajectories.forEach(trajectory => {
      trajectory.path.forEach(point => {
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        minZ = Math.min(minZ, point.length > 2 ? point[2] : 0);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
        maxZ = Math.max(maxZ, point.length > 2 ? point[2] : 0);
      });
      
      // Track time range if available
      if (trajectory.timestamps) {
        minTime = Math.min(minTime, Math.min(...trajectory.timestamps));
        maxTime = Math.max(maxTime, Math.max(...trajectory.timestamps));
      }
    });
    
    // Process waypoints
    waypoints.forEach(wp => {
      minX = Math.min(minX, wp.position[0]);
      minY = Math.min(minY, wp.position[1]);
      minZ = Math.min(minZ, wp.position.length > 2 ? wp.position[2] : 0);
      maxX = Math.max(maxX, wp.position[0]);
      maxY = Math.max(maxY, wp.position[1]);
      maxZ = Math.max(maxZ, wp.position.length > 2 ? wp.position[2] : 0);
      
      // Track time if available
      if (wp.time !== undefined) {
        minTime = Math.min(minTime, wp.time);
        maxTime = Math.max(maxTime, wp.time);
      }
    });
    
    // Calculate center and scale
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxSize = Math.max(sizeX, sizeY, sizeZ);
    const normalScale = maxSize > 0 ? 10 / maxSize : 1;
    
    // Normalize trajectories
    const normalizedTrajectories = trajectories.map(trajectory => ({
      ...trajectory,
      path: trajectory.path.map(point => [
        ((point[0] - centerX) * normalScale) + position[0],
        ((point[1] - centerY) * normalScale) + position[1],
        ((point.length > 2 ? point[2] - centerZ : 0) * normalScale) + position[2]
      ])
    }));
    
    // Normalize waypoints
    const normalizedWaypoints = waypoints.map(wp => ({
      ...wp,
      position: [
        ((wp.position[0] - centerX) * normalScale) + position[0],
        ((wp.position[1] - centerY) * normalScale) + position[1],
        ((wp.position.length > 2 ? wp.position[2] - centerZ : 0) * normalScale) + position[2]
      ]
    }));
    
    return {
      normalizedTrajectories,
      normalizedWaypoints,
      timeRange: [minTime, maxTime]
    };
  }, [trajectories, waypoints, position]);
  
  // Calculate initial view state based on data
  const initialViewState = useMemo(() => {
    return {
      target: [0, 0, 0],
      rotationX: 0,
      rotationOrbit: 0,
      zoom: 0,
      minZoom: -10,
      maxZoom: 10
    };
  }, []);
  
  // Generate layers
  const layers = useMemo(() => {
    const result = [];
    
    // Path layers for trajectories
    if (normalizedTrajectories.length) {
      normalizedTrajectories.forEach((trajectory, i) => {
        const pathColor = trajectory.color || [0, 128, 255];
        
        result.push(
          new PathLayer({
            id: `trajectory-${i}`,
            data: [trajectory],
            pickable: true,
            widthScale: isAppleSilicon() ? 15 : 20,
            widthMinPixels: 2,
            widthMaxPixels: 10,
            getPath: d => d.path,
            getColor: d => d.color || [0, 128, 255],
            getWidth: d => d.width || 1,
            rounded: true,
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            onHover: (info) => {
              if (info.object) {
                setHoverInfo({
                  x: info.x,
                  y: info.y,
                  type: 'trajectory',
                  name: info.object.name || `Trajectory ${i+1}`,
                  color: pathColor
                });
                if (onHover) onHover(info);
              } else {
                setHoverInfo(null);
              }
            }
          })
        );
      });
    }
    
    // Waypoint markers
    if (normalizedWaypoints.length) {
      result.push(
        new ScatterplotLayer({
          id: 'waypoints',
          data: normalizedWaypoints,
          pickable: true,
          stroked: true,
          filled: true,
          radiusScale: 6,
          radiusMinPixels: 3,
          radiusMaxPixels: 15,
          lineWidthMinPixels: 1,
          getPosition: d => d.position,
          getRadius: d => d.radius || 1,
          getFillColor: d => d.color || [255, 140, 0],
          getLineColor: [0, 0, 0],
          onHover: (info) => {
            if (info.object) {
              setHoverInfo({
                x: info.x,
                y: info.y,
                type: 'waypoint',
                name: info.object.name || `Waypoint ${info.index + 1}`,
                color: info.object.color || [255, 140, 0]
              });
              if (onHover) onHover(info);
            } else if (!info.object) {
              setHoverInfo(null);
            }
          },
          onClick: (info) => {
            if (info.object && onSelect) {
              onSelect(info.object, info.index);
            }
          }
        })
      );
      
      // Add waypoint labels
      result.push(
        new TextLayer({
          id: 'waypoint-labels',
          data: normalizedWaypoints,
          pickable: true,
          getPosition: d => d.position,
          getText: d => d.name || `WP${d.id || ''}`,
          getSize: 12,
          getAngle: 0,
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          getPixelOffset: [0, -20],
          getColor: [255, 255, 255]
        })
      );
    }
    
    return result;
  }, [normalizedTrajectories, normalizedWaypoints, onSelect, onHover]);
  
  // Register deck instance for management
  useEffect(() => {
    if (deckInstance) {
      registerDeckInstance(instanceId.current, deckInstance);
      
      return () => {
        unregisterDeckInstance(instanceId.current);
      };
    }
  }, [deckInstance]);
  
  // Handle animation
  useEffect(() => {
    if (playing && animate) {
      let startTime = Date.now();
      const animationDuration = 10000; // 10 seconds for full animation
      
      const animate = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = (elapsed % animationDuration) / animationDuration;
        
        setAnimationTime(progress);
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [playing, animate]);
  
  // Handle deck.gl initialization
  const onDeckInitialized = useCallback((deck) => {
    setDeckInstance(deck);
  }, []);
  
  // Animation playback controls
  const togglePlayback = () => setPlaying(prev => !prev);
  const resetAnimation = () => setAnimationTime(0);
  
  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >
      <DeckGL
        id={instanceId.current}
        initialViewState={initialViewState}
        controller={true}
        views={[new OrbitView({ 
          orbitAxis: 'Y',
          fov: 50
        })]}
        layers={layers}
        onWebGLInitialized={onDeckInitialized}
        {...deckSettings}
      />
      
      {hoverInfo && (
        <div style={{
          position: 'absolute',
          zIndex: 1,
          pointerEvents: 'none',
          left: hoverInfo.x + 10,
          top: hoverInfo.y + 10,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '4px 8px',
          borderRadius: '4px',
          color: 'white',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ 
              width: '10px', 
              height: '10px', 
              backgroundColor: `rgb(${hoverInfo.color.join(',')})`,
              borderRadius: '50%'
            }}></div>
            <div>{hoverInfo.name}</div>
          </div>
        </div>
      )}
      
      {animate && (
        <AnimationControls>
          <StyledButton onClick={togglePlayback}>
            {playing ? 'Pause' : 'Play'}
          </StyledButton>
          <StyledButton onClick={resetAnimation}>
            Reset
          </StyledButton>
          <div style={{ 
            width: '100px', 
            height: '5px', 
            backgroundColor: '#444',
            borderRadius: '3px',
            overflow: 'hidden',
            margin: 'auto 0'
          }}>
            <div style={{ 
              height: '100%', 
              width: `${animationTime * 100}%`,
              backgroundColor: '#00aaff'
            }}></div>
          </div>
        </AnimationControls>
      )}
    </div>
  );
};

export default DeckGLTrajectoryViewer; 