from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


class Gender(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class SkinType(str, Enum):
    normal = "normal"
    dry = "dry"
    oily = "oily"
    combination = "combination"
    sensitive = "sensitive"


class ProblemType(str, Enum):
    acne = "acne"
    hyperpigmentation = "hyperpigmentation" 
    wrinkle = "wrinkle"
    redness = "redness"
    eczema = "eczema"
    psoriasis = "psoriasis"
    dermatitis = "dermatitis"
    melanoma = "melanoma"
    fungal = "fungal"
    bacterial = "bacterial"
    viral = "viral"
    other = "other"


class RequestPriority(str, Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", json_encoders={datetime: lambda v: v.isoformat()})

    request_id: str = Field(...)
    case_id: str = Field(...)
    image_id: str = Field(...)

    image_url: HttpUrl = Field(...)

    user_id: Optional[str] = None
    user_age: Optional[int] = Field(None, ge=0, le=120)
    gender: Optional[Gender] = None
    skin_type: Optional[SkinType] = None

    problem_type: Optional[ProblemType] = None
    is_follow_up: bool = False

    priority: RequestPriority = RequestPriority.normal
    created_at: datetime = Field(default_factory=datetime.utcnow)

    extra: Dict[str, Any] = Field(default_factory=dict)


class ValidationResult(BaseModel):
    is_valid: bool
    reasons: List[str] = Field(default_factory=list)
    
    def model_dump(self, **kwargs):
        return {
            "is_valid": self.is_valid,
            "reasons": self.reasons
        }
    
    def model_dump_json(self, **kwargs):
        import json
        return json.dumps(self.model_dump(**kwargs))


class Metrics(BaseModel):
    lesion_count: int = Field(..., ge=0)
    severity_score: float = Field(..., ge=0.0, le=1.0)
    per_region: Dict[str, int] = Field(default_factory=dict)
    extra: Dict[str, Any] = Field(default_factory=dict)


class Comparison(BaseModel):
    type: str = "previous_image"
    improvement_score: float
    notes: Optional[str] = None


class AnalysisResult(BaseModel):
    model_config = ConfigDict(json_encoders={datetime: lambda v: v.isoformat()})
    
    request_id: str
    case_id: str
    image_id: str

    is_valid: bool
    validation: ValidationResult
    metrics: Optional[Metrics] = None
    comparison: Optional[Comparison] = None

    processed_at: datetime = Field(default_factory=datetime.utcnow)
    original_image_path: Optional[str] = None
    processed_image_path: Optional[str] = None
    
    def model_dump(self, **kwargs):
        result = {
            "request_id": self.request_id,
            "case_id": self.case_id,
            "image_id": self.image_id,
            "is_valid": self.is_valid,
            "validation": self.validation.model_dump(),
            "metrics": self.metrics.model_dump() if self.metrics else None,
            "comparison": self.comparison.model_dump() if self.comparison else None,
            "processed_at": self.processed_at.isoformat(),
        }
        if self.original_image_path:
            result["original_image_path"] = self.original_image_path
        if self.processed_image_path:
            result["processed_image_path"] = self.processed_image_path
        return result
    
    def model_dump_json(self, **kwargs):
        import json
        return json.dumps(self.model_dump(**kwargs))
