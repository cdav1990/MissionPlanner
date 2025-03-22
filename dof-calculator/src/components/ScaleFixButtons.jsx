import React from 'react';
import styled from 'styled-components';

const ButtonContainer = styled.div`
  margin-top: 10px;
  border-top: 1px solid var(--border-color);
  padding-top: 5px;
`;

const Label = styled.div`
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 5px;
`;

const ButtonGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
`;

const ScaleButton = styled.button`
  padding: 4px;
  background: var(--highlight-color);
  border: 1px solid var(--border-color);
  color: var(--text-light);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: 11px;
  
  &:hover {
    background-color: var(--bg-medium);
  }
`;

const ScaleFixButtons = ({ 
  pointCloud, 
  setPointCloud, 
  setModelScale, 
  setImportSuccess 
}) => {
  const applyUnitConversion = (conversionType) => {
    let newScale = 1.0;
    let message = '';
    
    switch(conversionType) {
      case 'mm':
        newScale = 0.001; // mm to m
        message = 'Applied millimeter to meter conversion (1/1000 scale)';
        break;
      case 'cm':
        newScale = 0.01; // cm to m
        message = 'Applied centimeter to meter conversion (1/100 scale)';
        break;
      case 'feet':
        newScale = 0.3048; // feet to m
        message = 'Applied feet to meter conversion';
        break;
      default:
        newScale = 1.0;
        message = 'Reset scale to 1.0';
    }
    
    // Update scale in UI
    setModelScale(newScale);
    
    // Update point cloud if loaded
    if (pointCloud) {
      setPointCloud({
        ...pointCloud,
        scale: newScale
      });
    }
    
    // Show success message
    setImportSuccess(message);
  };

  return (
    <ButtonContainer>
      <Label>Fix scale for large models:</Label>
      <ButtonGrid>
        <ScaleButton onClick={() => applyUnitConversion('mm')}>
          mm to m (1/1000)
        </ScaleButton>
        <ScaleButton onClick={() => applyUnitConversion('cm')}>
          cm to m (1/100)
        </ScaleButton>
        <ScaleButton onClick={() => applyUnitConversion('feet')}>
          feet to m (0.3048)
        </ScaleButton>
        <ScaleButton onClick={() => applyUnitConversion('reset')}>
          Reset (1.0)
        </ScaleButton>
      </ButtonGrid>
    </ButtonContainer>
  );
};

export default ScaleFixButtons;
