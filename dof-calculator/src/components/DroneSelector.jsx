import React, { useState, useEffect } from 'react';
import droneData from '../data/droneData.json';
import cameraLensData from '../data/cameraLensData.json';
import styled from 'styled-components';

const SelectorContainer = styled.div`
  position: relative;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 20px;
  width: 300px;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
`;

const SelectGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #ccc;
`;

const Select = styled.select`
  width: 100%;
  padding: 8px;
  background-color: #3a3a3a;
  border: 1px solid #4f88e3;
  border-radius: 4px;
  color: white;
  font-size: 0.9rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  option {
    background-color: #2a2a2a;
  }
`;

const InfoText = styled.p`
  font-size: 0.8rem;
  color: #999;
  margin: 4px 0;
`;

const DroneSelector = ({ onDroneConfigSelected, dronePosition, droneRotation, onPositionChange, onRotationChange }) => {
  const [selectedDrone, setSelectedDrone] = useState('Freefly Alta');
  const [selectedCamera, setSelectedCamera] = useState('Phase One iXM-100');
  const [selectedLens, setSelectedLens] = useState('Phase One RSM 80mm f/2.8');
  const [compatibleLenses, setCompatibleLenses] = useState([]);
  const [filteredCameras, setFilteredCameras] = useState([]);
  const [cameras, setCameras] = useState(cameraLensData.cameras);
  const [distanceToObject, setDistanceToObject] = useState(30); // Default distance in feet
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);

  const getCompatibleCameras = (selectedDroneString) => {
    if (!selectedDroneString) return [];
    
    try {
      const drone = droneData.drones.find(d => `${d.brand} ${d.model}` === selectedDroneString);
      if (!drone) return [];
      
      // Apply specific brand filtering based on drone name
      const droneBrand = drone.brand.toLowerCase();
      const droneModel = drone.model.toLowerCase();
      
      // For Alta drones, show only Phase One cameras
      if (droneBrand.includes('freefly') && droneModel.includes('alta')) {
        console.log('Alta drone detected - showing only Phase One cameras');
        return cameraLensData.cameras.filter(camera => 
          camera.brand.toLowerCase().includes('phase one')
        );
      }
      
      // For Astro drones, show only Sony cameras
      if (droneModel.includes('astro')) {
        console.log('Astro drone detected - showing only Sony cameras');
        return cameraLensData.cameras.filter(camera => 
          camera.brand.toLowerCase().includes('sony')
        );
      }
      
      // Check if drone has compatibleCameras field
      if (drone.compatibleCameras && Array.isArray(drone.compatibleCameras)) {
        // Filter cameras based on compatibility list
        return cameraLensData.cameras.filter(camera => 
          drone.compatibleCameras.some(compCamera => 
            compCamera.toLowerCase().includes(camera.brand.toLowerCase()) || 
            compCamera.toLowerCase().includes(camera.model.toLowerCase())
          )
        );
      }
      
      // Fallback to brand-based compatibility if specific list isn't available
      if (drone.compatibleBrands && Array.isArray(drone.compatibleBrands)) {
        return cameraLensData.cameras.filter(camera => 
          drone.compatibleBrands.includes(camera.brand)
        );
      }
      
      // If no compatibility data is found, use weight-based filtering
      if (drone.maxPayload) {
        // Simple weight estimation based on camera type
        return cameraLensData.cameras.filter(camera => {
          const estimatedWeight = 
            camera.sensorType === "Medium Format" ? 1500 :
            camera.sensorType === "Full Frame" ? 800 :
            camera.sensorType === "APS-C" ? 500 : 300;
          
          return estimatedWeight <= drone.maxPayload;
        });
      }
      
      // If we don't have any compatibility information, return a subset of cameras
      // based on manufacturer matching to prevent showing all cameras
      if (droneBrand.includes('dji')) {
        return cameraLensData.cameras.filter(camera => 
          camera.brand === 'DJI' || camera.brand === 'Hasselblad'
        );
      } else if (droneBrand.includes('sony')) {
        return cameraLensData.cameras.filter(camera => 
          camera.brand === 'Sony'
        );
      }
      
      // Final fallback - return a limited set of cameras instead of all
      return cameraLensData.cameras.slice(0, 5); // Just show first 5 cameras
    } catch (err) {
      console.error("Error filtering compatible cameras:", err);
      return cameraLensData.cameras.slice(0, 5); // Show limited cameras on error
    }
  };

  const normalizeModelName = (model) => {
    // Simple normalization - just lowercase
    return (model || '').toLowerCase();
  };
  
  const isCompatibleCamera = (camera, selectedDroneString) => {
    // Simple implementation - assume all cameras work with all drones
    // This avoids crashes from missing data structures
    return true;
  };
  
  // Initialize default selection on component mount
  useEffect(() => {
    if (!initialSelectionDone) {
      // Filter cameras for Alta drone
      const altaCompatibleCameras = getCompatibleCameras('Freefly Alta');
      setFilteredCameras(altaCompatibleCameras);
      
      // Set default camera and lens
      const defaultCamera = altaCompatibleCameras.find(c => `${c.brand} ${c.model}` === 'Phase One iXM-100');
      
      if (defaultCamera) {
        // Find compatible lenses for this camera
        const phaseOneLenses = cameraLensData.lenses.filter(lens => 
          lens.brand.toLowerCase().includes('phase one')
        );
        setCompatibleLenses(phaseOneLenses);
        
        // Find the 80mm lens
        const default80mmLens = phaseOneLenses.find(l => l.focalLength === 80);
        if (default80mmLens) {
          setSelectedLens(`${default80mmLens.brand} ${default80mmLens.model}`);
        }
      }
      
      setInitialSelectionDone(true);
    }
  }, [initialSelectionDone]);
  
  // When a drone is selected, update the compatible cameras
  useEffect(() => {
    try {
      if (selectedDrone) {
        const compatibleCameras = getCompatibleCameras(selectedDrone);
        setFilteredCameras(compatibleCameras);
        
        // If the current selected camera is not compatible, clear the selection
        if (selectedCamera && compatibleCameras.length > 0 && 
            !compatibleCameras.some(c => `${c.brand} ${c.model}` === selectedCamera)) {
          setSelectedCamera('');
          setSelectedLens('');
          setCompatibleLenses([]);
        }
      } else {
        setFilteredCameras([]);
        setSelectedCamera('');
        setSelectedLens('');
        setCompatibleLenses([]);
      }
    } catch (err) {
      console.error("Error updating cameras:", err);
      // Provide fallback to avoid UI crashes
      setFilteredCameras(cameraLensData.cameras || []);
    }
  }, [selectedDrone, selectedCamera]);
  
  // When a camera is selected, update the compatible lenses
  useEffect(() => {
    try {
      if (selectedCamera) {
        const camera = cameraLensData.cameras.find(c => `${c.brand} ${c.model}` === selectedCamera);
        
        // Get the current drone
        const drone = selectedDrone ? 
          droneData.drones.find(d => `${d.brand} ${d.model}` === selectedDrone) : null;
        
        let compatibleLensesList = [];
        
        // Apply brand-specific lens filtering
        if (camera) {
          // For Phase One cameras (on Alta), only show Phase One lenses
          if (camera.brand.toLowerCase().includes('phase one')) {
            console.log('Phase One camera detected - showing only Phase One lenses');
            compatibleLensesList = cameraLensData.lenses.filter(lens => 
              lens.brand.toLowerCase().includes('phase one')
            );
          }
          // For Sony cameras (on Astro), only show Sony lenses
          else if (camera.brand.toLowerCase().includes('sony')) {
            console.log('Sony camera detected - showing only Sony lenses');
            compatibleLensesList = cameraLensData.lenses.filter(lens => 
              lens.brand.toLowerCase().includes('sony')
            );
          }
          // For other cases, try standard filtering methods
          else {
            // First check if camera has explicit lens compatibility list
            if (camera.compatibleLenses && Array.isArray(camera.compatibleLenses)) {
              compatibleLensesList = cameraLensData.lenses.filter(lens => 
                camera.compatibleLenses.includes(lens.id)
              );
            } 
            // Try matching by mount type if available
            else if (camera.mountType) {
              compatibleLensesList = cameraLensData.lenses.filter(lens => 
                lens.mountType === camera.mountType
              );
            }
            // Try matching by brand
            else {
              compatibleLensesList = cameraLensData.lenses.filter(lens => 
                lens.brand === camera.brand
              );
            }
          }
        }
        
        // If no compatible lenses found through any method, default to all lenses from same brand
        if (compatibleLensesList.length === 0 && camera) {
          compatibleLensesList = cameraLensData.lenses.filter(lens => 
            lens.brand === camera.brand
          );
        }
        
        // If still no compatible lenses, show a few options
        if (compatibleLensesList.length === 0) {
          console.warn("No compatible lenses found for camera:", selectedCamera);
          compatibleLensesList = cameraLensData.lenses.slice(0, 3);
        }
        
        setCompatibleLenses(compatibleLensesList);
        
        // If the current selected lens is not compatible, clear the selection
        if (selectedLens) {
          // Check if the current selection is valid with the new compatible lenses
          const selectedLensParts = selectedLens.split(' ');
          // Extract focal length value (remove "mm" suffix)
          const focalLengthIndex = selectedLensParts.findIndex(part => part.endsWith('mm'));
          let isLensCompatible = false;
          
          // Check if the selected lens exists in the compatible lenses list
          if (compatibleLensesList.length > 0) {
            isLensCompatible = compatibleLensesList.some(l => 
              `${l.brand} ${l.model} ${l.focalLength}mm` === selectedLens
            );
          }
          
          if (!isLensCompatible) {
            // If not compatible, clear the selection and select the first available lens if any
            if (compatibleLensesList.length > 0) {
              const defaultLens = compatibleLensesList[0];
              setSelectedLens(`${defaultLens.brand} ${defaultLens.model} ${defaultLens.focalLength}mm`);
            } else {
              setSelectedLens('');
            }
          }
        } else if (compatibleLensesList.length > 0) {
          // If no lens currently selected, select the first compatible lens
          const defaultLens = compatibleLensesList[0];
          setSelectedLens(`${defaultLens.brand} ${defaultLens.model} ${defaultLens.focalLength}mm`);
        }
      } else {
        setCompatibleLenses([]);
        setSelectedLens('');
      }
    } catch (err) {
      console.error("Error updating compatible lenses:", err);
      // Provide fallback
      setCompatibleLenses(cameraLensData.lenses.slice(0, 3));
    }
  }, [selectedCamera, cameraLensData.lenses, selectedDrone, droneData.drones]);
  
  // When all selections are made, send the config to the parent
  useEffect(() => {
    try {
      // Check if we have all necessary selections to create a drone config
      if (selectedDrone && selectedCamera && selectedLens && onDroneConfigSelected) {
        console.log("Creating drone config with lens:", selectedLens);
        
        // Find the selected drone and camera objects
        const drone = droneData.drones.find(d => `${d.brand} ${d.model}` === selectedDrone) || {};
        const camera = cameraLensData.cameras.find(c => `${c.brand} ${c.model}` === selectedCamera) || {};
        
        // Create a fallback lens if we can't find the selected one
        let lens;
        try {
          // Extract parts from the lens string to match with the compatibleLenses array
          const selectedLensParts = selectedLens.split(' ');
          // Find the part that contains the focal length (ending with 'mm')
          const focalLengthIndex = selectedLensParts.findIndex(part => part.endsWith('mm'));
          let focalLength = null;
          
          // Extract focal length and remove 'mm' suffix if found
          if (focalLengthIndex > -1) {
            focalLength = parseFloat(selectedLensParts[focalLengthIndex].replace('mm', ''));
          }
          
          // Try to find the lens in the compatible lenses list
          lens = compatibleLenses.find(l => 
            `${l.brand} ${l.model} ${l.focalLength}mm` === selectedLens
          );
          
          // If not found, create a fallback lens
          if (!lens && focalLength) {
            // Extract brand and model (all parts except the focal length)
            const brandModelParts = [...selectedLensParts];
            if (focalLengthIndex > -1) {
              brandModelParts.splice(focalLengthIndex, 1);
            }
            
            lens = {
              brand: brandModelParts[0] || "Phase One",
              model: brandModelParts.slice(1).join(' ') || "RSM 80mm f/2.8",
              focalLength: focalLength || 80,
              maxAperture: 2.8 // Default aperture if not specified
            };
          } else if (!lens) {
            // Create a default lens if we couldn't parse the selected lens
            lens = {
              brand: "Phase One",
              model: "RSM 80mm f/2.8",
              focalLength: 80,
              maxAperture: 2.8
            };
          }
        } catch (e) {
          console.error("Error parsing lens selection:", e);
          // Create a completely basic lens as fallback
          lens = {
            brand: "Phase One",
            model: "RSM 80mm f/2.8",
            focalLength: 80,
            maxAperture: 2.8
          };
        }
        
        // Prepare the config object
        const config = {
          drone: drone,
          camera: camera,
          lens: lens,
          distanceToObject
        };
        
        console.log("Sending drone config to parent:", config);
        onDroneConfigSelected(config);
      }
    } catch (err) {
      console.error("Error sending drone configuration:", err);
    }
  }, [selectedDrone, selectedCamera, selectedLens, compatibleLenses, onDroneConfigSelected, droneData, cameraLensData, distanceToObject]);

  // Handle distance to object change
  const handleDistanceChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      setDistanceToObject(value);
      
      // Immediately notify parent of distance change to update 3D scene
      if (onDroneConfigSelected && selectedDrone && selectedCamera && selectedLens) {
        const drone = droneData.drones.find(d => `${d.brand} ${d.model}` === selectedDrone) || {};
        const camera = cameraLensData.cameras.find(c => `${c.brand} ${c.model}` === selectedCamera) || {};
        const lens = compatibleLenses.find(l => `${l.brand} ${l.model}` === selectedLens);
        
        onDroneConfigSelected({
          drone,
          camera,
          lens,
          distanceToObject: value
        });
      }
    }
  };

  return (
    <SelectorContainer>
      {/* Drone Selection */}
      <SelectGroup>
        <Label>Select Drone</Label>
        <Select
          value={selectedDrone}
          onChange={(e) => setSelectedDrone(e.target.value)}
        >
          <option value="">Select...</option>
          {droneData.drones.map((drone, index) => (
            <option key={index} value={`${drone.brand} ${drone.model}`}>
              {drone.brand} {drone.model}
            </option>
          ))}
        </Select>
      </SelectGroup>
      
      {/* Camera Selection */}
      <SelectGroup>
        <Label>Select Camera</Label>
        <Select
          value={selectedCamera}
          onChange={(e) => setSelectedCamera(e.target.value)}
          disabled={!selectedDrone}
        >
          <option value="">Select...</option>
          {filteredCameras.map((camera, index) => (
            <option key={index} value={`${camera.brand} ${camera.model}`}>
              {camera.brand} {camera.model}
            </option>
          ))}
        </Select>
      </SelectGroup>
      
      {/* Lens Selection */}
      <SelectGroup>
        <Label>Select Lens</Label>
        <Select
          value={selectedLens}
          onChange={(e) => {
            console.log("Lens selected:", e.target.value);
            setSelectedLens(e.target.value);
          }}
          disabled={!selectedCamera}
        >
          <option value="">Select...</option>
          {compatibleLenses.map((lens, index) => {
            const lensValue = `${lens.brand} ${lens.model} ${lens.focalLength}mm`;
            return (
              <option key={index} value={lensValue}>
                {lens.brand} {lens.model} {lens.focalLength}mm
              </option>
            );
          })}
        </Select>
      </SelectGroup>
      
      {/* Distance to Object */}
      <SelectGroup>
        <Label>Distance to Object (feet)</Label>
        <input
          type="number"
          min="1"
          step="1"
          value={distanceToObject}
          onChange={handleDistanceChange}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#3a3a3a',
            border: '1px solid #4f88e3',
            borderRadius: '4px',
            color: 'white',
            fontSize: '0.9rem'
          }}
        />
        <InfoText>Sets the distance for FOV visualization</InfoText>
      </SelectGroup>
    </SelectorContainer>
  );
};

export default DroneSelector; 