/**
 * MissionFinder.js
 * Mission finding functionality for the application
 */

import { getMissionFinder } from './PetroUtils';

// Create a default mission finder instance
const missionFinder = getMissionFinder({
  enableLogging: true,
  maxMissions: 100
});

/**
 * Find missions based on criteria
 * @param {Object} criteria - Search criteria for finding missions
 * @returns {Array} - Array of found missions
 */
export const findMissions = (criteria = {}) => {
  return missionFinder.findMissions(criteria);
};

/**
 * Load a specific mission by ID
 * @param {string} id - Mission ID to load
 * @returns {Object|null} - Mission data or null if not found
 */
export const loadMission = (id) => {
  return missionFinder.loadMission(id);
};

/**
 * Get the mission finder configuration
 * @returns {Object} - Current configuration
 */
export const getMissionFinderConfig = () => {
  return missionFinder.getConfig();
};

/**
 * Update the mission finder configuration
 * @param {Object} config - New configuration options
 */
export const updateMissionFinderConfig = (config = {}) => {
  missionFinder.updateConfig(config);
};

// Export the mission finder instance as default
export default missionFinder; 