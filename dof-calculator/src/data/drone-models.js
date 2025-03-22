/**
 * Drone model data for the Mission Planner
 * Each drone model includes camera and lens information
 */

const DroneModels = [
  {
    id: 'mavic-pro',
    name: 'DJI Mavic Pro',
    brand: 'DJI',
    camera: {
      brand: 'DJI',
      model: 'Mavic Pro Camera',
      sensorWidth: 6.17,  // in mm
      sensorHeight: 4.55, // in mm
      resolution: [4000, 3000]
    },
    lens: {
      brand: 'DJI',
      model: 'Mavic Pro Lens',
      focalLength: 4.7, // in mm
      aperture: 2.8
    }
  },
  {
    id: 'mavic-air-2',
    name: 'DJI Mavic Air 2',
    brand: 'DJI',
    camera: {
      brand: 'DJI',
      model: 'Mavic Air 2 Camera',
      sensorWidth: 6.3,  // in mm
      sensorHeight: 4.7, // in mm
      resolution: [4000, 3000]
    },
    lens: {
      brand: 'DJI',
      model: 'Mavic Air 2 Lens',
      focalLength: 4.5, // in mm
      aperture: 2.8
    }
  },
  {
    id: 'phantom-4-pro',
    name: 'DJI Phantom 4 Pro',
    brand: 'DJI',
    camera: {
      brand: 'DJI',
      model: 'Phantom 4 Pro Camera',
      sensorWidth: 13.2,  // in mm
      sensorHeight: 8.8,  // in mm
      resolution: [5472, 3648]
    },
    lens: {
      brand: 'DJI',
      model: 'Phantom 4 Pro Lens',
      focalLength: 8.8, // in mm
      aperture: 2.8
    }
  },
  {
    id: 'inspire-2',
    name: 'DJI Inspire 2 with X5S',
    brand: 'DJI',
    camera: {
      brand: 'DJI',
      model: 'Zenmuse X5S',
      sensorWidth: 17.3,  // in mm
      sensorHeight: 13.0, // in mm
      resolution: [5280, 3956]
    },
    lens: {
      brand: 'DJI',
      model: 'Olympus M.Zuiko 12mm f/2.0',
      focalLength: 12, // in mm
      aperture: 2.0
    }
  }
];

export default DroneModels; 