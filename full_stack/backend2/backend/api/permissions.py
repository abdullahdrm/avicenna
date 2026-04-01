from rest_framework.permissions import BasePermission


class IsPatientOrDoctorForPhoto(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return obj.patient == user or obj.doctor == user

class IsPatient(BasePermission):
    """
    Allows access only to users with patient role
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "patient"


class IsDoctor(BasePermission):
    """
    Allows access only to users with doctor role
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "doctor"