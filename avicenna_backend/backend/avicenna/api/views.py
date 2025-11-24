from rest_framework import generics, permissions
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import PatientProfile, SkinPhoto
from .serializers import PatientRegisterSerializer, PatientProfileSerializer, SkinPhotoSerializer

import cv2
import numpy as np

User = get_user_model()


def check_image_quality(image_file):
    file_bytes = np.frombuffer(image_file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if img is None:
        return False, "Invalid image"

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Blur detection
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if lap_var < 50:
        return False, "Image is too blurry"

    # Brightness detection
    brightness = gray.mean()
    if brightness < 40:
        return False, "Image is too dark"
    if brightness > 215:
        return False, "Image is too bright"

    return True, "OK"


class PatientRegisterView(generics.CreateAPIView):
    serializer_class = PatientRegisterSerializer
    permission_classes = [permissions.AllowAny]


class PatientProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = PatientProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


class SkinPhotoListCreateView(generics.ListCreateAPIView):
    serializer_class = SkinPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.ROLE_DOCTOR:
            return SkinPhoto.objects.filter(doctor=user)
        return SkinPhoto.objects.filter(patient=user)

    def create(self, request, *args, **kwargs):

        image_file = request.FILES.get("image")
        if not image_file:
            return Response({"error": "Image is required"}, status=400)

        # QUALITY CHECK
        ok, message = check_image_quality(image_file)
        image_file.seek(0)

        if not ok:
            return Response({
                "status": "rejected",
                "reason": message,
                "action": "retake"
            })

        # Ask for confirmation
        if not request.data.get("confirm"):
            return Response({
                "status": "needs_confirmation",
                "message": "Image looks good. Do you want to continue?",
                "action": "confirm"
            })

        # Save image after confirmation
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(patient=request.user)

        return Response({
            "status": "saved",
            "message": "Image saved successfully",
            "photo": serializer.data
        })


class SkinPhotoDetailView(generics.RetrieveAPIView):
    serializer_class = SkinPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.ROLE_DOCTOR:
            return SkinPhoto.objects.filter(doctor=user)
        return SkinPhoto.objects.filter(patient=user)
