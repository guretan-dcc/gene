// プレビュー用の水マテリアル。Unity の LowPolyWater.shader と同じ式で、上向きの水面の頂点を波打たせ、両面描画にする。
// 波はワールド座標(xz)と時間だけで決まるので、ポリゴンごとに頂点が分かれたメッシュでも隙間は開かない。
export const waterUniforms = {
    uTime: { value: 0 },
    uWaveAmp: { value: 0.07 },
    uWaveScale: { value: 0.45 }
};

// 1フレームごとに呼ぶ (秒)。Unity側の _WaveSpeed(1.1) と同じ速さにする
export function updateWaterTime(seconds) {
    waterUniforms.uTime.value = seconds * 1.1;
}

export function createWaterMaterial(wireframe) {
    const mat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        wireframe
    });
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = waterUniforms.uTime;
        shader.uniforms.uWaveAmp = waterUniforms.uWaveAmp;
        shader.uniforms.uWaveScale = waterUniforms.uWaveScale;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uWaveAmp;
uniform float uWaveScale;
float waterWave(vec2 p, float t) {
    float k = uWaveScale;
    float a1 = dot(p, vec2(0.80, 0.60)) * k * 1.00 + t * 1.00;
    float a2 = dot(p, vec2(-0.45, 0.89)) * k * 1.73 + t * 1.31;
    float a3 = dot(p, vec2(0.20, -0.98)) * k * 2.91 + t * 1.87;
    return sin(a1) * 0.50 + sin(a2) * 0.32 + sin(a3) * 0.18;
}`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
{
    // 上向きの水面だけ波打たせる（滝のような縦の面は動かさない）
    float waveMask = smoothstep(0.55, 0.9, normal.y);
    vec3 wavePos = (modelMatrix * vec4(position, 1.0)).xyz;
    transformed.y += waterWave(wavePos.xz, uTime) * uWaveAmp * waveMask;
}`);
    };
    return mat;
}
