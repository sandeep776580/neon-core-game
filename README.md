# Neon Core: Crystal Run

A browser-based 3D sci-fi action game built with React, Vite, Three.js, and React Three Fiber. Complete 100 progressively harder missions, collect ten crystals in each arena, evade or pulse hostile drones, and enter the exit portal.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Run the gameplay logic checks with `npm test`. Build and preview the production version with `npm run build` and `npm run preview`.

## Controls

- WASD or arrow keys: move
- Drag the arena: orbit the camera
- Shift: dash
- Space or J: pulse attack
- P or Escape: pause
- On mobile, use the on-screen direction pad and action buttons

Each mission starts with a ten-second damage shield. Missions add drones and obstacles over time; Mission 100 is the final challenge.

## Vi3W models

The included GLBs are loaded for the player (`public/models/player.glb`), drones (`public/models/drone.glb`), and crystals (`public/models/crystal.glb`). Each model has a procedural fallback if loading fails. Replace a file with a compatible GLB to change its model. Scales and placement are set in `src/App.jsx`.

## Project structure

- `src/App.jsx`: scene, procedural mission generation, gameplay, and UI
- `src/styles.css`: visual styling and responsive controls
- `public/models/`: included player, drone, and crystal GLB models
