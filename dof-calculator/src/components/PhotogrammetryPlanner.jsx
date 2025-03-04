import React, { useState, useEffect } from 'react';

const PhotogrammetryPlanner = ({ 
  groundCoverage, 
  distanceUnit,
  cameraDetails,
  lensDetails,
  aperture,
  focusDistance
}) => {
  // State for inputs
  const [surfaceWidth, setSurfaceWidth] = useState(10);
  const [surfaceHeight, setSurfaceHeight] = useState(10);
  const [surfaceDepth, setSurfaceDepth] = useState(0); // Optional for 3D objects
  const [horizontalOverlap, setHorizontalOverlap] = useState(60); // Default 60% overlap
  const [verticalOverlap, setVerticalOverlap] = useState(60); // Default 60% overlap
  
  // State for results
  const [numImagesRequired, setNumImagesRequired] = useState(0);
  const [effectiveCoverage, setEffectiveCoverage] = useState({ width: 0, height: 0 });
  const [totalSurfaceArea, setTotalSurfaceArea] = useState(0);
  
  // Calculate pixel density (pixels per mm) from camera details
  const calculatePixelDensity = () => {
    if (!cameraDetails) return null;
    
    const pixelsPerMM = cameraDetails.imageWidth / cameraDetails.sensorWidth;
    return pixelsPerMM;
  };
  
  // Calculate recommended aperture for photogrammetry
  const getRecommendedAperture = () => {
    if (!lensDetails) return null;
    
    // For photogrammetry, usually f/8-f/11 is recommended for best depth of field
    // while maintaining sharpness
    const recommendedApertures = [8, 11, 16].filter(
      ap => ap >= lensDetails.maxAperture && ap <= lensDetails.minAperture
    );
    
    return recommendedApertures.length > 0 ? recommendedApertures[0] : lensDetails.maxAperture;
  };
  
  // Parse ground coverage from string (e.g. "16.0 × 12.0ft")
  const parseGroundCoverage = () => {
    if (!groundCoverage) return { width: 0, height: 0 };
    
    const parts = groundCoverage.split('×');
    if (parts.length !== 2) return { width: 0, height: 0 };
    
    const width = parseFloat(parts[0].trim());
    // Remove unit from height part
    const heightPart = parts[1].trim();
    const height = parseFloat(heightPart.replace('ft', '').replace('m', ''));
    
    return { width, height };
  };
  
  // Calculate effective coverage area considering overlap
  const calculateEffectiveCoverage = (coverage) => {
    // This calculates the unique area each image contributes
    // If overlap is 80%, each image only contributes 20% unique area
    const hOverlapFactor = (100 - horizontalOverlap) / 100;
    const vOverlapFactor = (100 - verticalOverlap) / 100;
    
    return {
      width: coverage.width * hOverlapFactor,
      height: coverage.height * vOverlapFactor
    };
  };
  
  // Calculate total surface area
  const calculateTotalSurfaceArea = () => {
    if (surfaceDepth === 0) {
      // 2D surface (e.g., a wall or floor)
      return surfaceWidth * surfaceHeight;
    } else {
      // 3D object (simplified as a box)
      // Front + Back + Left + Right + Top + Bottom
      return 2 * (surfaceWidth * surfaceHeight + surfaceWidth * surfaceDepth + surfaceHeight * surfaceDepth);
    }
  };
  
  // Calculate number of images required
  const calculateImagesRequired = () => {
    const coverage = parseGroundCoverage();
    const effective = calculateEffectiveCoverage(coverage);
    const totalArea = calculateTotalSurfaceArea();
    
    if (effective.width <= 0 || effective.height <= 0) return 0;
    
    // Calculate how many images are needed in each dimension
    const imagesAcross = Math.ceil(surfaceWidth / effective.width);
    const imagesDown = Math.ceil(surfaceHeight / effective.height);
    
    let totalImages = imagesAcross * imagesDown;
    
    // If we have depth (3D object), multiply by sides
    if (surfaceDepth > 0) {
      // For a box, we need images for all 6 sides
      totalImages = totalImages * 6;
    }
    
    return {
      total: totalImages,
      across: imagesAcross,
      down: imagesDown,
      effectiveCoverage: effective,
      totalArea
    };
  };
  
  // Calculate Ground Sample Distance (GSD) based on the current camera setup
  const calculateGSD = () => {
    if (!cameraDetails || !lensDetails || !focusDistance) return null;
    
    // Calculate pixel size in mm
    const pixelSizeMM = cameraDetails.sensorWidth / cameraDetails.imageWidth;
    
    // Convert focus distance to mm
    const distanceMM = focusDistance * 1000;
    
    // GSD = (Pixel Size × Distance) / Focal Length
    const gsdMM = (pixelSizeMM * distanceMM) / lensDetails.focalLength;
    
    // Always return in mm, no matter what distance unit is selected
    return gsdMM;
  };
  
  // Update the storage calculation function
  const calculateEstimatedStorage = () => {
    if (!cameraDetails?.megapixels) return { jpeg: 'N/A', raw: 'N/A' };
    
    // More accurate file size calculation for different camera types
    let jpegSizePerMp;
    let rawSizePerMp;
    
    // Adjust file size estimation based on camera brand/type
    if (cameraDetails.brand === 'Phase One' || cameraDetails.brand === 'Hasselblad') {
      // Phase One and Hasselblad produce large files
      jpegSizePerMp = 0.8; // MB per megapixel for JPEG
      rawSizePerMp = 5.0; // MB per megapixel for RAW
    } else if (cameraDetails.brand === 'Fujifilm' && cameraDetails.model.includes('GFX')) {
      // Fujifilm medium format
      jpegSizePerMp = 0.8; // MB per megapixel for JPEG
      rawSizePerMp = 4.5; // MB per megapixel for RAW
    } else if (cameraDetails.megapixels > 45) {
      // Other high-resolution cameras
      jpegSizePerMp = 0.7; // MB per megapixel for JPEG
      rawSizePerMp = 4.0; // MB per megapixel for RAW
    } else {
      // Standard full-frame or smaller sensors
      jpegSizePerMp = 0.5; // MB per megapixel for JPEG
      rawSizePerMp = 2.5; // MB per megapixel for RAW
    }
    
    const totalJpegSizeMB = numImagesRequired * (cameraDetails.megapixels * jpegSizePerMp);
    const totalRawSizeMB = numImagesRequired * (cameraDetails.megapixels * rawSizePerMp);
    
    // Format output for display
    let jpegSizeDisplay;
    let rawSizeDisplay;
    
    if (totalJpegSizeMB > 1024) {
      jpegSizeDisplay = `${(totalJpegSizeMB / 1024).toFixed(1)} GB`;
    } else {
      jpegSizeDisplay = `${totalJpegSizeMB.toFixed(0)} MB`;
    }
    
    if (totalRawSizeMB > 1024) {
      rawSizeDisplay = `${(totalRawSizeMB / 1024).toFixed(1)} GB`;
    } else {
      rawSizeDisplay = `${totalRawSizeMB.toFixed(0)} MB`;
    }
    
    return { 
      jpeg: jpegSizeDisplay, 
      raw: rawSizeDisplay,
      totalJpegSizeMB,
      totalRawSizeMB
    };
  };
  
  // Update calculations when inputs change
  useEffect(() => {
    if (groundCoverage) {
      const result = calculateImagesRequired();
      setNumImagesRequired(result.total);
      setEffectiveCoverage(result.effectiveCoverage);
      setTotalSurfaceArea(result.totalArea);
    }
  }, [groundCoverage, surfaceWidth, surfaceHeight, surfaceDepth, horizontalOverlap, verticalOverlap]);
  
  // Calculate recommended settings
  const gsd = calculateGSD();
  const currentGSD = gsd ? 
    (gsd < 10 ? `${gsd.toFixed(2)} mm/pixel` : `${(gsd / 10).toFixed(2)} cm/pixel`) 
    : 'N/A';
  
  const recommendedAperture = getRecommendedAperture();
  const pixelDensity = calculatePixelDensity();
  const estimatedStorage = calculateEstimatedStorage();
  
  return (
    <div className="photogrammetry-planner">
      <h3>Photogrammetry Capture Planner</h3>
      
      <div className="planner-inputs">
        <div className="input-section">
          <h4>Subject Dimensions</h4>
          <div className="input-group">
            <label htmlFor="surface-width">Width:</label>
            <div className="range-value">
              <input
                type="number"
                id="surface-width"
                min="0.1"
                max="1000"
                step="0.1"
                value={surfaceWidth}
                onChange={(e) => setSurfaceWidth(parseFloat(e.target.value) || 0)}
              />
              <span>{distanceUnit}</span>
            </div>
          </div>
          
          <div className="input-group">
            <label htmlFor="surface-height">Height:</label>
            <div className="range-value">
              <input
                type="number"
                id="surface-height"
                min="0.1"
                max="1000"
                step="0.1"
                value={surfaceHeight}
                onChange={(e) => setSurfaceHeight(parseFloat(e.target.value) || 0)}
              />
              <span>{distanceUnit}</span>
            </div>
          </div>
          
          <div className="input-group">
            <label htmlFor="surface-depth">Depth (optional):</label>
            <div className="range-value">
              <input
                type="number"
                id="surface-depth"
                min="0"
                max="1000"
                step="0.1"
                value={surfaceDepth}
                onChange={(e) => setSurfaceDepth(parseFloat(e.target.value) || 0)}
              />
              <span>{distanceUnit}</span>
            </div>
            <small className="form-tip">Leave at 0 for flat surfaces</small>
          </div>
        </div>
        
        <div className="input-section">
          <h4>Overlap Settings</h4>
          <div className="input-group">
            <label htmlFor="horizontal-overlap">Horizontal Overlap:</label>
            <div className="range-value">
              <input
                type="number"
                id="horizontal-overlap"
                min="1"
                max="90"
                step="1"
                value={horizontalOverlap}
                onChange={(e) => setHorizontalOverlap(parseInt(e.target.value) || 0)}
              />
              <span>%</span>
            </div>
            <input
              type="range"
              min="1"
              max="90"
              step="1"
              value={horizontalOverlap}
              onChange={(e) => setHorizontalOverlap(parseInt(e.target.value))}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="vertical-overlap">Vertical Overlap:</label>
            <div className="range-value">
              <input
                type="number"
                id="vertical-overlap"
                min="1"
                max="90"
                step="1"
                value={verticalOverlap}
                onChange={(e) => setVerticalOverlap(parseInt(e.target.value) || 0)}
              />
              <span>%</span>
            </div>
            <input
              type="range"
              min="1"
              max="90"
              step="1"
              value={verticalOverlap}
              onChange={(e) => setVerticalOverlap(parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>
      
      <div className="planner-results">
        <div className="result-card">
          <h4>Total Surface Area</h4>
          <p>{totalSurfaceArea.toFixed(1)} {distanceUnit === 'm' ? 'm²' : 'ft²'}</p>
          {surfaceDepth > 0 && <small>Box-shaped object with 6 sides</small>}
        </div>
        
        <div className="result-card">
          <h4>Unique Area per Image</h4>
          <p>{effectiveCoverage.width.toFixed(1)} × {effectiveCoverage.height.toFixed(1)} {distanceUnit}</p>
          <small>With {horizontalOverlap}% horizontal and {verticalOverlap}% vertical overlap</small>
        </div>
        
        <div className="result-card highlight">
          <h4>Images Required</h4>
          <p className="large-number">{numImagesRequired}</p>
          <small>Based on current overlap settings</small>
        </div>
      </div>
      
      <div className="overlap-explainer">
        <h4>How Overlap Works</h4>
        <div className="overlap-diagram">
          <div className="diagram-container">
            <div className="diagram-image full-image"></div>
            <div className="diagram-label">Full Image Coverage</div>
          </div>
          <div className="diagram-arrow">→</div>
          <div className="diagram-container">
            <div className="diagram-image" style={{ backgroundColor: 'var(--accent-color)', opacity: '0.7' }}>
              {/* This creates a full red background representing the unique area */}
              
              {/* Blue overlap area in top-left */}
              <div 
                style={{ 
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width: `${horizontalOverlap}%`,
                  height: `${verticalOverlap}%`,
                  backgroundColor: 'var(--primary-color)',
                  opacity: '1'
                }}
              ></div>
            </div>
            <div className="diagram-label">
              {horizontalOverlap}% Overlap = {100-horizontalOverlap}% Unique Coverage
            </div>
          </div>
        </div>
        <p className="overlap-explanation">
          Higher overlap increases accuracy but requires more images. With {horizontalOverlap}% horizontal 
          and {verticalOverlap}% vertical overlap, only {(100-horizontalOverlap)*(100-verticalOverlap)/100}% 
          of each image is unique (not overlapping with adjacent images).
        </p>
      </div>
      
      <div className="photogrammetry-details">
        <h4>Technical Details</h4>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Ground Sample Distance:</span>
            <span className="detail-value">{currentGSD}</span>
            <small>{gsd && gsd < 3 ? "High detail capture" : (gsd && gsd < 10 ? "Good for most applications" : "Consider adjusting distance or lens")}</small>
          </div>
          
          <div className="detail-item">
            <span className="detail-label">Resolution:</span>
            <span className="detail-value">{cameraDetails ? `${cameraDetails.imageWidth} × ${cameraDetails.imageHeight}` : 'N/A'}</span>
            <small>{cameraDetails ? `${cameraDetails.megapixels}MP` : ''}</small>
          </div>
          
          <div className="detail-item">
            <span className="detail-label">Recommended Aperture:</span>
            <span className="detail-value">{recommendedAperture ? `f/${recommendedAperture}` : 'N/A'}</span>
            <small>{aperture !== recommendedAperture && recommendedAperture ? `Current: f/${aperture}` : ''}</small>
          </div>
          
          <div className="detail-item storage-estimate">
            <span className="detail-label">Estimated Storage:</span>
            <div className="storage-values">
              <div className="storage-format">
                <span className="format-label">JPEG:</span>
                <span className="format-value">{estimatedStorage.jpeg}</span>
              </div>
              <div className="storage-format">
                <span className="format-label">RAW:</span>
                <span className="format-value">{estimatedStorage.raw}</span>
              </div>
            </div>
            <small>Based on typical file sizes for {cameraDetails?.brand || 'professional'} cameras</small>
          </div>
        </div>
      </div>
      
      <div className="planner-tips">
        <h4>Photogrammetry Tips</h4>
        <ul className="tips-list">
          <li>Use consistent lighting to avoid shadows that can confuse photogrammetry software</li>
          <li>60-80% overlap is typically recommended for optimal results</li>
          <li>For 3D objects, capture images at multiple heights around the object</li>
          <li>For shiny or transparent surfaces, consider using polarizing filters</li>
          <li>Consider using aperture f/{recommendedAperture || 8}-f/11 to maximize depth of field</li>
          <li>Maintain a consistent GSD (pixel size) throughout your capture session</li>
        </ul>
      </div>
    </div>
  );
};

export default PhotogrammetryPlanner; 