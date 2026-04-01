from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.contrib.auth import get_user_model, authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from .authentication import CsrfExemptSessionAuthentication

from .models import PatientProfile, SkinPhoto
from .serializers import (
    PatientRegisterSerializer,
    PatientProfileSerializer,
    SkinPhotoSerializer,
)
from .permissions import IsDoctor, IsPatientOrDoctorForPhoto

import cv2
import numpy as np

User = get_user_model()

class ApiRootView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            "message": "Avicenna API is running",
            "endpoints": {
                "login": "/api/auth/login/",
                "logout": "/api/auth/logout/",
                "me": "/api/auth/me/",
                "photos": "/api/photos/",
                "doctor_dashboard": "/api/doctor/dashboard/",
                "doctor_cases": "/api/doctor/cases/",
            }
        })
    
def check_image_quality(image_file):
    try:
        file_bytes = np.frombuffer(image_file.read(), np.uint8)
        image_file.seek(0)

        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if img is None:
            return False, "Invalid image"

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if lap_var < 50:
            return False, "Image is too blurry"

        brightness = gray.mean()
        if brightness < 40:
            return False, "Image is too dark"
        if brightness > 215:
            return False, "Image is too bright"

        return True, "OK"

    except Exception:
        return False, "Image processing failed"


def run_model_inference(image_path: str) -> dict:
    """
    TODO: Replace with your REAL model integration.
    Return dict with:
      diagnosis (str), confidence (float), raw_output (json)
    """
    return {
        "diagnosis": "unknown",
        "confidence": 0.0,
        "raw_output": {"note": "model not integrated"},
    }


def normalize_gender(val: str | None):
    if not val:
        return None
    v = val.strip().lower()
    if v.startswith("m"):
        return "male"
    if v.startswith("f"):
        return "female"
    return None


def normalize_skin_type(val: str | None):
    if not val:
        return None
    v = val.strip().lower()
    mapping = {
        "normal": "normal",
        "dry": "dry",
        "oily": "oily",
        "combination": "combined",
        "combined": "combined",
        "sensitive": "normal",  # you can add a real 'sensitive' choice later if you want
    }
    return mapping.get(v, None)


def get_or_create_patient_from_email(email: str):
    email = (email or "").strip().lower()
    if not email:
        return None
    username = email.split("@")[0]
    user = User.objects.filter(email=email).first()
    if user:
        if user.role != User.ROLE_PATIENT:
            user.role = User.ROLE_PATIENT
            user.save(update_fields=["role"])
        PatientProfile.objects.get_or_create(patient=user)
        return user

    user = User(email=email, username=username, role=User.ROLE_PATIENT)
    user.set_unusable_password()
    user.save()
    PatientProfile.objects.get_or_create(patient=user)
    return user


# ---- AUTH endpoints (optional) ----

class SessionLoginView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        if not email or not password:
            return Response(
                {"error": "email and password required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = email.split("@")[0]
        user = authenticate(request, username=username, password=password)

        if not user:
            return Response(
                {"error": "invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"error": "account disabled"},
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, user)

        return Response(
            {
                "status": "ok",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "role": user.role,
                },
            }
        )
    
class SessionLogoutView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]

    def post(self, request):
        logout(request)
        return Response({"status": "ok"})


class MeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"authenticated": False},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        u = request.user
        return Response(
            {
                "authenticated": True,
                "user": {
                    "id": u.id,
                    "email": u.email,
                    "username": u.username,
                    "role": u.role,
                },
            },
            status=status.HTTP_200_OK,
        )

# ---- existing flows ----

class PatientRegisterView(generics.CreateAPIView):
    serializer_class = PatientRegisterSerializer
    permission_classes = [permissions.AllowAny]


class PatientProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = PatientProfileSerializer
    permission_classes = [permissions.AllowAny]  # frontend might not auth

    def get_object(self):
        # If authenticated -> use user
        if self.request.user.is_authenticated:
            PatientProfile.objects.get_or_create(patient=self.request.user)
            return self.request.user.profile

        # Else -> use email from payload/query (so no frontend login changes required)
        email = self.request.data.get("email") or self.request.query_params.get("email")
        user = get_or_create_patient_from_email(email)
        if not user:
            # still return 400 to avoid silent wrong data
            raise ValidationError("email is required when not authenticated")
        return user.profile

    def update(self, request, *args, **kwargs):
        # Normalize enum-like fields coming from UI labels
        data = request.data.copy()
        if "gender" in data:
            data["gender"] = normalize_gender(data.get("gender"))
        if "skin_type" in data:
            data["skin_type"] = normalize_skin_type(data.get("skin_type"))
        request._full_data = data  # hacky but works in DRF; alternative is overriding serializer

        return super().update(request, *args, **kwargs)


class SkinPhotoListCreateView(generics.ListCreateAPIView):
    serializer_class = SkinPhotoSerializer
    permission_classes = [permissions.AllowAny]  # allow no-auth upload/list (uses email fallback)

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            if user.role == User.ROLE_DOCTOR:
                return SkinPhoto.objects.filter(doctor=user).order_by("-created_at")
            return SkinPhoto.objects.filter(patient=user).order_by("-created_at")

        # No auth -> filter by email if provided
        email = self.request.query_params.get("email")
        u = get_or_create_patient_from_email(email) if email else None
        if not u:
            return SkinPhoto.objects.none()
        return SkinPhoto.objects.filter(patient=u).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        # Accept multiple possible keys from frontend
        image_file = request.FILES.get("image") or request.FILES.get("photo") or request.FILES.get("file")
        if not image_file:
            return Response({"status": "error", "error": "Image is required (image/photo/file)"}, status=400)

        # Determine patient user
        if request.user.is_authenticated:
            patient = request.user
        else:
            email = request.data.get("email") or request.query_params.get("email")
            patient = get_or_create_patient_from_email(email)
            if not patient:
                return Response({"status": "error", "error": "email is required when not authenticated"}, status=400)

        # 1) QUALITY CHECK
        ok, message = check_image_quality(image_file)
        image_file.seek(0)

        if not ok:
            # Option: do NOT save bad images; just return reason
            return Response({"status": "rejected", "reason": message}, status=200)

        # 2) SAVE (serializer expects 'patient' injected)
        mutable = request.data.copy()
        # Ensure serializer sees an 'image' field name
        if "image" not in request.FILES:
            # DRF serializer reads from request.FILES, so we just pass the file with field name 'image'
            pass

        serializer = self.get_serializer(
            data={
                "image": image_file, 
                "area": request.data.get("area", ""), 
                "description": request.data.get("description", ""), 
                "doctor_id": request.data.get("doctor_id")}
        )
        serializer.is_valid(raise_exception=True)
        photo: SkinPhoto = serializer.save(patient=patient, doctor = doctor)

        # 3) INFERENCE
        try:
            result = run_model_inference(photo.image.path)
        except Exception as e:
            photo.status = SkinPhoto.STATUS_PENDING
            photo.raw_output = {"error": str(e)}
            photo.save()

            return Response(
                {"status": "error", "error": "Model inference failed"},
                status=500,
            )
        photo.diagnosis = str(result.get("diagnosis", ""))[:256]
        conf = result.get("confidence", None)
        photo.confidence = float(conf) if conf is not None else None
        photo.raw_output = result.get("raw_output", result)
        photo.status = SkinPhoto.STATUS_REVIEWED
        photo.rejection_reason = ""
        photo.save()

        out = self.get_serializer(photo, context={"request": request})
        return Response(
            {"status": "success", "photo": out.data},
            status=status.HTTP_201_CREATED,
)


class SkinPhotoDetailView(generics.RetrieveAPIView):
    serializer_class = SkinPhotoSerializer
    permission_classes = [permissions.IsAuthenticated, IsPatientOrDoctorForPhoto]

    def get_queryset(self):
        return SkinPhoto.objects.all()



#### DOCTOR INTERFACE IMPLEMENTATION

class DoctorCaseListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctor]

    def get(self, request):
        photos = SkinPhoto.objects.select_related("patient", "doctor").filter(
            doctor=request.user
        ).order_by("-created_at")

        serializer = SkinPhotoSerializer(
            photos,
            many=True,
            context={"request": request}
        )
        return Response({"cases": serializer.data}, status=status.HTTP_200_OK)

class DoctorDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != User.ROLE_DOCTOR:
            return Response(
                {"error": "Doctor access required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        photos = SkinPhoto.objects.filter(doctor=user).order_by("-created_at")

        serializer = SkinPhotoSerializer(photos, many=True, context={"request": request})

        return Response(
            {
                "total_cases": photos.count(),
                "cases": serializer.data,
            }
        )

        

class DoctorReviewCaseView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated, IsDoctor]

    def post(self, request, photo_id):
        try:
            photo = SkinPhoto.objects.select_related("patient", "doctor").get(
                id=photo_id, doctor=request.user
            )
        except SkinPhoto.DoesNotExist:
            return Response(
                {"error": "Case not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        diagnosis = request.data.get("diagnosis")
        confidence = request.data.get("confidence")
        doctor_note = request.data.get("doctor_note")

        if diagnosis is not None:
            photo.diagnosis = diagnosis

        if confidence not in (None, ""):
            try:
                photo.confidence = float(confidence)
            except ValueError:
                return Response(
                    {"error": "confidence must be a number"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if doctor_note:
            photo.raw_output = {
                **(photo.raw_output or {}),
                "doctor_note": doctor_note,
            }

        photo.status = SkinPhoto.STATUS_REVIEWED
        photo.doctor = request.user
        photo.save()

        serializer = SkinPhotoSerializer(photo, context={"request": request})
        return Response({"status": "updated", "photo": serializer.data})
    
    
class DoctorCaseDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, photo_id):

        user = request.user

        if user.role != User.ROLE_DOCTOR:
            return Response(
                {"error": "Doctor access required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            photo = SkinPhoto.objects.select_related("patient").get(id=photo_id)
        except SkinPhoto.DoesNotExist:
            return Response(
                {"error": "Case not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = SkinPhotoSerializer(photo, context={"request": request})

        return Response(serializer.data)