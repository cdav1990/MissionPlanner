/**
 * Depth of Field Calculator Utility
 * Calculates depth of field parameters for photography based on camera and lens settings
 */

/**
 * Convert aperture f-stop to a numeric value
 * @param {string|number} aperture - The aperture value (e.g., "f/2.8", 2.8)
 * @returns {number} - The numeric aperture value
 */
function parseAperture(aperture) {
  if (typeof aperture === 'number') return aperture;
  // Handle string format like "f/2.8" or "F2.8"
  const match = aperture.toString().match(/[fF]\/?([\d.]+)/);
  return match ? parseFloat(match[1]) : parseFloat(aperture);
}

/**
 * Calculate the hyperfocal distance
 * @param {number} focalLength - Focal length in mm
 * @param {number} aperture - Aperture f-stop value (e.g., 2.8)
 * @param {number} circleOfConfusion - Circle of confusion in mm
 * @returns {number} - Hyperfocal distance in meters
 */
function calculateHyperfocalDistance(focalLength, aperture, circleOfConfusion) {
  // Hyperfocal Distance = (focal length² / (aperture × circle of confusion)) + focal length
  const focalLengthMeters = focalLength / 1000; // Convert mm to meters
  const apertureValue = parseAperture(aperture);
  const cocMeters = circleOfConfusion / 1000; // Convert mm to meters
  
  return (Math.pow(focalLengthMeters, 2) / (apertureValue * cocMeters)) + focalLengthMeters;
}

/**
 * Calculate the circle of confusion based on sensor size
 * @param {number} sensorWidth - Sensor width in mm
 * @param {string} format - Sensor format (e.g., 'Full Frame', 'APS-C')
 * @returns {number} - Circle of confusion in mm
 */
function calculateCircleOfConfusion(sensorWidth, format) {
  // Default to the common rule of dividing sensor width by 1500
  // For full-frame (35mm), this gives approximately 0.03mm
  if (format === 'Medium Format') {
    return sensorWidth / 1500;
  } else if (format === 'Full Frame' || sensorWidth >= 35) {
    return 0.03; // Standard for 35mm full-frame
  } else if (format === 'APS-C' || (sensorWidth >= 20 && sensorWidth < 35)) {
    return 0.02; // Standard for APS-C
  } else if (format === 'Micro Four Thirds' || (sensorWidth >= 15 && sensorWidth < 20)) {
    return 0.015; // For MFT
  } else if (sensorWidth > 0) {
    return sensorWidth / 1500; // General calculation
  }
  
  // Fallback to a typical full-frame value if no parameters are provided
  return 0.03;
}

/**
 * Calculate near and far points of acceptable sharpness
 * @param {number} focusDistance - Focus distance in meters
 * @param {number} hyperfocalDistance - Hyperfocal distance in meters
 * @param {number} focalLength - Focal length in mm
 * @returns {Object} - Object containing near and far distances in meters
 */
function calculateNearFarPoints(focusDistance, hyperfocalDistance, focalLength) {
  const focalLengthMeters = focalLength / 1000; // Convert mm to meters
  
  // If focus distance is beyond hyperfocal, everything from half hyperfocal to infinity is in focus
  if (focusDistance >= hyperfocalDistance) {
    return {
      nearPoint: hyperfocalDistance / 2,
      farPoint: Infinity
    };
  }
  
  // Calculate near point
  // Near = (hyperfocal × focus) / (hyperfocal + (focus - focal length))
  const nearPoint = (hyperfocalDistance * focusDistance) / 
                    (hyperfocalDistance + (focusDistance - focalLengthMeters));
  
  // Calculate far point
  // Far = (hyperfocal × focus) / (hyperfocal - (focus - focal length))
  let farPoint;
  const denominator = hyperfocalDistance - (focusDistance - focalLengthMeters);
  
  if (denominator <= 0) {
    farPoint = Infinity; // Focus is at or beyond hyperfocal distance
  } else {
    farPoint = (hyperfocalDistance * focusDistance) / denominator;
  }
  
  return { nearPoint, farPoint };
}

/**
 * Calculate depth of field
 * @param {Object} camera - Camera information
 * @param {Object} lens - Lens information
 * @param {number} aperture - Aperture f-stop value
 * @param {number} focusDistance - Focus distance in meters
 * @returns {Object} - Depth of field information
 */
function calculateDepthOfField(camera, lens, aperture, focusDistance) {
  // Handle missing parameters
  if (!camera || !lens || !aperture || !focusDistance) {
    return {
      hyperfocalDistance: 0,
      nearPoint: 0,
      farPoint: 0,
      depthOfField: 0,
      inFrontOfSubject: 0,
      behindSubject: 0
    };
  }
  
  // Get required parameters
  const focalLength = lens.focalLength || 50; // Default to 50mm
  const sensorWidth = camera.sensorWidth || 36; // Default to full-frame width
  const sensorFormat = camera.sensorType || 'Full Frame';
  const apertureValue = parseAperture(aperture);
  
  // Calculate circle of confusion
  const coc = calculateCircleOfConfusion(sensorWidth, sensorFormat);
  
  // Calculate hyperfocal distance
  const hyperfocalDistance = calculateHyperfocalDistance(focalLength, apertureValue, coc);
  
  // Calculate near and far points
  const { nearPoint, farPoint } = calculateNearFarPoints(focusDistance, hyperfocalDistance, focalLength);
  
  // Calculate total depth of field
  const depthOfField = farPoint === Infinity ? Infinity : farPoint - nearPoint;
  
  // Calculate how much of the depth of field is in front of and behind the subject
  const inFrontOfSubject = focusDistance - nearPoint;
  const behindSubject = farPoint === Infinity ? Infinity : farPoint - focusDistance;
  
  return {
    hyperfocalDistance,
    nearPoint,
    farPoint,
    depthOfField,
    inFrontOfSubject,
    behindSubject,
    circleOfConfusion: coc,
    focalLength,
    aperture: apertureValue,
    focusDistance
  };
}

// Export the main function and helper functions for testing
export default calculateDepthOfField;
export {
  parseAperture,
  calculateCircleOfConfusion,
  calculateHyperfocalDistance,
  calculateNearFarPoints
}; 