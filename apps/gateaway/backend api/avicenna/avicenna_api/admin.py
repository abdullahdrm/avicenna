from django.contrib import admin
from .models import Case, Patient, Doctor
# Register your models here.

admin.site.register(Case)
admin.site.register(Patient)
admin.site.register(Doctor)