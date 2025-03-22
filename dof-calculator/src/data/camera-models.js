/**
 * Camera models data for the Mission Planner
 * Each camera model includes sensor and resolution information
 */

const CameraModels = [
  {
    id: 'phase-one-ixm-100',
    name: 'Phase One iXM-100',
    brand: 'Phase One',
    sensorType: 'Medium Format',
    sensorWidth: 53.4,  // in mm
    sensorHeight: 40.0, // in mm
    resolution: [11664, 8750],
    megapixels: 100
  },
  {
    id: 'sony-a7r-iv',
    name: 'Sony Alpha 7R IV',
    brand: 'Sony',
    sensorType: 'Full Frame',
    sensorWidth: 35.7,  // in mm
    sensorHeight: 23.8, // in mm
    resolution: [9504, 6336],
    megapixels: 61
  },
  {
    id: 'canon-eos-r5',
    name: 'Canon EOS R5',
    brand: 'Canon',
    sensorType: 'Full Frame',
    sensorWidth: 36.0,  // in mm
    sensorHeight: 24.0, // in mm
    resolution: [8192, 5464],
    megapixels: 45
  },
  {
    id: 'fujifilm-gfx-100s',
    name: 'Fujifilm GFX 100S',
    brand: 'Fujifilm',
    sensorType: 'Medium Format',
    sensorWidth: 43.8,  // in mm
    sensorHeight: 32.9, // in mm
    resolution: [11648, 8736],
    megapixels: 102
  },
  {
    id: 'dji-mavic-3-pro',
    name: 'DJI Mavic 3 Pro',
    brand: 'DJI',
    sensorType: '1-inch',
    sensorWidth: 13.2,  // in mm
    sensorHeight: 8.8,  // in mm
    resolution: [5280, 3956],
    megapixels: 20
  },
  {
    id: 'dji-phantom-4-pro',
    name: 'DJI Phantom 4 Pro',
    brand: 'DJI',
    sensorType: '1-inch',
    sensorWidth: 13.2,  // in mm
    sensorHeight: 8.8,  // in mm
    resolution: [5472, 3648],
    megapixels: 20
  },
  {
    id: 'dji-mavic-2-pro',
    name: 'DJI Mavic 2 Pro',
    brand: 'DJI',
    sensorType: '1-inch',
    sensorWidth: 13.2,  // in mm
    sensorHeight: 8.8,  // in mm
    resolution: [5472, 3648],
    megapixels: 20
  },
  {
    id: 'dji-mavic-air-2',
    name: 'DJI Mavic Air 2',
    brand: 'DJI',
    sensorType: '1/2-inch',
    sensorWidth: 6.3,  // in mm
    sensorHeight: 4.7, // in mm
    resolution: [8000, 6000],
    megapixels: 48
  }
];

export default CameraModels; 