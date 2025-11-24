from rest_framework import permissions
from django.contrib.auth import get_user_model

User = get_user_model()


class IsPatientOrDoctorForPhoto(permissions.BasePermission):
    """
    Patient: can access only own photos.
    Doctor: can access photos where they are assigned.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not isinstance(user, User):
            return False

        if user.role == User.ROLE_PATIENT:
            return obj.patient_id == user.id

        if user.role == User.ROLE_DOCTOR:
            return obj.doctor_id == user.id

        return False
