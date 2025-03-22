/**
 * Worker Pool Utility
 * Manages a pool of web workers for multi-threaded processing
 */

import { getThreadSettings } from './PlatformDetection';

class WorkerPool {
  constructor(workerScript, options = {}) {
    const { maxWorkers, terminateOnDispose = true } = options;
    
    // Get thread settings based on platform
    const threadSettings = getThreadSettings();
    
    // Determine the number of workers to create
    this.maxWorkers = maxWorkers || threadSettings.poolSize || 
                      Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
    
    // Array to hold worker instances
    this.workers = [];
    
    // Queue of pending tasks
    this.taskQueue = [];
    
    // Track which workers are currently busy
    this.busyWorkers = new Set();
    
    // Map of task IDs to their callbacks
    this.taskCallbacks = new Map();
    
    // Counter for generating unique task IDs
    this.taskIdCounter = 0;
    
    // Flag to terminate workers when pool is disposed
    this.terminateOnDispose = terminateOnDispose;
    
    // Path to worker script
    this.workerScript = workerScript;
    
    // Performance metrics
    this.metrics = {
      tasksProcessed: 0,
      totalProcessingTime: 0,
      peakQueueLength: 0,
      avgProcessingTime: 0
    };
    
    // Initialize workers
    this.initializeWorkers();
    
    console.log(`Worker pool initialized with ${this.maxWorkers} workers`);
  }
  
  // Initialize the worker pool
  initializeWorkers() {
    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = new Worker(this.workerScript);
        
        // Set up message handler
        worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
        
        // Set up error handler
        worker.onerror = (error) => {
          console.error(`Worker error:`, error);
          // Mark worker as available despite error
          this.busyWorkers.delete(worker);
          this.processQueue();
        };
        
        this.workers.push(worker);
      } catch (error) {
        console.error(`Failed to create worker ${i}:`, error);
      }
    }
  }
  
  // Handle messages from workers
  handleWorkerMessage(worker, event) {
    const { type, id, result } = event.data;
    
    // Process different message types
    switch (type) {
      case 'result':
        // Task completed
        if (this.taskCallbacks.has(id)) {
          const { resolve, startTime } = this.taskCallbacks.get(id);
          const processingTime = performance.now() - startTime;
          
          // Update metrics
          this.metrics.tasksProcessed++;
          this.metrics.totalProcessingTime += processingTime;
          this.metrics.avgProcessingTime = this.metrics.totalProcessingTime / this.metrics.tasksProcessed;
          
          // Resolve the promise with the result
          resolve(result);
          
          // Clean up
          this.taskCallbacks.delete(id);
        }
        
        // Mark worker as available
        this.busyWorkers.delete(worker);
        
        // Process next task in queue
        this.processQueue();
        break;
        
      case 'progress':
        // Progress update
        if (this.taskCallbacks.has(id)) {
          const { onProgress } = this.taskCallbacks.get(id);
          if (onProgress) {
            onProgress(event.data);
          }
        }
        break;
        
      case 'cancelled':
        // Task was cancelled
        if (this.taskCallbacks.has(id)) {
          const { reject } = this.taskCallbacks.get(id);
          reject(new Error('Task cancelled'));
          this.taskCallbacks.delete(id);
        }
        
        // Mark worker as available
        this.busyWorkers.delete(worker);
        
        // Process next task in queue
        this.processQueue();
        break;
        
      default:
        console.warn(`Unknown message type from worker: ${type}`);
    }
  }
  
  // Process the next task in the queue
  processQueue() {
    if (this.taskQueue.length === 0) {
      return;
    }
    
    // Find an available worker
    const availableWorker = this.workers.find(worker => !this.busyWorkers.has(worker));
    
    if (availableWorker) {
      // Get the next task
      const task = this.taskQueue.shift();
      
      // Mark the worker as busy
      this.busyWorkers.add(availableWorker);
      
      // Send the task to the worker
      availableWorker.postMessage(task.message, task.transferables);
      
      // Update metrics
      this.metrics.peakQueueLength = Math.max(this.metrics.peakQueueLength, this.taskQueue.length);
    }
  }
  
  // Execute a task using a worker from the pool
  executeTask(type, data, options = {}) {
    const taskId = this.taskIdCounter++;
    const { transferables = [], onProgress } = options;
    
    // Create a message object
    const message = {
      type,
      data,
      options,
      id: taskId
    };
    
    // Create a promise for the task
    return new Promise((resolve, reject) => {
      // Store the callbacks
      this.taskCallbacks.set(taskId, {
        resolve,
        reject,
        onProgress,
        startTime: performance.now()
      });
      
      // Add to queue
      this.taskQueue.push({
        message,
        transferables
      });
      
      // Try to process immediately
      this.processQueue();
    });
  }
  
  // Cancel a specific task
  cancelTask(taskId) {
    // Remove from queue if still queued
    const queueIndex = this.taskQueue.findIndex(task => task.message.id === taskId);
    if (queueIndex >= 0) {
      this.taskQueue.splice(queueIndex, 1);
      
      // Reject the promise
      if (this.taskCallbacks.has(taskId)) {
        const { reject } = this.taskCallbacks.get(taskId);
        reject(new Error('Task cancelled'));
        this.taskCallbacks.delete(taskId);
      }
      
      return true;
    }
    
    // If already being processed, send cancel message to all workers
    for (const worker of this.workers) {
      if (this.busyWorkers.has(worker)) {
        worker.postMessage({
          type: 'cancel',
          id: taskId
        });
      }
    }
    
    return false;
  }
  
  // Clear the worker cache
  clearWorkerCache() {
    for (const worker of this.workers) {
      worker.postMessage({
        type: 'clear_cache'
      });
    }
  }
  
  // Get performance metrics
  getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.taskQueue.length,
      activeWorkers: this.busyWorkers.size,
      totalWorkers: this.workers.length
    };
  }
  
  // Dispose the worker pool
  dispose() {
    // Cancel all pending tasks
    this.taskQueue.length = 0;
    
    // Reject all pending callbacks
    for (const [taskId, { reject }] of this.taskCallbacks.entries()) {
      reject(new Error('Worker pool disposed'));
      this.taskCallbacks.delete(taskId);
    }
    
    // Terminate all workers if configured to do so
    if (this.terminateOnDispose) {
      for (const worker of this.workers) {
        worker.terminate();
      }
      this.workers = [];
      this.busyWorkers.clear();
    }
  }
}

// Export a singleton instance
let pointCloudWorkerPool = null;

// Create or get the point cloud worker pool
export function getPointCloudWorkerPool() {
  if (!pointCloudWorkerPool) {
    pointCloudWorkerPool = new WorkerPool('/workers/pointcloud-processor.js');
  }
  return pointCloudWorkerPool;
}

export default WorkerPool; 