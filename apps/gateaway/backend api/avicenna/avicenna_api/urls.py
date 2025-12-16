from django.urls import path
from .views import *


urlpatterns = [
    # Authentication
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomRefreshTokenView.as_view(), name='token_refresh'),
    path('logout/', logout, name='logout'),
    path('authenticated/', is_authenticated),
    path('register/', register, name='register'),

    # Doctor
    path('doctor/submissions/', DoctorSubmissionsView.as_view(), name='doctor-submissions'),
    path('submissions/<int:pk>/', DoctorSubmissionDetailView.as_view(), name='submission-detail'),
    path('doctor/profile/', DoctorMeView.as_view(), name='doctor-me'),
    path("doctor/dashboard/", DoctorDashboardView.as_view()),
    path(
            "submissions/<int:id>/report/",
            SubmissionReportCreateView.as_view(),
            name="submission-report-create",
        ),


]
