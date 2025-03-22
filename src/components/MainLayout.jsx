import React, { useState, useRef, useEffect, Suspense, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid as DreiGrid, Environment, useBounds, Stats, AdaptiveDpr, AdaptiveEvents, Loader, useHelper, GizmoHelper, GizmoViewport, Plane, Line, Html, Text } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom, DepthOfField, Outline } from '@react-three/postprocessing';
import { Perf } from 'r3f-perf';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import DOFCalculator from './DOFCalculator'; // Import the original DOFCalculator component
import DroneMissionEnhanced from './DroneMissionEnhanced'; // Import drone mission planner
import MissionPlannerIntegration from './MissionPlannerIntegration'; // Import mission visualization
import MissionPlanner from './MissionPlanner'; // Import the extracted MissionPlanner component
import ModelLoader from './ModelLoader'; // Import ModelLoader component
import ModelLoaderUtils from './ModelLoaderUtils'; // Import ModelLoaderUtils separately
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { FiChevronLeft, FiChevronRight, FiMenu } from 'react-icons/fi';
import { IoWarningOutline, IoCheckmarkCircleOutline, IoInformationCircleOutline, IoAirplane } from 'react-icons/io5';
import { 
  assessDeviceWebGLCapability,
  emergencyContextRecovery
} from '../utils/ThreeContextRecovery'; // Import the capability assessment and emergency recovery
import WebGLContextManager from '../utils/WebGLContextManager'; // Import the new WebGL context manager
import * as PotreeUtils from '../utils/PotreeUtils'; // Import fixed PotreeUtils
import { isAppleSilicon, isM3Mac, isWindows } from '../utils/PlatformDetection'; // Import platform detection
// Import our shared error boundary components
import { ModelErrorBoundary, CanvasErrorBoundary, ErrorBoundary } from './ErrorBoundaries.jsx';

const StyledVars = styled.div`
  /* Add your styles here */
`;

const TabBar = styled.div`
  /* Add your styles here */
`;

const TabButton = styled.button`
  /* Add your styles here */
`;

const ContentContainer = styled.div`
  /* Add your styles here */
`;

const DOFWrapperContainer = styled.div`
  /* Add your styles here */
`;

const MainLayout = () => {
  const [activeTab, setActiveTab] = useState('mission');
  const [contextLostCount, setContextLostCount] = useState(0);
  const canvasRef = useRef(null);
  
  // Always declare these, regardless of platform
  const isAppleSiliconDevice = useMemo(() => isAppleSilicon(), []);
  const isM3MacDevice = useMemo(() => isM3Mac(), []);
  const isWindowsDevice = useMemo(() => isWindows(), []);
  
  // Modify force recovery to just reload the page
  const forceRecovery = useCallback(() => {
    window.location.reload();
  }, []);

  // Modify handle context loss to just reload the page instead of showing UI
  const handleContextLoss = useCallback((event) => {
    console.warn('WebGL context lost - reloading page');
    // No need to set isWebGLContextLost, just reload
    window.location.reload();
  }, []);
  
  // Handle WebGL context restoration - ensure this is always defined
  const handleContextRestored = useCallback((event) => {
    console.log('WebGL context restored');
  }, [canvasRef]);

  // Register the canvas with our context manager when it's available
  useEffect(() => {
    // Safety check to prevent hooks rule violations
    if (!canvasRef.current) {
      console.log('Canvas ref not available yet');
      return undefined; // Must return same type in all code paths
    }
    
    console.log('Registering canvas with WebGLContextManager');
    let unregister;
    
    try {
      // Register with the WebGL context manager, but disable auto-recovery
      unregister = WebGLContextManager.registerCanvas(canvasRef.current, {
        onContextLost: handleContextLoss,
        onContextRestored: handleContextRestored,
        autoRecover: false // Don't try to recover, just reload
      });
      
      // Apply initial platform optimizations
      WebGLContextManager.applyPlatformOptimizations(canvasRef.current);
      
      // Initialize Potree if used, reload page if it fails
      PotreeUtils.initPotree().then(result => {
        console.log('Potree initialization result:', result);
        if (!result.available) {
          window.location.reload();
        }
      }).catch(error => {
        console.error('Error initializing Potree:', error);
        window.location.reload();
      });
    } catch (e) {
      console.error('Error setting up WebGL:', e);
      window.location.reload();
    }
    
    // Return cleanup function
    return () => {
      if (typeof unregister === 'function') {
        try {
          unregister();
        } catch (e) {
          console.error('Error unregistering canvas:', e);
        }
      }
    };
  }, [handleContextLoss, handleContextRestored]);

  return (
    <div className="main-layout">
      <StyledVars>
        <TabBar>
          <TabButton
            active={activeTab === 'mission'}
            onClick={() => setActiveTab('mission')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Drone Mission Planner
          </TabButton>
          <TabButton
            active={activeTab === 'dof'}
            onClick={() => setActiveTab('dof')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            DOF Calculator
          </TabButton>
        </TabBar>
        
        <ContentContainer>
          <AnimatePresence mode="wait">
          {activeTab === 'mission' ? (
              <motion.div
                key="mission"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ width: '100%', height: '100%' }}
              >
                <React.Suspense fallback={
                  <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1a1a1a', color: 'white' }}>
                    Loading Mission Planner...
                  </div>
                }>
                  <ErrorBoundary fallback={
                    <div style={{ padding: '20px', backgroundColor: '#2a2a2a', color: 'white' }}>
                      <h3>Error loading Mission Planner</h3>
                      <p>There was a problem loading the Mission Planner component.</p>
                      <button onClick={() => window.location.reload()}>Reload Page</button>
                    </div>
                  }>
                    <MissionPlanner 
                      key={`mission-planner-${contextLostCount}`} 
                      contextLostCount={contextLostCount}
                    />
                  </ErrorBoundary>
                </React.Suspense>
              </motion.div>
            ) : activeTab === 'dof' ? (
              <motion.div
                key="dof"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  padding: 0,
                  overflow: 'hidden'
                }}
              >
                <DOFWrapperContainer>
                  <React.Suspense fallback={
                    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1a1a1a', color: 'white' }}>
                      Loading DOF Calculator...
                    </div>
                  }>
                    <ErrorBoundary fallback={
                      <div style={{ padding: '20px', backgroundColor: '#2a2a2a', color: 'white' }}>
                        <h3>Error loading DOF Calculator</h3>
                        <p>There was a problem loading the DOF Calculator component.</p>
                        <button onClick={() => window.location.reload()}>Reload Page</button>
                      </div>
                    }>
                      <DOFCalculator 
                        key={`dof-calculator-${contextLostCount}`}
                      />
                    </ErrorBoundary>
                  </React.Suspense>
                </DOFWrapperContainer>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </ContentContainer>
      </StyledVars>
      
      <Canvas
        ref={canvasRef}
        gl={{
          powerPreference: isAppleSiliconDevice ? 'low-power' : 'high-performance',
          antialias: !isAppleSiliconDevice, // Disable on Apple Silicon for performance
          alpha: false,
          depth: true,
          stencil: false,
          premultipliedAlpha: false,
          // Add option to fail immediately if WebGL capabilities aren't sufficient
          failIfMajorPerformanceCaveat: true
        }}
        dpr={isAppleSiliconDevice ? Math.min(window.devicePixelRatio, 1.0) : Math.min(window.devicePixelRatio, 1.5)}
        shadows={!isAppleSiliconDevice} // Disable shadows on Apple Silicon
        camera={{ position: [0, 2, 5], fov: 75 }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          // Force reload if context creation fails
          if (!gl || !gl.getContext) {
            window.location.reload();
          }
        }}
      >
        {/* ... existing Canvas content ... */}
      </Canvas>
    </div>
  );
};

export default MainLayout; 