from django.contrib import admin
from django.urls import include, path

from rest_framework import routers

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('avicenna_api.urls')),

]