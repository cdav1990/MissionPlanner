import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import EnhancedPointCloud from './EnhancedPointCloud';
import * as THREE from 'three';

/**
 * MultiPointCloudManager component for managing multiple point clouds
 * Allows loading, unloading, and controlling multiple point cloud datasets
 */
const MultiPointCloudManager = ({
  pointClouds = [],
  onPointCloudLoad,
  onPointCloudError,
  performanceSettings = {
    pointSize: 0.01,
    maxPointsPerModel: 2000000
  }
}) => {
  const { camera } = useThree();
  const [loadingStates, setLoadingStates] = useState({});
  const pointCloudRefs = useRef({});

  // Handle progress updates for a specific point cloud
  const handleProgress = useCallback((id, progress) => {
    setLoadingStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        progress: progress,
        loading: progress < 1
      }
    }));
  }, []);

  // Handle successful load of a point cloud
  const handleLoad = useCallback((id, pointCloud) => {
    setLoadingStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        loading: false,
        error: null,
        loaded: true
      }
    }));

    if (onPointCloudLoad) {
      onPointCloudLoad(id, pointCloud);
    }
  }, [onPointCloudLoad]);

  // Handle error loading a point cloud
  const handleError = useCallback((id, error) => {
    console.error(`Error loading point cloud ${id}:`, error);
    
    setLoadingStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        loading: false,
        error: error.message || 'Error loading point cloud',
        loaded: false
      }
    }));

    if (onPointCloudError) {
      onPointCloudError(id, error);
    }
  }, [onPointCloudError]);

  // Initialize loading states when point clouds change
  useEffect(() => {
    const newLoadingStates = {};
    
    pointClouds.forEach(pc => {
      if (!loadingStates[pc.id]) {
        newLoadingStates[pc.id] = {
          loading: true,
          progress: 0,
          error: null,
          loaded: false
        };
      }
    });
    
    if (Object.keys(newLoadingStates).length > 0) {
      setLoadingStates(prev => ({
        ...prev,
        ...newLoadingStates
      }));
    }
  }, [pointClouds, loadingStates]);

  return (
    <group>
      {pointClouds.map(pc => (
        <group key={pc.id}>
          {pc.visible && (
            <EnhancedPointCloud
              url={pc.url}
              pointSize={pc.pointSize || performanceSettings.pointSize}
              opacity={pc.opacity || 1.0}
              position={pc.position || [0, 0, 0]}
              rotation={pc.rotation || [0, 0, 0]}
              scale={pc.scale || 1}
              autoScale={pc.autoScale !== undefined ? pc.autoScale : true}
              colorByHeight={pc.colorByHeight || false}
              visible={pc.visible}
              onProgress={(progress) => handleProgress(pc.id, progress)}
              onLoad={(pointCloud) => handleLoad(pc.id, pointCloud)}
              onError={(error) => handleError(pc.id, error)}
              ref={(ref) => {
                if (ref) {
                  pointCloudRefs.current[pc.id] = ref;
                } else {
                  delete pointCloudRefs.current[pc.id];
                }
              }}
            />
          )}
          
          {/* Loading indicator */}
          {loadingStates[pc.id]?.loading && (
            <Html position={[0, 2, 0]} center>
              <div style={{
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                textAlign: 'center',
                width: '200px'
              }}>
                <div>Loading {pc.name || 'point cloud'}</div>
                <div style={{
                  width: '100%', 
                  height: '8px', 
                  background: '#333', 
                  marginTop: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.round((loadingStates[pc.id]?.progress || 0) * 100)}%`,
                    height: '100%',
                    background: '#00aaff',
                    transition: 'width 0.3s ease-in-out'
                  }}></div>
                </div>
                <div style={{ marginTop: '5px', fontSize: '0.8em' }}>
                  {Math.round((loadingStates[pc.id]?.progress || 0) * 100)}%
                </div>
              </div>
            </Html>
          )}
          
          {/* Error indicator */}
          {loadingStates[pc.id]?.error && (
            <Html position={[0, 2, 0]} center>
              <div style={{
                background: 'rgba(255,0,0,0.8)',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                textAlign: 'center',
                width: '200px'
              }}>
                <div>Error loading point cloud:</div>
                <div style={{ marginTop: '5px', fontSize: '0.9em' }}>
                  {loadingStates[pc.id].error}
                </div>
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
};

export default MultiPointCloudManager; 