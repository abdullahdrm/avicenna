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
from .services import *
from .permissions import *
# Create your views here.

from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import datetime


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

        return Response(
            {"detail": "Report created successfully."},
            status=status.HTTP_201_CREATED,
        )


class SkinAnalysisViewSet(viewsets.ModelViewSet):
    queryset = SkinAnalysis.objects.all().order_by('-created_at')
    serializer_class = SkinAnalysisSerializer
    permission_classes = [IsAuthenticated]

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

        instance = serializer.save(
            patient=request.user,
            status="processing",
            body_part=request.data.get('body_part', 'Face')
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

            confidence = metrics.get(
                "confidence", metrics.get("severity_score", 0.0))

            instance.prediction = clean_name
            instance.confidence = round(float(confidence), 2)
            instance.status = "analyzed"
            instance.save()

            return Response({
                "id": instance.id,
                "status": "analyzed",
                "prediction": instance.prediction,
                "confidence": instance.confidence,
                "message": "AI Analysis complete."
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
                {"id": "deep",
                    "text": "Is the spot painful and deep under the skin (cystic)?", "type": "yes_no"},
                {"id": "oily", "text": "Is your skin generally oily in this area?",
                    "type": "yes_no"},
                {"id": "hormonal", "text": "Does it flare up with your menstrual cycle or stress?", "type": "yes_no"},
                {"id": "diet", "text": "Have you consumed high sugar or dairy recently?",
                    "type": "yes_no"},
                {"id": "picking", "text": "Do you frequently touch or pick at these spots?",
                    "type": "yes_no"},
                {"id": "routine", "text": "Did you change your face wash or moisturizer recently?", "type": "yes_no"}
            ]

        elif "eczema" in disease or "dermatitis" in disease:
            questions = [
                {"id": "itch_level",
                    "text": "On a scale of 1-10, how intense is the itch?", "type": "number"},
                {"id": "night_itch",
                    "text": "Does the itching wake you up at night?", "type": "yes_no"},
                {"id": "asthma", "text": "Do you or your family have asthma or hay fever?",
                    "type": "yes_no"},
                {"id": "weeping", "text": "Is the area oozing clear fluid or crusting over?",
                    "type": "yes_no"},
                {"id": "location", "text": "Is it inside your elbows, behind knees, or on the neck?", "type": "yes_no"},
                {"id": "trigger", "text": "Does it get worse with soaps, detergents, or cold weather?", "type": "yes_no"}
            ]

        elif "psoriasis" in disease:
            questions = [
                {"id": "scales", "text": "Are there thick, silvery/white scales on red patches?", "type": "yes_no"},
                {"id": "joints", "text": "Do you have any joint pain, stiffness, or swelling?", "type": "yes_no"},
                {"id": "nails", "text": "Do your fingernails have small pits, dents, or discoloration?", "type": "yes_no"},
                {"id": "scalp", "text": "Do you have similar scaly patches on your scalp?",
                    "type": "yes_no"},
                {"id": "family", "text": "Does anyone in your family have psoriasis?",
                    "type": "yes_no"},
                {"id": "sun", "text": "Does the rash improve when exposed to sunlight?",
                    "type": "yes_no"}
            ]

        elif "rosacea" in disease:
            questions = [
                {"id": "flush", "text": "Do you flush or blush very easily?",
                    "type": "yes_no"},
                {"id": "triggers", "text": "Does it flare up with spicy food, hot drinks, or alcohol?", "type": "yes_no"},
                {"id": "eyes", "text": "Do your eyes feel gritty, dry, or irritated?",
                    "type": "yes_no"},
                {"id": "vessels",
                    "text": "Can you see small broken blood vessels (spider veins)?", "type": "yes_no"},
                {"id": "nose", "text": "Has the skin on your nose become thicker or bumpy?", "type": "yes_no"}
            ]

        elif "fungal" in disease or "ringworm" in disease or "tinea" in disease:
            questions = [
                {"id": "shape",
                    "text": "Is the rash circular with a clear center (ring shape)?", "type": "yes_no"},
                {"id": "pets", "text": "Have you been in contact with animals or soil recently?", "type": "yes_no"},
                {"id": "moisture",
                    "text": "Is the rash in a moist area (groin, feet, under breasts)?", "type": "yes_no"},
                {"id": "spread", "text": "Is the border of the rash expanding outward?",
                    "type": "yes_no"},
                {"id": "sharing", "text": "Did you share towels, mats, or clothing with others?", "type": "yes_no"}
            ]

        elif "hives" in disease or "urticaria" in disease:
            questions = [
                {"id": "sudden",
                    "text": "Did the rash appear very suddenly (minutes/hours)?", "type": "yes_no"},
                {"id": "move", "text": "Do the welts disappear and reappear in different spots?", "type": "yes_no"},
                {"id": "swelling", "text": "Do you have swelling of the lips, eyes, or tongue?", "type": "yes_no"},
                {"id": "trigger_food",
                    "text": "Did you eat nuts, shellfish, or new foods today?", "type": "yes_no"},
                {"id": "virus", "text": "Have you had a cold, flu, or infection recently?", "type": "yes_no"}
            ]

        else:
            questions = [
                {"id": "duration", "text": "How long have you had this?", "type": "text"},
                {"id": "pain", "text": "Is it painful to touch?", "type": "yes_no"},
                {"id": "symptoms",
                    "text": "Describe the sensation (burning, stinging, numbness):", "type": "text"},
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

        doctors = User.objects.filter(role=User.ROLE_DOCTOR)

        if not doctors.exists():
            return Response(
                {"error": "No doctors available in the system"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        assigned_doctor = doctors.order_by('?').first()  # '?' orders randomly
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


def _case_queryset_for_user(user):
    if user.role == "doctor":
        return FollowUpCase.objects.filter(doctor=user)
    return FollowUpCase.objects.filter(patient=user)


class FollowUpCaseViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FollowUpCaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = _case_queryset_for_user(self.request.user).select_related(
            "original_submission", "patient", "doctor"
        ).order_by("-updated_at")

        status_q = self.request.query_params.get("status")
        if status_q:
            qs = qs.filter(status=status_q)

        overdue = self.request.query_params.get("overdue")
        if overdue == "true":
            qs = [c for c in qs if c.is_overdue]

        return qs

    def get_object(self):
        obj = super().get_object()
        self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsPatientOfCase])
    def request_followup(self, request, pk=None):
        case = self.get_object()

        if case.status != FollowUpCase.STATUS_OPEN:
            return Response({"detail": "Case is closed."}, status=400)

        serializer = FollowUpRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req = FollowUpRequest.objects.create(
            case=case,
            patient=case.patient,
            doctor=case.doctor,
            reason=serializer.validated_data.get("reason", ""),
            preferred_date=serializer.validated_data.get("preferred_date"),
        )

        audit(request.user, "followup_request_created",
              "FollowUpRequest", req.id, {"case_id": case.id})

        notify(
            user=case.doctor,
            notif_type="followup_request",
            title="New follow-up request",
            body=f"Patient requested a follow-up for case #{case.id}.",
            payload={"case_id": case.id, "request_id": req.id},
        )

        return Response(FollowUpRequestSerializer(req).data, status=201)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated, IsCaseParticipant])
    def requests(self, request, pk=None):
        case = self.get_object()
        qs = case.requests.order_by("-created_at")
        return Response(FollowUpRequestSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsDoctorOfCase])
    def close(self, request, pk=None):
        case = self.get_object()
        case.status = FollowUpCase.STATUS_CLOSED
        case.save(update_fields=["status", "updated_at"])
        audit(request.user, "followup_case_closed", "FollowUpCase", case.id, {})
        return Response({"detail": "Case closed."})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsDoctorOfCase])
    def reopen(self, request, pk=None):
        case = self.get_object()
        case.status = FollowUpCase.STATUS_OPEN
        case.save(update_fields=["status", "updated_at"])
        audit(request.user, "followup_case_reopened",
              "FollowUpCase", case.id, {})
        return Response({"detail": "Case reopened."})

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated, IsCaseParticipant])
    def timeline(self, request, pk=None):

        case = self.get_object()
        followups = case.followups.select_related(
            "submission").order_by("sequence_number")
        data = {
            "case": FollowUpCaseSerializer(case).data,
            "followups": FollowUpLinkSerializer(followups, many=True).data,
        }
        return Response(data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated, IsCaseParticipant])
    def notes(self, request, pk=None):
        case = self.get_object()
        notes = case.notes_thread.select_related(
            "author").order_by("-created_at")[:200]
        return Response(FollowUpNoteSerializer(notes, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsCaseParticipant])
    def add_note(self, request, pk=None):
        case = self.get_object()
        serializer = FollowUpNoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        note = FollowUpNote.objects.create(
            case=case,
            author=request.user,
            message=serializer.validated_data["message"],
        )

        audit(request.user, "followup_note_created",
              "FollowUpNote", note.id, {"case_id": case.id})

        other = case.doctor if request.user.id == case.patient_id else case.patient
        notify(
            user=other,
            notif_type="followup_message",
            title="New message on follow-up case",
            body=note.message[:140],
            payload={"case_id": case.id, "note_id": note.id},
        )

        return Response(FollowUpNoteSerializer(note).data, status=201)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsPatientOfCase])
    def submit_followup(self, request, pk=None):

        case = self.get_object()

        if case.status != FollowUpCase.STATUS_OPEN:
            return Response({"detail": "Case is closed."}, status=400)

        image_file = request.FILES.get("image")
        if not image_file:
            return Response({"detail": "No image provided."}, status=400)

        is_good, message = check_image_quality(image_file)
        image_file.seek(0)
        if not is_good:
            return Response({"status": "rejected", "reason": message, "action": "retake"}, status=400)

        body_part = request.data.get("body_part", "Face")
        pain_level = int(request.data.get("pain_level", 0) or 0)
        duration = request.data.get("duration")
        comments = request.data.get("comments")
        answers = request.data.get("answers", {}) or {}

        sa = SkinAnalysis.objects.create(
            image=image_file,
            body_part=body_part,
            patient=request.user,
            pain_level=pain_level,
            duration=duration,
            comments=comments,
            answers=answers,
            status="processing",
        )

        full_image_url = request.build_absolute_uri(sa.image.url)

        ai_result = process_sync(
            image_url=full_image_url,
            case_id=str(sa.id),
            image_id=f"followup_img_{sa.id}"
        )

        if ai_result:
            metrics = ai_result.get("metrics", {}) or {}
            extra_data = metrics.get("extra", {}) or {}
            raw_prediction = extra_data.get(
                "problem_type") or metrics.get("condition", "Unknown")

            clean_name = raw_prediction
            if clean_name and clean_name != "Unknown":
                clean_name = clean_name.replace(" Photos", "")
                clean_name = clean_name.split(" - ")[0]
                if "Acne" in clean_name and "Rosacea" in clean_name:
                    clean_name = "Acne or Rosacea"
                elif "Malignant Lesions" in clean_name:
                    clean_name = "Skin Lesion (Check Required)"

            confidence = metrics.get(
                "confidence", metrics.get("severity_score", 0.0))

            sa.prediction = clean_name
            sa.confidence = round(float(confidence), 2)
            sa.status = "analyzed"
            sa.save(update_fields=["prediction", "confidence", "status"])
        else:
            sa.prediction = "Unknown"
            sa.status = "failed"
            sa.save(update_fields=["prediction", "status"])
            return Response({"detail": "AI server did not respond."}, status=502)

        submission = Submission.objects.create(
            patient=case.patient,
            doctor=case.doctor,
            skin_analysis=sa,
            status="pending",
        )

        link = create_followup_link(
            case=case, submission=submission, actor=request.user)

        return Response(
            {
                "detail": "Follow-up submitted successfully.",
                "case_id": case.id,
                "followup_link": FollowUpLinkSerializer(link).data,
            },
            status=201,
        )


class FollowUpRequestActionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id, action):
        req = get_object_or_404(FollowUpRequest, id=request_id)
        case = req.case

        if request.user.id != case.doctor_id:
            return Response({"detail": "Forbidden."}, status=403)

        if action == "approve":
            serializer = FollowUpApproveSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                approve_request(
                    req=req,
                    actor=request.user,
                    approved_date=serializer.validated_data["approved_date"],
                    doctor_response=serializer.validated_data.get(
                        "doctor_response", ""),
                )
            except ValidationError as e:
                return Response({"detail": str(e)}, status=400)

            return Response({"detail": "Request approved."}, status=200)

        if action == "decline":
            serializer = FollowUpDeclineSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            decline_request(
                req=req,
                actor=request.user,
                doctor_response=serializer.validated_data.get(
                    "doctor_response", ""),
            )
            return Response({"detail": "Request declined."}, status=200)

        return Response({"detail": "Invalid action."}, status=400)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(
            user=self.request.user).order_by("-created_at")
        is_read = self.request.query_params.get("is_read")
        if is_read in ("true", "false"):
            qs = qs.filter(is_read=(is_read == "true"))
        return qs

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response({"detail": "Marked as read."})


class DoctorAvailabilityCalendarView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request):
        start_str = request.query_params.get("start")
        days_param = request.query_params.get("days", 14)

        start_date = None
        if start_str:
            try:
                start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"detail": "Invalid 'start' format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        days = clamp_days(days_param, max_days=60)

        payload, err = build_doctor_availability_calendar(
            doctor_user=request.user,
            start_date=start_date,
            days=days
        )
        if err:
            return Response({"detail": err}, status=status.HTTP_404_NOT_FOUND)

        return Response(DoctorAvailabilityCalendarSerializer(payload).data, status=status.HTTP_200_OK)
