// GENERATED from the old script.js PATTERN_DEFS: the generic background
// patterns any character can pick in the editor (custom pages are matched by
// name instead). Each param is a control in the editor.

export interface PatternParam { id: string; label: string; type: string; default: unknown; min?: number; max?: number; step?: number; options?: unknown[]; [k: string]: unknown }
export interface PatternDef { label: string; params: PatternParam[] }

export const GENERIC_PATTERNS: Record<string, PatternDef> = {
 "none": {
  "label": "None",
  "params": []
 },
 "checkerboard": {
  "label": "Animated Checkerboard",
  "params": [
   {
    "id": "size",
    "label": "Square Size",
    "type": "range",
    "min": 8,
    "max": 128,
    "step": 4,
    "default": 32
   },
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.1,
    "max": 3,
    "step": 0.1,
    "default": 0.5
   },
   {
    "id": "dir",
    "label": "Direction",
    "type": "select",
    "options": [
     "right",
     "left",
     "down",
     "up",
     "diagonal"
    ],
    "default": "diagonal"
   },
   {
    "id": "color1",
    "label": "Color A",
    "type": "color",
    "default": "#ffffff"
   },
   {
    "id": "color2",
    "label": "Color B",
    "type": "color",
    "default": "#000000"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 1,
    "step": 0.05,
    "default": 0.3
   }
  ]
 },
 "scrolling_lines": {
  "label": "Scrolling Lines",
  "params": [
   {
    "id": "thickness",
    "label": "Thickness",
    "type": "range",
    "min": 1,
    "max": 20,
    "step": 1,
    "default": 2
   },
   {
    "id": "gap",
    "label": "Gap",
    "type": "range",
    "min": 2,
    "max": 80,
    "step": 2,
    "default": 16
   },
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.1,
    "max": 5,
    "step": 0.1,
    "default": 1
   },
   {
    "id": "angle",
    "label": "Angle (deg)",
    "type": "range",
    "min": 0,
    "max": 180,
    "step": 5,
    "default": 45
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ffffff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 1,
    "step": 0.05,
    "default": 0.2
   }
  ]
 },
 "matrix_rain": {
  "label": "Matrix Rain",
  "params": [
   {
    "id": "speed",
    "label": "Fall Speed",
    "type": "range",
    "min": 0.2,
    "max": 5,
    "step": 0.2,
    "default": 1.5
   },
   {
    "id": "density",
    "label": "Density",
    "type": "range",
    "min": 1,
    "max": 40,
    "step": 1,
    "default": 12
   },
   {
    "id": "size",
    "label": "Char Size",
    "type": "range",
    "min": 8,
    "max": 32,
    "step": 2,
    "default": 14
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#00ff00"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 1,
    "step": 0.05,
    "default": 0.3
   }
  ]
 },
 "bouncing_diamonds": {
  "label": "Bouncing Diamonds",
  "params": [
   {
    "id": "count",
    "label": "Count",
    "type": "range",
    "min": 1,
    "max": 30,
    "step": 1,
    "default": 8
   },
   {
    "id": "size",
    "label": "Size",
    "type": "range",
    "min": 10,
    "max": 100,
    "step": 5,
    "default": 30
   },
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.1,
    "max": 3,
    "step": 0.1,
    "default": 0.8
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ffff00"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 1,
    "step": 0.05,
    "default": 0.25
   },
   {
    "id": "rotate",
    "label": "Rotate",
    "type": "select",
    "options": [
     "yes",
     "no"
    ],
    "default": "yes"
   }
  ]
 },
 "pulse_rings": {
  "label": "Pulse Rings",
  "params": [
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.1,
    "max": 3,
    "step": 0.1,
    "default": 0.8
   },
   {
    "id": "count",
    "label": "Ring Count",
    "type": "range",
    "min": 1,
    "max": 8,
    "step": 1,
    "default": 4
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ffffff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 0.8,
    "step": 0.05,
    "default": 0.2
   },
   {
    "id": "thick",
    "label": "Thickness",
    "type": "range",
    "min": 1,
    "max": 10,
    "step": 1,
    "default": 2
   }
  ]
 },
 "static_noise": {
  "label": "Static Noise",
  "params": [
   {
    "id": "speed",
    "label": "Flicker",
    "type": "range",
    "min": 1,
    "max": 60,
    "step": 1,
    "default": 15
   },
   {
    "id": "size",
    "label": "Pixel Size",
    "type": "range",
    "min": 1,
    "max": 12,
    "step": 1,
    "default": 3
   },
   {
    "id": "density",
    "label": "Density",
    "type": "range",
    "min": 0.1,
    "max": 1,
    "step": 0.05,
    "default": 0.4
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ffffff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 0.8,
    "step": 0.05,
    "default": 0.15
   }
  ]
 },
 "falling_pixels": {
  "label": "Falling Pixels",
  "params": [
   {
    "id": "count",
    "label": "Count",
    "type": "range",
    "min": 5,
    "max": 200,
    "step": 5,
    "default": 60
   },
   {
    "id": "size",
    "label": "Pixel Size",
    "type": "range",
    "min": 2,
    "max": 20,
    "step": 1,
    "default": 6
   },
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.5,
    "max": 8,
    "step": 0.5,
    "default": 2
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ffffff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 1,
    "step": 0.05,
    "default": 0.25
   }
  ]
 },
 "scanwave": {
  "label": "Scan Wave",
  "params": [
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.1,
    "max": 5,
    "step": 0.1,
    "default": 0.8
   },
   {
    "id": "thickness",
    "label": "Thickness",
    "type": "range",
    "min": 2,
    "max": 40,
    "step": 2,
    "default": 10
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#00ffff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 0.8,
    "step": 0.05,
    "default": 0.2
   },
   {
    "id": "dir",
    "label": "Direction",
    "type": "select",
    "options": [
     "down",
     "up",
     "right",
     "left"
    ],
    "default": "down"
   }
  ]
 },
 "crosshatch": {
  "label": "Animated Crosshatch",
  "params": [
   {
    "id": "size",
    "label": "Cell Size",
    "type": "range",
    "min": 8,
    "max": 80,
    "step": 4,
    "default": 24
   },
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.1,
    "max": 4,
    "step": 0.1,
    "default": 0.5
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ffffff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 0.8,
    "step": 0.05,
    "default": 0.2
   }
  ]
 },
 "heartbeat": {
  "label": "Heartbeat / ECG",
  "params": [
   {
    "id": "speed",
    "label": "BPM",
    "type": "range",
    "min": 30,
    "max": 200,
    "step": 5,
    "default": 80
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ff0000"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.1,
    "max": 1,
    "step": 0.05,
    "default": 0.4
   },
   {
    "id": "thick",
    "label": "Line Width",
    "type": "range",
    "min": 1,
    "max": 6,
    "step": 1,
    "default": 2
   }
  ]
 },
 "twinkling_stars": {
  "label": "Twinkling Stars",
  "params": [
   {
    "id": "count",
    "label": "Count",
    "type": "range",
    "min": 20,
    "max": 300,
    "default": 100
   },
   {
    "id": "speed",
    "label": "Twinkle Speed",
    "type": "range",
    "min": 0.1,
    "max": 5,
    "step": 0.1,
    "default": 1
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ffffff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.1,
    "max": 1,
    "step": 0.1,
    "default": 0.5
   }
  ]
 },
 "glitch_grid": {
  "label": "Glitch Grid",
  "params": [
   {
    "id": "size",
    "label": "Cell Size",
    "type": "range",
    "min": 10,
    "max": 100,
    "default": 40
   },
   {
    "id": "speed",
    "label": "Glitch Freq",
    "type": "range",
    "min": 0.1,
    "max": 10,
    "default": 2
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#00ff80"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.1,
    "max": 0.8,
    "step": 0.05,
    "default": 0.2
   }
  ]
 },
 "neural_network": {
  "label": "Neural Network",
  "params": [
   {
    "id": "count",
    "label": "Node Count",
    "type": "range",
    "min": 10,
    "max": 100,
    "step": 5,
    "default": 40
   },
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.1,
    "max": 3,
    "step": 0.1,
    "default": 0.5
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ffffff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 0.8,
    "step": 0.05,
    "default": 0.3
   }
  ]
 },
 "cyber_circuitry": {
  "label": "Cyber Circuitry",
  "params": [
   {
    "id": "density",
    "label": "Density",
    "type": "range",
    "min": 1,
    "max": 15,
    "step": 1,
    "default": 6
   },
   {
    "id": "speed",
    "label": "Speed",
    "type": "range",
    "min": 0.1,
    "max": 3,
    "step": 0.1,
    "default": 1
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#00ffaa"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 0.8,
    "step": 0.05,
    "default": 0.3
   }
  ]
 },
 "digital_vortex": {
  "label": "Digital Vortex",
  "params": [
   {
    "id": "speed",
    "label": "Rotation",
    "type": "range",
    "min": 0.1,
    "max": 5,
    "step": 0.1,
    "default": 1
   },
   {
    "id": "color",
    "label": "Color",
    "type": "color",
    "default": "#ff00ff"
   },
   {
    "id": "opacity",
    "label": "Opacity",
    "type": "range",
    "min": 0.05,
    "max": 0.8,
    "step": 0.05,
    "default": 0.25
   }
  ]
 }
};
