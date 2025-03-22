/**
 * Point Cloud Processor Worker
 * Handles computationally intensive tasks related to point cloud processing
 * 
 * This worker runs in a separate thread to keep the main thread responsive.
 */

// Cache for processed chunks to avoid redundant processing
const processedChunksCache = new Map();
let activeProcessor = null;

// Process point cloud data
function processPointCloudData(data, options) {
  const { buffer, pointsCount, stride, format, attributes } = data;
  const { filter, simplify, transformMatrix } = options;
  
  // Track processing start time
  const startTime = performance.now();
  
  // Create array buffer view
  const view = new DataView(buffer);
  let outputBuffer;
  
  try {
    // If this chunk has already been processed with the same options, return from cache
    const cacheKey = `${data.id || Math.random()}_${JSON.stringify(options)}`;
    if (processedChunksCache.has(cacheKey)) {
      return processedChunksCache.get(cacheKey);
    }
    
    // Process the points
    const result = processPoints(view, pointsCount, stride, format, attributes, options);
    
    // Cache the result for future reuse
    if (cacheKey && result.success) {
      // Only cache successful results and limit cache size to 20 entries
      if (processedChunksCache.size > 20) {
        // Remove oldest entry
        const firstKey = processedChunksCache.keys().next().value;
        processedChunksCache.delete(firstKey);
      }
      processedChunksCache.set(cacheKey, result);
    }
    
    // Track processing time
    const processingTime = performance.now() - startTime;
    result.processingTimeMs = processingTime;
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      processingTimeMs: performance.now() - startTime
    };
  }
}

// Process individual points based on format and attributes
function processPoints(view, pointsCount, stride, format, attributes, options) {
  // Create output buffer with appropriate size based on simplification factor
  const simplificationFactor = options.simplify ? options.simplify : 1;
  const outputPointCount = Math.ceil(pointsCount / simplificationFactor);
  const outputStride = stride; // Keep the same stride for now
  const outputBufferSize = outputPointCount * outputStride;
  
  // Create output buffer
  const outputBuffer = new ArrayBuffer(outputBufferSize);
  const outputView = new DataView(outputBuffer);
  
  // Track how many points are actually used after filtering
  let outputPointIndex = 0;
  
  // Process each point
  for (let i = 0; i < pointsCount; i++) {
    // Apply simplification - skip points based on simplification factor
    if (simplificationFactor > 1 && (i % simplificationFactor !== 0)) {
      continue;
    }
    
    // Starting position for this point in the input buffer
    const pointOffset = i * stride;
    
    // Extract point data based on format
    const point = extractPointData(view, pointOffset, format, attributes);
    
    // Apply filter if provided
    if (options.filter && !options.filter(point)) {
      continue;
    }
    
    // Apply transformation if provided
    if (options.transformMatrix) {
      applyTransformation(point, options.transformMatrix);
    }
    
    // Write processed point to output buffer
    writePointToBuffer(outputView, outputPointIndex * outputStride, point, format, attributes);
    outputPointIndex++;
    
    // Report progress periodically
    if (i % 10000 === 0) {
      const progress = i / pointsCount;
      self.postMessage({
        type: 'progress',
        progress,
        pointsProcessed: i
      });
    }
  }
  
  // If we filtered out some points, trim the buffer
  let finalBuffer = outputBuffer;
  if (outputPointIndex < outputPointCount) {
    finalBuffer = outputBuffer.slice(0, outputPointIndex * outputStride);
  }
  
  return {
    success: true,
    buffer: finalBuffer,
    pointsCount: outputPointIndex,
    stride: outputStride,
    format: format
  };
}

// Extract point data from the buffer based on format
function extractPointData(view, offset, format, attributes) {
  const point = {};
  
  // Process each attribute
  attributes.forEach(attr => {
    switch (attr.name) {
      case 'position':
        if (attr.type === 'FLOAT32') {
          point.x = view.getFloat32(offset + attr.offset, true);
          point.y = view.getFloat32(offset + attr.offset + 4, true);
          point.z = view.getFloat32(offset + attr.offset + 8, true);
        } else {
          // Handle other types like INT16 etc.
          const scale = attr.scale || 1;
          point.x = view.getInt16(offset + attr.offset, true) * scale;
          point.y = view.getInt16(offset + attr.offset + 2, true) * scale;
          point.z = view.getInt16(offset + attr.offset + 4, true) * scale;
        }
        break;
        
      case 'color':
        if (attr.type === 'UINT8') {
          point.r = view.getUint8(offset + attr.offset);
          point.g = view.getUint8(offset + attr.offset + 1);
          point.b = view.getUint8(offset + attr.offset + 2);
          if (attr.size === 4) {
            point.a = view.getUint8(offset + attr.offset + 3);
          } else {
            point.a = 255;
          }
        }
        break;
        
      case 'normal':
        if (attr.type === 'FLOAT32') {
          point.nx = view.getFloat32(offset + attr.offset, true);
          point.ny = view.getFloat32(offset + attr.offset + 4, true);
          point.nz = view.getFloat32(offset + attr.offset + 8, true);
        } else if (attr.type === 'INT8') {
          // Normals are often stored as signed bytes (-128 to 127) and need to be normalized
          point.nx = view.getInt8(offset + attr.offset) / 127.0;
          point.ny = view.getInt8(offset + attr.offset + 1) / 127.0;
          point.nz = view.getInt8(offset + attr.offset + 2) / 127.0;
        }
        break;
        
      case 'intensity':
        if (attr.type === 'UINT16') {
          point.intensity = view.getUint16(offset + attr.offset, true);
        } else if (attr.type === 'FLOAT32') {
          point.intensity = view.getFloat32(offset + attr.offset, true);
        }
        break;
        
      default:
        // Handle any custom attributes
        if (attr.type === 'FLOAT32') {
          point[attr.name] = view.getFloat32(offset + attr.offset, true);
        } else if (attr.type === 'UINT16') {
          point[attr.name] = view.getUint16(offset + attr.offset, true);
        } else if (attr.type === 'UINT8') {
          point[attr.name] = view.getUint8(offset + attr.offset);
        }
    }
  });
  
  return point;
}

// Write point back to buffer
function writePointToBuffer(view, offset, point, format, attributes) {
  // Process each attribute
  attributes.forEach(attr => {
    switch (attr.name) {
      case 'position':
        if (attr.type === 'FLOAT32') {
          view.setFloat32(offset + attr.offset, point.x, true);
          view.setFloat32(offset + attr.offset + 4, point.y, true);
          view.setFloat32(offset + attr.offset + 8, point.z, true);
        } else {
          // Handle other types
          const scale = attr.scale || 1;
          view.setInt16(offset + attr.offset, point.x / scale, true);
          view.setInt16(offset + attr.offset + 2, point.y / scale, true);
          view.setInt16(offset + attr.offset + 4, point.z / scale, true);
        }
        break;
        
      case 'color':
        if (attr.type === 'UINT8') {
          view.setUint8(offset + attr.offset, point.r);
          view.setUint8(offset + attr.offset + 1, point.g);
          view.setUint8(offset + attr.offset + 2, point.b);
          if (attr.size === 4) {
            view.setUint8(offset + attr.offset + 3, point.a || 255);
          }
        }
        break;
        
      case 'normal':
        if (attr.type === 'FLOAT32') {
          view.setFloat32(offset + attr.offset, point.nx, true);
          view.setFloat32(offset + attr.offset + 4, point.ny, true);
          view.setFloat32(offset + attr.offset + 8, point.nz, true);
        } else if (attr.type === 'INT8') {
          view.setInt8(offset + attr.offset, Math.round(point.nx * 127));
          view.setInt8(offset + attr.offset + 1, Math.round(point.ny * 127));
          view.setInt8(offset + attr.offset + 2, Math.round(point.nz * 127));
        }
        break;
        
      case 'intensity':
        if (attr.type === 'UINT16') {
          view.setUint16(offset + attr.offset, point.intensity, true);
        } else if (attr.type === 'FLOAT32') {
          view.setFloat32(offset + attr.offset, point.intensity, true);
        }
        break;
        
      default:
        // Handle any custom attributes
        if (attr.type === 'FLOAT32') {
          view.setFloat32(offset + attr.offset, point[attr.name], true);
        } else if (attr.type === 'UINT16') {
          view.setUint16(offset + attr.offset, point[attr.name], true);
        } else if (attr.type === 'UINT8') {
          view.setUint8(offset + attr.offset, point[attr.name]);
        }
    }
  });
}

// Apply 4x4 transformation matrix to a point
function applyTransformation(point, matrix) {
  const x = point.x;
  const y = point.y;
  const z = point.z;
  
  point.x = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  point.y = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  point.z = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  
  // If normals are present, transform them too (without translation)
  if ('nx' in point && 'ny' in point && 'nz' in point) {
    const nx = point.nx;
    const ny = point.ny;
    const nz = point.nz;
    
    point.nx = matrix[0] * nx + matrix[4] * ny + matrix[8] * nz;
    point.ny = matrix[1] * nx + matrix[5] * ny + matrix[9] * nz;
    point.nz = matrix[2] * nx + matrix[6] * ny + matrix[10] * nz;
    
    // Normalize the normal vector
    const length = Math.sqrt(point.nx * point.nx + point.ny * point.ny + point.nz * point.nz);
    if (length > 0) {
      point.nx /= length;
      point.ny /= length;
      point.nz /= length;
    }
  }
}

// Handle messages from the main thread
self.onmessage = function(e) {
  const { type, data, options, id } = e.data;
  
  switch (type) {
    case 'process':
      // Store current process ID to allow cancellation
      activeProcessor = id;
      
      // Process the data
      const result = processPointCloudData(data, options || {});
      
      // Check if this process was cancelled before sending result
      if (activeProcessor === id) {
        self.postMessage({
          type: 'result',
          result: result,
          id: id
        }, result.success ? [result.buffer] : []);
      }
      break;
      
    case 'cancel':
      // Cancel the current processing if ID matches
      if (activeProcessor === id) {
        activeProcessor = null;
        self.postMessage({
          type: 'cancelled',
          id: id
        });
      }
      break;
      
    case 'clear_cache':
      // Clear the processing cache
      processedChunksCache.clear();
      self.postMessage({
        type: 'cache_cleared'
      });
      break;
  }
}; 