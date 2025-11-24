from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import SkinPhoto, PatientProfile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role')


class PatientRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password')

    def create(self, validated_data):
        email = validated_data['email']
        username = email.split("@")[0]

        user = User(
            email=email,
            username=username,
            role=User.ROLE_PATIENT
        )
        user.set_password(validated_data['password'])
        user.save()

        PatientProfile.objects.create(patient=user)

        return user



class SkinPhotoSerializer(serializers.ModelSerializer):
    patient = UserSerializer(read_only=True)
    doctor = UserSerializer(read_only=True)
    doctor_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = SkinPhoto
        fields = (
            'id',
            'image',
            'area',
            'description',
            'status',
            'created_at',
        )
        read_only_fields = ('status', 'created_at')

    def create(self, validated_data):
        request = self.context['request']
        user = request.user

        if user.role != User.ROLE_PATIENT:
            raise serializers.ValidationError("Only patients can upload photos.")

        doctor_id = validated_data.pop('doctor_id', None)
        doctor = None
        if doctor_id:
            doctor = User.objects.filter(id=doctor_id, role=User.ROLE_DOCTOR).first()

        photo = SkinPhoto.objects.create(
            patient=user,
            doctor=doctor,
            **validated_data
        )
        return photo


class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = [
            'height',
            'weight',
            'age',
            'gender',
            'skin_type',
            'allergies',
            'medications',
        ]