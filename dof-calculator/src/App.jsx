import React, { useState } from 'react';
import MainLayout from './components/MainLayout';
import CesiumTestPage from './components/CesiumTestPage';
import './App.css';
import './components/droneMissionStyles.css';
import styled from 'styled-components';

console.log('App component rendering');

const TabsContainer = styled.div`
  background-color: #333;
  color: white;
  display: flex;
  gap: 1px;
`;

const Tab = styled.button`
  background-color: ${props => props.active ? '#4a77bf' : '#222'};
  color: white;
  padding: 10px 15px;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${props => props.active ? '#4a77bf' : '#444'};
  }
`;

function App() {
  const [activeTab, setActiveTab] = useState('three'); // Default to Three.js view

  return (
    <div className="App">
      <TabsContainer>
        <Tab 
          active={activeTab === 'three'} 
          onClick={() => setActiveTab('three')}
        >
          Three.js Scene
        </Tab>
        <Tab 
          active={activeTab === 'cesium'} 
          onClick={() => setActiveTab('cesium')}
        >
          Cesium Globe
        </Tab>
      </TabsContainer>
      
      {activeTab === 'three' ? (
        <MainLayout />
      ) : (
        <CesiumTestPage />
      )}
    </div>
  );
}

export default App;
