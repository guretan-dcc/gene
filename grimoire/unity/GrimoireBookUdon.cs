// VRChat UdonSharp synchronized controller for Grimoire Forge Book.
// Automatically activates in projects with VRChat SDK3 + UdonSharp installed.
#if UDONSHARP
using UdonSharp;
using UnityEngine;
using VRC.SDKBase;
using VRC.Udon;

[UdonBehaviourSyncMode(BehaviourSyncMode.Manual)]
public class GrimoireBookUdon : UdonSharpBehaviour
{
    [Header("Rig Transforms")]
    public Transform spineRig;
    public Transform spineBoxMesh;
    public Transform leftCoverPivot;
    public Transform rightCoverPivot;
    public Transform turningPageGroup;
    public Transform[] indexTabs;

    [Header("BlendShape Renderers")]
    public SkinnedMeshRenderer leftPageStack;
    public SkinnedMeshRenderer leftPageUI;
    public SkinnedMeshRenderer rightPageStack;
    public SkinnedMeshRenderer rightPageUI;
    public SkinnedMeshRenderer turningPageFront;
    public SkinnedMeshRenderer turningPageBack;

    [Header("Page Textures (2 per spread)")]
    public Texture2D[] pageTextures;

    [Header("Book Dimensions")]
    public float bookWidth = 2.05f;
    public float thickness = 0.54f;
    public float minT = 0.0756f;
    public float maxT = 0.4644f;
    public float seamY = 0.059f;
    public float pageW = 1.91f;

    [Header("Synced Book State")]
    [UdonSynced] public bool syncedOpen = true;
    [UdonSynced] public int syncedSpread = 0;

    [Header("Animation Speed")]
    public float openSpeed = 8.5f;
    public float flipSpeed = 1.75f;

    private const int TurnStageCount = 6;
    private float openCurrent = 1f;
    private int displayedSpread = 0;
    private float spreadVisual = 0f;
    private bool isFlipping = false;
    private int flipDir = 1;
    private float flipProgress = 0f;
    private int fromSpread = 0;
    private int nextSpread = 0;

    private Material leftUiMat;
    private Material rightUiMat;
    private Material turnFrontMat;
    private Material turnBackMat;

    private int GetSpreadCount()
    {
        return pageTextures != null ? Mathf.Max(1, pageTextures.Length / 2) : 1;
    }

    private void Start()
    {
        openCurrent = syncedOpen ? 1f : 0f;
        displayedSpread = Mathf.Clamp(syncedSpread, 0, GetSpreadCount() - 1);
        spreadVisual = displayedSpread;

        if (leftPageUI != null) leftUiMat = leftPageUI.material;
        if (rightPageUI != null) rightUiMat = rightPageUI.material;
        if (turningPageFront != null) turnFrontMat = turningPageFront.material;
        if (turningPageBack != null) turnBackMat = turningPageBack.material;

        if (turningPageGroup != null) turningPageGroup.gameObject.SetActive(false);
        RefreshSpreadTextures(displayedSpread);
        UpdateBookPose();
    }

    public override void Interact()
    {
        ToggleOpen();
    }

    public void ToggleOpen()
    {
        if (isFlipping) return;
        Networking.SetOwner(Networking.LocalPlayer, gameObject);
        syncedOpen = !syncedOpen;
        RequestSerialization();
    }

    public void NextPage()
    {
        int target = syncedSpread + 1;
        if (!syncedOpen || target >= GetSpreadCount()) return;
        Networking.SetOwner(Networking.LocalPlayer, gameObject);
        syncedSpread = target;
        RequestSerialization();
        BeginFlipLocal(syncedSpread);
    }

    public void PrevPage()
    {
        int target = syncedSpread - 1;
        if (!syncedOpen || target < 0) return;
        Networking.SetOwner(Networking.LocalPlayer, gameObject);
        syncedSpread = target;
        RequestSerialization();
        BeginFlipLocal(syncedSpread);
    }

    public override void OnDeserialization()
    {
        if (syncedSpread != displayedSpread)
        {
            if (syncedOpen && openCurrent > 0.85f && !isFlipping)
            {
                BeginFlipLocal(syncedSpread);
            }
            else
            {
                isFlipping = false;
                if (turningPageGroup != null) turningPageGroup.gameObject.SetActive(false);
                displayedSpread = Mathf.Clamp(syncedSpread, 0, GetSpreadCount() - 1);
                spreadVisual = displayedSpread;
                RefreshSpreadTextures(displayedSpread);
                UpdateBookPose();
            }
        }
    }

    private void BeginFlipLocal(int target)
    {
        if (isFlipping || target == displayedSpread) return;
        fromSpread = displayedSpread;
        nextSpread = Mathf.Clamp(target, 0, GetSpreadCount() - 1);
        flipDir = nextSpread > fromSpread ? 1 : -1;
        flipProgress = 0f;
        isFlipping = true;

        PrepareTurningTextures(fromSpread, nextSpread, flipDir);
        if (turningPageGroup != null) turningPageGroup.gameObject.SetActive(true);
        ApplyTurningShapeKeys(flipDir == 1 ? 0f : 1f);
        UpdateBookPose();
    }

    private void Update()
    {
        float dt = Mathf.Min(0.05f, Time.deltaTime);
        float openTarget = syncedOpen ? 1f : 0f;
        bool dirty = false;

        if (Mathf.Abs(openTarget - openCurrent) > 0.0005f)
        {
            openCurrent = Mathf.Lerp(openCurrent, openTarget, Mathf.Min(1f, dt * openSpeed));
            if (Mathf.Abs(openTarget - openCurrent) < 0.001f) openCurrent = openTarget;
            dirty = true;
        }

        if (isFlipping)
        {
            flipProgress += dt * flipSpeed;
            if (flipProgress >= 1f)
            {
                isFlipping = false;
                flipProgress = 0f;
                displayedSpread = nextSpread;
                spreadVisual = displayedSpread;
                if (turningPageGroup != null) turningPageGroup.gameObject.SetActive(false);
                RefreshSpreadTextures(displayedSpread);
                dirty = true;
            }
            else
            {
                float t = flipProgress;
                float ease = t < 0.5f ? 2f * t * t : 1f - Mathf.Pow(-2f * t + 2f, 2f) * 0.5f;
                float p = flipDir == 1 ? ease : 1f - ease;
                spreadVisual = Mathf.Lerp(fromSpread, nextSpread, ease);
                ApplyTurningShapeKeys(p);
                dirty = true;
            }
        }

        if (dirty) UpdateBookPose();
    }

    private void SetTexture(Material mat, int pageIndex)
    {
        if (mat == null || pageTextures == null || pageIndex < 0 || pageIndex >= pageTextures.Length) return;
        mat.mainTexture = pageTextures[pageIndex];
    }

    private void RefreshSpreadTextures(int spreadIdx)
    {
        SetTexture(leftUiMat, spreadIdx * 2);
        SetTexture(rightUiMat, spreadIdx * 2 + 1);
    }

    private void PrepareTurningTextures(int fromIdx, int toIdx, int dir)
    {
        if (dir == 1)
        {
            SetTexture(turnFrontMat, fromIdx * 2 + 1);
            SetTexture(turnBackMat, toIdx * 2);
            SetTexture(rightUiMat, toIdx * 2 + 1);
        }
        else
        {
            SetTexture(turnBackMat, fromIdx * 2);
            SetTexture(turnFrontMat, toIdx * 2 + 1);
            SetTexture(leftUiMat, toIdx * 2);
        }
    }

    private float GetStackSlope(float stackT)
    {
        float val = (stackT - seamY) / Mathf.Max(0.01f, pageW);
        return Mathf.Asin(Mathf.Clamp(val, -0.48f, 0.48f));
    }

    private void ApplyTurningShapeKeys(float p)
    {
        if (turningPageFront == null || turningPageBack == null || turningPageGroup == null) return;
        float clamped = Mathf.Clamp01(p);
        float scaled = clamped * TurnStageCount;
        int seg = Mathf.Min(TurnStageCount - 1, Mathf.FloorToInt(scaled));
        float alpha = scaled - seg;

        for (int i = 0; i < TurnStageCount; i++)
        {
            turningPageFront.SetBlendShapeWeight(i, 0f);
            turningPageBack.SetBlendShapeWeight(i, 0f);
        }

        if (seg == 0)
        {
            turningPageFront.SetBlendShapeWeight(0, alpha * 100f);
            turningPageBack.SetBlendShapeWeight(0, alpha * 100f);
        }
        else
        {
            turningPageFront.SetBlendShapeWeight(seg - 1, (1f - alpha) * 100f);
            turningPageBack.SetBlendShapeWeight(seg - 1, (1f - alpha) * 100f);
            turningPageFront.SetBlendShapeWeight(seg, alpha * 100f);
            turningPageBack.SetBlendShapeWeight(seg, alpha * 100f);
        }

        float maxIdx = Mathf.Max(1, GetSpreadCount() - 1);
        float ratio = Mathf.Clamp01(spreadVisual / maxIdx);
        float leftT = Mathf.Lerp(minT, maxT, ratio);
        float rightT = thickness - leftT;
        float slopeMid = GetStackSlope(thickness * 0.5f);
        float slopeRight = GetStackSlope(rightT);
        float slopeLeft = GetStackSlope(leftT);
        float rotRad = (slopeRight - slopeMid) * (1f - clamped) - (slopeLeft - slopeMid) * clamped;
        turningPageGroup.localRotation = Quaternion.Euler(0f, 0f, rotRad * Mathf.Rad2Deg);
    }

    private void UpdateBookPose()
    {
        float open = Mathf.Clamp01(openCurrent);
        float foldDeg = (1f - open) * 90f;
        float sinA = Mathf.Sin(foldDeg * Mathf.Deg2Rad);
        float halfT = thickness * 0.5f;

        if (leftCoverPivot != null)
        {
            leftCoverPivot.localPosition = new Vector3(-halfT * sinA, 0f, 0f);
            leftCoverPivot.localRotation = Quaternion.Euler(0f, 0f, -foldDeg);
        }
        if (rightCoverPivot != null)
        {
            rightCoverPivot.localPosition = new Vector3(halfT * sinA, 0f, 0f);
            rightCoverPivot.localRotation = Quaternion.Euler(0f, 0f, foldDeg);
        }
        if (spineBoxMesh != null)
        {
            spineBoxMesh.gameObject.SetActive(sinA > 0.015f);
            spineBoxMesh.localScale = new Vector3(Mathf.Max(0.001f, sinA), 1f, 1f);
        }
        if (spineRig != null)
        {
            spineRig.localRotation = Quaternion.Euler(0f, 0f, -foldDeg);
            spineRig.localPosition = new Vector3(-bookWidth * 0.5f * sinA, 0f, 0f);
        }

        float maxIdx = Mathf.Max(1, GetSpreadCount() - 1);
        float ratio = Mathf.Clamp01(spreadVisual / maxIdx);
        float rLeft = ratio;
        float rRight = 1f - ratio;

        ApplyStackWeights(leftPageStack, open, rLeft);
        ApplyStackWeights(leftPageUI, open, rLeft);
        ApplyStackWeights(rightPageStack, open, rRight);
        ApplyStackWeights(rightPageUI, open, rRight);

        if (indexTabs != null && indexTabs.Length > 0)
        {
            float rightT = thickness - Mathf.Lerp(minT, maxT, ratio);
            float usableH = Mathf.Max(0.03f, rightT - 0.024f);
            float openEndX = pageW * (1f - 0.025f * open);
            for (int i = 0; i < indexTabs.Length; i++)
            {
                if (indexTabs[i] == null) continue;
                float frac = 0.84f - (i / (float)Mathf.Max(1, indexTabs.Length - 1)) * 0.64f;
                Vector3 p = indexTabs[i].localPosition;
                p.x = openEndX + 0.055f;
                p.y = Mathf.Max(0.014f, 0.012f + usableH * frac);
                indexTabs[i].localPosition = p;
            }
        }
    }

    private void ApplyStackWeights(SkinnedMeshRenderer smr, float open, float r)
    {
        if (smr == null || smr.sharedMesh == null || smr.sharedMesh.blendShapeCount < 3) return;
        smr.SetBlendShapeWeight(0, (1f - open) * r * 100f);
        smr.SetBlendShapeWeight(1, open * (1f - r) * 100f);
        smr.SetBlendShapeWeight(2, open * r * 100f);
    }
}
#endif
