import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DeckGL from 'deck.gl';
import { OrbitView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PointCloudLayer } from '@deck.gl/layers';
import { loadPointCloud, getColorAccessor } from '../utils/DeckGLLoaders';
import { getOptimizedDeckSettings, getPointCloudLayerSettings, registerDeckInstance, unregisterDeckInstance } from '../utils/DeckGLManager';
import { isAppleSilicon, isM3Mac } from '../utils/PlatformDetection';
import styled from 'styled-components';

const LoaderContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  z-index: 1;
  
  h3 {
    margin-bottom: 10px;
  }
  
  .progress-bar {
    width: 200px;
    height: 5px;
    background-color: #444;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 10px;
  }
  
  .progress-fill {
    height: 100%;
    background-color: #00aaff;
    transition: width 0.3s ease;
  }
  
  .stats {
    font-size: 12px;
    margin-top: 10px;
    text-align: center;
  }
`;

const ErrorContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  z-index: 1;
  
  h3 {
    color: #ff4444;
    margin-bottom: 10px;
  }
  
  p {
    max-width: 80%;
    text-align: center;
    margin-bottom: 20px;
  }
  
  button {
    background-color: #4444ff;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    
    &:hover {
      background-color: #3333dd;
    }
  }
`;

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

/**
 * DeckGLPointCloudViewer component
 * Replacement for PotreePointCloud using deck.gl for better cross-platform compatibility
 * 
 * @param {object} props - Component props
 * @param {string} props.url - URL to the point cloud data
 * @param {number} props.pointSize - Size of points
 * @param {number} props.opacity - Opacity of points
 * @param {number} props.maxPoints - Maximum points to render
 * @param {array} props.position - Position of the point cloud [x, y, z]
 * @param {number} props.scale - Scale factor for the point cloud
 * @param {array} props.rotation - Rotation of the point cloud
 * @param {boolean} props.selectable - Whether the point cloud can be selected
 * @param {function} props.onSelect - Callback when the point cloud is selected
 * @param {function} props.onProgress - Callback for progress updates
 * @param {function} props.onLoad - Callback when the point cloud is loaded
 * @param {function} props.onError - Callback for error handling
 */
const DeckGLPointCloudViewer = ({
  url,
  pointSize = 2,
  opacity = 1.0,
  maxPoints = 5_000_000,
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
  selectable = true,
  onSelect,
  onProgress,
  onLoad,
  onError,
  ...props
}) => {
  const [pointCloudData, setPointCloudData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [colorMode, setColorMode] = useState('rgb');
  const [deckInstance, setDeckInstance] = useState(null);
  const containerRef = useRef(null);
  const instanceId = useRef(`deck-pc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  // Get settings based on platform
  const deckSettings = useMemo(() => getOptimizedDeckSettings(), []);
  const layerSettings = useMemo(() => getPointCloudLayerSettings(), []);
  
  // Adjust point size based on platform
  const adjustedPointSize = useMemo(() => {
    const baseSizeMultiplier = isAppleSilicon() ? (isM3Mac() ? 1.25 : 1.0) : 1.5;
    return pointSize * baseSizeMultiplier;
  }, [pointSize]);
  
  // Calculate initial view state based on data bounds
  const initialViewState = useMemo(() => {
    if (!metadata || !metadata.boundingBox) {
      return {
        target: [0, 0, 0],
        rotationX: 0,
        rotationOrbit: 0,
        zoom: 0,
        minZoom: -10,
        maxZoom: 10
      };
    }
    
    // Calculate appropriate zoom to fit the point cloud
    const { min, max, size } = metadata.boundingBox;
    const maxSize = Math.max(...size);
    const zoom = Math.log2(10 / maxSize);
    
    return {
      target: [0, 0, 0], // We've already centered the point cloud
      rotationX: 30,     // Slight downward angle
      rotationOrbit: 30, // Slight side angle
      zoom: zoom,
      minZoom: zoom - 5,
      maxZoom: zoom + 5
    };
  }, [metadata]);
  
  // Create deck.gl layers
  const layers = useMemo(() => {
    if (!pointCloudData) return [];
    
    // Get color accessor based on the selected mode
    const getColor = getColorAccessor(pointCloudData, colorMode);
    
    // Create the point cloud layer
    return [
      new PointCloudLayer({
        id: 'point-cloud-layer',
        data: pointCloudData,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        getPosition: d => d.position,
        getColor,
        pointSize: adjustedPointSize,
        opacity,
        sizeUnits: 'pixels',
        material: true,
        pickable: selectable,
        autoHighlight: selectable,
        highlightColor: [255, 255, 0, 150],
        ...layerSettings
      })
    ];
  }, [pointCloudData, colorMode, adjustedPointSize, opacity, selectable, layerSettings]);
  
  // Load point cloud data
  useEffect(() => {
    if (!url) return;
    
    setLoading(true);
    setError(null);
    setProgress(0);
    
    // Use our utility to load and normalize the point cloud
    loadPointCloud(url, {
      onProgress: (percent) => {
        setProgress(percent);
        if (onProgress) onProgress(percent);
      },
      normalize: true,
      optimizeForM3: isAppleSilicon(),
      maxPoints
    })
      .then(({ pointCloud, metadata }) => {
        setPointCloudData(pointCloud);
        setMetadata(metadata);
        setLoading(false);
        
        if (onLoad) onLoad(pointCloud);
      })
      .catch((err) => {
        console.error('Error loading point cloud:', err);
        setError(err.message || 'Failed to load point cloud');
        setLoading(false);
        
        if (onError) onError(err);
      });
  }, [url, maxPoints]);
  
  // Register deck instance for management
  useEffect(() => {
    if (deckInstance) {
      registerDeckInstance(instanceId.current, deckInstance);
      
      return () => {
        unregisterDeckInstance(instanceId.current);
      };
    }
  }, [deckInstance]);
  
  // Handle deck.gl initialization
  const onDeckInitialized = useCallback((deck) => {
    setDeckInstance(deck);
  }, []);
  
  // Handle retry on error
  const handleRetry = useCallback(() => {
    if (!url) return;
    
    setLoading(true);
    setError(null);
    setProgress(0);
    
    // Use our utility to load and normalize the point cloud
    loadPointCloud(url, {
      onProgress: (percent) => {
        setProgress(percent);
        if (onProgress) onProgress(percent);
      },
      normalize: true,
      optimizeForM3: isAppleSilicon(),
      // Use half max points on retry for better chance of success
      maxPoints: maxPoints / 2
    })
      .then(({ pointCloud, metadata }) => {
        setPointCloudData(pointCloud);
        setMetadata(metadata);
        setLoading(false);
        
        if (onLoad) onLoad(pointCloud);
      })
      .catch((err) => {
        console.error('Error loading point cloud on retry:', err);
        setError(err.message || 'Failed to load point cloud');
        setLoading(false);
        
        if (onError) onError(err);
      });
  }, [url, maxPoints, onProgress, onLoad, onError]);
  
  // Component to display during loading
  const Loader = () => (
    <LoaderContainer>
      <h3>Loading Point Cloud</h3>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }}></div>
      </div>
      <div>{Math.round(progress * 100)}%</div>
      {metadata && (
        <div className="stats">
          <div>Format: {metadata.format}</div>
          <div>Points: {metadata.vertexCount.toLocaleString()}</div>
        </div>
      )}
    </LoaderContainer>
  );
  
  // Component to display on error
  const ErrorDisplay = () => (
    <ErrorContainer>
      <h3>Error Loading Point Cloud</h3>
      <p>{error || 'Unknown error occurred while loading the point cloud'}</p>
      <button onClick={handleRetry}>Retry</button>
    </ErrorContainer>
  );
  
  // Controls for color mode
  const Controls = () => (
    <ControlsContainer>
      <StyledButton 
        className={colorMode === 'rgb' ? 'active' : ''} 
        onClick={() => setColorMode('rgb')}
      >
        RGB
      </StyledButton>
      <StyledButton 
        className={colorMode === 'height' ? 'active' : ''} 
        onClick={() => setColorMode('height')}
      >
        Height
      </StyledButton>
      {metadata && metadata.hasIntensity && (
        <StyledButton 
          className={colorMode === 'intensity' ? 'active' : ''} 
          onClick={() => setColorMode('intensity')}
        >
          Intensity
        </StyledButton>
      )}
      {metadata && metadata.hasClassification && (
        <StyledButton 
          className={colorMode === 'classification' ? 'active' : ''} 
          onClick={() => setColorMode('classification')}
        >
          Classification
        </StyledButton>
      )}
    </ControlsContainer>
  );
  
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
      
      {loading && <Loader />}
      {error && <ErrorDisplay />}
      {!loading && !error && <Controls />}
    </div>
  );
};

export default DeckGLPointCloudViewer; 