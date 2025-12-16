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
        
class SkinAnalysisViewSet(viewsets.ModelViewSet):
    queryset = SkinAnalysis.objects.all().order_by('-created_at')
    serializer_class = SkinAnalysisSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(prediction=None)

        return Response({
            "id": instance.id,
            "status": "processing",
            "message": "Upload successful. Waiting for analysis..."
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def check_status(self, request, pk=None):
        instance = self.get_object()

        if not instance.prediction:
            return Response({"status": "processing"})

        disease = instance.prediction.lower()
        questions = []


        if "acne" in disease:
            questions = [
                {"id": "deep", "text": "Is the spot painful and deep under the skin (cystic)?", "type": "yes_no"},
                {"id": "oily", "text": "Is your skin generally oily in this area?", "type": "yes_no"},
                {"id": "hormonal", "text": "Does it flare up with your menstrual cycle or stress?", "type": "yes_no"},
                {"id": "diet", "text": "Have you consumed high sugar or dairy recently?", "type": "yes_no"},
                {"id": "picking", "text": "Do you frequently touch or pick at these spots?", "type": "yes_no"},
                {"id": "routine", "text": "Did you change your face wash or moisturizer recently?", "type": "yes_no"}
            ]

        elif "eczema" in disease or "dermatitis" in disease:
            questions = [
                {"id": "itch_level", "text": "On a scale of 1-10, how intense is the itch?", "type": "number"},
                {"id": "night_itch", "text": "Does the itching wake you up at night?", "type": "yes_no"},
                {"id": "asthma", "text": "Do you or your family have asthma or hay fever?", "type": "yes_no"},
                {"id": "weeping", "text": "Is the area oozing clear fluid or crusting over?", "type": "yes_no"},
                {"id": "location", "text": "Is it inside your elbows, behind knees, or on the neck?", "type": "yes_no"},
                {"id": "trigger", "text": "Does it get worse with soaps, detergents, or cold weather?", "type": "yes_no"}
            ]

        elif "psoriasis" in disease:
            questions = [
                {"id": "scales", "text": "Are there thick, silvery/white scales on red patches?", "type": "yes_no"},
                {"id": "joints", "text": "Do you have any joint pain, stiffness, or swelling?", "type": "yes_no"},
                {"id": "nails", "text": "Do your fingernails have small pits, dents, or discoloration?", "type": "yes_no"},
                {"id": "scalp", "text": "Do you have similar scaly patches on your scalp?", "type": "yes_no"},
                {"id": "family", "text": "Does anyone in your family have psoriasis?", "type": "yes_no"},
                {"id": "sun", "text": "Does the rash improve when exposed to sunlight?", "type": "yes_no"}
            ]

        elif "rosacea" in disease:
            questions = [
                {"id": "flush", "text": "Do you flush or blush very easily?", "type": "yes_no"},
                {"id": "triggers", "text": "Does it flare up with spicy food, hot drinks, or alcohol?", "type": "yes_no"},
                {"id": "eyes", "text": "Do your eyes feel gritty, dry, or irritated?", "type": "yes_no"},
                {"id": "vessels", "text": "Can you see small broken blood vessels (spider veins)?", "type": "yes_no"},
                {"id": "nose", "text": "Has the skin on your nose become thicker or bumpy?", "type": "yes_no"}
            ]

        elif "fungal" in disease or "ringworm" in disease or "tinea" in disease:
            questions = [
                {"id": "shape", "text": "Is the rash circular with a clear center (ring shape)?", "type": "yes_no"},
                {"id": "pets", "text": "Have you been in contact with animals or soil recently?", "type": "yes_no"},
                {"id": "moisture", "text": "Is the rash in a moist area (groin, feet, under breasts)?", "type": "yes_no"},
                {"id": "spread", "text": "Is the border of the rash expanding outward?", "type": "yes_no"},
                {"id": "sharing", "text": "Did you share towels, mats, or clothing with others?", "type": "yes_no"}
            ]

        elif "hives" in disease or "urticaria" in disease:
            questions = [
                {"id": "sudden", "text": "Did the rash appear very suddenly (minutes/hours)?", "type": "yes_no"},
                {"id": "move", "text": "Do the welts disappear and reappear in different spots?", "type": "yes_no"},
                {"id": "swelling", "text": "Do you have swelling of the lips, eyes, or tongue?", "type": "yes_no"},
                {"id": "trigger_food", "text": "Did you eat nuts, shellfish, or new foods today?", "type": "yes_no"},
                {"id": "virus", "text": "Have you had a cold, flu, or infection recently?", "type": "yes_no"}
            ]

        else:
            questions = [
                {"id": "duration", "text": "How long have you had this?", "type": "text"},
                {"id": "pain", "text": "Is it painful to touch?", "type": "yes_no"},
                {"id": "symptoms", "text": "Describe the sensation (burning, stinging, numbness):", "type": "text"},
                {"id": "worse", "text": "What makes it worse?", "type": "text"},
                {"id": "better", "text": "What makes it better?", "type": "text"}
            ]

        return Response({
            "status": "ready",
            "prediction": instance.prediction,
            "questions": questions
        })

    @action(detail=True, methods=['post'])
    def answer_questions(self, request, pk=None):
        instance = self.get_object()
        print(f"Final Answers for {instance.prediction}: {request.data}")

        instance.status = 'review'
        instance.save()
        return Response({"status": "completed"})
