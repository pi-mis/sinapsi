/**
 * GLSL shared by neurons, halos and synapses. The same drift() runs in every
 * shader, so synapses stay attached to the neurons while they float. Positions
 * used for picking stay static; the drift is small enough not to matter.
 */

export const DRIFT = /* glsl */ `
uniform float uTime;
uniform float uFloat;
vec3 drift(float phase) {
  float t = uTime * 0.32;
  return vec3(
    sin(t + phase * 6.2831),
    sin(t * 0.83 + phase * 12.566 + 1.3),
    sin(t * 0.71 + phase * 18.849 + 2.1)
  ) * uFloat;
}
`;

export const NEURON_VERTEX = /* glsl */ `
${DRIFT}
attribute float aPhase;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vView;
varying float vPhase;
void main() {
  vec4 world = instanceMatrix * vec4(position, 1.0);
  world.xyz += drift(aPhase);
  vec4 mv = modelViewMatrix * world;
  vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vView = -mv.xyz;
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = vec3(1.0);
  #endif
  vPhase = aPhase;
  gl_Position = projectionMatrix * mv;
}
`;

export const NEURON_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uBreath;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vView;
varying float vPhase;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  float facing = clamp(dot(n, v), 0.0, 1.0);
  float rim = pow(1.0 - facing, 2.4);
  float nucleus = pow(facing, 4.0);
  // A slow "breath" per neuron so the brain never looks frozen.
  float breath = 1.0 + uBreath * 0.18 * sin(uTime * 1.1 + vPhase * 40.0);
  vec3 col = vColor * (0.22 + 0.85 * nucleus * breath) + vColor * rim * 1.35 + vec3(1.0) * pow(facing, 18.0) * 0.55 * breath;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const HALO_VERTEX = /* glsl */ `
${DRIFT}
uniform float uPx;
attribute float aPhase;
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position + drift(aPhase), 1.0);
  gl_PointSize = clamp(aSize * uPx / -mv.z, 0.0, 512.0);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}
`;

export const HALO_FRAGMENT = /* glsl */ `
uniform float uHalo;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.85, 1.0, d)) * uHalo;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}
`;

export const SYNAPSE_VERTEX = /* glsl */ `
${DRIFT}
attribute vec3 aA;
attribute vec3 aB;
attribute vec3 aBend;
attribute vec2 aPhases;
attribute float aT;
attribute float aSeed;
attribute float aStrength;
attribute vec3 aColor;
varying float vT;
varying float vSeed;
varying float vStrength;
varying vec3 vColor;
void main() {
  vec3 a = aA + drift(aPhases.x);
  vec3 b = aB + drift(aPhases.y);
  vec3 c = (a + b) * 0.5 + aBend;
  float t = aT;
  vec3 p = (1.0 - t) * (1.0 - t) * a + 2.0 * (1.0 - t) * t * c + t * t * b;
  vT = t;
  vSeed = aSeed;
  vStrength = aStrength;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const SYNAPSE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uPulse;
varying float vT;
varying float vSeed;
varying float vStrength;
varying vec3 vColor;
void main() {
  // Fade towards the neurons so synapses read as fibres, not wires.
  float ends = smoothstep(0.0, 0.12, vT) * smoothstep(1.0, 0.88, vT);
  float base = (0.16 + 0.55 * vStrength) * mix(0.55, 1.0, ends);
  // A signal travelling along the synapse, at a speed and offset of its own.
  float head = fract(uTime * (0.12 + 0.1 * fract(vSeed * 7.0)) + vSeed);
  float d = vT - head;
  float pulse = exp(-d * d * 900.0) * uPulse * (0.6 + vStrength);
  vec3 col = vColor * base + vColor * pulse * 2.6 + vec3(pulse * 0.5);
  gl_FragColor = vec4(col, base + pulse);
  #include <colorspace_fragment>
}
`;

export const DUST_VERTEX = /* glsl */ `
uniform float uTime;
attribute float aPhase;
varying float vTwinkle;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vTwinkle = 0.55 + 0.45 * sin(uTime * 0.9 + aPhase * 50.0);
  gl_PointSize = 1.0 + 1.6 * fract(aPhase * 13.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const DUST_FRAGMENT = /* glsl */ `
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.4, 1.0, d)) * 0.5 * vTwinkle;
  gl_FragColor = vec4(vec3(0.72, 0.8, 1.0), a);
  #include <colorspace_fragment>
}
`;
