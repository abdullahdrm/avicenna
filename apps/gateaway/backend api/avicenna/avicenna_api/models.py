from django.utils import timezone
from django.db import models
from django.contrib.auth.models import User


class Patient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    age = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"Patient: {self.user.username}"


class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    experience_years = models.PositiveIntegerField(default=0)
    bio = models.TextField(blank=True)

    def __str__(self):
        return f"Dr. {self.user.get_full_name() or self.user.username}"


class Case(models.Model):
    description = models.CharField(max_length=300)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=50,
        choices=[('pending', 'Pending'), ('reviewed', 'Reviewed'), ('closed', 'Closed')],
        default='pending'
    )

    def __str__(self):
        return f"Case: {self.id} ({self.patient.user.username})"








