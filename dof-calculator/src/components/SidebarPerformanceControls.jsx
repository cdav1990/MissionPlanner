import React, { useState } from 'react';
import styled from 'styled-components';
import { FiCpu, FiZap, FiBattery, FiAlertTriangle, FiTrendingUp } from 'react-icons/fi';

// Styled components
const PerformanceControlsContainer = styled.div`
  margin-top: 15px;
  padding: 15px;
  background-color: #2a2a2a;
  border-radius: 8px;
`;

const PerformanceHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  color: #4f88e3;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  
  svg {
    margin-right: 8px;
  }
`;

const PerformanceSection = styled.div`
  margin-bottom: 15px;
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
`;

const ControlLabel = styled.label`
  display: flex;
  align-items: center;
  flex: 1;
  font-size: 13px;
  color: #ccc;
  cursor: pointer;
  
  svg {
    margin-right: 6px;
    color: #4f88e3;
  }
`;

const Checkbox = styled.input`
  cursor: pointer;
`;

const RangeSlider = styled.input`
  width: 100%;
  height: 6px;
  background: #444;
  outline: none;
  border-radius: 3px;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4f88e3;
    cursor: pointer;
  }
  
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4f88e3;
    cursor: pointer;
  }
`;

const SliderContainer = styled.div`
  width: 100%;
  margin-top: 4px;
`;

const ValueDisplay = styled.span`
  margin-left: 10px;
  font-size: 12px;
  color: #aaa;
  width: 40px;
  text-align: right;
`;

const MemoryWarning = styled.div`
  display: flex;
  align-items: center;
  margin-top: 10px;
  padding: 8px;
  background-color: ${props => props.level === 'critical' ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 165, 0, 0.1)'};
  border-radius: 4px;
  font-size: 12px;
  color: ${props => props.level === 'critical' ? '#ff5555' : '#ffaa55'};
  
  svg {
    margin-right: 8px;
    flex-shrink: 0;
  }
`;

const FPSIndicator = styled.div`
  display: flex;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
  color: ${props => {
    if (props.fps >= 50) return '#55ff55';
    if (props.fps >= 30) return '#ffff55';
    return '#ff5555';
  }};
  
  svg {
    margin-right: 8px;
  }
`;

const SidebarPerformanceControls = ({ 
  settings, 
  onSettingsChange,
  memoryUsage = null,
  fps = null,
  gpuInfo = null
}) => {
  const [expanded, setExpanded] = useState(true);
  
  const handleBooleanChange = (key) => (e) => {
    onSettingsChange({ ...settings, [key]: e.target.checked });
  };
  
  const handleSliderChange = (key, min, max) => (e) => {
    const value = Number(e.target.value);
    onSettingsChange({ ...settings, [key]: Math.max(min, Math.min(max, value)) });
  };
  
  // Determine memory warning level
  const getMemoryWarningLevel = () => {
    if (!memoryUsage) return null;
    
    if (memoryUsage >= 0.8) return 'critical';
    if (memoryUsage >= 0.6) return 'warning';
    return null;
  };
  
  const memoryWarningLevel = getMemoryWarningLevel();
  
  return (
    <PerformanceControlsContainer>
      <PerformanceHeader onClick={() => setExpanded(!expanded)}>
        <FiCpu /> Performance Settings 
        {fps && <ValueDisplay>{Math.round(fps)} FPS</ValueDisplay>}
      </PerformanceHeader>
      
      {expanded && (
        <>
          <PerformanceSection>
            <ControlRow>
              <ControlLabel htmlFor="prioritizePerformance">
                <FiZap /> High Performance Mode
              </ControlLabel>
              <Checkbox 
                type="checkbox" 
                id="prioritizePerformance" 
                checked={settings.prioritizePerformance} 
                onChange={handleBooleanChange('prioritizePerformance')}
              />
            </ControlRow>
            
            <ControlRow>
              <ControlLabel htmlFor="lowPowerMode">
                <FiBattery /> Battery Saving Mode
              </ControlLabel>
              <Checkbox 
                type="checkbox" 
                id="lowPowerMode" 
                checked={settings.lowPowerMode} 
                onChange={handleBooleanChange('lowPowerMode')}
              />
            </ControlRow>
            
            <ControlRow>
              <ControlLabel htmlFor="adaptiveQuality">
                <FiTrendingUp /> Adaptive Quality
              </ControlLabel>
              <Checkbox 
                type="checkbox" 
                id="adaptiveQuality" 
                checked={settings.adaptiveQuality} 
                onChange={handleBooleanChange('adaptiveQuality')}
              />
            </ControlRow>
          </PerformanceSection>
          
          <PerformanceSection>
            <ControlLabel htmlFor="pointSizeSlider">
              Point Size
            </ControlLabel>
            <SliderContainer>
              <RangeSlider
                type="range"
                id="pointSizeSlider"
                min="0.001"
                max="0.05"
                step="0.001"
                value={settings.pointSize}
                onChange={handleSliderChange('pointSize', 0.001, 0.05)}
              />
            </SliderContainer>
            <ValueDisplay>{settings.pointSize.toFixed(3)}</ValueDisplay>
          </PerformanceSection>
          
          <PerformanceSection>
            <ControlLabel htmlFor="maxPointsSlider">
              Max Points (thousands)
            </ControlLabel>
            <SliderContainer>
              <RangeSlider
                type="range"
                id="maxPointsSlider"
                min="10"
                max={settings.isM3 ? "5000" : "2000"}
                step="10"
                value={settings.maxPointsPerModel / 1000}
                onChange={(e) => {
                  const value = Number(e.target.value) * 1000;
                  onSettingsChange({ ...settings, maxPointsPerModel: value });
                }}
              />
            </SliderContainer>
            <ValueDisplay>{Math.round(settings.maxPointsPerModel / 1000)}K</ValueDisplay>
          </PerformanceSection>
          
          {memoryWarningLevel && (
            <MemoryWarning level={memoryWarningLevel}>
              <FiAlertTriangle />
              {memoryWarningLevel === 'critical' 
                ? 'Critical memory usage! Consider reducing model complexity.'
                : 'High memory usage. Performance may be affected.'}
            </MemoryWarning>
          )}
          
          {fps && fps < 30 && (
            <FPSIndicator fps={fps}>
              <FiTrendingUp />
              Low framerate detected ({Math.round(fps)} FPS).
              {settings.adaptiveQuality && ' Adaptive quality is enabled to improve performance.'}
            </FPSIndicator>
          )}
          
          {gpuInfo && (
            <div style={{ fontSize: '11px', color: '#888', marginTop: '10px' }}>
              {gpuInfo.isM3 && 'Optimized for Apple M3 GPU'}
              {!gpuInfo.isM3 && gpuInfo.isAppleSilicon && 'Optimized for Apple Silicon'}
              {!gpuInfo.isAppleSilicon && gpuInfo.renderer && `GPU: ${gpuInfo.renderer}`}
            </div>
          )}
        </>
      )}
    </PerformanceControlsContainer>
  );
};

export default SidebarPerformanceControls; 