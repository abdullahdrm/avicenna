from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.utils import timezone


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
        choices=[('pending', 'Pending'), ('reviewed', 'Reviewed')],
        default='pending'
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
            models.Index(fields=['doctor', 'created_at']),
            models.Index(fields=['patient', 'created_at']),
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
    job_id = models.CharField(max_length=100, blank=True, null=True)
    image = models.ImageField(upload_to='skin_scans/')
    body_part = models.CharField(max_length=100, default="Face")
    prediction = models.CharField(max_length=100, blank=True, null=True)
    confidence = models.FloatField(default=0.0)
    status = models.CharField(
        max_length=20,
        choices=[('analyzed', 'Analyzed'), ('review',
                                            'Under Review'), ('reviewed', 'Reviewed')],
        default='review'
    )
    answers = models.JSONField(default=dict, blank=True)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='skin_analyses', null=True)
    pain_level = models.IntegerField(default=0)
    duration = models.CharField(max_length=100, blank=True, null=True)
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

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


class FollowUpCase(models.Model):

    STATUS_OPEN = "open"
    STATUS_CLOSED = "closed"

    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_CLOSED, "Closed"),
    ]

    original_submission = models.OneToOneField(
        Submission,
        on_delete=models.CASCADE,
        related_name="followup_case",
    )

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="followup_cases_as_patient",
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="followup_cases_as_doctor",
    )

    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_OPEN)

    due_date = models.DateField(null=True, blank=True)
    scheduled_date = models.DateField(null=True, blank=True)
    last_followup_at = models.DateTimeField(null=True, blank=True)

    priority = models.CharField(max_length=20, default="normal")
    title = models.CharField(max_length=200, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["doctor", "status", "due_date"]),
            models.Index(fields=["patient", "status", "due_date"]),
        ]

    def clean(self):
        if self.patient_id != self.original_submission.patient_id:
            raise ValidationError(
                "FollowUpCase patient must match original submission patient.")
        if self.doctor_id != self.original_submission.doctor_id:
            raise ValidationError(
                "FollowUpCase doctor must match original submission doctor.")

    @property
    def is_overdue(self):
        if not self.due_date or self.status != self.STATUS_OPEN:
            return False
        return timezone.localdate() > self.due_date

    @property
    def is_due_soon(self):
        if not self.due_date or self.status != self.STATUS_OPEN:
            return False
        today = timezone.localdate()
        return 0 <= (self.due_date - today).days <= 3

    def __str__(self):
        return f"FollowUpCase #{self.id} ({self.patient} -> {self.doctor})"


class FollowUpRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_DECLINED = "declined"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    case = models.ForeignKey(
        FollowUpCase, on_delete=models.CASCADE, related_name="requests")
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followup_requests")
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followup_requests_received")

    reason = models.TextField(blank=True, default="")
    preferred_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    doctor_response = models.TextField(blank=True, default="")
    approved_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["doctor", "status", "created_at"]),
            models.Index(fields=["patient", "status", "created_at"]),
        ]

    def clean(self):
        if self.patient_id != self.case.patient_id:
            raise ValidationError("Request patient must match case patient.")
        if self.doctor_id != self.case.doctor_id:
            raise ValidationError("Request doctor must match case doctor.")

    def __str__(self):
        return f"FollowUpRequest #{self.id} ({self.status})"


class FollowUpLink(models.Model):
    case = models.ForeignKey(
        FollowUpCase, on_delete=models.CASCADE, related_name="followups")
    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE, related_name="followup_link")

    sequence_number = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["case", "sequence_number"]),
        ]

    def clean(self):
        if self.submission.patient_id != self.case.patient_id:
            raise ValidationError(
                "Follow-up submission patient must match case patient.")
        if self.submission.doctor_id != self.case.doctor_id:
            raise ValidationError(
                "Follow-up submission doctor must match case doctor.")

    def __str__(self):
        return f"FollowUpLink case={self.case_id} seq={self.sequence_number}"


class FollowUpNote(models.Model):
    case = models.ForeignKey(
        FollowUpCase, on_delete=models.CASCADE, related_name="notes_thread")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followup_notes")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["case", "created_at"])]

    def clean(self):
        if self.author_id not in (self.case.patient_id, self.case.doctor_id):
            raise ValidationError("Only case participants can post notes.")

    def __str__(self):
        return f"FollowUpNote #{self.id} case={self.case_id}"


class Notification(models.Model):
    TYPE_GENERIC = "generic"
    TYPE_FOLLOWUP_REQUEST = "followup_request"
    TYPE_FOLLOWUP_APPROVED = "followup_approved"
    TYPE_FOLLOWUP_DECLINED = "followup_declined"
    TYPE_FOLLOWUP_SUBMITTED = "followup_submitted"
    TYPE_FOLLOWUP_MESSAGE = "followup_message"

    TYPE_CHOICES = [
        (TYPE_GENERIC, "Generic"),
        (TYPE_FOLLOWUP_REQUEST, "Follow-up Request"),
        (TYPE_FOLLOWUP_APPROVED, "Follow-up Approved"),
        (TYPE_FOLLOWUP_DECLINED, "Follow-up Declined"),
        (TYPE_FOLLOWUP_SUBMITTED, "Follow-up Submitted"),
        (TYPE_FOLLOWUP_MESSAGE, "Follow-up Message"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    notif_type = models.CharField(
        max_length=50, choices=TYPE_CHOICES, default=TYPE_GENERIC)
    title = models.CharField(max_length=200, default="")
    body = models.TextField(blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"]),
        ]

    def __str__(self):
        return f"Notification #{self.id} to user={self.user_id}"


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL,
                              on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    # FollowUpCase, FollowUpRequest, FollowUpLink, Note, etc.
    entity = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=50, blank=True, default="")
    meta = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["entity", "created_at"]),
            models.Index(fields=["actor", "created_at"]),
        ]

    def __str__(self):
        return f"{self.action} {self.entity}({self.entity_id})"
