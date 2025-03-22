/**
 * CoordinateTransform.js
 * Utility for transforming between local coordinate system (feet) and global
 * geographic coordinates (WGS84 - latitude, longitude, altitude)
 */

import * as THREE from 'three';

/**
 * TransformUtility class handles conversions between local and global coordinate systems
 */
export class TransformUtility {
  /**
   * Constructor for the transform utility
   * @param {Object} options - Configuration options
   * @param {Object} options.origin - WGS84 coordinates of the local origin (0,0,0)
   * @param {number} options.origin.lat - Latitude in degrees
   * @param {number} options.origin.lon - Longitude in degrees  
   * @param {number} options.origin.alt - Altitude in meters above WGS84 ellipsoid
   * @param {number} options.heading - Heading angle in degrees between local Y axis and true north (clockwise from north)
   * @param {boolean} options.useEllipsoidalModel - Whether to use ellipsoidal earth model (true) or flat earth (false)
   */
  constructor(options = {}) {
    // Set default values if not provided
    this.origin = options.origin || { lat: 0, lon: 0, alt: 0 };
    this.heading = options.heading || 0;
    this.useEllipsoidalModel = options.useEllipsoidalModel !== undefined ? options.useEllipsoidalModel : true;
    
    // Constants for coordinate conversion
    this.FEET_TO_METERS = 0.3048;
    this.METERS_TO_FEET = 3.28084;
    
    // Earth model constants
    this.EARTH_RADIUS_METERS = 6378137.0; // WGS84 semi-major axis in meters
    this.EARTH_FLATTENING = 1/298.257223563; // WGS84 flattening parameter
    this.EARTH_ECCENTRICITY_SQ = 2 * this.EARTH_FLATTENING - Math.pow(this.EARTH_FLATTENING, 2);
    
    // Calculate the length of one degree of latitude and longitude at the origin
    this._calculateScaleFactors();
    
    // Create a rotation matrix to handle the heading offset
    this._createRotationMatrix();
  }
  
  /**
   * Calculate scale factors for lat/lon to meters conversion at the origin
   * These values vary with latitude due to the ellipsoidal earth model
   * @private
   */
  _calculateScaleFactors() {
    const latRad = this.origin.lat * Math.PI / 180.0;
    const cosLat = Math.cos(latRad);
    
    // Calculate meridional radius of curvature (north-south)
    const latScale = this.EARTH_RADIUS_METERS * (1 - this.EARTH_ECCENTRICITY_SQ) / 
                    Math.pow(1 - this.EARTH_ECCENTRICITY_SQ * Math.pow(Math.sin(latRad), 2), 1.5);
    
    // Calculate transverse radius of curvature (east-west)
    const lonScale = this.EARTH_RADIUS_METERS * cosLat / 
                    Math.sqrt(1 - this.EARTH_ECCENTRICITY_SQ * Math.pow(Math.sin(latRad), 2));
    
    // Store meters per degree at this latitude
    this.metersPerDegLat = (Math.PI / 180.0) * latScale;
    this.metersPerDegLon = (Math.PI / 180.0) * lonScale;
  }
  
  /**
   * Create a rotation matrix for heading adjustment
   * @private
   */
  _createRotationMatrix() {
    // Convert heading from degrees to radians
    const headingRad = this.heading * Math.PI / 180.0;
    
    // Create a rotation matrix using THREE.js
    this.rotationMatrix = new THREE.Matrix4().makeRotationZ(-headingRad);
    this.inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(headingRad);
  }
  
  /**
   * Set or update the origin of the local coordinate system
   * @param {Object} origin - WGS84 coordinates of the local origin
   * @param {number} origin.lat - Latitude in degrees
   * @param {number} origin.lon - Longitude in degrees
   * @param {number} origin.alt - Altitude in meters above WGS84 ellipsoid
   */
  setOrigin(origin) {
    this.origin = origin;
    this._calculateScaleFactors();
  }
  
  /**
   * Set or update the heading angle between local Y axis and true north
   * @param {number} heading - Heading angle in degrees (clockwise from north)
   */
  setHeading(heading) {
    this.heading = heading;
    this._createRotationMatrix();
  }
  
  /**
   * Convert local coordinates to global WGS84 coordinates
   * @param {number} x_local - X coordinate in local system (feet, east-west)
   * @param {number} y_local - Y coordinate in local system (feet, north-south)
   * @param {number} z_local - Z coordinate in local system (feet, altitude)
   * @returns {Object} Object containing lat, lon, alt in WGS84 system
   */
  localToGlobal(x_local, y_local, z_local) {
    // Convert from feet to meters
    const x_meters = x_local * this.FEET_TO_METERS;
    const y_meters = y_local * this.FEET_TO_METERS;
    const z_meters = z_local * this.FEET_TO_METERS;
    
    // Apply heading rotation to account for local coordinate system orientation
    const rotatedPoint = new THREE.Vector3(x_meters, y_meters, z_meters);
    rotatedPoint.applyMatrix4(this.rotationMatrix);
    
    // Use the scale factors to convert to lat/lon degrees
    let lat, lon, alt;
    
    if (this.useEllipsoidalModel) {
      // More accurate ellipsoidal earth model
      lat = this.origin.lat + (rotatedPoint.y / this.metersPerDegLat);
      lon = this.origin.lon + (rotatedPoint.x / this.metersPerDegLon);
      alt = this.origin.alt + rotatedPoint.z;
    } else {
      // Simplified flat earth approximation
      lat = this.origin.lat + (rotatedPoint.y / this.metersPerDegLat);
      lon = this.origin.lon + (rotatedPoint.x / this.metersPerDegLon);
      alt = this.origin.alt + rotatedPoint.z;
    }
    
    return { lat, lon, alt };
  }
  
  /**
   * Convert global WGS84 coordinates to local coordinates
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @param {number} alt - Altitude in meters above WGS84 ellipsoid
   * @returns {Object} Object containing x, y, z in local system (feet)
   */
  globalToLocal(lat, lon, alt) {
    // Calculate meters from origin using the scale factors
    let x_meters, y_meters, z_meters;
    
    if (this.useEllipsoidalModel) {
      // More accurate ellipsoidal earth model
      y_meters = (lat - this.origin.lat) * this.metersPerDegLat;
      x_meters = (lon - this.origin.lon) * this.metersPerDegLon;
      z_meters = alt - this.origin.alt;
    } else {
      // Simplified flat earth approximation
      y_meters = (lat - this.origin.lat) * this.metersPerDegLat;
      x_meters = (lon - this.origin.lon) * this.metersPerDegLon;
      z_meters = alt - this.origin.alt;
    }
    
    // Create point in meters
    const point = new THREE.Vector3(x_meters, y_meters, z_meters);
    
    // Apply inverse rotation to account for heading
    point.applyMatrix4(this.inverseRotationMatrix);
    
    // Convert from meters to feet
    const x_local = point.x * this.METERS_TO_FEET;
    const y_local = point.y * this.METERS_TO_FEET;
    const z_local = point.z * this.METERS_TO_FEET;
    
    return { x: x_local, y: y_local, z: z_local };
  }
  
  /**
   * Get the rotation matrix for this transformation
   * Useful for rotating vectors (like wind direction) between coordinate systems
   * @returns {THREE.Matrix4} The rotation matrix
   */
  getRotationMatrix() {
    return this.rotationMatrix.clone();
  }
  
  /**
   * Get the inverse rotation matrix for this transformation
   * @returns {THREE.Matrix4} The inverse rotation matrix
   */
  getInverseRotationMatrix() {
    return this.inverseRotationMatrix.clone();
  }
  
  /**
   * Calculate the great circle distance between two global coordinates
   * @param {number} lat1 - Latitude of first point in degrees
   * @param {number} lon1 - Longitude of first point in degrees
   * @param {number} lat2 - Latitude of second point in degrees
   * @param {number} lon2 - Longitude of second point in degrees
   * @returns {number} Distance in meters
   */
  getGreatCircleDistance(lat1, lon1, lat2, lon2) {
    const lat1Rad = lat1 * Math.PI / 180.0;
    const lon1Rad = lon1 * Math.PI / 180.0;
    const lat2Rad = lat2 * Math.PI / 180.0;
    const lon2Rad = lon2 * Math.PI / 180.0;
    
    // Haversine formula
    const dLat = lat2Rad - lat1Rad;
    const dLon = lon2Rad - lon1Rad;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = this.EARTH_RADIUS_METERS * c;
    
    return distance;
  }
  
  /**
   * Calculate the bearing (azimuth) from one global coordinate to another
   * @param {number} lat1 - Latitude of first point in degrees
   * @param {number} lon1 - Longitude of first point in degrees
   * @param {number} lat2 - Latitude of second point in degrees
   * @param {number} lon2 - Longitude of second point in degrees
   * @returns {number} Bearing in degrees (0-360, clockwise from north)
   */
  getBearing(lat1, lon1, lat2, lon2) {
    const lat1Rad = lat1 * Math.PI / 180.0;
    const lon1Rad = lon1 * Math.PI / 180.0;
    const lat2Rad = lat2 * Math.PI / 180.0;
    const lon2Rad = lon2 * Math.PI / 180.0;
    
    const dLon = lon2Rad - lon1Rad;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180.0 / Math.PI;
    // Normalize to 0-360
    bearing = (bearing + 360) % 360;
    
    return bearing;
  }
}

/**
 * Create a singleton instance with default values
 * This can be imported and used directly, or a new instance can be created
 */
export const transformUtility = new TransformUtility({
  origin: { lat: 0, lon: 0, alt: 0 },
  heading: 0,
  useEllipsoidalModel: true
}); 