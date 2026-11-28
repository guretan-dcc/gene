// 水の「中」の見た目。水を囲む閉じたメッシュ(WaterVolume)に付ける。スクリプト・深度テクスチャ・ポストプロセスは不要。
//
// 仕組み（ステンシルで「カメラが水の中にいるか」を判定する）:
//   画面の各ピクセルで、水の体積メッシュの「裏面の数 − 表面の数」を数える。
//     水の外から見ている → 手前の表面と奥の裏面が1枚ずつで、差は 0
//     水の中から見ている → 出ていく側の裏面だけで、差は 1
//   差が 0 でないピクセルだけを水色に塗る。外から見たときは何も描かれない。
//   塗る濃さは「カメラからその裏面までの距離」で決める。それがそのまま視線が水の中を進む長さなので、
//   遠くほど水に霞む(フォグ)見た目になる。
//
// 注意: 水のメッシュは必ず「閉じた立体で、面が外向き」であること(このツールが出力する WaterVolume はそうなっています)。
//       ステンシルの下位4ビット(0-15)だけを使い、塗り終わったら 0 に戻します。
Shader "MyWorld/Low Poly Water Volume" {
    Properties {
        _UnderColor ("Under Water Color", Color) = (0.04, 0.24, 0.32, 1)
        _MinAlpha ("Near Tint (0-1)", Range(0, 1)) = 0.20
        _MaxAlpha ("Far Tint (0-1)", Range(0, 1)) = 0.93
        _Density ("Fog Density", Range(0.005, 0.6)) = 0.10
    }

    CGINCLUDE
    #include "UnityCG.cginc"

    struct appdata {
        float4 vertex : POSITION;
        UNITY_VERTEX_INPUT_INSTANCE_ID
    };
    struct v2f {
        float4 pos : SV_POSITION;
        float3 worldPos : TEXCOORD0;
        UNITY_VERTEX_OUTPUT_STEREO
    };

    v2f vert(appdata v) {
        v2f o;
        UNITY_SETUP_INSTANCE_ID(v);
        UNITY_INITIALIZE_OUTPUT(v2f, o);
        UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
        o.pos = UnityObjectToClipPos(v.vertex);
        o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
        return o;
    }

    fixed4 fragCount(v2f i) : SV_Target { return 0; }

    fixed4 _UnderColor;
    float _MinAlpha;
    float _MaxAlpha;
    float _Density;

    fixed4 fragTint(v2f i) : SV_Target {
        float dist = length(i.worldPos - _WorldSpaceCameraPos);
        float fog = 1.0 - exp(-dist * _Density);
        return fixed4(_UnderColor.rgb, lerp(_MinAlpha, _MaxAlpha, fog));
    }
    ENDCG

    SubShader {
        Tags { "Queue"="Transparent+10" "RenderType"="Transparent" "IgnoreProjector"="True" "ForceNoShadowCasting"="True" }
        LOD 100

        // 1) 裏面を描いて +1（色は出さない。奥の物に隠れていても数える）
        Pass {
            Cull Front
            ZTest Always
            ZWrite Off
            ColorMask 0
            Stencil { Ref 0 ReadMask 15 WriteMask 15 Comp Always Pass IncrWrap }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment fragCount
            #pragma target 3.0
            ENDCG
        }

        // 2) 表面を描いて −1
        Pass {
            Cull Back
            ZTest Always
            ZWrite Off
            ColorMask 0
            Stencil { Ref 0 ReadMask 15 WriteMask 15 Comp Always Pass DecrWrap }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment fragCount
            #pragma target 3.0
            ENDCG
        }

        // 3) 数が 0 でないピクセル(=水の中)だけ、裏面の位置に水色を重ねる。塗ったら 0 に戻す
        Pass {
            Cull Front
            ZTest Always
            ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha
            Stencil { Ref 0 ReadMask 15 WriteMask 15 Comp NotEqual Pass Zero }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment fragTint
            #pragma target 3.0
            ENDCG
        }
    }
    FallBack Off
}
