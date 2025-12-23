from rest_framework.generics import ListAPIView, RetrieveAPIView
from .permissions import IsDoctor
from rest_framework import generics, permissions
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.shortcuts import get_object_or_404
from .models import *
from .serializers import *
from rest_framework import status
from .utilities import *
from rest_framework import viewsets
from rest_framework.views import APIView
from .model_client import call_external_ai_server
import cv2
import numpy as np
import random

# Create your views here.

# START AUTHENTICATION

def check_image_quality(image_file):
    # Read the image file into a numpy array
    file_bytes = np.frombuffer(image_file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if img is None:
        return False, "Invalid image format"

    # Convert to grayscale for analysis
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Blur Detection
    # Variance of Laplacian < 50 usually indicates a blurry image
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if lap_var < 50:
        return False, "Image is too blurry. Please hold steady."

    # 2. Brightness Detection
    # Mean pixel intensity (0-255)
    brightness = gray.mean()
    if brightness < 40:
        return False, "Image is too dark. Please find better lighting."
    if brightness > 215:
        return False, "Image is too bright. Please avoid direct glare."

    return True, "OK"

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
        return Response(payload)



class DoctorProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.doctor_profile
        except DoctorProfile.DoesNotExist:
            return Response(
                {"detail": "Doctor profile not found."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = DoctorProfileSerializer(profile)
        return Response(serializer.data)

    def patch(self, request):
        try:
            profile = request.user.doctor_profile
        except DoctorProfile.DoesNotExist:
            return Response(
                {"detail": "Doctor profile not found."}, 
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = DoctorPreferencesUpdateSerializer(
            profile,
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
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        # This tells Django: "Only fetch rows where the patient is ME"
        return SkinAnalysis.objects.filter(patient=self.request.user).order_by('-created_at')
    def create(self, request, *args, **kwargs):
        image_file = request.FILES.get("image")
        
        if not image_file:
            return Response({"error": "No image provided"}, status=400)

        # --- START QUALITY CHECK ---
        is_good, message = check_image_quality(image_file)
        image_file.seek(0) # Reset file pointer

        if not is_good:
            return Response({
                "status": "rejected",
                "reason": message,
                "action": "retake"
            }, status=400)
        # --- END QUALITY CHECK ---

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Random Mock Prediction
        import random
        mock_diseases = ["Acne", "Eczema", "Psoriasis", "Rosacea"]
        prediction = random.choice(mock_diseases)
        confidence = random.uniform(0.75, 0.98)
        

        # --- SAVE WITH USER ---
        instance = serializer.save(
            patient=request.user,
            prediction=prediction, 
            confidence=round(confidence, 2),
            status="analyzed",
            body_part=request.data.get('body_part', 'Face') ,
            
        )
        
        return Response({
            "id": instance.id,
            "status": "analyzed", 
            "prediction": prediction, # 
            "message": "Analysis complete."
        }, status=status.HTTP_201_CREATED)
        
    @action(detail=True, methods=['get'])
    def check_status(self, request, pk=None):
        instance = self.get_object()
        
        process_sync(instance.image, instance.pk, 1);

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
        
        # 1. Save the answers from the frontend
        user_answers = request.data.get('answers', {})
        instance.answers = user_answers
        instance.status = 'analyzed' # Mark AI flow as done
        instance.save()

        # 2. Logic to assign a Random Doctor
        # Find all users who are doctors
        doctors = User.objects.filter(role=User.ROLE_DOCTOR)
        
        if not doctors.exists():
             return Response(
                 {"error": "No doctors available in the system"}, 
                 status=status.HTTP_503_SERVICE_UNAVAILABLE
             )
        
        assigned_doctor = doctors.order_by('?').first() # '?' orders randomly
        patient_user = instance.patient if instance.patient else request.user
        # 3. Create the Submission for the Doctor
        # We assume the user logged in is the patient, or we use instance.patient
        Submission.objects.create(
            patient=patient_user,
            doctor=assigned_doctor,
            skin_analysis=instance, 
            status='pending'
        )

        return Response({
            "status": "completed", 
            "message": "Answers saved and sent to doctor.",
            "assigned_doctor": assigned_doctor.username
        })
    
class ArticleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Article.objects.all().order_by('-created_at')
    serializer_class = ArticleSerializer
    permission_classes = [AllowAny] 

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        if category and category != 'All':
            queryset = queryset.filter(category__iexact=category)
        return queryset

class DailyTipViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DailyTip.objects.filter(is_active=True)
    serializer_class = DailyTipSerializer
    permission_classes = [AllowAny] 

    @action(detail=False, methods=['get'])
    def random(self, request):
        tips = list(self.get_queryset())
        if tips:
            random_tip = random.choice(tips)
            serializer = self.get_serializer(random_tip)
            return Response(serializer.data)
        return Response({"content": "Stay hydrated!"})
    
class UserCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"detail": "Account created successfully"}, 
                status=status.HTTP_201_CREATED
            )
        # Log error to console for debugging
        print("Registration Error:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class PatientProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = PatientProfileSerializer
    permission_classes = [permissions.IsAuthenticated] 

    def get_object(self):
        
        return self.request.user.patient_profile
    
class PatientReportsView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PatientReportSerializer

    def get_queryset(self):
        return Submission.objects.filter(
            patient=self.request.user
        ).select_related('doctor', 'report').prefetch_related('report__medications').order_by('-updated_at')