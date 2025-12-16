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
    
@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'created_at')

@admin.register(DailyTip)
class DailyTipAdmin(admin.ModelAdmin):
    list_display = ('content', 'is_active')

