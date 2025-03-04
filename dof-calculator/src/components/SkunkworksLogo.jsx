import React from "react";
import skunkImage from '../assets/skunk-image.png';

function SkunkworksLogo() {
  return (
    <div className="skunkworks-logo-container">
      <img
        src={skunkImage}
        alt="Skunkworks Logo"
        style={{ 
          width: "100px", 
          height: "100px",
          objectFit: "contain"
        }}
      />
      <div className="skunkworks-text">SKUNK WORKS</div>
    </div>
  );
}

export default SkunkworksLogo; 