import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
import numpy as np
from PIL import Image
import logging
from pathlib import Path
import timm

logger = logging.getLogger(__name__)

class GeneralConditionClassifier:
    
    def __init__(self, model_path: str, device: str = 'cpu'):
        self.device = device
        self.model_path = model_path
        self.model = None
        
        # 23 skin condition classes from DermNet dataset
        self.class_names = [
            'Acne and Rosacea Photos',
            'Actinic Keratosis Basal Cell Carcinoma and other Malignant Lesions',
            'Atopic Dermatitis Photos', 
            'Bullous Disease Photos',
            'Cellulitis Impetigo and other Bacterial Infections',
            'Eczema Photos',
            'Exanthems and Drug Eruptions',
            'Hair Loss Photos Alopecia and other Hair Diseases',
            'Herpes HPV and other STDs Photos',
            'Light Diseases and Disorders of Pigmentation',
            'Lupus and other Connective Tissue diseases',
            'Melanoma Skin Cancer Nevi and Moles',
            'Nail Fungus and other Nail Disease',
            'Poison Ivy Photos and other Contact Dermatitis',
            'Psoriasis pictures Lichen Planus and related diseases',
            'Scabies Lyme Disease and other Infestations and Bites',
            'Seborrheic Keratoses and other Benign Tumors',
            'Systemic Disease',
            'Tinea Ringworm Candidiasis and other Fungal Infections',
            'Urticaria Hives',
            'Vascular Tumors',
            'Vasculitis Photos',
            'Warts Molluscum and other Viral Infections'
        ]
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                              std=[0.229, 0.224, 0.225])
        ])
        
        self._load_model()
    
    def _load_model(self):
        try:
            self.model = models.mobilenet_v2(pretrained=False)
            in_features = self.model.classifier[1].in_features
            self.model.classifier = nn.Sequential(
                nn.Dropout(0.3),
                nn.Linear(in_features, 23)
            )
            
            checkpoint = torch.load(self.model_path, map_location=self.device)
            if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['state_dict'])
            else:
                self.model.load_state_dict(checkpoint)
            
            self.model.to(self.device)
            self.model.eval()
            logger.info(f"General condition model loaded from {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to load general condition model: {e}")
            self.model = None
    
    def predict(self, image: Image.Image):
        if self.model is None:
            logger.warning("General condition model not loaded, returning fallback")
            return {
                'condition': 'unknown',
                'confidence': 0.0,
                'is_acne': False,
                'class_probabilities': {}
            }
        
        try:
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = F.softmax(outputs, dim=1)
                confidence, predicted_idx = torch.max(probabilities, 1)
                
                predicted_class = self.class_names[predicted_idx.item()]
                confidence_score = confidence.item()
                
                is_acne = 'acne' in predicted_class.lower() or 'rosacea' in predicted_class.lower()
                
                class_probs = {}
                for i, class_name in enumerate(self.class_names):
                    class_probs[class_name] = probabilities[0][i].item()
                
                return {
                    'condition': predicted_class,
                    'confidence': confidence_score,
                    'is_acne': is_acne,
                    'class_probabilities': class_probs
                }
                
        except Exception as e:
            logger.error(f"Error in general condition prediction: {e}")
            return {
                'condition': 'error',
                'confidence': 0.0,
                'is_acne': False,
                'class_probabilities': {}
            }

class AcneClassifier:
    
    def __init__(self, model_path: str, device: str = 'cpu'):
        self.device = device
        self.model_path = model_path
        self.model = None
        self.class_names = ['clear', 'mild', 'moderate', 'severe']
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                              std=[0.229, 0.224, 0.225])
        ])
        
        self._load_model()
    
    def _create_model(self, model_name='mobilenet_v2', num_classes=4, dropout=0.3):
        if model_name == 'mobilenet_v2':
            model = models.mobilenet_v2(pretrained=False)
            in_features = model.classifier[1].in_features
            model.classifier = nn.Sequential(
                nn.Dropout(dropout),
                nn.Linear(in_features, num_classes)
            )
        elif model_name == 'resnet50':
            model = models.resnet50(pretrained=False)
            in_features = model.fc.in_features
            model.fc = nn.Sequential(
                nn.Dropout(dropout),
                nn.Linear(in_features, num_classes)
            )
        else:
            raise ValueError(f"Unsupported model: {model_name}")
        
        return model
    
    def _load_model(self):
        try:
            if not Path(self.model_path).exists():
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            # Load checkpoint
            checkpoint = torch.load(self.model_path, map_location=self.device)
            
            model_name = checkpoint.get('model_name', 'mobilenet_v2')
            dropout = checkpoint.get('dropout', 0.3)
            
            self.model = self._create_model(model_name, num_classes=4, dropout=dropout)
            
            # Load weights
            if 'model_state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state_dict'])
            else:
                self.model.load_state_dict(checkpoint)
            
            self.model.to(self.device)
            self.model.eval()
            
            logger.info(f"Loaded acne classification model: {model_name}")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self.model = None
    
    def predict(self, image_bgr: np.ndarray) -> dict:
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        try:
            image_rgb = image_bgr[:, :, ::-1]
            pil_image = Image.fromarray(image_rgb)
            
            input_tensor = self.transform(pil_image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = F.softmax(outputs, dim=1)
                confidence, predicted_class = torch.max(probabilities, 1)
                
                class_probs = probabilities.cpu().numpy()[0]
                
            predicted_severity = self.class_names[predicted_class.item()]
            confidence_score = confidence.item()
            
            # Map severity to numeric score (0-1)
            severity_mapping = {
                'mild': 0.2,
                'moderate': 0.4, 
                'severe': 0.7,
                'very_severe': 1.0
            }
            
            return {
                'predicted_class': predicted_severity,
                'confidence': confidence_score,
                'severity_score': severity_mapping[predicted_severity],
                'class_probabilities': {
                    name: float(prob) for name, prob in zip(self.class_names, class_probs)
                },
                'raw_scores': outputs.cpu().numpy()[0].tolist()
            }
            
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise
    
    def is_available(self) -> bool:
        return self.model is not None

_acne_model = None

def get_acne_model() -> AcneClassifier:
    global _acne_model
    
    if _acne_model is None:
        model_path = Path(__file__).parent.parent.parent / "ml/training/final_model_v1.pth"
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        _acne_model = AcneClassifier(str(model_path), device=device)
    
    return _acne_model