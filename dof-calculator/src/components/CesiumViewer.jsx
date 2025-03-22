import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import './cesium-viewer.css';

// Styled container for the Cesium viewer
const CesiumContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`;

// Loading indicator
const LoadingIndicator = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  z-index: 1000;
`;

/**
 * CesiumViewer component that initializes and manages a Cesium globe
 */
const CesiumViewer = ({ 
  style,
  initialView = {
    latitude: 37.7749, // San Francisco by default
    longitude: -122.4194,
    height: 10000, // meters
  } 
}) => {
  // Create refs to store component state
  const cesiumViewerRef = useRef(null);
  const cesiumContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset WebGL to avoid conflicts between Three.js and Cesium
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
    }

    // Dynamically import Cesium modules
    const loadCesium = async () => {
      try {
        setLoading(true);
        
        // Import Cesium but avoid bundling - use window global
        window.CESIUM_BASE_URL = '';
        
        // Disable Cesium's use of WebGL renderer to avoid conflicts with Three.js
        window.CESIUM_USE_NATIVE_WEBGL_RENDERER = true;
        
        // Import the full Cesium module
        const Cesium = await import('cesium');
        
        // Import Cesium CSS
        await import('cesium/Build/Cesium/Widgets/widgets.css');
        
        // If the component unmounted during async loading, return
        if (!cesiumContainerRef.current) return;
        
        // Check if viewer already exists to prevent duplicate initialization
        if (cesiumViewerRef.current) return;
        
        // Set the Ion access token for accessing base maps and terrain
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1MDAyNzIzOS04OTgxLTQwZmQtYmRiMi03YmFmMjliYTZhMjAiLCJpZCI6MjI0Njk2LCJpYXQiOjE3NDI1OTAyMTh9.bE8X5bTC-Yt_rJaneBKmxvZn0fbF3eUXuMsXqGoi_mo';
        
        // Disable development error handling in Cesium to prevent JSON parse errors
        Cesium.RequestScheduler.requestsByServer = {};
        if (Cesium.TileProviderError && typeof Cesium.TileProviderError.handleError === 'function') {
          Cesium.TileProviderError.handleError = function() { return false; };
        }
        
        // Create the Cesium viewer with minimal configuration
        const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
          // Avoid using any terrain initially
          terrainProvider: undefined,
          
          // Use a simple Cesium's TileMapServiceImageryProvider instead of external services
          imageryProvider: new Cesium.TileMapServiceImageryProvider({
            url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
          }),
          
          // Disable ALL UI components
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          creditContainer: document.createElement('div'), // Hide credits in an offscreen div
          timeline: false,
          fullscreenButton: false,
          
          // Disable scene rendering until we're ready
          useBrowserRecommendedResolution: true,
          
          // Very important: don't create UI components that fetch external resources
          selectionIndicator: false,
          infoBox: false,
          
          // Disable shadows and lighting to reduce complexity
          shadows: false,
          scene3DOnly: true,
          
          // Lower quality settings to ensure it works
          resolutionScale: 0.5
        });
        
        // Store the viewer instance for later cleanup
        cesiumViewerRef.current = viewer;
        
        // Modify terrain provider errors to be non-fatal
        if (viewer.terrainProviderChanged) {
          viewer.terrainProviderChanged.addEventListener(() => {
            if (viewer.terrainProvider) {
              viewer.terrainProvider.errorEvent.addEventListener(() => {
                console.warn('Terrain provider error - continuing');
                return false; // Don't propagate
              });
            }
          });
        }
        
        // Disable resource fetching timeouts
        Cesium.RequestScheduler.requestsByServer = {};
        
        // Modify imagery provider errors to be non-fatal
        if (viewer.imageryLayers && viewer.imageryLayers.layerAdded) {
          viewer.imageryLayers.layerAdded.addEventListener((layer) => {
            if (layer && layer.imageryProvider) {
              layer.imageryProvider.errorEvent.addEventListener(() => {
                console.warn('Imagery provider error - continuing');
                return false; // Don't propagate
              });
            }
          });
        }
        
        // Set initial camera position with error handling
        try {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              initialView.longitude,
              initialView.latitude,
              initialView.height
            ),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-45),
              roll: 0.0,
            },
            duration: 0, // Immediate positioning to avoid animation errors
            complete: function() {
              console.log('Camera positioning complete');
            }
          });
        } catch (e) {
          console.warn('Camera positioning error:', e);
          // Try direct setting instead
          try {
            viewer.camera.setView({
              destination: Cesium.Cartesian3.fromDegrees(
                initialView.longitude,
                initialView.latitude,
                initialView.height
              )
            });
          } catch (e2) {
            console.warn('Fallback camera positioning failed:', e2);
          }
        }
        
        // Loading complete
        setLoading(false);
        console.log('Cesium initialized successfully');
      } catch (error) {
        console.error('Error initializing Cesium:', error);
        setError('Failed to initialize Cesium: ' + error.message);
        setLoading(false);
      }
    };
    
    loadCesium();
    
    // Clean up when component unmounts
    return () => {
      if (cesiumViewerRef.current) {
        try {
          cesiumViewerRef.current.destroy();
        } catch (error) {
          console.error('Error destroying Cesium viewer:', error);
        }
        cesiumViewerRef.current = null;
      }
    };
  }, [initialView]);

  return (
    <CesiumContainer style={style} ref={cesiumContainerRef} className="cesiumContainer">
      {loading && <LoadingIndicator>Loading Cesium globe...</LoadingIndicator>}
      {error && <LoadingIndicator style={{ backgroundColor: 'rgba(200, 0, 0, 0.7)' }}>{error}</LoadingIndicator>}
    </CesiumContainer>
  );
};

export default CesiumViewer; 