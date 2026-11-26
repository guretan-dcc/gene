Shader "MyWorld/Low Poly Water" {
    Properties {
        _Color ("Tint", Color) = (1, 1, 1, 1)
        _Opacity ("Opacity", Range(0, 1)) = 0.88
        _Brightness ("Brightness", Range(0.5, 1.5)) = 1.0
        _Shininess ("Specular Power", Range(0.03, 1)) = 0.35
        _SpecIntensity ("Specular Intensity", Range(0, 1)) = 0.35

        [Header(Waves  vertex displacement)]
        _WaveAmp ("Wave Height (m)", Range(0, 0.4)) = 0.07
        _WaveScale ("Wave Scale (1/m)", Range(0.05, 2)) = 0.45
        _WaveSpeed ("Wave Speed", Range(0, 4)) = 1.1
        _WaveNormal ("Wave Normal Strength", Range(0, 2)) = 0.6

        [Header(Seen from below)]
        _UnderBrightness ("Underside Brightness", Range(0.1, 1)) = 0.55
        _UnderOpacity ("Underside Min Opacity", Range(0, 1)) = 0.92
    }

    CGINCLUDE
    #include "UnityCG.cginc"

    float _WaveAmp;
    float _WaveScale;
    float _WaveSpeed;
    float _WaveNormal;

    // 波の高さ。ワールド座標(xz)と時間だけで決まるので、同じ位置の頂点は必ず同じ高さになる
    // （ポリゴンごとに頂点が分かれたメッシュでも隙間が開かない）。向きの違う3つのsin波を足すだけで軽い。
    // 戻り値: x = 高さ, yz = 高さの傾き(d/dx, d/dz)
    float3 WaterWave(float2 p, float t) {
        float k = _WaveScale;
        float2 d1 = float2(0.80, 0.60), d2 = float2(-0.45, 0.89), d3 = float2(0.20, -0.98);
        float a1 = dot(p, d1) * k * 1.00 + t * 1.00;
        float a2 = dot(p, d2) * k * 1.73 + t * 1.31;
        float a3 = dot(p, d3) * k * 2.91 + t * 1.87;
        float h = sin(a1) * 0.50 + sin(a2) * 0.32 + sin(a3) * 0.18;
        float2 g = d1 * (cos(a1) * 0.50 * k * 1.00)
                 + d2 * (cos(a2) * 0.32 * k * 1.73)
                 + d3 * (cos(a3) * 0.18 * k * 2.91);
        return float3(h, g);
    }

    // 上向きの水面だけ波打たせる（滝のような縦の面は動かさない）。
    // 戻り値: x = 頂点を持ち上げる量(m), yz = 法線の傾き
    float3 WaterDisplace(float3 objPos, float3 objNormal) {
        float3 wp = mul(unity_ObjectToWorld, float4(objPos, 1)).xyz;
        float mask = smoothstep(0.55, 0.9, objNormal.y);
        float3 w = WaterWave(wp.xz, _Time.y * _WaveSpeed);
        return float3(w.x * _WaveAmp * mask, w.yz * (_WaveAmp * _WaveNormal * mask));
    }
    ENDCG

    SubShader {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "IgnoreProjector"="True" }
        LOD 150
        // 水面は裏からも見えるようにする（水中から見上げたとき）
        Cull Off

        // 先に深度だけを書き込み、滝の前面・背面のように重なった半透明面が二重に描かれないようにする。
        // 下の表面シェーダーと同じ波の変形をかけて、深度を合わせる
        Pass {
            ZWrite On
            ColorMask 0
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0

            struct appdata {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };
            struct v2f {
                float4 pos : SV_POSITION;
                UNITY_VERTEX_OUTPUT_STEREO
            };

            v2f vert(appdata v) {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                float3 disp = WaterDisplace(v.vertex.xyz, v.normal);
                v.vertex.xyz += mul((float3x3)unity_WorldToObject, float3(0, disp.x, 0));
                o.pos = UnityObjectToClipPos(v.vertex);
                return o;
            }
            fixed4 frag(v2f i) : SV_Target { return 0; }
            ENDCG
        }

        CGPROGRAM
        #pragma surface surf BlinnPhong alpha:fade vertex:vert noshadow noforwardadd exclude_path:deferred
        #pragma target 3.0

        fixed4 _Color;
        float _Opacity;
        float _Brightness;
        float _Shininess;
        float _SpecIntensity;
        float _UnderBrightness;
        float _UnderOpacity;

        struct Input {
            float4 color : COLOR;
            fixed facing : VFACE;
        };

        void vert(inout appdata_full v) {
            float3 disp = WaterDisplace(v.vertex.xyz, v.normal);
            v.vertex.xyz += mul((float3x3)unity_WorldToObject, float3(0, disp.x, 0));
            // 面の法線を波の傾きでわずかに傾けて、光の反射を動かす（ローポリ感は残る程度）
            float3 nOffset = mul((float3x3)unity_WorldToObject, float3(-disp.y, 0, -disp.z));
            v.normal = normalize(v.normal + nOffset);
        }

        void surf(Input input, inout SurfaceOutput output) {
            // WaterMeshはBuildWaterMesh(MeshBuilder(false))で既にLinear済みの頂点色を保持するため再変換しない
            float under = input.facing < 0 ? 1.0 : 0.0;     // 水の中から見た裏面
            output.Albedo = input.color.rgb * _Color.rgb * _Brightness * lerp(1.0, _UnderBrightness, under);
            float alpha = input.color.a * _Color.a * _Opacity;
            output.Alpha = lerp(alpha, max(alpha, _UnderOpacity), under);
            output.Specular = _Shininess * (1.0 - under);
            output.Gloss = _SpecIntensity * (1.0 - under);
        }
        ENDCG
    }
    FallBack Off
}
