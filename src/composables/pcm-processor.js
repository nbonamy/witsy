class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = 16000; // Target sample rate
    this.bufferSize = 800; // 50ms chunks at 16kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    
    // For simple resampling if needed
    this.resampleRatio = 1; // Will be calculated in process()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  process(inputs, outputs, parameters) {
    const input = inputs[0][0]; // mono input
    
    if (!input) return true;
    
    // Calculate resample ratio if needed
    if (sampleRate !== this.sampleRate) {
      this.resampleRatio = sampleRate / this.sampleRate;
    }
    
    // Process input samples
    for (let i = 0; i < input.length; i++) {
      // Simple resampling by skipping or duplicating samples
      // For better quality, use a proper resampling algorithm
      const targetIndex = Math.floor(i * this.resampleRatio);
      if (targetIndex < input.length) {
        // Add sample to buffer
        this.buffer[this.bufferIndex++] = input[targetIndex];
        
        // If buffer is full, send it
        if (this.bufferIndex >= this.bufferSize) {
          // Convert to 16-bit PCM
          const pcmData = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            // Convert float32 [-1,1] to int16 [-32768,32767]
            pcmData[j] = Math.max(-1, Math.min(1, this.buffer[j])) * 0x7FFF;
          }
          
          // Send the buffer to the main thread
          this.port.postMessage({
            type: 'pcm',
            data: pcmData
          });
          
          // Reset buffer index
          this.bufferIndex = 0;
        }
      }
    }
    
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
