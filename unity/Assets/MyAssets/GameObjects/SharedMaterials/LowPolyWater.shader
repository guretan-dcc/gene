Shader "MyWorld/Low Poly Water" {
    Properties {
        _Opacity ("Opacity", Range(0, 1)) = 0.95
        _Brightness ("Brightness", Range(0.5, 1.5)) = 1.0
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
        #pragma surface surf Lambert vertex:vert alpha:fade noshadow noforwardadd exclude_path:deferred
        #pragma target 3.0

        float _Opacity;
        float _Brightness;

        struct Input { float4 color : COLOR; };

        void vert(inout appdata_full v) {
            // MeshにはsRGBのColor32を保存。補間前に作業色空間へ変換する（LowPolyVertexColorと同じ）。
            #ifndef UNITY_COLORSPACE_GAMMA
            v.color.rgb = GammaToLinearSpace(v.color.rgb);
            #endif
        }

        void surf(Input input, inout SurfaceOutput output) {
            output.Albedo = input.color.rgb * _Brightness;
            output.Alpha = input.color.a * _Opacity;
        }
        ENDCG
    }
    FallBack Off
}
