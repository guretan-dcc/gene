using UnityEngine;

namespace GrimoireForge
{
    /// <summary>
    /// Standard Unity controller for Grimoire Forge low-poly book.
    /// Drives open/close folding, dynamic left/right stack thickness BlendShapes,
    /// and 6-stage progressive turning page BlendShapes (Turn_17..Turn_100).
    /// Controls in Play Mode: [Space] Open/Close, [Left/Right Arrow] Flip Page.
    /// </summary>
    public class GrimoireBookController : MonoBehaviour
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

        [Header("Book Dimensions (Auto-filled by Builder)")]
        public float bookWidth = 2.05f;
        public float thickness = 0.54f;
        public float minT = 0.0756f;
        public float maxT = 0.4644f;
        public float seamY = 0.059f;
        public float pageW = 1.91f;

        [Header("State & Animation")]
        public bool isOpen = true;
        public int currentSpread = 0;
        public float openSpeed = 8.5f;
        public float flipSpeed = 1.75f;
        public bool enableKeyboardTest = true;

        private const int TurnStageCount = 6;
        private float openCurrent = 1f;
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

        public int SpreadCount
        {
            get { return pageTextures != null ? Mathf.Max(1, pageTextures.Length / 2) : 1; }
        }

        private void Start()
        {
            openCurrent = isOpen ? 1f : 0f;
            currentSpread = Mathf.Clamp(currentSpread, 0, SpreadCount - 1);
            spreadVisual = currentSpread;

            if (leftPageUI != null) leftUiMat = leftPageUI.material;
            if (rightPageUI != null) rightUiMat = rightPageUI.material;
            if (turningPageFront != null) turnFrontMat = turningPageFront.material;
            if (turningPageBack != null) turnBackMat = turningPageBack.material;

            if (turningPageGroup != null) turningPageGroup.gameObject.SetActive(false);
            RefreshSpreadTextures(currentSpread);
            UpdateBookPose();
        }

        private void Update()
        {
            if (enableKeyboardTest)
            {
                if (Input.GetKeyDown(KeyCode.Space)) ToggleOpen();
                if (Input.GetKeyDown(KeyCode.RightArrow)) NextPage();
                if (Input.GetKeyDown(KeyCode.LeftArrow)) PrevPage();
            }

            float dt = Mathf.Min(0.05f, Time.deltaTime);
            float openTarget = isOpen ? 1f : 0f;
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
                    currentSpread = nextSpread;
                    spreadVisual = currentSpread;
                    if (turningPageGroup != null) turningPageGroup.gameObject.SetActive(false);
                    RefreshSpreadTextures(currentSpread);
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

        public void ToggleOpen()
        {
            if (isFlipping) return;
            isOpen = !isOpen;
        }

        public void NextPage()
        {
            StartFlipTo(currentSpread + 1);
        }

        public void PrevPage()
        {
            StartFlipTo(currentSpread - 1);
        }

        public void StartFlipTo(int targetSpread)
        {
            if (isFlipping || !isOpen || openCurrent < 0.92f) return;
            if (targetSpread < 0 || targetSpread >= SpreadCount || targetSpread == currentSpread) return;

            fromSpread = currentSpread;
            nextSpread = targetSpread;
            flipDir = targetSpread > currentSpread ? 1 : -1;
            flipProgress = 0f;
            isFlipping = true;

            PrepareTurningTextures(fromSpread, nextSpread, flipDir);
            if (turningPageGroup != null) turningPageGroup.gameObject.SetActive(true);
            ApplyTurningShapeKeys(flipDir == 1 ? 0f : 1f);
            UpdateBookPose();
        }

        private void SetTexture(Material mat, int pageIndex)
        {
            if (mat == null || pageTextures == null || pageIndex < 0 || pageIndex >= pageTextures.Length) return;
            mat.mainTexture = pageTextures[pageIndex];
            if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", pageTextures[pageIndex]);
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

            float maxIdx = Mathf.Max(1, SpreadCount - 1);
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

            float maxIdx = Mathf.Max(1, SpreadCount - 1);
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
            smr.SetBlendShapeWeight(0, (1f - open) * r * 100f);       // Closed_Thick
            smr.SetBlendShapeWeight(1, open * (1f - r) * 100f);       // Open_Thin
            smr.SetBlendShapeWeight(2, open * r * 100f);              // Open_Thick
        }
    }
}
