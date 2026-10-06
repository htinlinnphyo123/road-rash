// Files live in /public and are referenced from the site root.
export default {
  models: {
    // bike: '/models/bike.glb',
  },
  textures: {
    // asphalt: '/textures/asphalt.jpg',
  },
  sounds: {
    siren: { src: ['/audio/siren.wav'], loop: true },
    engine: { src: ['/audio/engine.wav'], loop: true },
    wind: { src: ['/audio/wind.wav'], loop: true },
    swing: { src: ['/audio/swing.wav'] },
    hit: { src: ['/audio/hit.wav'] },
    crash: { src: ['/audio/crash.wav'] },
    countdown: { src: ['/audio/countdown.wav'] },
    finish: { src: ['/audio/finish.wav'] },
  },
};