Dermatology Image Pre-Processing (Unsupervised Segmentation)

Generates approximate lesion ROI masks before feeding images to our classifier (e.g. ViT).

Pipeline:
KMeans (Lab) → SLIC → (LoG + entropy) → trimap → GrabCut → morphology

Goal: reduce hair / glare / background noise and make the model focus on the lesion region.

Input Requirements

Path: ml/datasets/testing/inputs

Accepted formats: png, jpg, jpeg

Place your test images in the folder above before running the script.