from django.contrib import admin
from .models import User, SkinPhoto, PatientProfile


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'email', 'role', 'is_active')
    list_filter = ('role', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email')


@admin.register(SkinPhoto)
class SkinPhotoAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'doctor', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('patient__username', 'doctor__username')


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('patient', 'gender', 'skin_type', 'height', 'weight', 'age')