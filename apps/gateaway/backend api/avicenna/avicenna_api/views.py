from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Case, Patient, Doctor
from .serializers import CaseSerializer, RegisterSerializer


# Create your views here.


# START AUTHENTICATION
class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
            tokens = response.data

            access_token = tokens['access']
            refresh_token = tokens['refresh']

            user = self.get_user_from_request(request.data['username'])
            if hasattr(user, 'patient_profile'):
                role = 'patient'
            elif hasattr(user, 'doctor_profile'):
                role = 'doctor'
            else:
                role = 'unknown'

            res = Response()

            res.data = {'success': True, 'role': role}
            res.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=True,
                samesite='None',
                path='/'
            )
            res.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=True,
                samesite='None',
                path='/'
            )

            return res
        except:
            return Response({'success': False})

    def get_user_from_request(self, username):
        from django.contrib.auth.models import User
        return User.objects.get(username=username)


class CustomRefreshTokenView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.COOKIES.get('refresh_token')
            request.data['refresh'] = refresh_token
            response = super().post(request, *args, **kwargs)
            tokens = response.data
            access_token = tokens['access']

            res = Response()
            res.data = {'refreshed': True}
            res.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=True,
                samesite='None',
                path='/'
            )

            return res

        except:
            return Response({'refreshed': False})


@api_view(['POST'])
def logout(request):
    try:
        res = Response()
        res.data = {'success': True}
        res.delete_cookie('access_token', path='/', samesite='None')
        res.delete_cookie('refresh_token', path='/', samesite='None')
        return res
    except:
        return Response({'success': False})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def is_authenticated(request):
    return Response({'authenticated': True})


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors)

# END AUTHENTICATION

# START CASES
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_cases(request):
    user = request.user

    if hasattr(user, 'patient_profile'):
        cases = Case.objects.filter(patient=user.patient_profile)
    elif hasattr(user, 'doctor_profile'):
        cases = Case.objects.filter(doctor=user.doctor_profile)

    else:
        return Response({'error': 'User has no associated profile.'}, status=400)

    serializer = CaseSerializer(cases, many=True)
    return Response(serializer.data)



