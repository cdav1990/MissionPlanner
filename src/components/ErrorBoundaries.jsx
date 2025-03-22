import React from 'react';
import { Html } from '@react-three/drei';

// Default fallback UI for the generic error boundary
const DefaultFallbackUI = ({ error }) => (
  <div style={{ 
    padding: '20px', 
    backgroundColor: '#ffdddd', 
    border: '1px solid #ff0000',
    borderRadius: '5px',
    margin: '10px'
  }}>
    <h3>Something went wrong</h3>
    <p>{error?.message || 'Unknown error occurred'}</p>
    <button 
      onClick={() => window.location.reload()}
      style={{ 
        padding: '8px 16px', 
        backgroundColor: '#f44336', 
        color: 'white', 
        border: 'none', 
        borderRadius: '4px', 
        cursor: 'pointer',
        marginTop: '10px'
      }}
    >
      Reload Page
    </button>
  </div>
);

// Model loading error boundary component
export class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error in ModelLoader:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html position={[0, 2, 0]}>
          <div style={{ 
            background: 'rgba(255,50,50,0.8)', 
            color: 'white', 
            padding: '10px',
            borderRadius: '5px',
            maxWidth: '250px',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
              Error loading 3D model
            </div>
            <div style={{ fontSize: '13px' }}>
              {this.state.error?.message || "Unknown error"}
            </div>
          </div>
        </Html>
      );
    }

    return this.props.children;
  }
}

// Canvas-level error boundary to catch all R3F errors
export class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      recoveryAttempts: 0,
      lastErrorTime: 0
    };
    
    // Track WebGL context loss globally across component instances
    if (!window._webGLContextErrors) {
      window._webGLContextErrors = {
        count: 0,
        lastTime: 0,
        isInCooldown: false
      };
    }
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error("Canvas rendering error:", error);
    console.error("Error details:", errorInfo);
    
    // Update state with error details
    const now = Date.now();
    this.setState(prevState => ({
      errorInfo,
      recoveryAttempts: prevState.recoveryAttempts + 1,
      lastErrorTime: now
    }));
    
    // Update global WebGL context error tracking
    if (error.message && (
        error.message.includes("WebGL") || 
        error.message.includes("GPU") || 
        error.message.includes("context") ||
        error.message.includes("CONTEXT_LOST_WEBGL")
      )) {
      window._webGLContextErrors.count++;
      window._webGLContextErrors.lastTime = now;
      
      // If we have multiple context errors in a short period, enter cooldown
      if (window._webGLContextErrors.count > 2 && 
          now - window._webGLContextErrors.lastTime < 10000) {
        window._webGLContextErrors.isInCooldown = true;
        setTimeout(() => {
          window._webGLContextErrors.isInCooldown = false;
          window._webGLContextErrors.count = 0;
        }, 30000); // 30 second cooldown
      }
    }
  }
  
  // Try to recover from WebGL context loss
  attemptContextRecovery = () => {
    if (window._webGLContextErrors.isInCooldown) {
      console.log("In WebGL error cooldown period. Waiting before retry...");
      return;
    }
    
    // Find canvas element
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    try {
      // Try to restore using WEBGL_lose_context extension
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
          console.log("Attempting WebGL context recovery...");
          setTimeout(() => {
            try {
              ext.restoreContext();
              console.log("WebGL context restore requested");
              
              // Reset error state after a short delay to allow context to restore
              setTimeout(() => {
                this.setState({ 
                  hasError: false, 
                  error: null, 
                  errorInfo: null 
                });
              }, 500);
            } catch (e) {
              console.error("Failed to restore WebGL context:", e);
            }
          }, 1000);
        }
      }
    } catch (e) {
      console.error("Error during WebGL recovery attempt:", e);
    }
  }
  
  // Reset error state and try to re-render
  handleRetry = () => {
    // Attempt WebGL context recovery first
    this.attemptContextRecovery();
    
    // Clean up Three.js cached resources
    if (window.THREE && window.THREE.Cache) {
      window.THREE.Cache.clear();
    }
    
    // Reset error state
    this.setState({
      hasError: false,
      error: null
    });
  }
  
  render() {
    if (this.state.hasError) {
      const isWebGLError = this.state.error && (
        String(this.state.error).includes("WebGL") ||
        String(this.state.error).includes("CONTEXT_LOST_WEBGL") ||
        String(this.state.error).includes("GPU") ||
        String(this.state.error).includes("context")
      );
      
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          flexDirection: 'column',
          padding: '20px',
          boxSizing: 'border-box',
          overflow: 'auto'
        }}>
          <div style={{
            background: 'rgba(255,50,50,0.15)',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '80%',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#ff5555', marginTop: 0 }}>
              {isWebGLError ? '3D Rendering Error' : 'Application Error'}
            </h2>
            
            <p>{this.state.error?.message || String(this.state.error) || 'An unknown error occurred'}</p>
            
            {isWebGLError && (
              <div style={{ marginTop: '20px', fontSize: '14px', textAlign: 'left' }}>
                <h4>Troubleshooting steps:</h4>
                <ol style={{ paddingLeft: '20px' }}>
                  <li>Check if your browser supports WebGL (<a href="https://get.webgl.org/" target="_blank" rel="noreferrer" style={{color: '#4f88e3'}}>Test here</a>)</li>
                  <li>Update your graphics drivers</li>
                  <li>Try a different browser (Chrome or Firefox recommended)</li>
                  <li>Disable hardware acceleration in browser settings</li>
                  <li>Close other intensive applications</li>
                </ol>
              </div>
            )}
            
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '10px 20px',
                  background: '#4f88e3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                Retry
              </button>
              
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  background: '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
            </div>
            
            {this.state.recoveryAttempts > 2 && (
              <div style={{ marginTop: '20px', fontSize: '13px', opacity: 0.8 }}>
                <p>Multiple recovery attempts failed. Consider using 2D mode.</p>
                <button
                  onClick={() => {
                    window.__FORCE_2D_MODE = true;
                    window.location.reload();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#2d2d2d',
                    color: 'white',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Switch to 2D Mode
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Generic error boundary that can be used anywhere in the app
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultFallbackUI;
      return <FallbackComponent error={this.state.error} />;
    }
    
    return this.props.children;
  }
} 