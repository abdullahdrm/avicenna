from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import *

# Register your models here.

class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Role', {'fields': ('role',)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Role', {'fields': ('role',)}),
    )
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = BaseUserAdmin.list_filter + ('role',)

admin.site.register(User, UserAdmin)
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

