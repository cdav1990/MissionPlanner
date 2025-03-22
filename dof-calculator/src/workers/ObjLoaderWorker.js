// Web Worker for background loading of OBJ files
// This prevents the main thread from being blocked during parsing of large models

// Log worker startup
console.log("OBJ Worker initialized");

// OBJ file parsing function
function parseOBJ(text) {
  try {
    // Initialize results data structures
    const vertices = [];
    const normals = [];
    const texcoords = [];
    const indices = [];
    const materials = new Map();
    
    let currentMaterial = '';
    let groups = [];
    let currentGroup = null;
    
    // Parse each line
    const lines = text.split('\n');
    let vertexOffset = 0;
    
    // First pass - measure only
    let vertexCount = 0;
    let normalCount = 0;
    let texcoordCount = 0;
    let faceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      
      const parts = line.split(/\s+/);
      const command = parts[0];
      
      if (command === 'v') vertexCount++;
      else if (command === 'vn') normalCount++;
      else if (command === 'vt') texcoordCount++;
      else if (command === 'f') faceCount++;
    }
    
    // Send initial stats
    self.postMessage({
      type: 'stats',
      vertexCount,
      normalCount,
      texcoordCount,
      faceCount,
      totalLines: lines.length
    });
    
    // Allocate arrays with the right size
    const vertexPositions = new Float32Array(vertexCount * 3);
    const vertexNormals = new Float32Array(normalCount * 3);
    const vertexTexcoords = new Float32Array(texcoordCount * 2);
    
    // Arrays for temporary data storage
    const tempVertices = [];
    const tempNormals = [];
    const tempTexcoords = [];
    const tempFaces = [];
    
    // Track progress
    let progress = 0;
    const progressStep = Math.max(1, Math.floor(lines.length / 100)); // Report progress every 1%
    
    // Second pass - parse all data
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      
      const parts = line.split(/\s+/);
      const command = parts[0];
      
      switch (command) {
        case 'v': // Vertex position
          tempVertices.push(
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          );
          break;
          
        case 'vn': // Vertex normal
          tempNormals.push(
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          );
          break;
          
        case 'vt': // Texture coordinate
          tempTexcoords.push(
            parseFloat(parts[1]),
            parts.length > 2 ? parseFloat(parts[2]) : 0
          );
          break;
          
        case 'f': // Face
          // OBJ format: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 ...
          const face = [];
          
          // Skip the 'f' part and process vertex specifications
          for (let j = 1; j < parts.length; j++) {
            const indices = parts[j].split('/');
            
            // In OBJ, indices are 1-based, so subtract 1
            // Also handle negative indices (relative to last vertex)
            const vertexIndex = parseInt(indices[0]);
            
            // Vertex position index (required)
            const vIdx = vertexIndex > 0 ? vertexIndex - 1 : tempVertices.length / 3 + vertexIndex;
            
            // Texture coordinate index (optional)
            let tIdx = -1;
            if (indices.length > 1 && indices[1] !== '') {
              const texcoordIndex = parseInt(indices[1]);
              tIdx = texcoordIndex > 0 ? texcoordIndex - 1 : tempTexcoords.length / 2 + texcoordIndex;
            }
            
            // Normal index (optional)
            let nIdx = -1;
            if (indices.length > 2 && indices[2] !== '') {
              const normalIndex = parseInt(indices[2]);
              nIdx = normalIndex > 0 ? normalIndex - 1 : tempNormals.length / 3 + normalIndex;
            }
            
            face.push({ vIdx, tIdx, nIdx });
          }
          
          // Triangulate if the face has more than 3 vertices
          if (face.length === 3) {
            // Already a triangle
            tempFaces.push(face);
          } else {
            // Triangulate (simple fan triangulation)
            for (let j = 1; j < face.length - 1; j++) {
              tempFaces.push([face[0], face[j], face[j + 1]]);
            }
          }
          break;
          
        case 'usemtl': // Use material
          currentMaterial = parts[1];
          break;
          
        case 'g': // Group
        case 'o': // Object
          currentGroup = parts.slice(1).join(' ');
          groups.push(currentGroup);
          break;
          
        default:
          // Ignore other commands
          break;
      }
      
      // Report progress periodically
      if (i % progressStep === 0) {
        progress = i / lines.length;
        self.postMessage({
          type: 'progress',
          progress,
          phase: 'parsing'
        });
      }
    }
    
    // Create a single result buffer to send back to main thread
    // Using transferable objects for better performance
    const result = {
      type: 'result',
      vertices: new Float32Array(tempVertices),
      normals: tempNormals.length > 0 ? new Float32Array(tempNormals) : null,
      texcoords: tempTexcoords.length > 0 ? new Float32Array(tempTexcoords) : null,
      groups: groups
    };
    
    // Create transferable objects array
    const transferables = [
      result.vertices.buffer
    ];
    
    if (result.normals) transferables.push(result.normals.buffer);
    if (result.texcoords) transferables.push(result.texcoords.buffer);
    
    // Send the final model data
    self.postMessage(result, transferables);
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: 'Error parsing OBJ: ' + (error.message || error)
    });
  }
}

// Worker message handler
self.onmessage = async function(e) {
  try {
    console.log('Worker received message:', e.data.type);
    const { type, url, data } = e.data;
    
    if (type === 'load') {
      // Load from URL
      self.postMessage({ type: 'progress', progress: 0, phase: 'downloading' });
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error, status = ${response.status}`);
        }
        
        // Get file size if available
        const contentLength = response.headers.get('content-length');
        let fileSize = 0;
        if (contentLength) {
          fileSize = parseInt(contentLength, 10);
        }
        
        // Create reader for streaming response body
        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;
        
        // Read the response body in chunks
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }
          
          chunks.push(value);
          receivedLength += value.length;
          
          if (fileSize > 0) {
            self.postMessage({ 
              type: 'progress', 
              progress: receivedLength / fileSize,
              receivedLength,
              totalLength: fileSize,
              phase: 'downloading'
            });
          }
        }
        
        // Combine all chunks into a single Uint8Array
        const chunksAll = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
          chunksAll.set(chunk, position);
          position += chunk.length;
        }
        
        // Convert to text
        const text = new TextDecoder('utf-8').decode(chunksAll);
        
        // Parse OBJ
        self.postMessage({ type: 'progress', progress: 0, phase: 'parsing' });
        parseOBJ(text);
      } catch (err) {
        console.error('Worker error during loading:', err);
        self.postMessage({ 
          type: 'error', 
          message: 'Error loading OBJ: ' + (err.message || err)
        });
      }
    } else if (type === 'parse') {
      // Parse data that was passed in directly
      self.postMessage({ type: 'progress', progress: 0, phase: 'parsing' });
      parseOBJ(data);
    }
  } catch (err) {
    console.error('Worker unhandled error:', err);
    self.postMessage({ 
      type: 'error', 
      message: 'Unhandled worker error: ' + (err.message || err)
    });
  }
}; 