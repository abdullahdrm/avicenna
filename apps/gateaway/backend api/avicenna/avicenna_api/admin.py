from django.contrib import admin
from .models import *
# Register your models here.

admin.site.register(User)
admin.site.register(PatientProfile)
admin.site.register(DoctorProfile)
admin.site.register(Submission)
admin.site.register(Report)
admin.site.register(Medication)
@admin.register(SkinAnalysis)
class SkinAnalysisAdmin(admin.ModelAdmin):
    list_display = ('body_part', 'status', 'created_at')

