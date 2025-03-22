/**
 * Point Cloud Worker
 * This worker handles heavy point cloud processing in a separate thread
 * to prevent blocking the main UI thread.
 */

// Handle messages from the main thread
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'process_point_cloud':
        processPointCloud(data);
        break;
      case 'downsample':
        downsamplePointCloud(data);
        break;
      default:
        self.postMessage({
          error: `Unknown command: ${type}`
        });
    }
  } catch (err) {
    self.postMessage({
      error: err.message,
      errorType: err.name,
      command: type
    });
  }
};

/**
 * Process a point cloud to prepare it for rendering
 * @param {Object} data - Point cloud data
 */
function processPointCloud(data) {
  const { points, colors, normals, format } = data;
  
  // Create progress tracker
  let progress = 0;
  const total = points.length / 3;
  const reportInterval = Math.max(1, Math.floor(total / 20)); // Report ~20 times
  
  // Process in chunks to prevent blocking
  processChunk(points, colors, normals, 0, reportInterval);
}

/**
 * Process a chunk of point cloud data
 */
function processChunk(points, colors, normals, startIdx, chunkSize) {
  const endIdx = Math.min(startIdx + chunkSize, points.length / 3);
  const total = points.length / 3;
  
  // Process the chunk
  const processedPoints = [];
  const processedColors = [];
  const processedNormals = [];
  
  for (let i = startIdx; i < endIdx; i++) {
    const idx = i * 3;
    
    // Add the point
    processedPoints.push(points[idx], points[idx + 1], points[idx + 2]);
    
    // Add the color if available
    if (colors && colors.length >= idx + 3) {
      processedColors.push(colors[idx], colors[idx + 1], colors[idx + 2]);
    }
    
    // Add the normal if available
    if (normals && normals.length >= idx + 3) {
      processedNormals.push(normals[idx], normals[idx + 1], normals[idx + 2]);
    }
  }
  
  // Report progress
  const progressPercent = Math.min(100, Math.round((endIdx / total) * 100));
  self.postMessage({
    type: 'progress',
    progress: progressPercent,
    processedCount: endIdx
  });
  
  // If we've processed all points
  if (endIdx >= total) {
    self.postMessage({
      type: 'complete',
      points: processedPoints,
      colors: processedColors.length > 0 ? processedColors : null,
      normals: processedNormals.length > 0 ? processedNormals : null,
      count: processedPoints.length / 3
    });
    return;
  }
  
  // Process the next chunk
  setTimeout(() => {
    processChunk(points, colors, normals, endIdx, chunkSize);
  }, 0);
}

/**
 * Downsample a point cloud to reduce point count
 * @param {Object} data - Point cloud data and target count
 */
function downsamplePointCloud(data) {
  const { points, colors, normals, targetCount } = data;
  const total = points.length / 3;
  
  // If we don't need to downsample
  if (total <= targetCount) {
    self.postMessage({
      type: 'complete',
      points: points,
      colors: colors,
      normals: normals,
      count: total
    });
    return;
  }
  
  // Calculate sampling rate
  const samplingRate = targetCount / total;
  
  // Prepare downsampled arrays
  const sampledPoints = [];
  const sampledColors = colors ? [] : null;
  const sampledNormals = normals ? [] : null;
  
  // Sample the points
  for (let i = 0; i < total; i++) {
    // Skip points based on sampling rate
    if (Math.random() > samplingRate) continue;
    
    const idx = i * 3;
    sampledPoints.push(points[idx], points[idx + 1], points[idx + 2]);
    
    if (sampledColors) {
      sampledColors.push(colors[idx], colors[idx + 1], colors[idx + 2]);
    }
    
    if (sampledNormals) {
      sampledNormals.push(normals[idx], normals[idx + 1], normals[idx + 2]);
    }
    
    // Report progress occasionally
    if (i % 50000 === 0) {
      self.postMessage({
        type: 'progress',
        progress: Math.min(100, Math.round((i / total) * 100)),
        processedCount: i
      });
    }
  }
  
  // Return the downsampled point cloud
  self.postMessage({
    type: 'complete',
    points: sampledPoints,
    colors: sampledColors,
    normals: sampledNormals,
    count: sampledPoints.length / 3,
    originalCount: total,
    reduction: (1 - (sampledPoints.length / 3) / total) * 100
  });
} 