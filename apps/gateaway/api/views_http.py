from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from .http_utils import ok


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Use this to test from emulator/phone quickly
        return ok({"service": "avicenna-backend", "message": "alive"})


class ApiRootView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return ok(
            {
                "endpoints": {
                    "health": "/api/health/",
                    "photos": "/api/photos/",
                    "profile": "/api/profile/",
                    "jwt_token": "/api/auth/token/",
                    "jwt_refresh": "/api/auth/token/refresh/",
                    "session_login": "/api/auth/login/",
                    "session_logout": "/api/auth/logout/",
                    "me": "/api/auth/me/",
                }
            }
        )
