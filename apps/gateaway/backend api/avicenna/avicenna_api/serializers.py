from rest_framework import serializers
from .models import *
from django.contrib.auth import get_user_model
User = get_user_model()
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.db.models import Count
from .models import DoctorProfile, Submission


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token['user_id'] = user.id
        token['username'] = user.username
        token['role'] = user.role

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'first_name': self.user.first_name, 
            'last_name': self.user.last_name, 
        }

        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined']


# DOCTOR

class PatientProfileSerializer(serializers.ModelSerializer):
    date_joined = serializers.DateTimeField(source='patient.date_joined', read_only=True)

    class Meta:
        model = PatientProfile
        fields = [
            "age",
            "gender",
            "skin_type",
            "allergies",
            "medications",
            "medical_conditions",
            "height",
            "weight",
            "date_joined",
        ]
        
class PatientSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "profile",
        ]

    def get_profile(self, obj):
        if hasattr(obj, "patient_profile"):
            return PatientProfileSerializer(obj.patient_profile).data
        return None


class SubmissionSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)

    class Meta:
        model = Submission
        fields = [
            'id',
            'patient',
            'status',
            'created_at',
        ]





class DoctorProfileSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = DoctorProfile
        fields = [
            "user",
            "experience_years",
            "city",
            "hospital",
            "allowed_days",
            "max_submissions_per_day",
            "stats",
        ]

    def get_user(self, obj):
        user = obj.doctor
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }


    def get_stats(self, obj):
        doctor = obj.doctor

        submissions = Submission.objects.filter(doctor=doctor)

        return {
            "patients_count": (
                submissions
                .values("patient")
                .distinct()
                .count()
            ),
            "submissions_reviewed": (
                submissions
                .filter(status="reviewed")
                .count()
            ),
            "active_days": (
                submissions
                .dates("created_at", "day")
                .count()
            ),
        }


class DoctorInfoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    username = serializers.CharField()
    email = serializers.EmailField()


class DashboardStatsSerializer(serializers.Serializer):
    pending_submissions = serializers.IntegerField()
    completed_submissions = serializers.IntegerField()
    patients_count = serializers.IntegerField()


class RecentCaseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    patient_name = serializers.CharField()
    status = serializers.ChoiceField(choices=["pending", "reviewed"])


class DoctorDashboardSerializer(serializers.Serializer):
    doctor = DoctorInfoSerializer()
    stats = DashboardStatsSerializer()
    recent_cases = RecentCaseSerializer(many=True)


class DoctorPreferencesUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorProfile
        fields = (
            'city', 
            'hospital', 
            'allowed_days', 
            'max_submissions_per_day'
        )


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = ("name", "frequency")


class ReportCreateSerializer(serializers.ModelSerializer):
    medications = MedicationSerializer(many=True)

    class Meta:
        model = Report
        fields = (
            "diagnosis",
            "hospital_visit",
            "comment",
            "next_submission_date",
            "medications",
        )

    def create(self, validated_data):
        medications_data = validated_data.pop("medications")

        report = Report.objects.create(**validated_data)

        for med in medications_data:
            Medication.objects.create(report=report, **med)

        return report
    
class SkinAnalysisSerializer(serializers.ModelSerializer):
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = SkinAnalysis
        fields = [
            'id', 
            'image', 
            'body_part', 
            'prediction', 
            'confidence', 
            'status', 
            'pain_level', 
            'duration',   
            'comments',   
            'answers',    
            'created_at', 
            'formatted_date',
            'medical_case'
        ]

    def get_formatted_date(self, obj):
        return obj.created_at.strftime('%b %d, %H:%M')
    
class SubmissionDetailSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    skin_analysis = SkinAnalysisSerializer(read_only=True) 
    timeline = serializers.SerializerMethodField()
    class Meta:
        model = Submission
        fields = [
            "id",
            "patient",
            "timeline",
            "skin_analysis", 
            "status",
        ]
    def get_timeline(self, obj):
        case = obj.skin_analysis.medical_case
        if case:
            request = self.context.get('request')
            images = case.timeline_images.all().order_by('created_at')
            
            timeline_data = []
            for img in images:
                report_obj = getattr(img.submission, 'report', None) if hasattr(img, 'submission') else None
                
                timeline_data.append({
                    "id": img.id,
                    "submission_id": img.submission.id if hasattr(img, 'submission') else None, #
                    "image": request.build_absolute_uri(img.image.url) if img.image else None,
                    "date": img.created_at.strftime('%b %d, %Y'),
                    "prediction": img.prediction,
                    "has_report": report_obj is not None,
                    "diagnosis": report_obj.diagnosis if report_obj else "No report yet",
                    "pain_level": img.pain_level,
                    "duration": img.duration,
                    "comments": img.comments,
                    "answers": img.answers if img.answers else {},
                    "body_part": img.body_part,
                    "confidence": img.confidence,
                })
            return timeline_data
        return []
    
class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ['id', 'title', 'category', 'read_time', 'content', 'image']

class DailyTipSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyTip
        fields = ['id', 'content']

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name')

    def create(self, validated_data):
        email = validated_data.get('email')
        validated_data['username'] = email
        validated_data['role'] = User.ROLE_PATIENT
        
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        
        PatientProfile.objects.create(patient=user)
        
        return user
    
class PatientReportSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    diagnosis = serializers.CharField(source='report.diagnosis', default="No diagnosis yet")
    doctor_comment = serializers.CharField(source='report.comment', default="")
    medications = serializers.SerializerMethodField()
    visit_required = serializers.BooleanField(source='report.hospital_visit', default=False)
    date = serializers.SerializerMethodField()
    timeline_images = serializers.SerializerMethodField()
    place = serializers.CharField(source='skin_analysis.medical_case.title', default="Unknown Area", read_only=True)
    status = serializers.CharField()
    class Meta:
        model = Submission
        fields = [
            'id', 
            'status',
            'place',        
            'doctor_name', 
            'diagnosis', 
            'doctor_comment',
            'medications',
            'visit_required',
            'date',
            'timeline_images'
        ]

    def get_doctor_name(self, obj):
        return f"Dr. {obj.doctor.last_name}" if obj.doctor else "Unknown Doctor"

    def get_medications(self, obj):
        if hasattr(obj, 'report'):
            return [
                f"{m.name} ({m.frequency})" 
                for m in obj.report.medications.all()
            ]
        return []
    def get_timeline_images(self, obj):
        case = obj.skin_analysis.medical_case
        if case:
            request = self.context.get('request')
            images = []
            for img in case.timeline_images.all().order_by('created_at'):
                url = img.image.url if img.image else None
                if url and request:
                    url = request.build_absolute_uri(url)
                if url:
                    images.append({"image": url, "date": img.created_at.strftime('%b %d')})
            return images
        return []

    def get_date(self, obj):
        return obj.updated_at.strftime('%b %d, %Y')
    

class MedicalCaseSerializer(serializers.ModelSerializer):
    timeline_images = SkinAnalysisSerializer(many=True, read_only=True)

    class Meta:
        model = MedicalCase
        fields = ['id', 'title', 'disease_type', 'created_at', 'is_active', 'timeline_images']
        
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'is_read', 'created_at']