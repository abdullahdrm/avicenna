from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class User(AbstractUser):
    ROLE_PATIENT = "patient"
    ROLE_DOCTOR = "doctor"
    ROLE_CHOICES = [
        (ROLE_PATIENT, "Patient"),
        (ROLE_DOCTOR, "Doctor"),
    ]
    role = models.CharField(
        max_length=10, 
        choices=ROLE_CHOICES, 
        default=ROLE_PATIENT)

    def __str__(self):
        return f"{self.username} ({self.role})"


class SkinPhoto(models.Model):
    STATUS_PENDING = "pending"
    STATUS_REVIEWED = "reviewed"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_REVIEWED, "Reviewed"),
        (STATUS_REJECTED, "Rejected"),
    ]

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="skin_photos",
        limit_choices_to={"role": User.ROLE_PATIENT},
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_photos",
        limit_choices_to={"role": User.ROLE_DOCTOR},
    )

    image = models.ImageField(upload_to="skin_photos/")
    area = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    rejection_reason = models.CharField(max_length=256, blank=True)

    # model output
    diagnosis = models.CharField(max_length=256, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    raw_output = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo {self.id} - {self.patient.username}"


class PatientProfile(models.Model):
    GENDER_CHOICES = [
        ("male", "Male"),
        ("female", "Female"),
    ]
    SKIN_TYPES = [
        ("dry", "Dry"),
        ("oily", "Oily"),
        ("combined", "Combined"),
        ("normal", "Normal"),
    ]

    patient = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
        limit_choices_to={"role": User.ROLE_PATIENT},
    )

    height = models.FloatField(null=True, blank=True)
    weight = models.FloatField(null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)

    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    skin_type = models.CharField(max_length=20, choices=SKIN_TYPES, null=True, blank=True)

    allergies = models.TextField(blank=True)
    medications = models.TextField(blank=True)
    conditions = models.TextField(blank=True)  # <-- NEW (questionnaire has this)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile for {self.patient.username}"
