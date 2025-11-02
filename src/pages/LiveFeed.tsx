import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Play, Pause, Camera, Users, ArrowRight, ArrowLeft, Upload, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadModel, detectPeopleWithCrossing, drawDetections, resetTracking } from '../lib/peopleDetection';

type VideoSource = 'webcam' | 'upload' | 'stream';

export default function LiveFeed() {
  const [isRunning, setIsRunning] = useState(false);
  const [countIn, setCountIn] = useState(0);
  const [countOut, setCountOut] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; name: string }>>([]);
  const [videoSource, setVideoSource] = useState<VideoSource>('webcam');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);
  const countInRef = useRef(0);
  const countOutRef = useRef(0);
  const totalCountRef = useRef(0);

  useEffect(() => {
    loadCameras();
    initializeModel();
  }, []);

  const initializeModel = async () => {
    setIsModelLoading(true);
    try {
      await loadModel();
      setModelLoaded(true);
      console.log('Detection model loaded successfully');
    } catch (error) {
      console.error('Error loading model:', error);
      alert('Failed to load detection model. Please refresh the page.');
    } finally {
      setIsModelLoading(false);
    }
  };

  const loadCameras = async () => {
    try {
      const { data, error } = await supabase.from('cameras').select('id, name').eq('is_active', true);
      if (!error && data && data.length > 0) {
        setCameras(data);
        setSelectedCamera(data[0].id);
      } else {
        // Try loading from localStorage in demo mode
        const stored = localStorage.getItem('people_counter_cameras');
        if (stored) {
          const storedCameras = JSON.parse(stored);
          const activeCameras = storedCameras
            .filter((cam: { is_active: boolean }) => cam.is_active)
            .map((cam: { id: string; name: string }) => ({ id: cam.id, name: cam.name }));
          if (activeCameras.length > 0) {
            setCameras(activeCameras);
            setSelectedCamera(activeCameras[0].id);
            return;
          }
        }
        // Fallback: add a default camera
        const demoCamera = { id: 'demo-camera', name: 'Demo Camera' };
        setCameras([demoCamera]);
        setSelectedCamera(demoCamera.id);
      }
    } catch {
      // Try loading from localStorage in demo mode
      const stored = localStorage.getItem('people_counter_cameras');
      if (stored) {
        const storedCameras = JSON.parse(stored);
        const activeCameras = storedCameras
          .filter((cam: { is_active: boolean }) => cam.is_active)
          .map((cam: { id: string; name: string }) => ({ id: cam.id, name: cam.name }));
        if (activeCameras.length > 0) {
          setCameras(activeCameras);
          setSelectedCamera(activeCameras[0].id);
          return;
        }
      }
      // Fallback: add a default camera
      const demoCamera = { id: 'demo-camera', name: 'Demo Camera' };
      setCameras([demoCamera]);
      setSelectedCamera(demoCamera.id);
    }
  };

  const startCounting = () => {
    if (!modelLoaded) {
      alert('Detection model is still loading. Please wait...');
      return;
    }

    setIsRunning(true);
    
    // Start video playback if using uploaded video or stream
    if (videoSource === 'upload' && videoRef.current) {
      videoRef.current.play().catch(console.error);
    } else if (videoSource === 'stream' && videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.warn('Could not play stream:', error);
      });
    }

    // Run detection at regular intervals
    intervalRef.current = window.setInterval(async () => {
      await runDetection();
    }, 250); // Run detection every 250ms for maximum tracking speed
  };

  const runDetection = async () => {
    try {
      let videoElement: HTMLVideoElement | null = null;
      let frameHeight = 0;
      let frameWidth = 0;

      // Get the appropriate video element based on source
      if (videoSource === 'webcam' && webcamRef.current && webcamRef.current.video) {
        videoElement = webcamRef.current.video;
        frameHeight = webcamRef.current.video.videoHeight;
        frameWidth = webcamRef.current.video.videoWidth;
      } else if ((videoSource === 'upload' || videoSource === 'stream') && videoRef.current) {
        videoElement = videoRef.current;
        frameHeight = videoRef.current.videoHeight;
        frameWidth = videoRef.current.videoWidth;
      }

      // Check if video is ready and has valid dimensions
      if (!videoElement || frameHeight === 0 || frameWidth === 0) {
        console.log('Waiting for video to be ready...', { videoElement: !!videoElement, frameHeight, frameWidth, videoSource });
        return;
      }

      // Check if video is actually playing for uploaded videos
      if ((videoSource === 'upload' || videoSource === 'stream') && videoElement.paused) {
        console.log('Video is paused, attempting to play...');
        videoElement.play().catch(err => console.warn('Could not play video:', err));
        return;
      }

      // Run detection
      const result = await detectPeopleWithCrossing(videoElement, frameHeight);
      
      // Log detection results
      if (result.peopleCount > 0) {
        console.log(`👤 Detected ${result.peopleCount} people | countIn: ${result.countIn} | countOut: ${result.countOut}`);
      }
      
      // Update counts only if there were actual crossings
      if (result.countIn > 0) {
        countInRef.current += result.countIn;
        totalCountRef.current += result.countIn;
        console.log(`✅ Person entered! Total In: ${countInRef.current}, Current Total: ${totalCountRef.current}`);
      }
      if (result.countOut > 0) {
        countOutRef.current += result.countOut;
        totalCountRef.current = Math.max(0, totalCountRef.current - result.countOut);
        console.log(`❌ Person exited! Total Out: ${countOutRef.current}, Current Total: ${totalCountRef.current}`);
      }

      // Always update the display
      setCountIn(countInRef.current);
      setCountOut(countOutRef.current);
      setTotalCount(totalCountRef.current);

      // Draw detections on canvas
      if (canvasRef.current && videoElement) {
        canvasRef.current.width = frameWidth;
        canvasRef.current.height = frameHeight;
        drawDetections(canvasRef.current, result.detections, true);
      }

      // Log to database only when there's a crossing event
      if ((result.countIn > 0 || result.countOut > 0) && selectedCamera) {
        await logCount(countInRef.current, countOutRef.current, totalCountRef.current);
      }
    } catch (error) {
      console.error('Detection error:', error);
    }
  };

  const stopCounting = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Pause video playback if using uploaded video or stream
    if ((videoSource === 'upload' || videoSource === 'stream') && videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setUploadedVideoUrl(url);
      setVideoSource('upload');
      // Reset counts when switching video source
      resetCount();
      
      // Wait for video to load metadata
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.addEventListener('loadedmetadata', () => {
            console.log('Video loaded:', {
              width: videoRef.current?.videoWidth,
              height: videoRef.current?.videoHeight,
              duration: videoRef.current?.duration
            });
          }, { once: true });
        }
      }, 100);
    } else {
      alert('Please select a valid video file');
    }
  };

  const handleStreamUrlChange = () => {
    if (streamUrl.trim()) {
      setVideoSource('stream');
      resetCount();
      // Auto-play stream when URL is set (after state update)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load(); // Reload the video element with new URL
          videoRef.current.play().catch((error) => {
            console.warn('Could not autoplay stream:', error);
          });
        }
      }, 200);
    }
  };

  const handleStreamError = () => {
    console.error('Error loading video stream. Please check the URL and ensure it\'s accessible.');
    alert('Error loading video stream. Please check the URL and ensure it\'s accessible.');
  };

  const clearUploadedVideo = () => {
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
      setUploadedVideoUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setVideoSource('webcam');
    resetCount();
  };

  const logCount = async (currentCountIn: number, currentCountOut: number, currentTotal: number) => {
    if (!selectedCamera) return;

    const countLog = {
      id: `demo-log-${Date.now()}-${Math.random()}`,
      camera_id: selectedCamera,
      timestamp: new Date().toISOString(),
      count_in: currentCountIn,
      count_out: currentCountOut,
      total_count: currentTotal,
      detection_data: { timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('count_logs').insert(countLog);

      // Check for table errors
      const isTableError = (err: unknown): boolean => {
        if (err && typeof err === 'object') {
          const error = err as { message?: string; code?: string };
          const message = error.message?.toLowerCase() || '';
          return (
            message.includes('could not find the table') ||
            message.includes('schema cache') ||
            message.includes('relation') && message.includes('does not exist') ||
            error.code === 'PGRST116'
          );
        }
        return false;
      };

      if (error && isTableError(error)) {
        // Save to localStorage in demo mode
        const stored = localStorage.getItem('people_counter_count_logs');
        const existingLogs = stored ? JSON.parse(stored) : [];
        existingLogs.push(countLog);
        // Keep only last 1000 logs
        localStorage.setItem('people_counter_count_logs', JSON.stringify(existingLogs.slice(-1000)));
      } else if (!error) {
        // Successfully saved to Supabase, also save to localStorage as backup
        const stored = localStorage.getItem('people_counter_count_logs');
        const existingLogs = stored ? JSON.parse(stored) : [];
        existingLogs.push(countLog);
        localStorage.setItem('people_counter_count_logs', JSON.stringify(existingLogs.slice(-1000)));
      }

      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .eq('camera_id', selectedCamera)
        .maybeSingle();

      if (settings?.alert_enabled && currentTotal > settings.threshold_limit) {
        await supabase.from('alerts').insert({
          camera_id: selectedCamera,
          count_value: currentTotal,
          threshold_value: settings.threshold_limit,
        });
      }
    } catch {
      // Save to localStorage in demo mode
      const stored = localStorage.getItem('people_counter_count_logs');
      const existingLogs = stored ? JSON.parse(stored) : [];
      existingLogs.push(countLog);
      localStorage.setItem('people_counter_count_logs', JSON.stringify(existingLogs.slice(-1000)));
    }
  };

  const resetCount = () => {
    countInRef.current = 0;
    countOutRef.current = 0;
    totalCountRef.current = 0;
    setCountIn(0);
    setCountOut(0);
    setTotalCount(0);
    resetTracking();
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Clean up video URL when component unmounts
      if (uploadedVideoUrl) {
        URL.revokeObjectURL(uploadedVideoUrl);
      }
    };
  }, [uploadedVideoUrl]);

  // Handle video end for uploaded videos
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (videoSource === 'upload' && isRunning) {
        setIsRunning(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        video.pause();
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSource, isRunning]);

  // Handle stream URL changes
  useEffect(() => {
    if (videoSource === 'stream' && streamUrl && videoRef.current) {
      videoRef.current.load();
      if (isRunning) {
        videoRef.current.play().catch((error) => {
          console.warn('Could not autoplay stream:', error);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, videoSource]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Live People Counting</h2>
        <p className="text-slate-400">Real-time detection and counting from webcam, uploaded video, or stream URL</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100">People In</span>
            <ArrowRight className="h-5 w-5 text-green-100" />
          </div>
          <p className="text-4xl font-bold">{countIn}</p>
          <p className="text-xs text-green-100 mt-1">Entered from Entry Zone</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100">People Out</span>
            <ArrowLeft className="h-5 w-5 text-red-100" />
          </div>
          <p className="text-4xl font-bold">{countOut}</p>
          <p className="text-xs text-red-100 mt-1">Exited from Exit Zone</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-100">Current Total</span>
            <Users className="h-5 w-5 text-blue-100" />
          </div>
          <p className="text-4xl font-bold">{totalCount}</p>
          <p className="text-xs text-blue-100 mt-1">People inside area</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Camera className="h-5 w-5 text-slate-400" />
              <select
                value={selectedCamera || ''}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={cameras.length === 0}
              >
                {cameras.length === 0 ? (
                  <option>No cameras available</option>
                ) : (
                  cameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex gap-2">
              {!isRunning ? (
                <button
                  onClick={startCounting}
                  disabled={!selectedCamera || !modelLoaded || (videoSource === 'upload' && !uploadedVideoUrl)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="h-4 w-4" />
                  {isModelLoading ? 'Loading...' : 'Start Detection'}
                </button>
              ) : (
                <button
                  onClick={stopCounting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  <Pause className="h-4 w-4" />
                  Stop
                </button>
              )}
              <button
                onClick={resetCount}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Video Source Selection */}
          <div className="px-4 pb-4 border-b border-slate-700">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">Video Source:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setVideoSource('webcam');
                    clearUploadedVideo();
                    setStreamUrl('');
                    resetCount();
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    videoSource === 'webcam'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Camera className="h-4 w-4 inline mr-1" />
                  Webcam
                </button>
                <button
                  onClick={() => {
                    setVideoSource('upload');
                    setStreamUrl('');
                    fileInputRef.current?.click();
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    videoSource === 'upload'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Upload className="h-4 w-4 inline mr-1" />
                  Upload Video
                </button>
                <button
                  onClick={() => {
                    setVideoSource('stream');
                    clearUploadedVideo();
                    resetCount();
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    videoSource === 'stream'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Video className="h-4 w-4 inline mr-1" />
                  Stream URL
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />

            {videoSource === 'upload' && uploadedVideoUrl && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-slate-400">Video loaded</span>
                <button
                  onClick={clearUploadedVideo}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            )}

            {videoSource === 'stream' && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  onBlur={handleStreamUrlChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleStreamUrlChange();
                    }
                  }}
                  placeholder="Enter video stream URL (e.g., https://example.com/stream.mp4, rtmp://example.com/stream)"
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleStreamUrlChange}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                >
                  Load Stream
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="relative bg-slate-900 aspect-video flex items-center justify-center overflow-hidden">
          {/* Webcam Feed */}
          {videoSource === 'webcam' && (
            <>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{
                  facingMode: 'user',
                }}
              />
              {/* Detection overlay canvas */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ objectFit: 'cover' }}
              />
            </>
          )}

          {/* Uploaded Video */}
          {videoSource === 'upload' && uploadedVideoUrl && (
            <>
              <video
                ref={videoRef}
                src={uploadedVideoUrl}
                className="w-full h-full object-contain"
                loop={false}
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  console.log('Video metadata loaded:', {
                    width: video.videoWidth,
                    height: video.videoHeight,
                    duration: video.duration
                  });
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                  alert('Error loading video. Please try another file.');
                }}
              />
              {/* Detection overlay canvas */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ objectFit: 'contain' }}
              />
            </>
          )}

          {/* Stream URL Video */}
          {videoSource === 'stream' && streamUrl && (
            <>
              <video
                ref={videoRef}
                src={streamUrl}
                className="w-full h-full object-contain"
                autoPlay
                muted
                playsInline
                controls
                onError={handleStreamError}
                crossOrigin="anonymous"
              />
              {/* Detection overlay canvas */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ objectFit: 'contain' }}
              />
            </>
          )}

          {/* No video source selected */}
          {((videoSource === 'upload' && !uploadedVideoUrl) ||
            (videoSource === 'stream' && !streamUrl)) && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
              <div className="text-center">
                {videoSource === 'upload' ? (
                  <>
                    <Upload className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Upload a video file to start</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                    >
                      Choose Video File
                    </button>
                  </>
                ) : (
                  <>
                    <Video className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Enter a video stream URL above</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Running indicator */}
          {isRunning && (
            <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 z-10">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              LIVE - DETECTING
            </div>
          )}

          {/* Model loading indicator */}
          {isModelLoading && (
            <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 z-10">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Loading AI Model...
            </div>
          )}

          {/* Paused overlay for webcam */}
          {videoSource === 'webcam' && !isRunning && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Camera className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Camera feed paused</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-400 text-sm mb-2">
            <strong>🤖 AI Detection Active:</strong> Using TensorFlow.js COCO-SSD model for real-time people detection.
          </p>
          <ul className="text-blue-300 text-sm space-y-1 ml-4">
            <li>• The <strong>blue crossing line</strong> tracks people entering (↓ crossing down) and exiting (↑ crossing up)</li>
            <li>• <strong>Green boxes</strong> show detected people with confidence scores</li>
            <li>• Works with <strong>webcam, uploaded videos, or stream URLs</strong></li>
            <li>• Smart tracking prevents double-counting even with multiple people</li>
            <li>• Counts are automatically saved to the database</li>
          </ul>
        </div>
        
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <p className="text-green-400 text-sm mb-2">
            <strong>✅ Improved Multi-Person Tracking:</strong>
          </p>
          <ul className="text-green-300 text-sm space-y-1 ml-4">
            <li>• Handles multiple people crossing simultaneously</li>
            <li>• Advanced IoU + distance + size matching algorithm</li>
            <li>• 60-frame cooldown prevents duplicate counts</li>
            <li>• Requires minimum 30px vertical movement to count</li>
            <li>• Check browser console (F12) for detailed tracking logs</li>
          </ul>
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-400 text-sm">
            <strong>💡 Tips for Best Results:</strong>
          </p>
          <ul className="text-yellow-300 text-sm space-y-1 ml-4 mt-2">
            <li>• Ensure good lighting for better detection accuracy</li>
            <li>• Position camera to capture full body movement</li>
            <li>• People should cross the line in a clear vertical motion</li>
            <li>• Avoid stopping or standing on the crossing line</li>
            <li>• For uploaded videos, use MP4 format for best compatibility</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
