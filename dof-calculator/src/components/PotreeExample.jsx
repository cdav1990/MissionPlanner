import React, { useState, useCallback, useRef } from 'react';
import LargePointCloudViewer from './LargePointCloudViewer';
import { isPotreeAvailable } from '../utils/PotreeUtils';

/**
 * Example component demonstrating how to use the LargePointCloudViewer
 */
const PotreeExample = () => {
  // State for the selected point cloud file
  const [pointCloudUrl, setPointCloudUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadedPointCloud, setLoadedPointCloud] = useState(null);
  const [error, setError] = useState(null);
  
  // Reference to the file input element
  const fileInputRef = useRef(null);
  
  // Handle when a point cloud is loaded
  const handlePointCloudLoad = useCallback((pointCloud) => {
    console.log('Point cloud loaded successfully:', pointCloud);
    setIsLoading(false);
    setLoadedPointCloud({
      pointCount: pointCloud.pointCount || 0,
      boundingSize: pointCloud.boundingSize || 0,
      autoScaled: pointCloud.autoScaleEnabled || false
    });
  }, []);
  
  // Handle loading progress
  const handleProgress = useCallback((progress) => {
    setLoadProgress(progress.percentage || 0);
  }, []);
  
  // Handle loading errors
  const handleError = useCallback((err) => {
    console.error('Error loading point cloud:', err);
    setIsLoading(false);
    setError(err.message || 'Failed to load point cloud');
  }, []);
  
  // Handle file selection
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Reset state
    setError(null);
    setIsLoading(true);
    setLoadProgress(0);
    setLoadedPointCloud(null);
    
    // Create object URL for the file
    const objectUrl = URL.createObjectURL(file);
    setPointCloudUrl(objectUrl);
    
    console.log(`Selected file: ${file.name}, size: ${file.size} bytes`);
  }, []);
  
  // Handle sample file selection
  const handleSampleSelect = useCallback((sampleUrl) => {
    // Reset state
    setError(null);
    setIsLoading(true);
    setLoadProgress(0);
    setLoadedPointCloud(null);
    
    setPointCloudUrl(sampleUrl);
  }, []);
  
  // Handle clearing the current point cloud
  const handleClear = useCallback(() => {
    setPointCloudUrl('');
    setLoadedPointCloud(null);
    setError(null);
    setIsLoading(false);
    setLoadProgress(0);
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);
  
  // Sample point clouds
  const samplePointClouds = [
    {
      name: 'Forest Sample',
      url: '/potree-data/forest/cloud.js',
      description: 'Small forest scan with trees and ground'
    },
    {
      name: 'Urban Sample',
      url: 'https://cdn.potree.org/data/lion/cloud.js',
      description: 'Urban scan of a stone lion statue'
    }
  ];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Header with controls */}
      <div style={{ 
        padding: '15px', 
        borderBottom: '1px solid #ccc',
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h2 style={{ margin: 0, flexGrow: 0, marginRight: '20px' }}>Potree Point Cloud Viewer</h2>
        
        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* File input */}
          <div>
            <input 
              type="file" 
              accept=".las,.laz,.xyz,.pts,.ptx,.cloud.js" 
              onChange={handleFileSelect} 
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="point-cloud-file-input"
            />
            <button 
              onClick={() => document.getElementById('point-cloud-file-input').click()}
              style={{
                padding: '8px 15px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Choose File
            </button>
          </div>
          
          {/* Sample dropdown */}
          <div>
            <select 
              onChange={(e) => e.target.value && handleSampleSelect(e.target.value)}
              value=""
              style={{
                padding: '8px 15px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            >
              <option value="">Load Sample...</option>
              {samplePointClouds.map((sample, index) => (
                <option key={index} value={sample.url}>
                  {sample.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Clear button */}
          {pointCloudUrl && (
            <button 
              onClick={handleClear}
              style={{
                padding: '8px 15px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
          
          {/* Status display */}
          {isLoading && (
            <div style={{ 
              marginLeft: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px' 
            }}>
              <div style={{ 
                width: '150px', 
                height: '10px', 
                background: '#eee', 
                borderRadius: '5px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${loadProgress}%`, 
                  height: '100%', 
                  background: '#2196F3',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <span>{loadProgress.toFixed(0)}%</span>
            </div>
          )}
          
          {/* Point cloud info */}
          {loadedPointCloud && (
            <div style={{ 
              marginLeft: '10px', 
              background: '#e3f2fd', 
              padding: '5px 10px', 
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <span style={{ fontWeight: 'bold' }}>Points:</span> {loadedPointCloud.pointCount.toLocaleString()}
              {loadedPointCloud.autoScaled && (
                <span style={{ marginLeft: '10px' }}>
                  <span style={{ fontWeight: 'bold' }}>Auto-scaled</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Main viewer area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!isPotreeAvailable && (
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            background: 'rgba(244, 67, 54, 0.9)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3>Potree Library Not Available</h3>
            <p>
              The Potree library is required to view large point clouds.
              Please ensure that Potree is properly loaded in your application.
            </p>
          </div>
        )}
        
        {error && (
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            background: 'rgba(244, 67, 54, 0.9)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '400px',
            textAlign: 'center',
            zIndex: 1000
          }}>
            <h3>Error Loading Point Cloud</h3>
            <p>{error}</p>
          </div>
        )}
        
        {!pointCloudUrl ? (
          // Display instructions when no point cloud is loaded
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            maxWidth: '400px',
            textAlign: 'center',
            color: '#555'
          }}>
            <h3>No Point Cloud Loaded</h3>
            <p>
              Select a file or choose a sample point cloud to get started.
            </p>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px',
              marginTop: '20px'
            }}>
              {samplePointClouds.map((sample, index) => (
                <div 
                  key={index} 
                  style={{ 
                    padding: '10px 15px',
                    background: '#f1f1f1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onClick={() => handleSampleSelect(sample.url)}
                >
                  <div style={{ fontWeight: 'bold' }}>{sample.name}</div>
                  <div style={{ fontSize: '14px', color: '#777' }}>{sample.description}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Render the point cloud viewer
          <LargePointCloudViewer
            url={pointCloudUrl}
            viewerOptions={{
              showStats: true,
              showMemoryWarnings: true,
              autoOptimize: true
            }}
            pointCloudOptions={{
              pointSize: 1.0,
              opacity: 1.0,
              maxPoints: 5000000,
              edlEnabled: true
            }}
            onLoad={handlePointCloudLoad}
            onProgress={handleProgress}
            onError={handleError}
          />
        )}
      </div>
      
      {/* Footer */}
      <div style={{ 
        padding: '10px 15px', 
        borderTop: '1px solid #ccc',
        background: '#f5f5f5',
        fontSize: '14px',
        color: '#555',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <div>
          Powered by Potree & Three.js
        </div>
        <div>
          Controls: Left-click to rotate | Right-click to pan | Scroll to zoom
        </div>
      </div>
    </div>
  );
};

export default PotreeExample; 