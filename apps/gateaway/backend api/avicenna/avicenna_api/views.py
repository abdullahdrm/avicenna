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
from rest_framework_simplejwt.authentication import JWTAuthentication
from .model_client import call_external_ai_server
import cv2
import numpy as np
import random
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import os
from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.permissions import BasePermission
# Create your views here.



def check_image_quality(image_file):
    file_bytes = np.frombuffer(image_file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if img is None:
        return False, "Invalid image format"

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if lap_var < 50:
        return False, "Image is too blurry. Please hold steady."

 
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
        return Submission.objects.filter(doctor=self.request.user)
    def get_object(self):
        obj = super().get_object()
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0] if x_forwarded_for else self.request.META.get('REMOTE_ADDR')
        MedicalAuditLog.objects.create(
            user=self.request.user,
            action='VIEW',
            resource_type='Submission',
            resource_id=str(obj.id),
            ip_address=ip
        )
        return obj


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

        if hasattr(submission, "report"):
            return Response(
                {"detail": "Report already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        report = serializer.save(submission=submission)

        submission.status = "reviewed"
        submission.save(update_fields=["status"])
        if hasattr(submission, 'skin_analysis') and submission.skin_analysis:
            submission.skin_analysis.status = "reviewed"
            submission.skin_analysis.save(update_fields=["status"])
        try:
            patient_user = submission.patient 
            patient_id = patient_user.id 
            
            message_text = f"A doctor has just reviewed your case! Tap here to see the report."
            Notification.objects.create(
                user=patient_user,
                submission=submission,
                message=message_text
            )
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"user_{patient_id}", 
                {
                    "type": "send_notification",
                    "message": message_text
                }
            )
            print(f"Live notification sent AND saved to User {patient_id}!")
        except Exception as e:
            print(f"Notification failed: {e}")
            
        return Response(
            {"detail": "Report created successfully."},
            status=status.HTTP_201_CREATED,
        )
        
class SkinAnalysisViewSet(viewsets.ModelViewSet):
    queryset = SkinAnalysis.objects.all().order_by('-created_at')
    serializer_class = SkinAnalysisSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return SkinAnalysis.objects.filter(patient=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        image_file = request.FILES.get("image")
        if not image_file:
            return Response({"error": "No image provided"}, status=400)
            
        is_good, message = check_image_quality(image_file)
        image_file.seek(0)
        if not is_good:
            return Response({
                "status": "rejected", 
                "reason": message, 
                "action": "retake"
            }, status=400)
            
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        case_id = request.data.get('medical_case_id')
        if case_id:
            try:
                medical_case = MedicalCase.objects.get(id=case_id, patient=request.user)
            except MedicalCase.DoesNotExist:
                return Response({'error': 'Case not found or unauthorized'}, status=status.HTTP_404_NOT_FOUND)
        else:
            title = request.data.get('title', f"{request.data.get('body_part', 'New')} Issue")
            medical_case = MedicalCase.objects.create(patient=request.user, title=title)
        
        instance = serializer.save(
            patient=request.user,
            status="processing",
            body_part=request.data.get('body_part', 'Face'),
            medical_case=medical_case
        )

        full_image_url = request.build_absolute_uri(instance.image.url)

        ai_result = process_sync(
            image_url=full_image_url,
            case_id=str(instance.id),
            image_id=f"img_{instance.id}"
        )

        if ai_result:
            metrics = ai_result.get("metrics", {}) or {}
            extra_data = metrics.get("extra", {}) or {}
            
            raw_prediction = extra_data.get("problem_type")
            if not raw_prediction:
                raw_prediction = metrics.get("condition", "Unknown")

            clean_name = raw_prediction
            if clean_name and clean_name != "Unknown":
                clean_name = clean_name.replace(" Photos", "")
                clean_name = clean_name.split(" - ")[0]
                
                if "Acne" in clean_name and "Rosacea" in clean_name:
                    clean_name = "Acne or Rosacea"
                elif "Malignant Lesions" in clean_name:
                    clean_name = "Skin Lesion (Check Required)"

            confidence = metrics.get("confidence", metrics.get("severity_score", 0.0))

            instance.prediction = clean_name
            instance.confidence = round(float(confidence), 2)
            instance.status = "analyzed"
            if not medical_case.disease_type:
                medical_case.disease_type = clean_name
                medical_case.save(update_fields=['disease_type'])
                
            instance.save()
            
            return Response({
                "id": instance.id,
                "status": "analyzed",
                "prediction": instance.prediction,
                "confidence": instance.confidence,
                "message": "AI Analysis complete.",
                "medical_case_id": medical_case.id
            }, status=201)
            
        else:
            print("AI Failed, using fallback...")
            instance.prediction = "Unknown"
            instance.status = "failed"
            instance.save()

            return Response({
                "id": instance.id,
                "status": "failed",
                "message": "AI server did not respond."
            }, status=500)
        
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
        
        user_answers = request.data.get('answers', {})
        instance.answers = user_answers
        instance.status = 'analyzed' 
        instance.save()
        existing_submission = Submission.objects.filter(
            skin_analysis__medical_case=instance.medical_case
        ).first()

        doctors = User.objects.filter(role=User.ROLE_DOCTOR)
        if not doctors.exists():
             return Response(
                 {"error": "No doctors available in the system"}, 
                 status=status.HTTP_503_SERVICE_UNAVAILABLE
             )
        if existing_submission and existing_submission.doctor:
            assigned_doctor = existing_submission.doctor
        else:
            assigned_doctor = doctors.order_by('?').first()           
        patient_user = instance.patient if instance.patient else request.user       
        Submission.objects.create(
            patient=patient_user,
            doctor=assigned_doctor,
            skin_analysis=instance, 
            status='pending'
        )

        return Response({
            "status": "completed", 
            "message": "Answers saved and sent to doctor.",
            "assigned_doctor": assigned_doctor.username if assigned_doctor else "Unknown"
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
        
class MedicalCaseViewSet(viewsets.ModelViewSet):
    serializer_class = MedicalCaseSerializer
    
    def get_queryset(self):
        return MedicalCase.objects.filter(patient=self.request.user).order_by('-created_at')

class NotificationListView(ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)
    
class MarkNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        # We make sure the user can only mark their OWN notifications as read
        notification = get_object_or_404(Notification, id=id, user=request.user)
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        
        return Response(
            {"detail": "Notification marked as read."},
            status=status.HTTP_200_OK
        )
        
class IsAuthenticatedOrServer(BasePermission):
    def has_permission(self, request, view):
        ai_secret = request.headers.get('X-AI-Secret')
        if ai_secret == 'avicenna_secure_ai_key_2026':
            return True
            
        if request.user and request.user.is_authenticated:
            return True

        url_token = request.GET.get('token')
        if url_token:
            try:
                jwt_authenticator = JWTAuthentication()
                validated_token = jwt_authenticator.get_validated_token(url_token)
                user = jwt_authenticator.get_user(validated_token)
                if user:
                    request.user = user 
                    return True
            except Exception:
                pass 
                
        return False
    
class SecureMediaView(APIView):
    permission_classes = [IsAuthenticatedOrServer] 

    def get(self, request, file_path):
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        
        if not os.path.abspath(full_path).startswith(os.path.abspath(settings.MEDIA_ROOT)):
            raise Http404("Invalid file path.")
            
        if os.path.exists(full_path):
            return FileResponse(open(full_path, 'rb'))
        else:
            raise Http404("Image not found.")