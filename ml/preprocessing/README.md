Generates approximate lesion ROI masks before feeding images to our classifier (e.g., ViT). 

Pipeline: KMeans (Lab) → SLIC → (LoG + entropy) → trimap → GrabCut → morphology. Goal: reduce hair/glare/background noise and focus the model on the lesion.

Input Requirements

Place test images under:
ml/datasets/testing/inputs

Accepted formats: png, jpg, jpeg 
