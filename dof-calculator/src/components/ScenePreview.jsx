import React, { useEffect, useRef, useState, useMemo } from 'react';

/**
 * Scene Preview component - SIMPLIFIED VERSION
 * Provides a clean visualization focusing only on depth of field effects
 */
const ScenePreview = ({ dofCalculations, cameraDetails, lensDetails, distanceUnit = 'm' }) => {
  const canvasRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  
  // Format distance for display
  const formatDistance = (meters) => {
    if (meters === Infinity) return "∞";
    if (distanceUnit === 'ft') {
      return `${(meters * 3.28084).toFixed(1)}ft`;
    }
    return `${meters.toFixed(1)}m`;
  };
  
  // Memoize the settings to prevent unnecessary re-renders
  const settings = useMemo(() => {
    return {
      isValid: !!(dofCalculations && cameraDetails && lensDetails),
      stats: dofCalculations ? {
        nearLimit: formatDistance(dofCalculations.nearLimit),
        focusDistance: formatDistance(dofCalculations.focusDistance),
        farLimit: formatDistance(dofCalculations.farLimit),
        totalDOF: formatDistance(dofCalculations.totalDOF)
      } : null,
      // Use the actual aperture from dofCalculations instead of maxAperture
      aperture: dofCalculations?.aperture,
      focalLength: lensDetails?.focalLength,
      cameraInfo: cameraDetails && lensDetails && dofCalculations ? 
        `${cameraDetails.brand} ${cameraDetails.model} with ${lensDetails.focalLength}mm lens at f/${dofCalculations.aperture || lensDetails.maxAperture}` : 
        null
    };
  }, [dofCalculations, cameraDetails, lensDetails, formatDistance]);
  
  // Generate the improved scene visualization
  const generateSceneVisualization = () => {
    if (!canvasRef.current || !dofCalculations) return;
  
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const canvasWidth = 600;
    const canvasHeight = 400;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw a clean gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    bgGradient.addColorStop(0, '#182030');
    bgGradient.addColorStop(1, '#101820');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Get DOF values
    const { nearLimit, farLimit, focusDistance, aperture } = dofCalculations;
    
    // Draw focus regions and indicators
    drawFocusZones(ctx, nearLimit, farLimit, focusDistance, canvasWidth, canvasHeight);
    
    // Draw distance scale along the bottom
    drawDistanceScale(ctx, nearLimit, farLimit, focusDistance, canvasWidth, canvasHeight);
    
    // Draw informational overlays
    drawInfoOverlay(ctx, nearLimit, farLimit, focusDistance, aperture, lensDetails?.focalLength, canvasWidth, canvasHeight);
    
    // Convert canvas to image and set state
    setPreviewImage(canvas.toDataURL());
  };
  
  // Draw the DOF zones with clearer visual representation
  const drawFocusZones = (ctx, nearLimit, farLimit, focusDistance, width, height) => {
    const maxDistance = farLimit === Infinity ? focusDistance * 3 : farLimit * 1.2;
    
    // Function to map distance to x-coordinate
    const distanceToX = (distance) => {
      // Linear mapping with some padding on sides
      return width * 0.1 + (width * 0.8) * Math.min(distance / maxDistance, 1);
    };
    
    // Get positions for key distances
    const nearX = distanceToX(nearLimit);
    const focusX = distanceToX(focusDistance);
    const farX = distanceToX(farLimit === Infinity ? maxDistance : farLimit);
    
    // Draw DOF zones with gradients
    
    // Out of focus zone (before near limit)
    const beforeNearGradient = ctx.createLinearGradient(0, 0, nearX, 0);
    beforeNearGradient.addColorStop(0, 'rgba(255, 50, 50, 0.1)');
    beforeNearGradient.addColorStop(1, 'rgba(255, 50, 50, 0.25)');
    ctx.fillStyle = beforeNearGradient;
    ctx.fillRect(width * 0.1, height * 0.25, nearX - width * 0.1, height * 0.5);
    
    // In focus zone
    const inFocusGradient = ctx.createLinearGradient(nearX, 0, farX, 0);
    inFocusGradient.addColorStop(0, 'rgba(50, 255, 50, 0.2)');
    inFocusGradient.addColorStop(0.5, 'rgba(50, 255, 50, 0.35)');
    inFocusGradient.addColorStop(1, 'rgba(50, 255, 50, 0.2)');
    ctx.fillStyle = inFocusGradient;
    ctx.fillRect(nearX, height * 0.25, farX - nearX, height * 0.5);
    
    // Out of focus zone (after far limit)
    if (farLimit !== Infinity) {
      const afterFarGradient = ctx.createLinearGradient(farX, 0, width, 0);
      afterFarGradient.addColorStop(0, 'rgba(255, 50, 50, 0.25)');
      afterFarGradient.addColorStop(1, 'rgba(255, 50, 50, 0.1)');
      ctx.fillStyle = afterFarGradient;
      ctx.fillRect(farX, height * 0.25, width * 0.9 - farX, height * 0.5);
    }
    
    // Draw key distance markers
    // Add distance labels above the zones
    const labelY = height * 0.2;
    
    // Add distance markers and labels at key positions
    const keyDistances = [
      { distance: nearLimit * 0.5, showLabel: true },
      { distance: nearLimit, showLabel: true },
      { distance: (nearLimit + focusDistance) / 2, showLabel: nearLimit + 1 < focusDistance },
      { distance: focusDistance, showLabel: true },
      ...(farLimit !== Infinity ? [{ distance: (focusDistance + farLimit) / 2, showLabel: focusDistance + 1 < farLimit }] : []),
      { distance: farLimit !== Infinity ? farLimit : focusDistance * 2, showLabel: true },
      ...(farLimit !== Infinity ? [{ distance: farLimit * 1.2, showLabel: true }] : [])
    ];
    
    // Filter distances that are too close to each other
    const filteredDistances = keyDistances.reduce((acc, dist) => {
      const tooClose = acc.some(existingDist => 
        Math.abs(existingDist.distance - dist.distance) < (maxDistance * 0.05));
      
      if (!tooClose) {
        acc.push(dist);
      }
      return acc;
    }, []);
    
    // Draw distance markers and labels
    filteredDistances.forEach(({ distance, showLabel }) => {
      const x = distanceToX(distance);
      
      // Draw small tick mark
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, height * 0.24);
      ctx.lineTo(x, height * 0.26);
      ctx.stroke();
      
      // Add distance label
      if (showLabel) {
        const labelText = formatDistance(distance);
        
        ctx.font = '11px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, x, labelY);
      }
    });
    
    // Draw focus plane line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(focusX, height * 0.2);
    ctx.lineTo(focusX, height * 0.8);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw near limit line
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(nearX, height * 0.2);
    ctx.lineTo(nearX, height * 0.8);
    ctx.stroke();
    
    // Draw far limit line
    if (farLimit !== Infinity) {
      ctx.beginPath();
      ctx.moveTo(farX, height * 0.2);
      ctx.lineTo(farX, height * 0.8);
      ctx.stroke();
    } else {
      // Draw infinity symbol
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('∞', farX, height * 0.35);
    }
    
    // Add labels for key points
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // Near limit label
    ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
    ctx.fillText('Near Limit', nearX, height * 0.85);
    
    // Focus label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('Focus Plane', focusX, height * 0.85);
    
    // Far limit label
    if (farLimit !== Infinity) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
      ctx.fillText('Far Limit', farX, height * 0.85);
    }
    
    // Add zone labels
    ctx.font = '13px Arial';
    
    // Out of focus (near) label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const nearOutX = width * 0.1 + (nearX - width * 0.1) / 2;
    ctx.fillText('Out of Focus', nearOutX, height * 0.5);
    
    // In focus label
    const inFocusX = nearX + (farX - nearX) / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('In Focus', inFocusX, height * 0.5);
    
    // Out of focus (far) label
    if (farLimit !== Infinity) {
      const farOutX = farX + (width * 0.9 - farX) / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('Out of Focus', farOutX, height * 0.5);
    }
  };
  
  // Draw distance scale along the bottom
  const drawDistanceScale = (ctx, nearLimit, farLimit, focusDistance, width, height) => {
    const scaleY = height - 30;
    const maxDistance = farLimit === Infinity ? focusDistance * 3 : farLimit * 1.2;
    
    // Draw scale line
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, scaleY);
    ctx.lineTo(width * 0.9, scaleY);
    ctx.stroke();
    
    // Draw tick marks with distances
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
      const distance = (maxDistance / numTicks) * i;
      const x = width * 0.1 + (width * 0.8) * (i / numTicks);
      
      // Draw tick
      ctx.beginPath();
      ctx.moveTo(x, scaleY - 4);
      ctx.lineTo(x, scaleY + 4);
      ctx.stroke();
      
      // Draw label
      ctx.fillStyle = '#aaa';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(formatDistance(distance), x, scaleY + 15);
    }
  };
  
  // Draw informational overlay
  const drawInfoOverlay = (ctx, nearLimit, farLimit, focusDistance, aperture, focalLength, width, height) => {
    // Draw title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Depth of Field Visualization', width / 2, 25);
    
    // Add camera info box in the top left
    if (aperture && focalLength) {
      // Create background for camera info
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(10, 10, 210, 35);
      
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0cc';
      ctx.font = 'bold 12px Arial';
      
      // Camera settings (left aligned)
      ctx.fillText(`f/${aperture} @ ${focalLength}mm`, 20, 25);
      
      // Total DOF value (right aligned within the box)
      ctx.fillText(`Total DOF: ${formatDistance(dofCalculations.totalDOF)}`, 20, 40);
    }
  };
  
  // Generate visualization when component updates
  useEffect(() => {
    if (settings.isValid) {
      generateSceneVisualization();
    }
  }, [settings]);
  
  return (
    <div className="scene-preview">
      <div className="scene-preview-header">
        <h2>Depth of Field Visualization</h2>
        <p className="scene-description">
          See how your camera settings affect which objects appear in focus
        </p>
      </div>
      
      <div className="scene-controls">
        <div className="scene-preview-stats">
          {settings.stats && (
            <>
              <div className="preview-stat">
                <span className="stat-label">Near Limit:</span>
                <span className="stat-value">{settings.stats.nearLimit}</span>
              </div>
              <div className="preview-stat">
                <span className="stat-label">Focus Distance:</span>
                <span className="stat-value">{settings.stats.focusDistance}</span>
              </div>
              <div className="preview-stat">
                <span className="stat-label">Far Limit:</span>
                <span className="stat-value">{settings.stats.farLimit}</span>
              </div>
              <div className="preview-stat">
                <span className="stat-label">Total DOF:</span>
                <span className="stat-value">{settings.stats.totalDOF}</span>
              </div>
              {dofCalculations?.aperture && (
                <div className="preview-stat">
                  <span className="stat-label">Aperture:</span>
                  <span className="stat-value">f/{dofCalculations.aperture}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="preview-container">
        {!settings.isValid ? (
          <div className="preview-placeholder">
            <div className="placeholder-text">Please select a camera, lens, and set focus distance in the Depth of Field tab</div>
          </div>
        ) : previewImage ? (
          <img 
            src={previewImage} 
            alt="DOF Preview" 
            className="preview-image" 
          />
        ) : (
          <div className="preview-placeholder">
            <div className="placeholder-text">Generating visualization...</div>
          </div>
        )}
        
        {/* Hidden canvas for rendering */}
        <canvas 
          ref={canvasRef} 
          width="600" 
          height="400" 
          style={{ display: 'none' }}
        />
      </div>
      
      <div className="scene-preview-details">
        <div className="camera-info">
          {settings.cameraInfo ? (
            <>
              <h4>Camera Setup</h4>
              <p>{settings.cameraInfo}</p>
            </>
          ) : (
            <p><em>No camera/lens selected. Please configure in the Depth of Field tab.</em></p>
          )}
        </div>
        
        <div className="preview-note">
          <p>
            <strong>How to read this visualization:</strong> The horizontal axis represents distance from the camera.
            The <span style={{color: 'lightgreen'}}>green zone</span> shows the in-focus region between the 
            <span style={{color: '#0cc'}}> near and far limits</span>, while
            <span style={{color: 'lightcoral'}}> red zones</span> indicate out-of-focus areas.
            Distance markers show exact measurements from the camera, and the white dashed line shows the focus plane.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScenePreview; 