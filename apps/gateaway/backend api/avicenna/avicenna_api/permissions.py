from rest_framework.permissions import BasePermission
from .models import *


class IsDoctor(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'doctor'
        )


class IsCaseParticipant(BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, FollowUpCase):
            case = obj
        else:
            case = getattr(obj, "case", None)
            if case is None:
                return False

        return request.user.is_authenticated and request.user.id in (case.patient_id, case.doctor_id)


class IsDoctorOfCase(BasePermission):
    def has_object_permission(self, request, view, obj):
        case = obj if hasattr(obj, "doctor_id") else getattr(obj, "case", None)
        return bool(case) and request.user.is_authenticated and request.user.id == case.doctor_id


class IsPatientOfCase(BasePermission):
    def has_object_permission(self, request, view, obj):
        case = obj if hasattr(
            obj, "patient_id") else getattr(obj, "case", None)
        return bool(case) and request.user.is_authenticated and request.user.id == case.patient_id
