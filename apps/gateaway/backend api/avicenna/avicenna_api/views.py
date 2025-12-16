from rest_framework.generics import ListAPIView, RetrieveAPIView
from .permissions import IsDoctor
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.shortcuts import get_object_or_404
from .models import *
from .serializers import *
from rest_framework import status
from rest_framework.views import APIView

# Create your views here.

# START AUTHENTICATION


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def is_authenticated(request):
    return Response({'authenticated': True})

# END AUTHENTICATION


# DOCTOR
class DoctorSubmissionsView(ListAPIView):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated, IsDoctor]

    def get_queryset(self):
        return (
            Submission.objects
            .filter(doctor=self.request.user)
            .order_by('-created_at')
        )


class DoctorSubmissionDetailView(RetrieveAPIView):
    serializer_class = SubmissionDetailSerializer
    permission_classes = [IsAuthenticated, IsDoctor]

    def get_queryset(self):
        # 🔐 Doctor can only access their own submissions
        return Submission.objects.filter(doctor=self.request.user)


class DoctorMeView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        if user.role != User.ROLE_DOCTOR:
            return Response(
                {"detail": "Not a doctor"},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            profile = user.doctor_profile
        except DoctorProfile.DoesNotExist:
            return Response(
                {"detail": "Doctor profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = DoctorProfileSerializer(profile)
        return Response(serializer.data)


class DoctorDashboardView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor = request.user

        submissions = Submission.objects.filter(doctor=doctor)

        stats = {
            "pending_submissions": submissions.filter(status="pending").count(),
            "completed_submissions": submissions.filter(status="reviewed").count(),
            "patients_count": submissions.values("patient").distinct().count(),
        }

        recent_cases_qs = (
            submissions
            .select_related("patient")
            .order_by("-created_at")[:5]
        )

        recent_cases = [
            {
                "id": s.id,
                "patient_name": s.patient.get_full_name() or s.patient.username,
                "status": s.status,
            }
            for s in recent_cases_qs
        ]

        payload = {
            "doctor": {
                "id": doctor.id,
                "first_name": doctor.first_name,
                "last_name": doctor.last_name,
                "username": doctor.username,
                "email": doctor.email,
            },
            "stats": stats,
            "recent_cases": recent_cases,
        }

        serializer = DoctorDashboardSerializer(payload)
        return Response(serializer.data)



class DoctorProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor = request.user.doctor
        serializer = DoctorProfileSerializer(doctor)
        return Response(serializer.data)

    def patch(self, request):
        doctor = request.user.doctor

        serializer = DoctorPreferencesUpdateSerializer(
            doctor,
            data=request.data,
            partial=True
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"detail": "Profile updated successfully"},
            status=status.HTTP_200_OK
        )


class SubmissionReportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        submission = get_object_or_404(Submission, id=id)

        if not hasattr(submission, "report"):
            return Response(
                {"detail": "Report not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ReportCreateSerializer(submission.report)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, id):
        submission = get_object_or_404(Submission, id=id)

        # Prevent duplicate report
        if hasattr(submission, "report"):
            return Response(
                {"detail": "Report already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        report = serializer.save(submission=submission)

        # Mark submission as reviewed
        submission.status = "reviewed"
        submission.save(update_fields=["status"])

        return Response(
            {"detail": "Report created successfully."},
            status=status.HTTP_201_CREATED,
        )