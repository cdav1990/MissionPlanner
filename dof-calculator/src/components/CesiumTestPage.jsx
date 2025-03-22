import React from 'react';
import CesiumViewer from './CesiumViewer';
import styled from 'styled-components';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
`;

const Header = styled.div`
  background-color: #2a2a2a;
  color: white;
  padding: 8px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ViewerContainer = styled.div`
  flex-grow: 1;
  position: relative;
`;

const Button = styled.button`
  background-color: #4a77bf;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  
  &:hover {
    background-color: #3d63a0;
  }
`;

/**
 * Test page for Cesium Viewer integration
 */
const CesiumTestPage = () => {
  // You can modify these coordinates to test different locations
  const testLocations = [
    { name: 'San Francisco', latitude: 37.7749, longitude: -122.4194, height: 10000 },
    { name: 'New York', latitude: 40.7128, longitude: -74.0060, height: 10000 },
    { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, height: 10000 }
  ];
  
  const [currentLocation, setCurrentLocation] = React.useState(testLocations[0]);
  
  const handleLocationChange = (location) => {
    setCurrentLocation(location);
  };
  
  return (
    <PageContainer>
      <Header>
        <h2>Cesium Integration Test</h2>
        <div>
          {testLocations.map(location => (
            <Button 
              key={location.name}
              onClick={() => handleLocationChange(location)}
              style={{
                marginLeft: '10px',
                backgroundColor: currentLocation.name === location.name ? '#2c4c7f' : '#4a77bf'
              }}
            >
              {location.name}
            </Button>
          ))}
        </div>
      </Header>
      <ViewerContainer>
        <CesiumViewer 
          initialView={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            height: currentLocation.height
          }}
        />
      </ViewerContainer>
    </PageContainer>
  );
};

export default CesiumTestPage; 