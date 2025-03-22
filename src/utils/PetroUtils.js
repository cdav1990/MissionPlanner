/**
 * PetroUtils.js
 * Utility functions for mission planning and operations
 */

import * as THREE from 'three';

/**
 * Mission finder utility to locate and process mission data
 * @param {Object} options - Configuration options for the mission finder
 * @returns {Object} - Mission finder object with utility methods
 */
export const getMissionFinder = (options = {}) => {
  // Default configuration
  const config = {
    enableLogging: true,
    maxMissions: 100,
    ...options
  };

  // Return the mission finder object with utility methods
  return {
    /**
     * Find missions based on specified criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array} - Found missions
     */
    findMissions: (criteria = {}) => {
      if (config.enableLogging) {
        console.log('Finding missions with criteria:', criteria);
      }
      
      // Placeholder implementation - replace with actual implementation
      return [];
    },
    
    /**
     * Load a specific mission by ID
     * @param {string} id - Mission ID
     * @returns {Object|null} - Mission data or null if not found
     */
    loadMission: (id) => {
      if (config.enableLogging) {
        console.log('Loading mission with ID:', id);
      }
      
      // Placeholder implementation - replace with actual implementation
      return null;
    },
    
    /**
     * Get configuration of the mission finder
     * @returns {Object} - Current configuration
     */
    getConfig: () => {
      return { ...config };
    },
    
    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig: (newConfig = {}) => {
      Object.assign(config, newConfig);
      
      if (config.enableLogging) {
        console.log('Mission finder configuration updated:', config);
      }
    }
  };
};

/**
 * Create a default mission finder instance with default configuration
 */
export const defaultMissionFinder = getMissionFinder();

/**
 * Utility function to create a mission with basic parameters
 * @param {Object} params - Mission parameters
 * @returns {Object} - Created mission
 */
export const createMission = (params = {}) => {
  // Default parameters
  const defaultParams = {
    name: `Mission ${Date.now()}`,
    waypoints: [],
    created: new Date(),
    modified: new Date()
  };

  // Merge with provided parameters
  const mission = {
    ...defaultParams,
    ...params,
    id: params.id || `mission-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };

  return mission;
};

/**
 * Convert mission data to a compatible format for the application
 * @param {Object} missionData - Raw mission data
 * @returns {Object} - Formatted mission data
 */
export const formatMissionData = (missionData) => {
  if (!missionData) return null;
  
  // Ensure waypoints are in the correct format
  const waypoints = Array.isArray(missionData.waypoints) 
    ? missionData.waypoints.map(wp => ({
        position: Array.isArray(wp.position) ? wp.position : [0, 0, 0],
        heading: typeof wp.heading === 'number' ? wp.heading : 0,
        actions: Array.isArray(wp.actions) ? wp.actions : [],
        ...wp
      }))
    : [];
  
  return {
    ...missionData,
    waypoints,
    formatted: true
  };
};

// Export other utilities as needed
export default {
  getMissionFinder,
  defaultMissionFinder,
  createMission,
  formatMissionData
}; 