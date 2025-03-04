/**
 * DOF (Depth of Field) calculation utility functions
 */

/**
 * Calculate the hyperfocal distance
 * @param {number} focalLength - Focal length in mm
 * @param {number} aperture - Aperture f-number (e.g., 2.8, 5.6)
 * @param {number} circleOfConfusion - Circle of confusion in mm (typically 0.03 for full frame)
 * @returns {number} Hyperfocal distance in meters
 */
export const calculateHyperfocalDistance = (focalLength, aperture, circleOfConfusion) => {
  return (focalLength * focalLength) / (aperture * circleOfConfusion) / 1000;
};

/**
 * Calculate the circle of confusion based on sensor size
 * Full frame standard is 0.03mm, scaled by crop factor for smaller sensors
 * @param {number} cropFactor - Sensor crop factor (1 for full frame, 1.5-1.6 for APS-C, 2 for micro 4/3)
 * @returns {number} Circle of confusion in mm
 */
export const calculateCircleOfConfusion = (cropFactor) => {
  // 0.03mm is the standard for full frame (35mm)
  return 0.03 / cropFactor;
};

/**
 * Calculate the near limit of depth of field
 * @param {number} focusDistance - Focus distance in meters
 * @param {number} focalLength - Focal length in mm
 * @param {number} aperture - Aperture f-number
 * @param {number} circleOfConfusion - Circle of confusion in mm
 * @returns {number} Near limit distance in meters
 */
export const calculateNearLimit = (focusDistance, focalLength, aperture, circleOfConfusion) => {
  const hyperfocal = calculateHyperfocalDistance(focalLength, aperture, circleOfConfusion);
  return (focusDistance * (hyperfocal - focalLength / 1000)) / 
         (hyperfocal + focusDistance - 2 * (focalLength / 1000));
};

/**
 * Calculate the far limit of depth of field
 * @param {number} focusDistance - Focus distance in meters
 * @param {number} focalLength - Focal length in mm
 * @param {number} aperture - Aperture f-number
 * @param {number} circleOfConfusion - Circle of confusion in mm
 * @returns {number} Far limit distance in meters, Infinity if beyond hyperfocal
 */
export const calculateFarLimit = (focusDistance, focalLength, aperture, circleOfConfusion) => {
  const hyperfocal = calculateHyperfocalDistance(focalLength, aperture, circleOfConfusion);
  
  if (focusDistance >= hyperfocal) {
    return Infinity;
  }
  
  return (focusDistance * (hyperfocal - focalLength / 1000)) / 
         (hyperfocal - focusDistance);
};

/**
 * Calculate the total depth of field
 * @param {number} nearLimit - Near limit in meters
 * @param {number} farLimit - Far limit in meters
 * @returns {number} Total depth of field in meters (Infinity if far limit is Infinity)
 */
export const calculateTotalDOF = (nearLimit, farLimit) => {
  if (farLimit === Infinity) {
    return Infinity;
  }
  return farLimit - nearLimit;
};

/**
 * Get all depth of field calculations in one function
 * @param {number} focusDistance - Focus distance in meters
 * @param {number} focalLength - Focal length in mm
 * @param {number} aperture - Aperture f-number
 * @param {number} cropFactor - Sensor crop factor
 * @returns {Object} Object containing all DOF calculations
 */
export const getDOFCalculations = (focusDistance, focalLength, aperture, cropFactor) => {
  const coc = calculateCircleOfConfusion(cropFactor);
  const hyperfocal = calculateHyperfocalDistance(focalLength, aperture, coc);
  const nearLimit = calculateNearLimit(focusDistance, focalLength, aperture, coc);
  const farLimit = calculateFarLimit(focusDistance, focalLength, aperture, coc);
  const totalDOF = calculateTotalDOF(nearLimit, farLimit);
  
  return {
    hyperfocal,
    nearLimit,
    farLimit,
    totalDOF,
    inFocus: farLimit === Infinity ? "From " + nearLimit.toFixed(2) + "m to infinity" : 
             "From " + nearLimit.toFixed(2) + "m to " + farLimit.toFixed(2) + "m"
  };
};

/**
 * Alternative function to calculate DOF using sensor dimensions directly
 * @param {number} focalLengthMM - Focal length in mm
 * @param {number} aperture - Aperture f-number
 * @param {number} focusDistanceM - Focus distance in meters
 * @param {number} sensorWidthMM - Sensor width in mm
 * @param {number} sensorHeightMM - Sensor height in mm
 * @returns {Object} Object containing DOF calculations
 */
export const calculateDOF = (focalLengthMM, aperture, focusDistanceM, sensorWidthMM, sensorHeightMM) => {
  // Calculate diagonal of sensor (used for circle of confusion)
  const sensorDiagonal = Math.sqrt(sensorWidthMM * sensorWidthMM + sensorHeightMM * sensorHeightMM);
  
  // Calculate crop factor relative to full frame (36mm × 24mm)
  const fullFrameDiagonal = Math.sqrt(36 * 36 + 24 * 24);
  const cropFactor = fullFrameDiagonal / sensorDiagonal;
  
  // Calculate circle of confusion (CoC) based on sensor diagonal
  const coc = calculateCircleOfConfusion(cropFactor);
  
  // Calculate hyperfocal distance
  const hyperfocal = calculateHyperfocalDistance(focalLengthMM, aperture, coc);
  
  // Calculate near and far limits
  const nearLimit = calculateNearLimit(focusDistanceM, focalLengthMM, aperture, coc);
  const farLimit = calculateFarLimit(focusDistanceM, focalLengthMM, aperture, coc);
  
  // Calculate total depth of field
  const totalDOF = calculateTotalDOF(nearLimit, farLimit);
  
  return {
    hyperfocal,
    nearLimit,
    farLimit,
    totalDOF
  };
}; 