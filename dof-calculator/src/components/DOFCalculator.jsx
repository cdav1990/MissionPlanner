import React, { useState, useEffect } from 'react';
import { getDOFCalculations } from '../utils/dofCalculations';
import DOFVisualization from './DOFVisualization';
import SkunkworksLogo from './SkunkworksLogo';
import cameraLensData from '../data/cameraLensData.json';
import PhotogrammetryPlanner from './PhotogrammetryPlanner';
import TabNavigation from './TabNavigation';
import ScenePreview from './ScenePreview';

// Helper function to convert meters to feet
const metersToFeet = (meters) => meters * 3.28084;

// Helper function to convert feet to meters
const feetToMeters = (feet) => feet / 3.28084;

// Threshold to display infinity symbol (when distance is larger than this multiple of focus distance)
const INFINITY_DISPLAY_THRESHOLD = 15;

const DOFCalculator = () => {
  // State for selected values
  const [selectedSensorSize, setSelectedSensorSize] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedLens, setSelectedLens] = useState('');
  const [selectedAperture, setSelectedAperture] = useState(8);
  const [focusDistance, setFocusDistance] = useState(5); // Always stored in meters internally
  const [dofCalculations, setDofCalculations] = useState(null);
  const [distanceUnit, setDistanceUnit] = useState('m'); // 'm' for meters, 'ft' for feet
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('dof'); // 'dof', 'photogrammetry', or 'scenePreview'
  
  // Filtered lists based on selections
  const [filteredCameras, setFilteredCameras] = useState([]);
  const [filteredLenses, setFilteredLenses] = useState([]);
  
  // Get camera and lens details
  const selectedCameraDetails = selectedCamera 
    ? cameraLensData.cameras.find(cam => cam.id === selectedCamera) 
    : null;
  
  const selectedLensDetails = selectedLens 
    ? cameraLensData.lenses.find(lens => lens.id === selectedLens) 
    : null;
  
  // Update filtered cameras when sensor size selection changes
  useEffect(() => {
    if (selectedSensorSize) {
      const sensorSize = cameraLensData.sensorSizes.find(s => s.id === selectedSensorSize);
      if (sensorSize) {
        const camerasForSensorSize = cameraLensData.cameras.filter(
          camera => camera.sensorSizeId === selectedSensorSize
        );
        setFilteredCameras(camerasForSensorSize);
        
        // Reset downstream selections when sensor size changes
        setSelectedCamera('');
        setSelectedLens('');
      }
    } else {
      setFilteredCameras([]);
      setSelectedCamera('');
      setSelectedLens('');
    }
  }, [selectedSensorSize]);
  
  // Update filtered lenses when camera selection changes
  useEffect(() => {
    if (selectedCamera) {
      const camera = cameraLensData.cameras.find(cam => cam.id === selectedCamera);
      if (camera) {
        // Find lenses compatible with this camera based on brand and mount system
        const lensesForCamera = cameraLensData.lenses.filter(lens => {
          // First check if lens is compatible with camera's sensor type
          const sensorCompatible = lens.compatibleWith.includes(camera.sensorType);
          
          if (!sensorCompatible) return false;
          
          // Then check specific camera-lens compatibility based on brand and mount system
          if (camera.brand === 'Fujifilm') {
            if (camera.model.includes('GFX')) {
              // Fujifilm GFX cameras only work with Fujifilm GF lenses
              return lens.brand === 'Fujifilm' && lens.model.includes('GF');
            } else if (camera.model.includes('X-')) {
              // Fujifilm X series cameras work with XF lenses
              return lens.brand === 'Fujifilm' && lens.model.includes('XF');
            }
          } else if (camera.brand === 'DJI') {
            if (camera.model === 'P1') {
              // DJI P1 camera works with DJI P1 lenses - use a more permissive check
              // This checks if the lens is made by DJI and either has "P1" in the model name
              // or has "Full Frame" in compatibleWith array
              return lens.brand === 'DJI' && 
                     (lens.model.includes('P1') || 
                      (lens.compatibleWith && lens.compatibleWith.includes('Full Frame')));
            } else if (camera.model.includes('Mavic 3 Pro')) {
              // Mavic 3 Pro camera works with corresponding lenses
              return lens.brand === 'DJI' && (lens.model.includes('Mavic 3 Pro') || lens.model.includes('Mavic 3E'));
            } else if (camera.model.includes('Mavic 3 Classic') || camera.model.includes('Mavic 3 Enterprise')) {
              // Mavic 3 Classic/Enterprise work with Classic or Enterprise lenses
              return lens.brand === 'DJI' && (
                lens.model.includes('Mavic 3 Classic') || 
                lens.model.includes('Mavic 3E')
              );
            } else if (camera.model.includes('Mavic 2')) {
              // Mavic 2 cameras work with their specific lenses
              return lens.brand === 'DJI' && lens.model.includes(camera.model);
            }
            // Default for other DJI cameras
            return lens.brand === 'DJI' && lens.compatibleWith.includes(camera.sensorType);
          } else if (camera.brand === 'Canon') {
            if (camera.model.includes('EOS R')) {
              if (camera.sensorType === 'Full Frame') {
                // Canon EOS R full frame cameras work with RF lenses (not RF-S)
                return lens.brand === 'Canon' && lens.model.includes('RF') && !lens.model.includes('RF-S');
              } else if (camera.sensorType === 'APS-C') {
                // Canon EOS R APS-C cameras work with both RF and RF-S lenses
                return lens.brand === 'Canon' && lens.model.includes('RF');
              }
            }
          } else if (camera.brand === 'Blackmagic') {
            // Blackmagic cameras work with Canon RF and EF lenses
            return lens.brand === 'Canon' && (lens.model.includes('RF') || lens.model.includes('EF')) ||
                   // Blackmagic URSA 17K also works with DZOFilm Arles FF/VV lenses
                   (camera.model === 'URSA 17K' && lens.brand === 'DZOFilm' && lens.model.includes('Arles'));
          } else if (camera.brand === 'Sony') {
            if (camera.sensorType === 'Full Frame') {
              // Sony full frame cameras work with FE lenses
              return lens.brand === 'Sony' && lens.model.includes('FE');
            } else if (camera.sensorType === 'APS-C') {
              // Sony APS-C cameras work with both E and FE lenses
              return lens.brand === 'Sony' && (lens.model.includes('E ') || lens.model.includes('FE'));
            }
          } else if (camera.brand === 'Nikon') {
            // Filter Nikon lenses
            return lens.brand === 'Nikon';
          } else if (camera.brand === 'Panasonic' || camera.brand === 'Olympus') {
            // Micro Four Thirds system is shared between brands
            return lens.compatibleWith.includes('Micro Four Thirds');
          } else if (camera.brand === 'Hasselblad' || camera.brand === 'Phase One') {
            // Filter by medium format brand
            return lens.brand === camera.brand;
          } else if (camera.brand === 'Sinar') {
            // Large format lenses
            return lens.compatibleWith.includes('Large Format');
          }
          
          // Default fallback: match the camera brand with lens brand
          return lens.brand === camera.brand;
        });
        
        setFilteredLenses(lensesForCamera);
        
        // Reset lens selection when camera changes
        setSelectedLens('');
      }
    } else {
      setFilteredLenses([]);
      setSelectedLens('');
    }
  }, [selectedCamera]);
  
  // Calculate DOF when parameters change
  useEffect(() => {
    if (selectedCameraDetails && selectedLensDetails && focusDistance > 0 && selectedAperture) {
      const dofData = getDOFCalculations(
        focusDistance,
        selectedLensDetails.focalLength,
        selectedAperture,
        selectedCameraDetails.cropFactor
      );
      
      // Add focus distance to the calculation results
      setDofCalculations({
        ...dofData,
        focusDistance,
        fieldOfView: calculateFieldOfView(selectedLensDetails.focalLength, selectedCameraDetails.sensorWidth)
      });
    } else {
      setDofCalculations(null);
    }
  }, [selectedCameraDetails, selectedLensDetails, selectedAperture, focusDistance]);

  // Toggle between meters and feet
  const toggleDistanceUnit = () => {
    setDistanceUnit(distanceUnit === 'm' ? 'ft' : 'm');
  };

  // Format distance based on selected unit and handle effectively infinite distances
  const formatDistance = (meters, fixed = 1, focusDistanceRef = null) => {
    // Handle true infinity
    if (meters === Infinity) {
      return "∞";
    }
    
    // Handle effectively infinite distances
    if (focusDistanceRef && 
       (meters > INFINITY_DISPLAY_THRESHOLD * focusDistanceRef || meters > 1000)) {
      return "∞";
    }
    
    if (distanceUnit === 'ft') {
      const feet = metersToFeet(meters);
      return `${feet.toFixed(fixed)}ft`;
    }
    return `${meters.toFixed(fixed)}m`;
  };
  
  // Parse distance input that might include unit strings (e.g., "5m" or "10ft")
  const parseDistanceInput = (input) => {
    // Convert to string to ensure we can perform string operations
    const inputStr = String(input).trim().toLowerCase();
    
    // Regular expressions to match units
    const meterRegex = /^([\d.]+)\s*m$/;
    const feetRegex = /^([\d.]+)\s*ft$/;
    
    // Check if the input matches unit patterns
    const meterMatch = inputStr.match(meterRegex);
    if (meterMatch) {
      return { value: parseFloat(meterMatch[1]), unit: 'm' };
    }
    
    const feetMatch = inputStr.match(feetRegex);
    if (feetMatch) {
      return { value: parseFloat(feetMatch[1]), unit: 'ft' };
    }
    
    // Handle if user just typed in the unit without the suffix
    if (inputStr.endsWith('m')) {
      // Extract the number part and return as meters
      const value = parseFloat(inputStr.slice(0, -1));
      return { value, unit: 'm' };
    } else if (inputStr.endsWith('ft')) {
      // Extract the number part and return as feet
      const value = parseFloat(inputStr.slice(0, -2));
      return { value, unit: 'ft' };
    }
    
    // No unit specified, return just the value
    return { value: parseFloat(inputStr), unit: null };
  };

  // Handle distance input changes with unit conversion
  const handleDistanceChange = (value) => {
    // Parse the input which might include units
    const { value: numValue, unit } = parseDistanceInput(value);
    
    // If the input is not a valid number, don't update state
    if (isNaN(numValue)) return;
    
    // Enforce minimum value
    let distanceValue = Math.max(0.1, numValue);
    
    // Get the maximum value for validation
    const maxValue = distanceUnit === 'm' ? 100 : metersToFeet(100);
    
    // Ensure the value doesn't exceed the maximum
    distanceValue = Math.min(distanceValue, maxValue);
    
    // Process based on the unit provided or current unit setting
    if (unit === 'ft' || (unit === null && distanceUnit === 'ft')) {
      // Convert from feet to meters (the internal storage unit)
      setFocusDistance(feetToMeters(distanceValue));
    } else {
      // Already in meters
      setFocusDistance(distanceValue);
    }
  };
  
  // Generate slider track marks based on the current unit
  const generateTrackMarks = () => {
    const maxDistanceInCurrentUnit = distanceUnit === 'm' ? 100 : metersToFeet(100);
    const marks = [];
    
    if (distanceUnit === 'm') {
      // Marks in meters
      if (focusDistance <= 10) {
        // More granular marks for short distances
        for (let i = 1; i <= 10; i++) {
          marks.push({value: i, position: (i / 100) * 100});
        }
      } else if (focusDistance <= 30) {
        for (let i = 10; i <= 30; i += 10) {
          marks.push({value: i, position: (i / 100) * 100});
        }
      } else {
        for (let i = 20; i <= 100; i += 20) {
          marks.push({value: i, position: (i / 100) * 100});
        }
      }
    } else {
      // Marks in feet
      if (focusDistance <= feetToMeters(30)) {
        // More granular marks for short distances
        for (let i = 5; i <= 30; i += 5) {
          marks.push({value: i, position: (feetToMeters(i) / 100) * 100});
        }
      } else if (focusDistance <= feetToMeters(100)) {
        for (let i = 20; i <= 100; i += 20) {
          marks.push({value: i, position: (feetToMeters(i) / 100) * 100});
        }
      } else {
        for (let i = 50; i <= 320; i += 50) {
          marks.push({value: i, position: (feetToMeters(i) / 100) * 100});
        }
      }
    }
    
    return marks;
  };
  
  // Get the displayed value for the distance input
  const getDisplayedDistance = () => {
    if (!isFinite(focusDistance) || isNaN(focusDistance)) {
      return distanceUnit === 'ft' ? '0.1' : '0.1';
    }
    
    if (distanceUnit === 'ft') {
      // Convert meters to feet and format with appropriate precision
      const feetValue = metersToFeet(focusDistance);
      return feetValue >= 100 ? feetValue.toFixed(0) : feetValue.toFixed(1);
    } else {
      // Format meters with appropriate precision
      return focusDistance >= 100 ? focusDistance.toFixed(0) : focusDistance.toFixed(1);
    }
  };
  
  // Get the displayed max value for the range slider
  const getMaxDistanceValue = () => {
    return distanceUnit === 'm' ? 100 : metersToFeet(100);
  };
  
  // Get the displayed min value for the range slider
  const getMinDistanceValue = () => {
    return distanceUnit === 'm' ? 0.1 : metersToFeet(0.1);
  };
  
  // Get the step value for the slider
  const getStepValue = () => {
    return distanceUnit === 'm' ? 0.1 : 0.5;
  };
  
  return (
    <div className="dof-calculator">
      <div className="calculator-header">
        <h1>Photogrammetry Calculator</h1>
      </div>

      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="calculator-content">
        {activeTab === 'dof' && (
          <div className="dof-tab-content">
            {/* Left column - Camera Setup */}
            <div className="setup-column">
              <h2>Camera Setup</h2>
              <div className="calculator-inputs">
                <div className="input-group">
                  <div className="input-group">
                    <label htmlFor="sensor-size-select">Sensor Format:</label>
                    <select 
                      id="sensor-size-select" 
                      value={selectedSensorSize} 
                      onChange={(e) => setSelectedSensorSize(e.target.value)}
                    >
                      <option value="">Select Sensor Format</option>
                      {cameraLensData.sensorSizes.map(sensorSize => (
                        <option key={sensorSize.id} value={sensorSize.id}>
                          {sensorSize.name}
                        </option>
                      ))}
                    </select>
                    {!selectedSensorSize && (
                      <small className="form-tip">Select a sensor size to get started</small>
                    )}
                  </div>
                  
                  <div className="input-group">
                    <label htmlFor="camera-select">Camera Model:</label>
                    <select 
                      id="camera-select" 
                      value={selectedCamera} 
                      onChange={(e) => setSelectedCamera(e.target.value)}
                      disabled={!selectedSensorSize}
                    >
                      <option value="">Select Camera</option>
                      {filteredCameras.map(camera => (
                        <option key={camera.id} value={camera.id}>
                          {camera.brand} {camera.model}
                        </option>
                      ))}
                    </select>
                    {selectedSensorSize && !selectedCamera && filteredCameras.length > 0 && (
                      <small className="form-tip">{filteredCameras.length} cameras available</small>
                    )}
                  </div>
                  
                  <div className="input-group">
                    <label htmlFor="lens-select">Select Lens:</label>
                    <select 
                      id="lens-select" 
                      value={selectedLens} 
                      onChange={(e) => setSelectedLens(e.target.value)}
                      disabled={!selectedCamera}
                    >
                      <option value="">Select Lens</option>
                      {filteredLenses.map(lens => (
                        <option key={lens.id} value={lens.id}>
                          {lens.model.includes("Mavic 2 Zoom") 
                            ? `${lens.model} (Zoom range: 24-48mm)` 
                            : `${lens.model} (${lens.focalLength}mm f/${lens.maxAperture})`}
                        </option>
                      ))}
                    </select>
                    {selectedCamera && !selectedLens && filteredLenses.length > 0 && (
                      <small className="form-tip">{filteredLenses.length} compatible lenses</small>
                    )}
                  </div>
                </div>
                
                <div className="input-section">
                  <h3>Camera Settings</h3>
                  <div className="input-group">
                    <label htmlFor="aperture-select">F-Stop:</label>
                    <select 
                      id="aperture-select" 
                      value={selectedAperture} 
                      onChange={(e) => setSelectedAperture(Number(e.target.value))}
                      disabled={!selectedLens}
                    >
                      {selectedLensDetails ? (
                        cameraLensData.apertures
                          .filter(ap => ap >= selectedLensDetails.maxAperture && ap <= selectedLensDetails.minAperture)
                          .map(aperture => (
                            <option key={aperture} value={aperture}>
                              f/{aperture}
                            </option>
                          ))
                      ) : (
                        <option value="">Select a lens first</option>
                      )}
                    </select>
                    {selectedLensDetails && (
                      <small className="form-tip">Lens range: f/{selectedLensDetails.maxAperture} to f/{selectedLensDetails.minAperture}</small>
                    )}
                  </div>
                  
                  <div className="input-group distance-input">
                    <label htmlFor="focus-distance">Subject Distance:</label>
                    <div className="range-value">
                      <input 
                        type="number" 
                        min={getMinDistanceValue()}
                        max={getMaxDistanceValue()}
                        step={getStepValue()}
                        value={getDisplayedDistance()}
                        onChange={(e) => handleDistanceChange(e.target.value)}
                        onBlur={(e) => {
                          // When input loses focus, ensure value is within range
                          const { value: numValue, unit } = parseDistanceInput(e.target.value);
                          if (!isNaN(numValue)) {
                            const minValue = getMinDistanceValue();
                            const maxValue = getMaxDistanceValue();
                            
                            // Convert value to current display unit if a different unit was specified
                            let displayValue = numValue;
                            if (unit === 'ft' && distanceUnit === 'm') {
                              displayValue = feetToMeters(numValue);
                            } else if (unit === 'm' && distanceUnit === 'ft') {
                              displayValue = metersToFeet(numValue);
                            }
                            
                            // Validate and adjust value if needed
                            if (displayValue < minValue) {
                              handleDistanceChange(minValue);
                            } else if (displayValue > maxValue) {
                              handleDistanceChange(maxValue);
                            } else if (unit) {
                              // If a unit was specified, make sure to handle it properly
                              handleDistanceChange(e.target.value);
                            }
                          }
                        }}
                        disabled={!selectedLens}
                      />
                      <span onClick={toggleDistanceUnit} title="Click to toggle units">
                        {distanceUnit}
                      </span>
                    </div>
                    
                    <div className="range-track">
                      <input 
                        type="range" 
                        id="focus-distance" 
                        min={getMinDistanceValue()}
                        max={getMaxDistanceValue()}
                        step={getStepValue()}
                        value={distanceUnit === 'm' ? focusDistance : metersToFeet(focusDistance)}
                        onChange={(e) => handleDistanceChange(e.target.value)}
                        disabled={!selectedLens}
                      />
                      <div className="track-marks">
                        {generateTrackMarks().map((mark, index) => (
                          <div 
                            key={index} 
                            className="track-mark" 
                            style={{ left: `${mark.position}%` }}
                            title={`${mark.value}${distanceUnit}`}
                          />
                        ))}
                      </div>
                    </div>
                    {selectedLens && (
                      <small className="form-tip">
                        {distanceUnit === 'm' 
                          ? `Range: 0.1m to 100m (${metersToFeet(0.1).toFixed(1)}ft to ${metersToFeet(100).toFixed(1)}ft)` 
                          : `Range: ${metersToFeet(0.1).toFixed(1)}ft to ${metersToFeet(100).toFixed(1)}ft (0.1m to 100m)`}
                      </small>
                    )}
                  </div>
                  
                  {selectedCameraDetails && selectedLensDetails && (
                    <div className="selected-equipment">
                      <div className="equipment-badge">
                        <span className="badge-label">Camera:</span>
                        <span className="badge-value">{selectedCameraDetails.brand} {selectedCameraDetails.model}</span>
                      </div>
                      <div className="equipment-badge">
                        <span className="badge-label">Sensor:</span>
                        <span className="badge-value">{selectedCameraDetails.megapixels}MP</span>
                      </div>
                      <div className="equipment-badge">
                        <span className="badge-label">Lens:</span>
                        <span className="badge-value">{selectedLensDetails.focalLength}mm @ f/{selectedAperture}</span>
                      </div>
                      {validatePixelDensity(selectedCameraDetails).message && (
                        <div className="equipment-badge warning">
                          <span className="badge-value">{validatePixelDensity(selectedCameraDetails).message}</span>
                        </div>
                      )}
                      <div className="equipment-badge logo-container">
                        <SkunkworksLogo />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right column - Results */}
            <div className="results-column">
              <div className="calculator-results-container">
                {dofCalculations ? (
                  <div className="dof-results-section">
                    <h2>Depth of Field Results</h2>
                    <div className="visualization-container">
                      <DOFVisualization 
                        dofData={dofCalculations} 
                        distanceUnit={distanceUnit} 
                        fieldOfView={calculateFieldOfView(selectedLensDetails?.focalLength, selectedCameraDetails?.sensorWidth)}
                        groundCoverage={getGroundCoverageValues(dofCalculations.focusDistance, selectedLensDetails?.focalLength, selectedCameraDetails)}
                      />
                    </div>
                    
                    <div className="results-grid">
                      <div className="result-card">
                        <h3>Focus Distance</h3>
                        <p>{formatDistance(dofCalculations.focusDistance, 1)}</p>
                        {distanceUnit === 'ft' && <small>({dofCalculations.focusDistance.toFixed(1)}m)</small>}
                        {distanceUnit === 'm' && <small>({metersToFeet(dofCalculations.focusDistance).toFixed(1)}ft)</small>}
                      </div>
                      
                      <div className="result-card">
                        <h3>Near Limit</h3>
                        <p>{formatDistance(dofCalculations.nearLimit, 1)}</p>
                      </div>
                      
                      <div className="result-card">
                        <h3>Far Limit</h3>
                        <p>
                          {formatDistance(dofCalculations.farLimit, 1, dofCalculations.focusDistance)}
                        </p>
                      </div>
                      
                      <div className="result-card">
                        <h3>Total DOF</h3>
                        <p>
                          {formatDistance(dofCalculations.totalDOF, 1, dofCalculations.focusDistance)}
                        </p>
                      </div>
                      
                      <div className="result-card">
                        <h3>Field of View</h3>
                        <p>{calculateFieldOfView(selectedLensDetails?.focalLength, selectedCameraDetails?.sensorWidth).toFixed(1)}°</p>
                      </div>
                      
                      <div className="result-card">
                        <h3>Ground Coverage</h3>
                        <p>{getGroundCoverage(dofCalculations.focusDistance, selectedLensDetails?.focalLength, selectedCameraDetails)}</p>
                      </div>
                      
                      <div className="result-card">
                        <h3>GSD</h3>
                        <p>{calculateGSD(
                          dofCalculations.focusDistance,
                          selectedLensDetails?.focalLength,
                          selectedCameraDetails
                        )}</p>
                        <small>Ground Sample Distance</small>
                        {calculateGSD(
                          dofCalculations.focusDistance,
                          selectedLensDetails?.focalLength,
                          selectedCameraDetails
                        ) && (
                          <div className="gsd-explanation">
                            {getGSDValue(
                              dofCalculations.focusDistance,
                              selectedLensDetails?.focalLength,
                              selectedCameraDetails
                            ) < 3 ? (
                              <small className="gsd-quality high">High detail capture</small>
                            ) : getGSDValue(
                              dofCalculations.focusDistance,
                              selectedLensDetails?.focalLength,
                              selectedCameraDetails
                            ) < 10 ? (
                              <small className="gsd-quality medium">Good for most applications</small>
                            ) : (
                              <small className="gsd-quality low">Lower resolution capture</small>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="dof-actions">
                      <button 
                        className="action-button"
                        onClick={() => setActiveTab('photogrammetry')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        Plan Photogrammetry with These Settings
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-content">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 9c0-1.5 1-2 2-2.5C8.5 5.5 9.5 5 10.5 5c2.5 0 2.5 2 4.5 2 1 0 2-.5 2.5-1"></path>
                        <path d="M22 19c0 1-1 2-2 2H4c-1 0-2-1-2-2v-3c0-1 1-2 2-2h16c1 0 2 1 2 2v3z"></path>
                        <path d="M10 2v8.3"></path>
                        <path d="M14 2v8.3"></path>
                        <path d="M18 8.5a4 4 0 0 0-8 0"></path>
                        <path d="M7 15a3.5 3.5 0 0 1 5 0 3.5 3.5 0 0 0 5 0"></path>
                      </svg>
                      <p>Select your camera and lens to calculate depth of field</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'photogrammetry' && (
          <div className="photogrammetry-tab">
            <h2>Photogrammetry Planning</h2>
            {dofCalculations ? (
              <>
                <div className="equipment-summary-bar">
                  <div className="equipment-summary-item">
                    <span className="summary-label">Camera:</span>
                    <span className="summary-value">{selectedCameraDetails.brand} {selectedCameraDetails.model}</span>
                  </div>
                  <div className="equipment-summary-item">
                    <span className="summary-label">Lens:</span>
                    <span className="summary-value">{selectedLensDetails.focalLength}mm @ f/{selectedAperture}</span>
                  </div>
                  <div className="equipment-summary-item">
                    <span className="summary-label">Focus Distance:</span>
                    <span className="summary-value">{formatDistance(dofCalculations.focusDistance, 1)}</span>
                  </div>
                  <div className="equipment-summary-item">
                    <span className="summary-label">Ground Coverage:</span>
                    <span className="summary-value">{getGroundCoverage(dofCalculations.focusDistance, selectedLensDetails?.focalLength, selectedCameraDetails)}</span>
                  </div>
                  <button 
                    className="back-to-dof-button"
                    onClick={() => setActiveTab('dof')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Back to DOF Calculator
                  </button>
                </div>
                <PhotogrammetryPlanner 
                  groundCoverage={getGroundCoverage(dofCalculations.focusDistance, selectedLensDetails?.focalLength, selectedCameraDetails)}
                  distanceUnit={distanceUnit}
                  cameraDetails={selectedCameraDetails}
                  lensDetails={selectedLensDetails}
                  aperture={selectedAperture}
                  focusDistance={dofCalculations.focusDistance}
                />
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-content">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  <p>Set up camera and lens in the Depth of Field tab first to enable photogrammetry planning</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'scenePreview' && (
          <div className="scene-preview-tab">
            {dofCalculations ? (
              <ScenePreview 
                dofCalculations={dofCalculations}
                cameraDetails={selectedCameraDetails}
                lensDetails={selectedLensDetails}
                distanceUnit={distanceUnit}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-state-content">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                    <line x1="7" y1="2" x2="7" y2="22"></line>
                    <line x1="17" y1="2" x2="17" y2="22"></line>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <line x1="2" y1="7" x2="7" y2="7"></line>
                    <line x1="2" y1="17" x2="7" y2="17"></line>
                    <line x1="17" y1="17" x2="22" y2="17"></line>
                    <line x1="17" y1="7" x2="22" y2="7"></line>
                  </svg>
                  <p>Set up camera and lens in the Depth of Field tab first to enable scene preview</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to calculate approximate field of view (horizontal)
function calculateFieldOfView(focalLength, sensorWidth) {
  if (!focalLength || !sensorWidth) return 0;
  // FOV = 2 * arctan(sensor width / (2 * focal length))
  return 2 * Math.atan(sensorWidth / (2 * focalLength)) * (180 / Math.PI);
}

// Helper function to calculate ground coverage
function getGroundCoverage(distance, focalLength, cameraDetails) {
  if (!distance || !focalLength || !cameraDetails) return "N/A";
  
  const { sensorWidth, sensorHeight } = cameraDetails;
  
  // Convert mm to m for focal length
  const focalLengthM = focalLength / 1000;
  
  // Convert mm to m for sensor dimensions
  const sensorWidthM = sensorWidth / 1000;
  const sensorHeightM = sensorHeight / 1000;
  
  // Calculate width and height of field of view at the given distance
  const width = (distance * sensorWidthM) / focalLengthM;
  const height = (distance * sensorHeightM) / focalLengthM;
  
  // Return formatted string with both width and height
  return `${(width * 3.28084).toFixed(1)} × ${(height * 3.28084).toFixed(1)}ft`;
}

// Helper function to get raw ground coverage values for visualization
function getGroundCoverageValues(distance, focalLength, cameraDetails) {
  if (!distance || !focalLength || !cameraDetails) return { width: 0, height: 0 };
  
  const { sensorWidth, sensorHeight } = cameraDetails;
  
  // Convert mm to m for focal length
  const focalLengthM = focalLength / 1000;
  
  // Convert mm to m for sensor dimensions
  const sensorWidthM = sensorWidth / 1000;
  const sensorHeightM = sensorHeight / 1000;
  
  // Calculate width and height of field of view at the given distance
  const width = (distance * sensorWidthM) / focalLengthM;
  const height = (distance * sensorHeightM) / focalLengthM;
  
  return { width, height };
}

// Helper function to calculate Ground Sample Distance (GSD)
function calculateGSD(distance, focalLength, cameraDetails) {
  if (!distance || !focalLength || !cameraDetails) return null;
  
  const { sensorWidth, imageWidth } = cameraDetails;
  
  // Convert meters to mm for distance
  const distanceMM = distance * 1000;
  
  // Calculate pixel size in mm (physical size of each pixel on sensor)
  const pixelSizeMM = sensorWidth / imageWidth;
  
  // GSD = (Pixel Size × Distance) / Focal Length
  const gsdMM = (pixelSizeMM * distanceMM) / focalLength;
  
  // Calculate error bounds (±5% for professional applications)
  const errorMargin = gsdMM * 0.05;
  const lowerBound = gsdMM - errorMargin;
  const upperBound = gsdMM + errorMargin;
  
  // Format based on value
  if (gsdMM < 10) {
    return `${gsdMM.toFixed(2)} mm/pixel (±${errorMargin.toFixed(2)})`;
  } else {
    return `${(gsdMM / 10).toFixed(2)} cm/pixel (±${(errorMargin / 10).toFixed(2)})`;
  }
}

// Helper function to get raw GSD value in mm for comparisons
function getGSDValue(distance, focalLength, cameraDetails) {
  if (!distance || !focalLength || !cameraDetails) return 0;
  
  const { sensorWidth, imageWidth } = cameraDetails;
  
  // Convert meters to mm for distance
  const distanceMM = distance * 1000;
  
  // Calculate pixel size in mm (physical size of each pixel on sensor)
  const pixelSizeMM = sensorWidth / imageWidth;
  
  // GSD = (Pixel Size × Distance) / Focal Length
  return (pixelSizeMM * distanceMM) / focalLength;
}

// Helper function to validate pixel density against expected values
function validatePixelDensity(cameraDetails) {
  if (!cameraDetails) return { valid: true, message: '' };
  
  const { sensorWidth, sensorHeight, imageWidth, imageHeight, megapixels } = cameraDetails;
  
  // Calculate expected megapixels based on image dimensions
  const calculatedMegapixels = (imageWidth * imageHeight) / 1000000;
  
  // Check if the calculated megapixels match the stated megapixels
  const megapixelDifference = Math.abs(calculatedMegapixels - megapixels);
  
  // Calculate pixel density in pixels per mm
  const pixelDensityWidth = imageWidth / sensorWidth;
  const pixelDensityHeight = imageHeight / sensorHeight;
  
  // Check if pixel density is consistent across width and height
  const densityDifferencePercent = Math.abs((pixelDensityWidth - pixelDensityHeight) / pixelDensityWidth) * 100;
  
  // Valid if megapixel difference is within 1% and density difference is within 5%
  const valid = megapixelDifference < (megapixels * 0.01) && densityDifferencePercent < 5;
  
  return {
    valid,
    megapixelDifference,
    densityDifferencePercent,
    message: valid ? '' : 'Warning: Pixel dimensions may not match sensor size'
  };
}

export default DOFCalculator; 