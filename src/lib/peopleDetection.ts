import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

export interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export interface DetectionResult {
  detections: Detection[];
  peopleCount: number;
  timestamp: number;
}

let model: cocoSsd.ObjectDetection | null = null;

// Line crossing detection state
interface TrackedPerson {
  id: string;
  bbox: [number, number, number, number];
  centerX: number;
  centerY: number;
  previousY: number;
  lastSeen: number;
  crossed: boolean;
  direction: 'in' | 'out' | null;
  framesSinceCrossing: number;
}

const trackedPeople: Map<string, TrackedPerson> = new Map();
const CROSSING_LINE_POSITION = 0.5; // Middle of the frame (50%)
const TRACKING_THRESHOLD = 400; // pixels - extremely large for better tracking
const TRACKING_TIMEOUT = 3000; // ms - give lots of time
const MIN_CONFIDENCE = 0.2; // Ultra ultra low for maximum detection
const CROSSING_COOLDOWN = 15; // frames - very short cooldown
const CROSSING_THRESHOLD_PERCENT = 0.18; // 18% of frame height
const MIN_DISTANCE_FOR_CROSSING = 5; // Extremely small - catch any movement

/**
 * Load the COCO-SSD model with better configuration
 */
export async function loadModel(): Promise<void> {
  if (!model) {
    model = await cocoSsd.load({
      base: 'mobilenet_v2' // Better accuracy than lite model
    });
    console.log('COCO-SSD model loaded successfully');
  }
}

/**
 * Detect people in an image/video frame
 */
export async function detectPeople(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult> {
  if (!model) {
    await loadModel();
  }

  const predictions = await model!.detect(imageElement);
  
  // Filter only person detections with minimum confidence
  const peopleDetections = predictions
    .filter((prediction) => prediction.class === 'person' && prediction.score >= MIN_CONFIDENCE)
    .map((prediction) => ({
      bbox: prediction.bbox as [number, number, number, number],
      class: prediction.class,
      score: prediction.score,
    }));

  return {
    detections: peopleDetections,
    peopleCount: peopleDetections.length,
    timestamp: Date.now(),
  };
}

/**
 * Calculate distance between two points
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Calculate IoU (Intersection over Union) for bbox matching
 */
function calculateIoU(
  bbox1: [number, number, number, number],
  bbox2: [number, number, number, number]
): number {
  const [x1, y1, w1, h1] = bbox1;
  const [x2, y2, w2, h2] = bbox2;
  
  const xLeft = Math.max(x1, x2);
  const yTop = Math.max(y1, y2);
  const xRight = Math.min(x1 + w1, x2 + w2);
  const yBottom = Math.min(y1 + h1, y2 + h2);
  
  if (xRight < xLeft || yBottom < yTop) {
    return 0;
  }
  
  const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
  const bbox1Area = w1 * h1;
  const bbox2Area = w2 * h2;
  const unionArea = bbox1Area + bbox2Area - intersectionArea;
  
  return intersectionArea / unionArea;
}

/**
 * Find closest tracked person using both distance and IoU with better scoring
 */
function findClosestPerson(
  bbox: [number, number, number, number],
  centerX: number,
  centerY: number
): TrackedPerson | null {
  let closest: TrackedPerson | null = null;
  let maxScore = 0.3; // Minimum score threshold to match

  trackedPeople.forEach((person) => {
    // Calculate distance score
    const distance = calculateDistance(centerX, centerY, person.centerX, person.centerY);
    if (distance > TRACKING_THRESHOLD) return;
    
    // Calculate IoU score
    const iou = calculateIoU(bbox, person.bbox);
    
    // Calculate size similarity
    const [, , w1, h1] = bbox;
    const [, , w2, h2] = person.bbox;
    const sizeRatio = Math.min(w1 * h1, w2 * h2) / Math.max(w1 * h1, w2 * h2);
    
    // Combine scores with weights:
    // - IoU (50%) - most important for same person
    // - Distance (30%) - closer is better
    // - Size similarity (20%) - similar size likely same person
    const distanceScore = Math.max(0, 1 - distance / TRACKING_THRESHOLD);
    const score = iou * 0.5 + distanceScore * 0.3 + sizeRatio * 0.2;
    
    if (score > maxScore) {
      maxScore = score;
      closest = person;
    }
  });

  return closest;
}

/**
 * Clean up old tracked people
 */
function cleanupTrackedPeople(): void {
  const now = Date.now();
  trackedPeople.forEach((person, id) => {
    if (now - person.lastSeen > TRACKING_TIMEOUT) {
      trackedPeople.delete(id);
    }
  });
}

/**
 * Detect people crossing the line (in/out counting)
 */
export async function detectPeopleWithCrossing(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  frameHeight: number
): Promise<{
  detections: Detection[];
  peopleCount: number;
  countIn: number;
  countOut: number;
}> {
  const result = await detectPeople(imageElement);
  
  let countIn = 0;
  let countOut = 0;
  
  const crossingLineY = frameHeight * CROSSING_LINE_POSITION;
  
  // Clean up old tracked people
  cleanupTrackedPeople();
  
  // Update frame counters and reset crossed status for all tracked people
  trackedPeople.forEach((person) => {
    if (person.crossed) {
      person.framesSinceCrossing++;
      // Reset crossed status after cooldown
      if (person.framesSinceCrossing >= CROSSING_COOLDOWN) {
        person.crossed = false;
        person.framesSinceCrossing = 0;
        person.direction = null;
      }
    }
  });
  
  // Create a set to track which existing people we've matched this frame
  const matchedPeople = new Set<string>();
  
  // Sort detections by confidence (process more confident detections first)
  const sortedDetections = [...result.detections].sort((a, b) => b.score - a.score);
  
  // Process each detected person
  sortedDetections.forEach((detection) => {
    const [x, y, width, height] = detection.bbox;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    // Try to find if this person was already being tracked
    const existingPerson = findClosestPerson(detection.bbox, centerX, centerY);
    
    if (existingPerson && !matchedPeople.has(existingPerson.id)) {
      // Mark this person as matched
      matchedPeople.add(existingPerson.id);
      
      // Update existing person's position
      const previousY = existingPerson.centerY;
      const previousCenterX = existingPerson.centerX;
      existingPerson.bbox = detection.bbox;
      existingPerson.centerX = centerX;
      existingPerson.previousY = previousY;
      existingPerson.centerY = centerY;
      existingPerson.lastSeen = Date.now();
      
      // Log position tracking
      const currentZone = centerY < crossingLineY ? 'EXIT' : 'ENTRY';
      const previousZone = previousY < crossingLineY ? 'EXIT' : 'ENTRY';
      if (currentZone !== previousZone) {
        console.log(`🔄 ZONE CHANGE! ID: ${existingPerson.id.substring(0, 8)} | ${previousZone}(${previousY.toFixed(0)}) → ${currentZone}(${centerY.toFixed(0)}) | Crossing: ${existingPerson.crossed}`);
      }
      
      // Check if person crossed the line (only if not in cooldown)
      if (!existingPerson.crossed) {
        // Simpler crossing logic - check if crossed the center line
        const crossedDown = previousY < crossingLineY && centerY > crossingLineY;
        const crossedUp = previousY > crossingLineY && centerY < crossingLineY;
        
        // Calculate movement
        const verticalMovement = Math.abs(centerY - previousY);
        const horizontalMovement = Math.abs(centerX - previousCenterX);
        
        // Log all potential crossings for debugging
        if (crossedDown || crossedUp) {
          console.log(`🔍 POTENTIAL CROSSING DETECTED:`, {
            id: existingPerson.id.substring(0, 8),
            direction: crossedDown ? 'DOWN (Exit→Entry)' : 'UP (Entry→Exit)',
            previousY: previousY.toFixed(0),
            currentY: centerY.toFixed(0),
            crossingLine: crossingLineY.toFixed(0),
            verticalMove: verticalMovement.toFixed(0),
            horizontalMove: horizontalMovement.toFixed(0),
            minRequired: MIN_DISTANCE_FOR_CROSSING
          });
        }
        
        // Check if movement is primarily vertical (very lenient)
        const isVerticalMovement = verticalMovement > horizontalMovement * 0.1;
        
        if (verticalMovement > MIN_DISTANCE_FOR_CROSSING && isVerticalMovement) {
          if (crossedDown) {
            // Crossed from EXIT ZONE (top/red) to ENTRY ZONE (bottom/green) = ENTERING
            existingPerson.direction = 'in';
            existingPerson.crossed = true;
            existingPerson.framesSinceCrossing = 0;
            countIn++;
            console.log(`✅✅✅ COUNTED IN! Person crossed DOWN (Exit→Entry) - ID: ${existingPerson.id.substring(0, 8)} | Y: ${previousY.toFixed(0)}→${centerY.toFixed(0)} | Movement: ${verticalMovement.toFixed(0)}px | Line: ${crossingLineY.toFixed(0)}`);
          } else if (crossedUp) {
            // Crossed from ENTRY ZONE (bottom/green) to EXIT ZONE (top/red) = EXITING
            existingPerson.direction = 'out';
            existingPerson.crossed = true;
            existingPerson.framesSinceCrossing = 0;
            countOut++;
            console.log(`❌❌❌ COUNTED OUT! Person crossed UP (Entry→Exit) - ID: ${existingPerson.id.substring(0, 8)} | Y: ${previousY.toFixed(0)}→${centerY.toFixed(0)} | Movement: ${verticalMovement.toFixed(0)}px | Line: ${crossingLineY.toFixed(0)}`);
          }
        } else if (crossedDown || crossedUp) {
          console.log(`⚠️ CROSSING REJECTED - Movement too small or not vertical enough`);
        }
      }
    } else if (!existingPerson) {
      // New person detected - create unique ID
      const id = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newPerson: TrackedPerson = {
        id,
        bbox: detection.bbox,
        centerX,
        centerY,
        previousY: centerY,
        lastSeen: Date.now(),
        crossed: false,
        direction: null,
        framesSinceCrossing: 0,
      };
      trackedPeople.set(id, newPerson);
      matchedPeople.add(id);
      const zonePosition = centerY < crossingLineY ? 'EXIT ZONE (top)' : 'ENTRY ZONE (bottom)';
      console.log(`🆕 NEW PERSON DETECTED - ID: ${id.substring(0, 8)} | Y: ${centerY.toFixed(0)} | In: ${zonePosition} | Confidence: ${Math.round(detection.score * 100)}%`);
    }
  });
  
  // Remove people who weren't detected this frame (they left the view)
  const unmatchedPeople: string[] = [];
  trackedPeople.forEach((person, id) => {
    if (!matchedPeople.has(id)) {
      const timeSinceLastSeen = Date.now() - person.lastSeen;
      if (timeSinceLastSeen > 500) { // Give 500ms grace period
        unmatchedPeople.push(id);
      }
    }
  });
  
  unmatchedPeople.forEach(id => {
    const person = trackedPeople.get(id);
    if (person) {
      console.log(`👋 PERSON LEFT VIEW - ID: ${id.substring(0, 12)}... | Last position Y: ${person.centerY.toFixed(0)}`);
      trackedPeople.delete(id);
    }
  });
  
  // Log current tracking status
  if (trackedPeople.size > 0) {
    const trackingInfo = Array.from(trackedPeople.values())
      .map(p => `Y:${p.centerY.toFixed(0)}${p.crossed ? '(crossed)' : ''}`)
      .join(', ');
    console.log(`👁️ TRACKING ${trackedPeople.size} people: [${trackingInfo}]`);
  }
  
  return {
    detections: result.detections,
    peopleCount: result.peopleCount,
    countIn,
    countOut,
  };
}

/**
 * Draw detection boxes and crossing line on canvas
 */
export function drawDetections(
  canvas: HTMLCanvasElement,
  detections: Detection[],
  showCrossingLine = true
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw crossing line with zones
  if (showCrossingLine) {
    const lineY = canvas.height * CROSSING_LINE_POSITION;
    const thresholdZone = canvas.height * CROSSING_THRESHOLD_PERCENT;
    
    // Draw upper zone (above line - OUT zone)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'; // Light red
    ctx.fillRect(0, 0, canvas.width, lineY - thresholdZone);
    
    // Draw threshold zone (detection zone)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Light blue
    ctx.fillRect(0, lineY - thresholdZone, canvas.width, thresholdZone * 2);
    
    // Draw lower zone (below line - IN zone)
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)'; // Light green
    ctx.fillRect(0, lineY + thresholdZone, canvas.width, canvas.height - (lineY + thresholdZone));
    
    // Draw threshold boundaries
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    // Upper boundary
    ctx.beginPath();
    ctx.moveTo(0, lineY - thresholdZone);
    ctx.lineTo(canvas.width, lineY - thresholdZone);
    ctx.stroke();
    // Lower boundary
    ctx.beginPath();
    ctx.moveTo(0, lineY + thresholdZone);
    ctx.lineTo(canvas.width, lineY + thresholdZone);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw center line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 8]);
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(canvas.width, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Add zone labels
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 18px Arial';
    
    // OUT zone label
    ctx.strokeText('↑ EXIT ZONE', canvas.width - 150, lineY - thresholdZone - 15);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('↑ EXIT ZONE', canvas.width - 150, lineY - thresholdZone - 15);
    
    // IN zone label
    ctx.fillStyle = '#ffffff';
    ctx.strokeText('↓ ENTRY ZONE', canvas.width - 150, lineY + thresholdZone + 30);
    ctx.fillStyle = '#22c55e';
    ctx.fillText('↓ ENTRY ZONE', canvas.width - 150, lineY + thresholdZone + 30);
    
    // Crossing line label
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText('CROSSING LINE', 15, lineY - 10);
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('CROSSING LINE', 15, lineY - 10);
  }

  // Don't draw bounding boxes - removed all detection box drawing code
}

/**
 * Reset tracking state
 */
export function resetTracking(): void {
  trackedPeople.clear();
}
