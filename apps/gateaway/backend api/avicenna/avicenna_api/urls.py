from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()


router.register(r'skin-analysis', SkinAnalysisViewSet, basename='skin-analysis')
router.register(r'articles', ArticleViewSet)
router.register(r'tips', DailyTipViewSet)
router.register(r'cases', MedicalCaseViewSet, basename='medicalcase')
urlpatterns = [
    path('', include(router.urls)),
    # Authentication
    path('users/', UserCreateView.as_view(), name='user-register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('authenticated/', is_authenticated),
    path('profile/', PatientProfileView.as_view(), name='profile'),
    # Doctor
    path('doctor/submissions/', DoctorSubmissionsView.as_view(), name='doctor-submissions'),
    path('submissions/<int:pk>/', DoctorSubmissionDetailView.as_view(), name='submission-detail'),
    path('doctor/profile/', DoctorProfileView.as_view(), name='doctor-me'),
    path("doctor/dashboard/", DoctorDashboardView.as_view()),
    path('doctor/submissions/<int:pk>/', DoctorSubmissionDetailView.as_view(), name='doctor-submission-detail'),
    path(
        "submissions/<int:id>/report/",
        SubmissionReportCreateView.as_view(),
        name="submission-report-create",
    ),
    path("submissions/<int:id>/approve/", SubmissionApproveView.as_view(), name="submission-approve"),
path("submissions/<int:id>/reupload/", SubmissionReuploadView.as_view(), name="submission-reupload"),
    path('patient/reports/', PatientReportsView.as_view(), name='patient-reports'), 
    path('notifications/', NotificationListView.as_view(), name='user-notifications'),
]
