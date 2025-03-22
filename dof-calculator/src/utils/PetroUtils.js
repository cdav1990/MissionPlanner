/**
 * PetroUtils.js - Stub implementation for compatibility
 * This file provides backward compatibility with older imports
 */

import * as THREE from 'three';

// Add missing PetroesultRenderer export that's causing the error
export const PetroesultRenderer = {
  init: (container, options = {}) => {
    console.log('Stub PetroesultRenderer.init called with options:', options);
    return {
      render: () => console.log('Stub rendering'),
      update: () => console.log('Stub update'),
      resize: () => console.log('Stub resize'),
      dispose: () => console.log('Stub dispose')
    };
  },
  version: '1.0.0-stub'
};

/**
 * Create a mock mission finder factory function
 * @param {Object} options - Configuration options for the mission finder
 * @returns {Object} - Mission finder object with utility methods
 */
export const getMissionFinder = (options = {}) => {
  console.log('Using stub MissionFinder implementation with options:', options);
  
  // Create a basic implementation that won't crash the app
  return {
    /**
     * Find missions based on specified criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array} - Found missions
     */
    findMissions: (criteria = {}) => {
      console.log('MissionFinder.findMissions called with criteria:', criteria);
      return []; // Return empty array of missions
    },
    
    /**
     * Load a specific mission by ID
     * @param {string} id - Mission ID
     * @returns {Object|null} - Mission data or null if not found
     */
    loadMission: (id) => {
      console.log('MissionFinder.loadMission called with id:', id);
      return null; // Return null for any mission ID
    },
    
    /**
     * Get configuration of the mission finder
     * @returns {Object} - Current configuration
     */
    getConfig: () => {
      return { 
        ...options,
        isStubImplementation: true
      };
    },
    
    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig: (newConfig = {}) => {
      console.log('MissionFinder.updateConfig called with:', newConfig);
      // Config update would happen here in real implementation
      return true;
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