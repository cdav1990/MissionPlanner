// Components that need to be replaced in MissionPlanner.jsx

// Styled components for model controls to match drone control UI
const ModelControlGroup = styled.div`
  margin-bottom: 15px;
`;

const ControlLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #ccc;
`;

const ModelControlItem = styled.div`
  display: grid;
  grid-template-columns: 75px 1fr 60px;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  width: 100%;
`;

// Enhanced slider components with react-slider
const StyledSlider = styled(ReactSlider)`
  width: 100%;
  height: 20px;
  touch-action: none;
`;

// Define the thumb component separately
const SliderThumb = styled.div`
  height: 20px;
  width: 20px;
  background-color: white;
  border-radius: 50%;
  border: 2px solid #4f88e3;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: grab;
  top: -6px;
  outline: none;
  transition: transform 0.1s ease, background-color 0.1s ease;
  
  &:hover {
    background-color: #f0f8ff;
    transform: scale(1.1);
  }
  
  &:active {
    cursor: grabbing;
    background-color: #e6f0ff;
    transform: scale(1.15);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
  }
`;

// Define the track component
const SliderTrack = styled.div`
  top: 6px;
  height: 8px;
  background: ${props => props.index === 1 ? '#333' : 'linear-gradient(to right, #1a5bb7, #4f88e3)'};
  border-radius: 4px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
`;

const EnhancedNumberInput = styled.input`
  width: 65px;
  height: 28px;
  padding: 4px 8px;
  background: rgba(20, 20, 20, 0.7);
  color: #fff;
  border: 1px solid rgba(80, 80, 80, 0.5);
  border-radius: 4px;
  font-size: 0.9rem;
  text-align: center;
  outline: none;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(100, 100, 100, 0.7);
  }

  &:focus {
    border-color: #2596ff;
    box-shadow: 0 0 0 2px rgba(0, 120, 255, 0.3);
  }

  /* Hide spin buttons */
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  /* Firefox */
  -moz-appearance: textfield;
`;

// Define ALL styled components for drone controls
const DroneControlWrapper = styled.div`
  background: rgba(30, 30, 30, 0.3);
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const DroneControlGroup = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DroneControlGroupLabel = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: #ddd;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
`;

const DroneControlItem = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DroneControlItemLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #ccc;
  
  span:first-child {
    font-weight: 500;
  }
  
  span:last-child {
    font-size: 0.85rem;
    color: #65b1ff;
    font-weight: 500;
    background: rgba(30, 60, 120, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    min-width: 50px;
    text-align: center;
    transition: background-color 0.2s ease;
  }
`;

const DroneControlRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 65px;
  align-items: center;
  gap: 12px;
`; 