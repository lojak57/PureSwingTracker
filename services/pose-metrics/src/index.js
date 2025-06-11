const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Dummy metrics generator based on swing mode and angle
function generateDummyMetrics(mode, angle, videoHash) {
  // Use video hash for consistent results (same video = same metrics)
  const seed = videoHash ? parseInt(videoHash.slice(0, 8), 16) : Date.now() % 1000000;
  const random = (min, max) => min + (seed % 1000) / 1000 * (max - min);
  
  const metrics = {
    tempo_ratio: parseFloat((random(2.4, 3.8)).toFixed(2)),
    plane_delta: parseFloat((random(-8, 8)).toFixed(1)),
    hip_sway_cm: parseFloat((random(1.5, 6.2)).toFixed(1)),
    confidence: parseFloat((random(0.75, 0.95)).toFixed(2)),
    processing_time_ms: Math.floor(random(3000, 12000)),
    cached: false
  };
  
  // Only add x_factor for range mode
  if (mode === 'range') {
    metrics.x_factor = parseFloat((random(35, 65)).toFixed(1));
  }
  
  return metrics;
}

// POST /metrics - Main endpoint
app.post('/metrics', (req, res) => {
  const { video_url, mode = 'quick', angle = 0, video_hash } = req.body;
  
  if (!video_url) {
    return res.status(400).json({ error: 'video_url is required' });
  }
  
  // Simulate processing delay
  const processingDelay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
  
  setTimeout(() => {
    try {
      const metrics = generateDummyMetrics(mode, angle, video_hash);
      
      console.log(`📊 Generated metrics for ${mode} mode, angle ${angle}:`, metrics);
      
      res.json(metrics);
    } catch (error) {
      console.error('Error generating metrics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }, processingDelay);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'pose-metrics-dummy',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏌️ Pose Metrics Service (DUMMY) running on port ${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   POST /metrics - Generate swing metrics`);
  console.log(`   GET  /health  - Health check`);
});

module.exports = app; 