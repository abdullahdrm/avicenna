from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import SkinPhoto, PatientProfile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "role")


class PatientRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("email", "password")

    def create(self, validated_data):
        email = validated_data["email"]
        username = email.split("@")[0]

        user = User(email=email, username=username, role=User.ROLE_PATIENT)
        user.set_password(validated_data["password"])
        user.save()

        PatientProfile.objects.get_or_create(patient=user)
        return user


class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = [
            "height",
            "weight",
            "age",
            "gender",
            "skin_type",
            "allergies",
            "medications",
            "conditions",
        ]


class SkinPhotoSerializer(serializers.ModelSerializer):
    patient = UserSerializer(read_only=True)
    doctor = UserSerializer(read_only=True)

    doctor_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SkinPhoto
        fields = (
            "id",
            "image",
            "image_url",
            "area",
            "description",
            "doctor_id",
            "doctor",
            "patient",
            "status",
            "rejection_reason",
            "diagnosis",
            "confidence",
            "raw_output",
            "created_at",
        )
        read_only_fields = (
            "doctor",
            "patient",
            "status",
            "rejection_reason",
            "diagnosis",
            "confidence",
            "raw_output",
            "created_at",
        )

    def get_image_url(self, obj):
        request = self.context.get("request")
        if not obj.image:
            return None
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url

    def create(self, validated_data):
        request = self.context["request"]

        doctor_id = validated_data.pop("doctor_id", None)
        doctor = None
        if doctor_id:
            doctor = User.objects.filter(id=doctor_id, role=User.ROLE_DOCTOR).first()

        # patient is always injected from view
        patient = validated_data.pop("patient")
        return SkinPhoto.objects.create(patient=patient, doctor=doctor, **validated_data)
