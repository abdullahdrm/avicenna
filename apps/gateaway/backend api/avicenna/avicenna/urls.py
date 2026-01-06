from django.contrib import admin
from django.urls import include, path
from django.conf.urls.static import static
from django.conf import settings

from rest_framework import routers
from api.views import SkinAnalysisViewSet, ArticleViewSet, DailyTipViewSet

router = DefaultRouter()
router.register(r'skin-analysis', SkinAnalysisViewSet)
router.register(r'articles', ArticleViewSet)
router.register(r'tips', DailyTipViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('avicenna_api.urls')),

]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )