# Çağla B. Çam
# 15 Dec 2025

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from processing_server.image_processing import (
    ImageProcessor,
    ProcessingConfig,
)


def test_preprocessing():
    test_images_dir = Path("../processing_images/skin_photos")
    images = list(test_images_dir.glob("*.jpg")) + list(test_images_dir.glob("*.jpeg"))
    
    if not images:
        print("no test images found")
        return
    
    configs = {
        "no_preprocessing": ProcessingConfig(
            target_size=(512, 512),
            color_constancy_method="none",
            use_clahe=False,
            detect_skin_roi=False,
            denoise=False,
        ),
        "only_color_constancy": ProcessingConfig(
            target_size=(512, 512),
            color_constancy_method="shades_of_gray",
            shades_of_gray_p=6.0,
            use_clahe=False,
            detect_skin_roi=False,
            denoise=False,
        ),
        "color_and_clahe": ProcessingConfig(
            target_size=(512, 512),
            color_constancy_method="shades_of_gray",
            shades_of_gray_p=6.0,
            use_clahe=True,
            clahe_clip_limit=2.0,
            detect_skin_roi=False,
            denoise=False,
        ),
        "processed_final": ProcessingConfig(
            target_size=(512, 512),
            color_constancy_method="shades_of_gray",
            shades_of_gray_p=6.0,
            use_clahe=True,
            clahe_clip_limit=2.0,
            detect_skin_roi=True,
            roi_padding=0.1,
            denoise=True,
            denoise_strength=1,
        ),
    }
    
    for input_image in images:
        condition_name = input_image.parent.name
        output_condition_dir = Path(f"../processing_images/skin_photos_processed/{condition_name}")
        output_condition_dir.mkdir(parents=True, exist_ok=True)
        
        original_output = output_condition_dir / f"1_original{input_image.suffix}"
        if not original_output.exists():
            import shutil
            shutil.copy(input_image, original_output)
        
        for idx, (name, config) in enumerate(configs.items(), start=2):
            processor = ImageProcessor(config)
            output_image = output_condition_dir / f"{idx}_{name}.jpg"
            processor.process(input_image, output_image)
            print(f"processed: {condition_name}/{name}")


if __name__ == "__main__":
    test_preprocessing()
