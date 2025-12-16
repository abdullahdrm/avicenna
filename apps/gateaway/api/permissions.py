from rest_framework.permissions import BasePermission


class IsPatientOrDoctorForPhoto(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return obj.patient == user or obj.doctor == user
