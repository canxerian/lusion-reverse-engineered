attribute float displacement;

uniform vec3 startRectPos;
uniform vec2 startRectSize;
uniform float test;
uniform float size;

varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vec2 positionNormalised = vec2(position.x + size * 0.5, position.y + size * 0.5);

    vec3 newPosition = position;
    newPosition.x = mix(startRectPos.x, startRectPos.x + startRectSize.x, positionNormalised.x);
    newPosition.y = mix(-startRectPos.y, -startRectPos.y + startRectSize.y, positionNormalised.y);

    // Normalised value that determines how much of this vertex is affected by the displacement
    float mask = step(positionNormalised.x, test);
    if (mask > 0.5) {
        newPosition = vec3(-100., -100., -100.);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}