from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    PatientRegisterView,
    PatientProfileView,
    SkinPhotoListCreateView,
    SkinPhotoDetailView,
)

urlpatterns = [
    # AUTH
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # REGISTER
    path("register/", PatientRegisterView.as_view(), name="register"),

    # PROFILE
    path("profile/", PatientProfileView.as_view(), name="profile"),

    # PHOTOS
    path("photos/", SkinPhotoListCreateView.as_view(), name="photos"),
    path("photos/<int:pk>/", SkinPhotoDetailView.as_view(), name="photo-detail"),
]
