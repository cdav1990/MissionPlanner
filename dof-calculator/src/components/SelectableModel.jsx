import React, { useState, useRef, useEffect } from 'react';
import { Select, useSelect } from '@react-three/drei';
import * as THREE from 'three';
import ModelLoader from './ModelLoader';
import { sanitizeGeometry } from '../utils/geometryUtils';

/**
 * A selectable wrapper for 3D models that enables selection and manipulation
 * Enhanced to handle large files (100MB+) efficiently through blob URLs
 * @param {object} props Component props
 * @param {string} props.modelPath Path or blob URL to the model file
 * @param {string} props.modelFormat Format of the model (obj, ply)
 * @param {number} props.scale Scale factor for the model
 * @param {number} props.opacity Opacity of the model
 * @param {Array<number>} props.position Model position [x, y, z]
 * @param {Array<number>} props.rotation Model rotation [x, y, z] in radians
 * @param {Function} props.onSelect Callback when model is selected
 */
const SelectableModel = ({
  modelPath,
  modelFormat,
  scale = 1,
  opacity = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  onSelect = () => {}
}) => {
  const groupRef = useRef();
  const [boundingBox, setBoundingBox] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  // Track whether component is still mounted
  const isMountedRef = useRef(true);
  
  // Check if this object is selected using drei's useSelect hook
  const selected = useSelect().indexOf(groupRef.current) > -1;
  
  // Handle unmounting 
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Validate modelPath
  useEffect(() => {
    if (!modelPath) {
      console.error('SelectableModel: No model path provided');
      setLoadError(new Error('No model path provided'));
      return;
    }
    
    // Reset error state when model path changes
    setLoadError(null);
    setIsLoaded(false);
    
    // Debug model URL
    console.log('SelectableModel loading from URL:', modelPath);
    
    // If it's a blob URL, check if it's still valid
    if (modelPath.startsWith('blob:')) {
      try {
        fetch(modelPath, { method: 'HEAD' }).catch(err => {
          console.error('Error validating blob URL:', err);
          setLoadError(new Error('Invalid blob URL: ' + err.message));
        });
      } catch (err) {
        console.error('Error checking blob URL:', err);
      }
    }
  }, [modelPath]);
  
  // Called when a model is successfully loaded
  const handleModelLoaded = (modelData) => {
    if (!isMountedRef.current) return;
    
    console.log('Model loaded successfully in SelectableModel:', modelData);
    setIsLoaded(true);
    
    // Calculate bounding box for selection outline
    if (groupRef.current) {
      try {
        const box = new THREE.Box3().setFromObject(groupRef.current);
        
        // Validate the bounding box
        if (isFinite(box.min.x) && isFinite(box.max.x)) {
          setBoundingBox(box);
          
          // Report successful load with measurements to parent
          const size = new THREE.Vector3();
          box.getSize(size);
          
          onSelect({
            type: 'model-loaded',
            model: groupRef.current,
            box,
            size,
            center: box.getCenter(new THREE.Vector3()),
            format: modelData.format,
            vertices: modelData.vertices,
            faces: modelData.faces
          });
        } else {
          console.warn('Model bounding box is invalid:', box);
        }
      } catch (err) {
        console.error('Error calculating bounding box:', err);
      }
    }
  };
  
  // Called when there's an error loading the model
  const handleModelError = (error) => {
    if (!isMountedRef.current) return;
    
    console.error('Error loading model in SelectableModel:', error);
    setLoadError(error);
    
    // Notify parent of the error
    onSelect({
      type: 'model-error',
      error,
      message: error.message || 'Unknown error loading model'
    });
  };
  
  // Notify parent when selected state changes
  useEffect(() => {
    if (selected && onSelect && isLoaded && !loadError) {
      onSelect({
        type: 'selected',
        model: groupRef.current,
        box: boundingBox
      });
    }
  }, [selected, onSelect, isLoaded, loadError, boundingBox]);
  
  // Selection helper outline material
  const outlineMaterial = React.useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 'white',
      transparent: true,
      opacity: 0.5,
      wireframe: true
    });
  }, []);
  
  // Error material
  const errorMaterial = React.useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 'red',
      transparent: true,
      opacity: 0.7,
      wireframe: true
    });
  }, []);
  
  // If loading error, show error placeholder
  if (loadError) {
    return (
      <group ref={groupRef} position={position}>
        <mesh rotation={rotation}>
          <boxGeometry args={[2, 2, 2]} onUpdate={(geom) => sanitizeGeometry(geom)} />
          <primitive object={errorMaterial} attach="material" />
        </mesh>
      </group>
    );
  }
  
  return (
    <Select enabled={isLoaded && !loadError}>
      <group ref={groupRef} position={position}>
        <ModelLoader
          url={modelPath}
          format={modelFormat}
          scale={scale}
          opacity={opacity}
          rotation={rotation}
          position={[0, 0, 0]} // Relative to group
          onLoad={handleModelLoaded}
          onError={handleModelError}
        />
        
        {/* Selection outline - only shown when selected and model is loaded */}
        {selected && isLoaded && boundingBox && (
          <mesh>
            <boxGeometry 
              args={[
                boundingBox.max.x - boundingBox.min.x,
                boundingBox.max.y - boundingBox.min.y,
                boundingBox.max.z - boundingBox.min.z
              ]} 
              onUpdate={(geom) => sanitizeGeometry(geom)}
            />
            <primitive object={outlineMaterial} attach="material" />
          </mesh>
        )}
      </group>
    </Select>
  );
};

export default SelectableModel; 