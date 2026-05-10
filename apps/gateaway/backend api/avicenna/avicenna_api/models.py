from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError


class User(AbstractUser):
    ROLE_PATIENT = 'patient'
    ROLE_DOCTOR = 'doctor'

    ROLE_CHOICES = [
        (ROLE_PATIENT, 'Patient'),
        (ROLE_DOCTOR, 'Doctor'),
    ]

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username'] 

    def __str__(self):
        return f"{self.email} ({self.role})"


class PatientProfile(models.Model):
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]

    SKIN_TYPES = [
        ('dry', 'Dry'),
        ('oily', 'Oily'),
        ('combination', 'Combination'),
        ('normal', 'Normal'),
        ('sensitive', 'Sensitive'),
    ]

    patient = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='patient_profile',
        limit_choices_to={'role': User.ROLE_PATIENT}
    )

    height = models.FloatField(null=True, blank=True)
    weight = models.FloatField(null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)

    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,
        null=True,
        blank=True
    )

    skin_type = models.CharField(
        max_length=20,
        choices=SKIN_TYPES,
        null=True,
        blank=True
    )

    allergies = models.TextField(blank=True)
    medications = models.TextField(blank=True)
    medical_conditions = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PatientProfile for {self.patient.username}"


class DoctorProfile(models.Model):

    class WeekDay(models.TextChoices):
        MONDAY = 'mon', 'Monday'
        TUESDAY = 'tue', 'Tuesday'
        WEDNESDAY = 'wed', 'Wednesday'
        THURSDAY = 'thu', 'Thursday'
        FRIDAY = 'fri', 'Friday'
        SATURDAY = 'sat', 'Saturday'
        SUNDAY = 'sun', 'Sunday'

    doctor = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='doctor_profile',
        limit_choices_to={'role': User.ROLE_DOCTOR}
    )

    experience_years = models.PositiveIntegerField()
    city = models.CharField(max_length=100)
    hospital = models.CharField(max_length=150)

    allowed_days = models.JSONField(default=list)
    max_submissions_per_day = models.PositiveIntegerField(default=10)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        valid_days = {day.value for day in self.WeekDay}
        for day in self.allowed_days:
            if day not in valid_days:
                raise ValidationError(f"Invalid day: {day}")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"DoctorProfile for {self.doctor.username}"


class Submission(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        REVIEWED = 'reviewed', 'Reviewed'

    skin_analysis = models.OneToOneField(
        'SkinAnalysis', 
        on_delete=models.CASCADE, 
        related_name='submission',
        null=True,
        blank=True
    )

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='patient_submissions',
        limit_choices_to={'role': 'patient'}
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='doctor_submissions',
        limit_choices_to={'role': 'doctor'}
    )
    
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.patient.role != User.ROLE_PATIENT:
            raise ValidationError("Patient must have role 'patient'")
        if self.doctor.role != User.ROLE_DOCTOR:
            raise ValidationError("Doctor must have role 'doctor'")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        indexes = [
            models.Index(fields=['doctor', '-created_at']),
            models.Index(fields=['patient', '-updated_at']),
            models.Index(fields=['doctor', 'status']),
        ]

    def __str__(self):
        return f"Submission from {self.patient.username} to {self.doctor.username}"


class Report(models.Model):
    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE, related_name="report"
    )
    diagnosis = models.TextField()
    hospital_visit = models.BooleanField()
    comment = models.TextField(blank=True)
    next_submission_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Medication(models.Model):
    report = models.ForeignKey(
        Report, on_delete=models.CASCADE, related_name="medications"
    )
    name = models.CharField(max_length=255)
    frequency = models.CharField(max_length=255)
    
class SkinAnalysis(models.Model):
    class Status(models.TextChoices):
        PROCESSING = 'processing', 'Processing'
        ANALYZED = 'analyzed', 'Analyzed'
        REVIEW = 'review', 'Under Review'
        REVIEWED = 'reviewed', 'Reviewed'
        FAILED = 'failed', 'Failed'

    job_id = models.CharField(max_length=100, blank=True, null=True)
    image = models.ImageField(upload_to='skin_scans/')
    body_part = models.CharField(max_length=100, default="Face")
    prediction = models.CharField(max_length=100, blank=True, null=True)
    confidence = models.FloatField(default=0.0)
    medical_case = models.ForeignKey('MedicalCase', on_delete=models.CASCADE, related_name='timeline_images', null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.REVIEW
    )
    answers = models.JSONField(default=dict, blank=True)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='skin_analyses', null=True) 
    pain_level = models.IntegerField(default=0)
    duration = models.CharField(max_length=100, blank=True, null=True)
    comments = models.TextField(blank=True, null=True)
    ai_analysis = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['medical_case', 'created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.body_part} - {self.created_at.strftime('%Y-%m-%d')}"
    
    
class Article(models.Model):
    CATEGORY_CHOICES = [
        ('Acne', 'Acne'),
        ('Anti-Aging', 'Anti-Aging'),
        ('Routine', 'Routine'),
        ('Dry Skin', 'Dry Skin'),
        ('Sun', 'Sun Care'),
        ('Basics', 'Basics'),
    ]

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    read_time = models.CharField(max_length=20, help_text="e.g., '3 min read'")
    content = models.TextField()
    image = models.ImageField(upload_to='articles/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class DailyTip(models.Model):
    content = models.TextField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Tip: {self.content[:30]}..."

class MedicalCase(models.Model):  
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='medical_cases')
    title = models.CharField(max_length=255) 
    disease_type = models.CharField(max_length=100, blank=True, null=True) 
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True) 

    class Meta:
        indexes = [
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['patient', 'is_active']),
        ]

    def __str__(self):
        return f"{self.title} - {self.patient.username}"

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    submission = models.ForeignKey('Submission', on_delete=models.CASCADE, null=True, blank=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f"Notification for {self.user.username}: {self.message}"
    
class MedicalAuditLog(models.Model):
    ACTION_CHOICES = (
        ('VIEW', 'Viewed'),
        ('CREATE', 'Created'),
        ('UPDATE', 'Updated'),
        ('DELETE', 'Deleted'),
    )
    
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=50) 
    resource_id = models.CharField(max_length=50)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    def __str__(self):
        username = self.user.username if self.user else "deleted-user"
        return f"[{self.timestamp}] {username} {self.action} {self.resource_type} #{self.resource_id}"
