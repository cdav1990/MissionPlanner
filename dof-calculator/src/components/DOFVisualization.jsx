import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import PropTypes from 'prop-types';

// Helper function to convert meters to feet
const metersToFeet = (meters) => meters * 3.28084;

// Threshold to display infinity symbol (when far limit is larger than this multiple of focus distance)
const INFINITY_DISPLAY_THRESHOLD = 15;

// Maximum visualization distance in meters
const MAX_VISUALIZATION_DISTANCE = 100;

const DOFVisualization = ({ dofData, distanceUnit, fieldOfView, groundCoverage }) => {
  const svgRef = useRef();
  
  useEffect(() => {
    if (!dofData || !svgRef.current) return;
    
    const { nearLimit, farLimit, focusDistance } = dofData;
    
    // Clear any existing visualization
    d3.select(svgRef.current).selectAll("*").remove();
    
    // Set up dimensions and constants
    const margin = { top: 15, right: 30, bottom: 35, left: 50 }; // Reduced margins
    const width = 550; // Slightly reduced width
    const height = 200; // Reduced height
    
    // Determine if far limit is effectively infinite for visualization purposes
    const isEffectivelyInfinite = farLimit > 10 * focusDistance || farLimit > 1000;
    
    // Define a fixed visualization range based on common photography distances
    // Using a fixed scale will prevent shifting when the subject distance changes
    const visualizationRanges = [
      { maxDistance: 5, scale: 10 },    // Close-up: 0-10m
      { maxDistance: 15, scale: 30 },   // Portrait: 0-30m
      { maxDistance: 30, scale: 60 },   // Group: 0-60m
      { maxDistance: 60, scale: 100 }   // Landscape: 0-100m
    ];
    
    // Select appropriate fixed scale based on focus distance
    let fixedMaxScale = MAX_VISUALIZATION_DISTANCE; // Default to max
    for (const range of visualizationRanges) {
      if (focusDistance <= range.maxDistance) {
        fixedMaxScale = range.scale;
        break;
      }
    }
    
    // Always start from 0 to ensure consistent anchoring to the left side
    const minValue = 0;
    // Use the fixed scale or cap at MAX_VISUALIZATION_DISTANCE
    const maxValue = Math.min(fixedMaxScale, MAX_VISUALIZATION_DISTANCE);
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("width", "100%")
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
    
    // Create a linear scale for distances instead of sqrt to prevent shifting
    const xScale = d3.scaleLinear()
      .domain([minValue, maxValue])
      .range([margin.left, width - margin.right]);
    
    // Calculate vertical center
    const centerY = height / 2;
    
    // Simplified artistic representation of field of view (optional)
    const topArtisticOffset = 40; // Simplified artistic height for visualization
    const bottomArtisticOffset = 40;
    
    // Calculate positions for focus point, near limit, and far limit
    const focusX = xScale(focusDistance);
    const nearX = xScale(nearLimit);
    const farX = isEffectivelyInfinite ? 
                 width - margin.right - 20 : 
                 // Cap the far limit display to the visible range if it exceeds the scale
                 (farLimit > maxValue ? width - margin.right - 20 : xScale(farLimit));
    
    // Add a camera icon on the far left
    const cameraX = margin.left - 25;
    const cameraY = centerY;
    
    // Camera body
    svg.append("rect")
      .attr("x", cameraX - 12)
      .attr("y", cameraY - 15)
      .attr("width", 24)
      .attr("height", 30)
      .attr("rx", 3)
      .attr("fill", "#444")
      .attr("stroke", "#777")
      .attr("stroke-width", 1);
    
    // Camera lens
    svg.append("circle")
      .attr("cx", cameraX)
      .attr("cy", cameraY)
      .attr("r", 8)
      .attr("fill", "#222")
      .attr("stroke", "#999")
      .attr("stroke-width", 1);
    
    // Camera lens reflection highlight
    svg.append("circle")
      .attr("cx", cameraX - 2)
      .attr("cy", cameraY - 2)
      .attr("r", 2)
      .attr("fill", "#fff")
      .attr("opacity", 0.6);
    
    // Camera viewfinder
    svg.append("rect")
      .attr("x", cameraX - 8)
      .attr("y", cameraY - 12)
      .attr("width", 6)
      .attr("height", 6)
      .attr("fill", "#333")
      .attr("stroke", "#777")
      .attr("stroke-width", 0.5);
    
    // Connect camera to field of view start
    svg.append("line")
      .attr("x1", cameraX + 12)
      .attr("y1", cameraY)
      .attr("x2", margin.left)
      .attr("y2", cameraY)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,2");
    
    // Create subtle artistic field of view boundary (more decorative, less technical)
    // Top curved line
    svg.append("path")
      .attr("d", `M ${margin.left} ${centerY - topArtisticOffset * 0.3} 
                 Q ${margin.left + (width - margin.left - margin.right) * 0.5} ${centerY - topArtisticOffset} 
                   ${width - margin.right} ${centerY - topArtisticOffset * 0.5}`)
      .attr("stroke", "#666")
      .attr("stroke-width", 0.7)
      .attr("fill", "none")
      .attr("opacity", 0.4)
      .attr("stroke-dasharray", "2,3");
    
    // Bottom curved line
    svg.append("path")
      .attr("d", `M ${margin.left} ${centerY + bottomArtisticOffset * 0.3} 
                 Q ${margin.left + (width - margin.left - margin.right) * 0.5} ${centerY + bottomArtisticOffset} 
                   ${width - margin.right} ${centerY + bottomArtisticOffset * 0.5}`)
      .attr("stroke", "#666")
      .attr("stroke-width", 0.7)
      .attr("fill", "none")
      .attr("opacity", 0.4)
      .attr("stroke-dasharray", "2,3");
    
    // Define the DOF fill area with simplified vertical bounds
    const areaGenerator = d3.area()
      .x(d => d.x)
      .y0(d => d.y0)
      .y1(d => d.y1)
      .curve(d3.curveLinear);
    
    // Create the DOF area data with simplified height calculation
    const dofAreaData = [
      { x: nearX, y0: centerY - 25, y1: centerY + 25 },
      { x: farX, y0: centerY - 25, y1: centerY + 25 }
    ];
    
    // Define a gradient for the DOF area - enhancing the gradient with better colors
    const defs = svg.append("defs");
    
    const gradient = defs.append("linearGradient")
      .attr("id", "dof-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
    
    // Enhanced gradient with more dramatic transition from edge to center
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "rgba(0, 147, 178, 0.1)");  // Teal-blue edge, transparent
    
    gradient.append("stop")
      .attr("offset", "15%")
      .attr("stop-color", "rgba(0, 162, 184, 0.35)");  // Teal transition
    
    gradient.append("stop")
      .attr("offset", "40%")
      .attr("stop-color", "rgba(0, 177, 190, 0.65)");  // Deeper teal approaching center
    
    gradient.append("stop")
      .attr("offset", "50%")
      .attr("stop-color", "rgba(0, 195, 206, 0.9)");  // Maximum opacity teal at center
    
    gradient.append("stop")
      .attr("offset", "60%")
      .attr("stop-color", "rgba(0, 177, 190, 0.65)");  // Deeper teal approaching center
    
    gradient.append("stop")
      .attr("offset", "85%")
      .attr("stop-color", "rgba(0, 162, 184, 0.35)");  // Teal transition
    
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "rgba(0, 147, 178, 0.1)");  // Teal-blue edge, transparent
    
    // Add a subtle radial gradient for a more 3D effect
    const radialGradient = defs.append("radialGradient")
      .attr("id", "dof-radial-gradient")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%")
      .attr("fx", "50%")
      .attr("fy", "50%");
    
    radialGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "rgba(220, 255, 255, 0.25)");  // Brighter teal highlight
    
    radialGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "rgba(0, 147, 178, 0)");  // Matching our teal scheme
    
    // Create a pattern for out-of-focus areas
    const outOfFocusPattern = defs.append("pattern")
      .attr("id", "out-of-focus-pattern")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 10)
      .attr("height", 10)
      .attr("patternTransform", "rotate(45)");
    
    outOfFocusPattern.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", "none");
    
    outOfFocusPattern.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 10)
      .attr("stroke", "rgba(25, 118, 210, 0.3)")
      .attr("stroke-width", 1);
    
    // Draw the DOF area with combined gradients for a better visual effect
    svg.append("path")
      .datum(dofAreaData)
      .attr("d", areaGenerator)
      .attr("fill", "url(#dof-gradient)")
      .attr("opacity", 0.9)
      .attr("stroke", "rgba(25, 118, 210, 0.5)")
      .attr("stroke-width", 1);
    
    // Add decorative overlay with radial gradient for depth effect
    svg.append("path")
      .datum(dofAreaData)
      .attr("d", areaGenerator)
      .attr("fill", "url(#dof-radial-gradient)")
      .attr("opacity", 0.6);
    
    // Create data for out-of-focus areas with fixed height
    const leftOutOfFocusData = [
      { x: margin.left, y0: centerY - 25, y1: centerY + 25 },
      { x: nearX, y0: centerY - 25, y1: centerY + 25 }
    ];
    
    const rightOutOfFocusData = [
      { x: farX, y0: centerY - 25, y1: centerY + 25 },
      { x: width - margin.right, y0: centerY - 25, y1: centerY + 25 }
    ];
    
    // Add pattern overlay for out-of-focus areas
    svg.append("path")
      .datum(leftOutOfFocusData)
      .attr("d", areaGenerator)
      .attr("fill", "url(#out-of-focus-pattern)")
      .attr("opacity", 0.7);
    
    if (!isEffectivelyInfinite) {
      svg.append("path")
        .datum(rightOutOfFocusData)
        .attr("d", areaGenerator)
        .attr("fill", "url(#out-of-focus-pattern)")
        .attr("opacity", 0.7);
    }
    
    // Add distance scale at the bottom
    const distanceScale = svg.append("g")
      .attr("class", "distance-scale")
      .attr("transform", `translate(0, ${height + 10})`);
    
    // Create evenly spaced scale divisions
    const numTicks = 5;
    const tickStep = maxValue / numTicks;
    const tickValues = [];
    
    for (let i = 0; i <= numTicks; i++) {
      tickValues.push(tickStep * i);
    }
    
    // Add a subtle background for better readability
    distanceScale.append("rect")
      .attr("x", margin.left - 5)
      .attr("y", -5)
      .attr("width", width - margin.left - margin.right + 10)
      .attr("height", 28)
      .attr("fill", "rgba(10, 20, 30, 0.7)")
      .attr("rx", 3);
    
    // Add horizontal line for scale
    distanceScale.append("line")
      .attr("x1", margin.left)
      .attr("y1", 0)
      .attr("x2", width - margin.right)
      .attr("y2", 0)
      .attr("stroke", "#aaa")  // Brighter color for better visibility
      .attr("stroke-width", 1.5);  // Thicker line
    
    // Add tick marks
    tickValues.forEach(val => {
      const xPos = xScale(val);
      
      // Draw tick mark
      distanceScale.append("line")
        .attr("x1", xPos)
        .attr("y1", -6)  // Extended above the line
        .attr("x2", xPos)
        .attr("y2", 6)   // Extended below the line
        .attr("stroke", "#aaa")  // Brighter color
        .attr("stroke-width", 1.5);  // Thicker line
      
      // Add tick label
      let label = val.toFixed(1);
      if (val > 10) label = Math.round(val);
      
      distanceScale.append("text")
        .attr("x", xPos)
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .attr("font-family", "sans-serif")
        .attr("font-size", "12px")  // Larger font
        .attr("font-weight", "bold")  // Bold text
        .attr("fill", "#ffffff")  // White text for better contrast
        .text(distanceUnit === 'm' ? `${label}m` : `${metersToFeet(val).toFixed(1)}ft`);
    });
    
    // Add the near limit marker
    svg.append("rect")
      .attr("x", nearX - 11)
      .attr("y", centerY - 33)
      .attr("width", 22)
      .attr("height", 22)
      .attr("fill", "#00839b")  // Darker teal for more contrast
      .attr("stroke", "#004956")  // Dark teal border
      .attr("stroke-width", 2)
      .attr("rx", 4);
    
    // Add the focus point marker
    svg.append("circle")
      .attr("cx", focusX)
      .attr("cy", centerY)
      .attr("r", 8)  // Slightly larger
      .attr("fill", "#ffffff")
      .attr("stroke", "#ff3333")  // Brighter red for higher contrast
      .attr("stroke-width", 3);  // Thicker stroke
    
    // Add the far limit marker (if not infinite)
    if (!isEffectivelyInfinite) {
      svg.append("rect")
        .attr("x", farX - 11)
        .attr("y", centerY + 11)
        .attr("width", 22)
        .attr("height", 22)
        .attr("fill", "#00839b")  // Darker teal for more contrast
        .attr("stroke", "#004956")  // Dark teal border
        .attr("stroke-width", 2)
        .attr("rx", 4);
    } else {
      // Add infinity symbol for effectively infinite far limit
      svg.append("text")
        .attr("x", farX - 10)
        .attr("y", centerY + 25)
        .attr("font-family", "sans-serif")
        .attr("font-size", "26px")
        .attr("font-weight", "bold")
        .attr("fill", "#00839b")
        .attr("stroke", "#004956")
        .attr("stroke-width", 0.5)
        .text("∞");
    }
    
    // Add label backgrounds for better visibility
    // Near limit label background
    svg.append("rect")
      .attr("x", nearX - 25)
      .attr("y", centerY - 55)
      .attr("width", 50)
      .attr("height", 18)
      .attr("fill", "rgba(0, 25, 40, 0.75)")
      .attr("rx", 3);
    
    // Focus point label background
    svg.append("rect")
      .attr("x", focusX - 25)
      .attr("y", centerY - 35)
      .attr("width", 50)
      .attr("height", 18)
      .attr("fill", "rgba(0, 25, 40, 0.75)")
      .attr("rx", 3);
    
    // Far limit label background (if not infinite)
    if (!isEffectivelyInfinite) {
      svg.append("rect")
        .attr("x", farX - 25)
        .attr("y", centerY + 45)
        .attr("width", 50)
        .attr("height", 18)
        .attr("fill", "rgba(0, 25, 40, 0.75)")
        .attr("rx", 3);
    } else {
      svg.append("rect")
        .attr("x", farX - 15)
        .attr("y", centerY + 45)
        .attr("width", 30)
        .attr("height", 18)
        .attr("fill", "rgba(0, 25, 40, 0.75)")
        .attr("rx", 3);
    }
    
    // Add distance labels with improved positioning
    svg.append("text")
      .attr("x", nearX)
      .attr("y", centerY - 42)
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "white")
      .text(distanceUnit === 'm' ? `${nearLimit.toFixed(1)}m` : `${metersToFeet(nearLimit).toFixed(1)}ft`);
    
    svg.append("text")
      .attr("x", focusX)
      .attr("y", centerY - 22)
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "white")
      .text(distanceUnit === 'm' ? `${focusDistance.toFixed(1)}m` : `${metersToFeet(focusDistance).toFixed(1)}ft`);
    
    if (!isEffectivelyInfinite) {
      svg.append("text")
        .attr("x", farX)
        .attr("y", centerY + 58)
        .attr("text-anchor", "middle")
        .attr("font-family", "sans-serif")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text(distanceUnit === 'm' ? `${farLimit.toFixed(1)}m` : `${metersToFeet(farLimit).toFixed(1)}ft`);
    } else {
      svg.append("text")
        .attr("x", farX)
        .attr("y", centerY + 58)
        .attr("text-anchor", "middle")
        .attr("font-family", "sans-serif")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("∞");
    }
    
    // Add element labels with improved positioning and background
    // Near limit label
    svg.append("rect")
      .attr("x", nearX - 30)
      .attr("y", centerY - 8)
      .attr("width", 60)
      .attr("height", 16)
      .attr("fill", "rgba(0, 25, 40, 0.7)")
      .attr("rx", 2);
    
    svg.append("text")
      .attr("x", nearX)
      .attr("y", centerY + 3)
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#ffffff")
      .text("Near Limit");
    
    // Focus point label
    svg.append("rect")
      .attr("x", focusX - 35)
      .attr("y", centerY + 17)
      .attr("width", 70)
      .attr("height", 16)
      .attr("fill", "rgba(0, 25, 40, 0.7)")
      .attr("rx", 2);
    
    svg.append("text")
      .attr("x", focusX)
      .attr("y", centerY + 28)
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#ffffff")
      .text("Focus Point");
    
    // Far limit label
    svg.append("rect")
      .attr("x", farX - 30)
      .attr("y", centerY + 32)
      .attr("width", 60)
      .attr("height", 16)
      .attr("fill", "rgba(0, 25, 40, 0.7)")
      .attr("rx", 2);
    
    svg.append("text")
      .attr("x", farX)
      .attr("y", centerY + 43)
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#ffffff")
      .text("Far Limit");
  }, [dofData, distanceUnit, fieldOfView, groundCoverage]);
  
  return (
    <svg 
      ref={svgRef} 
      className="dof-visualization" 
      width="100%" 
      height="200" // Reduced height
    />
  );
};

DOFVisualization.propTypes = {
  dofData: PropTypes.shape({
    nearLimit: PropTypes.number.isRequired,
    farLimit: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([Infinity])]).isRequired,
    focusDistance: PropTypes.number.isRequired,
    hyperfocal: PropTypes.number,
    totalDOF: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([Infinity])])
  }),
  distanceUnit: PropTypes.oneOf(['m', 'ft']),
  fieldOfView: PropTypes.number,
  groundCoverage: PropTypes.shape({
    width: PropTypes.number
  })
};

export default DOFVisualization; 