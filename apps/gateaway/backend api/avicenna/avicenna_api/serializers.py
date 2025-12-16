from rest_framework import serializers
from .models import *
from django.contrib.auth import get_user_model
User = get_user_model()
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['user_id'] = user.id
        token['username'] = user.username
        token['role'] = user.role

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Add extra response data
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'role': self.user.role,
        }

        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email']


# DOCTOR

class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = [
            "age",
            "gender",
            "skin_type",
            "allergies",
            "medications",
            "height",
            "weight",
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


class SubmissionDetailSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "patient",
            "photo",
            "place",
            "duration_days",
            "pain_level",
            "comment",
            "created_at",
            "status"
        ]


from rest_framework import serializers
from django.db.models import Count
from .models import DoctorProfile, Submission


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

    # --------------------
    # USER INFO
    # --------------------
    def get_user(self, obj):
        user = obj.doctor
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }

    # --------------------
    # STATS (EFFICIENT)
    # --------------------
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
        fields = ('city', 'hospital')


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