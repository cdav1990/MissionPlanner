/**
 * CoordinateTransformExample.js
 * Example usage of the TransformUtility for converting between local and global coordinates
 */

import { TransformUtility, transformUtility } from './CoordinateTransform';

/**
 * This example demonstrates how to use the TransformUtility class for coordinate conversions.
 * It shows both how to use the singleton instance and how to create a custom instance.
 */

// Example 1: Using the singleton instance with default values
function exampleUsingSingleton() {
  console.log("Example 1: Using singleton instance with default values");
  
  // First, set the origin to a meaningful location (e.g., a project site)
  transformUtility.setOrigin({
    lat: 37.7749, // San Francisco latitude
    lon: -122.4194, // San Francisco longitude
    alt: 0 // sea level
  });
  
  // Set the heading (rotation) of the local coordinate system relative to North
  // For example, if the local Y axis is 30 degrees east of true north
  transformUtility.setHeading(30);
  
  // Example: Convert a local coordinate to global
  const localPoint = { x: 100, y: 200, z: 50 }; // feet
  const globalPoint = transformUtility.localToGlobal(localPoint.x, localPoint.y, localPoint.z);
  console.log("Local point:", localPoint);
  console.log("Converted to global:", globalPoint);
  
  // Example: Convert a global coordinate to local
  const newGlobalPoint = { 
    lat: 37.7761, 
    lon: -122.4183, 
    alt: 15 // meters
  };
  const newLocalPoint = transformUtility.globalToLocal(
    newGlobalPoint.lat, 
    newGlobalPoint.lon, 
    newGlobalPoint.alt
  );
  console.log("Global point:", newGlobalPoint);
  console.log("Converted to local:", newLocalPoint);
  
  // Calculate distance and bearing between global points
  const distance = transformUtility.getGreatCircleDistance(
    37.7749, -122.4194,
    37.7761, -122.4183
  );
  console.log("Distance between points:", distance, "meters");
  
  const bearing = transformUtility.getBearing(
    37.7749, -122.4194,
    37.7761, -122.4183
  );
  console.log("Bearing from origin to point:", bearing, "degrees");
}

// Example 2: Creating a custom instance for a specific project
function exampleUsingCustomInstance() {
  console.log("\nExample 2: Using custom instance for a specific project");
  
  // Create a new instance with project-specific settings
  const projectTransform = new TransformUtility({
    origin: {
      lat: 40.7128, // New York latitude
      lon: -74.0060, // New York longitude
      alt: 10 // meters above sea level
    },
    heading: 45, // 45 degrees rotation from true north
    useEllipsoidalModel: true // Use accurate ellipsoidal model
  });
  
  // Example: Convert a drone position from local to global coordinates
  const dronePosition = { x: 150, y: 300, z: 75 }; // feet
  const droneGlobalPosition = projectTransform.localToGlobal(
    dronePosition.x, 
    dronePosition.y, 
    dronePosition.z
  );
  console.log("Drone local position:", dronePosition);
  console.log("Drone global position:", droneGlobalPosition);
  
  // Example: Convert a GCP (Ground Control Point) from global to local coordinates
  const gcpPosition = { 
    lat: 40.7140, 
    lon: -74.0048, 
    alt: 12 // meters
  };
  const gcpLocalPosition = projectTransform.globalToLocal(
    gcpPosition.lat, 
    gcpPosition.lon, 
    gcpPosition.alt
  );
  console.log("GCP global position:", gcpPosition);
  console.log("GCP local position:", gcpLocalPosition);
}

// Example 3: Integration with other systems like MAVLink or Cesium
function exampleIntegrationWithOtherSystems() {
  console.log("\nExample 3: Integration with other systems (MAVLink, Cesium)");
  
  // Create a transform utility for a drone mission
  const missionTransform = new TransformUtility({
    origin: {
      lat: 35.6895, // Tokyo latitude
      lon: 139.6917, // Tokyo longitude
      alt: 40 // meters above sea level
    },
    heading: 0, // No rotation
    useEllipsoidalModel: true // Use accurate ellipsoidal model
  });
  
  // Example: Convert mission waypoints from local planning to global for MAVLink
  const missionWaypoints = [
    { x: 0, y: 0, z: 50 }, // feet, starting point
    { x: 100, y: 0, z: 100 }, // feet
    { x: 100, y: 100, z: 100 }, // feet
    { x: 0, y: 100, z: 50 }, // feet, ending point
  ];
  
  // Convert all waypoints to global coordinates for a MAVLink mission
  const globalWaypoints = missionWaypoints.map(point => {
    return missionTransform.localToGlobal(point.x, point.y, point.z);
  });
  
  console.log("Mission waypoints (local):", missionWaypoints);
  console.log("Mission waypoints (global for MAVLink):", globalWaypoints);
  
  // Example: Converting Cesium terrain information to local coordinates
  // Simulate Cesium terrain altitude data for a set of points
  const cesiumTerrainPoints = [
    { lat: 35.6896, lon: 139.6918, alt: 41 }, // meters
    { lat: 35.6897, lon: 139.6919, alt: 42 }, // meters
    { lat: 35.6898, lon: 139.6920, alt: 45 }, // meters
  ];
  
  // Convert Cesium terrain points to local coordinates
  const localTerrainPoints = cesiumTerrainPoints.map(point => {
    return missionTransform.globalToLocal(point.lat, point.lon, point.alt);
  });
  
  console.log("Cesium terrain points (global):", cesiumTerrainPoints);
  console.log("Cesium terrain points (local):", localTerrainPoints);
}

// Run all examples
export function runTransformExamples() {
  exampleUsingSingleton();
  exampleUsingCustomInstance();
  exampleIntegrationWithOtherSystems();
}

// Export examples for direct use
export {
  exampleUsingSingleton,
  exampleUsingCustomInstance,
  exampleIntegrationWithOtherSystems
}; 