from django.urls import path
from .views import (
    PatientRegisterView,
    PatientProfileView,
    SkinPhotoListCreateView,
    SkinPhotoDetailView,
    SessionLoginView,
    SessionLogoutView,
    MeView,
    DoctorDashboardView,
    DoctorCaseDetailView,
    ApiRootView,
    DoctorCaseListView,
    DoctorReviewCaseView
)

urlpatterns = [
    # auth (session cookie)

    path("", ApiRootView.as_view(), name="api-root"),
    path("auth/login/", SessionLoginView.as_view(), name="session-login"),
    path("auth/logout/", SessionLogoutView.as_view(), name="session-logout"),
    path("auth/me/", MeView.as_view(), name="me"),

    # register
    path("register/", PatientRegisterView.as_view(), name="register"),

    # profile
    path("profile/", PatientProfileView.as_view(), name="profile"),

    # photos
    path("photos/", SkinPhotoListCreateView.as_view(), name="photos"),
    path("photos/<int:pk>/", SkinPhotoDetailView.as_view(), name="photo-detail"),

    #doctor
    path("doctor/dashboard/", DoctorDashboardView.as_view()),
    path("doctor/case/<int:photo_id>/", DoctorCaseDetailView.as_view()),
    path("doctor/review/<int:photo_id>/", DoctorReviewCaseView.as_view()),
    path("doctor/cases/", DoctorCaseListView.as_view(), name="doctor-cases"),
]
