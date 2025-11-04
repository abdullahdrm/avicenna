from django.urls import path
from .views import get_cases, logout, is_authenticated, register, CustomTokenObtainPairView, CustomRefreshTokenView


urlpatterns = [
    # Authentication
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomRefreshTokenView.as_view(), name='token_refresh'),
    path('logout/', logout, name='logout'),
    path('authenticated/', is_authenticated),
    path('register/', register, name='register'),
    # Cases
    path('cases/', get_cases, name='get-cases'),


]
