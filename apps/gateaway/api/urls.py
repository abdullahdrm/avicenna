from django.urls import path
from .views_http import HealthView, ApiRootView
from .views import (
    SkinPhotoListCreateView,
    PatientProfileView,
    SessionLoginView,
    SessionLogoutView,
    MeView,
    PatientRegisterView,
)

urlpatterns = [
    # connectivity tests
    path("", ApiRootView.as_view(), name="api-root"),
    path("health/", HealthView.as_view(), name="health"),

    # auth (session)
    path("auth/login/", SessionLoginView.as_view(), name="session-login"),
    path("auth/logout/", SessionLogoutView.as_view(), name="session-logout"),
    path("auth/me/", MeView.as_view(), name="me"),

    # optional register
    path("register/", PatientRegisterView.as_view(), name="register"),

    # core endpoints
    path("profile/", PatientProfileView.as_view(), name="profile"),
    path("photos/", SkinPhotoListCreateView.as_view(), name="photos"),
]
