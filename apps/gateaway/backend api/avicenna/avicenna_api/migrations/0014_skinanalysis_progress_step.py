from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('avicenna_api', '0013_remove_submission_avicenna_ap_doctor__e7ad36_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='skinanalysis',
            name='progress_step',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
