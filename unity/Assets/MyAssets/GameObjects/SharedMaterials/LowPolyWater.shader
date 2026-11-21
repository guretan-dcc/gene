Shader "MyWorld/Low Poly Water" {
    Properties {
        _Color ("Tint", Color) = (1, 1, 1, 1)
        _Opacity ("Opacity", Range(0, 1)) = 0.88
        _Brightness ("Brightness", Range(0.5, 1.5)) = 1.0
        _Shininess ("Specular Power", Range(0.03, 1)) = 0.35
        _SpecIntensity ("Specular Intensity", Range(0, 1)) = 0.35
    }
    SubShader {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "IgnoreProjector"="True" }
        LOD 150

        // 先に深度だけを書き込み、滝の前面・背面のように重なった半透明面が二重に描かれないようにする
        Pass {
            ZWrite On
            ColorMask 0
        }

        CGPROGRAM
        #pragma surface surf BlinnPhong alpha:fade noshadow noforwardadd exclude_path:deferred
        #pragma target 3.0

        fixed4 _Color;
        float _Opacity;
        float _Brightness;
        float _Shininess;
        float _SpecIntensity;

        struct Input { float4 color : COLOR; };

        void surf(Input input, inout SurfaceOutput output) {
            // WaterMeshはBuildWaterMesh(MeshBuilder(false))で既にLinear済みの頂点色を保持するため再変換しない
            output.Albedo = input.color.rgb * _Color.rgb * _Brightness;
            output.Alpha = input.color.a * _Color.a * _Opacity;
            output.Specular = _Shininess;
            output.Gloss = _SpecIntensity;
        }
        ENDCG
    }
    FallBack Off
}
