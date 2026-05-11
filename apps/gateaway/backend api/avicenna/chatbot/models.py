from django.db import models

class QAEmbedding(models.Model):
    question = models.TextField()
    answer = models.TextField()
    embedding = models.JSONField(default=list)

    class Meta:
        app_label = 'chatbot'
