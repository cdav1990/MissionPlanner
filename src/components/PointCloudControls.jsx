import React, { useState, useRef } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  margin-bottom: 15px;
  padding: 12px;
  border: 1px solid #333;
`;

const Title = styled.h3`
  margin: 0 0 10px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #444;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ControlItem = styled.div`
  margin-bottom: 8px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 4px;
  font-size: 0.9rem;
  opacity: 0.9;
`;

const FileInput = styled.input`
  width: 100%;
  padding: 6px;
  background: rgba(30, 30, 30, 0.7);
  border: 1px solid #555;
  border-radius: 4px;
  color: white;
  font-size: 0.85rem;
  margin-bottom: 8px;
  
  &:hover {
    border-color: #888;
  }
`;

const RangeInput = styled.input`
  width: 100%;
  margin: 4px 0;
`;

const Button = styled.button`
  padding: 6px 10px;
  background: ${props => props.danger ? '#a02020' : '#204a87'};
  color: white;
  border: none;
  border-radius: 4px;
  margin-right: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  
  &:hover {
    background: ${props => props.danger ? '#c03030' : '#3465a4'};
  }
  
  &:disabled {
    background: #555;
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

const CloudItem = styled.div`
  background: rgba(40, 40, 40, 0.7);
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
  border-left: 3px solid ${props => props.active ? '#4c9ce0' : '#555'};
  
  &:hover {
    background: rgba(50, 50, 50, 0.7);
  }
`;

const CloudName = styled.div`
  font-weight: bold;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CloudControls = styled.div`
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const VisibilityToggle = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: ${props => props.visible ? 'rgba(100, 200, 100, 0.3)' : 'rgba(200, 50, 50, 0.3)'};
  color: ${props => props.visible ? '#afa' : '#faa'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  
  &:hover {
    background: ${props => props.visible ? 'rgba(100, 200, 100, 0.5)' : 'rgba(200, 50, 50, 0.5)'};
  }
`;

const NoData = styled.div`
  padding: 15px;
  text-align: center;
  color: #888;
  font-style: italic;
`;

/**
 * PointCloudControls component - UI for managing point clouds
 */
const PointCloudControls = ({
  pointClouds = [],
  onAddPointCloud,
  onRemovePointCloud,
  onTogglePointCloud,
  onUpdatePointCloud,
  onSelectSample
}) => {
  const [activeCloudId, setActiveCloudId] = useState(null);
  const [pointSize, setPointSize] = useState(0.01);
  const [colorByHeight, setColorByHeight] = useState(false);
  const fileInputRef = useRef(null);
  
  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const filename = file.name;
    const extension = filename.split('.').pop().toLowerCase();
    
    // Check if file type is supported
    if (!['ply', 'pcd', 'las', 'laz'].includes(extension)) {
      alert(`Unsupported file type: ${extension}. Please upload a PLY, PCD, LAS, or LAZ file.`);
      return;
    }
    
    // Create blob URL for the file
    const url = URL.createObjectURL(file);
    
    // Generate a unique ID
    const id = `pc-${Date.now()}`;
    
    // Add point cloud
    onAddPointCloud({
      id,
      name: filename,
      url,
      pointSize,
      visible: true,
      colorByHeight,
      autoScale: true,
      file
    });
    
    // Select the new point cloud
    setActiveCloudId(id);
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Handle removing a point cloud
  const handleRemove = (id) => {
    onRemovePointCloud(id);
    
    // Clear active ID if removed
    if (activeCloudId === id) {
      setActiveCloudId(null);
    }
  };
  
  // Update active point cloud settings
  const updateActiveCloud = (property, value) => {
    if (!activeCloudId) return;
    
    onUpdatePointCloud(activeCloudId, {
      [property]: value
    });
  };
  
  // Select a cloud
  const handleSelectCloud = (id) => {
    setActiveCloudId(id === activeCloudId ? null : id);
    
    // Update local settings to match the selected cloud
    const cloud = pointClouds.find(pc => pc.id === id);
    if (cloud) {
      setPointSize(cloud.pointSize || 0.01);
      setColorByHeight(cloud.colorByHeight || false);
    }
  };
  
  // Toggle visibility
  const toggleVisibility = (id, event) => {
    event.stopPropagation();
    onTogglePointCloud(id);
  };
  
  // Handle sample selection
  const handleSampleSelect = (event) => {
    const sample = event.target.value;
    if (sample === 'none') return;
    
    onSelectSample(sample);
  };
  
  // Find the active point cloud
  const activeCloud = pointClouds.find(pc => pc.id === activeCloudId);
  
  return (
    <Container>
      <Title>
        Point Cloud Manager
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          {pointClouds.length} {pointClouds.length === 1 ? 'cloud' : 'clouds'}
        </span>
      </Title>
      
      <ControlItem>
        <Label>Upload point cloud file:</Label>
        <FileInput 
          type="file" 
          accept=".ply,.pcd,.las,.laz" 
          onChange={handleFileUpload}
          ref={fileInputRef}
        />
      </ControlItem>
      
      <ControlItem>
        <Label>Or select a sample:</Label>
        <select 
          onChange={handleSampleSelect}
          style={{ 
            width: '100%', 
            padding: '6px',
            backgroundColor: 'rgba(30, 30, 30, 0.7)',
            color: 'white',
            border: '1px solid #555',
            borderRadius: '4px'
          }}
        >
          <option value="none">Select a sample...</option>
          <option value="test-cube.ply">Test Cube</option>
          <option value="bunny.ply">Stanford Bunny</option>
          <option value="dragon.ply">Dragon</option>
        </select>
      </ControlItem>
      
      {activeCloud && (
        <ControlItem>
          <Label>Point Size: {pointSize}</Label>
          <RangeInput 
            type="range" 
            min="0.001" 
            max="0.1" 
            step="0.001" 
            value={pointSize} 
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              setPointSize(value);
              updateActiveCloud('pointSize', value);
            }} 
          />
        </ControlItem>
      )}
      
      {activeCloud && (
        <ControlItem>
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input 
              type="checkbox" 
              checked={colorByHeight} 
              onChange={(e) => {
                setColorByHeight(e.target.checked);
                updateActiveCloud('colorByHeight', e.target.checked);
              }} 
              style={{ marginRight: '8px' }}
            />
            Color by Height
          </label>
        </ControlItem>
      )}
      
      <div style={{ marginTop: '15px' }}>
        <Label>Loaded Point Clouds:</Label>
        
        {pointClouds.length === 0 ? (
          <NoData>No point clouds loaded</NoData>
        ) : (
          pointClouds.map(cloud => (
            <CloudItem 
              key={cloud.id} 
              active={activeCloudId === cloud.id}
              onClick={() => handleSelectCloud(cloud.id)}
            >
              <CloudName>
                {cloud.name || 'Unnamed Point Cloud'}
                <VisibilityToggle 
                  visible={cloud.visible} 
                  onClick={(e) => toggleVisibility(cloud.id, e)}
                  title={cloud.visible ? 'Hide' : 'Show'}
                >
                  {cloud.visible ? '👁️' : '🚫'}
                </VisibilityToggle>
              </CloudName>
              
              {activeCloudId === cloud.id && (
                <CloudControls>
                  <Button danger onClick={() => handleRemove(cloud.id)}>
                    Remove
                  </Button>
                  
                  <Button 
                    onClick={() => updateActiveCloud('autoScale', !cloud.autoScale)}
                    style={{ 
                      backgroundColor: cloud.autoScale ? '#00aa44' : '#555',
                      opacity: cloud.autoScale ? 1 : 0.8  
                    }}
                  >
                    {cloud.autoScale ? 'Auto-Scale On' : 'Auto-Scale Off'}
                  </Button>
                </CloudControls>
              )}
            </CloudItem>
          ))
        )}
      </div>
      
      {pointClouds.length > 0 && (
        <ButtonGroup>
          <Button 
            danger
            onClick={() => {
              if (window.confirm('Are you sure you want to remove all point clouds?')) {
                pointClouds.forEach(cloud => onRemovePointCloud(cloud.id));
                setActiveCloudId(null);
              }
            }}
          >
            Remove All
          </Button>
        </ButtonGroup>
      )}
    </Container>
  );
};

export default PointCloudControls; 