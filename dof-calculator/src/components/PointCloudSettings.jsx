import React from 'react';
import styled from 'styled-components';
import { checkSystemCapabilities } from '../utils/PotreeUtils';

const SettingsContainer = styled.div`
  margin-top: 10px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 6px;
  color: white;
`;

const SettingGroup = styled.div`
  margin-bottom: 12px;
`;

const SettingLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 0.9em;
`;

const SliderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Slider = styled.input.attrs({ type: 'range' })`
  flex: 1;
  height: 6px;
  background: #222;
  border-radius: 3px;
  appearance: none;
  outline: none;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    background: #3a7fff;
    border-radius: 50%;
    cursor: pointer;
  }
`;

const ValueDisplay = styled.div`
  min-width: 50px;
  text-align: right;
  font-size: 0.8em;
  font-family: monospace;
`;

const ToggleSwitch = styled.div`
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  
  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #444;
    transition: 0.3s;
    border-radius: 20px;
    
    &:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }
  
  input:checked + span {
    background-color: #3a7fff;
  }
  
  input:checked + span:before {
    transform: translateX(16px);
  }
`;

const InfoText = styled.div`
  font-size: 0.8em;
  color: #aaa;
  margin-top: 4px;
`;

const WarningText = styled.div`
  font-size: 0.8em;
  color: #ff9966;
  margin-top: 4px;
`;

/**
 * Point Cloud Settings UI component
 * 
 * @param {object} props
 * @param {object} props.settings Current settings
 * @param {function} props.onChange Callback when settings change
 */
const PointCloudSettings = ({ settings, onChange }) => {
  const {
    pointBudget = 100_000,
    maxLod = 10,
    enableEDL = false,
    enableClipping = false,
    pointSize = 0.05,
    opacity = 1.0
  } = settings || {};
  
  const systemCaps = checkSystemCapabilities();
  
  const handleChange = (key, value) => {
    if (onChange) {
      onChange({ ...settings, [key]: value });
    }
  };

  const formatPointBudget = (value) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toString();
  };
  
  return (
    <SettingsContainer>
      <h3 style={{ marginTop: 0, fontSize: '1em' }}>Point Cloud Settings</h3>
      
      <SettingGroup>
        <SettingLabel>
          <span>Point Budget</span>
          <ValueDisplay>{formatPointBudget(pointBudget)} pts</ValueDisplay>
        </SettingLabel>
        <SliderContainer>
          <Slider
            min={10000}
            max={5000000}
            step={10000}
            value={pointBudget}
            onChange={(e) => handleChange('pointBudget', parseInt(e.target.value))}
          />
        </SliderContainer>
        <InfoText>
          Maximum points to render at once. Higher values require more GPU memory.
          {systemCaps.devicePerformanceLevel && (
            <span> Recommended: {formatPointBudget(systemCaps.maxPointsRecommended)} for your {systemCaps.devicePerformanceLevel} performance GPU.</span>
          )}
        </InfoText>
        {pointBudget > systemCaps.maxPointsRecommended && (
          <WarningText>
            Current value exceeds recommended limit for your system. May cause WebGL context loss.
          </WarningText>
        )}
      </SettingGroup>

      <SettingGroup>
        <SettingLabel>
          <span>Max Level of Detail (LOD)</span>
          <ValueDisplay>{maxLod}</ValueDisplay>
        </SettingLabel>
        <SliderContainer>
          <Slider
            min={1}
            max={20}
            step={1}
            value={maxLod}
            onChange={(e) => handleChange('maxLod', parseInt(e.target.value))}
          />
        </SliderContainer>
        <InfoText>
          Maximum octree depth to load. Lower values load less detail but improve performance.
        </InfoText>
      </SettingGroup>
      
      <SettingGroup>
        <SettingLabel>
          <span>Point Size</span>
          <ValueDisplay>{pointSize.toFixed(2)}</ValueDisplay>
        </SettingLabel>
        <SliderContainer>
          <Slider
            min={0.01}
            max={0.2}
            step={0.01}
            value={pointSize}
            onChange={(e) => handleChange('pointSize', parseFloat(e.target.value))}
          />
        </SliderContainer>
      </SettingGroup>
      
      <SettingGroup>
        <SettingLabel>
          <span>Point Opacity</span>
          <ValueDisplay>{opacity.toFixed(2)}</ValueDisplay>
        </SettingLabel>
        <SliderContainer>
          <Slider
            min={0.1}
            max={1.0}
            step={0.05}
            value={opacity}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
          />
        </SliderContainer>
      </SettingGroup>
      
      <SettingGroup>
        <SettingLabel>
          <span>Eye-Dome Lighting (EDL)</span>
          <ToggleSwitch>
            <input
              type="checkbox"
              checked={enableEDL}
              onChange={(e) => handleChange('enableEDL', e.target.checked)}
            />
            <span />
          </ToggleSwitch>
        </SettingLabel>
        <InfoText>
          Enhances depth perception but can be GPU-intensive. Disable if experiencing performance issues.
        </InfoText>
      </SettingGroup>
      
      <SettingGroup>
        <SettingLabel>
          <span>Clipping Planes</span>
          <ToggleSwitch>
            <input
              type="checkbox"
              checked={enableClipping}
              onChange={(e) => handleChange('enableClipping', e.target.checked)}
            />
            <span />
          </ToggleSwitch>
        </SettingLabel>
        <InfoText>
          Enables clipping planes to see inside point clouds.
        </InfoText>
      </SettingGroup>
    </SettingsContainer>
  );
};

export default PointCloudSettings; 