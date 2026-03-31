from django.contrib import admin
from django.urls import include, path
from django.conf.urls.static import static
from django.conf import settings

from avicenna_api.views import SecureMediaView 

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('avicenna_api.urls')),
    path('media/<path:file_path>', SecureMediaView.as_view(), name='secure-media'),
]